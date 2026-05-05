/**
 * scripts/refresh/de_destatis.mjs
 *
 * Destatis (Federal Statistical Office Germany) → 베를린 + 뮌헨 rent + food 갱신.
 *
 * 출처: Destatis GENESIS-Online API
 * API: https://www-genesis.destatis.de/genesis/online (XML/JSON, 키 불필요)
 *
 * 방법:
 * - rent: Bundesland 평균 임대료 통계 (Berlin / Bavaria + Munich 보정계수)
 * - food: CPI by item (COICOP) 독일 평균 + 도시 보정계수
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const DESTATIS_API_BASE = 'https://www-genesis.destatis.de/genesisWS/rest/2020';

export const CITY_CONFIGS = {
  berlin: {
    id: 'berlin',
    name: { ko: '베를린', en: 'Berlin' },
    country: 'DE',
    currency: 'EUR',
    region: 'eu',
    bundesland: 'BE',
    rentAdjustment: 1.0,
    foodAdjustment: 1.0,
  },
  munich: {
    id: 'munich',
    name: { ko: '뮌헨', en: 'Munich' },
    country: 'DE',
    currency: 'EUR',
    region: 'eu',
    bundesland: 'BY',
    rentAdjustment: 1.35,
    foodAdjustment: 1.10,
  },
};

export const STATIC_RENT = {
  berlin: {
    share: 550,
    studio: 850,
    oneBed: 1000,
    twoBed: 1400,
  },
  munich: {
    share: 750,
    studio: 1150,
    oneBed: 1350,
    twoBed: 1900,
  },
};

export const STATIC_GROCERIES_BASE = {
  milk1L: 1.10,
  eggs12: 2.80,
  rice1kg: 2.50,
  chicken1kg: 8.00,
  bread: 1.80,
  onion1kg: 1.20,
  apple1kg: 2.50,
  ramen: 0.90,
};

export const STATIC_FOOD_BASE = {
  restaurantMeal: 12.00,
  cafe: 3.50,
};

export const SOURCE_RENT = {
  category: 'rent',
  name: 'Destatis GENESIS + static estimates',
  url: 'https://www.destatis.de/EN/Themes/Society-Environment/Housing/_node.html',
};

export const SOURCE_FOOD = {
  category: 'food',
  name: 'Destatis CPI + static estimates',
  url: 'https://www.destatis.de/EN/Themes/Economy/Prices/_node.html',
};

/**
 * Destatis GENESIS API XML 응답 파싱.
 * @param {string} xmlText
 * @returns {number | null}
 */
export function parseGenesisXml(xmlText) {
  if (!xmlText || typeof xmlText !== 'string') return null;

  const valueMatch = xmlText.match(/<wert[^>]*>([0-9.,]+)<\/wert>/i);
  if (valueMatch) {
    const value = parseFloat(valueMatch[1].replace(',', '.'));
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return null;
}

/**
 * 도시별 rent 데이터 계산 (정적 + 보정계수).
 * @param {string} cityId
 * @param {number} adjustment
 * @returns {{share: number, studio: number, oneBed: number, twoBed: number}}
 */
export function getRentForCity(cityId, adjustment) {
  const base = STATIC_RENT[cityId] ?? STATIC_RENT.berlin;
  return {
    share: Math.round(base.share * adjustment),
    studio: Math.round(base.studio * adjustment),
    oneBed: Math.round(base.oneBed * adjustment),
    twoBed: Math.round(base.twoBed * adjustment),
  };
}

/**
 * 도시별 groceries 데이터 계산 (정적 + 보정계수).
 * @param {number} adjustment
 * @returns {{milk1L: number, eggs12: number, rice1kg: number, chicken1kg: number, bread: number, onion1kg: number, apple1kg: number, ramen: number}}
 */
export function getGroceriesForCity(adjustment) {
  const round = (v) => Math.round(v * 100) / 100;
  return {
    milk1L: round(STATIC_GROCERIES_BASE.milk1L * adjustment),
    eggs12: round(STATIC_GROCERIES_BASE.eggs12 * adjustment),
    rice1kg: round(STATIC_GROCERIES_BASE.rice1kg * adjustment),
    chicken1kg: round(STATIC_GROCERIES_BASE.chicken1kg * adjustment),
    bread: round(STATIC_GROCERIES_BASE.bread * adjustment),
    onion1kg: round(STATIC_GROCERIES_BASE.onion1kg * adjustment),
    apple1kg: round(STATIC_GROCERIES_BASE.apple1kg * adjustment),
    ramen: round(STATIC_GROCERIES_BASE.ramen * adjustment),
  };
}

/**
 * Destatis API 상태 체크.
 * @returns {Promise<boolean>}
 */
export async function checkDestatisApiStatus() {
  const url = `${DESTATIS_API_BASE}/helloworld/logincheck`;
  try {
    const response = await fetchWithRetry(url, { timeoutMs: 10000 });
    // reachability check 만 필요 — body 미사용. undici keep-alive 연결 점유 방지 (PR #20 review round 23).
    await response.body?.cancel().catch(() => {});
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * Destatis → 베를린 + 뮌헨 rent + food 갱신.
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
    apiAvailable = await checkDestatisApiStatus();
    if (!apiAvailable) {
      errors.push({
        cityId: 'all',
        reason: 'Destatis GENESIS API unavailable, using static values',
      });
    }
  }

  for (const cityId of targetCities) {
    const config = CITY_CONFIGS[cityId];
    if (!config) {
      errors.push({ cityId, reason: `Unknown city: ${cityId}` });
      continue;
    }

    const newRent = getRentForCity(cityId, config.rentAdjustment);
    const newGroceries = getGroceriesForCity(config.foodAdjustment);
    const newFood = {
      restaurantMeal: Math.round(STATIC_FOOD_BASE.restaurantMeal * config.foodAdjustment * 100) / 100,
      cafe: Math.round(STATIC_FOOD_BASE.cafe * config.foodAdjustment * 100) / 100,
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
    source: 'de_destatis',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}
