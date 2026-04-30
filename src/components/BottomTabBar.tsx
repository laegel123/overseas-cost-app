/**
 * BottomTabBar — 4 탭 (홈 / 비교 / 즐겨찾기 / 설정). PRD §F1 4 탭 고정.
 *
 * active 탭은 orange icon + orange label, inactive 는 gray-2.
 * useSafeAreaInsets 의 bottom 값으로 home indicator 영역 padding 자동 보정
 * (iPhone X+ ~14px, SE 0).
 *
 * 라벨 size 는 tailwind `text-tab-label` 토큰 (10px). design/README 의
 * "Mulish 600" 은 Mulish-SemiBold 폰트 에셋 부재로 Mulish Regular 로 대체 —
 * 시각 차이 minor, v1.x 에서 에셋 추가 시 weight 갱신.
 *
 * 햅틱 / 애니메이션은 v1.0 미스코프 — 별도 ADR.
 */

import * as React from 'react';

import { Pressable, Text as RNText, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';

export type Tab = 'home' | 'compare' | 'favorites' | 'settings';

export type BottomTabBarProps = {
  active: Tab;
  onSelect: (tab: Tab) => void;
  testID?: string;
};

type TabConfig = { tab: Tab; icon: IconName; label: string };

const TABS: readonly TabConfig[] = [
  { tab: 'home', icon: 'home', label: '홈' },
  { tab: 'compare', icon: 'compare', label: '비교' },
  { tab: 'favorites', icon: 'star', label: '즐겨찾기' },
  { tab: 'settings', icon: 'settings', label: '설정' },
];

export function BottomTabBar({
  active,
  onSelect,
  testID,
}: BottomTabBarProps): React.ReactElement {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row bg-white border-t border-line"
      style={{ paddingBottom: insets.bottom }}
      testID={testID}
    >
      {TABS.map(({ tab, icon, label }) => {
        const isActive = tab === active;
        const color = isActive ? colors.orange : colors.gray2;
        const labelColorClass = isActive ? 'text-orange' : 'text-gray-2';
        return (
          <Pressable
            key={tab}
            onPress={() => onSelect(tab)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={label}
            className="flex-1 items-center py-2"
            testID={testID !== undefined ? `${testID}-${tab}` : undefined}
          >
            <Icon name={icon} size={22} color={color} />
            <RNText
              className={`mt-0.5 text-tab-label font-mulish ${labelColorClass}`}
              numberOfLines={1}
            >
              {label}
            </RNText>
          </Pressable>
        );
      })}
    </View>
  );
}
