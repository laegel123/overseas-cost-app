/**
 * ComparePair — Compare 화면 카테고리별 듀얼 바 카드.
 * design/README §3 + UI_GUIDE §ComparePair.
 *
 * Hot 판정은 isHot(mult) 단일 함수 사용 (CLAUDE.md CRITICAL).
 */

import * as React from 'react';

import { Pressable, View } from 'react-native';

import { formatMultiplier, isHot } from '@/lib';
import { colors } from '@/theme/tokens';
import type { SourceCategory } from '@/types/city';

import { Icon, type IconName } from './Icon';
import { H3, Small } from './typography/Text';

export type ComparePairProps = {
  category: SourceCategory;
  /** 카테고리 라벨 — 예: "월세" */
  label: string;
  /** 서울 라벨 — 예: "서울" */
  sLabel: string;
  /** 서울 값 — 예: "120만" */
  sValue: string;
  /** 도시 라벨 — 예: "밴쿠버" */
  cLabel: string;
  /** 도시 값 — 예: "240만" */
  cValue: string;
  /** 배수 — 1.0 = 동일, > 1 = 도시가 비쌈 */
  mult: number | '신규';
  /** 서울 막대 폭 [0, 1] */
  swPct: number;
  /** 도시 막대 폭 [0, 1] */
  cwPct: number;
  /** hot override — 미지정 시 isHot(mult) 자동 판정 */
  hot?: boolean;
  onPress?: () => void;
  testID?: string;
};

const CATEGORY_ICON: Record<SourceCategory, IconName> = {
  rent: 'house',
  food: 'fork',
  transport: 'bus',
  tuition: 'graduation',
  tax: 'briefcase',
  visa: 'passport',
};

/**
 * 막대 폭 clamp [0, 1]. 범위 벗어나면 dev warn.
 */
function clampPct(pct: number, name: string): number {
  const clamped = Math.max(0, Math.min(1, pct));
  /* istanbul ignore else: __DEV__ 는 jest 환경에서 항상 true */
  if (__DEV__ && clamped !== pct) {
    // eslint-disable-next-line no-console
    console.warn(`[ComparePair] ${name} out of [0,1] — clamped. (${pct})`);
  }
  return clamped;
}

export function ComparePair({
  category,
  label,
  sLabel,
  sValue,
  cLabel,
  cValue,
  mult,
  swPct,
  cwPct,
  hot,
  onPress,
  testID,
}: ComparePairProps): React.ReactElement {
  const effectiveHot =
    hot !== undefined ? hot : typeof mult === 'number' && isHot(mult);

  const iconName = CATEGORY_ICON[category];
  const sw = clampPct(swPct, 'swPct');
  const cw = clampPct(cwPct, 'cwPct');

  const multText = formatMultiplier(mult);
  const multColor = getMultColor(mult, effectiveHot);

  const card = (
    <View
      className="bg-white border border-line rounded-card p-3"
      testID={testID}
    >
      {/* 헤더: 아이콘 박스 + 라벨 / 배수 */}
      <View className="flex-row items-center justify-between mb-2 gap-2">
        <View className="flex-row items-center gap-2 flex-1 min-w-0">
          <View
            className={`w-8 h-8 rounded-icon-sm items-center justify-center ${
              effectiveHot ? 'bg-orange-soft' : 'bg-light'
            }`}
            {...(testID !== undefined ? { testID: `${testID}-icon-box` } : {})}
          >
            <Icon
              name={iconName}
              size={18}
              color={effectiveHot ? colors.orange : colors.navy}
            />
          </View>
          <H3 numberOfLines={1}>{label}</H3>
        </View>
        <H3
          color={multColor}
          numberOfLines={1}
          className="shrink-0 font-manrope-extrabold"
          {...(testID !== undefined ? { testID: `${testID}-mult` } : {})}
        >
          {multText}
        </H3>
      </View>

      {/* 막대 영역 */}
      <View className="gap-1.5">
        {/* 서울 행 */}
        <View className="flex-row items-center gap-2">
          <Small
            color="gray-2"
            numberOfLines={1}
            className="w-7 font-manrope-bold"
          >
            {sLabel}
          </Small>
          <View className="flex-1 h-2 bg-light rounded">
            {sw > 0 && (
              <View
                style={{ width: `${sw * 100}%` }}
                className="h-2 bg-gray rounded"
                {...(testID !== undefined ? { testID: `${testID}-bar-seoul` } : {})}
              />
            )}
          </View>
          <Small
            color="gray"
            numberOfLines={1}
            className="w-14 text-right font-manrope-semibold"
          >
            {sValue}
          </Small>
        </View>

        {/* 도시 행 */}
        <View className="flex-row items-center gap-2">
          <Small
            color="orange"
            numberOfLines={1}
            className="w-7 font-manrope-bold"
          >
            {cLabel}
          </Small>
          <View className="flex-1 h-2 bg-light rounded">
            {cw > 0 && (
              <View
                style={{ width: `${cw * 100}%` }}
                className="h-2 bg-orange rounded"
                {...(testID !== undefined ? { testID: `${testID}-bar-city` } : {})}
              />
            )}
          </View>
          <Small
            color="navy"
            numberOfLines={1}
            className="w-14 text-right font-manrope-bold"
          >
            {cValue}
          </Small>
        </View>
      </View>
    </View>
  );

  if (onPress !== undefined) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button">
        {card}
      </Pressable>
    );
  }

  return card;
}

/**
 * mult 값과 hot 상태에 따른 텍스트 색상 결정.
 * - effectiveHot=true → orange
 * - '신규' → navy
 * - mult=1.0 (동일) → gray-2
 * - mult < 1 (cool) → gray-2
 * - 그 외 → navy
 */
function getMultColor(
  mult: number | '신규',
  effectiveHot: boolean,
): 'orange' | 'navy' | 'gray-2' {
  if (effectiveHot) {
    return 'orange';
  }
  if (mult === '신규') {
    return 'navy';
  }
  const rounded = Math.round(mult * 10) / 10;
  if (rounded <= 1.0) {
    return 'gray-2';
  }
  return 'navy';
}
