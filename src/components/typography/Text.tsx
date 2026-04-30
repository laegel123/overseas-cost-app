/**
 * 타이포 컴포넌트 8 variant — design/README.md §Typography 의 type scale.
 *
 * 단일 base + variant 매핑. 모든 spec 값 (fontFamily / size / color / line-height /
 * letter-spacing) 은 tailwind.config.js 토큰만 사용 — 매직 hex / 매직 px 금지
 * (CLAUDE.md CRITICAL).
 *
 * Public API: Display / H1 / H2 / H3 / Body / Small / Tiny / MonoLabel.
 * RN core `Text` 와 충돌 회피하려고 명명을 분리 — caller 는 본 모듈에서 import.
 */

import * as React from 'react';

import { Text as RNText, type StyleProp, type TextStyle } from 'react-native';

export type TextColor = 'navy' | 'gray' | 'gray-2' | 'white' | 'orange';

export type TextProps = {
  children: React.ReactNode;
  color?: TextColor;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  className?: string;
  accessibilityRole?: 'header' | 'text';
  testID?: string;
};

type Variant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'small'
  | 'tiny'
  | 'mono-label';

type VariantConfig = {
  /** tailwind className: font-family + size (size 는 line-height·letter-spacing 포함) */
  className: string;
  /** 기본 색상 — color prop 으로 override */
  defaultColor: TextColor;
  /** heading 류는 a11y role default 'header' */
  defaultRole: 'header' | 'text';
  /** MonoLabel 만 uppercase 자동 변환 */
  uppercase?: boolean;
};

const COLOR_CLASS: Record<TextColor, string> = {
  navy: 'text-navy',
  gray: 'text-gray',
  'gray-2': 'text-gray-2',
  white: 'text-white',
  orange: 'text-orange',
};

const VARIANT_CONFIG: Record<Variant, VariantConfig> = {
  display: {
    className: 'font-manrope-extrabold text-display',
    defaultColor: 'navy',
    defaultRole: 'header',
  },
  h1: {
    className: 'font-manrope-extrabold text-h1',
    defaultColor: 'navy',
    defaultRole: 'header',
  },
  h2: {
    className: 'font-manrope-bold text-h2',
    defaultColor: 'navy',
    defaultRole: 'header',
  },
  h3: {
    className: 'font-manrope-bold text-h3',
    defaultColor: 'navy',
    defaultRole: 'header',
  },
  body: {
    className: 'font-mulish text-body',
    defaultColor: 'navy',
    defaultRole: 'text',
  },
  small: {
    className: 'font-mulish text-small',
    defaultColor: 'gray',
    defaultRole: 'text',
  },
  tiny: {
    className: 'font-mulish text-tiny',
    defaultColor: 'gray-2',
    defaultRole: 'text',
  },
  'mono-label': {
    className: 'font-manrope-semibold text-mono-label',
    defaultColor: 'gray-2',
    defaultRole: 'text',
    uppercase: true,
  },
};

function makeVariant(variant: Variant) {
  function VariantComponent({
    children,
    color,
    numberOfLines,
    style,
    className,
    accessibilityRole,
    testID,
  }: TextProps): React.ReactElement {
    const config = VARIANT_CONFIG[variant];
    const colorClass = COLOR_CLASS[color ?? config.defaultColor];
    const role = accessibilityRole ?? config.defaultRole;
    const composedClassName = [config.className, colorClass, className]
      .filter(Boolean)
      .join(' ');

    const content = config.uppercase && typeof children === 'string'
      ? children.toUpperCase()
      : children;

    return (
      <RNText
        className={composedClassName}
        accessibilityRole={role}
        numberOfLines={numberOfLines}
        style={style}
        testID={testID}
      >
        {content}
      </RNText>
    );
  }
  // React DevTools 에서 'Display' / 'H1' 등 명시적 이름으로 보이도록.
  VariantComponent.displayName = variant;
  return VariantComponent;
}

export const Display = makeVariant('display');
export const H1 = makeVariant('h1');
export const H2 = makeVariant('h2');
export const H3 = makeVariant('h3');
export const Body = makeVariant('body');
export const Small = makeVariant('small');
export const Tiny = makeVariant('tiny');
export const MonoLabel = makeVariant('mono-label');
