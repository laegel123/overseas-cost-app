/**
 * 하단 탭 레이아웃 — 4탭 (홈/비교/즐겨찾기/설정).
 *
 * ADR-041: v1.0 비교·즐겨찾기 탭은 라우팅 단축으로 동작.
 * - 비교 탭 = recent[0] 또는 favorites[0]으로 redirect
 * - 즐겨찾기 탭 = favorites[0]으로 redirect
 * - 도시 0개 시 = 홈으로 이동 + Alert 안내 (토스트 미구현)
 */

import * as React from 'react';

import { Alert } from 'react-native';

import { Tabs, useRouter } from 'expo-router';

import { Icon, type IconName } from '@/components/Icon';
import { useFavoritesStore } from '@/store/favorites';
import { useRecentStore } from '@/store/recent';
import { colors } from '@/theme/tokens';

type TabPressEvent = {
  preventDefault: () => void;
};

// design/README.md §125: 하단 탭 바 아이콘 22px, active=orange / inactive=gray-2.
const TAB_ICON_SIZE = 22;

// tabBarIcon 은 focused 로만 색을 고르므로 Icon 의 ColorToken 타입을 유지한다
// (React Navigation 이 넘겨주는 color 문자열은 매직 hex 라 쓰지 않음).
function tabIcon(name: IconName) {
  const TabBarIcon = ({ focused }: { focused: boolean }): React.ReactElement => (
    <Icon
      name={name}
      size={TAB_ICON_SIZE}
      color={focused ? colors.orange : colors.gray2}
    />
  );
  TabBarIcon.displayName = `TabBarIcon(${name})`;
  return TabBarIcon;
}

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

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: colors.gray2,
      }}
    >
      <Tabs.Screen name="index" options={{ title: '홈', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen
        name="compare"
        options={{ title: '비교', tabBarIcon: tabIcon('compare') }}
        listeners={{ tabPress: handleCompareTabPress }}
      />
      <Tabs.Screen
        name="favorites"
        options={{ title: '즐겨찾기', tabBarIcon: tabIcon('star') }}
        listeners={{ tabPress: handleFavoritesTabPress }}
      />
      <Tabs.Screen name="settings" options={{ title: '설정', tabBarIcon: tabIcon('settings') }} />
    </Tabs>
  );
}
