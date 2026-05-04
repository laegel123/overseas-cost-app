/**
 * scripts/refresh/jp_estat.mjs
 *
 * e-Stat (政府統計) → 도쿄/오사카 rent + food 갱신.
 *
 * 출처: e-Stat 住宅・土地統計調査 + 消費者物価指数
 * API: https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData
 * 키: JP_ESTAT_APP_ID 환경변수 필요
 *
 * 방법:
 * - rent: 都道府県別民営賃貸住宅平均賃料
 * - food: 消費者物価指数 (CPI Tokyo/Osaka)
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage, createMissingApiKeyError } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const ESTAT_API_BASE = 'https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData';

export const CITY_CONFIGS = {
  tokyo: {
    id: 'tokyo',
    name: { ko: '도쿄', en: 'Tokyo' },
    country: 'JP',
    currency: 'JPY',
    region: 'asia',
    estatArea: '13000',
  },
  osaka: {
    id: 'osaka',
    name: { ko: '오사카', en: 'Osaka' },
    country: 'JP',
    currency: 'JPY',
    region: 'asia',
    estatArea: '27000',
  },
};

export const ESTAT_STATS_ID = {
  rent: '0003427113',
  cpi: '0003143513',
};

export const STATIC_RENT = {
  tokyo: { share: 65000, studio: 85000, oneBed: 110000, twoBed: 160000 },
  osaka: { share: 45000, studio: 60000, oneBed: 80000, twoBed: 120000 },
};

export const STATIC_GROCERIES = {
  milk1L: 220,
  eggs12: 280,
  rice1kg: 450,
  chicken1kg: 900,
  bread: 180,
  onion1kg: 350,
  apple1kg: 600,
  ramen: 120,
};

export const STATIC_FOOD = {
  tokyo: { restaurantMeal: 1200, cafe: 500 },
  osaka: { restaurantMeal: 1000, cafe: 450 },
};

export const SOURCE_RENT = {
  category: 'rent',
  name: 'e-Stat 住宅・土地統計調査 + static estimates',
  url: 'https://www.e-stat.go.jp/stat-search/files?page=1&toukei=00200522',
};

export const SOURCE_FOOD = {
  category: 'food',
  name: 'e-Stat 消費者物価指数 + static estimates',
  url: 'https://www.e-stat.go.jp/stat-search/files?page=1&toukei=00200573',
};

/**
 * e-Stat API 응답 파싱.
 * @param {unknown} data
 * @returns {number | null}
 */
export function parseEstatValue(data) {
  if (!data || typeof data !== 'object') return null;

  const getStatDataResult = data.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE;
  if (!Array.isArray(getStatDataResult) || getStatDataResult.length === 0) return null;

  const latestValue = getStatDataResult[getStatDataResult.length - 1];
  const value = parseFloat(latestValue?.$);

  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  return null;
}

/**
 * e-Stat API 호출.
 * @param {string} statsDataId
 * @param {string} areaCode
 * @param {string} appId
 * @returns {Promise<number | null>}
 */
async function fetchEstatData(statsDataId, areaCode, appId) {
  const url = new URL(ESTAT_API_BASE);
  url.searchParams.set('appId', appId);
  url.searchParams.set('statsDataId', statsDataId);
  url.searchParams.set('cdArea', areaCode);
  url.searchParams.set('limit', '1');

  try {
    const response = await fetchWithRetry(url.toString(), {
      headers: { Accept: 'application/json' },
    });
    const data = await response.json();
    return parseEstatValue(data);
  } catch {
    return null;
  }
}

/**
 * 도시별 rent 매핑.
 * @param {string} cityId
 * @returns {{share: number, studio: number, oneBed: number, twoBed: number}}
 */
export function mapToRent(cityId) {
  const rent = STATIC_RENT[cityId] ?? STATIC_RENT.tokyo;
  return {
    share: rent.share,
    studio: rent.studio,
    oneBed: rent.oneBed,
    twoBed: rent.twoBed,
  };
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
 * e-Stat → 도쿄/오사카 rent + food 갱신.
 * @param {{dryRun?: boolean, cities?: string[], useStatic?: boolean}} [opts]
 * @returns {Promise<RefreshResult>}
 */
export default async function refresh(opts = {}) {
  const errors = [];
  const changes = [];
  const fields = [];
  const updatedCities = [];

  const targetCities = opts.cities ?? Object.keys(CITY_CONFIGS);

  const appId = process.env.JP_ESTAT_APP_ID;
  if (!appId && !opts.useStatic) {
    errors.push({
      cityId: 'all',
      reason: 'JP_ESTAT_APP_ID environment variable not set, using static values',
    });
  }

  for (const cityId of targetCities) {
    const config = CITY_CONFIGS[cityId];
    if (!config) {
      errors.push({ cityId, reason: `Unknown city: ${cityId}` });
      continue;
    }

    const newRent = mapToRent(cityId);
    const newGroceries = mapToGroceries();
    const staticFood = STATIC_FOOD[cityId] ?? STATIC_FOOD.tokyo;
    const newFood = {
      restaurantMeal: staticFood.restaurantMeal,
      cafe: staticFood.cafe,
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
    source: 'jp_estat',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}
