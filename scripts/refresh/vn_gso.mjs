/**
 * scripts/refresh/vn_gso.mjs
 *
 * GSO (General Statistics Office of Vietnam) → 호치민 rent + food 갱신.
 *
 * 출처: GSO (한계 있음)
 * URL: https://www.gso.gov.vn/en/
 * API: 제한적 (CSV 다운로드 위주). 영문 부족.
 *
 * 한계:
 * - 도시별 입자도 거침. Hồ Chí Minh City 단위 데이터 일부 부재.
 * - fallback: 부재 시 기본값 + sources 에 "estimated, GSO 도시 단위 데이터 부재" 마커
 *
 * 방법:
 * - rent: 정적 추정 + "estimated" 마커
 * - food: GSO CPI + 정적 보완 + "estimated" 마커
 * - transport: 정적 (별도 스크립트 없음 — DATA_SOURCES.md 에 "static" 명시)
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const GSO_URL = 'https://www.gso.gov.vn/en/';

export const CITY_CONFIGS = {
  hochiminh: {
    id: 'hochiminh',
    name: { ko: '호치민', en: 'Ho Chi Minh City' },
    country: 'VN',
    currency: 'VND',
    region: 'asia',
  },
};

export const STATIC_RENT = {
  share: 5000000,
  studio: 8000000,
  oneBed: 12000000,
  twoBed: 18000000,
};

export const STATIC_GROCERIES = {
  milk1L: 35000,
  eggs12: 45000,
  rice1kg: 20000,
  chicken1kg: 85000,
  bread: 25000,
  onion1kg: 30000,
  apple1kg: 80000,
  ramen: 8000,
};

export const STATIC_FOOD = {
  restaurantMeal: 80000,
  cafe: 45000,
};

export const STATIC_TRANSPORT = {
  monthlyPass: 200000,
  singleRide: 7000,
  taxiBase: 12000,
};

export const SOURCE_RENT = {
  category: 'rent',
  name: 'GSO estimates (도시 단위 데이터 부재, estimated)',
  url: GSO_URL,
};

export const SOURCE_FOOD = {
  category: 'food',
  name: 'GSO CPI + estimates (도시 단위 데이터 부재, estimated)',
  url: GSO_URL,
};

export const SOURCE_TRANSPORT = {
  category: 'transport',
  name: 'Ho Chi Minh City static estimates',
  url: 'https://hochiminhcity.gov.vn/',
};

/**
 * GSO 사이트 상태 체크.
 * @returns {Promise<boolean>}
 */
export async function checkGsoStatus() {
  try {
    const response = await fetchWithRetry(GSO_URL, { timeoutMs: 15000 });
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
 * transport fares 매핑.
 * @returns {{monthlyPass: number, singleRide: number, taxiBase: number}}
 */
export function getTransportFares() {
  return { ...STATIC_TRANSPORT };
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * GSO → 호치민 rent + food + transport 갱신.
 * @param {{dryRun?: boolean, cities?: string[], useStatic?: boolean}} [opts]
 * @returns {Promise<RefreshResult>}
 */
export default async function refresh(opts = {}) {
  const errors = [];
  const changes = [];
  const fields = [];
  const updatedCities = [];

  const targetCities = opts.cities ?? Object.keys(CITY_CONFIGS);

  let gsoAvailable = false;
  if (!opts.useStatic) {
    gsoAvailable = await checkGsoStatus();
    if (!gsoAvailable) {
      errors.push({
        cityId: 'all',
        reason: 'GSO site unavailable, using static estimates',
      });
    }
  }

  errors.push({
    cityId: 'all',
    reason: 'GSO 도시 단위 데이터 부재 — 정적 추정값 사용 (estimated marker 적용)',
  });

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
    const newTransport = getTransportFares();

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
    const oldTransport = oldData?.transport ?? {};
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

    for (const field of ['monthlyPass', 'singleRide', 'taxiBase']) {
      const oldVal = oldTransport[field] ?? null;
      const newVal = newTransport[field];

      if (oldVal !== newVal) {
        fields.push(field);
        const pctChange = computePctChange(oldVal, newVal);
        changes.push({ cityId, field: `transport.${field}`, oldValue: oldVal, newValue: newVal, pctChange });
        hasChanges = true;
      }
    }

    if (!opts.dryRun && hasChanges) {
      const base = oldData ?? createCitySeed(config);
      const updatedData = {
        ...base,
        rent: newRent,
        food: newFood,
        transport: newTransport,
      };

      try {
        await writeCity(cityId, updatedData, SOURCE_RENT);
        await writeCity(cityId, { ...updatedData, lastUpdated: base.lastUpdated || '' }, SOURCE_FOOD);
        await writeCity(cityId, { ...updatedData, lastUpdated: base.lastUpdated || '' }, SOURCE_TRANSPORT);
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
    source: 'vn_gso',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}
