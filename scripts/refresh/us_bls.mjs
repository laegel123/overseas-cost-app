/**
 * scripts/refresh/us_bls.mjs
 *
 * US BLS (Bureau of Labor Statistics) CPI → 5개 미국 도시 food 갱신.
 *
 * 출처: US BLS Average Retail Food Prices + CPI by Region
 * API: https://api.bls.gov/publicAPI/v2/timeseries/data/
 * API 키: `US_BLS_API_KEY` 필요.
 *
 * 방법: BLS Series ID for food items (milk, eggs, rice, chicken, bread, onion, apple).
 * 지역별 CPI 데이터 사용 (Northeast, West) + 도시 보정계수 (ADR-059).
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage, createMissingApiKeyError } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const BLS_API_BASE = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';

export const CITY_CONFIGS = {
  nyc: {
    id: 'nyc',
    name: { ko: '뉴욕', en: 'New York' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    blsRegion: 'northeast',
    adjustmentFactor: 1.15,
  },
  la: {
    id: 'la',
    name: { ko: '로스앤젤레스', en: 'Los Angeles' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    blsRegion: 'west',
    adjustmentFactor: 1.05,
  },
  sf: {
    id: 'sf',
    name: { ko: '샌프란시스코', en: 'San Francisco' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    blsRegion: 'west',
    adjustmentFactor: 1.25,
  },
  seattle: {
    id: 'seattle',
    name: { ko: '시애틀', en: 'Seattle' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    blsRegion: 'west',
    adjustmentFactor: 1.00,
  },
  boston: {
    id: 'boston',
    name: { ko: '보스턴', en: 'Boston' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    blsRegion: 'northeast',
    adjustmentFactor: 1.10,
  },
};

export const BLS_SERIES = {
  northeast: {
    milk1L: 'APU0100709112',
    eggs12: 'APU0100708111',
    bread: 'APU0100702111',
    chicken1kg: 'APU0100706111',
  },
  west: {
    milk1L: 'APU0400709112',
    eggs12: 'APU0400708111',
    bread: 'APU0400702111',
    chicken1kg: 'APU0400706111',
  },
};

// STATIC fallback 가격 — BLS API 가 부재하거나 sanity range 밖 응답 시 사용.
//
// **`chicken1kg = 10.00 USD/kg` (≈ $4.54/lb) 의 의도** (PR #20 review round 11):
//   BLS APU 시리즈 자체는 whole fryer/broiler (US 평균 $1.5~2.5/lb) 인데 본 static 은 의도적으로
//   부위별 (boneless skinless breast, drumstick 등) 시장가 mix 의 평균에 가까운 값을 사용한다.
//   이유: 한국 사용자의 "치킨 1kg" 멘탈 모델이 통닭 한 마리가 아니라 부위별 구매 가격 평균에 더
//   가깝고, 비교 baseline 인 서울 (`seoul.json` chicken1kg = 12000 KRW ≈ $9/kg) 과 단위 일관성 유지.
//   ADR-059 의 "STATIC fallback 정책" 항목 (식재료 8종 중 일부 항목 static fallback) 에 부합.
//
// 다른 항목 (milk / eggs / bread) 은 BLS 시리즈 단위와 일관 (per ½ gallon / per dozen / per lb).
// rice / onion / apple / ramen 은 BLS 시리즈 부재 → static 전용.
export const STATIC_GROCERIES = {
  milk1L: 1.20,
  eggs12: 4.50,
  rice1kg: 3.50,
  chicken1kg: 10.00,
  bread: 3.50,
  onion1kg: 2.80,
  apple1kg: 4.20,
  ramen: 1.50,
};

// BLS Series APU0100709112 / APU0400709112 = "Milk, fresh, whole, fortified, per ½ gallon (1.89 L)".
// 1L 가격으로 환산하려면 ½ gallon liter 값으로 나눠야 함 — 미환산 시 가격이 약 1.89× 부풀려짐.
const HALF_GALLON_LITERS = 1.8927;

// 정확한 lb→kg 변환 계수 (NIST). 과거 2.2 로 반올림 사용했으나 일관성 위해 상수화 (PR #20
// review round 11). 0.5% 차이라 생활비 비교 정밀도에는 무영향이지만 단위 환산 의도 명시.
const LB_PER_KG = 2.2046;

// BLS API 가 반환하는 원시 값(보정계수 적용 전)의 plausible 범위. 범위 밖이면 시리즈가 의도와
// 다르거나 API 응답 이상으로 간주, STATIC fallback 사용 + region-level errors 기록.
//
// 배경: 과거 chicken1kg 시리즈가 실제 시장가 ($1.5~2.0/lb) 의 5× 가량인 ~$10/lb 를 반환해
// 도시 JSON 에 25.3 USD/kg (= $11.5/lb) 의 비현실적 값이 적재된 사례 (PR #20 review).
// silent fail 금지 정책상 발견 시 errors 에 명시 기록 후 정적 추정치로 대체한다.
//
// **단위 주의** (PR #20 round 7 review):
//  - 본 범위는 BLS API 의 **원시 응답값** (per lb / per dozen / per ½ gallon) 단위.
//  - STATIC_GROCERIES.chicken1kg (10 USD/kg) 와 직접 비교 불가 — STATIC 은 이미 kg 단위 + 도시별
//    adjustmentFactor 가 적용된 값이고, validation 은 raw BLS value 통과 여부만 본다.
//  - 결과적으로 NYC 의 chicken 값은 STATIC fallback 시 11.5 USD/kg, BLS pass 시 최대 12.65 USD/kg
//    까지 가능 (5.0/lb × 2.2 × 1.15) — 두 경로 모두 일관되게 "whole chicken 시장가 ±2배 이내".
export const BLS_VALUE_RANGES = {
  milk1L: { min: 1.0, max: 6.0 }, // USD per ½ gallon (1.89 L)
  eggs12: { min: 1.0, max: 8.0 }, // USD per dozen
  bread: { min: 1.0, max: 6.0 }, // USD per lb
  chicken1kg: { min: 1.0, max: 5.0 }, // USD per lb (whole chicken — boneless cuts >$5/lb 는 reject)
};

// 외식·카페 가격은 BLS APU 시리즈가 아닌 static 사용 (PR #20 review round 22 명시).
// BLS CPI 의 "Food away from home" 카테고리는 도시별 absolute 가격이 아닌 인덱스 (2020=100) 만
// 제공해 cpiToPrice 변환식 적용 시 ca_statcan §5 와 동일한 base period 검증 부담이 큼. v1.0 에서는
// "1인 한 끼 평균" 직관에 가까운 STATIC 추정치 사용 — ADR-059 §1 의 STATIC fallback 정책 부합.
// 도시별 보정은 adjustmentFactor 가 1차 보정 (NYC=1.15 등). v1.x StatCan-style detailed CPI 도입 시 교체.
export const STATIC_FOOD = {
  restaurantMeal: 18.00,
  cafe: 5.50,
};

export const SOURCE = {
  category: 'food',
  name: 'US BLS CPI + static estimates (ADR-059 adjustment)',
  url: 'https://www.bls.gov/cpi/',
};

/**
 * BLS API 응답 파싱. Results.series[].data[].value.
 * @param {unknown} data
 * @param {string[]} seriesIds
 * @returns {Map<string, number>}
 */
export function parseBlsResponse(data, seriesIds) {
  const result = new Map();

  if (!data || typeof data !== 'object') return result;
  if (data.status !== 'REQUEST_SUCCEEDED') return result;

  const series = data.Results?.series;
  if (!Array.isArray(series)) return result;

  for (const s of series) {
    const seriesId = s.seriesID;
    if (!seriesIds.includes(seriesId)) continue;

    const dataPoints = s.data;
    if (!Array.isArray(dataPoints) || dataPoints.length === 0) continue;

    const latestPoint = dataPoints[0];
    const value = parseFloat(latestPoint?.value);
    if (Number.isFinite(value) && value > 0) {
      result.set(seriesId, value);
    }
  }

  return result;
}

/**
 * BLS 시리즈 응답의 sanity range 검증. 범위 밖 값은 invalid 로 분리 — refresh() 가 errors 에
 * 기록 후 STATIC fallback. silent fail 금지 정책 (CLAUDE.md) 준수.
 *
 * @param {Map<string, number>} blsData parseBlsResponse 결과
 * @param {{milk1L: string, eggs12: string, bread: string, chicken1kg: string}} seriesIds
 * @returns {{valid: Map<string, number>, invalid: Array<{field: string, seriesId: string, value: number, range: {min: number, max: number}}>}}
 */
export function validateBlsValues(blsData, seriesIds) {
  const valid = new Map();
  const invalid = [];

  for (const [field, seriesId] of Object.entries(seriesIds)) {
    const value = blsData.get(seriesId);
    if (value === undefined) continue;

    const range = BLS_VALUE_RANGES[field];
    if (range && (value < range.min || value > range.max)) {
      invalid.push({ field, seriesId, value, range });
      continue;
    }

    valid.set(seriesId, value);
  }

  return { valid, invalid };
}

/**
 * BLS 시리즈 데이터 → groceries 매핑 + 도시 보정계수 적용.
 * @param {Map<string, number>} blsData
 * @param {{milk1L: string, eggs12: string, bread: string, chicken1kg: string}} seriesIds
 * @param {number} adjustmentFactor
 * @returns {{milk1L: number, eggs12: number, rice1kg: number, chicken1kg: number, bread: number, onion1kg: number, apple1kg: number, ramen: number}}
 */
export function mapToGroceries(blsData, seriesIds, adjustmentFactor) {
  const applyFactor = (val) => Math.round(val * adjustmentFactor * 100) / 100;

  const milk1L = blsData.get(seriesIds.milk1L);
  const eggs12 = blsData.get(seriesIds.eggs12);
  const bread = blsData.get(seriesIds.bread);
  const chicken1kg = blsData.get(seriesIds.chicken1kg);

  return {
    milk1L: milk1L ? applyFactor(milk1L / HALF_GALLON_LITERS) : applyFactor(STATIC_GROCERIES.milk1L),
    eggs12: eggs12 ? applyFactor(eggs12) : applyFactor(STATIC_GROCERIES.eggs12),
    // BLS APU 시리즈에 white rice 항목이 없어 (BLS 가 rice 를 별도 series 로 추적하지 않음)
    // 항상 static 추정치 사용. onion1kg / apple1kg / ramen 도 동일 사유로 static 전용.
    rice1kg: applyFactor(STATIC_GROCERIES.rice1kg),
    chicken1kg: chicken1kg ? applyFactor(chicken1kg * LB_PER_KG) : applyFactor(STATIC_GROCERIES.chicken1kg),
    // **단위 의도 (PR #20 review round 16)**: BLS APU0x00702111 = "Bread, white, pan, per lb" 의
    // 원시값을 lb→kg 변환 없이 그대로 사용. 미국 슈퍼마켓의 표준 식빵 한 덩어리가 약 1lb (454g) 라
    // "bread" 필드를 "한 덩어리 (loaf) 가격" 으로 해석하면 단위가 일관 — 서울 3500 KRW (약 500g 식빵
    // 한 덩어리 기준) 와도 비교 가능. milk1L (½ gal → L), chicken1kg (lb → kg) 처럼 변환 안 하는
    // 이유는 "1kg 빵" 이 한국·미국 모두 비현실적 단위라서. ADR-059 §4 의 "BLS APU 단위 보존" 항목
    // 참조. v1.x 에서 단위 표기 명시화 (`breadPerLoaf` 필드명 등) 검토.
    bread: bread ? applyFactor(bread) : applyFactor(STATIC_GROCERIES.bread),
    onion1kg: applyFactor(STATIC_GROCERIES.onion1kg),
    apple1kg: applyFactor(STATIC_GROCERIES.apple1kg),
    ramen: applyFactor(STATIC_GROCERIES.ramen),
  };
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * BLS → 5개 미국 도시 food 갱신.
 * @param {{dryRun?: boolean, cities?: string[], useStatic?: boolean}} [opts]
 * @returns {Promise<RefreshResult>}
 */
export default async function refresh(opts = {}) {
  const errors = [];
  const changes = [];
  const fields = [];
  const updatedCities = [];

  const apiKey = process.env.US_BLS_API_KEY;
  if (!apiKey && !opts.useStatic) {
    throw createMissingApiKeyError('US_BLS_API_KEY environment variable is required');
  }

  const targetCities = opts.cities ?? Object.keys(CITY_CONFIGS);

  const regionData = new Map();

  if (!opts.useStatic && apiKey) {
    // 연도 경계 race 회피 — 두 번 호출 시 0:00:00 KST 1월 1일에 startyear > endyear 가능 (PR #20
    // review round 14). 본 변수로 한 번 평가.
    const currentYear = new Date().getUTCFullYear();
    for (const region of ['northeast', 'west']) {
      const seriesIds = Object.values(BLS_SERIES[region]);
      try {
        // **보안 주의**: `registrationkey` 가 POST body 에 포함되므로 본 request body 를 로그에 dump
        // 하면 API 키가 노출된다. `fetchWithRetry::redactSecretsInUrl` 은 URL 만 마스킹 — body 미적용.
        // 디버깅 시 `console.log(JSON.stringify(...))` 추가 금지 (PR #20 review round 14).
        const response = await fetchWithRetry(BLS_API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            seriesid: seriesIds,
            registrationkey: apiKey,
            startyear: currentYear - 1,
            endyear: currentYear,
          }),
        });
        const data = await response.json();
        const parsed = parseBlsResponse(data, seriesIds);
        const { valid, invalid } = validateBlsValues(parsed, BLS_SERIES[region]);
        for (const entry of invalid) {
          errors.push({
            cityId: `region:${region}`,
            reason: `BLS ${entry.seriesId} (${entry.field}) value ${entry.value} out of range [${entry.range.min}, ${entry.range.max}]; using static`,
          });
        }
        regionData.set(region, valid);
      } catch (err) {
        errors.push({
          cityId: `region:${region}`,
          reason: `BLS API fetch failed: ${redactErrorMessage(String(err?.message ?? 'unknown'))}`,
        });
        regionData.set(region, new Map());
      }
    }
  }

  for (const cityId of targetCities) {
    const config = CITY_CONFIGS[cityId];
    if (!config) {
      errors.push({ cityId, reason: `Unknown city: ${cityId}` });
      continue;
    }

    const blsData = regionData.get(config.blsRegion) ?? new Map();
    const seriesIds = BLS_SERIES[config.blsRegion];
    const newGroceries = mapToGroceries(blsData, seriesIds, config.adjustmentFactor);
    const newFood = {
      restaurantMeal: Math.round(STATIC_FOOD.restaurantMeal * config.adjustmentFactor * 100) / 100,
      cafe: Math.round(STATIC_FOOD.cafe * config.adjustmentFactor * 100) / 100,
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

    const oldFood = oldData?.food ?? {};
    const oldGroceries = oldFood.groceries ?? {};
    let hasChanges = false;

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
        food: newFood,
      };

      try {
        await writeCity(cityId, updatedData, SOURCE);
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
    source: 'us_bls',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}
