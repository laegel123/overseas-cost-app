/**
 * 카테고리 표시 메타 — 라벨·아이콘·순서 단일 출처 (ADR-071).
 *
 * 이전에는 라벨이 `app/detail/[cityId]/[category].tsx` 와
 * `app/compare/[cityId].tsx` 에, 아이콘이 `src/components/ComparePair.tsx` 에
 * 각각 흩어져 있었다. 출처 화면(`app/sources/*`)이 같은 값을 세 번째로 필요로
 * 하면서 한 곳으로 모았다.
 *
 * `IconName` 은 **타입 전용** import — lib 이 components 의 런타임 값에
 * 의존하지 않는다.
 */

import type { IconName } from '@/components/Icon';
import type { SourceCategory } from '@/types/city';

/** 카테고리 한국어 라벨 — 화면 표기 단일 출처. */
export const CATEGORY_LABEL: Record<SourceCategory, string> = {
  rent: '월세',
  food: '식비',
  transport: '교통',
  tuition: '학비',
  tax: '세금',
  visa: '비자/정착',
};

/** 카테고리 아이콘 — Icon 컴포넌트 이름 단일 출처. */
export const CATEGORY_ICON: Record<SourceCategory, IconName> = {
  rent: 'house',
  food: 'fork',
  transport: 'bus',
  tuition: 'graduation',
  tax: 'briefcase',
  visa: 'passport',
};

/**
 * 화면 표시 순서 — Compare 카드 순서(`COMPARE_CATEGORIES`)와 동일.
 * rent → food → transport → tuition → tax → visa
 */
export const CATEGORY_ORDER: readonly SourceCategory[] = [
  'rent',
  'food',
  'transport',
  'tuition',
  'tax',
  'visa',
];
