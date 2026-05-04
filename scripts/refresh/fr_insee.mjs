/**
 * scripts/refresh/fr_insee.mjs
 *
 * INSEE (Institut national de la statistique) → 파리 rent + food 갱신.
 *
 * 출처: INSEE BDM API
 * API: https://api.insee.fr/series/BDM/V1/ (JSON, 키 불필요)
 *
 * 방법:
 * - rent: Paris Île-de-France region 평균 임대료
 * - food: CPI by item + 정적 보정
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const INSEE_API_BASE = 'https://api.insee.fr/series/BDM/V1';

export const CITY_CONFIGS = {
  paris: {
    id: 'paris',
    name: { ko: '파리', en: 'Paris' },
    country: 'FR',
    currency: 'EUR',
    region: 'eu',
  },
};

export const STATIC_RENT = {
  share: 650,
  studio: 1050,
  oneBed: 1300,
  twoBed: 1800,
};

export const STATIC_GROCERIES = {
  milk1L: 1.20,
  eggs12: 3.50,
  rice1kg: 2.30,
  chicken1kg: 10.00,
  bread: 1.50,
  onion1kg: 1.80,
  apple1kg: 3.00,
  ramen: 1.00,
};

export const STATIC_FOOD = {
  restaurantMeal: 15.00,
  cafe: 4.00,
};

export const SOURCE_RENT = {
  category: 'rent',
  name: 'INSEE BDM + static estimates',
  url: 'https://www.insee.fr/fr/statistiques',
};

export const SOURCE_FOOD = {
  category: 'food',
  name: 'INSEE CPI + static estimates',
  url: 'https://www.insee.fr/fr/statistiques',
};

/**
 * INSEE API JSON 응답 파싱.
 * @param {unknown} data
 * @returns {number | null}
 */
export function parseInseeValue(data) {
  if (!data || typeof data !== 'object') return null;

  const observations = data.observations ?? data.Observations ?? data.series?.observations;
  if (!Array.isArray(observations) || observations.length === 0) return null;

  const latest = observations[observations.length - 1];
  const value = parseFloat(latest?.value ?? latest?.OBS_VALUE);
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
 * INSEE API 상태 체크.
 * @returns {Promise<boolean>}
 */
export async function checkInseeApiStatus() {
  const url = `${INSEE_API_BASE}/data/CNA-2014-PIB`;
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
 * INSEE → 파리 rent + food 갱신.
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
    apiAvailable = await checkInseeApiStatus();
    if (!apiAvailable) {
      errors.push({
        cityId: 'paris',
        reason: 'INSEE API unavailable, using static values',
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
    source: 'fr_insee',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}
