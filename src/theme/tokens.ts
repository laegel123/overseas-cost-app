/**
 * 단일 출처: tailwind.config.js. 본 파일은 NativeWind 클래스로 표현하기 어려운
 * 동적 값 (gradient, shadow Platform.select, 폰트 weight 매핑) 만 노출한다.
 *
 * 색 hex 가 필요한 경우 반드시 본 파일의 export 를 사용하라 — 컴포넌트에 hex 직접 박지 마라.
 * tailwind.config.js 의 colors 와 1:1 일치해야 한다 (변경 시 양쪽 동시 수정 + ADR).
 */

export const colors = {
  orange:       '#FC6011',
  orangeSoft:   '#FFE9DC',
  orangeTint:   '#FFF4ED',
  navy:         '#11263C',
  navy2:        '#1d3a55',
  gray:         '#52616B',
  gray2:        '#8A98A0',
  light:        '#F0F5F9',
  light2:       '#F7FAFC',
  white:        '#FFFFFF',
  line:         '#E4ECF2',
} as const;

export type ColorToken = keyof typeof colors;

export const gradients = {
  navyPersonaCard: { start: colors.navy, end: colors.navy2 } as const,
} as const;

import { Platform } from 'react-native';

/**
 * iOS 는 shadow*, Android 는 elevation 을 쓴다. 본 export 는 양쪽 모두 한 객체로 반환.
 * 컴포넌트는 `style={shadows.card}` 형태로 직접 적용.
 */
export const shadows = {
  card: Platform.select({
    ios: { shadowColor: colors.navy, shadowOpacity: 0.06, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 2 },
    default: {},
  }),
  deep: Platform.select({
    ios: { shadowColor: colors.navy, shadowOpacity: 0.10, shadowRadius: 50, shadowOffset: { width: 0, height: 20 } },
    android: { elevation: 6 },
    default: {},
  }),
  orangeCta: Platform.select({
    ios: { shadowColor: colors.orange, shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: 4 },
    default: {},
  }),
  orangeHero: Platform.select({
    ios: { shadowColor: colors.orange, shadowOpacity: 0.25, shadowRadius: 32, shadowOffset: { width: 0, height: 12 } },
    android: { elevation: 8 },
    default: {},
  }),
  navyCard: Platform.select({
    ios: { shadowColor: colors.navy, shadowOpacity: 0.18, shadowRadius: 32, shadowOffset: { width: 0, height: 12 } },
    android: { elevation: 6 },
    default: {},
  }),
} as const;

/**
 * Manrope / Mulish weight → React Native fontWeight 매핑.
 * NativeWind className 으로 fontFamily 만 지정하고 weight 는 inline style 로 설정할 때 사용.
 */
export const fontWeight = {
  regular:   '400',
  medium:    '500',
  semibold:  '600',
  bold:      '700',
  extrabold: '800',
} as const;
export type FontWeight = (typeof fontWeight)[keyof typeof fontWeight];

/**
 * Hot 판정 임계값 — CLAUDE.md CRITICAL.
 * isHot(mult) 함수는 src/lib/format.ts 에서 본 상수를 import 한다 (Phase 3).
 */
export const HOT_MULTIPLIER_THRESHOLD = 2.0;
