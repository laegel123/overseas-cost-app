/**
 * scripts/refresh/ca_translink.mjs
 *
 * TransLink (Vancouver) 운임 정보 → vancouver.transport 갱신.
 *
 * 출처: TransLink fare 공식 페이지
 * URL: https://www.translink.ca/transit-fares
 * API 키 불필요 (공개 데이터).
 *
 * 방법: HTML fetch + parse (정적 fallback 포함).
 */

import { readCity, writeCity, createCitySeed} from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const TRANSLINK_FARE_URL = 'https://www.translink.ca/transit-fares';
const FETCH_TIMEOUT_MS = 15000;

export const STATIC_FARES = {
  singleRide: 3.35,
  monthlyPass: 104,
  taxiBase: 3.95,
};

export const SOURCE = {
  category: 'transport',
  name: 'TransLink',
  url: 'https://www.translink.ca/',
};

/**
 * HTML 응답에서 운임 정보 파싱.
 * @param {string} html
 * @returns {{singleRide?: number, monthlyPass?: number}}
 */
export function parseFareHtml(html) {
  const fares = {};

  const singleRidePatterns = [
    /Adult\s*Fare[^$]*\$(\d+\.?\d*)/i,
    /1-Zone[^$]*\$(\d+\.?\d*)/i,
    /Zone\s*1[^$]*\$(\d+\.?\d*)/i,
    /\$(\d+\.?\d*)\s*(?:per ride|single fare)/i,
  ];

  for (const pattern of singleRidePatterns) {
    const match = pattern.exec(html);
    if (match) {
      const value = parseFloat(match[1]);
      // 단위 통화 (CAD) 기준 sanity check: 1~10 사이.
      if (value > 1 && value < 10) {
        fares.singleRide = value;
        break;
      }
    }
  }

  const monthlyPassPatterns = [
    /Monthly\s*Pass[^$]*\$(\d+\.?\d*)/i,
    /1-Zone\s*Monthly[^$]*\$(\d+\.?\d*)/i,
    /Compass\s*Card[^$]*Monthly[^$]*\$(\d+\.?\d*)/i,
  ];

  for (const pattern of monthlyPassPatterns) {
    const match = pattern.exec(html);
    if (match) {
      const value = parseFloat(match[1]);
      // 단위 통화 (CAD) 기준 sanity check: 50~300 사이.
      if (value > 50 && value < 300) {
        fares.monthlyPass = value;
        break;
      }
    }
  }

  return fares;
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * TransLink 운임 → vancouver.transport 갱신.
 * @param {{dryRun?: boolean, useStatic?: boolean}} [opts]
 * @returns {Promise<RefreshResult>}
 */
export default async function refresh(opts = {}) {
  const errors = [];
  const newTransport = { ...STATIC_FARES };
  const cityId = 'vancouver';

  if (!opts.useStatic) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const response = await fetch(TRANSLINK_FARE_URL, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const html = await response.text();
        if (html && html.length > 0) {
          const parsed = parseFareHtml(html);
          if (parsed.singleRide) {
            newTransport.singleRide = parsed.singleRide;
          }
          if (parsed.monthlyPass) {
            newTransport.monthlyPass = parsed.monthlyPass;
          }
        }
      }
    } catch (err) {
      errors.push({
        cityId,
        reason: `TransLink fare fetch failed, using static fallback: ${err?.message ?? 'unknown'}`,
      });
    }
  }

  let oldData;
  try {
    oldData = await readCity(cityId);
  } catch (err) {
    if (err?.code !== 'CITY_NOT_FOUND') {
      errors.push({ cityId, reason: `Failed to read existing data: ${err?.message}` });
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
      changes.push({ cityId, field: `transport.${field}`, oldValue: oldVal, newValue: newVal, pctChange });
    }
  }

  if (!opts.dryRun && changes.length > 0) {
    const updatedData = oldData ?? createCitySeed({ id: 'vancouver', name: { ko: '밴쿠버', en: 'Vancouver' }, country: 'CA', currency: 'CAD', region: 'na' });
    updatedData.transport = { ...updatedData.transport, ...newTransport };

    try {
      await writeCity(cityId, updatedData, SOURCE);
    } catch (err) {
      errors.push({ cityId, reason: `Write failed: ${err?.message ?? 'unknown'}` });
    }
  }

  return {
    source: 'ca_translink',
    cities: changes.length > 0 ? [cityId] : [],
    fields,
    changes,
    errors,
  };
}

