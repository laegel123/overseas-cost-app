/**
 * RecentRow — Home 화면 최근 본 도시 단일 행.
 * design/README §2 + UI_GUIDE §RecentRow.
 *
 * Hot 판정은 isHot(mult) 단일 함수 사용 (CLAUDE.md CRITICAL).
 */

import * as React from 'react';

import { Pressable, View } from 'react-native';

import { formatMultiplier, isHot } from '@/lib';
import { colors } from '@/theme/tokens';

import { Icon } from './Icon';
import { H3, Small, Tiny } from './typography/Text';

export type RecentRowProps = {
  cityId: string;
  /** 도시 한글명 — 예: "밴쿠버" */
  cityName: string;
  /** 도시 영문명 — 예: "Vancouver" */
  cityNameEn: string;
  /** 국가 코드 — 예: "CA" */
  countryCode: string;
  /** 배수 — 도시 vs 서울 */
  mult: number;
  /** 마지막 행 — bottom border 없음 */
  isLast?: boolean;
  onPress?: (cityId: string) => void;
  testID?: string;
};

export function RecentRow({
  cityId,
  cityName,
  cityNameEn,
  countryCode,
  mult,
  isLast = false,
  onPress,
  testID,
}: RecentRowProps): React.ReactElement {
  const hot = isHot(mult);
  const multText = formatMultiplier(mult);
  const multColor = getMultColor(mult, hot);

  const handlePress = () => {
    onPress?.(cityId);
  };

  const row = (
    <View
      className={`flex-row items-center px-3 py-2.5 rounded-[14px] bg-white ${
        isLast ? '' : 'border-b border-line'
      }`}
      testID={testID}
    >
      {/* 국가코드 박스 36×36 */}
      <View
        className="w-9 h-9 items-center justify-center rounded-[10px] bg-light mr-3"
        {...(testID !== undefined ? { testID: `${testID}-country-box` } : {})}
      >
        <Small color="navy" className="font-manrope-extrabold" numberOfLines={1}>
          {countryCode}
        </Small>
      </View>

      {/* 도시명 영역 */}
      <View className="flex-1 min-w-0">
        <H3 color="navy" numberOfLines={1} className="font-manrope-bold">
          {cityName}
        </H3>
        <Tiny color="gray-2" numberOfLines={1}>
          {cityNameEn}
        </Tiny>
      </View>

      {/* 배수 + chevron */}
      <View className="flex-row items-center gap-1 ml-2">
        <Small
          color={multColor}
          className="font-manrope-extrabold"
          numberOfLines={1}
          {...(testID !== undefined ? { testID: `${testID}-mult` } : {})}
        >
          {multText}
        </Small>
        <Icon
          name="chev-right"
          size={16}
          color={hot ? colors.orange : colors.gray2}
        />
      </View>
    </View>
  );

  if (onPress !== undefined) {
    return (
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`${cityName} 최근 본 도시`}
      >
        {row}
      </Pressable>
    );
  }

  return row;
}

/**
 * mult 값에 따른 텍스트 색상 결정.
 * - hot (>=2.0) → orange
 * - < 1.0 (cool) → gray-2
 * - 1.0 (동일) → gray-2
 * - 그 외 → navy
 */
function getMultColor(mult: number, hot: boolean): 'orange' | 'navy' | 'gray-2' {
  if (hot) {
    return 'orange';
  }
  const rounded = Math.round(mult * 10) / 10;
  if (rounded <= 1.0) {
    return 'gray-2';
  }
  return 'navy';
}
