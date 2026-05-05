/**
 * scripts/refresh/au_abs.mjs
 *
 * ABS (Australian Bureau of Statistics) → 시드니/멜버른 rent + food 갱신.
 *
 * 출처: ABS Residential Property Price Indexes + CPI
 * API: https://api.data.gov.au/ + https://www.abs.gov.au/
 *
 * 방법:
 * - rent: median weekly rent × 4.33 (월 환산)
 * - food: CPI Sydney/Melbourne
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const ABS_API_BASE = 'https://api.data.abs.gov.au/data';

export const CITY_CONFIGS = {
  sydney: {
    id: 'sydney',
    name: { ko: '시드니', en: 'Sydney' },
    country: 'AU',
    currency: 'AUD',
    region: 'oceania',
    absRegion: '1GSYD',
  },
  melbourne: {
    id: 'melbourne',
    name: { ko: '멜버른', en: 'Melbourne' },
    country: 'AU',
    currency: 'AUD',
    region: 'oceania',
    absRegion: '2GMEL',
  },
};

export const ABS_RENT_SERIES = {
  studio: 'CPI.Q.10.640101.10.Q',
  oneBed: 'CPI.Q.10.640102.10.Q',
  twoBed: 'CPI.Q.10.640103.10.Q',
};

export const ABS_CPI_SERIES = {
  milk1L: 'CPI.Q.10.110401.10.Q',
  eggs12: 'CPI.Q.10.110402.10.Q',
  bread: 'CPI.Q.10.110101.10.Q',
  chicken1kg: 'CPI.Q.10.110201.10.Q',
};

export const STATIC_RENT = {
  sydney: { share: 250, studio: 450, oneBed: 550, twoBed: 700 },
  melbourne: { share: 220, studio: 400, oneBed: 500, twoBed: 650 },
};

export const STATIC_GROCERIES = {
  rice1kg: 3.50,
  onion1kg: 2.80,
  apple1kg: 5.50,
  ramen: 2.00,
};

export const STATIC_FOOD = {
  restaurantMeal: 25.00,
  cafe: 5.50,
};

export const SOURCE_RENT = {
  category: 'rent',
  name: 'ABS Residential Property Price Indexes + static estimates',
  url: 'https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation',
};

export const SOURCE_FOOD = {
  category: 'food',
  name: 'ABS Consumer Price Index + static estimates',
  url: 'https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia',
};

/**
 * 주간 임대료 → 월간 환산.
 * @param {number} weeklyRent
 * @returns {number}
 */
export function weeklyToMonthly(weeklyRent) {
  return Math.round(weeklyRent * 4.33);
}

/**
 * ABS API 응답 파싱. 최신 observation value 추출.
 * @param {unknown} data
 * @returns {number | null}
 */
export function parseAbsValue(data) {
  if (!data || typeof data !== 'object') return null;

  const observations = data.dataSets?.[0]?.observations;
  if (!observations || typeof observations !== 'object') return null;

  const keys = Object.keys(observations);
  if (keys.length === 0) return null;

  const lastKey = keys[keys.length - 1];
  const value = parseFloat(observations[lastKey]?.[0]);

  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  return null;
}

/**
 * ABS 시리즈 데이터 fetch.
 * @param {string} seriesId
 * @param {string} regionCode
 * @returns {Promise<number | null>}
 */
async function fetchAbsSeries(seriesId, regionCode) {
  const url = `${ABS_API_BASE}/${seriesId}?detail=dataonly&dimensionAtObservation=TIME_PERIOD`;
  try {
    const response = await fetchWithRetry(url, {
      headers: { Accept: 'application/json' },
    });
    const data = await response.json();
    return parseAbsValue(data);
  } catch {
    return null;
  }
}

/**
 * 정적 임대료 데이터 → rent 객체 매핑 (주간 → 월간 환산).
 * @param {string} cityId
 * @returns {{share: number, studio: number, oneBed: number, twoBed: number}}
 */
export function mapToRent(cityId) {
  const staticRent = STATIC_RENT[cityId] ?? STATIC_RENT.sydney;

  return {
    share: weeklyToMonthly(staticRent.share),
    studio: weeklyToMonthly(staticRent.studio),
    oneBed: weeklyToMonthly(staticRent.oneBed),
    twoBed: weeklyToMonthly(staticRent.twoBed),
  };
}

/**
 * groceries 매핑.
 * @param {Map<string, number | null>} cpiData
 * @returns {{milk1L: number, eggs12: number, rice1kg: number, chicken1kg: number, bread: number, onion1kg: number, apple1kg: number, ramen: number}}
 */
export function mapToGroceries(cpiData) {
  return {
    milk1L: cpiData.get('milk1L') ?? 2.50,
    eggs12: cpiData.get('eggs12') ?? 6.50,
    bread: cpiData.get('bread') ?? 3.80,
    chicken1kg: cpiData.get('chicken1kg') ?? 12.00,
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
 * ABS → 시드니/멜버른 rent + food 갱신.
 * @param {{dryRun?: boolean, cities?: string[], useStatic?: boolean}} [opts]
 * @returns {Promise<RefreshResult>}
 */
export default async function refresh(opts = {}) {
  const errors = [];
  const changes = [];
  const fields = [];
  const updatedCities = [];

  const targetCities = opts.cities ?? Object.keys(CITY_CONFIGS);

  const cpiData = new Map();

  if (!opts.useStatic) {
    for (const [field, seriesId] of Object.entries(ABS_CPI_SERIES)) {
      try {
        const value = await fetchAbsSeries(seriesId, 'AU');
        if (value !== null) {
          cpiData.set(field, value);
        }
      } catch (err) {
        errors.push({
          cityId: 'all',
          reason: `ABS CPI fetch failed for ${field}: ${redactErrorMessage(String(err?.message ?? 'unknown'))}`,
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

    const newRent = mapToRent(cityId);
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
    source: 'au_abs',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}
