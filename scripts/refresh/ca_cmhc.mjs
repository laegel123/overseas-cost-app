/**
 * scripts/refresh/ca_cmhc.mjs
 *
 * CMHC (Canada Mortgage and Housing Corporation) Rental Market Survey
 * → vancouver.rent, toronto.rent, montreal.rent 갱신.
 *
 * 출처: Statistics Canada Table 34-10-0133-01 (CMHC RMS 원자료를 StatCan WDS 로 수신 — ADR-076)
 * API 키 불필요 (정부 공개 데이터).
 *
 * 방법: 도시별 CMA 의 6세대 이상 아파트(`Apartment structures of six units and over`)
 * 평균 임대료 by # bedrooms. structure 3종(Apartment 3+ / Row and apartment 3+ /
 * Apartment 6+) 중 CMHC 표준 보도 기준인 6+ 를 쓴다 (ADR-078).
 * Bachelor → studio, 1BR → oneBed, 2BR → twoBed.
 * share 는 CMHC 가 직접 제공하지 않아 studio × 0.65 추정이다 (ADR-059).
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage, parseStatCanResponse, hasLegacySourceName } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const STATCAN_WDS_BASE = 'https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorsAndLatestNPeriods';

export const CITY_CONFIGS = {
  vancouver: {
    id: 'vancouver',
    name: { ko: '밴쿠버', en: 'Vancouver' },
    country: 'CA',
    currency: 'CAD',
    region: 'na',
    // productId 34100133 · coordinate 184.4.<unit>.0.0.0.0.0.0.0
    // (geo=184 Vancouver CMA, structure=4 Apartment 6+, unit: bachelor=1 / oneBed=2 / twoBed=3)
    vectors: {
      bachelor: 'v3824445',
      oneBed: 'v3824633',
      twoBed: 'v3824821',
    },
  },
  toronto: {
    id: 'toronto',
    name: { ko: '토론토', en: 'Toronto' },
    country: 'CA',
    currency: 'CAD',
    region: 'na',
    // productId 34100133 · coordinate 125.4.<unit>.0.0.0.0.0.0.0
    // (geo=125 Toronto CMA, structure=4 Apartment 6+, unit: bachelor=1 / oneBed=2 / twoBed=3)
    vectors: {
      bachelor: 'v3824443',
      oneBed: 'v3824631',
      twoBed: 'v3824819',
    },
  },
  montreal: {
    id: 'montreal',
    name: { ko: '몬트리올', en: 'Montreal' },
    country: 'CA',
    currency: 'CAD',
    region: 'na',
    // productId 34100133 · coordinate 46.4.<unit>.0.0.0.0.0.0.0
    // (geo=46 Montréal CMA, structure=4 Apartment 6+, unit: bachelor=1 / oneBed=2 / twoBed=3)
    vectors: {
      bachelor: 'v3824429',
      oneBed: 'v3824617',
      twoBed: 'v3824805',
    },
  },
};

// 데이터는 CMHC 포털이 아니라 StatCan WDS (표 34-10-0133-01) 로 받는다 — CMHC 포털 약관은
// 상업 파생물을 금지하므로 출처를 StatCan 표로 두어 StatCan Open Licence 아래 놓는다 (ADR-076).
// 라이선스가 요구하는 `Adapted from Statistics Canada, <product>` 문구를 출처명에 담고,
// share 는 CMHC 가 직접 제공하지 않아 studio × 0.65 추정임을 한국어로 밝힌다 (ADR-059, ADR-070).
export const SOURCE = {
  category: 'rent',
  name: 'Adapted from Statistics Canada, Table 34-10-0133-01 (CMHC 평균 월세 · share 는 studio×0.65 추정)',
  url: 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410013301',
  legacyNames: ['CMHC Rental Market Survey via StatCan WDS (share=studio×0.65 estimated, ADR-059)'],
};


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
      errors.push({ cityId, reason: `StatCan API fetch failed: ${redactErrorMessage(String(err?.message ?? "unknown"))}` });
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
        errors.push({ cityId, reason: `Failed to read existing data: ${redactErrorMessage(String(err?.message ?? ""))}` });
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

    // 값 변동이 없어도 구 출처명이 남아 있으면 한 번은 써서 이름을 이전한다 (ADR-070).
    const needsSourceRename = hasLegacySourceName(oldData?.sources, SOURCE);

    if (!opts.dryRun && (hasChanges || needsSourceRename)) {
      const base = oldData ?? createCitySeed(config);
      const updatedData = { ...base, rent: { ...base.rent, ...newRent } };

      try {
        await writeCity(cityId, updatedData, SOURCE);
        updatedCities.push(cityId);
      } catch (err) {
        errors.push({ cityId, reason: `Write failed: ${redactErrorMessage(String(err?.message ?? "unknown"))}` });
      }
    } else if (hasChanges || needsSourceRename) {
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

