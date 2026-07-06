/**
 * 하단 탭 레이아웃 — 4탭 (홈/비교/즐겨찾기/설정).
 *
 * 탭 바 UI 는 `src/components/BottomTabBar.tsx`(제어형) 를 expo-router Tabs 의
 * `tabBar` prop 에 어댑터로 연결해 렌더한다 (ARCHITECTURE.md §Shell). §125 스펙
 * (active=orange / inactive=gray-2, icon 22px, label 10px Mulish) 은 BottomTabBar
 * 단일 출처 — _layout 에 중복 구현하지 않는다.
 *
 * ADR-041: v1.0 비교·즐겨찾기 탭은 라우팅 단축으로 동작.
 * - 비교 탭 = recent[0] 또는 favorites[0]으로 redirect
 * - 즐겨찾기 탭 = favorites[0]으로 redirect
 * - 도시 0개 시 = 홈으로 이동 + Alert 안내 (토스트 미구현)
 */

import * as React from 'react';

import { Alert } from 'react-native';

import { Tabs, useRouter } from 'expo-router';

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { BottomTabBar, type Tab } from '@/components/BottomTabBar';
import { useFavoritesStore } from '@/store/favorites';
import { useRecentStore } from '@/store/recent';

type TabPressEvent = {
  preventDefault: () => void;
};

// expo-router route name ↔ BottomTabBar Tab 매핑 (index 스크린 = 'home' 탭).
const ROUTE_TO_TAB: Record<string, Tab> = {
  index: 'home',
  compare: 'compare',
  favorites: 'favorites',
  settings: 'settings',
};
const TAB_TO_ROUTE: Record<Tab, string> = {
  home: 'index',
  compare: 'compare',
  favorites: 'favorites',
  settings: 'settings',
};

export default function TabsLayout(): React.ReactElement {
  const router = useRouter();
  const recentIds = useRecentStore((s) => s.cityIds);
  const favoriteIds = useFavoritesStore((s) => s.cityIds);

  // 탭 반복 누름 시 navigation 스택이 중복 누적되지 않도록 router.navigate 사용
  // (PR #17 review round 3 이슈 1). expo-router 6 의 navigate 는 이미 동일 라우트
  // 가 스택 상단이면 no-op + 다른 라우트면 push 와 동일.
  const handleCompareTabPress = React.useCallback(
    (e: TabPressEvent) => {
      e.preventDefault();

      const targetId = recentIds[0] ?? favoriteIds[0];
      if (targetId) {
        router.navigate(`/compare/${targetId}`);
      } else {
        router.replace('/');
        Alert.alert('알림', '최근 본 도시나 즐겨찾기가 없어요.\n홈에서 도시를 선택해 주세요.');
      }
    },
    [router, recentIds, favoriteIds],
  );

  const handleFavoritesTabPress = React.useCallback(
    (e: TabPressEvent) => {
      e.preventDefault();

      const targetId = favoriteIds[0];
      if (targetId) {
        router.navigate(`/compare/${targetId}`);
      } else {
        router.replace('/');
        Alert.alert('알림', '즐겨찾기가 없어요.\n홈에서 별 아이콘을 눌러 추가해 주세요.');
      }
    },
    [router, favoriteIds],
  );

  // BottomTabBar 를 Tabs 에 어댑터로 연결. onSelect → 대상 라우트로 tabPress emit →
  // compare/favorites 의 listeners 가 preventDefault + redirect 를 그대로 수행
  // (redirect 로직 단일 출처 유지). 그 외(home/settings)는 기본 navigate.
  const renderTabBar = React.useCallback(
    ({ state, navigation }: BottomTabBarProps): React.ReactElement => {
      const activeRoute = state.routes[state.index]?.name ?? 'index';
      const active = ROUTE_TO_TAB[activeRoute] ?? 'home';

      const handleSelect = (tab: Tab): void => {
        const route = state.routes.find((r) => r.name === TAB_TO_ROUTE[tab]);
        if (!route) return;

        const isFocused = route.key === state.routes[state.index]?.key;
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });

        if (!isFocused && !event.defaultPrevented) {
          navigation.navigate(route.name);
        }
      };

      return <BottomTabBar active={active} onSelect={handleSelect} />;
    },
    [],
  );

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={renderTabBar}>
      <Tabs.Screen name="index" options={{ title: '홈' }} />
      <Tabs.Screen
        name="compare"
        options={{ title: '비교' }}
        listeners={{ tabPress: handleCompareTabPress }}
      />
      <Tabs.Screen
        name="favorites"
        options={{ title: '즐겨찾기' }}
        listeners={{ tabPress: handleFavoritesTabPress }}
      />
      <Tabs.Screen name="settings" options={{ title: '설정' }} />
    </Tabs>
  );
}
