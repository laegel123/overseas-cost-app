/**
 * scripts/refresh/sg_lta.mjs
 *
 * LTA (Land Transport Authority) → 싱가포르 transport 갱신.
 *
 * 출처: LTA DataMall fares
 * URL: https://www.lta.gov.sg/content/ltagov/en/getting_around/public_transport/fares_payment_methods.html
 * API: https://datamall.lta.gov.sg/ (키 필요: SG_DATA_GOV_KEY)
 *
 * 방법:
 * - monthlyPass: Adult Monthly Pass
 * - singleRide: Basic fare (up to 3.2km)
 * - taxiBase: Taxi flag-down fare
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const LTA_FARES_URL = 'https://www.lta.gov.sg/content/ltagov/en/getting_around/public_transport/fares_payment_methods.html';

export const CITY_CONFIGS = {
  singapore: {
    id: 'singapore',
    name: { ko: '싱가포르', en: 'Singapore' },
    country: 'SG',
    currency: 'SGD',
    region: 'asia',
    transitOperator: 'LTA',
    fareUrl: LTA_FARES_URL,
  },
};

export const STATIC_TRANSPORT = {
  monthlyPass: 128,
  singleRide: 1.19,
  taxiBase: 4.00,
};

export const SOURCE = {
  category: 'transport',
  name: 'LTA Public Transport Fares + static estimates',
  url: LTA_FARES_URL,
};

/**
 * LTA fare 페이지 상태 체크.
 * @returns {Promise<boolean>}
 */
export async function checkLtaFarePage() {
  try {
    const response = await fetchWithRetry(LTA_FARES_URL, { timeoutMs: 10000 });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 도시별 transport fares 조회.
 * @returns {{monthlyPass: number, singleRide: number, taxiBase: number}}
 */
export function getTransportFares() {
  return { ...STATIC_TRANSPORT };
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * LTA → 싱가포르 transport 갱신.
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
    pageAvailable = await checkLtaFarePage();
    if (!pageAvailable) {
      errors.push({
        cityId: 'all',
        reason: 'LTA fare page unavailable, using static values',
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
    source: 'sg_lta',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}
