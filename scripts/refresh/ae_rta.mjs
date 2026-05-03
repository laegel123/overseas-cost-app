/**
 * scripts/refresh/ae_rta.mjs
 *
 * RTA (Roads and Transport Authority) → 두바이 transport 갱신.
 *
 * 출처: RTA 공식 fare 페이지
 * URL: https://www.rta.ae/wps/portal/rta/ae/home/fares-and-payment
 *
 * 방법:
 * - monthlyPass: RTA Silver/Gold 정기권
 * - singleRide: Nol 기본 요금
 * - taxiBase: Dubai Taxi 기본요금
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const RTA_FARES_URL = 'https://www.rta.ae/wps/portal/rta/ae/home/fares-and-payment';

export const CITY_CONFIGS = {
  dubai: {
    id: 'dubai',
    name: { ko: '두바이', en: 'Dubai' },
    country: 'AE',
    currency: 'AED',
    region: 'me',
    transitOperator: 'RTA',
    fareUrl: RTA_FARES_URL,
  },
};

export const STATIC_TRANSPORT = {
  monthlyPass: 350,
  singleRide: 4.00,
  taxiBase: 12.00,
};

export const SOURCE = {
  category: 'transport',
  name: 'RTA Public Transport Fares + static estimates',
  url: RTA_FARES_URL,
};

/**
 * RTA fare 페이지 상태 체크.
 * @returns {Promise<boolean>}
 */
export async function checkRtaFarePage() {
  try {
    const response = await fetchWithRetry(RTA_FARES_URL, { timeoutMs: 10000 });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * transport fares 조회.
 * @returns {{monthlyPass: number, singleRide: number, taxiBase: number}}
 */
export function getTransportFares() {
  return { ...STATIC_TRANSPORT };
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * RTA → 두바이 transport 갱신.
 * @param {{dryRun?: boolean, cities?: string[], useStatic?: boolean}} [opts]
 * @returns {Promise<RefreshResult>}
 */
export default async function refresh(opts = {}) {
  const errors = [];
  const changes = [];
  const fields = [];
  const updatedCities = [];

  const targetCities = opts.cities ?? Object.keys(CITY_CONFIGS);

  let pageAvailable = false;
  if (!opts.useStatic) {
    pageAvailable = await checkRtaFarePage();
    if (!pageAvailable) {
      errors.push({
        cityId: 'all',
        reason: 'RTA fare page unavailable, using static values',
      });
    }
  }

  for (const cityId of targetCities) {
    const config = CITY_CONFIGS[cityId];
    if (!config) {
      errors.push({ cityId, reason: `Unknown city: ${cityId}` });
      continue;
    }

    const newTransport = getTransportFares();

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
    source: 'ae_rta',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}
