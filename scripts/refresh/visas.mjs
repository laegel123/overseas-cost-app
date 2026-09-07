/**
 * scripts/refresh/visas.mjs
 *
 * 도시별 비자 fee 자동화 — 각국 정부 페이지 fetch
 *
 * 출처: DATA_SOURCES.md 명시 정부 비자 페이지
 * API 키: 불필요 (페이지 scraping)
 *
 * 방법: 각국 정부 비자 페이지 HTML fetch → 정규식/static 매핑 → visa{} 객체 생성
 * 한계: 페이지 구조 변경 시 static fallback + errors (silent fail 금지)
 *
 * **현재 상태 (v1.0)**: 페이지 fetch 는 도달 가능성(reachability) 확인 용도이며,
 * HTML 파싱은 미구현 — 모든 도시가 VISA_REGISTRY 의 static 값을 사용한다.
 * 실제 파싱은 v1.x 별도 phase 에서 도입 예정 (각국 페이지 구조가 모두 달라 도시별 selector 필요).
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage, hasLegacySourceName } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';
import { OVERSEAS_CITY_CONFIGS } from './_cities.mjs';

export const VISA_REGISTRY = {
  CA: {
    name: '캐나다 이민·난민·시민권부(IRCC)',
    url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit.html',
    studentApplicationFee: 150,
    workApplicationFee: 255,
    settlementApprox: 2500,
  },
  US: {
    name: '미국 국무부 영사국',
    url: 'https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/fees.html',
    studentApplicationFee: 185,
    workApplicationFee: 190,
    settlementApprox: 3000,
  },
  GB: {
    name: '영국 정부(GOV.UK)',
    url: 'https://www.gov.uk/government/publications/visa-regulations-revised-table',
    studentApplicationFee: 490,
    workApplicationFee: 719,
    settlementApprox: 3500,
  },
  DE: {
    name: '독일 연방이주난민청(BAMF)',
    url: 'https://www.bamf.de/EN/Themen/MigrationAufenthalt/ZuwandererDrittstaaten/zuwandererdrittstaaten-node.html',
    studentApplicationFee: 75,
    workApplicationFee: 100,
    settlementApprox: 1500,
  },
  FR: {
    name: '프랑스 France-Visas',
    url: 'https://france-visas.gouv.fr/',
    studentApplicationFee: 99,
    workApplicationFee: 225,
    settlementApprox: 2000,
  },
  NL: {
    name: '네덜란드 이민귀화청(IND)',
    url: 'https://ind.nl/en/Pages/Costs.aspx',
    studentApplicationFee: 210,
    workApplicationFee: 350,
    settlementApprox: 2500,
  },
  AU: {
    name: '호주 내무부',
    url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing',
    studentApplicationFee: 710,
    workApplicationFee: 450,
    settlementApprox: 4000,
  },
  JP: {
    name: '일본 외무성',
    url: 'https://www.mofa.go.jp/j_info/visit/visa/short/novisa.html',
    studentApplicationFee: 3000,
    workApplicationFee: 6000,
    settlementApprox: 200000,
  },
  SG: {
    name: '싱가포르 이민검문청(ICA)',
    url: 'https://www.ica.gov.sg/enter-transit-depart/entering-singapore',
    studentApplicationFee: 30,
    workApplicationFee: 105,
    settlementApprox: 1500,
  },
  VN: {
    name: '베트남 출입국관리국',
    url: 'https://immigration.gov.vn/en/',
    studentApplicationFee: 25,
    workApplicationFee: 50,
    settlementApprox: 5000000,
  },
  AE: {
    name: 'UAE 정부 포털(u.ae)',
    url: 'https://u.ae/en/information-and-services/visa-and-emirates-id',
    studentApplicationFee: 500,
    workApplicationFee: 1200,
    settlementApprox: 8000,
  },
};

export const CITY_TO_COUNTRY = {
  vancouver: 'CA',
  toronto: 'CA',
  montreal: 'CA',
  nyc: 'US',
  la: 'US',
  sf: 'US',
  seattle: 'US',
  boston: 'US',
  london: 'GB',
  berlin: 'DE',
  munich: 'DE',
  paris: 'FR',
  amsterdam: 'NL',
  sydney: 'AU',
  melbourne: 'AU',
  tokyo: 'JP',
  osaka: 'JP',
  singapore: 'SG',
  hochiminh: 'VN',
  dubai: 'AE',
};

// 20개 도시 메타 — 단일 출처 `_cities.mjs` 에서 import.
// 도시 추가·통화 변경 시 `_cities.mjs` 만 수정하면 universities.mjs / visas.mjs 양쪽에 자동 반영.
export const CITY_CONFIGS = OVERSEAS_CITY_CONFIGS;

// 이 출처의 구 이름들 — updateSources 가 제거해 도시당 항목 1개를 유지한다 (ADR-070).
// 구 한국어명(ADR-070)·구 영문명(그 이전) 둘 다 필요: 하나라도 빠지면 해당 이름의 항목이
// 지워지지 않고 새 이름 항목이 append 되어 도시별로 출처가 중복된다.
const LEGACY_NAMES = [
  '각국 정부 공식 비자 수수료 페이지 (정적 추정치)',
  'Government visa fee pages (static estimates)',
];

/**
 * 도시별 visa 출처 디스크립터 생성 (ADR-071).
 *
 * 모듈 레벨 단일 상수였을 때는 도시별로 다른 URL 을 쓸 수 없어 `docs/DATA_SOURCES.md`
 * (우리 저장소) 를 가리켰다. 출처 화면이 이 url 을 "페이지 열기 →" 로 여는 이상
 * 실제 공공 출처여야 한다 — registry 가 이미 갖고 있는 정부 공식 페이지를 쓴다.
 *
 * @param {string} cityId
 * @returns {import('./_common.mjs').SourceDescriptor}
 */
export function buildSource(cityId) {
  const countryCode = CITY_TO_COUNTRY[cityId];
  const registry = countryCode ? VISA_REGISTRY[countryCode] : undefined;
  if (!registry) {
    throw new Error(`No visa registry entry for city: ${cityId}`);
  }

  return {
    category: 'visa',
    // 기관 고유명은 원어 유지, 서술만 한국어, '(정적 추정치)' 마커 유지 (ADR-070, AUTOMATION.md §8).
    name: `${registry.name} 공식 비자 수수료 페이지 (정적 추정치)`,
    url: registry.url,
    legacyNames: LEGACY_NAMES,
  };
}

/**
 * 국가 비자 페이지 도달 가능성(reachability) 체크 — v1.0 에서는 파싱 미구현.
 *
 * `fetchedFromPage` 가 true 라도 HTML 파싱은 하지 않으며, 항상 VISA_REGISTRY 의 static 값을 반환한다.
 * 페이지 응답이 200 인지를 확인하는 의미만 가진다 (정부 사이트 다운 시 errors 에 기록).
 *
 * TODO(v1.x): 국가별 selector 정의 후 실제 fee 추출. 현재는 "갱신 자동화" 의 첫 단계로
 * fetcher 골조와 sources.accessedAt 갱신만 맞춰 둠 — ADR-032 의 자동 fetch 정책에 맞춘
 * 일관된 갱신 경로 확보가 목적.
 *
 * @param {string} countryCode
 * @returns {Promise<{visa: {studentApplicationFee: number, workApplicationFee: number, settlementApprox: number} | null, fetchedFromPage: boolean, error?: string}>}
 */
export async function fetchVisaFees(countryCode) {
  const registry = VISA_REGISTRY[countryCode];
  if (!registry) {
    return { visa: null, fetchedFromPage: false, error: `Unknown country: ${countryCode}` };
  }

  try {
    const response = await fetchWithRetry(registry.url, { timeoutMs: 15000, maxRetries: 1 });
    // reachability check 만 필요 — body 미사용. undici keep-alive 연결 점유 방지.
    await response.body?.cancel().catch(() => {});
    if (!response.ok) {
      return {
        visa: {
          studentApplicationFee: registry.studentApplicationFee,
          workApplicationFee: registry.workApplicationFee,
          settlementApprox: registry.settlementApprox,
        },
        fetchedFromPage: false,
      };
    }
    return {
      visa: {
        studentApplicationFee: registry.studentApplicationFee,
        workApplicationFee: registry.workApplicationFee,
        settlementApprox: registry.settlementApprox,
      },
      fetchedFromPage: true,
    };
  } catch (err) {
    // v1.0: HTML 파싱 미구현 + 정부 사이트 봇 차단이 흔해 errors 대신 info 로그.
    // v1.x 파싱 도입 시 디버깅 단서 보존 — silent 차단 회피.
    console.info(`[visas] ${countryCode} fetch failed: ${redactErrorMessage(String(err?.message ?? 'unknown'))}`);
    return {
      visa: {
        studentApplicationFee: registry.studentApplicationFee,
        workApplicationFee: registry.workApplicationFee,
        settlementApprox: registry.settlementApprox,
      },
      fetchedFromPage: false,
    };
  }
}

/**
 * 도시별 visa 객체 생성
 * @param {string} cityId
 * @param {{useStatic?: boolean}} [opts]
 * @returns {Promise<{visa: {studentApplicationFee: number, workApplicationFee: number, settlementApprox: number} | null, errors: string[]}>}
 */
export async function getVisaForCity(cityId, opts = {}) {
  const countryCode = CITY_TO_COUNTRY[cityId];
  if (!countryCode) {
    return { visa: null, errors: [`Unknown city: ${cityId}`] };
  }

  const registry = VISA_REGISTRY[countryCode];
  if (!registry) {
    return { visa: null, errors: [`No visa data for country: ${countryCode}`] };
  }

  const errors = [];

  if (opts.useStatic) {
    return {
      visa: {
        studentApplicationFee: registry.studentApplicationFee,
        workApplicationFee: registry.workApplicationFee,
        settlementApprox: registry.settlementApprox,
      },
      errors,
    };
  }

  const result = await fetchVisaFees(countryCode);
  if (result.error) {
    errors.push(result.error);
  }
  // v1.0: HTML 파싱 미구현 — fetchedFromPage:false 든 true 든 동일 static 값 반환.
  // 정부 사이트의 봇 차단으로 reachability 가 실패하는 게 정상이라 errors 에 기록하지 않고 info 로그만.
  if (!result.fetchedFromPage) {
    console.info(`[visas] ${countryCode}: page unreachable, using static value`);
  }

  return { visa: result.visa, errors };
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * 모든 도시 visa 갱신
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

    const { visa, errors: visaErrors } = await getVisaForCity(cityId, { useStatic: opts.useStatic });

    for (const err of visaErrors) {
      errors.push({ cityId, reason: err });
    }

    if (!visa) {
      errors.push({ cityId, reason: 'No visa data found' });
      continue;
    }

    let oldData;
    try {
      oldData = await readCity(cityId);
    } catch (err) {
      if (err?.code !== 'CITY_NOT_FOUND') {
        errors.push({ cityId, reason: `Failed to read existing data: ${redactErrorMessage(String(err?.message ?? ''))}` });
      }
    }

    const oldVisa = oldData?.visa ?? {};
    let hasChanges = false;

    for (const field of ['studentApplicationFee', 'workApplicationFee', 'settlementApprox']) {
      const oldVal = oldVisa[field] ?? null;
      const newVal = visa[field];

      if (oldVal !== newVal && newVal !== undefined) {
        fields.push(`visa.${field}`);
        const pctChange = computePctChange(oldVal, newVal);
        changes.push({ cityId, field: `visa.${field}`, oldValue: oldVal, newValue: newVal, pctChange });
        hasChanges = true;
      }
    }

    const source = buildSource(cityId);
    // 값 변동이 없어도 구 출처명이 남아 있으면 한 번은 써서 이름을 이전한다 (ADR-070).
    const needsSourceRename = hasLegacySourceName(oldData?.sources, source);

    if (!opts.dryRun && (hasChanges || needsSourceRename)) {
      const base = oldData ?? createCitySeed(config);
      const updatedData = { ...base, visa };

      try {
        await writeCity(cityId, updatedData, source);
        updatedCities.push(cityId);
      } catch (err) {
        errors.push({ cityId, reason: `Write failed: ${redactErrorMessage(String(err?.message ?? 'unknown'))}` });
      }
    } else if (hasChanges || needsSourceRename) {
      updatedCities.push(cityId);
    }
  }

  return {
    source: 'visas',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}
