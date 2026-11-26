/**
 * 즐겨찾기 탭 — 즐겨찾기한 도시 목록 (ADR-084, ADR-041 의 즐겨찾기 단축 대체).
 *
 * - 행 탭 → `/compare/{cityId}`
 * - 0개 → 화면 내 빈 상태 + 홈으로 가는 CTA
 * - 광고 없음 (ADR-077: 광고는 홈·비교·상세만)
 * - 즐겨찾기 해제는 Compare 화면의 ⭐ 에서만 한다.
 */

import * as React from 'react';

import { ActivityIndicator, Pressable, View } from 'react-native';

import { useRouter } from 'expo-router';

import { RecentRow } from '@/components/RecentRow';
import { Screen, TAB_SCREEN_EDGES } from '@/components/Screen';
import { Body, H1 } from '@/components/typography/Text';
import {
  computeCityTotal,
  fetchExchangeRates,
  getAllCities,
  loadAllCities,
  multFromTotals,
} from '@/lib';
import { useFavoritesStore } from '@/store/favorites';
import { useSettingsStore } from '@/store/settings';
import { colors } from '@/theme/tokens';
import type { CityCostData, ExchangeRates } from '@/types/city';

type FavoritesState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      seoul: CityCostData;
      fx: ExchangeRates;
      cities: Record<string, CityCostData>;
    };

export default function FavoritesScreen(): React.ReactElement {
  const router = useRouter();
  const favoriteIds = useFavoritesStore((s) => s.cityIds);
  // Settings 새로고침으로 외부 캐시(cities + fx)가 갱신되면 다시 읽는다 (홈과 동일).
  const lastSync = useSettingsStore((s) => s.lastSync);

  const [state, setState] = React.useState<FavoritesState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [, fx] = await Promise.all([loadAllCities(), fetchExchangeRates()]);
        if (cancelled) return;

        const cities = getAllCities();
        const seoul = cities['seoul'];
        if (!seoul) {
          setState({ status: 'error', message: '서울 데이터를 찾을 수 없습니다' });
          return;
        }
        setState({ status: 'ready', seoul, fx, cities });
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : '데이터 로드 실패';
        setState({ status: 'error', message: msg });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [lastSync, reloadKey]);

  const handleRetry = React.useCallback(() => {
    setState({ status: 'loading' });
    setReloadKey((k) => k + 1);
  }, []);

  const handleCityPress = React.useCallback(
    (cityId: string) => {
      router.push(`/compare/${cityId}`);
    },
    [router],
  );

  const handleGoHome = React.useCallback(() => {
    router.navigate('/');
  }, [router]);

  if (state.status === 'loading') {
    return (
      <Screen edges={TAB_SCREEN_EDGES} testID="favorites-screen-loading">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.orange} accessibilityLabel="로딩 중" />
        </View>
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen edges={TAB_SCREEN_EDGES} testID="favorites-screen-error">
        <View className="flex-1 items-center justify-center px-4 gap-4">
          <Body color="gray-2" className="text-center">
            {state.message}
          </Body>
          <Pressable
            onPress={handleRetry}
            accessibilityRole="button"
            accessibilityLabel="다시 시도"
            className="px-4 py-2 rounded-button bg-orange"
            testID="favorites-retry-btn"
          >
            <Body color="white" className="font-manrope-bold">
              다시 시도
            </Body>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const { seoul, fx, cities } = state;
  const seoulTotal = computeCityTotal(seoul, fx);
  const favoriteCities = favoriteIds
    .map((id) => cities[id])
    .filter((c): c is CityCostData => c !== undefined && c.id !== 'seoul');

  return (
    <Screen scroll edges={TAB_SCREEN_EDGES} testID="favorites-screen">
      <View className="pt-2 pb-4">
        <H1>즐겨찾기</H1>
      </View>

      {favoriteCities.length === 0 ? (
        <View className="py-8 items-center justify-center gap-4" testID="favorites-empty">
          <Body color="gray-2" className="text-center">
            아직 즐겨찾기가 없어요.{'\n'}비교 화면에서 ⭐ 를 눌러 추가해보세요
          </Body>
          <Pressable
            onPress={handleGoHome}
            accessibilityRole="button"
            accessibilityLabel="도시 둘러보기"
            className="px-4 py-2 rounded-button bg-orange"
            testID="favorites-empty-cta"
          >
            <Body color="white" className="font-manrope-bold">
              도시 둘러보기
            </Body>
          </Pressable>
        </View>
      ) : (
        <View className="gap-2 mb-4" testID="favorites-list">
          {favoriteCities.map((city, idx) => (
            <RecentRow
              key={city.id}
              cityId={city.id}
              cityName={city.name.ko}
              cityNameEn={city.name.en}
              countryCode={city.country}
              mult={multFromTotals(city, seoulTotal, fx)}
              isLast={idx === favoriteCities.length - 1}
              onPress={handleCityPress}
              testID={`favorites-row-${city.id}`}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
