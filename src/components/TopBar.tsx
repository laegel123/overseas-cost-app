/**
 * TopBar — 화면 상단 헤더. title (필수) + 옵셔널 subtitle / back 버튼 / 우측 버튼.
 *
 * 8 prop 조합 매트릭스 (TESTING.md §9.12). 모든 시각 토큰 (bg, padding, radius)
 * 은 tailwind config — 매직 hex / px 금지.
 *
 * 좌측 back 버튼: 36×36 light bg + Icon 'back'.
 * 우측 버튼: 36×36, 기본 bg 없음. accent='star' 일 때 orange-soft bg (즐겨찾기 강조).
 * title: H2 navy, 가운데 정렬, 1줄 ellipsis.
 * subtitle: title 아래 Tiny gray-2, 1줄 ellipsis.
 */

import * as React from 'react';

import { Pressable, View } from 'react-native';

import { Icon, type IconName } from './Icon';
import { H2, Tiny } from './typography/Text';

export type TopBarProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightIcon?: IconName;
  rightIconAccent?: 'default' | 'star';
  onRightPress?: () => void;
  testID?: string;
};

const BUTTON_SIZE_CLASS = 'w-9 h-9 rounded-icon-md items-center justify-center';

export function TopBar({
  title,
  subtitle,
  onBack,
  rightIcon,
  rightIconAccent = 'default',
  onRightPress,
  testID,
}: TopBarProps): React.ReactElement {
  const showBack = onBack !== undefined;
  const showRight = rightIcon !== undefined;
  const rightBgClass =
    rightIconAccent === 'star' ? 'bg-orange-soft' : 'bg-light';

  return (
    <View
      className="flex-row items-center px-screen-x-tight py-2"
      testID={testID}
    >
      {/* 좌측 — back 버튼 또는 균형용 placeholder */}
      <View className="w-9">
        {showBack && (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="뒤로가기"
            className={`${BUTTON_SIZE_CLASS} bg-light`}
            testID={testID !== undefined ? `${testID}-back` : undefined}
          >
            <Icon name="back" size={22} />
          </Pressable>
        )}
      </View>

      {/* 가운데 — title + subtitle */}
      <View className="flex-1 items-center px-2">
        <H2 numberOfLines={1}>{title}</H2>
        {subtitle !== undefined && <Tiny numberOfLines={1}>{subtitle}</Tiny>}
      </View>

      {/* 우측 — right 버튼 또는 균형용 placeholder */}
      <View className="w-9 items-end">
        {showRight && (
          <Pressable
            onPress={onRightPress}
            accessibilityRole="button"
            accessibilityLabel="우측 메뉴"
            className={`${BUTTON_SIZE_CLASS} ${rightBgClass}`}
            testID={testID !== undefined ? `${testID}-right` : undefined}
          >
            <Icon name={rightIcon} size={22} />
          </Pressable>
        )}
      </View>
    </View>
  );
}
