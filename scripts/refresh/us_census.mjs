/**
 * scripts/refresh/us_census.mjs
 *
 * US Census ACS (American Community Survey) → 5개 미국 도시 rent 교차 검증용.
 *
 * 출처: US Census Bureau ACS 5-Year Estimates
 * API: https://api.census.gov/data/{ACS_YEAR}/acs/acs5 (현재 ACS_YEAR=2024)
 * API 키: `US_CENSUS_API_KEY` 필요.
 *
 * 방법: B25064 median gross rent by MSA.
 *
 * **결과 필드 — `rent.censusMedian` (cross-validation only)**:
 *   - HUD FMR(`us_hud.mjs`) 과 비교용 보조 데이터. **compare UI 에는 노출되지 않음**
 *     (`isCostKey` / `iterNumericFields` 가 추적 X — 비교 카드 항목은 share/studio/oneBed/twoBed 만).
 *   - `_outlier.mjs::iterNumericFields` 가 의도적으로 추적하지 않음 — outlier PR 트리거 X.
 *     운영자는 `auto-update` PR 의 diff 에서 censusMedian 가 HUD 결과와 크게 어긋나면 수동 검토.
 *   - 단독 rent 소스로는 미사용 — `us_hud.mjs` 가 권위, censusMedian 은 sanity check.
 *
 * 워크플로우: refresh-rent.yml 에서 us_hud 다음 step 으로 실행 (key 있을 때만).
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage, createMissingApiKeyError } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

// ACS 5-Year Estimates 는 매년 12월에 직전 연도 dataset 이 공개된다 (예: 2024 dataset → 2025-12 공개).
// 본 상수는 운영자가 매년 1회 수동 갱신해야 한다 — Census API 가 미래 연도에 대해 redirect 가 아니라
// 4xx 를 반환하므로 자동 fallback 은 위험. CHANGELOG/AUTOMATION.md 의 "연 1회 ACS_YEAR 갱신" 항목 참조.
const ACS_YEAR = 2024;
const CENSUS_API_BASE = `https://api.census.gov/data/${ACS_YEAR}/acs/acs5`;

export const CITY_CONFIGS = {
  nyc: {
    id: 'nyc',
    name: { ko: '뉴욕', en: 'New York' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    cbsaCode: '35620',
  },
  la: {
    id: 'la',
    name: { ko: '로스앤젤레스', en: 'Los Angeles' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    cbsaCode: '31080',
  },
  sf: {
    id: 'sf',
    name: { ko: '샌프란시스코', en: 'San Francisco' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    cbsaCode: '41860',
  },
  seattle: {
    id: 'seattle',
    name: { ko: '시애틀', en: 'Seattle' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    cbsaCode: '42660',
  },
  boston: {
    id: 'boston',
    name: { ko: '보스턴', en: 'Boston' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    cbsaCode: '14460',
  },
};

export const SOURCE = {
  category: 'rent',
  name: 'US Census ACS 5-Year Median Gross Rent (cross-validation)',
  url: 'https://www.census.gov/programs-surveys/acs',
};

/**
 * Census ACS 응답 파싱. [[B25064_001E, NAME], [value, name], ...].
 * @param {unknown} data
 * @returns {number|null}
 */
export function parseCensusResponse(data) {
  if (!Array.isArray(data) || data.length < 2) return null;

  const valueRow = data[1];
  if (!Array.isArray(valueRow) || valueRow.length < 1) return null;

  const value = parseFloat(valueRow[0]);
  if (Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  return null;
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * Census ACS → 5개 미국 도시 rent 교차 검증.
 * @param {{dryRun?: boolean, cities?: string[]}} [opts]
 * @returns {Promise<RefreshResult>}
 */
export default async function refresh(opts = {}) {
  const errors = [];
  const changes = [];
  const fields = [];
  const updatedCities = [];

  // ACS 5-Year Estimates 는 매년 12월에 직전 연도 dataset 이 공개됨 (예: 2024 dataset → 2025-12 공개).
  // 갱신 필요 시점에 즉시 경고하기 위해 월(month) 까지 고려:
  //   - 12월 공개 후 (current month >= 11): 기대 ACS_YEAR = currentYear - 1
  //   - 그 외:                              기대 ACS_YEAR = currentYear - 2 (직전 연도 12월 공개분)
  // ACS_YEAR < 기대값 이면 운영자가 갱신 누락. 단순 `currentYear - ACS_YEAR > 2` 는 12월 공개 직후
  // ~1년 동안 침묵 → 갱신 알림이 늦음.
  // 표면화 채널: console.warn (워크플로우 로그) + errors[] (RefreshResult 에 포함되어 PR body 에
  // 노출). 두 채널 모두 적용해 운영자가 stale 상태를 놓치지 않게 한다.
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();
  const expectedAcsYear = currentMonth >= 11 ? currentYear - 1 : currentYear - 2;
  if (ACS_YEAR < expectedAcsYear) {
    const reason = `ACS_YEAR(${ACS_YEAR}) is stale — Census ACS 5-Year ${currentYear - 1} dataset 이 공개돼 있을 가능성. us_census.mjs 의 ACS_YEAR 상수 갱신 필요 (AUTOMATION.md §10).`;
    console.warn(`::warning::${reason}`);
    errors.push({ cityId: 'all', reason });
  }

  const apiKey = process.env.US_CENSUS_API_KEY;
  if (!apiKey) {
    throw createMissingApiKeyError('US_CENSUS_API_KEY environment variable is required');
  }

  const targetCities = opts.cities ?? Object.keys(CITY_CONFIGS);

  for (const cityId of targetCities) {
    const config = CITY_CONFIGS[cityId];
    if (!config) {
      errors.push({ cityId, reason: `Unknown city: ${cityId}` });
      continue;
    }

    let medianRent;
    try {
      // Census API 는 GET-only — `key` 를 query param 외 다른 곳으로 옮길 수 없다 (ADR-032 공공 API 제약).
      // `fetchWithRetry` 가 던지는 에러는 `redactSecretsInUrl` 가 `key=...` 를 마스킹하므로 에러 로그 안전.
      // 단 `ACTIONS_STEP_DEBUG=true` (GitHub Actions debug 모드) 활성화 시 워크플로우 runner 가 fetch
      // 명령 자체를 stderr 에 dump 할 수 있어 URL 가 노출될 수 있다 — Census API 키는 무료·공공 키라
      // 위험도는 낮으나, 디버깅 시 의도적으로 활성화해야 한다는 점을 운영자가 인지해야 한다.
      const url = `${CENSUS_API_BASE}?get=B25064_001E,NAME&for=metropolitan%20statistical%20area/micropolitan%20statistical%20area:${config.cbsaCode}&key=${apiKey}`;
      const response = await fetchWithRetry(url);
      const data = await response.json();
      medianRent = parseCensusResponse(data);
    } catch (err) {
      errors.push({
        cityId,
        reason: `Census API fetch failed: ${redactErrorMessage(String(err?.message ?? 'unknown'))}`,
      });
      continue;
    }

    if (medianRent === null) {
      errors.push({ cityId, reason: 'No median rent data found in Census response' });
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

    const oldMedianRent = oldData?.rent?.censusMedian ?? null;
    let hasChanges = false;

    if (oldMedianRent !== medianRent) {
      fields.push('censusMedian');
      const pctChange = computePctChange(oldMedianRent, medianRent);
      changes.push({ cityId, field: 'rent.censusMedian', oldValue: oldMedianRent, newValue: medianRent, pctChange });
      hasChanges = true;
    }

    if (!opts.dryRun && hasChanges) {
      const base = oldData ?? createCitySeed(config);
      const updatedData = {
        ...base,
        rent: { ...base.rent, censusMedian: medianRent },
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
    source: 'us_census',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}
