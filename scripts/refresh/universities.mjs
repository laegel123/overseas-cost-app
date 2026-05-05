/**
 * scripts/refresh/universities.mjs
 *
 * 도시별 대학 학비 자동화 — 각 대학 공식 페이지 fetch
 *
 * 출처: DATA_SOURCES.md 명시 대학별 international tuition 페이지
 * API 키: 불필요 (페이지 scraping)
 *
 * 방법: 각 대학 페이지 HTML fetch → 정규식/static 매핑 → tuition[] 배열 생성
 * 한계: 페이지 구조 변경 시 static fallback + errors (silent fail 금지)
 *
 * **현재 상태 (v1.0)**: 페이지 fetch 는 도달 가능성(reachability) 확인 용도이며,
 * HTML 파싱은 미구현 — 모든 대학이 UNIVERSITY_REGISTRY 의 staticAnnual 값을 사용한다.
 * 실제 파싱은 v1.x 별도 phase 에서 도입 예정 (대학 페이지 구조가 모두 달라 학교별 selector 필요).
 */

import { fetchWithRetry, readCity, writeCity, createCitySeed, redactErrorMessage } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';
import { OVERSEAS_CITY_CONFIGS } from './_cities.mjs';

export const UNIVERSITY_REGISTRY = {
  vancouver: [
    { school: 'UBC', level: 'undergrad', url: 'https://you.ubc.ca/financial-planning/cost/', staticAnnual: 45000 },
    { school: 'SFU', level: 'undergrad', url: 'https://www.sfu.ca/students/fees/calculator.html', staticAnnual: 32000 },
    { school: 'BCIT', level: 'language', url: 'https://www.bcit.ca/admission/international/', staticAnnual: 18000 },
  ],
  toronto: [
    { school: 'University of Toronto', level: 'undergrad', url: 'https://studentaccount.utoronto.ca/tuition-fees/', staticAnnual: 60000 },
    { school: 'York University', level: 'undergrad', url: 'https://sfs.yorku.ca/fees/', staticAnnual: 35000 },
    { school: 'Seneca', level: 'language', url: 'https://www.senecapolytechnic.ca/admissions/fees-and-financial.html', staticAnnual: 16000 },
  ],
  montreal: [
    { school: 'McGill', level: 'undergrad', url: 'https://www.mcgill.ca/student-accounts/tuition-charges', staticAnnual: 25000 },
    { school: 'Concordia', level: 'undergrad', url: 'https://www.concordia.ca/admissions/tuition-fees.html', staticAnnual: 22000 },
    { school: 'UdeM', level: 'graduate', url: 'https://www.umontreal.ca/', staticAnnual: 20000 },
  ],
  nyc: [
    { school: 'Columbia', level: 'undergrad', url: 'https://www.studentfinancialservices.columbia.edu/tuition-fees', staticAnnual: 65000 },
    { school: 'NYU', level: 'undergrad', url: 'https://www.nyu.edu/admissions/tuition-and-financial-aid.html', staticAnnual: 60000 },
    { school: 'CUNY', level: 'undergrad', url: 'https://www.cuny.edu/admissions/tuition-fees/', staticAnnual: 18000 },
  ],
  la: [
    { school: 'UCLA', level: 'undergrad', url: 'https://www.registrar.ucla.edu/Fees-Residence/Fee-Amounts', staticAnnual: 45000 },
    { school: 'USC', level: 'undergrad', url: 'https://financialaid.usc.edu/tuition-costs/', staticAnnual: 65000 },
    { school: 'SMC', level: 'language', url: 'https://www.smc.edu/admission/', staticAnnual: 10000 },
  ],
  sf: [
    { school: 'UC Berkeley', level: 'undergrad', url: 'https://registrar.berkeley.edu/tuition-fees-residency/', staticAnnual: 48000 },
    { school: 'Stanford', level: 'undergrad', url: 'https://financialaid.stanford.edu/undergrad/cost/', staticAnnual: 60000 },
    { school: 'CCSF', level: 'language', url: 'https://www.ccsf.edu/', staticAnnual: 8000 },
  ],
  seattle: [
    { school: 'University of Washington', level: 'undergrad', url: 'https://opb.washington.edu/content/tuition-fees', staticAnnual: 42000 },
    { school: 'Seattle Central', level: 'language', url: 'https://seattlecentral.edu/', staticAnnual: 11000 },
  ],
  boston: [
    { school: 'Harvard', level: 'undergrad', url: 'https://college.harvard.edu/financial-aid/cost-attendance', staticAnnual: 57000 },
    { school: 'MIT', level: 'undergrad', url: 'https://sfs.mit.edu/undergraduate-students/the-cost-of-attendance/', staticAnnual: 58000 },
    { school: 'BU', level: 'undergrad', url: 'https://www.bu.edu/admissions/tuition-aid/', staticAnnual: 62000 },
  ],
  london: [
    { school: 'Imperial College', level: 'undergrad', url: 'https://www.imperial.ac.uk/study/fees-and-funding/tuition-fees/', staticAnnual: 38000 },
    { school: 'UCL', level: 'undergrad', url: 'https://www.ucl.ac.uk/prospective-students/undergraduate/fees-funding', staticAnnual: 35000 },
    { school: "King's College", level: 'undergrad', url: 'https://www.kcl.ac.uk/study/undergraduate/fees-and-funding', staticAnnual: 32000 },
  ],
  berlin: [
    { school: 'TU Berlin', level: 'undergrad', url: 'https://www.tu.berlin/en/studying/courses-of-study/fees-and-financing', staticAnnual: 700 },
    { school: 'HU Berlin', level: 'undergrad', url: 'https://www.hu-berlin.de/', staticAnnual: 700 },
    { school: 'FU Berlin', level: 'undergrad', url: 'https://www.fu-berlin.de/', staticAnnual: 700 },
  ],
  munich: [
    { school: 'LMU München', level: 'undergrad', url: 'https://www.lmu.de/en/study/all-information-on-degree-programmes/student-fees-and-charges/', staticAnnual: 700 },
    { school: 'TU München', level: 'undergrad', url: 'https://www.tum.de/', staticAnnual: 700 },
  ],
  paris: [
    { school: 'Sorbonne Université', level: 'undergrad', url: 'https://www.sorbonne-universite.fr/en/admissions', staticAnnual: 3800 },
    { school: 'Sciences Po', level: 'undergrad', url: 'https://www.sciencespo.fr/students/en/cost-of-studies', staticAnnual: 14500 },
    { school: 'École Polytechnique', level: 'graduate', url: 'https://www.polytechnique.edu/', staticAnnual: 15000 },
  ],
  amsterdam: [
    { school: 'UvA', level: 'undergrad', url: 'https://www.uva.nl/en/education/fees-and-finance/tuition-fees/', staticAnnual: 15000 },
    { school: 'VU Amsterdam', level: 'undergrad', url: 'https://www.vu.nl/', staticAnnual: 14500 },
    { school: 'Amsterdam UAS', level: 'undergrad', url: 'https://www.amsterdamuas.com/', staticAnnual: 12000 },
  ],
  sydney: [
    { school: 'USyd', level: 'undergrad', url: 'https://www.sydney.edu.au/students/student-fees.html', staticAnnual: 50000 },
    { school: 'UNSW', level: 'undergrad', url: 'https://www.unsw.edu.au/study/how-to-apply/fees', staticAnnual: 48000 },
    { school: 'Macquarie', level: 'undergrad', url: 'https://www.mq.edu.au/', staticAnnual: 42000 },
  ],
  melbourne: [
    { school: 'UniMelb', level: 'undergrad', url: 'https://study.unimelb.edu.au/how-to-apply/international-fees', staticAnnual: 52000 },
    { school: 'Monash', level: 'undergrad', url: 'https://www.monash.edu/fees/international', staticAnnual: 48000 },
    { school: 'RMIT', level: 'undergrad', url: 'https://www.rmit.edu.au/study-with-us/international-students/applying-to-rmit-international-students/fees', staticAnnual: 40000 },
  ],
  tokyo: [
    { school: '東京大学', level: 'undergrad', url: 'https://www.u-tokyo.ac.jp/en/prospective-students/admission_fees.html', staticAnnual: 535800 },
    { school: '早稲田大学', level: 'undergrad', url: 'https://www.waseda.jp/inst/admission/en/', staticAnnual: 1500000 },
    { school: '慶應義塾大学', level: 'undergrad', url: 'https://www.keio.ac.jp/en/admissions/', staticAnnual: 1600000 },
  ],
  osaka: [
    { school: '大阪大学', level: 'undergrad', url: 'https://www.osaka-u.ac.jp/en/admissions/tuition_fees', staticAnnual: 535800 },
    { school: '京都大学', level: 'undergrad', url: 'https://www.kyoto-u.ac.jp/en/admissions/', staticAnnual: 535800 },
    { school: '関西学院大学', level: 'undergrad', url: 'https://www.kwansei.ac.jp/', staticAnnual: 1200000 },
  ],
  singapore: [
    { school: 'NUS', level: 'undergrad', url: 'https://www.nus.edu.sg/oam/admissions/international/applying/fees', staticAnnual: 35000 },
    { school: 'NTU', level: 'undergrad', url: 'https://www.ntu.edu.sg/', staticAnnual: 33000 },
    { school: 'SMU', level: 'undergrad', url: 'https://www.smu.edu.sg/', staticAnnual: 38000 },
  ],
  hochiminh: [
    { school: 'VNU-HCMC', level: 'undergrad', url: 'https://en.vnuhcm.edu.vn/admissions/', staticAnnual: 50000000 },
    { school: 'RMIT Vietnam', level: 'undergrad', url: 'https://www.rmit.edu.vn/study-at-rmit/fees-scholarships', staticAnnual: 350000000 },
    { school: 'Fulbright', level: 'undergrad', url: 'https://fulbright.edu.vn/', staticAnnual: 450000000 },
  ],
  dubai: [
    { school: 'American University in Dubai', level: 'undergrad', url: 'https://www.aud.edu/admissions/tuition-fees/', staticAnnual: 80000 },
    { school: 'Wollongong Dubai', level: 'undergrad', url: 'https://www.uowdubai.ac.ae/', staticAnnual: 65000 },
  ],
};

// 20개 도시 메타 — 단일 출처 `_cities.mjs` 에서 import (PR #20 review round 10).
// 도시 추가·통화 변경 시 `_cities.mjs` 만 수정하면 universities.mjs / visas.mjs 양쪽에 자동 반영.
export const CITY_CONFIGS = OVERSEAS_CITY_CONFIGS;

export const SOURCE = {
  category: 'tuition',
  name: 'Official university international tuition pages (static estimates)',
  // main 브랜치 고정 (PR #20 review round 22) — 과거 HEAD alias 는 시점에 따라 다른 commit 을 가리켜 sources URL 의 시간적 일관성이 흔들렸다. main 으로 고정하면 release 후 변경되지 않는다.
  url: 'https://github.com/laegel123/overseas-cost-app/blob/main/docs/DATA_SOURCES.md',
};

/**
 * 대학 페이지 도달 가능성(reachability) 체크 — v1.0 에서는 파싱 미구현.
 *
 * `fetchedFromPage` 가 true 라도 HTML 파싱은 하지 않으며, 항상 university.staticAnnual 을 반환한다.
 * 페이지 응답이 200 인지를 확인하는 의미만 가진다 (대학 사이트 다운 시 errors 에 기록).
 *
 * TODO(v1.x): 학교별 selector 정의 후 실제 학비 추출. 현재는 "갱신 자동화" 의 첫 단계로
 * fetcher 골조와 sources.accessedAt 갱신만 맞춰 둠 — ADR-032 의 자동 fetch 정책에 맞춘
 * 일관된 갱신 경로 확보가 목적.
 *
 * @param {{school: string, level: string, url: string, staticAnnual: number}} university
 * @returns {Promise<{school: string, level: string, annual: number, fetchedFromPage: boolean}>}
 */
export async function fetchUniversityTuition(university) {
  try {
    const response = await fetchWithRetry(university.url, { timeoutMs: 15000, maxRetries: 1 });
    // reachability check 만 필요 — body 미사용. undici keep-alive 연결 점유 방지.
    await response.body?.cancel().catch(() => {});
    if (!response.ok) {
      return { school: university.school, level: university.level, annual: university.staticAnnual, fetchedFromPage: false };
    }
    return { school: university.school, level: university.level, annual: university.staticAnnual, fetchedFromPage: true };
  } catch (err) {
    // v1.0: HTML 파싱 미구현 + 정부·대학 사이트 봇 차단으로 fetch 실패가 흔해 errors 대신 info 로그.
    // v1.x HTML 파싱 도입 시 디버깅 단서 보존 — silent 차단 회피 (PR #20 review round 19).
    console.info(`[universities] ${university.school} fetch failed: ${redactErrorMessage(String(err?.message ?? 'unknown'))}`);
    return { school: university.school, level: university.level, annual: university.staticAnnual, fetchedFromPage: false };
  }
}

/**
 * 도시별 tuition 배열 생성
 * @param {string} cityId
 * @param {{useStatic?: boolean}} [opts]
 * @returns {Promise<{tuition: Array<{school: string, level: string, annual: number}>, errors: string[]}>}
 */
export async function getTuitionForCity(cityId, opts = {}) {
  const universities = UNIVERSITY_REGISTRY[cityId];
  if (!universities) {
    return { tuition: [], errors: [`Unknown city: ${cityId}`] };
  }

  const tuition = [];
  const errors = [];

  for (const uni of universities) {
    if (opts.useStatic) {
      tuition.push({ school: uni.school, level: uni.level, annual: uni.staticAnnual });
    } else {
      const result = await fetchUniversityTuition(uni);
      tuition.push({ school: result.school, level: result.level, annual: result.annual });
      if (!result.fetchedFromPage) {
        errors.push(`${uni.school}: page fetch failed, using static value`);
      }
    }
  }

  return { tuition, errors };
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * 모든 도시 tuition 갱신
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

    const { tuition, errors: tuitionErrors } = await getTuitionForCity(cityId, { useStatic: opts.useStatic });

    for (const err of tuitionErrors) {
      errors.push({ cityId, reason: err });
    }

    if (tuition.length === 0) {
      errors.push({ cityId, reason: 'No tuition data found' });
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

    const oldTuition = oldData?.tuition ?? [];
    let hasChanges = false;

    // **TODO (v1.x — `--useStatic` 제거 전 필수 수정, PR #20 review round 14)**:
    //   현재 인덱스 기반 비교는 `UNIVERSITY_REGISTRY` 의 학교 순서가 고정이라 안전하지만, v1.x 에서
    //   실제 HTML 파싱이 도입되면 학교 응답 순서가 바뀌었을 때 데이터 변경 없이도 모든 항목이
    //   `pr-update` 로 잘못 감지된다. 학교 이름 (`oldEntry.school`) key 기반 Map 비교로 전환 필요.
    //   `_outlier.mjs::iterNumericFields` 의 tuition 비교도 동일한 패턴으로 함께 갱신.
    for (let i = 0; i < tuition.length; i++) {
      const oldEntry = oldTuition[i];
      const newEntry = tuition[i];
      const oldAnnual = oldEntry?.annual ?? null;
      const newAnnual = newEntry.annual;

      if (oldAnnual !== newAnnual) {
        fields.push(`tuition[${i}].annual`);
        const pctChange = computePctChange(oldAnnual, newAnnual);
        changes.push({ cityId, field: `tuition[${i}].annual`, oldValue: oldAnnual, newValue: newAnnual, pctChange });
        hasChanges = true;
      }
    }

    if (oldTuition.length !== tuition.length) {
      hasChanges = true;
      fields.push('tuition.length');
    }

    if (!opts.dryRun && hasChanges) {
      const base = oldData ?? createCitySeed(config);
      const updatedData = { ...base, tuition };

      try {
        await writeCity(cityId, updatedData, SOURCE);
        updatedCities.push(cityId);
      } catch (err) {
        errors.push({ cityId, reason: `Write failed: ${redactErrorMessage(String(err?.message ?? 'unknown'))}` });
      }
    } else if (hasChanges) {
      updatedCities.push(cityId);
    }
  }

  return {
    source: 'universities',
    cities: updatedCities,
    fields: [...new Set(fields)],
    changes,
    errors,
  };
}
