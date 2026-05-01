/**
 * FavCard — Home 화면 즐겨찾기 가로 스크롤 카드.
 * design/README §2 + UI_GUIDE §FavCard.
 *
 * accent=true: navy bg (첫 카드), accent=false: white bg + border.
 * Hot 판정은 isHot(mult) 단일 함수 사용 (CLAUDE.md CRITICAL).
 */

import * as React from 'react';

import { Pressable, View } from 'react-native';

import { formatMultiplier, getMultColor, isHot } from '@/lib';
import {
  colors,
  FAV_CARD_LABEL_OPACITY,
  FAV_CARD_SUB_OPACITY,
} from '@/theme/tokens';

import { Icon } from './Icon';
import { H3, Tiny } from './typography/Text';

export type FavCardProps = {
  cityId: string;
  /** 도시 한글명 — 예: "밴쿠버" */
  cityName: string;
  /** 도시 영문명 — 예: "Vancouver" */
  cityNameEn: string;
  /** 국가 코드 — 예: "CA" */
  countryCode: string;
  /** 배수 — 도시 vs 서울 */
  mult: number;
  /** true = navy bg (첫 카드), false = white bg */
  accent?: boolean;
  onPress?: (cityId: string) => void;
  testID?: string;
};

export function FavCard({
  cityId,
  cityName,
  cityNameEn,
  countryCode,
  mult,
  accent = false,
  onPress,
  testID,
}: FavCardProps): React.ReactElement {
  const hot = isHot(mult);
  const multText = formatMultiplier(mult);
  const multColor = getMultColor(mult, hot);

  // 가로 스크롤 리스트에서 반복 렌더되므로 콜백 안정화 (PR #16 review 이슈 1).
  const handlePress = React.useCallback(() => {
    onPress?.(cityId);
  }, [onPress, cityId]);

  const card = (
    <View
      className={`min-w-[168px] p-4 rounded-card-lg ${
        accent ? 'bg-navy' : 'bg-white border border-line'
      }`}
      testID={testID}
    >
      {/* 상단: 국가코드 + star */}
      <View className="flex-row items-center justify-between mb-2">
        <View
          className={`w-8 h-6 items-center justify-center rounded ${
            accent ? 'bg-white/20' : 'bg-light'
          }`}
          {...(testID !== undefined ? { testID: `${testID}-country-box` } : {})}
        >
          <Tiny
            color={accent ? 'white' : 'navy'}
            className="font-manrope-extrabold"
            numberOfLines={1}
          >
            {countryCode}
          </Tiny>
        </View>
        <Icon
          name="star"
          size={16}
          color={accent ? colors.white : colors.orange}
          {...(testID !== undefined ? { testID: `${testID}-star` } : {})}
        />
      </View>

      {/* 도시명 */}
      <H3
        color={accent ? 'white' : 'navy'}
        numberOfLines={1}
        className="font-manrope-extrabold"
      >
        {cityName}
      </H3>

      {/* 영문명 */}
      <Tiny
        color={accent ? 'white' : 'gray-2'}
        numberOfLines={1}
        style={{ opacity: FAV_CARD_SUB_OPACITY }}
        {...(testID !== undefined ? { testID: `${testID}-sub` } : {})}
      >
        {cityNameEn}
      </Tiny>

      {/* 배수 + vs 서울 */}
      <View className="mt-2 flex-row items-baseline gap-1">
        <H3
          color={accent && !hot ? 'white' : multColor}
          className="text-2xl font-manrope-extrabold"
          numberOfLines={1}
          {...(testID !== undefined ? { testID: `${testID}-mult` } : {})}
        >
          {multText}
        </H3>
        <Tiny
          color={accent ? 'white' : 'gray-2'}
          style={{ opacity: FAV_CARD_LABEL_OPACITY }}
          numberOfLines={1}
        >
          vs 서울
        </Tiny>
      </View>
    </View>
  );

  if (onPress !== undefined) {
    return (
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`${cityName} 즐겨찾기 카드`}
      >
        {card}
      </Pressable>
    );
  }

  return card;
}
