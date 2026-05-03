/**
 * scripts/refresh/kr_kca.mjs
 *
 * 한국소비자원 참가격 → seoul.food.groceries 갱신.
 *
 * API: https://www.data.go.kr/data/15047042/openapi.do (생필품 가격)
 * 공공데이터포털 키 필요: KR_DATA_API_KEY
 *
 * 방법: 32개 품목 중 8개 표준 매핑 (milk1L, eggs12, rice1kg, chicken1kg, bread, onion1kg, apple1kg, ramen)
 * 서울 대형마트 평균가 사용.
 */

import { fetchWithRetry, readCity, writeCity, createMissingApiKeyError, createCitySeed, redactErrorMessage} from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const API_BASE = 'https://apis.data.go.kr/B553077/api/open/sdsc/priceOfNeccesGoodsService';

export const SOURCE = {
  category: 'food',
  name: '한국소비자원 참가격',
  url: 'https://www.price.go.kr/',
};

/**
 * 품목명 → 우리 스키마 필드 매핑.
 * 참가격 API 품목명은 보통 정확히 일치하지만, prefix 매칭 fallback 도 지원 (normalizePrice 참고).
 *
 * @typedef {Object} ItemMapping
 * @property {string} field - 우리 스키마 필드명 (milk1L 등)
 * @property {number} unit - API 가 반환하는 가격 기준 단위 (예: 1000ml, 30개 등)
 * @property {string} baseUnit - 단위 종류 (ml/g/ea)
 * @property {number} [targetUnit] - 우리 스키마 변환 후 단위. 없으면 unit 그대로
 * @property {boolean} [fallback] - prefix 매칭 시점에 우선 매칭 제외 (normalizePrice 의 이중 패스 중
 *   첫 패스에서 skip). 정확 매칭 또는 endsWith 매칭 (라면 변종) 에서만 사용. 예: '라면' 매핑은
 *   '신라면'(정확매칭) / '진라면'(endsWith) 처럼 별도 패스에서만 사용 — '쌀(라면용)' 등 오탐 방지.
 *
 * @type {Record<string, ItemMapping>}
 */
export const ITEM_MAPPING = {
  '우유': { field: 'milk1L', unit: 1000, baseUnit: 'ml' },
  '계란': { field: 'eggs12', unit: 30, baseUnit: 'ea', targetUnit: 12 },
  '쌀': { field: 'rice1kg', unit: 20000, baseUnit: 'g', targetUnit: 1000 },
  '닭고기': { field: 'chicken1kg', unit: 1000, baseUnit: 'g' },
  '식빵': { field: 'bread', unit: 1, baseUnit: 'ea' },
  '양파': { field: 'onion1kg', unit: 1000, baseUnit: 'g' },
  '사과': { field: 'apple1kg', unit: 1000, baseUnit: 'g' },
  '신라면': { field: 'ramen', unit: 5, baseUnit: 'ea', targetUnit: 1 },
  '라면': { field: 'ramen', unit: 5, baseUnit: 'ea', targetUnit: 1, fallback: true },
};

/**
 * API 응답에서 가격 데이터 파싱.
 * @param {unknown} data
 * @returns {Array<{itemName: string, price: number, unit: number}>}
 */
export function parsePriceData(data) {
  const items = [];

  if (!data || typeof data !== 'object') return items;

  const response = data;
  const body = response.response?.body;
  const itemList = body?.items?.item;

  if (!Array.isArray(itemList)) return items;

  for (const item of itemList) {
    const itemName = item?.goodsName;
    const price = parseFloat(item?.price);
    // unit 은 단위환산 보정값 (예: 500ml → 1L 변환). 0 또는 음수는 1 로 간주 — falsy chain 회피.
    const parsedUnit = parseFloat(item?.unit);
    const unit = Number.isFinite(parsedUnit) && parsedUnit > 0 ? parsedUnit : 1;
    const regionName = item?.areaName;

    if (regionName !== '서울') continue;

    if (typeof itemName === 'string' && Number.isFinite(price) && price > 0) {
      items.push({ itemName: itemName.trim(), price, unit });
    }
  }

  return items;
}

/**
 * 품목 가격 → 표준 단위 변환.
 * @param {string} itemName
 * @param {number} price
 * @param {number} unit
 * @returns {{field: string, value: number} | null}
 */
export function normalizePrice(itemName, price, unit) {
  let mapping = ITEM_MAPPING[itemName];

  // 1) 정확 매칭 우선 (위에서 처리). 2) 정확 매칭 실패 시 prefix 매칭 — 부분 문자열 오탐 방지.
  // (예: '쌀(20kg)' → '쌀' 매칭 OK, but '현미쌀' / '메추리계란' 은 prefix 가 아니라서 매칭 안 됨)
  if (!mapping) {
    for (const [key, m] of Object.entries(ITEM_MAPPING)) {
      if (itemName.startsWith(key) && !m.fallback) {
        mapping = m;
        break;
      }
    }
  }

  // 라면 변종 (X라면) 만 endsWith 매칭. 다른 품목은 startsWith 만 — '메추리계란' / '현미쌀' 등 오탐 차단.
  if (!mapping) {
    const ramenMapping = ITEM_MAPPING['라면'];
    if (itemName.endsWith('라면') && ramenMapping) {
      mapping = ramenMapping;
    }
  }

  if (!mapping) return null;

  let normalizedPrice = price;

  // mapping.targetUnit 이 정의된 경우만 단위 환산 — undefined 면 mapping.unit == basePrice 단위.
  if (mapping.targetUnit !== undefined) {
    normalizedPrice = (price / unit) * mapping.targetUnit;
  }

  return { field: mapping.field, value: Math.round(normalizedPrice) };
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * 한국소비자원 참가격 → seoul.food.groceries 갱신.
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
  const params = new URLSearchParams({
    serviceKey: apiKey,
    numOfRows: '100',
    pageNo: '1',
    type: 'json',
  });
  const url = `${API_BASE}?${params}`;

  let priceItems;
  try {
    const response = await fetchWithRetry(url, { timeoutMs: 20000 });
    const contentType = response.headers.get('content-type') ?? '';

    if (contentType.includes('xml') || contentType.includes('html')) {
      const text = await response.text();
      if (text.includes('SERVICE_KEY_IS_NOT_REGISTERED_ERROR') || text.includes('LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR')) {
        errors.push({ cityId: 'seoul', reason: 'API key invalid or rate limited' });
        return { source: 'kr_kca', cities: [], fields: [], changes: [], errors };
      }
      errors.push({ cityId: 'seoul', reason: 'Unexpected response format (expected JSON)' });
      return { source: 'kr_kca', cities: [], fields: [], changes: [], errors };
    }

    const data = await response.json();
    priceItems = parsePriceData(data);
  } catch (err) {
    errors.push({ cityId: 'seoul', reason: `Fetch failed: ${redactErrorMessage(String(err?.message ?? "unknown"))}` });
    return { source: 'kr_kca', cities: [], fields: [], changes: [], errors };
  }

  if (priceItems.length === 0) {
    errors.push({ cityId: 'seoul', reason: 'No price data found for Seoul' });
    return { source: 'kr_kca', cities: [], fields: [], changes: [], errors };
  }

  const newGroceries = {};
  const mappedFields = new Set();

  for (const item of priceItems) {
    const normalized = normalizePrice(item.itemName, item.price, item.unit);
    if (normalized && !mappedFields.has(normalized.field)) {
      newGroceries[normalized.field] = normalized.value;
      mappedFields.add(normalized.field);
    }
  }

  const requiredFields = ['milk1L', 'eggs12', 'rice1kg', 'chicken1kg', 'bread'];
  const missingFields = requiredFields.filter((f) => !(f in newGroceries));
  for (const field of missingFields) {
    errors.push({ cityId: 'seoul', reason: `Missing required field: ${field}` });
  }

  let oldData;
  try {
    oldData = await readCity('seoul');
  } catch (err) {
    if (err?.code !== 'CITY_NOT_FOUND') {
      errors.push({ cityId: 'seoul', reason: `Failed to read existing data: ${redactErrorMessage(String(err?.message ?? ""))}` });
    }
  }

  // 신규 도시 (CITY_NOT_FOUND) + 필수 필드 누락 시 write 차단 — createCitySeed 의 0 placeholder 가
  // 그대로 저장되어 validate_cities 가 차단하는 것을 사전 방지.
  if (!oldData && missingFields.length > 0) {
    return { source: 'kr_kca', cities: [], fields: [], changes: [], errors };
  }

  const changes = [];
  const fields = [];
  const oldGroceries = oldData?.food?.groceries ?? {};

  for (const [field, newVal] of Object.entries(newGroceries)) {
    const oldVal = oldGroceries[field] ?? null;

    if (oldVal !== newVal) {
      fields.push(field);
      const pctChange = computePctChange(oldVal, newVal);
      changes.push({ cityId: 'seoul', field: `food.groceries.${field}`, oldValue: oldVal, newValue: newVal, pctChange });
    }
  }

  if (!opts.dryRun && changes.length > 0) {
    const base = oldData ?? createCitySeed({ id: 'seoul', name: { ko: '서울', en: 'Seoul' }, country: 'KR', currency: 'KRW', region: 'asia' });
    const baseFood = base.food ?? { restaurantMeal: 0, cafe: 0, groceries: {} };
    const updatedData = {
      ...base,
      food: { ...baseFood, groceries: { ...baseFood.groceries, ...newGroceries } },
    };

    try {
      await writeCity('seoul', updatedData, SOURCE);
    } catch (err) {
      errors.push({ cityId: 'seoul', reason: `Write failed: ${redactErrorMessage(String(err?.message ?? "unknown"))}` });
    }
  }

  return {
    source: 'kr_kca',
    cities: changes.length > 0 ? ['seoul'] : [],
    fields,
    changes,
    errors,
  };
}

