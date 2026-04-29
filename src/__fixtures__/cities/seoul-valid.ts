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
  lastUpdated: '2026-04-01',
  rent: {
    share: 500_000,
    studio: 700_000,
    oneBed: 900_000,
    twoBed: 1_500_000,
    deposit: 10_000_000,
  },
  food: {
    restaurantMeal: 9_000,
    cafe: 5_000,
    groceries: {
      milk1L: 3_000,
      eggs12: 5_500,
      rice1kg: 4_500,
      chicken1kg: 12_000,
      bread: 4_000,
      onion1kg: 3_500,
      apple1kg: 8_000,
      ramen: 950,
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
      name: '국토교통부 실거래가',
      url: 'https://rt.molit.go.kr/',
      accessedAt: '2026-04-01',
    },
    {
      category: 'food',
      name: '한국소비자원 참가격',
      url: 'https://www.price.go.kr/',
      accessedAt: '2026-04-01',
    },
    {
      category: 'transport',
      name: '서울교통공사',
      url: 'https://www.seoulmetro.co.kr/',
      accessedAt: '2026-04-01',
    },
  ],
};
