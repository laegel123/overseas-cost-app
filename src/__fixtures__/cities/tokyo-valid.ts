/**
 * Schema 검증 통과 보장 도쿄 fixture (JPY — 소수 없는 통화).
 *
 * 도시끼리 비교(ADR-089) 테스트용 **두 번째 비-서울 도시**. 값과 모양은 실데이터
 * (`data/cities/tokyo.json`) 를 따른다 — `tuition` 3개 + `visa` 보유, `tax` 없음
 * (v1.0 은 21개 도시 전부 tax 가 비어 있다). 밴쿠버 fixture 는 tax 를 갖고 있어
 * 두 fixture 를 맞붙이면 "한쪽만 결측" 조합을 그대로 재현할 수 있다.
 */

import type { CityCostData } from '@/types/city';

export const tokyoValid: CityCostData = {
  id: 'tokyo',
  name: { ko: '도쿄', en: 'Tokyo' },
  country: 'JP',
  currency: 'JPY',
  region: 'asia',
  lastUpdated: '2026-09-07',
  rent: {
    share: 65_000,
    studio: 85_000,
    oneBed: 110_000,
    twoBed: 160_000,
  },
  food: {
    restaurantMeal: 1_200,
    cafe: 500,
    groceries: {
      milk1L: 220,
      eggs12: 280,
      rice1kg: 450,
      chicken1kg: 900,
      bread: 180,
      onion1kg: 350,
      apple1kg: 600,
      ramen: 120,
    },
  },
  transport: {
    monthlyPass: 10_600,
    singleRide: 180,
    taxiBase: 500,
  },
  tuition: [
    { school: '東京大学', level: 'undergrad', annual: 535_800 },
    { school: '早稲田大学', level: 'undergrad', annual: 1_500_000 },
    { school: '慶應義塾大学', level: 'undergrad', annual: 1_600_000 },
  ],
  visa: {
    studentApplicationFee: 3_000,
    workApplicationFee: 6_000,
    settlementApprox: 200_000,
  },
  sources: [
    {
      category: 'rent',
      name: 'e-Stat 住宅・土地統計調査',
      url: 'https://www.e-stat.go.jp/stat-search/files?page=1&toukei=00200522',
      accessedAt: '2026-05-03',
    },
    {
      category: 'food',
      name: 'e-Stat 消費者物価指数',
      url: 'https://www.e-stat.go.jp/stat-search/files?page=1&toukei=00200573',
      accessedAt: '2026-05-03',
    },
    {
      category: 'transport',
      name: '東京メトロ',
      url: 'https://www.tokyometro.jp/en/ticket/',
      accessedAt: '2026-05-03',
    },
    {
      category: 'tuition',
      name: '東京大学 공식 국제학생 학비 페이지',
      url: 'https://www.u-tokyo.ac.jp/en/prospective-students/admission_fees.html',
      accessedAt: '2026-09-07',
    },
    {
      category: 'visa',
      name: '일본 외무성 공식 비자 수수료 페이지',
      url: 'https://www.mofa.go.jp/j_info/visit/visa/short/novisa.html',
      accessedAt: '2026-09-07',
    },
  ],
};
