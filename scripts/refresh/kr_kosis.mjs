/**
 * scripts/refresh/kr_kosis.mjs
 *
 * 통계청 KOSIS 소비자물가지수 → seoul.food.restaurantMeal, seoul.food.cafe 갱신.
 *
 * API: https://kosis.kr/openapi/
 * 공공데이터포털 키 필요: KR_DATA_API_KEY
 *
 * 방법: 외식·음료 카테고리 CPI 평균값 + 정적 보정계수(1.0) 적용.
 * CPI 지수를 실제 가격으로 변환 (기준년도 2020 = 100).
 */

import { fetchWithRetry, readCity, writeCity, createMissingApiKeyError, createCitySeed, redactErrorMessage} from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const API_BASE = 'https://kosis.kr/openapi/Param/statisticsParameterData.do';

const TABLE_ID = 'DT_1J22011';
const ORG_ID = '101';

export const ITEM_CODES = {
  restaurantMeal: 'G1201',
  cafe: 'G1301',
};

export const BASE_PRICES = {
  restaurantMeal: 9000,
  cafe: 5500,
};

// 향후 운영 데이터 수집 후 보정 가능성을 위한 placeholder. 1.0 = 보정 없음 (현재 = 무영향).
// 실제 보정 도입 시 ADR-059 에 출처 + 검증 방법 명시.
const CORRECTION_FACTOR = 1.0;

export const SOURCE = {
  category: 'food',
  name: '통계청 KOSIS 소비자물가지수',
  url: 'https://kosis.kr/',
};

/**
 * KOSIS JSON 응답에서 CPI 데이터 파싱.
 * @param {unknown} data
 * @returns {Array<{itemCode: string, cpi: number, period: string}>}
 */
export function parseCpiData(data) {
  const items = [];

  if (!Array.isArray(data)) return items;

  for (const row of data) {
    const itemCode = row?.ITM_ID;
    const cpi = parseFloat(row?.DT);
    const period = row?.PRD_DE;

    if (typeof itemCode === 'string' && Number.isFinite(cpi) && cpi > 0) {
      items.push({ itemCode, cpi, period: period ?? '' });
    }
  }

  return items;
}

/**
 * CPI 지수 → 실제 가격 변환.
 * 기준년도 2020 = 100 기준.
 * @param {'restaurantMeal' | 'cafe'} field
 * @param {number} cpi
 * @returns {number}
 */
export function cpiToPrice(field, cpi) {
  const basePrice = BASE_PRICES[field];
  const adjustedPrice = (basePrice * cpi * CORRECTION_FACTOR) / 100;
  return Math.round(adjustedPrice / 100) * 100;
}

/**
 * 최신 기간 데이터 추출.
 * @param {Array<{itemCode: string, cpi: number, period: string}>} items
 * @returns {Map<string, number>}
 */
function getLatestCpiByItem(items) {
  const byItem = new Map();

  for (const item of items) {
    const existing = byItem.get(item.itemCode);
    // KOSIS period 형식 YYYYMM (예: '202611') — 숫자 비교로 명시 (사전순 의존 회피).
    const itemPeriodNum = parseInt(item.period, 10);
    const existingPeriodNum = existing ? parseInt(existing.period, 10) : -Infinity;
    if (Number.isFinite(itemPeriodNum) && itemPeriodNum > existingPeriodNum) {
      byItem.set(item.itemCode, { cpi: item.cpi, period: item.period });
    }
  }

  const result = new Map();
  for (const [itemCode, data] of byItem) {
    result.set(itemCode, data.cpi);
  }
  return result;
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * KOSIS CPI → seoul.food.restaurantMeal, cafe 갱신.
 * @param {{dryRun?: boolean}} [opts]
 * @returns {Promise<RefreshResult>}
 */
export default async function refresh(opts = {}) {
  const apiKey = process.env.KR_DATA_API_KEY;
  if (!apiKey) {
    throw createMissingApiKeyError(
      'KR_DATA_API_KEY is required. Register at https://www.data.go.kr',
    );
  }

  const errors = [];

  const now = new Date();
  const endPeriod = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const startYear = now.getFullYear() - 1;
  const startPeriod = `${startYear}01`;

  const itemCodes = Object.values(ITEM_CODES).join(',');
  const params = new URLSearchParams({
    method: 'getList',
    apiKey,
    orgId: ORG_ID,
    tblId: TABLE_ID,
    itmId: itemCodes,
    prdSe: 'M',
    startPrdDe: startPeriod,
    endPrdDe: endPeriod,
    format: 'json',
    jsonVD: 'Y',
  });
  const url = `${API_BASE}?${params}`;

  let cpiItems;
  try {
    const response = await fetchWithRetry(url, { timeoutMs: 20000 });
    const contentType = response.headers.get('content-type') ?? '';

    if (!contentType.includes('json')) {
      const text = await response.text();
      // KOSIS API 비-JSON 에러 응답 패턴: "<err>...</err>" XML, "ERR_:" 코드, 또는 인증 키워드.
      // 'err' 단독 substring 매칭은 정상 한국어에 잘못 걸리므로 명시적 패턴만 사용.
      if (/<err>|ERR_:|UNAUTHORIZED|SERVICE_KEY|APPLICATION_KEY/i.test(text)) {
        errors.push({ cityId: 'seoul', reason: `API error: ${text.slice(0, 200)}` });
        return { source: 'kr_kosis', cities: [], fields: [], changes: [], errors };
      }
      errors.push({ cityId: 'seoul', reason: 'Unexpected response format (expected JSON)' });
      return { source: 'kr_kosis', cities: [], fields: [], changes: [], errors };
    }

    const data = await response.json();
    cpiItems = parseCpiData(data);
  } catch (err) {
    errors.push({ cityId: 'seoul', reason: `Fetch failed: ${redactErrorMessage(String(err?.message ?? "unknown"))}` });
    return { source: 'kr_kosis', cities: [], fields: [], changes: [], errors };
  }

  if (cpiItems.length === 0) {
    errors.push({ cityId: 'seoul', reason: 'No CPI data found' });
    return { source: 'kr_kosis', cities: [], fields: [], changes: [], errors };
  }

  const latestCpi = getLatestCpiByItem(cpiItems);

  const newFood = {};
  for (const [field, itemCode] of Object.entries(ITEM_CODES)) {
    const cpi = latestCpi.get(itemCode);
    if (cpi) {
      newFood[field] = cpiToPrice(field, cpi);
    } else {
      errors.push({ cityId: 'seoul', reason: `Missing CPI for ${field} (${itemCode})` });
    }
  }

  let oldData;
  try {
    oldData = await readCity('seoul');
  } catch (err) {
    if (err?.code !== 'CITY_NOT_FOUND') {
      errors.push({ cityId: 'seoul', reason: `Failed to read existing data: ${redactErrorMessage(String(err?.message ?? ""))}` });
    }
  }

  const changes = [];
  const fields = [];
  const oldFood = oldData?.food ?? {};

  for (const [field, newVal] of Object.entries(newFood)) {
    const oldVal = oldFood[field] ?? null;

    if (oldVal !== newVal) {
      fields.push(field);
      const pctChange = computePctChange(oldVal, newVal);
      changes.push({ cityId: 'seoul', field: `food.${field}`, oldValue: oldVal, newValue: newVal, pctChange });
    }
  }

  if (!opts.dryRun && changes.length > 0) {
    const base = oldData ?? createCitySeed({ id: 'seoul', name: { ko: '서울', en: 'Seoul' }, country: 'KR', currency: 'KRW', region: 'asia' });
    const updatedData = { ...base, food: { ...base.food, ...newFood } };

    try {
      await writeCity('seoul', updatedData, SOURCE);
    } catch (err) {
      errors.push({ cityId: 'seoul', reason: `Write failed: ${redactErrorMessage(String(err?.message ?? "unknown"))}` });
    }
  }

  return {
    source: 'kr_kosis',
    cities: changes.length > 0 ? ['seoul'] : [],
    fields,
    changes,
    errors,
  };
}

