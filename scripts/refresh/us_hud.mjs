/**
 * scripts/refresh/us_hud.mjs
 *
 * HUD Fair Market Rents (FMR) → 5개 미국 도시 rent 갱신.
 *
 * 출처: HUD User FMR API
 * URL: https://www.huduser.gov/hudapi/public/fmr
 * API 키: `US_HUD_API_KEY` 필요 — HUD User 계정에서 발급한 access token 을
 * `Authorization: Bearer` 헤더로 보낸다. 없으면 401 (ADR-085).
 *
 * 방법: 도시 중심 HUD 하위 FMR 지역(HMFA) 의 FMR by # bedrooms (ADR-086). 5개 도시 모두 HUD 가
 * MSA 를 HMFA 로 나누는 곳이라 MSA 코드(`METRO#####M#####`)는 404 — `GET /fmr/listMetroAreas` 의 코드를 쓴다.
 * 값은 월세 USD (40th percentile gross rent, 연도 미지정 시 최신 회계연도).
 * 0BR → studio, 1BR → oneBed, 2BR → twoBed, share → studio × 0.65 추정 (ADR-059)
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage, createMissingApiKeyError } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const HUD_FMR_BASE = 'https://www.huduser.gov/hudapi/public/fmr/data';

export const CITY_CONFIGS = {
  nyc: {
    id: 'nyc',
    name: { ko: '뉴욕', en: 'New York' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    // New York, NY HUD Metro FMR Area — Bronx·Kings·New York·Putnam·Queens·Richmond·Rockland·Westchester
    entityId: 'METRO35620MM5600',
  },
  la: {
    id: 'la',
    name: { ko: '로스앤젤레스', en: 'Los Angeles' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    // Los Angeles-Long Beach-Glendale, CA HUD Metro FMR Area — LA 카운티 (Small Area FMR 지역)
    entityId: 'METRO31080MM4480',
  },
  sf: {
    id: 'sf',
    name: { ko: '샌프란시스코', en: 'San Francisco' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    // San Francisco, CA HUD Metro FMR Area — Marin·San Francisco·San Mateo
    entityId: 'METRO41860MM7360',
  },
  seattle: {
    id: 'seattle',
    name: { ko: '시애틀', en: 'Seattle' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    // Seattle-Bellevue, WA HUD Metro FMR Area — King·Snohomish (Small Area FMR 지역)
    entityId: 'METRO42660MM7600',
  },
  boston: {
    id: 'boston',
    name: { ko: '보스턴', en: 'Boston' },
    country: 'US',
    currency: 'USD',
    region: 'na',
    // Boston-Cambridge-Quincy, MA-NH HUD Metro FMR Area — Essex·Middlesex·Norfolk·Plymouth·Suffolk(MA)·Rockingham(NH)
    entityId: 'METRO14460MM1120',
  },
};

export const SOURCE = {
  category: 'rent',
  name: 'HUD Fair Market Rents (share 는 studio×0.65 추정)',
  url: 'https://www.huduser.gov/portal/datasets/fmr.html',
  legacyNames: ['HUD Fair Market Rents (share=studio×0.65 estimated, ADR-059)'],
};

/** Small Area FMR 응답에서 지역 전체 FMR 행의 `zip_code` 값. */
const AREA_WIDE_ZIP_CODE = 'MSA level';

/**
 * HUD FMR 응답 파싱.
 * - 일반 FMR 지역: `data.basicdata` 가 객체 `{Efficiency, One-Bedroom, Two-Bedroom, ..., year}`.
 * - Small Area FMR 지역 (`smallarea_status: "1"` — LA·시애틀): `data.basicdata` 가 우편번호별 행 배열.
 *   `zip_code: "MSA level"` 행이 지역 전체 FMR (`/fmr/statedata` 의 같은 지역 값과 같음) 이라 그 행만 쓴다.
 *   행이 없으면 null — 우편번호 값으로 대체하지 않는다.
 * @param {unknown} data
 * @returns {{studio: number|null, oneBed: number|null, twoBed: number|null}}
 */
export function parseHudResponse(data) {
  const result = { studio: null, oneBed: null, twoBed: null };

  if (!data || typeof data !== 'object') return result;

  const basicData = data.data?.basicdata;
  const rents = Array.isArray(basicData)
    ? basicData.find((row) => row?.zip_code === AREA_WIDE_ZIP_CODE)
    : basicData;
  if (!rents || typeof rents !== 'object') return result;

  const efficiency = parseFloat(rents.Efficiency);
  const oneBed = parseFloat(rents['One-Bedroom']);
  const twoBed = parseFloat(rents['Two-Bedroom']);

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

  const apiKey = process.env.US_HUD_API_KEY;
  if (!apiKey) {
    throw createMissingApiKeyError('US_HUD_API_KEY environment variable is required');
  }

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
      const response = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${apiKey}` } });
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
