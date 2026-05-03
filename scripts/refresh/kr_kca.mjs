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

import { fetchWithRetry, readCity, writeCity, createMissingApiKeyError, createCitySeed} from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const API_BASE = 'https://apis.data.go.kr/B553077/api/open/sdsc/priceOfNeccesGoodsService';

export const SOURCE = {
  category: 'food',
  name: '한국소비자원 참가격',
  url: 'https://www.price.go.kr/',
};

/**
 * 품목명 → 우리 스키마 필드 매핑.
 * 참가격 API 품목명은 정확히 일치해야 함.
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

  if (!mapping) {
    for (const [key, m] of Object.entries(ITEM_MAPPING)) {
      if (itemName.includes(key) && !m.fallback) {
        mapping = m;
        break;
      }
    }
  }

  if (!mapping) {
    const ramenMapping = ITEM_MAPPING['라면'];
    if (itemName.includes('라면') && ramenMapping) {
      mapping = ramenMapping;
    }
  }

  if (!mapping) return null;

  let normalizedPrice = price;

  if (mapping.targetUnit && mapping.unit !== mapping.targetUnit) {
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
  const url = `${API_BASE}?serviceKey=${encodeURIComponent(apiKey)}&numOfRows=100&pageNo=1&type=json`;

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
    errors.push({ cityId: 'seoul', reason: `Fetch failed: ${err?.message ?? 'unknown'}` });
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
  for (const field of requiredFields) {
    if (!(field in newGroceries)) {
      errors.push({ cityId: 'seoul', reason: `Missing required field: ${field}` });
    }
  }

  let oldData;
  try {
    oldData = await readCity('seoul');
  } catch (err) {
    if (err?.code !== 'CITY_NOT_FOUND') {
      errors.push({ cityId: 'seoul', reason: `Failed to read existing data: ${err?.message}` });
    }
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
    const updatedData = oldData ?? createCitySeed({ id: 'seoul', name: { ko: '서울', en: 'Seoul' }, country: 'KR', currency: 'KRW', region: 'asia' });
    updatedData.food = updatedData.food ?? { restaurantMeal: 0, cafe: 0, groceries: {} };
    updatedData.food.groceries = { ...updatedData.food.groceries, ...newGroceries };

    try {
      await writeCity('seoul', updatedData, SOURCE);
    } catch (err) {
      errors.push({ cityId: 'seoul', reason: `Write failed: ${err?.message ?? 'unknown'}` });
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

