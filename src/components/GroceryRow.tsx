/**
 * GroceryRow — Detail 화면 식재료/외식 항목 행.
 * design/README §4 + UI_GUIDE §GroceryRow.
 *
 * Hot 판정은 isHot(mult) 단일 함수 사용 (CLAUDE.md CRITICAL).
 */

import * as React from 'react';

import { Text, View } from 'react-native';

import { formatMultiplier, isHot } from '@/lib';

import { Small, Tiny } from './typography/Text';

export type GroceryRowProps = {
  /** 품목명 — 예: "라멘 한 그릇" */
  name: string;
  /** 이모지 — 예: "🍜" */
  emoji: string;
  /** 서울 가격 문자열 — 예: "1.2만" */
  seoulPrice: string;
  /** 도시 가격 문자열 — 예: "2.2만" */
  cityPrice: string;
  /** 배수 */
  mult: number;
  /** 마지막 행 — bottom border 없음 */
  isLast?: boolean;
  /** hot override — 미지정 시 isHot(mult) 자동 판정 */
  hot?: boolean;
  testID?: string;
};

export function GroceryRow({
  name,
  emoji,
  seoulPrice,
  cityPrice,
  mult,
  isLast = false,
  hot,
  testID,
}: GroceryRowProps): React.ReactElement {
  const effectiveHot =
    hot !== undefined ? hot : isHot(mult);

  const multText = formatMultiplier(mult);
  // 디자인 의도 — design/README.md §4 "우측 배수 ... (hot=orange, normal=gray)".
  // ComparePair / FavCard / RecentRow 의 cool/mid 구분 (gray-2 / navy) 과 다르게
  // GroceryRow 는 hot 여부 1축 만 표현 — 그래서 lib `getMultColor` 미사용.
  const multColor = effectiveHot ? 'orange' : 'gray';

  return (
    <View
      className={`flex-row items-center py-2.5 gap-3 ${
        isLast ? '' : 'border-b border-line'
      }`}
      testID={testID}
    >
      {/* 이모지 박스 36×36 */}
      <View
        className={`w-9 h-9 items-center justify-center rounded-[10px] ${
          effectiveHot ? 'bg-orange-soft' : 'bg-light'
        }`}
        {...(testID !== undefined ? { testID: `${testID}-emoji-box` } : {})}
      >
        <Text style={{ fontSize: 18 }}>{emoji}</Text>
      </View>

      {/* 품목명 + 가격 범위 */}
      <View className="flex-1 min-w-0">
        <Small color="navy" numberOfLines={1} className="font-manrope-bold">
          {name}
        </Small>
        <Tiny color="gray-2" numberOfLines={1}>
          {seoulPrice} → {cityPrice}
        </Tiny>
      </View>

      {/* 배수 */}
      <Small
        color={multColor}
        className="font-manrope-extrabold shrink-0"
        numberOfLines={1}
        {...(testID !== undefined ? { testID: `${testID}-mult` } : {})}
      >
        {multText}
      </Small>
    </View>
  );
}
