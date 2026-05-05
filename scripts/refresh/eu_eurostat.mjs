/**
 * scripts/refresh/eu_eurostat.mjs
 *
 * EU Eurostat → EU 도시 fallback 데이터 (베를린, 뮌헨, 파리, 암스테르담).
 *
 * 출처: Eurostat (European Statistical Office)
 * API: https://ec.europa.eu/eurostat/api/
 * 키: 불필요 (공개 API)
 *
 * **v1.0 상태 (PR #20 review round 11)**: 라이브러리 모듈 골조만 존재 — `de_destatis` /
 * `fr_insee` / `nl_cbs` 어디서도 본 모듈을 import 하지 않으므로 실제 fallback 동작 0.
 * `_run.mjs::LIBRARY_MODULES` 가 단독 실행을 차단하고 `integration.test.ts` 가 워크플로우에서
 * `_run.mjs eu_eurostat` 호출 라인이 들어오지 않는지 검증한다.
 *
 * **v1.x 계획**:
 * - 각 국가 fetcher 가 본 모듈을 import 해 fallback 으로 사용 (de_destatis 응답 실패 시
 *   Eurostat HICP 로 보정한 값 반환).
 * - 단위/스케일 검증 후 wire up (jp_estat 와 동일한 패턴).
 *
 * 의도된 용도 (구현 시):
 * - Eurostat HICP (Harmonised Index of Consumer Prices) 기반 EU 평균 대비 국가별 보정
 * - 각 국가 스크립트가 주요 출처, 본 스크립트는 보조용
 */

import { fetchWithRetry, redactErrorMessage } from './_common.mjs';

const EUROSTAT_API_BASE = 'https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data';

export const EU_COUNTRIES = ['DE', 'FR', 'NL'];

export const EU_CITIES = {
  DE: ['berlin', 'munich'],
  FR: ['paris'],
  NL: ['amsterdam'],
};

export const EUROSTAT_DATASETS = {
  hicp: 'prc_hicp_aind',
  rent: 'prc_hpi_a',
};

// PR #20 review round 23 — `validate_cities.mjs::validCategories` 는 ['rent','food','transport','tuition','tax','visa'].
// 본 모듈은 v1.x 에서 de_destatis / fr_insee / nl_cbs 의 rent fallback 으로 wire-up 될 예정이므로
// 'rent' 로 통일. 추후 HICP (소비자물가) 를 food fallback 으로도 쓸 경우, 호출 측이 카테고리별
// 별도 SOURCE 객체로 분리해 writeCity 에 넘긴다 (vn_gso 가 SOURCE_RENT/FOOD/TRANSPORT 분리한 패턴).
export const SOURCE = {
  category: 'rent',
  name: 'Eurostat HICP + HPI (EU fallback)',
  url: 'https://ec.europa.eu/eurostat/data/database',
};

/**
 * Eurostat API 상태 체크.
 * @returns {Promise<boolean>}
 */
export async function checkEurostatStatus() {
  const url = `${EUROSTAT_API_BASE}/${EUROSTAT_DATASETS.hicp}?format=JSON&geo=EU27_2020&lastNObservations=1`;
  try {
    const response = await fetchWithRetry(url, { timeoutMs: 15000 });
    // reachability check 만 필요 — body 미사용. undici keep-alive 연결 점유 방지
    // (vn_gso::checkGsoStatus / visas::fetchVisaFees 동일 패턴, PR #20 review round 13).
    await response.body?.cancel().catch(() => {});
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Eurostat JSON-stat 응답 파싱.
 * @param {unknown} data
 * @returns {Map<string, number>} country → index value
 */
export function parseEurostatResponse(data) {
  const result = new Map();
  if (!data || typeof data !== 'object') return result;

  const values = data.value;
  const dimensions = data.dimension;
  if (!values || !dimensions) return result;

  const geoIndex = dimensions.geo?.category?.index;
  const geoLabels = dimensions.geo?.category?.label;
  if (!geoIndex || !geoLabels) return result;

  for (const [country, idx] of Object.entries(geoIndex)) {
    const value = values[idx];
    if (Number.isFinite(value) && value > 0) {
      result.set(country, value);
    }
  }

  return result;
}

/**
 * Eurostat HICP 데이터 fetch.
 * @param {string[]} countries
 * @returns {Promise<Map<string, number>>}
 */
async function fetchHicpData(countries) {
  const geoParam = countries.join('+');
  const url = `${EUROSTAT_API_BASE}/${EUROSTAT_DATASETS.hicp}?format=JSON&geo=${geoParam}&lastNObservations=1`;

  // CLAUDE.md "silent fail 금지" 준수 (PR #20 review round 22) — fetch / 파싱 실패 시 throw 하여
  // caller 가 errors[] 에 명시 기록할 수 있게 함. 과거 catch { return new Map(); } 는 데이터
  // 부재와 fetch 실패를 caller 가 구분하지 못해 v1.x wire-up 시 silent data corruption 위험.
  const response = await fetchWithRetry(url, {
    headers: { Accept: 'application/json' },
  });
  const data = await response.json();
  return parseEurostatResponse(data);
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * Eurostat → EU 도시 fallback 데이터 조회.
 * 이 스크립트는 파일을 직접 갱신하지 않고, fallback 데이터만 반환.
 * 각 국가 스크립트에서 필요시 호출.
 *
 * **Defense-in-depth (PR #20 review round 16 + 20)**: `_run.mjs` 의 LIBRARY_MODULES 가 단독
 * 실행을 1차 차단한다. LIBRARY_MODULES 갱신 누락 시 `_run.mjs` 가 본 default export 를 호출하면
 * 본 entry guard 가 throw → `_run.mjs` catch 가 process.exit(1) → 워크플로우 fail (잘못된 로그
 * 출력보다 더 강한 보호). process.argv[1] (CLI runner 경로) 을 보고 직접 실행 케이스를 감지.
 *
 * @param {{dryRun?: boolean, countries?: string[]}} [opts]
 * @returns {Promise<RefreshResult>}
 */
export default async function refresh(opts = {}) {
  const runner = process.argv[1] ?? '';
  if (runner.endsWith('_run.mjs')) {
    throw new Error(
      'eu_eurostat is a library module — must be imported by a country-specific fetcher (de_destatis / fr_insee / nl_cbs), not invoked via _run.mjs. v1.x: actual wire-up.',
    );
  }

  const errors = [];
  const changes = [];
  const fields = [];
  const updatedCities = [];

  const targetCountries = opts.countries ?? EU_COUNTRIES;

  const eurostatAvailable = await checkEurostatStatus();
  if (!eurostatAvailable) {
    errors.push({
      cityId: 'all',
      reason: 'Eurostat API unavailable, fallback data not fetched',
    });
    return {
      source: 'eu_eurostat',
      cities: [],
      fields: [],
      changes: [],
      errors,
    };
  }

  let hicpData;
  try {
    hicpData = await fetchHicpData(targetCountries);
  } catch (err) {
    // PR #20 review round 22 — fetchHicpData silent fail 제거 후 caller 처리.
    errors.push({
      cityId: 'all',
      reason: `Eurostat HICP fetch failed: ${redactErrorMessage(String(err?.message ?? 'unknown'))}`,
    });
    return {
      source: 'eu_eurostat',
      cities: [],
      fields: [],
      changes: [],
      errors,
    };
  }

  for (const country of targetCountries) {
    const hicpValue = hicpData.get(country);
    if (hicpValue !== undefined) {
      const cities = EU_CITIES[country] ?? [];
      for (const cityId of cities) {
        fields.push('hicp');
        changes.push({
          cityId,
          field: 'eurostat.hicp',
          oldValue: null,
          newValue: hicpValue,
          pctChange: 0,
        });
      }
      updatedCities.push(...cities);
    } else {
      errors.push({
        cityId: country,
        reason: `HICP data not available for ${country}`,
      });
    }
  }

  return {
    source: 'eu_eurostat',
    cities: [...new Set(updatedCities)],
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}
