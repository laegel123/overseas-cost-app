/**
 * scripts/refresh/sg_singstat.mjs
 *
 * SingStat (Singapore Department of Statistics) → 싱가포르 rent + food 갱신.
 *
 * 출처: SingStat Rental Index + CPI
 * API: https://tablebuilder.singstat.gov.sg/api/table/tabledata/<resourceId>
 * 키: SG_DATA_GOV_KEY (data.gov.sg API)
 *
 * **v1.0 한계**: jp_estat 와 동일 패턴 — `fetchSingStatTable` /
 * `apiAvailable` 가 정의돼 있으나 실제 데이터 fetch 결과를 STATIC 보정에 적용하지 않는다.
 * `checkSingStatStatus()` 는 호출되지만 결과 (`apiAvailable`) 가 후속 분기에 wire up 되지 않아
 * sg_singstat 는 사실상 항상 STATIC_RENT / STATIC_GROCERIES 를 반환한다.
 *
 * 이유: SingStat tablebuilder API 응답의 row 단위 (월별 누적값 vs 인덱스 vs 가격) 검증이 v1.x
 * 별도 phase 필요. 워크플로우에서 `--useStatic` 적용으로 무의미한 SingStat API 호출 + 키 노출
 * 위험 차단 (jp_estat / visas / universities 와 일관 정책).
 *
 * v1.x 계획:
 * - `fetchSingStatTable` 응답 단위 / scale 검증 (HDB rental index 기준년도, CPI item-level 매핑)
 * - 검증 통과 후 `apiAvailable === true` 분기에서 STATIC 대체
 * - 워크플로우의 `--useStatic` 제거
 *
 * 방법:
 * - rent: HDB rental + private property rental 평균
 * - food: CPI by item + hawker centre 가격 정적 추정
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const SINGSTAT_API_BASE = 'https://tablebuilder.singstat.gov.sg/api/table/tabledata';

export const CITY_CONFIGS = {
  singapore: {
    id: 'singapore',
    name: { ko: '싱가포르', en: 'Singapore' },
    country: 'SG',
    currency: 'SGD',
    region: 'asia',
  },
};

export const SINGSTAT_TABLE_IDS = {
  rentalIndex: 'M212161',
  cpi: 'M212891',
};

export const STATIC_RENT = {
  share: 1200,
  studio: 2200,
  oneBed: 2800,
  twoBed: 3800,
};

export const STATIC_GROCERIES = {
  milk1L: 3.80,
  eggs12: 4.50,
  rice1kg: 3.20,
  chicken1kg: 9.50,
  bread: 2.80,
  onion1kg: 2.50,
  apple1kg: 5.80,
  ramen: 1.50,
};

// v1.0 schema (`CityCostData.food`) 에는 `restaurantMeal` / `cafe` / `groceries` 만 존재.
// 과거 `hawkerMeal` 필드가 정의돼 있었으나 city JSON 으로 흘러들지 않는 dead field 라 제거 (PR #20
// review round 13). hawker centre 가격은 v1.x 에서 schema 확장 시 별도 필드로 도입 검토.
export const STATIC_FOOD = {
  restaurantMeal: 15.00,
  cafe: 6.00,
};

export const SOURCE_RENT = {
  category: 'rent',
  name: 'SingStat Rental Index + static estimates',
  url: 'https://www.singstat.gov.sg/find-data/search-by-theme/industry/real-estate',
};

export const SOURCE_FOOD = {
  category: 'food',
  name: 'SingStat CPI + hawker centre estimates',
  url: 'https://www.singstat.gov.sg/find-data/search-by-theme/economy/prices-and-price-indices',
};

/**
 * SingStat API 상태 체크 — reachability 만 확인.
 *
 * **v1.0 한계**: 본 함수의 반환값은 `refresh()` 내에서 errors 기록 +
 * 가용성 로깅 목적으로만 사용되며, **STATIC vs API 분기에 wire up 되지 않는다**. 즉 `apiAvailable`
 * 가 `true` 여도 도시 JSON 에는 항상 STATIC_RENT / STATIC_GROCERIES 가 적재된다 (헤더 주석 참조).
 * v1.x 응답 단위 검증 후 실제 분기에 연결.
 *
 * @returns {Promise<boolean>}
 */
export async function checkSingStatStatus() {
  const url = `${SINGSTAT_API_BASE}/${SINGSTAT_TABLE_IDS.rentalIndex}`;
  try {
    const response = await fetchWithRetry(url, { timeoutMs: 10000 });
    // reachability check 만 필요 — body 미사용. undici keep-alive 연결 점유 방지.
    await response.body?.cancel().catch(() => {});
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * SingStat API 응답 파싱. 최신 값 추출.
 * @param {unknown} data
 * @returns {number | null}
 */
export function parseSingStatValue(data) {
  if (!data || typeof data !== 'object') return null;

  const records = data.Data?.row;
  if (!Array.isArray(records) || records.length === 0) return null;

  const latestRecord = records[records.length - 1];
  const columns = latestRecord?.columns;
  if (!Array.isArray(columns) || columns.length === 0) return null;

  const valueCol = columns.find((c) => c.key === 'value' || c.key === 'Value');
  const value = parseFloat(valueCol?.value);

  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  return null;
}

// **TODO (v1.x —  정리)**:
//   `fetchSingStatTable` 함수를 v1.0 에서 호출하지 않아 dead code 였음. wire-up 시점에 재구현.
//   참고 구현 (v1.0 round 13 까지 유지):
//     async function fetchSingStatTable(tableId, apiKey) {
//       const url = `${SINGSTAT_API_BASE}/${tableId}`;
//       const headers = { Accept: 'application/json' };
//       if (apiKey) headers['api-key'] = apiKey;
//       try {
//         const response = await fetchWithRetry(url, { headers });
//         return parseSingStatValue(await response.json());
//       } catch { return null; }
//     }
//   wire-up 단계: (a) 응답 row 단위 검증 (HDB rental index 기준년도, CPI item-level 매핑), (b)
//   apiAvailable === true 분기에서 STATIC 대체, (c) 워크플로우의 --useStatic 제거.

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
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * SingStat → 싱가포르 rent + food 갱신.
 * @param {{dryRun?: boolean, cities?: string[], useStatic?: boolean}} [opts]
 * @returns {Promise<RefreshResult>}
 */
export default async function refresh(opts = {}) {
  const errors = [];
  const changes = [];
  const fields = [];
  const updatedCities = [];

  const targetCities = opts.cities ?? Object.keys(CITY_CONFIGS);

  const apiKey = process.env.SG_DATA_GOV_KEY;

  // v1.0: useStatic=false 라도 mapToRent / mapToGroceries 는 항상 STATIC 을 반환 (헤더 주석 참조).
  // checkSingStatStatus 호출은 reachability 로깅 목적만 — apiAvailable 분기에 wire 되지 않음.
  // v1.x 응답 단위 검증 후 본 분기에서 STATIC 대체.
  if (!opts.useStatic) {
    if (!apiKey) {
      errors.push({
        cityId: 'all',
        reason: 'SG_DATA_GOV_KEY environment variable not set, using static values',
      });
    } else {
      const apiAvailable = await checkSingStatStatus();
      if (!apiAvailable) {
        errors.push({
          cityId: 'all',
          reason: 'SingStat API unavailable, using static values',
        });
      }
      // v1.0 의도: apiAvailable 결과를 의도적으로 사용하지 않음 — 헤더 주석의 v1.0 한계 참조.
      void apiAvailable;
    }
  }

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
    source: 'sg_singstat',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}
