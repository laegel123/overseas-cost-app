/**
 * Home 카드 배수용 단순화된 총비용 계산 (ADR-056 단일 출처).
 *
 * Home 화면 (`app/(tabs)/index.tsx`) 과 온보딩 도시 선택 화면이 동일 계산으로
 * 도시 배수를 표시하기 위해 공유하는 순수 함수. 페르소나·세금·비자비·학비를
 * 제외한 근사값이며, Compare 화면의 페르소나별 정밀 계산과 의도적으로 다르다
 * (ADR-056).
 */

import type { CityCostData, ExchangeRates } from '@/types/city';

import { convertToKRW } from './currency';
import { computeMultiplier } from './format';

const FOOD_RESTAURANT_DAYS_PER_MONTH = 20;
const FOOD_GROCERY_TRIPS_PER_MONTH = 4;

// Home 카드 배수용 단순화된 총비용. 페르소나·세금·비자비·학비 제외.
// Compare 화면의 페르소나별 정밀 계산과 의도적으로 다름 (ADR-056).
export function computeCityTotal(city: CityCostData, fx: ExchangeRates): number {
  const rent = city.rent.share ?? city.rent.studio ?? city.rent.oneBed ?? 0;
  const rentKRW = convertToKRW(rent, city.currency, fx);

  const meal = (city.food.restaurantMeal + city.food.cafe) * FOOD_RESTAURANT_DAYS_PER_MONTH;
  // groceries 4종 (milk / eggs / rice / chicken) 만 합산. ramen 은 optional 필드라
  // 의도적으로 제외 — Home 단순화 근사값 (ADR-056). 도시 간 비교 가능 지표만 포함.
  const groceryUnitSum =
    city.food.groceries.milk1L +
    city.food.groceries.eggs12 +
    city.food.groceries.rice1kg +
    city.food.groceries.chicken1kg;
  const foodTotal = meal + groceryUnitSum * FOOD_GROCERY_TRIPS_PER_MONTH;
  const foodKRW = convertToKRW(foodTotal, city.currency, fx);

  const transportKRW = convertToKRW(city.transport.monthlyPass, city.currency, fx);

  return rentKRW + foodKRW + transportKRW;
}

export function multFromTotals(
  city: CityCostData,
  seoulTotal: number,
  fx: ExchangeRates,
): number | '신규' {
  const cityTotal = computeCityTotal(city, fx);
  return computeMultiplier(seoulTotal, cityTotal);
}
