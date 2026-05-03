/**
 * scripts/refresh/eu_eurostat.mjs
 *
 * EU Eurostat → EU 도시 fallback 데이터 (베를린, 뮌헨, 파리, 암스테르담).
 *
 * 출처: Eurostat (European Statistical Office)
 * API: https://ec.europa.eu/eurostat/api/
 * 키: 불필요 (공개 API)
 *
 * 용도:
 * - 각 국가별 스크립트 (de_destatis, fr_insee, nl_cbs) 실패 시 fallback
 * - Eurostat HICP (Harmonised Index of Consumer Prices) 기반 보정
 *
 * 방법:
 * - EU 평균 CPI 대비 국가별 지수로 가격 보정
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

export const SOURCE = {
  category: 'fallback',
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

  try {
    const response = await fetchWithRetry(url, {
      headers: { Accept: 'application/json' },
    });
    const data = await response.json();
    return parseEurostatResponse(data);
  } catch {
    return new Map();
  }
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * Eurostat → EU 도시 fallback 데이터 조회.
 * 이 스크립트는 파일을 직접 갱신하지 않고, fallback 데이터만 반환.
 * 각 국가 스크립트에서 필요시 호출.
 *
 * @param {{dryRun?: boolean, countries?: string[]}} [opts]
 * @returns {Promise<RefreshResult>}
 */
export default async function refresh(opts = {}) {
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

  const hicpData = await fetchHicpData(targetCountries);

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
