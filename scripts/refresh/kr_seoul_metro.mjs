/**
 * scripts/refresh/kr_seoul_metro.mjs
 *
 * 서울교통공사 운임 정보 → seoul.transport 갱신.
 *
 * 출처: 서울교통공사 + 서울 열린데이터광장
 * API: http://openapi.seoul.go.kr:8088/ (일부 운임 정보)
 * HTML: 정적 페이지 fetch + parse
 *
 * 방법: 정기권·1회권·택시 기본요금 공식 페이지 fetch + parse
 * API 키 불필요 (공개 데이터).
 */

import { fetchWithRetry, readCity, writeCity } from './_common.mjs';

const METRO_FARE_URL = 'http://www.seoulmetro.co.kr/kr/page.do?menuIdx=354';
const TAXI_FARE_URL = 'https://tago.go.kr/';

export const STATIC_FARES = {
  singleRide: 1400,
  monthlyPass: 65000,
  taxiBase: 4800,
};

export const SOURCE = {
  category: 'transport',
  name: '서울교통공사',
  url: 'http://www.seoulmetro.co.kr/',
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
      const pctChange = oldVal !== null && oldVal !== 0 ? (newVal - oldVal) / oldVal : oldVal === null ? 1 : 0;
      changes.push({ cityId: 'seoul', field: `transport.${field}`, oldValue: oldVal, newValue: newVal, pctChange });
    }
  }

  if (!opts.dryRun && changes.length > 0) {
    const updatedData = oldData ?? createSeoulSeed();
    updatedData.transport = { ...updatedData.transport, ...newTransport };

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
