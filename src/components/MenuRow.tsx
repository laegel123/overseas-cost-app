/**
 * MenuRow — 설정 화면 메뉴 행. design/README §5 (Settings — 메뉴 리스트).
 *
 * variant 3 종 — default / hot / dim. icon 박스 36×36 + label + 옵션
 * rightText + chevron. isLast 행은 bottom border 제거.
 *
 * 모든 시각 토큰 (bg, text, border, radius, padding) 은 tailwind config —
 * 매직 hex / px 금지 (CLAUDE.md CRITICAL).
 */

import * as React from 'react';

import { Pressable, View } from 'react-native';

import { type ColorToken, colors } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Body, Tiny } from './typography/Text';

export type MenuRowVariant = 'default' | 'hot' | 'dim';

export type MenuRowProps = {
  icon: IconName;
  label: string;
  rightText?: string;
  variant?: MenuRowVariant;
  isLast?: boolean;
  disabled?: boolean;
  /** 기본 true. dim variant 류에서 chevron 미표시 시 false. */
  showChevron?: boolean;
  onPress?: () => void;
  testID?: string;
};

type VariantStyle = {
  iconBoxClass: string;
  iconColor: (typeof colors)[ColorToken];
  labelColor: 'navy' | 'gray-2';
};

const VARIANT_STYLE: Record<MenuRowVariant, VariantStyle> = {
  default: {
    iconBoxClass: 'bg-light',
    iconColor: colors.navy,
    labelColor: 'navy',
  },
  hot: {
    iconBoxClass: 'bg-orange-soft',
    iconColor: colors.orange,
    labelColor: 'navy',
  },
  dim: {
    iconBoxClass: 'bg-light',
    iconColor: colors.gray2,
    labelColor: 'gray-2',
  },
};

export function MenuRow({
  icon,
  label,
  rightText,
  variant = 'default',
  isLast = false,
  disabled = false,
  showChevron = true,
  onPress,
  testID,
}: MenuRowProps): React.ReactElement {
  const v = VARIANT_STYLE[variant];
  const borderClass = isLast ? '' : 'border-b border-line';
  const opacityClass = disabled ? 'opacity-50' : '';
  // padding 14×14 (`px/py-card-pad`) — design/README §5 사양.
  const containerClass = [
    'flex-row items-center px-card-pad py-card-pad gap-3',
    borderClass,
    opacityClass,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      // disabled prop 명시 — Pressable 의 native press feedback (Android ripple,
      // iOS pressed opacity) 까지 차단. onPress=undefined 만으로는 시각 피드백
      // 이 발생할 수 있음.
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className={containerClass}
      testID={testID}
    >
      <View
        className={`w-9 h-9 rounded-icon-sm items-center justify-center ${v.iconBoxClass}`}
      >
        {/* design/README §5 — 아이콘 박스 36×36, 10px 라운드 (rounded-icon-sm) */}
        <Icon name={icon} size={22} color={v.iconColor} />
      </View>
      <View className="flex-1">
        <Body color={v.labelColor} numberOfLines={1}>
          {label}
        </Body>
      </View>
      {rightText !== undefined && (
        // Tiny 의 default color (gray-2) 가 모든 variant 에서 동일 — design/README
        // §5 의 메뉴 row 사양상 right text 는 항상 회색 보조 정보. dim variant
        // 에서도 별도 강조 필요 없음.
        <Tiny numberOfLines={1}>{rightText}</Tiny>
      )}
      {showChevron && (
        <Icon
          name="chev-right"
          size={22}
          color={colors.gray2}
          {...(testID !== undefined ? { testID: `${testID}-chevron` } : {})}
        />
      )}
    </Pressable>
  );
}
