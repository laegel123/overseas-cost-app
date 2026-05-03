/**
 * scripts/refresh/ca_cmhc.mjs
 *
 * CMHC (Canada Mortgage and Housing Corporation) Rental Market Survey
 * → vancouver.rent, toronto.rent, montreal.rent 갱신.
 *
 * 출처: CMHC Rental Market Report + Statistics Canada Table 34-10-0133
 * API 키 불필요 (정부 공개 데이터).
 *
 * 방법: 도시별 CMA 평균 임대료 by # bedrooms
 * Bachelor → studio, 1BR → oneBed, 2BR → twoBed, share → studio × 0.65 추정
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed} from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const STATCAN_WDS_BASE = 'https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorsAndLatestNPeriods';

export const CITY_CONFIGS = {
  vancouver: {
    id: 'vancouver',
    name: { ko: '밴쿠버', en: 'Vancouver' },
    country: 'CA',
    currency: 'CAD',
    region: 'na',
    vectors: {
      bachelor: 'v111426660',
      oneBed: 'v111426661',
      twoBed: 'v111426662',
    },
  },
  toronto: {
    id: 'toronto',
    name: { ko: '토론토', en: 'Toronto' },
    country: 'CA',
    currency: 'CAD',
    region: 'na',
    vectors: {
      bachelor: 'v111426717',
      oneBed: 'v111426718',
      twoBed: 'v111426719',
    },
  },
  montreal: {
    id: 'montreal',
    name: { ko: '몬트리올', en: 'Montreal' },
    country: 'CA',
    currency: 'CAD',
    region: 'na',
    vectors: {
      bachelor: 'v111426699',
      oneBed: 'v111426700',
      twoBed: 'v111426701',
    },
  },
};

export const SOURCE = {
  category: 'rent',
  name: 'CMHC Rental Market Survey',
  url: 'https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-data/data-tables/rental-market',
};

/**
 * StatCan WDS API 응답 파싱.
 * @param {unknown} data
 * @returns {Map<string, number>}
 */
export function parseStatCanResponse(data) {
  const result = new Map();

  if (!Array.isArray(data)) return result;

  for (const item of data) {
    const vectorId = item?.object?.vectorId?.toString();
    const dataPoints = item?.object?.vectorDataPoint;

    if (!vectorId || !Array.isArray(dataPoints)) continue;

    const latestPoint = dataPoints[dataPoints.length - 1];
    const value = parseFloat(latestPoint?.value);

    if (Number.isFinite(value) && value > 0) {
      result.set(`v${vectorId}`, value);
    }
  }

  return result;
}

/**
 * rent 필드 변환. share 는 studio × 0.65 추정.
 * @param {Map<string, number>} vectorData
 * @param {{bachelor: string, oneBed: string, twoBed: string}} vectors
 * @returns {{share: number|null, studio: number|null, oneBed: number|null, twoBed: number|null}}
 */
export function mapToRent(vectorData, vectors) {
  const studio = vectorData.get(vectors.bachelor) ?? null;
  const oneBed = vectorData.get(vectors.oneBed) ?? null;
  const twoBed = vectorData.get(vectors.twoBed) ?? null;
  const share = studio !== null ? Math.round(studio * 0.65) : null;

  return { share, studio: studio !== null ? Math.round(studio) : null, oneBed: oneBed !== null ? Math.round(oneBed) : null, twoBed: twoBed !== null ? Math.round(twoBed) : null };
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * CMHC → 3개 캐나다 도시 rent 갱신.
 * @param {{dryRun?: boolean, cities?: string[]}} [opts]
 * @returns {Promise<RefreshResult>}
 */
export default async function refresh(opts = {}) {
  const errors = [];
  const changes = [];
  const fields = [];
  const updatedCities = [];

  const targetCities = opts.cities ?? Object.keys(CITY_CONFIGS);

  const allVectors = [];
  for (const cityId of targetCities) {
    const config = CITY_CONFIGS[cityId];
    if (!config) continue;
    allVectors.push(...Object.values(config.vectors));
  }

  const uniqueVectors = [...new Set(allVectors)];
  const vectorIds = uniqueVectors.map((v) => parseInt(v.slice(1), 10));

  let vectorData;
  try {
    const requestBody = JSON.stringify(vectorIds.map((id) => ({ vectorId: id, latestN: 1 })));
    const response = await fetchWithRetry(STATCAN_WDS_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
    });

    const data = await response.json();
    vectorData = parseStatCanResponse(data);
  } catch (err) {
    for (const cityId of targetCities) {
      errors.push({ cityId, reason: `StatCan API fetch failed: ${err?.message ?? 'unknown'}` });
    }
    return { source: 'ca_cmhc', cities: [], fields: [], changes: [], errors };
  }

  for (const cityId of targetCities) {
    const config = CITY_CONFIGS[cityId];
    if (!config) {
      errors.push({ cityId, reason: `Unknown city: ${cityId}` });
      continue;
    }

    const newRent = mapToRent(vectorData, config.vectors);

    if (newRent.studio === null && newRent.oneBed === null && newRent.twoBed === null) {
      errors.push({ cityId, reason: 'No rent data found in StatCan response' });
      continue;
    }

    let oldData;
    try {
      oldData = await readCity(cityId);
    } catch (err) {
      if (err?.code !== 'CITY_NOT_FOUND') {
        errors.push({ cityId, reason: `Failed to read existing data: ${err?.message}` });
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
    source: 'ca_cmhc',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}

