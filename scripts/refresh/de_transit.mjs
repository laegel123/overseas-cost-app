/**
 * scripts/refresh/de_transit.mjs
 *
 * BVG (Berlin) + MVV (Munich) → 베를린 + 뮌헨 transport 갱신.
 *
 * 출처:
 * - BVG: https://www.bvg.de/en/tickets-fares
 * - MVV: https://www.mvv-muenchen.de/en/tickets-fares/
 *
 * 방법:
 * - monthlyPass: AB 구역 월정액
 * - singleRide: AB 구역 1회권
 * - taxiBase: 기본 요금
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

export const CITY_CONFIGS = {
  berlin: {
    id: 'berlin',
    name: { ko: '베를린', en: 'Berlin' },
    country: 'DE',
    currency: 'EUR',
    region: 'eu',
    transitOperator: 'BVG',
    fareUrl: 'https://www.bvg.de/en/tickets-fares',
  },
  munich: {
    id: 'munich',
    name: { ko: '뮌헨', en: 'Munich' },
    country: 'DE',
    currency: 'EUR',
    region: 'eu',
    transitOperator: 'MVV',
    fareUrl: 'https://www.mvv-muenchen.de/en/tickets-fares/',
  },
};

export const STATIC_TRANSPORT = {
  berlin: {
    monthlyPass: 86.00,
    singleRide: 3.20,
    taxiBase: 4.00,
  },
  munich: {
    monthlyPass: 63.20,
    singleRide: 3.70,
    taxiBase: 4.70,
  },
};

export const SOURCE = {
  category: 'transport',
  name: 'BVG/MVV official fares + static estimates',
  url: 'https://www.bvg.de/en/tickets-fares',
};

/**
 * 도시별 transport 데이터 반환.
 * @param {string} cityId
 * @returns {{monthlyPass: number, singleRide: number, taxiBase: number}}
 */
export function getTransportForCity(cityId) {
  return STATIC_TRANSPORT[cityId] ?? STATIC_TRANSPORT.berlin;
}

/**
 * BVG fare 페이지 확인 (connectivity 체크용).
 * @returns {Promise<boolean>}
 */
export async function checkBvgFarePage() {
  try {
    const response = await fetchWithRetry('https://www.bvg.de/en/tickets-fares', { timeoutMs: 10000 });
    // reachability check 만 필요 — body 미사용. undici keep-alive 연결 점유 방지.
    await response.body?.cancel().catch(() => {});
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * MVV fare 페이지 확인 (connectivity 체크용).
 * @returns {Promise<boolean>}
 */
export async function checkMvvFarePage() {
  try {
    const response = await fetchWithRetry('https://www.mvv-muenchen.de/en/tickets-fares/', { timeoutMs: 10000 });
    // reachability check 만 필요 — body 미사용. undici keep-alive 연결 점유 방지.
    await response.body?.cancel().catch(() => {});
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * BVG/MVV → 베를린 + 뮌헨 transport 갱신.
 * @param {{dryRun?: boolean, cities?: string[], useStatic?: boolean}} [opts]
 * @returns {Promise<RefreshResult>}
 */
export default async function refresh(opts = {}) {
  const errors = [];
  const changes = [];
  const fields = [];
  const updatedCities = [];

  const targetCities = opts.cities ?? Object.keys(CITY_CONFIGS);

  if (!opts.useStatic) {
    const [bvgOk, mvvOk] = await Promise.all([checkBvgFarePage(), checkMvvFarePage()]);
    if (!bvgOk) {
      errors.push({
        cityId: 'berlin',
        reason: 'BVG fare page unavailable, using static values',
      });
    }
    if (!mvvOk) {
      errors.push({
        cityId: 'munich',
        reason: 'MVV fare page unavailable, using static values',
      });
    }
  }

  for (const cityId of targetCities) {
    const config = CITY_CONFIGS[cityId];
    if (!config) {
      errors.push({ cityId, reason: `Unknown city: ${cityId}` });
      continue;
    }

    const newTransport = getTransportForCity(cityId);

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

      const citySource = {
        ...SOURCE,
        name: `${config.transitOperator} official fares + static estimates`,
        url: config.fareUrl,
      };

      try {
        await writeCity(cityId, updatedData, citySource);
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
    source: 'de_transit',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}
