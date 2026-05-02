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

import { fetchWithRetry, readCity, writeCity } from './_common.mjs';

const STATCAN_WDS_BASE = 'https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorsAndLatestNPeriods';

export const CITY_CONFIGS = {
  vancouver: {
    id: 'vancouver',
    name: { ko: '밴쿠버', en: 'Vancouver' },
    country: 'CA',
    currency: 'CAD',
    region: 'north-america',
  },
  toronto: {
    id: 'toronto',
    name: { ko: '토론토', en: 'Toronto' },
    country: 'CA',
    currency: 'CAD',
    region: 'north-america',
  },
  montreal: {
    id: 'montreal',
    name: { ko: '몬트리올', en: 'Montreal' },
    country: 'CA',
    currency: 'CAD',
    region: 'north-america',
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
    milk1L: 325,
    eggs12: 450,
    rice1kg: 380,
    chicken1kg: 1500,
    bread: 350,
    onion1kg: 280,
    apple1kg: 450,
    ramen: 150,
    restaurantMeal: 2200,
    cafe: 600,
  },
  toronto: {
    milk1L: 320,
    eggs12: 440,
    rice1kg: 360,
    chicken1kg: 1450,
    bread: 340,
    onion1kg: 260,
    apple1kg: 430,
    ramen: 140,
    restaurantMeal: 2100,
    cafe: 580,
  },
  montreal: {
    milk1L: 310,
    eggs12: 420,
    rice1kg: 350,
    chicken1kg: 1400,
    bread: 330,
    onion1kg: 250,
    apple1kg: 400,
    ramen: 130,
    restaurantMeal: 1900,
    cafe: 550,
  },
};

export const SOURCE = {
  category: 'food',
  name: 'Statistics Canada CPI',
  url: 'https://www150.statcan.gc.ca/',
};

/**
 * StatCan WDS API 응답 파싱.
 * @param {unknown} data
 * @returns {Map<string, number>}
 */
export function parseStatCanResponse(data) {
  const result = new Map();

  if (!Array.isArray(data)) return result;

  for (const item of data) {
    const vectorId = item?.object?.vectorId?.toString();
    const dataPoints = item?.object?.vectorDataPoint;

    if (!vectorId || !Array.isArray(dataPoints)) continue;

    const latestPoint = dataPoints[dataPoints.length - 1];
    const value = parseFloat(latestPoint?.value);

    if (Number.isFinite(value) && value > 0) {
      result.set(`v${vectorId}`, value);
    }
  }

  return result;
}

/**
 * CPI 지수 → 실제 가격 (CAD cents) 변환.
 * CPI 는 base period = 100. 정적 기준가에 CPI 비율 적용.
 * @param {number} cpiValue
 * @param {number} basePrice
 * @returns {number}
 */
export function cpiToPrice(cpiValue, basePrice) {
  return Math.round((cpiValue / 100) * basePrice);
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
          errors.push({ cityId, reason: `Failed to read existing data: ${err?.message}` });
        }
      }

      const oldFood = oldData?.food ?? {};
      const oldGroceries = oldFood.groceries ?? {};
      let hasChanges = false;

      for (const [field, newVal] of Object.entries(newFood.groceries)) {
        const oldVal = oldGroceries[field] ?? null;
        if (oldVal !== newVal) {
          fields.push(field);
          const pctChange = oldVal !== null && oldVal !== 0 ? (newVal - oldVal) / oldVal : oldVal === null ? 1 : 0;
          changes.push({ cityId, field: `food.groceries.${field}`, oldValue: oldVal, newValue: newVal, pctChange });
          hasChanges = true;
        }
      }

      for (const field of ['restaurantMeal', 'cafe']) {
        const oldVal = oldFood[field] ?? null;
        const newVal = newFood[field];
        if (oldVal !== newVal) {
          fields.push(field);
          const pctChange = oldVal !== null && oldVal !== 0 ? (newVal - oldVal) / oldVal : oldVal === null ? 1 : 0;
          changes.push({ cityId, field: `food.${field}`, oldValue: oldVal, newValue: newVal, pctChange });
          hasChanges = true;
        }
      }

      if (!opts.dryRun && hasChanges) {
        const updatedData = oldData ?? createCitySeed(config);
        updatedData.food = newFood;

        try {
          await writeCity(cityId, updatedData, SOURCE);
          updatedCities.push(cityId);
        } catch (err) {
          errors.push({ cityId, reason: `Write failed: ${err?.message ?? 'unknown'}` });
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
    const response = await fetch(STATCAN_WDS_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
    });

    if (!response.ok) {
      throw new Error(`StatCan API error: ${response.status}`);
    }

    const data = await response.json();
    vectorData = parseStatCanResponse(data);
  } catch (err) {
    const apiErrors = [];
    for (const cityId of targetCities) {
      const staticPrices = STATIC_PRICES[cityId];
      if (staticPrices) {
        apiErrors.push({ cityId, reason: `StatCan API failed, using static fallback: ${err?.message}` });
      } else {
        apiErrors.push({ cityId, reason: `StatCan API fetch failed: ${err?.message ?? 'unknown'}` });
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
        errors.push({ cityId, reason: `Failed to read existing data: ${err?.message}` });
      }
    }

    const oldFood = oldData?.food ?? {};
    const oldGroceries = oldFood.groceries ?? {};
    let hasChanges = false;

    for (const [field, newVal] of Object.entries(newFood.groceries)) {
      const oldVal = oldGroceries[field] ?? null;

      if (oldVal !== newVal) {
        fields.push(field);
        const pctChange = oldVal !== null && oldVal !== 0 ? (newVal - oldVal) / oldVal : oldVal === null ? 1 : 0;
        changes.push({ cityId, field: `food.groceries.${field}`, oldValue: oldVal, newValue: newVal, pctChange });
        hasChanges = true;
      }
    }

    for (const field of ['restaurantMeal', 'cafe']) {
      const oldVal = oldFood[field] ?? null;
      const newVal = newFood[field];

      if (oldVal !== newVal) {
        fields.push(field);
        const pctChange = oldVal !== null && oldVal !== 0 ? (newVal - oldVal) / oldVal : oldVal === null ? 1 : 0;
        changes.push({ cityId, field: `food.${field}`, oldValue: oldVal, newValue: newVal, pctChange });
        hasChanges = true;
      }
    }

    if (!opts.dryRun && hasChanges) {
      const updatedData = oldData ?? createCitySeed(config);
      updatedData.food = newFood;

      try {
        await writeCity(cityId, updatedData, SOURCE);
        updatedCities.push(cityId);
      } catch (err) {
        errors.push({ cityId, reason: `Write failed: ${err?.message ?? 'unknown'}` });
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

/**
 * 도시 seed 데이터 생성 (초기화용).
 * @param {typeof CITY_CONFIGS.vancouver} config
 * @returns {import('../../src/types/city').CityCostData}
 */
function createCitySeed(config) {
  return {
    id: config.id,
    name: config.name,
    country: config.country,
    currency: config.currency,
    region: config.region,
    lastUpdated: '',
    rent: { share: null, studio: null, oneBed: null, twoBed: null },
    food: {
      restaurantMeal: 0,
      cafe: 0,
      groceries: {
        milk1L: 0,
        eggs12: 0,
        rice1kg: 0,
        chicken1kg: 0,
        bread: 0,
      },
    },
    transport: { monthlyPass: 0, singleRide: 0, taxiBase: 0 },
    sources: [],
  };
}
