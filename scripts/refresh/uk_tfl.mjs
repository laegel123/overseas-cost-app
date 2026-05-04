/**
 * scripts/refresh/uk_tfl.mjs
 *
 * TfL (Transport for London) → 런던 transport 갱신.
 *
 * 출처: TfL Unified API
 * API: https://api.tfl.gov.uk/ (JSON, 키 불필요)
 *
 * 방법:
 * - monthlyPass: Zone 1-2 월정액 (7-day travelcard × 4.33)
 * - singleRide: Zone 1 peak fare (contactless/Oyster)
 * - taxiBase: black cab base fare (정적)
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const TFL_API_BASE = 'https://api.tfl.gov.uk';

export const CITY_CONFIGS = {
  london: {
    id: 'london',
    name: { ko: '런던', en: 'London' },
    country: 'GB',
    currency: 'GBP',
    region: 'eu',
  },
};

export const STATIC_TRANSPORT = {
  monthlyPass: 165.00,
  singleRide: 2.80,
  taxiBase: 3.80,
};

export const SOURCE = {
  category: 'transport',
  name: 'TfL Unified API + static estimates',
  url: 'https://tfl.gov.uk/fares/',
};

/**
 * TfL fare 페이지 파싱 (현재 정적 fallback 사용).
 * TfL API 는 운행 상태 위주라 fare 정보는 정적 값 사용.
 * @returns {{monthlyPass: number, singleRide: number, taxiBase: number}}
 */
export function getTransportFares() {
  return {
    monthlyPass: STATIC_TRANSPORT.monthlyPass,
    singleRide: STATIC_TRANSPORT.singleRide,
    taxiBase: STATIC_TRANSPORT.taxiBase,
  };
}

/**
 * TfL API 상태 체크 (connectivity 확인용).
 * @returns {Promise<boolean>}
 */
export async function checkTflApiStatus() {
  const url = `${TFL_API_BASE}/Line/Mode/tube/Status`;
  try {
    const response = await fetchWithRetry(url, { timeoutMs: 10000 });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * TfL → 런던 transport 갱신.
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
    apiAvailable = await checkTflApiStatus();
    if (!apiAvailable) {
      errors.push({
        cityId: 'london',
        reason: 'TfL API unavailable, using static values',
      });
    }
  }

  const newTransport = getTransportFares();

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
    source: 'uk_tfl',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}
