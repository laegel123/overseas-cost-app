/**
 * scripts/refresh/fr_ratp.mjs
 *
 * RATP (Régie Autonome des Transports Parisiens) → 파리 transport 갱신.
 *
 * 출처: RATP fare 공식 페이지
 * URL: https://www.ratp.fr/en/titres-et-tarifs
 *
 * 방법:
 * - monthlyPass: Navigo 월정액 (zone 1-5)
 * - singleRide: t+ ticket 1회권
 * - taxiBase: 파리 택시 기본요금
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

export const CITY_CONFIGS = {
  paris: {
    id: 'paris',
    name: { ko: '파리', en: 'Paris' },
    country: 'FR',
    currency: 'EUR',
    region: 'eu',
    transitOperator: 'RATP',
    fareUrl: 'https://www.ratp.fr/en/titres-et-tarifs',
  },
};

export const STATIC_TRANSPORT = {
  monthlyPass: 86.40,
  singleRide: 2.15,
  taxiBase: 4.18,
};

export const SOURCE = {
  category: 'transport',
  name: 'RATP official fares + static estimates',
  url: 'https://www.ratp.fr/en/titres-et-tarifs',
};

/**
 * transport 데이터 반환 (현재 정적).
 * @returns {{monthlyPass: number, singleRide: number, taxiBase: number}}
 */
export function getTransportData() {
  return {
    monthlyPass: STATIC_TRANSPORT.monthlyPass,
    singleRide: STATIC_TRANSPORT.singleRide,
    taxiBase: STATIC_TRANSPORT.taxiBase,
  };
}

/**
 * RATP fare 페이지 확인 (connectivity 체크용).
 * @returns {Promise<boolean>}
 */
export async function checkRatpFarePage() {
  try {
    const response = await fetchWithRetry('https://www.ratp.fr/en/titres-et-tarifs', { timeoutMs: 10000 });
    // reachability check 만 필요 — body 미사용. undici keep-alive 연결 점유 방지 (PR #20 review round 23).
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
 * RATP → 파리 transport 갱신.
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
    const pageAvailable = await checkRatpFarePage();
    if (!pageAvailable) {
      errors.push({
        cityId: 'paris',
        reason: 'RATP fare page unavailable, using static values',
      });
    }
  }

  const newTransport = getTransportData();

  for (const cityId of targetCities) {
    const config = CITY_CONFIGS[cityId];
    if (!config) {
      errors.push({ cityId, reason: `Unknown city: ${cityId}` });
      continue;
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
    source: 'fr_ratp',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}
