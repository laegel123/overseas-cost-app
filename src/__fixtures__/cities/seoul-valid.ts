/**
 * Schema 검증 통과 보장 서울 fixture (KRW, 본국).
 * 학비·세금·비자 미포함 — 본국 도시는 비교 시 N/A (DATA_SOURCES.md §1).
 */

import type { CityCostData } from '@/types/city';

export const seoulValid: CityCostData = {
  id: 'seoul',
  name: { ko: '서울', en: 'Seoul' },
  country: 'KR',
  currency: 'KRW',
  region: 'asia',
  lastUpdated: '2026-05-02',
  rent: {
    share: 350_000,
    studio: 650_000,
    oneBed: 1_200_000,
    twoBed: 1_800_000,
  },
  food: {
    restaurantMeal: 10_400,
    cafe: 5_900,
    groceries: {
      milk1L: 3_200,
      eggs12: 2_600,
      rice1kg: 2_750,
      chicken1kg: 12_000,
      bread: 3_500,
      onion1kg: 2_500,
      apple1kg: 8_000,
      ramen: 900,
    },
  },
  transport: {
    monthlyPass: 65_000,
    singleRide: 1_400,
    taxiBase: 4_800,
  },
  sources: [
    {
      category: 'rent',
      name: '국토교통부 실거래가 공개시스템',
      url: 'https://rt.molit.go.kr/',
      accessedAt: '2026-05-02',
    },
    {
      category: 'food',
      name: '한국소비자원 참가격',
      url: 'https://www.price.go.kr/',
      accessedAt: '2026-05-02',
    },
    {
      category: 'food',
      name: '통계청 KOSIS 소비자물가지수',
      url: 'https://kosis.kr/',
      accessedAt: '2026-05-02',
    },
    {
      category: 'transport',
      name: '서울교통공사',
      url: 'http://www.seoulmetro.co.kr/',
      accessedAt: '2026-05-02',
    },
  ],
};
