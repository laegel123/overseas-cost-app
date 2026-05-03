/**
 * scripts/refresh/kr_seoul_metro.mjs
 *
 * 서울교통공사 운임 정보 → seoul.transport 갱신.
 *
 * 출처: 서울교통공사 + 서울 열린데이터광장
 * API: https://openapi.seoul.go.kr:8088/ (일부 운임 정보)
 * HTML: 정적 페이지 fetch + parse
 *
 * 방법: 정기권·1회권·택시 기본요금 공식 페이지 fetch + parse
 * API 키 불필요 (공개 데이터).
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed} from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const METRO_FARE_URL = 'https://www.seoulmetro.co.kr/kr/page.do?menuIdx=354';
const TAXI_FARE_URL = 'https://tago.go.kr/';

export const STATIC_FARES = {
  singleRide: 1400,
  monthlyPass: 65000,
  taxiBase: 4800,
};

export const SOURCE = {
  category: 'transport',
  name: '서울교통공사',
  url: 'https://www.seoulmetro.co.kr/',
};

/**
 * HTML 응답에서 운임 정보 파싱.
 * @param {string} html
 * @returns {{singleRide?: number, monthlyPass?: number}}
 */
export function parseMetroFareHtml(html) {
  const fares = {};

  const singleRidePatterns = [
    /기본\s*운임[^0-9]*(\d{1,2},?\d{3})\s*원/,
    /일반\s*교통카드[^0-9]*(\d{1,2},?\d{3})\s*원/,
    /(\d{1,2},?\d{3})\s*원\s*\(기본\)/,
  ];

  for (const pattern of singleRidePatterns) {
    const match = pattern.exec(html);
    if (match) {
      const value = parseInt(match[1].replace(/,/g, ''), 10);
      if (Number.isFinite(value) && value > 0 && value < 10000) {
        fares.singleRide = value;
        break;
      }
    }
  }

  const monthlyPassPatterns = [
    /정기권[^0-9]*(\d{2,3},?\d{3})\s*원/,
    /월정액권[^0-9]*(\d{2,3},?\d{3})\s*원/,
  ];

  for (const pattern of monthlyPassPatterns) {
    const match = pattern.exec(html);
    if (match) {
      const value = parseInt(match[1].replace(/,/g, ''), 10);
      if (Number.isFinite(value) && value > 10000 && value < 200000) {
        fares.monthlyPass = value;
        break;
      }
    }
  }

  return fares;
}

/**
 * HTML 응답에서 택시 기본요금 파싱.
 * @param {string} html
 * @returns {number | null}
 */
export function parseTaxiFareHtml(html) {
  const patterns = [
    /기본요금[^0-9]*(\d{1,2},?\d{3})\s*원/,
    /서울[^0-9]*택시[^0-9]*(\d{1,2},?\d{3})\s*원/,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match) {
      const value = parseInt(match[1].replace(/,/g, ''), 10);
      if (Number.isFinite(value) && value > 1000 && value < 20000) {
        return value;
      }
    }
  }

  return null;
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * 서울교통공사 운임 → seoul.transport 갱신.
 * @param {{dryRun?: boolean, useStatic?: boolean}} [opts]
 * @returns {Promise<RefreshResult>}
 */
export default async function refresh(opts = {}) {
  const errors = [];
  const newTransport = { ...STATIC_FARES };

  if (!opts.useStatic) {
    try {
      const response = await fetchWithRetry(METRO_FARE_URL, { timeoutMs: 15000 });
      const html = await response.text();

      if (html && html.length > 0) {
        const parsed = parseMetroFareHtml(html);
        if (parsed.singleRide) {
          newTransport.singleRide = parsed.singleRide;
        }
        if (parsed.monthlyPass) {
          newTransport.monthlyPass = parsed.monthlyPass;
        }
        // 페이지는 응답했지만 파싱이 모두 실패 — 페이지 구조 변경 가능성, 운영 알림 필요.
        if (parsed.singleRide === undefined && parsed.monthlyPass === undefined) {
          errors.push({
            cityId: 'seoul',
            reason: 'Metro fare HTML parse returned empty — page structure may have changed; using static fallback',
          });
        }
      }
    } catch (err) {
      errors.push({
        cityId: 'seoul',
        reason: `Metro fare fetch failed, using static fallback: ${err?.message ?? 'unknown'}`,
      });
    }

    try {
      const response = await fetchWithRetry(TAXI_FARE_URL, { timeoutMs: 15000 });
      const html = await response.text();

      if (html && html.length > 0) {
        const taxiFare = parseTaxiFareHtml(html);
        if (taxiFare) {
          newTransport.taxiBase = taxiFare;
        } else {
          errors.push({
            cityId: 'seoul',
            reason: 'Taxi fare HTML parse returned null — page structure may have changed; using static fallback',
          });
        }
      }
    } catch (err) {
      errors.push({
        cityId: 'seoul',
        reason: `Taxi fare fetch failed, using static fallback: ${err?.message ?? 'unknown'}`,
      });
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
  const oldTransport = oldData?.transport ?? {};

  for (const [field, newVal] of Object.entries(newTransport)) {
    const oldVal = oldTransport[field] ?? null;

    if (oldVal !== newVal) {
      fields.push(field);
      const pctChange = computePctChange(oldVal, newVal);
      changes.push({ cityId: 'seoul', field: `transport.${field}`, oldValue: oldVal, newValue: newVal, pctChange });
    }
  }

  if (!opts.dryRun && changes.length > 0) {
    const base = oldData ?? createCitySeed({ id: 'seoul', name: { ko: '서울', en: 'Seoul' }, country: 'KR', currency: 'KRW', region: 'asia' });
    const updatedData = { ...base, transport: { ...base.transport, ...newTransport } };

    try {
      await writeCity('seoul', updatedData, SOURCE);
    } catch (err) {
      errors.push({ cityId: 'seoul', reason: `Write failed: ${err?.message ?? 'unknown'}` });
    }
  }

  return {
    source: 'kr_seoul_metro',
    cities: changes.length > 0 ? ['seoul'] : [],
    fields,
    changes,
    errors,
  };
}

