/**
 * scripts/refresh/uk_tfl.mjs
 *
 * TfL (Transport for London) → 런던 transport 갱신.
 *
 * 출처: TfL 운임 안내 페이지 (정적 추정치) — https://tfl.gov.uk/fares/
 * Unified API (https://api.tfl.gov.uk/) 는 운행 상태 연결 확인 용도이며 운임 데이터 출처가 아니다 (ADR-076).
 *
 * 방법:
 * - monthlyPass: Zone 1-2 월정액 (7-day travelcard × 4.33)
 * - singleRide: Zone 1 peak fare (contactless/Oyster)
 * - taxiBase: black cab base fare (정적)
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage, hasLegacySourceName } from './_common.mjs';
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

// Unified API 는 운행 상태 연결 확인에만 쓰고 운임값은 STATIC_TRANSPORT 정적 상수다 —
// 출처명에 API 를 적으면 사실과 다르다 (ADR-076). 마커는 한국어 '(정적 추정치)' (ADR-070).
export const SOURCE = {
  category: 'transport',
  name: 'TfL 운임 안내 페이지 (정적 추정치)',
  url: 'https://tfl.gov.uk/fares/',
  legacyNames: ['TfL Unified API + static estimates'],
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
    // body 는 사용 안 함 — undici keep-alive 풀이 연결 점유하지 않도록 명시적으로 cancel.
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

    // 값 변동이 없어도 구 출처명이 남아 있으면 한 번은 써서 이름을 이전한다 (ADR-070).
    const needsSourceRename = hasLegacySourceName(oldData?.sources, SOURCE);

    if (!opts.dryRun && (hasChanges || needsSourceRename)) {
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
    } else if (hasChanges || needsSourceRename) {
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
