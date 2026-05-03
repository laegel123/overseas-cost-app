/**
 * scripts/refresh/us_bls.mjs
 *
 * US BLS CPI (Consumer Price Index) → 5개 미국 도시 food 갱신.
 *
 * 출처: Bureau of Labor Statistics Average Price Data
 * API: https://api.bls.gov/publicAPI/v2/timeseries/data/
 * API 키: US_BLS_API_KEY 필요.
 *
 * 방법: BLS Region (Northeast / West) 별 평균 소비자 가격 → 도시 food 매핑.
 * - Series APU0000710211: Milk (gallon) → milk1L (÷3.785)
 * - Series APU0000708111: Eggs (dozen) → eggs12
 * - Series APU0000715211: Bread (loaf) → bread
 * - Series APU0000706111: Chicken breast (lb) → chicken1kg (×2.205)
 * - Series APU0000702212: Rice (lb) → rice1kg (×2.205)
 */

import { readCity, writeCity, fetchWithRetry, createMissingApiKeyError, createCitySeed} from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const BLS_API_BASE = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';

export const BLS_REGIONS = {
  northeast: '0100',
  midwest: '0200',
  south: '0300',
  west: '0400',
  national: '0000',
};

export const CITY_TO_REGION = {
  nyc: 'northeast',
  boston: 'northeast',
  la: 'west',
  sf: 'west',
  seattle: 'west',
};

export const CITY_CONFIGS = {
  nyc: {
    id: 'nyc',
    name: { ko: '뉴욕', en: 'New York' },
    country: 'US',
    currency: 'USD',
    region: 'na',
  },
  la: {
    id: 'la',
    name: { ko: 'LA', en: 'Los Angeles' },
    country: 'US',
    currency: 'USD',
    region: 'na',
  },
  sf: {
    id: 'sf',
    name: { ko: '샌프란시스코', en: 'San Francisco' },
    country: 'US',
    currency: 'USD',
    region: 'na',
  },
  seattle: {
    id: 'seattle',
    name: { ko: '시애틀', en: 'Seattle' },
    country: 'US',
    currency: 'USD',
    region: 'na',
  },
  boston: {
    id: 'boston',
    name: { ko: '보스턴', en: 'Boston' },
    country: 'US',
    currency: 'USD',
    region: 'na',
  },
};

export const BLS_SERIES = {
  milk: { prefix: 'APU', suffix: '710211', unit: 'gallon', convert: (v) => Math.round((v / 3.785) * 100) },
  eggs12: { prefix: 'APU', suffix: '708111', unit: 'dozen', convert: (v) => Math.round(v * 100) },
  bread: { prefix: 'APU', suffix: '702111', unit: 'loaf', convert: (v) => Math.round(v * 100) },
  chicken: { prefix: 'APU', suffix: '706111', unit: 'lb', convert: (v) => Math.round(v * 2.205 * 100) },
  rice: { prefix: 'APU', suffix: '701312', unit: 'lb', convert: (v) => Math.round(v * 2.205 * 100) },
};

export const SOURCE = {
  category: 'food',
  name: 'US BLS Average Prices',
  url: 'https://www.bls.gov/data/',
};

export const STATIC_PRICES = {
  nyc: {
    milk1L: 1.45,
    eggs12: 4.25,
    rice1kg: 3.8,
    chicken1kg: 12.5,
    bread: 4.25,
    onion1kg: 2.8,
    apple1kg: 5.2,
    ramen: 1.2,
    restaurantMeal: 25,
    cafe: 6.5,
  },
  la: {
    milk1L: 1.4,
    eggs12: 4,
    rice1kg: 3.5,
    chicken1kg: 12,
    bread: 4,
    onion1kg: 2.6,
    apple1kg: 4.8,
    ramen: 1.1,
    restaurantMeal: 22,
    cafe: 6,
  },
  sf: {
    milk1L: 1.55,
    eggs12: 4.5,
    rice1kg: 3.9,
    chicken1kg: 13.5,
    bread: 4.5,
    onion1kg: 2.9,
    apple1kg: 5.5,
    ramen: 1.3,
    restaurantMeal: 28,
    cafe: 7,
  },
  seattle: {
    milk1L: 1.35,
    eggs12: 3.8,
    rice1kg: 3.4,
    chicken1kg: 11.5,
    bread: 3.8,
    onion1kg: 2.5,
    apple1kg: 4.6,
    ramen: 1,
    restaurantMeal: 21,
    cafe: 5.8,
  },
  boston: {
    milk1L: 1.4,
    eggs12: 4.1,
    rice1kg: 3.7,
    chicken1kg: 12.2,
    bread: 4.1,
    onion1kg: 2.7,
    apple1kg: 5,
    ramen: 1.15,
    restaurantMeal: 24,
    cafe: 6.3,
  },
};

export const CITY_ADJUSTMENT = {
  nyc: 1.15,
  la: 1.05,
  sf: 1.25,
  seattle: 1.0,
  boston: 1.10,
};

/**
 * BLS API 응답 파싱. 최신 값 추출.
 * @param {unknown} data
 * @returns {Map<string, number>}
 */
export function parseBlsResponse(data) {
  const result = new Map();

  if (typeof data !== 'object' || data === null) return result;
  if (data.status !== 'REQUEST_SUCCEEDED') return result;

  const series = data.Results?.series;
  if (!Array.isArray(series)) return result;

  for (const s of series) {
    const seriesId = s.seriesID;
    const dataPoints = s.data;

    if (typeof seriesId !== 'string' || !Array.isArray(dataPoints)) continue;

    const latestPoint = dataPoints[0];
    const value = parseFloat(latestPoint?.value);

    if (Number.isFinite(value) && value > 0) {
      result.set(seriesId, value);
    }
  }

  return result;
}

/**
 * BLS 데이터를 groceries 필드로 매핑.
 * @param {Map<string, number>} blsData
 * @param {string} regionCode
 * @param {number} adjustment
 * @returns {{milk1L: number, eggs12: number, rice1kg: number, chicken1kg: number, bread: number}}
 */
export function mapToGroceries(blsData, regionCode, adjustment) {
  const groceries = {
    milk1L: 0,
    eggs12: 0,
    rice1kg: 0,
    chicken1kg: 0,
    bread: 0,
  };

  for (const [key, config] of Object.entries(BLS_SERIES)) {
    const seriesId = `${config.prefix}${regionCode}${config.suffix}`;
    const nationalSeriesId = `${config.prefix}${BLS_REGIONS.national}${config.suffix}`;

    let value = blsData.get(seriesId);
    if (value === undefined) {
      value = blsData.get(nationalSeriesId);
    }

    if (value !== undefined) {
      const converted = config.convert(value);
      const adjusted = Math.round(converted * adjustment);

      switch (key) {
        case 'milk':
          groceries.milk1L = adjusted;
          break;
        case 'eggs12':
          groceries.eggs12 = adjusted;
          break;
        case 'bread':
          groceries.bread = adjusted;
          break;
        case 'chicken':
          groceries.chicken1kg = adjusted;
          break;
        case 'rice':
          groceries.rice1kg = adjusted;
          break;
      }
    }
  }

  return groceries;
}

/**
 * 지역별 BLS series ID 목록 생성.
 * @param {string} regionCode
 * @returns {string[]}
 */
export function getSeriesIds(regionCode) {
  const ids = [];
  for (const config of Object.values(BLS_SERIES)) {
    ids.push(`${config.prefix}${regionCode}${config.suffix}`);
  }
  ids.push(...Object.values(BLS_SERIES).map((c) => `${c.prefix}${BLS_REGIONS.national}${c.suffix}`));
  return [...new Set(ids)];
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * BLS CPI → 5개 미국 도시 food 갱신.
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

  const regionToSeriesMap = new Map();
  for (const cityId of targetCities) {
    const region = CITY_TO_REGION[cityId];
    if (!region) continue;
    const regionCode = BLS_REGIONS[region];
    if (!regionToSeriesMap.has(regionCode)) {
      regionToSeriesMap.set(regionCode, getSeriesIds(regionCode));
    }
  }

  const allSeriesIds = [...new Set([...regionToSeriesMap.values()].flat())];

  let blsData = new Map();

  if (!opts.useStatic && apiKey) {
    try {
      const response = await fetchWithRetry(BLS_API_BASE, {
        timeoutMs: 20000,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesid: allSeriesIds,
          registrationkey: apiKey,
          latest: true,
        }),
      });

      const data = await response.json();
      blsData = parseBlsResponse(data);

      if (blsData.size === 0) {
        for (const cityId of targetCities) {
          errors.push({ cityId, reason: 'BLS API returned no data, using static fallback' });
        }
      }
    } catch (err) {
      for (const cityId of targetCities) {
        errors.push({ cityId, reason: `BLS API fetch failed, using static fallback: ${err?.message}` });
      }
    }
  }

  for (const cityId of targetCities) {
    const config = CITY_CONFIGS[cityId];
    if (!config) {
      errors.push({ cityId, reason: `Unknown city: ${cityId}` });
      continue;
    }

    const region = CITY_TO_REGION[cityId];
    const regionCode = BLS_REGIONS[region];
    const adjustment = CITY_ADJUSTMENT[cityId] ?? 1.0;
    const staticPrices = STATIC_PRICES[cityId];

    let newFood;

    if (opts.useStatic || blsData.size === 0) {
      if (!staticPrices) {
        errors.push({ cityId, reason: 'No static prices available' });
        continue;
      }
      newFood = {
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
    } else {
      const blsGroceries = mapToGroceries(blsData, regionCode, adjustment);

      const hasBlsData = Object.values(blsGroceries).some((v) => v > 0);
      if (!hasBlsData && staticPrices) {
        errors.push({ cityId, reason: 'BLS data incomplete, using static fallback for groceries' });
        newFood = {
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
      } else {
        newFood = {
          restaurantMeal: staticPrices?.restaurantMeal ?? 2000,
          cafe: staticPrices?.cafe ?? 600,
          groceries: {
            milk1L: blsGroceries.milk1L || staticPrices?.milk1L || 0,
            eggs12: blsGroceries.eggs12 || staticPrices?.eggs12 || 0,
            rice1kg: blsGroceries.rice1kg || staticPrices?.rice1kg || 0,
            chicken1kg: blsGroceries.chicken1kg || staticPrices?.chicken1kg || 0,
            bread: blsGroceries.bread || staticPrices?.bread || 0,
            onion1kg: staticPrices?.onion1kg ?? 260,
            apple1kg: staticPrices?.apple1kg ?? 480,
            ramen: staticPrices?.ramen ?? 110,
          },
        };
      }
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
    source: 'us_bls',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}

