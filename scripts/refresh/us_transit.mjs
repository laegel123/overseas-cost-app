/**
 * scripts/refresh/us_transit.mjs
 *
 * 5개 미국 도시 교통 운임 → transport 갱신.
 *
 * 출처: 각 도시 공식 교통공사 페이지
 * - NYC: MTA (https://new.mta.info/fares)
 * - LA: LA Metro (https://www.metro.net/riding/fares/)
 * - SF: SFMTA (https://www.sfmta.com/fares)
 * - Seattle: King County Metro (https://kingcounty.gov/en/dept/metro/fares-and-payment)
 * - Boston: MBTA (https://www.mbta.com/fares)
 *
 * API 키 불필요 (공개 데이터).
 * 방법: HTML fetch + parse (정적 fallback 포함).
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const FETCH_TIMEOUT_MS = 15000;

export const CITY_CONFIGS = {
  nyc: {
    id: 'nyc',
    name: { ko: '뉴욕', en: 'New York' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    fareUrl: 'https://new.mta.info/fares',
    agency: 'MTA',
    staticFares: {
      singleRide: 2.90,
      monthlyPass: 132.00,
      taxiBase: 3.00,
    },
  },
  la: {
    id: 'la',
    name: { ko: '로스앤젤레스', en: 'Los Angeles' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    fareUrl: 'https://www.metro.net/riding/fares/',
    agency: 'LA Metro',
    staticFares: {
      singleRide: 1.75,
      monthlyPass: 100.00,
      taxiBase: 4.10,
    },
  },
  sf: {
    id: 'sf',
    name: { ko: '샌프란시스코', en: 'San Francisco' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    fareUrl: 'https://www.sfmta.com/fares',
    agency: 'SFMTA',
    staticFares: {
      singleRide: 3.00,
      monthlyPass: 81.00,
      taxiBase: 3.50,
    },
  },
  seattle: {
    id: 'seattle',
    name: { ko: '시애틀', en: 'Seattle' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    fareUrl: 'https://kingcounty.gov/en/dept/metro/fares-and-payment',
    agency: 'King County Metro',
    staticFares: {
      singleRide: 2.75,
      monthlyPass: 99.00,
      taxiBase: 2.60,
    },
  },
  boston: {
    id: 'boston',
    name: { ko: '보스턴', en: 'Boston' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    fareUrl: 'https://www.mbta.com/fares',
    agency: 'MBTA',
    staticFares: {
      singleRide: 2.40,
      monthlyPass: 90.00,
      taxiBase: 2.60,
    },
  },
};

/**
 * HTML 응답에서 운임 정보 파싱.
 * @param {string} html
 * @param {string} agency
 * @returns {{singleRide?: number, monthlyPass?: number}}
 */
export function parseFareHtml(html, agency) {
  const fares = {};

  const singleRidePatterns = [
    /\$(\d+\.?\d*)\s*(?:per ride|single fare|one ride|base fare)/i,
    /(?:single|base|adult)\s*(?:fare|ride)[^$]*\$(\d+\.?\d*)/i,
    /\$(\d+\.?\d*)\s*(?:subway|bus|metro)\s*fare/i,
  ];

  for (const pattern of singleRidePatterns) {
    const match = pattern.exec(html);
    if (match) {
      const value = parseFloat(match[1]);
      if (value > 0.5 && value < 10) {
        fares.singleRide = value;
        break;
      }
    }
  }

  const monthlyPassPatterns = [
    /(?:monthly|30-day)\s*(?:pass|unlimited)[^$]*\$(\d+\.?\d*)/i,
    /\$(\d+\.?\d*)\s*(?:monthly|30-day)\s*(?:pass|unlimited)/i,
    /unlimited\s*(?:ride|metro)[^$]*\$(\d+\.?\d*)/i,
  ];

  for (const pattern of monthlyPassPatterns) {
    const match = pattern.exec(html);
    if (match) {
      const value = parseFloat(match[1]);
      if (value > 30 && value < 300) {
        fares.monthlyPass = value;
        break;
      }
    }
  }

  return fares;
}

export const SOURCE = {
  category: 'transport',
  name: 'US Transit Agencies (MTA/LA Metro/SFMTA/King County Metro/MBTA)',
  url: 'https://www.transit.dot.gov/',
};

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * US Transit → 5개 미국 도시 transport 갱신.
 * @param {{dryRun?: boolean, cities?: string[], useStatic?: boolean}} [opts]
 * @returns {Promise<RefreshResult>}
 */
export default async function refresh(opts = {}) {
  const errors = [];
  const changes = [];
  const fields = [];
  const updatedCities = [];

  const targetCities = opts.cities ?? Object.keys(CITY_CONFIGS);

  for (const cityId of targetCities) {
    const config = CITY_CONFIGS[cityId];
    if (!config) {
      errors.push({ cityId, reason: `Unknown city: ${cityId}` });
      continue;
    }

    const newTransport = { ...config.staticFares };

    if (!opts.useStatic) {
      try {
        const response = await fetchWithRetry(config.fareUrl, { timeoutMs: FETCH_TIMEOUT_MS });
        const html = await response.text();
        if (html && html.length > 0) {
          const parsed = parseFareHtml(html, config.agency);
          // dryRun 시 파싱 결과 노출 — 정규식이 "Save $2.90 with EasyPay" 같은 할인 문구를
          // false-positive 매칭하는 케이스 디버깅 용도 (PR #20 review round 12).
          if (opts.dryRun) {
            console.log(
              `[us_transit] ${cityId} parsed: singleRide=${parsed.singleRide ?? 'null'} monthlyPass=${parsed.monthlyPass ?? 'null'} (static singleRide=${config.staticFares.singleRide}, monthlyPass=${config.staticFares.monthlyPass})`,
            );
          }
          if (parsed.singleRide) {
            newTransport.singleRide = parsed.singleRide;
          }
          if (parsed.monthlyPass) {
            newTransport.monthlyPass = parsed.monthlyPass;
          }
        }
      } catch (err) {
        errors.push({
          cityId,
          reason: `${config.agency} fare fetch failed, using static fallback: ${redactErrorMessage(String(err?.message ?? 'unknown'))}`,
        });
      }
    }

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

    const oldTransport = oldData?.transport ?? {};
    let hasChanges = false;

    for (const [field, newVal] of Object.entries(newTransport)) {
      const oldVal = oldTransport[field] ?? null;

      if (oldVal !== newVal) {
        fields.push(field);
        const pctChange = computePctChange(oldVal, newVal);
        changes.push({ cityId, field: `transport.${field}`, oldValue: oldVal, newValue: newVal, pctChange });
        hasChanges = true;
      }
    }

    if (!opts.dryRun && hasChanges) {
      const base = oldData ?? createCitySeed(config);
      const updatedData = { ...base, transport: { ...base.transport, ...newTransport } };

      try {
        await writeCity(cityId, updatedData, {
          category: 'transport',
          name: config.agency,
          url: config.fareUrl,
        });
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
    source: 'us_transit',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}
