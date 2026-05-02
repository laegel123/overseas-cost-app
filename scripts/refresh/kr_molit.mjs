/**
 * scripts/refresh/kr_molit.mjs
 *
 * 국토교통부 실거래가 공개시스템 → seoul.rent 갱신.
 *
 * API: https://apis.data.go.kr/1613000/RTMSDataSvcRHRent (전월세)
 * 공공데이터포털 키 필요: KR_DATA_API_KEY
 *
 * 방법: 서울특별시 25개 자치구 임대료 메디안 → share/studio/oneBed/twoBed 매핑
 * 면적 기준: share (<= 10㎡), studio (11~30㎡), oneBed (31~50㎡), twoBed (51~80㎡)
 */

import { fetchWithRetry, readCity, writeCity, createMissingApiKeyError } from './_common.mjs';

const API_BASE = 'https://apis.data.go.kr/1613000/RTMSDataSvcRHRent/getRTMSDataSvcRHRent';

export const SEOUL_DISTRICT_CODES = [
  '11110', '11140', '11170', '11200', '11215', '11230', '11260', '11290',
  '11305', '11320', '11350', '11380', '11410', '11440', '11470', '11500',
  '11530', '11545', '11560', '11590', '11620', '11650', '11680', '11710', '11740',
];

export const SOURCE = {
  category: 'rent',
  name: '국토교통부 실거래가 공개시스템',
  url: 'https://rt.molit.go.kr/',
};

/**
 * 면적(㎡) → 카테고리 매핑.
 * @param {number} area
 * @returns {'share' | 'studio' | 'oneBed' | 'twoBed' | null}
 */
export function areaToCategory(area) {
  if (area <= 10) return 'share';
  if (area <= 30) return 'studio';
  if (area <= 50) return 'oneBed';
  if (area <= 80) return 'twoBed';
  return null;
}

/**
 * XML 응답에서 매물 데이터 파싱.
 * @param {string} xml
 * @returns {Array<{area: number, monthlyRent: number}>}
 */
export function parseRentXml(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const areaMatch = /<excluUseAr>([\d.]+)<\/excluUseAr>/.exec(itemXml);
    const rentMatch = /<monthlyRent>([\d,]+)<\/monthlyRent>/.exec(itemXml);

    if (areaMatch && rentMatch) {
      const area = parseFloat(areaMatch[1]);
      const monthlyRent = parseInt(rentMatch[1].replace(/,/g, ''), 10);

      if (Number.isFinite(area) && Number.isFinite(monthlyRent) && monthlyRent > 0) {
        items.push({ area, monthlyRent });
      }
    }
  }

  return items;
}

/**
 * 응답 코드 체크.
 * @param {string} xml
 * @returns {{ok: boolean, code: string, msg: string}}
 */
export function parseResultCode(xml) {
  const codeMatch = /<resultCode>([\w]+)<\/resultCode>/.exec(xml);
  const msgMatch = /<resultMsg>([^<]*)<\/resultMsg>/.exec(xml);

  const code = codeMatch?.[1] ?? 'UNKNOWN';
  const msg = msgMatch?.[1] ?? '';

  return { ok: code === '00', code, msg };
}

/**
 * 메디안 계산.
 * @param {number[]} values
 * @returns {number | null}
 */
export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * 국토부 실거래가 → seoul.rent 갱신.
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
  const allItems = [];
  const now = new Date();
  const dealYm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

  for (const lawd of SEOUL_DISTRICT_CODES) {
    const url = `${API_BASE}?serviceKey=${encodeURIComponent(apiKey)}&LAWD_CD=${lawd}&DEAL_YMD=${dealYm}&numOfRows=1000`;

    try {
      const response = await fetchWithRetry(url, { timeoutMs: 20000 });
      const xml = await response.text();

      const result = parseResultCode(xml);
      if (!result.ok) {
        if (result.code === '99' || result.code === 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR') {
          errors.push({ cityId: 'seoul', reason: `API key invalid or expired: ${result.msg}` });
          continue;
        }
        if (result.code === 'NO_DATA') {
          continue;
        }
        errors.push({ cityId: 'seoul', reason: `API error for ${lawd}: ${result.code} ${result.msg}` });
        continue;
      }

      const items = parseRentXml(xml);
      allItems.push(...items);
    } catch (err) {
      errors.push({ cityId: 'seoul', reason: `Fetch failed for district ${lawd}: ${err?.message ?? 'unknown'}` });
    }
  }

  const byCategory = { share: [], studio: [], oneBed: [], twoBed: [] };
  for (const item of allItems) {
    const cat = areaToCategory(item.area);
    if (cat) {
      byCategory[cat].push(item.monthlyRent);
    }
  }

  const newRent = {
    share: median(byCategory.share),
    studio: median(byCategory.studio),
    oneBed: median(byCategory.oneBed),
    twoBed: median(byCategory.twoBed),
  };

  if (allItems.length === 0) {
    errors.push({ cityId: 'seoul', reason: 'No rental data found for any district' });
    return {
      source: 'kr_molit',
      cities: [],
      fields: [],
      changes: [],
      errors,
    };
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
  const oldRent = oldData?.rent ?? {};

  for (const field of ['share', 'studio', 'oneBed', 'twoBed']) {
    const oldVal = oldRent[field] ?? null;
    const newVal = newRent[field];

    if (oldVal !== newVal && newVal !== null) {
      fields.push(field);
      const pctChange = oldVal !== null && oldVal !== 0 ? (newVal - oldVal) / oldVal : oldVal === null ? 1 : 0;
      changes.push({ cityId: 'seoul', field: `rent.${field}`, oldValue: oldVal, newValue: newVal, pctChange });
    }
  }

  if (!opts.dryRun && changes.length > 0) {
    const updatedData = oldData ?? createSeoulSeed();
    updatedData.rent = { ...updatedData.rent, ...newRent };

    try {
      await writeCity('seoul', updatedData, SOURCE);
    } catch (err) {
      errors.push({ cityId: 'seoul', reason: `Write failed: ${err?.message ?? 'unknown'}` });
    }
  }

  return {
    source: 'kr_molit',
    cities: changes.length > 0 ? ['seoul'] : [],
    fields,
    changes,
    errors,
  };
}

/**
 * Seoul seed 데이터 생성 (초기화용).
 * @returns {import('../../src/types/city').CityCostData}
 */
function createSeoulSeed() {
  return {
    id: 'seoul',
    name: { ko: '서울', en: 'Seoul' },
    country: 'KR',
    currency: 'KRW',
    region: 'asia',
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
