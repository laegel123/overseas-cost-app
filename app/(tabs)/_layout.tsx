/**
 * 하단 탭 레이아웃 — 4탭 (홈/비교/즐겨찾기/설정).
 *
 * 탭 바 UI 는 `src/components/BottomTabBar.tsx`(제어형) 를 expo-router Tabs 의
 * `tabBar` prop 에 어댑터로 연결해 렌더한다 (ARCHITECTURE.md §Shell). §125 스펙
 * (active=orange / inactive=gray-2, icon 22px, label 10px Mulish) 은 BottomTabBar
 * 단일 출처 — _layout 에 중복 구현하지 않는다.
 *
 * ADR-089: 비교 탭은 두 도시를 고르는 일반 탭 화면이다 — ADR-041 의 라우팅 단축
 * (recent[0] ?? favorites[0] 으로 redirect, 도시 0개면 홈으로 튕기며 네이티브
 * 경고창 안내) 을 제거했다.
 * ADR-084: 즐겨찾기 탭도 일반 탭 화면(목록)이다 — redirect 하지 않는다.
 * 즉 4개 탭 모두 기본 navigate 로만 동작한다.
 */

import * as React from 'react';

import { Tabs } from 'expo-router';

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { BottomTabBar, type Tab } from '@/components/BottomTabBar';

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
  // BottomTabBar 를 Tabs 에 어댑터로 연결. onSelect → 대상 라우트로 tabPress emit
  // (react-navigation 계약 유지 — 화면이 listener 를 붙일 여지를 남긴다) → 기본
  // navigate. 이미 focus 된 탭 재선택은 no-op (중복 push 방지).
  const renderTabBar = React.useCallback(
    ({ state, navigation }: BottomTabBarProps): React.ReactElement => {
      // noUncheckedIndexedAccess: 인덱스 접근 결과가 `T | undefined` 라 두 fallback
      // 이 타입상 필수. 4개 라우트가 고정이라 state.index 는 항상 유효 route 를
      // 가리키고 name 은 항상 ROUTE_TO_TAB 키 → fallback('index'/'home')은 런타임
      // 도달 불가(타입 충족용).
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
      <Tabs.Screen name="compare" options={{ title: '비교' }} />
      <Tabs.Screen name="favorites" options={{ title: '즐겨찾기' }} />
      <Tabs.Screen name="settings" options={{ title: '설정' }} />
    </Tabs>
  );
}
