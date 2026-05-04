/**
 * scripts/refresh/ae_fcsc.mjs
 *
 * FCSC (UAE Federal Competitiveness and Statistics Centre) + DSC (Dubai Statistics Center)
 * → 두바이 rent + food 갱신.
 *
 * 출처:
 * - DSC: https://www.dsc.gov.ae/en-us/ (Dubai Statistics Center)
 * - RERA: https://dubailand.gov.ae/en/eservices/rental-index/ (Real Estate Regulatory Agency)
 * - FCSC: https://fcsc.gov.ae/en-us/ (CPI)
 *
 * API: 제한적 (CSV 위주)
 *
 * 방법:
 * - rent: DSC + RERA 데이터 기반 정적 추정
 * - food: FCSC CPI 기반 정적 추정
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const DSC_URL = 'https://www.dsc.gov.ae/en-us/';
const FCSC_URL = 'https://fcsc.gov.ae/en-us/';

export const CITY_CONFIGS = {
  dubai: {
    id: 'dubai',
    name: { ko: '두바이', en: 'Dubai' },
    country: 'AE',
    currency: 'AED',
    region: 'me',
  },
};

export const STATIC_RENT = {
  share: 3000,
  studio: 5500,
  oneBed: 7500,
  twoBed: 11000,
};

export const STATIC_GROCERIES = {
  milk1L: 6.50,
  eggs12: 14.00,
  rice1kg: 8.00,
  chicken1kg: 25.00,
  bread: 5.50,
  onion1kg: 4.50,
  apple1kg: 12.00,
  ramen: 4.00,
};

export const STATIC_FOOD = {
  restaurantMeal: 45.00,
  cafe: 18.00,
};

export const SOURCE_RENT = {
  category: 'rent',
  name: 'DSC + RERA Rental Index + static estimates',
  url: DSC_URL,
};

export const SOURCE_FOOD = {
  category: 'food',
  name: 'FCSC CPI + static estimates',
  url: FCSC_URL,
};

/**
 * DSC 사이트 상태 체크.
 * @returns {Promise<boolean>}
 */
export async function checkDscStatus() {
  try {
    const response = await fetchWithRetry(DSC_URL, { timeoutMs: 10000 });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * FCSC 사이트 상태 체크.
 * @returns {Promise<boolean>}
 */
export async function checkFcscStatus() {
  try {
    const response = await fetchWithRetry(FCSC_URL, { timeoutMs: 10000 });
    return response.ok;
  } catch {
    return false;
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
 * FCSC + DSC → 두바이 rent + food 갱신.
 * @param {{dryRun?: boolean, cities?: string[], useStatic?: boolean}} [opts]
 * @returns {Promise<RefreshResult>}
 */
export default async function refresh(opts = {}) {
  const errors = [];
  const changes = [];
  const fields = [];
  const updatedCities = [];

  const targetCities = opts.cities ?? Object.keys(CITY_CONFIGS);

  let dscAvailable = false;
  let fcscAvailable = false;

  if (!opts.useStatic) {
    [dscAvailable, fcscAvailable] = await Promise.all([
      checkDscStatus(),
      checkFcscStatus(),
    ]);

    if (!dscAvailable) {
      errors.push({
        cityId: 'all',
        reason: 'DSC site unavailable, using static values for rent',
      });
    }
    if (!fcscAvailable) {
      errors.push({
        cityId: 'all',
        reason: 'FCSC site unavailable, using static values for food',
      });
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
    source: 'ae_fcsc',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}
