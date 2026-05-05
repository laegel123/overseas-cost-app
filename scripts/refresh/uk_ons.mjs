/**
 * scripts/refresh/uk_ons.mjs
 *
 * UK ONS (Office for National Statistics) → 런던 rent + food 갱신.
 *
 * 출처: ONS Private Rental Market Statistics + Consumer Price Inflation
 * API: https://api.ons.gov.uk/ (JSON, 키 불필요)
 *
 * 방법:
 * - rent: London median rent by # bedrooms
 * - food: COICOP 코드별 평균가 (milk, eggs, bread 등)
 *
 * **TODO(v1.x)**: `ONS_RENT_SERIES` 의 시리즈 ID (`MM23-CZMP` 등) 가 ONS API `/timeseries/{id}/data` 엔드포인트
 * 에서 실제 조회 가능한지 미검증. ONS Private Rental Market Statistics 데이터는 timeseries 보다 다운로드
 * 파일 형태가 주력 — useStatic=false 호출이 404/empty 반환 가능. v1.x 에서 실제 ONS endpoint 검증 후 정정.
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const ONS_API_BASE = 'https://api.ons.gov.uk';

export const CITY_CONFIGS = {
  london: {
    id: 'london',
    name: { ko: '런던', en: 'London' },
    country: 'GB',
    currency: 'GBP',
    region: 'eu',
  },
};

export const ONS_RENT_SERIES = {
  studio: 'MM23-CZMP',
  oneBed: 'MM23-CZMQ',
  twoBed: 'MM23-CZMR',
};

export const ONS_CPI_SERIES = {
  milk1L: 'D7BT',
  eggs12: 'D7BU',
  bread: 'D7BV',
  chicken1kg: 'D7BW',
};

export const STATIC_GROCERIES = {
  rice1kg: 2.20,
  onion1kg: 1.50,
  apple1kg: 2.80,
  ramen: 1.20,
};

export const STATIC_FOOD = {
  restaurantMeal: 15.00,
  cafe: 4.00,
};

export const SOURCE_RENT = {
  category: 'rent',
  name: 'ONS Private Rental Market Statistics',
  url: 'https://www.ons.gov.uk/peoplepopulationandcommunity/housing/datasets/privaterentalmarketsummarystatisticsinengland',
};

export const SOURCE_FOOD = {
  category: 'food',
  name: 'ONS Consumer Price Inflation + static estimates',
  url: 'https://www.ons.gov.uk/economy/inflationandpriceindices',
};

/**
 * ONS API 응답 파싱. 최신 observation value 추출.
 * @param {unknown} data
 * @returns {number | null}
 */
export function parseOnsValue(data) {
  if (!data || typeof data !== 'object') return null;

  const observations = data.observations;
  if (!Array.isArray(observations) || observations.length === 0) return null;

  const latest = observations[observations.length - 1];
  const value = parseFloat(latest?.observation);
  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  return null;
}

/**
 * ONS 시리즈 데이터 fetch.
 * @param {string} seriesId
 * @returns {Promise<number | null>}
 */
async function fetchOnsSeries(seriesId) {
  const url = `${ONS_API_BASE}/timeseries/${seriesId}/data`;
  try {
    const response = await fetchWithRetry(url);
    const data = await response.json();
    return parseOnsValue(data);
  } catch {
    return null;
  }
}

/**
 * ONS rent 데이터 → rent 객체 매핑.
 * @param {Map<string, number | null>} onsData
 * @returns {{share: number | null, studio: number | null, oneBed: number | null, twoBed: number | null}}
 */
export function mapToRent(onsData) {
  const studio = onsData.get('studio') ?? null;
  const oneBed = onsData.get('oneBed') ?? null;
  const twoBed = onsData.get('twoBed') ?? null;

  const share = studio !== null ? Math.round(studio * 0.65) : null;

  return { share, studio, oneBed, twoBed };
}

/**
 * ONS CPI 데이터 → groceries 매핑.
 * @param {Map<string, number | null>} cpiData
 * @returns {{milk1L: number, eggs12: number, rice1kg: number, chicken1kg: number, bread: number, onion1kg: number, apple1kg: number, ramen: number}}
 */
export function mapToGroceries(cpiData) {
  return {
    milk1L: cpiData.get('milk1L') ?? 1.50,
    eggs12: cpiData.get('eggs12') ?? 3.50,
    bread: cpiData.get('bread') ?? 1.40,
    chicken1kg: cpiData.get('chicken1kg') ?? 6.00,
    rice1kg: STATIC_GROCERIES.rice1kg,
    onion1kg: STATIC_GROCERIES.onion1kg,
    apple1kg: STATIC_GROCERIES.apple1kg,
    ramen: STATIC_GROCERIES.ramen,
  };
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * ONS → 런던 rent + food 갱신.
 * @param {{dryRun?: boolean, cities?: string[], useStatic?: boolean}} [opts]
 * @returns {Promise<RefreshResult>}
 */
export default async function refresh(opts = {}) {
  const errors = [];
  const changes = [];
  const fields = [];
  const updatedCities = [];

  const targetCities = opts.cities ?? Object.keys(CITY_CONFIGS);

  const rentData = new Map();
  const cpiData = new Map();

  if (!opts.useStatic) {
    for (const [field, seriesId] of Object.entries(ONS_RENT_SERIES)) {
      try {
        const value = await fetchOnsSeries(seriesId);
        if (value !== null) {
          rentData.set(field, value);
        }
      } catch (err) {
        errors.push({
          cityId: 'london',
          reason: `ONS rent fetch failed for ${field}: ${redactErrorMessage(String(err?.message ?? 'unknown'))}`,
        });
      }
    }

    for (const [field, seriesId] of Object.entries(ONS_CPI_SERIES)) {
      try {
        const value = await fetchOnsSeries(seriesId);
        if (value !== null) {
          cpiData.set(field, value);
        }
      } catch (err) {
        errors.push({
          cityId: 'london',
          reason: `ONS CPI fetch failed for ${field}: ${redactErrorMessage(String(err?.message ?? 'unknown'))}`,
        });
      }
    }
  }

  for (const cityId of targetCities) {
    const config = CITY_CONFIGS[cityId];
    if (!config) {
      errors.push({ cityId, reason: `Unknown city: ${cityId}` });
      continue;
    }

    const newRent = mapToRent(rentData);
    const newGroceries = mapToGroceries(cpiData);
    const newFood = {
      restaurantMeal: STATIC_FOOD.restaurantMeal,
      cafe: STATIC_FOOD.cafe,
      groceries: newGroceries,
    };

    let oldData;
    try {
      oldData = await readCity(cityId);
    } catch (err) {
      if (err?.code !== 'CITY_NOT_FOUND') {
        errors.push({
          cityId,
          reason: `Failed to read existing data: ${redactErrorMessage(String(err?.message ?? ''))}`,
        });
      }
    }

    const oldRent = oldData?.rent ?? {};
    const oldFood = oldData?.food ?? {};
    const oldGroceries = oldFood.groceries ?? {};
    let hasChanges = false;

    for (const field of ['share', 'studio', 'oneBed', 'twoBed']) {
      const oldVal = oldRent[field] ?? null;
      const newVal = newRent[field];

      if (oldVal !== newVal) {
        fields.push(field);
        const pctChange = computePctChange(oldVal, newVal);
        changes.push({ cityId, field: `rent.${field}`, oldValue: oldVal, newValue: newVal, pctChange });
        hasChanges = true;
      }
    }

    for (const field of ['restaurantMeal', 'cafe']) {
      const oldVal = oldFood[field] ?? null;
      const newVal = newFood[field];

      if (oldVal !== newVal) {
        fields.push(field);
        const pctChange = computePctChange(oldVal, newVal);
        changes.push({ cityId, field: `food.${field}`, oldValue: oldVal, newValue: newVal, pctChange });
        hasChanges = true;
      }
    }

    for (const [field, newVal] of Object.entries(newGroceries)) {
      const oldVal = oldGroceries[field] ?? null;

      if (oldVal !== newVal) {
        fields.push(field);
        const pctChange = computePctChange(oldVal, newVal);
        changes.push({ cityId, field: `food.groceries.${field}`, oldValue: oldVal, newValue: newVal, pctChange });
        hasChanges = true;
      }
    }

    if (!opts.dryRun && hasChanges) {
      const base = oldData ?? createCitySeed(config);
      const updatedData = {
        ...base,
        rent: newRent,
        food: newFood,
      };

      try {
        await writeCity(cityId, updatedData, [SOURCE_RENT, SOURCE_FOOD]);
        updatedCities.push(cityId);
      } catch (err) {
        errors.push({
          cityId,
          reason: `Write failed: ${redactErrorMessage(String(err?.message ?? 'unknown'))}`,
        });
      }
    } else if (hasChanges) {
      updatedCities.push(cityId);
    }
  }

  return {
    source: 'uk_ons',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}
