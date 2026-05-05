/**
 * scripts/refresh/ca_statcan.mjs
 *
 * Statistics Canada CPI by item → vancouver/toronto/montreal food 갱신.
 *
 * 출처: Statistics Canada WDS API (Consumer Price Index by product group)
 * API 키 불필요.
 *
 * 방법: CPI Vector ID 별 fetch → 식재료 8개 + 외식·카페 매핑.
 * Vector ID: StatCan Table 18-10-0004 (Consumer Price Index, monthly)
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage, parseStatCanResponse } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const STATCAN_WDS_BASE = 'https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorsAndLatestNPeriods';
const STATCAN_VECTOR_INFO_BASE = 'https://www150.statcan.gc.ca/t1/wds/rest/getSeriesInfoFromVector';

// StatCan Table 18-10-0004 의 base period — 2002=100 또는 2020=100 만 cpiToPrice 결과 신뢰 가능.
// 다른 base (예: 1992=100) 면 STATIC_PRICES 와 시점 차이가 너무 커 결과가 체계적 편향 → 정적
// fallback 으로 회피. ADR-059 §5 v1.0 출시 전 해소 항목.
export const ALLOWED_REFERENCE_PERIODS = new Set(['2002=100', '2020=100']);

export const CITY_CONFIGS = {
  vancouver: {
    id: 'vancouver',
    name: { ko: '밴쿠버', en: 'Vancouver' },
    country: 'CA',
    currency: 'CAD',
    region: 'na',
  },
  toronto: {
    id: 'toronto',
    name: { ko: '토론토', en: 'Toronto' },
    country: 'CA',
    currency: 'CAD',
    region: 'na',
  },
  montreal: {
    id: 'montreal',
    name: { ko: '몬트리올', en: 'Montreal' },
    country: 'CA',
    currency: 'CAD',
    region: 'na',
  },
};

export const CPI_VECTORS = {
  vancouver: {
    milk1L: 'v41691028',
    eggs12: 'v41691030',
    bread: 'v41691024',
    chicken1kg: 'v41691017',
    rice1kg: 'v41691010',
    restaurantMeal: 'v41691111',
    cafe: 'v41691113',
  },
  toronto: {
    milk1L: 'v41690748',
    eggs12: 'v41690750',
    bread: 'v41690744',
    chicken1kg: 'v41690737',
    rice1kg: 'v41690730',
    restaurantMeal: 'v41690831',
    cafe: 'v41690833',
  },
  montreal: {
    milk1L: 'v41690888',
    eggs12: 'v41690890',
    bread: 'v41690884',
    chicken1kg: 'v41690877',
    rice1kg: 'v41690870',
    restaurantMeal: 'v41690971',
    cafe: 'v41690973',
  },
};

export const STATIC_PRICES = {
  vancouver: {
    milk1L: 3.25,
    eggs12: 4.5,
    rice1kg: 3.8,
    chicken1kg: 15,
    bread: 3.5,
    onion1kg: 2.8,
    apple1kg: 4.5,
    ramen: 1.5,
    restaurantMeal: 22,
    cafe: 6,
  },
  toronto: {
    milk1L: 3.2,
    eggs12: 4.4,
    rice1kg: 3.6,
    chicken1kg: 14.5,
    bread: 3.4,
    onion1kg: 2.6,
    apple1kg: 4.3,
    ramen: 1.4,
    restaurantMeal: 21,
    cafe: 5.8,
  },
  montreal: {
    milk1L: 3.1,
    eggs12: 4.2,
    rice1kg: 3.5,
    chicken1kg: 14,
    bread: 3.3,
    onion1kg: 2.5,
    apple1kg: 4,
    ramen: 1.3,
    restaurantMeal: 19,
    cafe: 5.5,
  },
};

export const SOURCE = {
  category: 'food',
  name: 'Statistics Canada CPI',
  url: 'https://www150.statcan.gc.ca/',
};

// onion1kg / apple1kg / ramen — StatCan CPI 미제공 항목. ADR-059 §4 static 마커.
// CPI fetch 전체 실패로 useStatic fallback 진입 시도 동일 출처 사용 (구분: name 의 'static' 키워드).
export const SOURCE_STATIC = {
  category: 'food',
  name: 'Statistics Canada CPI (static fallback, ADR-059)',
  url: 'https://www150.statcan.gc.ca/',
};


/**
 * CPI 지수 → 실제 가격 (CAD dollars) 변환.
 * CPI 는 base period = 100. 정적 기준가 (CAD dollars) 에 CPI 비율 적용.
 * 소수점 2자리 보존 (ADR-059 단위 정책 — cents 변환 금지).
 *
 * basePrice 의 기준년도 == CPI base period 일치 가정. 본 모듈 진입부에서
 * `fetchSeriesReferencePeriod` 가 ALLOWED_REFERENCE_PERIODS 검증 → 외 값이면 정적 fallback 으로
 * 우회 (ADR-059 §5 해소). 추가로 `isCpiBasePeriodSuspect` 값 기반 heuristic 이 2차 방어.
 *
 * @param {number} cpiValue
 * @param {number} basePrice CAD dollars 단위 (기준년도 평균가)
 * @returns {number} CAD dollars 단위, 소수점 2자리
 */
export function cpiToPrice(cpiValue, basePrice) {
  return Math.round((cpiValue / 100) * basePrice * 100) / 100;
}

// CPI sanity 임계값 — 2020 = 100 기준이면 현재 CPI 가 약 105~125 범위. 145 이상은 거의 확실히
// 2002 = 100 기준 dataset 일 가능성이 높아 STATIC_PRICES (2024~2026 시장가 기준) 와 base period
// 불일치를 의미한다. 운영자가 ADR-059 §5 검증 누락한 채로 cron 갱신
// 진입 시 잘못된 데이터가 적재되는 것을 표면화.
export const CPI_SANITY_MAX = 145;

/**
 * StatCan CPI 응답 sanity check — 2020=100 기준 가정 위반 여부 검출.
 * @param {number} cpiValue
 * @returns {boolean} true 이면 의심스러운 (base period mismatch 가능) 값
 */
export function isCpiBasePeriodSuspect(cpiValue) {
  return Number.isFinite(cpiValue) && cpiValue >= CPI_SANITY_MAX;
}

/**
 * getSeriesInfoFromVector 응답 파싱 — referencePeriod 추출.
 * 응답 shape: `[{status:'SUCCESS', object:{vectorId, referencePeriod, ...}}]`.
 * @param {unknown} data
 * @returns {string|null}
 */
export function parseSeriesInfoResponse(data) {
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0];
  if (!first || typeof first !== 'object') return null;
  const status = first.status;
  const object = first.object;
  if (status !== 'SUCCESS' || !object || typeof object !== 'object') return null;
  const ref = object.referencePeriod;
  return typeof ref === 'string' && ref.length > 0 ? ref : null;
}

/**
 * StatCan WDS getSeriesInfoFromVector 호출 — vectorId 의 referencePeriod 조회.
 * cpiToPrice 가 STATIC_PRICES 와 호환되는 base 인지 갱신 시작 시 인증 (ADR-059 §5).
 * @param {number} vectorId
 * @returns {Promise<string|null>} referencePeriod (예: '2002=100') 또는 null (조회 실패)
 */
export async function fetchSeriesReferencePeriod(vectorId) {
  const url = `${STATCAN_VECTOR_INFO_BASE}/${vectorId}`;
  const response = await fetchWithRetry(url, { timeoutMs: 10000 });
  const data = await response.json();
  return parseSeriesInfoResponse(data);
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * Statistics Canada CPI → 3개 캐나다 도시 food 갱신.
 * @param {{dryRun?: boolean, cities?: string[], useStatic?: boolean}} [opts]
 * @returns {Promise<RefreshResult>}
 */
export default async function refresh(opts = {}) {
  const errors = [];
  const changes = [];
  const fields = [];
  const updatedCities = [];

  const targetCities = opts.cities ?? Object.keys(CITY_CONFIGS);

  if (opts.useStatic) {
    for (const cityId of targetCities) {
      const config = CITY_CONFIGS[cityId];
      const staticPrices = STATIC_PRICES[cityId];
      if (!config || !staticPrices) continue;

      const newFood = {
        restaurantMeal: staticPrices.restaurantMeal,
        cafe: staticPrices.cafe,
        groceries: {
          milk1L: staticPrices.milk1L,
          eggs12: staticPrices.eggs12,
          rice1kg: staticPrices.rice1kg,
          chicken1kg: staticPrices.chicken1kg,
          bread: staticPrices.bread,
          onion1kg: staticPrices.onion1kg,
          apple1kg: staticPrices.apple1kg,
          ramen: staticPrices.ramen,
        },
      };

      let oldData;
      try {
        oldData = await readCity(cityId);
      } catch (err) {
        if (err?.code !== 'CITY_NOT_FOUND') {
          errors.push({ cityId, reason: `Failed to read existing data: ${redactErrorMessage(String(err?.message ?? ""))}` });
        }
      }

      const oldFood = oldData?.food ?? {};
      const oldGroceries = oldFood.groceries ?? {};
      let hasChanges = false;

      for (const [field, newVal] of Object.entries(newFood.groceries)) {
        const oldVal = oldGroceries[field] ?? null;
        if (oldVal !== newVal) {
          fields.push(field);
          const pctChange = computePctChange(oldVal, newVal);
          changes.push({ cityId, field: `food.groceries.${field}`, oldValue: oldVal, newValue: newVal, pctChange });
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

      if (!opts.dryRun && hasChanges) {
        const base = oldData ?? createCitySeed(config);
        const updatedData = { ...base, food: newFood };

        try {
          // useStatic path — 모든 값이 STATIC_PRICES 에서 옴. SOURCE_STATIC 으로 식별 가능하게.
          await writeCity(cityId, updatedData, SOURCE_STATIC);
          updatedCities.push(cityId);
        } catch (err) {
          errors.push({ cityId, reason: `Write failed: ${redactErrorMessage(String(err?.message ?? "unknown"))}` });
        }
      } else if (hasChanges) {
        updatedCities.push(cityId);
      }
    }

    return { source: 'ca_statcan', cities: updatedCities, fields: [...new Set(fields)], changes, errors };
  }

  const allVectors = [];
  for (const cityId of targetCities) {
    const vectors = CPI_VECTORS[cityId];
    if (vectors) {
      allVectors.push(...Object.values(vectors));
    }
  }

  const uniqueVectors = [...new Set(allVectors)];
  const vectorIds = uniqueVectors.map((v) => parseInt(v.slice(1), 10));

  // ADR-059 §5 해소 — 갱신 시작 시 referencePeriod 인증. ALLOWED_REFERENCE_PERIODS 외 값이면
  // STATIC_PRICES 와 base period 불일치로 cpiToPrice 결과가 체계적 편향 → errors[] push 후
  // 정적 fallback 으로 회피. 첫 vector 1개만 조회 (table 18-10-0004 안의 모든 vector 가 동일 base).
  if (vectorIds.length > 0) {
    try {
      const refPeriod = await fetchSeriesReferencePeriod(vectorIds[0]);
      if (refPeriod === null) {
        const reason = `getSeriesInfoFromVector(${vectorIds[0]}) 응답에서 referencePeriod 추출 실패 — base period 인증 불가, 정적 fallback 적용 (ADR-059 §5).`;
        console.warn(`::warning::${reason}`);
        errors.push({ cityId: 'all', reason });
        const fallbackResult = await refresh({ ...opts, useStatic: true });
        return { ...fallbackResult, errors: [...errors, ...fallbackResult.errors] };
      }
      if (!ALLOWED_REFERENCE_PERIODS.has(refPeriod)) {
        const reason = `StatCan vector ${vectorIds[0]} referencePeriod='${refPeriod}' 가 허용 base [${[...ALLOWED_REFERENCE_PERIODS].join(', ')}] 외 — STATIC_PRICES 와 시점 차이로 cpiToPrice 결과 편향 위험. 정적 fallback 적용 (ADR-059 §5).`;
        console.warn(`::warning::${reason}`);
        errors.push({ cityId: 'all', reason });
        const fallbackResult = await refresh({ ...opts, useStatic: true });
        return { ...fallbackResult, errors: [...errors, ...fallbackResult.errors] };
      }
    } catch (err) {
      // referencePeriod 조회 자체 실패는 비치명 — 기존 isCpiBasePeriodSuspect 가 2차 방어선.
      // 단 errors[] 에 기록해 운영자가 누적 모니터링 가능하게 한다.
      errors.push({
        cityId: 'all',
        reason: `referencePeriod 조회 실패 (계속 진행, isCpiBasePeriodSuspect 가 2차 방어): ${redactErrorMessage(String(err?.message ?? 'unknown'))}`,
      });
    }
  }

  let vectorData;
  try {
    const requestBody = JSON.stringify(vectorIds.map((id) => ({ vectorId: id, latestN: 1 })));
    // fetchWithRetry — timeout / 재시도 / URL 마스킹 일관 (다른 refresh 스크립트와 동일).
    const response = await fetchWithRetry(STATCAN_WDS_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
      timeoutMs: 15000,
    });

    const data = await response.json();
    vectorData = parseStatCanResponse(data);

    // CPI base period mismatch 감지 — 2020=100 기준 가정 위반 시 ADR-059 §5 항목 표면화.
    // 검증 미해소 상태로 cron 갱신 진입하면 결과가 ~45% 부풀려진다.
    for (const [vector, cpiValue] of vectorData.entries()) {
      if (isCpiBasePeriodSuspect(cpiValue)) {
        const reason = `CPI vector ${vector} value ${cpiValue} >= ${CPI_SANITY_MAX} — StatCan base period 가 2020=100 이 아닐 가능성 (ADR-059 §5 미해소). STATIC_PRICES 적용 결과가 ~45% 부풀려질 수 있음. getSeriesInfoFromVector 로 referencePeriod 검증 필요.`;
        console.warn(`::warning::${reason}`);
        errors.push({ cityId: 'all', reason });
        break; // 한 vector 만 의심돼도 동일 원인 — 중복 errors 회피.
      }
    }
  } catch (err) {
    const apiErrors = [];
    for (const cityId of targetCities) {
      const staticPrices = STATIC_PRICES[cityId];
      if (staticPrices) {
        apiErrors.push({ cityId, reason: `StatCan API failed, using static fallback: ${redactErrorMessage(String(err?.message ?? ""))}` });
      } else {
        apiErrors.push({ cityId, reason: `StatCan API fetch failed: ${redactErrorMessage(String(err?.message ?? "unknown"))}` });
      }
    }

    const fallbackResult = await refresh({ ...opts, useStatic: true });
    return {
      ...fallbackResult,
      errors: [...apiErrors, ...fallbackResult.errors],
    };
  }

  for (const cityId of targetCities) {
    const config = CITY_CONFIGS[cityId];
    const vectors = CPI_VECTORS[cityId];
    const staticPrices = STATIC_PRICES[cityId];

    if (!config || !vectors || !staticPrices) {
      errors.push({ cityId, reason: `Unknown city or missing config: ${cityId}` });
      continue;
    }

    // ?? 100 — vector 응답 부재 시 CPI 기준년도 (= 100) 로 fallback.
    // cpiToPrice(100, base) === base 이므로 staticPrice 가 그대로 사용됨.
    // 주의: 0 으로 변경 금지 (cpiToPrice(0, base) === 0 으로 모든 가격이 0 이 됨).
    // restaurantMeal / cafe / groceries 5종 — CPI 보정. onion / apple / ramen — CPI 부재로 static.
    const newFood = {
      restaurantMeal: cpiToPrice(vectorData.get(vectors.restaurantMeal) ?? 100, staticPrices.restaurantMeal),
      cafe: cpiToPrice(vectorData.get(vectors.cafe) ?? 100, staticPrices.cafe),
      groceries: {
        milk1L: cpiToPrice(vectorData.get(vectors.milk1L) ?? 100, staticPrices.milk1L),
        eggs12: cpiToPrice(vectorData.get(vectors.eggs12) ?? 100, staticPrices.eggs12),
        rice1kg: cpiToPrice(vectorData.get(vectors.rice1kg) ?? 100, staticPrices.rice1kg),
        chicken1kg: cpiToPrice(vectorData.get(vectors.chicken1kg) ?? 100, staticPrices.chicken1kg),
        bread: cpiToPrice(vectorData.get(vectors.bread) ?? 100, staticPrices.bread),
        onion1kg: staticPrices.onion1kg,
        apple1kg: staticPrices.apple1kg,
        ramen: staticPrices.ramen,
      },
    };

    let oldData;
    try {
      oldData = await readCity(cityId);
    } catch (err) {
      if (err?.code !== 'CITY_NOT_FOUND') {
        errors.push({ cityId, reason: `Failed to read existing data: ${redactErrorMessage(String(err?.message ?? ""))}` });
      }
    }

    const oldFood = oldData?.food ?? {};
    const oldGroceries = oldFood.groceries ?? {};
    let hasChanges = false;

    for (const [field, newVal] of Object.entries(newFood.groceries)) {
      const oldVal = oldGroceries[field] ?? null;

      if (oldVal !== newVal) {
        fields.push(field);
        const pctChange = computePctChange(oldVal, newVal);
        changes.push({ cityId, field: `food.groceries.${field}`, oldValue: oldVal, newValue: newVal, pctChange });
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

    if (!opts.dryRun && hasChanges) {
      const base = oldData ?? createCitySeed(config);
      const updatedData = { ...base, food: newFood };

      try {
        await writeCity(cityId, updatedData, SOURCE);
        updatedCities.push(cityId);
      } catch (err) {
        errors.push({ cityId, reason: `Write failed: ${redactErrorMessage(String(err?.message ?? "unknown"))}` });
      }
    } else if (hasChanges) {
      updatedCities.push(cityId);
    }
  }

  return {
    source: 'ca_statcan',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}

