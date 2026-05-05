/**
 * scripts/refresh/jp_transit.mjs
 *
 * 도쿄메트로 + 大阪Metro → 도쿄/오사카 transport 갱신.
 *
 * 출처: 도쿄메트로 + 大阪Metro 공식 fare 페이지
 * URL:
 *   - https://www.tokyometro.jp/en/ticket/
 *   - https://subway.osakametro.co.jp/en/guide/page/fare.php
 *
 * 방법:
 * - monthlyPass: 정기권 (1개월)
 * - singleRide: 기본 구간 1회권
 * - taxiBase: 일반택시 기본요금
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

export const CITY_CONFIGS = {
  tokyo: {
    id: 'tokyo',
    name: { ko: '도쿄', en: 'Tokyo' },
    country: 'JP',
    currency: 'JPY',
    region: 'asia',
  },
  osaka: {
    id: 'osaka',
    name: { ko: '오사카', en: 'Osaka' },
    country: 'JP',
    currency: 'JPY',
    region: 'asia',
  },
};

export const STATIC_TRANSPORT = {
  tokyo: {
    monthlyPass: 10600,
    singleRide: 180,
    taxiBase: 500,
  },
  osaka: {
    monthlyPass: 9600,
    singleRide: 180,
    taxiBase: 500,
  },
};

export const SOURCE = {
  category: 'transport',
  name: '東京メトロ + 大阪Metro + static estimates',
  url: 'https://www.tokyometro.jp/en/ticket/',
};

/**
 * Tokyo Metro API 상태 체크 (connectivity 확인용).
 * @returns {Promise<boolean>}
 */
export async function checkTokyoMetroStatus() {
  const url = 'https://www.tokyometro.jp/en/';
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
  const fares = STATIC_TRANSPORT[cityId] ?? STATIC_TRANSPORT.tokyo;
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
 * 도쿄메트로 + 大阪Metro → 도쿄/오사카 transport 갱신.
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
    apiAvailable = await checkTokyoMetroStatus();
    if (!apiAvailable) {
      errors.push({
        cityId: 'all',
        reason: 'Tokyo Metro site unavailable, using static values',
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
    source: 'jp_transit',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}
