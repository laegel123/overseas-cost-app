/**
 * scripts/refresh/jp_estat.mjs
 *
 * e-Stat (政府統計) → 도쿄/오사카 rent + food 갱신.
 *
 * 출처: e-Stat 住宅・土地統計調査 + 消費者物価指数
 * API: https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData
 * 키: JP_ESTAT_APP_ID 환경변수 필요 (부재 시 us_bls 와 동일하게 throw — 워크플로우 conditional skip 대상)
 *
 * **v1.0 한계**: `fetchEstatData` 호출은 wire up 됐으나 응답 값을 STATIC 보정 multiplier 로 적용하지 않음.
 * e-Stat 응답의 단위/스케일 (전국 평균 vs 도/현 평균, 천엔/엔 단위 등) 검증이 v1.x 별도 phase 필요.
 * 현재는 응답이 null 이면 errors 기록, value 이면 info 로그 — 항상 STATIC 그대로 도시 JSON 에 기록.
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
 * e-Stat API 호출. v1.0 에서는 응답 reachability + 단일 numeric 추출까지만 사용 (응답 검증은 v1.x).
 * @param {string} statsDataId
 * @param {string} areaCode
 * @param {string} appId
 * @returns {Promise<number | null>}
 */
export async function fetchEstatData(statsDataId, areaCode, appId) {
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
  } catch (err) {
    // CLAUDE.md "silent fail 금지" — 예외 원인 (timeout / 5xx / JSON 파싱 실패) 을 log 로 보존.
    // 호출자(refresh)는 null 을 받아 errors 에 cityId 단위로 기록하므로 여기서 throw 하지 않고
    // graceful degradation 유지. URL 의 appId 는 redactErrorMessage 로 마스킹.
    console.warn(
      `[jp_estat] fetchEstatData ${statsDataId}/${areaCode} failed: ${redactErrorMessage(String(err?.message ?? 'unknown'))}`,
    );
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
    // us_bls 와 동일 패턴 — 워크플로우 conditional skip 의 의도와 일치 (key 없으면 fail-fast).
    throw createMissingApiKeyError('JP_ESTAT_APP_ID environment variable is required');
  }

  for (const cityId of targetCities) {
    const config = CITY_CONFIGS[cityId];
    if (!config) {
      errors.push({ cityId, reason: `Unknown city: ${cityId}` });
      continue;
    }

    if (appId && !opts.useStatic) {
      // v1.0: e-Stat 응답을 sample 로만 수집 (응답 스케일 검증은 v1.x). 도시 JSON 에 반영 안 됨.
      const rentVal = await fetchEstatData(ESTAT_STATS_ID.rent, config.estatArea, appId);
      if (rentVal === null) {
        errors.push({ cityId, reason: `e-Stat rent API returned no data for area ${config.estatArea}; using static` });
      } else {
        console.info(`[jp_estat] ${cityId}: e-Stat rent sample=${rentVal} (not wired to STATIC in v1.0)`);
      }
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
