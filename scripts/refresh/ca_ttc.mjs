/**
 * scripts/refresh/ca_ttc.mjs
 *
 * TTC (Toronto Transit Commission) 운임 정보 → toronto.transport 갱신.
 *
 * 출처: TTC fare 공식 페이지
 * URL: https://www.ttc.ca/Fares-and-passes
 * API 키 불필요 (공개 데이터).
 *
 * 방법: HTML fetch + parse (정적 fallback 포함).
 */

import { readCity, writeCity, createCitySeed} from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const TTC_FARE_URL = 'https://www.ttc.ca/Fares-and-passes';
const FETCH_TIMEOUT_MS = 15000;

export const STATIC_FARES = {
  singleRide: 3.5,
  monthlyPass: 156.3,
  taxiBase: 4.75,
};

export const SOURCE = {
  category: 'transport',
  name: 'TTC (Toronto Transit Commission)',
  url: 'https://www.ttc.ca/',
};

/**
 * HTML 응답에서 운임 정보 파싱.
 * @param {string} html
 * @returns {{singleRide?: number, monthlyPass?: number}}
 */
export function parseFareHtml(html) {
  const fares = {};

  const singleRidePatterns = [
    /Adult\s*(?:Cash\s*)?Fare[^$]*\$(\d+\.?\d*)/i,
    /PRESTO[^$]*\$(\d+\.?\d*)/i,
    /Single\s*Ride[^$]*\$(\d+\.?\d*)/i,
  ];

  for (const pattern of singleRidePatterns) {
    const match = pattern.exec(html);
    if (match) {
      const value = parseFloat(match[1]);
      if (value > 1 && value < 10) {
        fares.singleRide = value;
        break;
      }
    }
  }

  const monthlyPassPatterns = [
    /Monthly\s*Pass[^$]*\$(\d+\.?\d*)/i,
    /Adult\s*Monthly[^$]*\$(\d+\.?\d*)/i,
    /TTC\s*Monthly[^$]*\$(\d+\.?\d*)/i,
  ];

  for (const pattern of monthlyPassPatterns) {
    const match = pattern.exec(html);
    if (match) {
      const value = parseFloat(match[1]);
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
 * TTC 운임 → toronto.transport 갱신.
 * @param {{dryRun?: boolean, useStatic?: boolean}} [opts]
 * @returns {Promise<RefreshResult>}
 */
export default async function refresh(opts = {}) {
  const errors = [];
  const newTransport = { ...STATIC_FARES };
  const cityId = 'toronto';

  if (!opts.useStatic) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const response = await fetch(TTC_FARE_URL, { signal: controller.signal });
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
        reason: `TTC fare fetch failed, using static fallback: ${err?.message ?? 'unknown'}`,
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
    const updatedData = oldData ?? createCitySeed({ id: 'toronto', name: { ko: '토론토', en: 'Toronto' }, country: 'CA', currency: 'CAD', region: 'na' });
    updatedData.transport = { ...updatedData.transport, ...newTransport };

    try {
      await writeCity(cityId, updatedData, SOURCE);
    } catch (err) {
      errors.push({ cityId, reason: `Write failed: ${err?.message ?? 'unknown'}` });
    }
  }

  return {
    source: 'ca_ttc',
    cities: changes.length > 0 ? [cityId] : [],
    fields,
    changes,
    errors,
  };
}

