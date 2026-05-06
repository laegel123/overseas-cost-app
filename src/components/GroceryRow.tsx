/**
 * GroceryRow — Detail 화면 식재료/외식 항목 행.
 * design/README §4 + UI_GUIDE §GroceryRow.
 *
 * Hot 판정은 isHot(mult) 단일 함수 사용 (CLAUDE.md CRITICAL).
 */

import * as React from 'react';

import { Pressable, Text, View } from 'react-native';

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
  /** 행 탭 핸들러 — 지정 시 Pressable 로 감싸 탭 가능. 미지정 시 일반 View. */
  onPress?: () => void;
  /**
   * 단일 선택 모드의 선택 상태. detail rent 처럼 "한 행 기준 비교" UI 에서
   * 선택된 행을 시각적으로 강조 — brand orange 배경 + 텍스트 white 반전 +
   * emoji box white 로 invert. 다른 카테고리는 미사용 (기본 false).
   *
   * 행이 카드 폭 끝까지 채워지도록 padding 은 본 컴포넌트 내부 (`px-3`) 로
   * 두고, 호출부는 wrapping padding 을 주지 않는다 (selected 배경이 카드
   * 좌우 모서리까지 닿게 — 사용자 피드백 2026-05-06).
   */
  selected?: boolean;
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
  onPress,
  selected = false,
  testID,
}: GroceryRowProps): React.ReactElement {
  const effectiveHot =
    hot !== undefined ? hot : isHot(mult);

  const multText = formatMultiplier(mult);
  // 디자인 의도 — design/README.md §4 "우측 배수 ... (hot=orange, normal=gray)".
  // ComparePair / FavCard / RecentRow 의 cool/mid 구분 (gray-2 / navy) 과 다르게
  // GroceryRow 는 hot 여부 1축 만 표현 — 그래서 lib `getMultColor` 미사용.
  // selected 일 땐 brand orange 배경 위라 white 로 반전 (배수 자체는 화살표 +
  // 숫자 3중 인코딩이라 색 정보 손실 없음).
  const multColor = selected ? 'white' : effectiveHot ? 'orange' : 'gray';
  const nameColor = selected ? 'white' : 'navy';
  const priceColor = selected ? 'white' : 'gray-2';

  // selected 일 땐 emoji box 를 white 로 invert — orange 배경 위에 emoji box 가
  // 묻히지 않도록.
  const emojiBoxClass = selected
    ? 'bg-white'
    : effectiveHot
      ? 'bg-orange-soft'
      : 'bg-light';

  // 행 자체 padding (`px-3`) — 호출부의 wrapping padding 을 옮긴 것. selected
  // 배경이 카드 좌우 모서리까지 닿도록 (`overflow-hidden` 카드 안에서 둥근
  // 모서리 자동 clip).
  const rowBgClass = selected ? 'bg-orange' : '';
  const rowClassName = `flex-row items-center px-3 py-2.5 gap-3 ${rowBgClass} ${
    isLast ? '' : 'border-b border-line'
  }`;

  const content = (
    <>
      {/* 이모지 박스 36×36 */}
      <View
        className={`w-9 h-9 items-center justify-center rounded-[10px] ${emojiBoxClass}`}
        {...(testID !== undefined ? { testID: `${testID}-emoji-box` } : {})}
      >
        <Text style={{ fontSize: 18 }}>{emoji}</Text>
      </View>

      {/* 품목명 + 가격 범위 */}
      <View className="flex-1 min-w-0">
        <Small color={nameColor} numberOfLines={1} className="font-manrope-bold">
          {name}
        </Small>
        <Tiny color={priceColor} numberOfLines={1}>
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
    </>
  );

  if (onPress !== undefined) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        className={rowClassName}
        testID={testID}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View className={rowClassName} testID={testID}>
      {content}
    </View>
  );
}
