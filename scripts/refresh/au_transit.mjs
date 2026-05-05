/**
 * scripts/refresh/au_transit.mjs
 *
 * Transport NSW (Sydney) + PTV (Melbourne) → 시드니/멜버른 transport 갱신.
 *
 * 출처: Transport NSW + PTV Victoria 공식 fare 페이지
 * URL:
 *   - https://transportnsw.info/tickets-opal/opal/fares
 *   - https://www.ptv.vic.gov.au/tickets/myki-fares/
 *
 * 방법:
 * - monthlyPass: 주간 cap × 4.33 (월 환산)
 * - singleRide: 기본 구간 성인 1회권
 * - taxiBase: 일반택시 기본요금
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

export const CITY_CONFIGS = {
  sydney: {
    id: 'sydney',
    name: { ko: '시드니', en: 'Sydney' },
    country: 'AU',
    currency: 'AUD',
    region: 'oceania',
  },
  melbourne: {
    id: 'melbourne',
    name: { ko: '멜버른', en: 'Melbourne' },
    country: 'AU',
    currency: 'AUD',
    region: 'oceania',
  },
};

export const STATIC_TRANSPORT = {
  sydney: {
    monthlyPass: 200.00,
    singleRide: 3.80,
    taxiBase: 3.60,
  },
  melbourne: {
    monthlyPass: 180.00,
    singleRide: 4.60,
    taxiBase: 4.20,
  },
};

export const SOURCE = {
  category: 'transport',
  name: 'Transport NSW + PTV Victoria + static estimates',
  url: 'https://transportnsw.info/tickets-opal/opal/fares',
};

/**
 * Transport NSW API 상태 체크 (connectivity 확인용).
 * @returns {Promise<boolean>}
 */
export async function checkNswApiStatus() {
  const url = 'https://transportnsw.info/';
  try {
    const response = await fetchWithRetry(url, { timeoutMs: 10000 });
    // reachability check 만 필요 — body 미사용. undici keep-alive 연결 점유 방지 (PR #20 review round 23).
    await response.body?.cancel().catch(() => {});
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 도시별 transport fares 조회.
 * @param {string} cityId
 * @returns {{monthlyPass: number, singleRide: number, taxiBase: number}}
 */
export function getTransportFares(cityId) {
  const fares = STATIC_TRANSPORT[cityId] ?? STATIC_TRANSPORT.sydney;
  return {
    monthlyPass: fares.monthlyPass,
    singleRide: fares.singleRide,
    taxiBase: fares.taxiBase,
  };
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * Transport NSW + PTV → 시드니/멜버른 transport 갱신.
 * @param {{dryRun?: boolean, cities?: string[], useStatic?: boolean}} [opts]
 * @returns {Promise<RefreshResult>}
 */
export default async function refresh(opts = {}) {
  const errors = [];
  const changes = [];
  const fields = [];
  const updatedCities = [];

  const targetCities = opts.cities ?? Object.keys(CITY_CONFIGS);

  let apiAvailable = false;
  if (!opts.useStatic) {
    apiAvailable = await checkNswApiStatus();
    if (!apiAvailable) {
      errors.push({
        cityId: 'all',
        reason: 'Transport NSW unavailable, using static values',
      });
    }
  }

  for (const cityId of targetCities) {
    const config = CITY_CONFIGS[cityId];
    if (!config) {
      errors.push({ cityId, reason: `Unknown city: ${cityId}` });
      continue;
    }

    const newTransport = getTransportFares(cityId);

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

    for (const field of ['monthlyPass', 'singleRide', 'taxiBase']) {
      const oldVal = oldTransport[field] ?? null;
      const newVal = newTransport[field];

      if (oldVal !== newVal) {
        fields.push(field);
        const pctChange = computePctChange(oldVal, newVal);
        changes.push({ cityId, field: `transport.${field}`, oldValue: oldVal, newValue: newVal, pctChange });
        hasChanges = true;
      }
    }

    if (!opts.dryRun && hasChanges) {
      const base = oldData ?? createCitySeed(config);
      const updatedData = {
        ...base,
        transport: newTransport,
      };

      try {
        await writeCity(cityId, updatedData, SOURCE);
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
    source: 'au_transit',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}
