/**
 * HeroCard — Compare 화면의 시각 핵심. 한 달 예상 총비용 + 서울 vs 도시 듀얼
 * 막대 + ❓ info 아이콘 hook. design/README §3 (Compare hero card).
 *
 * variant 2 종:
 *   - 'orange' (Compare 화면 기본): bg-orange + 6px progress + hero shadow
 *   - 'navy' (옵션, persona-style): bg-navy + 4px progress + mult orange 강조
 *
 * 모든 시각 토큰 (bg, text, shadow, radius) 은 tailwind config / tokens.ts —
 * 매직 hex / px 금지 (CLAUDE.md CRITICAL).
 *
 * gradient 도입 보류 (step4.md): expo-linear-gradient 미도입. navy variant
 * 는 단색 fallback. design 의 gradient 는 후속 phase 에서 ADR + 라이브러리
 * 도입으로 결정.
 *
 * swPct / cwPct 정규화: clamp [0, 1] 후 합 = 1 로 비율 보존. 합이 0 이면
 * 막대 미표시.
 */

import * as React from 'react';

import { Pressable, View } from 'react-native';

import { colors, shadows } from '@/theme/tokens';

import { Icon } from '../Icon';
import { Display, MonoLabel, Tiny } from '../typography/Text';

export type HeroCardVariant = 'orange' | 'navy';

export type HeroCardProps = {
  variant: HeroCardVariant;
  /** 좌측 작은 라벨 — 예: "서울" */
  leftLabel: string;
  /** 좌측 큰 값 — 예: "175만/월" */
  leftValue: string;
  /** 가운데 큰 배수 — 예: "↑1.9×" */
  centerMult: string;
  /** 가운데 caption — 예: "+165만/월" (슬래시 줄바꿈 방지) */
  centerCaption?: string;
  /** 우측 작은 라벨 — 예: "밴쿠버" */
  rightLabel: string;
  /** 우측 큰 값 — 예: "340만/월" */
  rightValue: string;
  /** 서울 막대 비율 [0, 1] */
  swPct: number;
  /** 도시 막대 비율 [0, 1] */
  cwPct: number;
  /** 출처 footer — 예: "평균 가정 기준" */
  footer?: string;
  /** ❓ info 아이콘 표시 여부 (기본 true) */
  showInfoIcon?: boolean;
  onInfoPress?: () => void;
  testID?: string;
};

type VariantConfig = {
  bgClass: string;
  /** progress 막대 두께 — orange 6px / navy 4px */
  barHeightClass: string;
  /** mult 텍스트 색 — orange variant 는 흰색, navy variant 는 orange 강조 */
  multColor: 'white' | 'orange';
};

const VARIANT_CONFIG: Record<HeroCardVariant, VariantConfig> = {
  orange: {
    bgClass: 'bg-orange',
    barHeightClass: 'h-1.5', // 6px
    multColor: 'white',
  },
  navy: {
    bgClass: 'bg-navy',
    barHeightClass: 'h-1', // 4px
    multColor: 'orange',
  },
};

/**
 * swPct + cwPct 정규화 — 음수 / >1 clamp 후 합 = 1 로 비율 보존. 합이 0 이면
 * 막대 미표시 (`{ s: 0, c: 0 }`). silent fail 회피 위해 dev 콘솔 warn.
 */
function normalizeBarPcts(swPct: number, cwPct: number): { s: number; c: number } {
  const s = Math.max(0, Math.min(1, swPct));
  const c = Math.max(0, Math.min(1, cwPct));
  /* istanbul ignore else: __DEV__ 는 jest 환경에서 항상 true — production 분기는 운영 빌드 한정 */
  if (__DEV__ && (s !== swPct || c !== cwPct)) {
    // eslint-disable-next-line no-console
    console.warn(
      `[HeroCard] swPct/cwPct out of [0,1] — clamped. (sw=${swPct}, cw=${cwPct})`,
    );
  }
  const total = s + c;
  if (total === 0) return { s: 0, c: 0 };
  return { s: s / total, c: c / total };
}

export function HeroCard({
  variant,
  leftLabel,
  leftValue,
  centerMult,
  centerCaption,
  rightLabel,
  rightValue,
  swPct,
  cwPct,
  footer,
  showInfoIcon = true,
  onInfoPress,
  testID,
}: HeroCardProps): React.ReactElement {
  const v = VARIANT_CONFIG[variant];
  const { s, c } = normalizeBarPcts(swPct, cwPct);

  return (
    <View
      style={shadows.card}
      className={`rounded-hero-lg p-card-pad ${v.bgClass}`}
      testID={testID}
    >
      {/* 상단 라벨 + ❓ info 아이콘 */}
      <View className="flex-row items-center justify-between">
        <MonoLabel color="white">한 달 예상 총비용</MonoLabel>
        {showInfoIcon && onInfoPress !== undefined && (
          <Pressable
            onPress={onInfoPress}
            accessibilityRole="button"
            accessibilityLabel="가정값 자세히 보기"
            hitSlop={8}
            {...(testID !== undefined ? { testID: `${testID}-info` } : {})}
          >
            <Icon name="info" size={18} color={colors.white} />
          </Pressable>
        )}
      </View>

      {/* 3-column row: 서울 / 가운데 mult / 도시 */}
      <View className="flex-row items-end mt-3">
        <View className="flex-1">
          <Tiny color="white">{leftLabel}</Tiny>
          <Display color="white" numberOfLines={1}>
            {leftValue}
          </Display>
        </View>
        <View className="items-center px-2">
          <Display color={v.multColor} numberOfLines={1}>
            {centerMult}
          </Display>
          {centerCaption !== undefined && (
            <MonoLabel color="white">{centerCaption}</MonoLabel>
          )}
        </View>
        <View className="flex-1 items-end">
          <Tiny color="white">{rightLabel}</Tiny>
          <Display color="white" numberOfLines={1}>
            {rightValue}
          </Display>
        </View>
      </View>

      {/* 하단 split bar — 서울/도시 비율 정규화 */}
      <View className={`flex-row mt-4 gap-1 ${v.barHeightClass}`}>
        {s > 0 && (
          <View
            style={{ flex: s, opacity: 0.5 }}
            className="bg-white rounded-full"
            testID={testID !== undefined ? `${testID}-bar-seoul` : undefined}
          />
        )}
        {c > 0 && (
          <View
            style={{ flex: c }}
            className="bg-white rounded-full"
            testID={testID !== undefined ? `${testID}-bar-city` : undefined}
          />
        )}
      </View>

      {/* footer */}
      {footer !== undefined && (
        <View className="mt-3">
          <Tiny color="white">{footer}</Tiny>
        </View>
      )}
    </View>
  );
}
