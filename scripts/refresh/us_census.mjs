/**
 * scripts/refresh/us_census.mjs
 *
 * US Census ACS (American Community Survey) → 5개 미국 도시 rent 교차 검증용.
 *
 * 출처: US Census Bureau ACS 5-Year Estimates
 * API: https://api.census.gov/data/2022/acs/acs5
 * API 키: `US_CENSUS_API_KEY` 필요.
 *
 * 방법: B25064 median gross rent by MSA.
 * HUD FMR 과 교차 검증 용도. 단독 rent 소스로는 미사용.
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage, createMissingApiKeyError } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const CENSUS_API_BASE = 'https://api.census.gov/data/2022/acs/acs5';

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
