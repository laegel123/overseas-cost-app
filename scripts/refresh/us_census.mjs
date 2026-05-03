/**
 * scripts/refresh/us_census.mjs
 *
 * US Census ACS (American Community Survey) → 5개 미국 도시 rent cross-validation.
 *
 * 출처: Census ACS 5-Year Estimates (median gross rent)
 * API: https://api.census.gov/data/2022/acs/acs5
 * API 키: US_CENSUS_API_KEY 필요.
 *
 * 방법: ACS B25064 (Aggregate Gross Rent) 또는 B25031 (Median Gross Rent by Bedrooms)
 * HUD FMR 과 교차 검증용. 두 출처 간 ±15% 이상 차이 시 경고.
 */

import { readCity, writeCity, fetchWithRetry, createMissingApiKeyError, createCitySeed} from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const CENSUS_ACS_BASE = 'https://api.census.gov/data/2023/acs/acs5';

export const CITY_CONFIGS = {
  nyc: {
    id: 'nyc',
    name: { ko: '뉴욕', en: 'New York' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    state: '36',
    county: '061',
  },
  la: {
    id: 'la',
    name: { ko: 'LA', en: 'Los Angeles' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    state: '06',
    county: '037',
  },
  sf: {
    id: 'sf',
    name: { ko: '샌프란시스코', en: 'San Francisco' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    state: '06',
    county: '075',
  },
  seattle: {
    id: 'seattle',
    name: { ko: '시애틀', en: 'Seattle' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    state: '53',
    county: '033',
  },
  boston: {
    id: 'boston',
    name: { ko: '보스턴', en: 'Boston' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    state: '25',
    county: '025',
  },
};

export const SOURCE = {
  category: 'rent',
  name: 'US Census ACS',
  url: 'https://www.census.gov/programs-surveys/acs',
};

export const ACS_VARIABLES = {
  medianGrossRent: 'B25064_001E',
  studio: 'B25031_002E',
  oneBed: 'B25031_003E',
  twoBed: 'B25031_004E',
};

export const STATIC_RENTS = {
  nyc: { studio: 2100, oneBed: 2300, twoBed: 2750 },
  la: { studio: 1600, oneBed: 1800, twoBed: 2300 },
  sf: { studio: 2250, oneBed: 2550, twoBed: 3150 },
  seattle: { studio: 1500, oneBed: 1700, twoBed: 2150 },
  boston: { studio: 1750, oneBed: 2050, twoBed: 2550 },
};

/**
 * Census ACS API 응답 파싱.
 * @param {unknown} data
 * @returns {{studio: number|null, oneBed: number|null, twoBed: number|null, medianGrossRent: number|null}}
 */
export function parseCensusResponse(data) {
  const result = { studio: null, oneBed: null, twoBed: null, medianGrossRent: null };

  if (!Array.isArray(data) || data.length < 2) return result;

  const headers = data[0];
  const values = data[1];

  const studioIdx = headers.indexOf(ACS_VARIABLES.studio);
  const oneBedIdx = headers.indexOf(ACS_VARIABLES.oneBed);
  const twoBedIdx = headers.indexOf(ACS_VARIABLES.twoBed);
  const medianIdx = headers.indexOf(ACS_VARIABLES.medianGrossRent);

  if (studioIdx >= 0) {
    const val = parseInt(values[studioIdx], 10);
    if (Number.isFinite(val) && val > 0) result.studio = val;
  }
  if (oneBedIdx >= 0) {
    const val = parseInt(values[oneBedIdx], 10);
    if (Number.isFinite(val) && val > 0) result.oneBed = val;
  }
  if (twoBedIdx >= 0) {
    const val = parseInt(values[twoBedIdx], 10);
    if (Number.isFinite(val) && val > 0) result.twoBed = val;
  }
  if (medianIdx >= 0) {
    const val = parseInt(values[medianIdx], 10);
    if (Number.isFinite(val) && val > 0) result.medianGrossRent = val;
  }

  return result;
}

/**
 * ACS 데이터를 rent 필드로 매핑. share = studio × 0.65 추정.
 * @param {{studio: number|null, oneBed: number|null, twoBed: number|null, medianGrossRent: number|null}} acsData
 * @returns {{share: number|null, studio: number|null, oneBed: number|null, twoBed: number|null}}
 */
export function mapToRent(acsData) {
  let studio = acsData.studio;
  let oneBed = acsData.oneBed;
  let twoBed = acsData.twoBed;

  if (studio === null && acsData.medianGrossRent !== null) {
    studio = Math.round(acsData.medianGrossRent * 0.95);
  }
  if (oneBed === null && acsData.medianGrossRent !== null) {
    oneBed = Math.round(acsData.medianGrossRent * 1.05);
  }
  if (twoBed === null && acsData.medianGrossRent !== null) {
    twoBed = Math.round(acsData.medianGrossRent * 1.35);
  }

  const share = studio !== null ? Math.round(studio * 0.65) : null;

  return { share, studio, oneBed, twoBed };
}

/**
 * HUD vs Census 교차 검증. ±15% 이상 차이 시 경고 반환.
 * @param {{studio: number|null, oneBed: number|null, twoBed: number|null}} hudRent
 * @param {{studio: number|null, oneBed: number|null, twoBed: number|null}} censusRent
 * @returns {string[]}
 */
export function crossValidate(hudRent, censusRent) {
  const warnings = [];
  const threshold = 0.15;

  for (const field of ['studio', 'oneBed', 'twoBed']) {
    const hud = hudRent[field];
    const census = censusRent[field];

    if (hud !== null && census !== null && hud > 0) {
      const diff = Math.abs(census - hud) / hud;
      if (diff > threshold) {
        warnings.push(`${field}: HUD=${hud}, Census=${census}, diff=${(diff * 100).toFixed(1)}%`);
      }
    }
  }

  return warnings;
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * Census ACS → 5개 미국 도시 rent cross-validation 갱신.
 * @param {{dryRun?: boolean, cities?: string[], useStatic?: boolean}} [opts]
 * @returns {Promise<RefreshResult>}
 */
export default async function refresh(opts = {}) {
  const errors = [];
  const changes = [];
  const fields = [];
  const updatedCities = [];

  const apiKey = process.env.US_CENSUS_API_KEY;
  if (!apiKey && !opts.useStatic) {
    throw createMissingApiKeyError('US_CENSUS_API_KEY environment variable is required');
  }

  const targetCities = opts.cities ?? Object.keys(CITY_CONFIGS);

  for (const cityId of targetCities) {
    const config = CITY_CONFIGS[cityId];
    if (!config) {
      errors.push({ cityId, reason: `Unknown city: ${cityId}` });
      continue;
    }

    let censusData;

    if (opts.useStatic) {
      const staticRent = STATIC_RENTS[cityId];
      censusData = staticRent
        ? { studio: staticRent.studio, oneBed: staticRent.oneBed, twoBed: staticRent.twoBed, medianGrossRent: null }
        : { studio: null, oneBed: null, twoBed: null, medianGrossRent: null };
    } else {
      try {
        const vars = Object.values(ACS_VARIABLES).join(',');
        const url = `${CENSUS_ACS_BASE}?get=${vars}&for=county:${config.county}&in=state:${config.state}&key=${apiKey}`;
        const response = await fetchWithRetry(url, { timeoutMs: 15000 });
        const data = await response.json();
        censusData = parseCensusResponse(data);

        if (censusData.studio === null && censusData.oneBed === null && censusData.twoBed === null && censusData.medianGrossRent === null) {
          const staticRent = STATIC_RENTS[cityId];
          if (staticRent) {
            errors.push({ cityId, reason: 'Census ACS returned no data, using static fallback' });
            censusData = { studio: staticRent.studio, oneBed: staticRent.oneBed, twoBed: staticRent.twoBed, medianGrossRent: null };
          } else {
            errors.push({ cityId, reason: 'Census ACS returned no data, no static fallback' });
            continue;
          }
        }
      } catch (err) {
        const staticRent = STATIC_RENTS[cityId];
        if (staticRent) {
          errors.push({ cityId, reason: `Census ACS fetch failed, using static fallback: ${err?.message}` });
          censusData = { studio: staticRent.studio, oneBed: staticRent.oneBed, twoBed: staticRent.twoBed, medianGrossRent: null };
        } else {
          errors.push({ cityId, reason: `Census ACS fetch failed: ${err?.message}` });
          continue;
        }
      }
    }

    const newRent = mapToRent(censusData);

    let oldData;
    try {
      oldData = await readCity(cityId);
    } catch (err) {
      if (err?.code !== 'CITY_NOT_FOUND') {
        errors.push({ cityId, reason: `Failed to read existing data: ${err?.message}` });
      }
    }

    if (oldData?.rent) {
      const warnings = crossValidate(oldData.rent, newRent);
      for (const warning of warnings) {
        errors.push({ cityId, reason: `Cross-validation warning: ${warning}` });
      }
    }

    const oldRent = oldData?.rent ?? {};
    let hasChanges = false;

    for (const field of ['share', 'studio', 'oneBed', 'twoBed']) {
      const oldVal = oldRent[field] ?? null;
      const newVal = newRent[field];

      if (oldVal !== newVal && newVal !== null) {
        fields.push(field);
        const pctChange = computePctChange(oldVal, newVal);
        changes.push({ cityId, field: `rent.${field}`, oldValue: oldVal, newValue: newVal, pctChange });
        hasChanges = true;
      }
    }

    if (!opts.dryRun && hasChanges) {
      const updatedData = oldData ?? createCitySeed(config);
      updatedData.rent = { ...updatedData.rent, ...newRent };

      try {
        await writeCity(cityId, updatedData, SOURCE);
        updatedCities.push(cityId);
      } catch (err) {
        errors.push({ cityId, reason: `Write failed: ${err?.message ?? 'unknown'}` });
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

