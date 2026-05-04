/**
 * scripts/refresh/us_hud.mjs
 *
 * HUD Fair Market Rents (FMR) → 5개 미국 도시 rent 갱신.
 *
 * 출처: HUD User FMR API
 * URL: https://www.huduser.gov/hudapi/public/fmr
 * API 키 불필요 (공개 데이터).
 *
 * 방법: MSA 별 FMR by # bedrooms
 * 0BR → studio, 1BR → oneBed, 2BR → twoBed, share → studio × 0.65 추정 (ADR-059)
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const HUD_FMR_BASE = 'https://www.huduser.gov/hudapi/public/fmr/data';

export const CITY_CONFIGS = {
  nyc: {
    id: 'nyc',
    name: { ko: '뉴욕', en: 'New York' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    entityId: 'METRO35620M35620',
  },
  la: {
    id: 'la',
    name: { ko: '로스앤젤레스', en: 'Los Angeles' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    entityId: 'METRO31080M31080',
  },
  sf: {
    id: 'sf',
    name: { ko: '샌프란시스코', en: 'San Francisco' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    entityId: 'METRO41860M41860',
  },
  seattle: {
    id: 'seattle',
    name: { ko: '시애틀', en: 'Seattle' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    entityId: 'METRO42660M42660',
  },
  boston: {
    id: 'boston',
    name: { ko: '보스턴', en: 'Boston' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    entityId: 'METRO14460M14460',
  },
};

export const SOURCE = {
  category: 'rent',
  name: 'HUD Fair Market Rents (share=studio×0.65 estimated, ADR-059)',
  url: 'https://www.huduser.gov/portal/datasets/fmr.html',
};

/**
 * HUD FMR 응답 파싱. basicdata.{Efficiency, One-Bedroom, Two-Bedroom}.
 * @param {unknown} data
 * @returns {{studio: number|null, oneBed: number|null, twoBed: number|null}}
 */
export function parseHudResponse(data) {
  const result = { studio: null, oneBed: null, twoBed: null };

  if (!data || typeof data !== 'object') return result;

  const basicData = data.data?.basicdata;
  if (!basicData || typeof basicData !== 'object') return result;

  const efficiency = parseFloat(basicData.Efficiency);
  const oneBed = parseFloat(basicData['One-Bedroom']);
  const twoBed = parseFloat(basicData['Two-Bedroom']);

  if (Number.isFinite(efficiency) && efficiency > 0) {
    result.studio = Math.round(efficiency);
  }
  if (Number.isFinite(oneBed) && oneBed > 0) {
    result.oneBed = Math.round(oneBed);
  }
  if (Number.isFinite(twoBed) && twoBed > 0) {
    result.twoBed = Math.round(twoBed);
  }

  return result;
}

/**
 * rent 필드 생성. share 는 studio × 0.65 추정 (ADR-059).
 * @param {{studio: number|null, oneBed: number|null, twoBed: number|null}} parsed
 * @returns {{share: number|null, studio: number|null, oneBed: number|null, twoBed: number|null}}
 */
export function mapToRent(parsed) {
  const share = parsed.studio !== null ? Math.round(parsed.studio * 0.65) : null;
  return { share, ...parsed };
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * HUD FMR → 5개 미국 도시 rent 갱신.
 * @param {{dryRun?: boolean, cities?: string[]}} [opts]
 * @returns {Promise<RefreshResult>}
 */
export default async function refresh(opts = {}) {
  const errors = [];
  const changes = [];
  const fields = [];
  const updatedCities = [];

  const targetCities = opts.cities ?? Object.keys(CITY_CONFIGS);

  for (const cityId of targetCities) {
    const config = CITY_CONFIGS[cityId];
    if (!config) {
      errors.push({ cityId, reason: `Unknown city: ${cityId}` });
      continue;
    }

    let parsed;
    try {
      const url = `${HUD_FMR_BASE}/${config.entityId}`;
      const response = await fetchWithRetry(url);
      const data = await response.json();
      parsed = parseHudResponse(data);
    } catch (err) {
      errors.push({
        cityId,
        reason: `HUD API fetch failed: ${redactErrorMessage(String(err?.message ?? 'unknown'))}`,
      });
      continue;
    }

    if (parsed.studio === null && parsed.oneBed === null && parsed.twoBed === null) {
      errors.push({ cityId, reason: 'No rent data found in HUD response' });
      continue;
    }

    const newRent = mapToRent(parsed);

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
      const base = oldData ?? createCitySeed(config);
      const updatedData = { ...base, rent: { ...base.rent, ...newRent } };

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
    source: 'us_hud',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}
