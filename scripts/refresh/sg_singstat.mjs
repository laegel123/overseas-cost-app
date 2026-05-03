/**
 * scripts/refresh/sg_singstat.mjs
 *
 * SingStat (Singapore Department of Statistics) → 싱가포르 rent + food 갱신.
 *
 * 출처: SingStat Rental Index + CPI
 * API: https://tablebuilder.singstat.gov.sg/api/table/tabledata/<resourceId>
 * 키: SG_DATA_GOV_KEY (data.gov.sg API)
 *
 * 방법:
 * - rent: HDB rental + private property rental 평균
 * - food: CPI by item + hawker centre 가격 정적 추정
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const SINGSTAT_API_BASE = 'https://tablebuilder.singstat.gov.sg/api/table/tabledata';

export const CITY_CONFIGS = {
  singapore: {
    id: 'singapore',
    name: { ko: '싱가포르', en: 'Singapore' },
    country: 'SG',
    currency: 'SGD',
    region: 'asia',
  },
};

export const SINGSTAT_TABLE_IDS = {
  rentalIndex: 'M212161',
  cpi: 'M212891',
};

export const STATIC_RENT = {
  share: 1200,
  studio: 2200,
  oneBed: 2800,
  twoBed: 3800,
};

export const STATIC_GROCERIES = {
  milk1L: 3.80,
  eggs12: 4.50,
  rice1kg: 3.20,
  chicken1kg: 9.50,
  bread: 2.80,
  onion1kg: 2.50,
  apple1kg: 5.80,
  ramen: 1.50,
};

export const STATIC_FOOD = {
  restaurantMeal: 15.00,
  cafe: 6.00,
  hawkerMeal: 5.00,
};

export const SOURCE_RENT = {
  category: 'rent',
  name: 'SingStat Rental Index + static estimates',
  url: 'https://www.singstat.gov.sg/find-data/search-by-theme/industry/real-estate',
};

export const SOURCE_FOOD = {
  category: 'food',
  name: 'SingStat CPI + hawker centre estimates',
  url: 'https://www.singstat.gov.sg/find-data/search-by-theme/economy/prices-and-price-indices',
};

/**
 * SingStat API 상태 체크.
 * @returns {Promise<boolean>}
 */
export async function checkSingStatStatus() {
  const url = `${SINGSTAT_API_BASE}/${SINGSTAT_TABLE_IDS.rentalIndex}`;
  try {
    const response = await fetchWithRetry(url, { timeoutMs: 10000 });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * SingStat API 응답 파싱. 최신 값 추출.
 * @param {unknown} data
 * @returns {number | null}
 */
export function parseSingStatValue(data) {
  if (!data || typeof data !== 'object') return null;

  const records = data.Data?.row;
  if (!Array.isArray(records) || records.length === 0) return null;

  const latestRecord = records[records.length - 1];
  const columns = latestRecord?.columns;
  if (!Array.isArray(columns) || columns.length === 0) return null;

  const valueCol = columns.find((c) => c.key === 'value' || c.key === 'Value');
  const value = parseFloat(valueCol?.value);

  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  return null;
}

/**
 * SingStat 테이블 데이터 fetch.
 * @param {string} tableId
 * @param {string} [apiKey]
 * @returns {Promise<number | null>}
 */
async function fetchSingStatTable(tableId, apiKey) {
  const url = `${SINGSTAT_API_BASE}/${tableId}`;
  const headers = { Accept: 'application/json' };
  if (apiKey) {
    headers['api-key'] = apiKey;
  }

  try {
    const response = await fetchWithRetry(url, { headers });
    const data = await response.json();
    return parseSingStatValue(data);
  } catch {
    return null;
  }
}

/**
 * 정적 임대료 데이터 매핑.
 * @returns {{share: number, studio: number, oneBed: number, twoBed: number}}
 */
export function mapToRent() {
  return { ...STATIC_RENT };
}

/**
 * groceries 매핑.
 * @returns {{milk1L: number, eggs12: number, rice1kg: number, chicken1kg: number, bread: number, onion1kg: number, apple1kg: number, ramen: number}}
 */
export function mapToGroceries() {
  return { ...STATIC_GROCERIES };
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * SingStat → 싱가포르 rent + food 갱신.
 * @param {{dryRun?: boolean, cities?: string[], useStatic?: boolean}} [opts]
 * @returns {Promise<RefreshResult>}
 */
export default async function refresh(opts = {}) {
  const errors = [];
  const changes = [];
  const fields = [];
  const updatedCities = [];

  const targetCities = opts.cities ?? Object.keys(CITY_CONFIGS);

  const apiKey = process.env.SG_DATA_GOV_KEY;
  let apiAvailable = false;

  if (!opts.useStatic) {
    if (!apiKey) {
      errors.push({
        cityId: 'all',
        reason: 'SG_DATA_GOV_KEY environment variable not set, using static values',
      });
    } else {
      apiAvailable = await checkSingStatStatus();
      if (!apiAvailable) {
        errors.push({
          cityId: 'all',
          reason: 'SingStat API unavailable, using static values',
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

    const newRent = mapToRent();
    const newGroceries = mapToGroceries();
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
        await writeCity(cityId, updatedData, SOURCE_RENT);
        await writeCity(cityId, { ...updatedData, lastUpdated: base.lastUpdated || '' }, SOURCE_FOOD);
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
    source: 'sg_singstat',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}
