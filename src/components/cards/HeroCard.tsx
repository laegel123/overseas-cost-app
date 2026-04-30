/**
 * HeroCard — design/README §3 (orange Compare) + §4 (navy Detail). gradient
 * 보류 (step4.md, navy 단색 fallback). 시각 토큰은 모두 tailwind / tokens.ts.
 */

import * as React from 'react';

import { Pressable, type ViewStyle, View } from 'react-native';

import { colors, HERO_SEOUL_BAR_OPACITY, shadows } from '@/theme/tokens';

import { Icon } from '../Icon';
import { Display, H2, MonoLabel, Tiny } from '../typography/Text';

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
  /** padding 토큰 — orange 18px (`p-hero-pad`) / navy 16px (`p-4`, design Detail §4) */
  paddingClass: string;
  /** border-radius 토큰 — orange 22px (`rounded-hero-lg`) / navy 20px (`rounded-hero`) */
  radiusClass: string;
  /** progress 막대 두께 — orange 6px (`h-1.5`) / navy 4px (`h-1`) */
  barHeightClass: string;
  /** mult 텍스트 색 — orange variant 는 흰색, navy variant 는 orange 강조 */
  multColor: 'white' | 'orange';
  /** shadow 토큰 — orange 는 orangeHero (rgba 0.25), navy 는 navyCard (rgba 0.18) */
  shadowStyle: ViewStyle;
  /** 좌측 (서울) 막대 투명도 — orange 0.5, navy 0.15 (트랙) */
  seoulBarOpacity: number;
  /** 우측 (도시) 막대 색 — orange variant 는 흰색, navy variant 는 orange fill (design §4) */
  cityBarClass: string;
};

const VARIANT_CONFIG: Record<HeroCardVariant, VariantConfig> = {
  orange: {
    bgClass: 'bg-orange',
    paddingClass: 'p-hero-pad',
    radiusClass: 'rounded-hero-lg',
    barHeightClass: 'h-1.5',
    multColor: 'white',
    shadowStyle: shadows.orangeHero,
    seoulBarOpacity: HERO_SEOUL_BAR_OPACITY.orange,
    cityBarClass: 'bg-white',
  },
  navy: {
    bgClass: 'bg-navy',
    paddingClass: 'p-4',
    radiusClass: 'rounded-hero',
    barHeightClass: 'h-1',
    multColor: 'orange',
    shadowStyle: shadows.navyCard,
    seoulBarOpacity: HERO_SEOUL_BAR_OPACITY.navy,
    cityBarClass: 'bg-orange',
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
      style={v.shadowStyle}
      className={`${v.radiusClass} ${v.paddingClass} ${v.bgClass}`}
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
            // hitSlop 13*2 + icon 18 = 44 (iOS HIG 최소 터치 타겟, UI_GUIDE §617).
            hitSlop={{ top: 13, bottom: 13, left: 13, right: 13 }}
            {...(testID !== undefined ? { testID: `${testID}-info` } : {})}
          >
            <Icon name="info" size={18} color={colors.white} />
          </Pressable>
        )}
      </View>

      {/* 3-column row: 서울 / 가운데 mult / 도시
          - 좌(서울): H2 = 18px Manrope Bold 700 (design §3 / hi-fi compare.jsx)
          - 가운데(mult): Display = 30px Manrope ExtraBold 800 — 시각 계층 1순위
          - 우(도시): H2 size (18px) 에 fontFamily inline override → Manrope ExtraBold 800
            (design 은 우측 값을 좌측보다 무겁게 — 비교 대상 강조). */}
      <View className="flex-row items-end mt-3">
        <View className="flex-1">
          <Tiny color="white">{leftLabel}</Tiny>
          <H2 color="white" numberOfLines={1}>
            {leftValue}
          </H2>
        </View>
        <View
          className="items-center px-2 shrink-0"
          {...(testID !== undefined ? { testID: `${testID}-center` } : {})}
        >
          {/* shrink-0 — design §3 의 "flexShrink: 0 으로 squeeze 방지". 좌우
              flex-1 의 grow 압력에도 가운데 mult / caption 폭 보존. */}
          <Display color={v.multColor} numberOfLines={1}>
            {centerMult}
          </Display>
          {centerCaption !== undefined && (
            // numberOfLines={1} — design §3 의 "슬래시 줄바꿈 방지" (`+165만/월`)
            <MonoLabel color="white" numberOfLines={1}>
              {centerCaption}
            </MonoLabel>
          )}
        </View>
        <View className="flex-1 items-end">
          <Tiny color="white">{rightLabel}</Tiny>
          <H2
            color="white"
            numberOfLines={1}
            style={{ fontFamily: 'Manrope-ExtraBold' }}
          >
            {rightValue}
          </H2>
        </View>
      </View>

      {/* 하단 split bar — 서울/도시 비율 정규화 */}
      <View
        className={`flex-row mt-4 gap-1 ${v.barHeightClass}`}
        {...(testID !== undefined ? { testID: `${testID}-bars` } : {})}
      >
        {s > 0 && (
          <View
            style={{ flex: s, opacity: v.seoulBarOpacity }}
            className="bg-white rounded-full"
            {...(testID !== undefined ? { testID: `${testID}-bar-seoul` } : {})}
          />
        )}
        {c > 0 && (
          <View
            style={{ flex: c }}
            className={`${v.cityBarClass} rounded-full`}
            {...(testID !== undefined ? { testID: `${testID}-bar-city` } : {})}
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
