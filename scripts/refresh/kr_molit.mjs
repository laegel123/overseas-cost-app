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

import { fetchWithRetry, readCity, writeCity, createMissingApiKeyError, createCitySeed, redactErrorMessage} from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

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
  // 국토부 실거래가는 통상 1~2개월 지연 공개 — 전달 기준으로 조회.
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const dealYm = `${prev.getFullYear()}${String(prev.getMonth() + 1).padStart(2, '0')}`;

  // 25개 자치구 병렬 fetch — concurrency 5 chunks (data.go.kr rate limit 보호 + GitHub Actions 6분 timeout 회피).
  const CONCURRENCY = 5;
  const fetchOne = async (lawd) => {
    const params = new URLSearchParams({
      serviceKey: apiKey,
      LAWD_CD: lawd,
      DEAL_YMD: dealYm,
      numOfRows: '1000',
    });
    const url = `${API_BASE}?${params}`;
    try {
      const response = await fetchWithRetry(url, { timeoutMs: 20000 });
      const xml = await response.text();

      const result = parseResultCode(xml);
      if (!result.ok) {
        if (result.code === '99' || result.code === 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR') {
          return { items: [], error: { reason: `API key invalid or expired: ${result.msg}` } };
        }
        if (result.code === 'NO_DATA') {
          return { items: [] };
        }
        return { items: [], error: { reason: `API error for ${lawd}: ${result.code} ${result.msg}` } };
      }
      return { items: parseRentXml(xml) };
    } catch (err) {
      return {
        items: [],
        error: { reason: `Fetch failed for district ${lawd}: ${redactErrorMessage(String(err?.message ?? 'unknown'))}` },
      };
    }
  };

  for (let i = 0; i < SEOUL_DISTRICT_CODES.length; i += CONCURRENCY) {
    const chunk = SEOUL_DISTRICT_CODES.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(fetchOne));
    for (const { items, error } of results) {
      if (error) errors.push({ cityId: 'seoul', ...error });
      allItems.push(...items);
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
    // NO_DATA — 1-2개월 지연 공개 특성상 일시적으로 발생 가능. errors 에 기록하되 워크플로우 fail 은 회피
    // (caller 가 errors[] 만 보고 실패 처리하지 않도록 prefix 로 구분).
    errors.push({ cityId: 'seoul', reason: 'WARN: No rental data for previous month (MOLIT publication lag, retry next cycle)' });
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
      errors.push({ cityId: 'seoul', reason: `Failed to read existing data: ${redactErrorMessage(String(err?.message ?? ""))}` });
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
      const pctChange = computePctChange(oldVal, newVal);
      changes.push({ cityId: 'seoul', field: `rent.${field}`, oldValue: oldVal, newValue: newVal, pctChange });
    }
  }

  if (!opts.dryRun && changes.length > 0) {
    const base = oldData ?? createCitySeed({ id: 'seoul', name: { ko: '서울', en: 'Seoul' }, country: 'KR', currency: 'KRW', region: 'asia' });
    const updatedData = { ...base, rent: { ...base.rent, ...newRent } };

    try {
      await writeCity('seoul', updatedData, SOURCE);
    } catch (err) {
      errors.push({ cityId: 'seoul', reason: `Write failed: ${redactErrorMessage(String(err?.message ?? "unknown"))}` });
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

