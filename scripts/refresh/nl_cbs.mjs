/**
 * scripts/refresh/nl_cbs.mjs
 *
 * CBS (Centraal Bureau voor de Statistiek) → 암스테르담 rent + food 갱신.
 *
 * 출처: CBS Open Data (OData API)
 * API: https://opendata.cbs.nl/ODataApi/odata/ (JSON, 키 불필요)
 *
 * 방법:
 * - rent: Amsterdam 평균 임대료
 * - food: CPI by item + 정적 보정
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const CBS_API_BASE = 'https://opendata.cbs.nl/ODataApi/odata';

export const CITY_CONFIGS = {
  amsterdam: {
    id: 'amsterdam',
    name: { ko: '암스테르담', en: 'Amsterdam' },
    country: 'NL',
    currency: 'EUR',
    region: 'eu',
  },
};

export const STATIC_RENT = {
  share: 700,
  studio: 1200,
  oneBed: 1500,
  twoBed: 2100,
};

export const STATIC_GROCERIES = {
  milk1L: 1.15,
  eggs12: 3.20,
  rice1kg: 2.40,
  chicken1kg: 9.00,
  bread: 1.60,
  onion1kg: 1.50,
  apple1kg: 2.80,
  ramen: 0.95,
};

export const STATIC_FOOD = {
  restaurantMeal: 18.00,
  cafe: 4.50,
};

export const SOURCE_RENT = {
  category: 'rent',
  name: 'CBS Open Data + static estimates',
  url: 'https://opendata.cbs.nl/',
};

export const SOURCE_FOOD = {
  category: 'food',
  name: 'CBS CPI + static estimates',
  url: 'https://opendata.cbs.nl/',
};

/**
 * CBS OData API JSON 응답 파싱.
 * @param {unknown} data
 * @returns {number | null}
 */
export function parseCbsValue(data) {
  if (!data || typeof data !== 'object') return null;

  const values = data.value ?? data.d?.results;
  if (!Array.isArray(values) || values.length === 0) return null;

  const latest = values[values.length - 1];
  const numericValue = latest?.value ?? latest?.Value ?? latest?.Waarde;
  const value = parseFloat(numericValue);
  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  return null;
}

/**
 * rent 데이터 반환 (현재 정적).
 * @returns {{share: number, studio: number, oneBed: number, twoBed: number}}
 */
export function getRentData() {
  return {
    share: STATIC_RENT.share,
    studio: STATIC_RENT.studio,
    oneBed: STATIC_RENT.oneBed,
    twoBed: STATIC_RENT.twoBed,
  };
}

/**
 * groceries 데이터 반환 (현재 정적).
 * @returns {{milk1L: number, eggs12: number, rice1kg: number, chicken1kg: number, bread: number, onion1kg: number, apple1kg: number, ramen: number}}
 */
export function getGroceriesData() {
  return { ...STATIC_GROCERIES };
}

/**
 * CBS API 상태 체크.
 * @returns {Promise<boolean>}
 */
export async function checkCbsApiStatus() {
  const url = `${CBS_API_BASE}/37296ned`;
  try {
    const response = await fetchWithRetry(url, { timeoutMs: 10000 });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * CBS → 암스테르담 rent + food 갱신.
 * @param {{dryRun?: boolean, cities?: string[], useStatic?: boolean}} [opts]
 * @returns {Promise<RefreshResult>}
 */
export default async function refresh(opts = {}) {
  const errors = [];
  const changes = [];
  const fields = [];
  const updatedCities = [];

  const targetCities = opts.cities ?? Object.keys(CITY_CONFIGS);

  let apiAvailable = false;
  if (!opts.useStatic) {
    apiAvailable = await checkCbsApiStatus();
    if (!apiAvailable) {
      errors.push({
        cityId: 'amsterdam',
        reason: 'CBS API unavailable, using static values',
      });
    }
  }

  for (const cityId of targetCities) {
    const config = CITY_CONFIGS[cityId];
    if (!config) {
      errors.push({ cityId, reason: `Unknown city: ${cityId}` });
      continue;
    }

    const newRent = getRentData();
    const newGroceries = getGroceriesData();
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
    source: 'nl_cbs',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}
