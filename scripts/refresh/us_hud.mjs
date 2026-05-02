/**
 * scripts/refresh/us_hud.mjs
 *
 * HUD Fair Market Rent (FMR) → 5개 미국 도시 rent 갱신.
 *
 * 출처: HUD User FMR API
 * URL: https://www.huduser.gov/portal/dataset/fmr-api.html
 * API 키 불필요 (공개 데이터).
 *
 * 방법: MSA (Metropolitan Statistical Area) 별 FMR → 도시 rent 매핑.
 * - Efficiency (0BR) → studio
 * - 1BR → oneBed
 * - 2BR → twoBed
 * - share → studio × 0.65 추정
 */

import { readCity, writeCity, fetchWithRetry } from './_common.mjs';

const HUD_FMR_BASE = 'https://www.huduser.gov/hudapi/public/fmr/data';

export const CITY_CONFIGS = {
  nyc: {
    id: 'nyc',
    name: { ko: '뉴욕', en: 'New York' },
    country: 'US',
    currency: 'USD',
    region: 'north-america',
    fmrCode: 'METRO35620M35620',
  },
  la: {
    id: 'la',
    name: { ko: 'LA', en: 'Los Angeles' },
    country: 'US',
    currency: 'USD',
    region: 'north-america',
    fmrCode: 'METRO31080M31080',
  },
  sf: {
    id: 'sf',
    name: { ko: '샌프란시스코', en: 'San Francisco' },
    country: 'US',
    currency: 'USD',
    region: 'north-america',
    fmrCode: 'METRO41860M41860',
  },
  seattle: {
    id: 'seattle',
    name: { ko: '시애틀', en: 'Seattle' },
    country: 'US',
    currency: 'USD',
    region: 'north-america',
    fmrCode: 'METRO42660M42660',
  },
  boston: {
    id: 'boston',
    name: { ko: '보스턴', en: 'Boston' },
    country: 'US',
    currency: 'USD',
    region: 'north-america',
    fmrCode: 'METRO14460M14460',
  },
};

export const SOURCE = {
  category: 'rent',
  name: 'HUD Fair Market Rent',
  url: 'https://www.huduser.gov/portal/datasets/fmr.html',
};

export const STATIC_RENTS = {
  nyc: { studio: 2150, oneBed: 2350, twoBed: 2800 },
  la: { studio: 1650, oneBed: 1850, twoBed: 2350 },
  sf: { studio: 2300, oneBed: 2600, twoBed: 3200 },
  seattle: { studio: 1550, oneBed: 1750, twoBed: 2200 },
  boston: { studio: 1800, oneBed: 2100, twoBed: 2600 },
};

/**
 * HUD FMR API 응답 파싱.
 * @param {unknown} data
 * @returns {{studio: number|null, oneBed: number|null, twoBed: number|null}}
 */
export function parseHudResponse(data) {
  const result = { studio: null, oneBed: null, twoBed: null };

  if (typeof data !== 'object' || data === null) return result;

  const fmr = data.data?.basicdata;
  if (typeof fmr !== 'object' || fmr === null) return result;

  const efficiency = parseFloat(fmr.Efficiency);
  const oneBr = parseFloat(fmr['One-Bedroom']);
  const twoBr = parseFloat(fmr['Two-Bedroom']);

  if (Number.isFinite(efficiency) && efficiency > 0) {
    result.studio = Math.round(efficiency);
  }
  if (Number.isFinite(oneBr) && oneBr > 0) {
    result.oneBed = Math.round(oneBr);
  }
  if (Number.isFinite(twoBr) && twoBr > 0) {
    result.twoBed = Math.round(twoBr);
  }

  return result;
}

/**
 * rent 필드 완성. share = studio × 0.65 추정.
 * @param {{studio: number|null, oneBed: number|null, twoBed: number|null}} fmrRent
 * @returns {{share: number|null, studio: number|null, oneBed: number|null, twoBed: number|null}}
 */
export function mapToRent(fmrRent) {
  const share = fmrRent.studio !== null ? Math.round(fmrRent.studio * 0.65) : null;
  return { share, ...fmrRent };
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * HUD FMR → 5개 미국 도시 rent 갱신.
 * @param {{dryRun?: boolean, cities?: string[], useStatic?: boolean}} [opts]
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

    let fmrRent;

    if (opts.useStatic) {
      const staticRent = STATIC_RENTS[cityId];
      fmrRent = staticRent
        ? { studio: staticRent.studio, oneBed: staticRent.oneBed, twoBed: staticRent.twoBed }
        : { studio: null, oneBed: null, twoBed: null };
    } else {
      try {
        const url = `${HUD_FMR_BASE}/${config.fmrCode}`;
        const response = await fetchWithRetry(url, { timeoutMs: 15000 });
        const data = await response.json();
        fmrRent = parseHudResponse(data);

        if (fmrRent.studio === null && fmrRent.oneBed === null && fmrRent.twoBed === null) {
          const staticRent = STATIC_RENTS[cityId];
          if (staticRent) {
            errors.push({ cityId, reason: 'HUD FMR returned no data, using static fallback' });
            fmrRent = { studio: staticRent.studio, oneBed: staticRent.oneBed, twoBed: staticRent.twoBed };
          } else {
            errors.push({ cityId, reason: 'HUD FMR returned no data, no static fallback' });
            continue;
          }
        }
      } catch (err) {
        const staticRent = STATIC_RENTS[cityId];
        if (staticRent) {
          errors.push({ cityId, reason: `HUD FMR fetch failed, using static fallback: ${err?.message}` });
          fmrRent = { studio: staticRent.studio, oneBed: staticRent.oneBed, twoBed: staticRent.twoBed };
        } else {
          errors.push({ cityId, reason: `HUD FMR fetch failed: ${err?.message}` });
          continue;
        }
      }
    }

    const newRent = mapToRent(fmrRent);

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
        const pctChange = oldVal !== null && oldVal !== 0 ? (newVal - oldVal) / oldVal : oldVal === null ? 1 : 0;
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
    source: 'us_hud',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}

/**
 * 도시 seed 데이터 생성 (초기화용).
 * @param {typeof CITY_CONFIGS.nyc} config
 * @returns {import('../../src/types/city').CityCostData}
 */
function createCitySeed(config) {
  return {
    id: config.id,
    name: config.name,
    country: config.country,
    currency: config.currency,
    region: config.region,
    lastUpdated: '',
    rent: { share: null, studio: null, oneBed: null, twoBed: null },
    food: {
      restaurantMeal: 0,
      cafe: 0,
      groceries: {
        milk1L: 0,
        eggs12: 0,
        rice1kg: 0,
        chicken1kg: 0,
        bread: 0,
      },
    },
    transport: { monthlyPass: 0, singleRide: 0, taxiBase: 0 },
    sources: [],
  };
}
