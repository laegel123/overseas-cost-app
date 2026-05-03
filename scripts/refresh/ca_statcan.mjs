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


/**
 * CPI 지수 → 실제 가격 (CAD dollars) 변환.
 * CPI 는 base period = 100. 정적 기준가 (CAD dollars) 에 CPI 비율 적용.
 * 소수점 2자리 보존 (ADR-059 단위 정책 — cents 변환 금지).
 *
 * ⚠️ basePrice 의 기준년도 == CPI base period 일치 가정. ADR-059 §4 검증 미해소 (round 11):
 * StatCan Table 18-10-0004 의 base period (2002 vs 2020) 가 STATIC_PRICES 시점과 다르면
 * 결과가 체계적으로 편향. step 4 재개 시 getSeriesInfoFromVector 로 검증 + STATIC_PRICES 갱신.
 *
 * @param {number} cpiValue
 * @param {number} basePrice CAD dollars 단위 (기준년도 평균가)
 * @returns {number} CAD dollars 단위, 소수점 2자리
 */
export function cpiToPrice(cpiValue, basePrice) {
  return Math.round((cpiValue / 100) * basePrice * 100) / 100;
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
          await writeCity(cityId, updatedData, SOURCE);
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
    const newFood = {
      restaurantMeal: staticPrices.restaurantMeal,
      cafe: staticPrices.cafe,
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

    const restaurantCpi = vectorData.get(vectors.restaurantMeal);
    const cafeCpi = vectorData.get(vectors.cafe);
    if (restaurantCpi) {
      newFood.restaurantMeal = cpiToPrice(restaurantCpi, staticPrices.restaurantMeal);
    }
    if (cafeCpi) {
      newFood.cafe = cpiToPrice(cafeCpi, staticPrices.cafe);
    }

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

