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

import { useFavoritesStore } from '@/store/favorites';
import { useRecentStore } from '@/store/recent';

type TabPressEvent = {
  preventDefault: () => void;
};

export default function TabsLayout(): React.ReactElement {
  const router = useRouter();
  const recentIds = useRecentStore((s) => s.cityIds);
  const favoriteIds = useFavoritesStore((s) => s.cityIds);

  const handleCompareTabPress = React.useCallback(
    (e: TabPressEvent) => {
      e.preventDefault();

      const targetId = recentIds[0] ?? favoriteIds[0];
      if (targetId) {
        router.push(`/compare/${targetId}`);
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
        router.push(`/compare/${targetId}`);
      } else {
        router.replace('/');
        Alert.alert('알림', '즐겨찾기가 없어요.\n홈에서 별 아이콘을 눌러 추가해 주세요.');
      }
    },
    [router, favoriteIds],
  );

  return (
    <Tabs screenOptions={{ headerShown: false }}>
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
