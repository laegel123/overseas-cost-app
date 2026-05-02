/**
 * Home 화면 — 재방문 사용자가 빠르게 즐겨찾기 도시로 진입하거나 새 도시를 검색.
 *
 * design/README §2 + step2.md 구현.
 * - Greeting block + avatar placeholder
 * - Search bar (v1.0 stub — 시각만)
 * - Favorite cards (horizontal scroll, accent=true 첫 카드)
 * - Recent cities list (vertical, max 5)
 * - Region pills (v1.0 시각만, 실제 필터링 미구현)
 */

import * as React from 'react';

import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { useRouter } from 'expo-router';

import { FavCard } from '@/components/FavCard';
import { Icon } from '@/components/Icon';
import { RecentRow } from '@/components/RecentRow';
import { RegionPill } from '@/components/RegionPill';
import { Screen } from '@/components/Screen';
import { Body, H1, Tiny } from '@/components/typography/Text';
import {
  computeMultiplier,
  convertToKRW,
  fetchExchangeRates,
  getAllCities,
  loadAllCities,
} from '@/lib';
import { useFavoritesStore } from '@/store/favorites';
import { useRecentStore } from '@/store/recent';
import { colors } from '@/theme/tokens';
import type { CityCostData, ExchangeRates, Region } from '@/types/city';

type RegionConfig = {
  id: Region | 'all';
  label: string;
};

const REGIONS: RegionConfig[] = [
  { id: 'all', label: '전체' },
  { id: 'na', label: '북미' },
  { id: 'eu', label: '유럽' },
  { id: 'asia', label: '아시아' },
  { id: 'oceania', label: '오세아니아' },
];

const FOOD_RESTAURANT_DAYS_PER_MONTH = 20;
const FOOD_GROCERY_TRIPS_PER_MONTH = 4;

// Home 카드 배수용 단순화된 총비용. 페르소나·세금·비자비·학비 제외.
// Compare 화면의 페르소나별 정밀 계산과 의도적으로 다름 (ADR-056).
function computeCityTotal(city: CityCostData, fx: ExchangeRates): number {
  const rent = city.rent.share ?? city.rent.studio ?? city.rent.oneBed ?? 0;
  const rentKRW = convertToKRW(rent, city.currency, fx);

  const meal = (city.food.restaurantMeal + city.food.cafe) * FOOD_RESTAURANT_DAYS_PER_MONTH;
  const groceryUnitSum =
    city.food.groceries.milk1L +
    city.food.groceries.eggs12 +
    city.food.groceries.rice1kg +
    city.food.groceries.chicken1kg;
  const foodTotal = meal + groceryUnitSum * FOOD_GROCERY_TRIPS_PER_MONTH;
  const foodKRW = convertToKRW(foodTotal, city.currency, fx);

  const transportKRW = convertToKRW(city.transport.monthlyPass, city.currency, fx);

  return rentKRW + foodKRW + transportKRW;
}

function multFromTotals(
  city: CityCostData,
  seoulTotal: number,
  fx: ExchangeRates,
): number | '신규' {
  const cityTotal = computeCityTotal(city, fx);
  return computeMultiplier(seoulTotal, cityTotal);
}

type HomeState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; seoul: CityCostData; fx: ExchangeRates };

export default function HomeScreen(): React.ReactElement {
  const router = useRouter();
  const favoriteIds = useFavoritesStore((s) => s.cityIds);
  const recentIds = useRecentStore((s) => s.cityIds);

  const [state, setState] = React.useState<HomeState>({ status: 'loading' });
  const [activeRegion, setActiveRegion] = React.useState<Region | 'all'>('all');

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

        setState({ status: 'ready', seoul, fx });
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
  }, []);

  const handleCityPress = React.useCallback(
    (cityId: string) => {
      router.push(`/compare/${cityId}`);
    },
    [router],
  );

  const handleSettingsPress = React.useCallback(() => {
    router.push('/settings');
  }, [router]);

  const handleRegionPress = React.useCallback((regionId: Region | 'all') => {
    setActiveRegion(regionId);
  }, []);

  const seoulTotal = React.useMemo(() => {
    if (state.status !== 'ready') return 0;
    return computeCityTotal(state.seoul, state.fx);
  }, [state]);

  const cities = React.useMemo(
    () => (state.status === 'ready' ? getAllCities() : {}),
    [state.status],
  );

  const regionCounts = React.useMemo(
    () =>
      Object.values(cities).reduce(
        (acc, city) => {
          if (city.id !== 'seoul') {
            acc[city.region] = (acc[city.region] ?? 0) + 1;
            acc['all'] = (acc['all'] ?? 0) + 1;
          }
          return acc;
        },
        {} as Record<Region | 'all', number>,
      ),
    [cities],
  );

  const favoriteCities = React.useMemo(
    () =>
      favoriteIds
        .map((id) => cities[id])
        .filter((c): c is CityCostData => c !== undefined && c.id !== 'seoul'),
    [favoriteIds, cities],
  );

  const recentCities = React.useMemo(
    () =>
      recentIds
        .map((id) => cities[id])
        .filter((c): c is CityCostData => c !== undefined && c.id !== 'seoul'),
    [recentIds, cities],
  );

  // cityId → mult 사전 계산. FavCard / RecentRow 양쪽이 같은 도시를 참조해도 한 번만 계산.
  const multMap = React.useMemo(() => {
    if (state.status !== 'ready') return {};
    return Object.fromEntries(
      Object.values(cities)
        .filter((c) => c.id !== 'seoul')
        .map((c) => [c.id, multFromTotals(c, seoulTotal, state.fx)]),
    );
  }, [cities, seoulTotal, state]);

  if (state.status === 'loading') {
    return (
      <Screen testID="home-screen-loading">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color={colors.orange}
            accessibilityLabel="로딩 중"
          />
        </View>
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen testID="home-screen-error">
        <View className="flex-1 items-center justify-center px-4">
          <Body color="gray-2" className="text-center">
            {state.message}
          </Body>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll testID="home-screen">
      {/* Greeting + Avatar */}
      <View className="flex-row items-start justify-between mt-2">
        <View>
          <Tiny color="gray-2">안녕하세요 👋</Tiny>
          <H1>어디 가시나요?</H1>
        </View>
        <Pressable
          onPress={handleSettingsPress}
          accessibilityRole="button"
          accessibilityLabel="설정"
          testID="home-avatar"
        >
          <View className="w-10 h-10 rounded-button bg-light items-center justify-center">
            <Icon name="user" size={20} color={colors.gray2} />
          </View>
        </Pressable>
      </View>

      {/* Search bar (v1.0 stub) */}
      <View
        className="mt-4 flex-row items-center px-3.5 py-3 bg-light rounded-button"
        testID="home-search-stub"
      >
        <Icon name="search" size={18} color={colors.gray2} />
        <Body color="gray-2" className="flex-1 ml-3">
          도시 검색 · 한글/영어
        </Body>
        <Icon name="filter" size={18} color={colors.gray2} />
      </View>

      {/* Favorite cards section */}
      <View className="mt-6">
        <Body color="navy" className="font-manrope-bold mb-3">
          즐겨찾기
        </Body>
        {favoriteCities.length === 0 ? (
          <View
            className="py-8 items-center justify-center"
            testID="home-favorites-empty"
          >
            <Body color="gray-2" className="text-center">
              아직 즐겨찾기가 없어요.{'\n'}도시를 탭해 ⭐ 추가해보세요
            </Body>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12 }}
            testID="home-favorites-scroll"
          >
            {favoriteCities.map((city, idx) => (
              <FavCard
                key={city.id}
                cityId={city.id}
                cityName={city.name.ko}
                cityNameEn={city.name.en}
                countryCode={city.country}
                mult={multMap[city.id] ?? '신규'}
                accent={idx === 0}
                onPress={handleCityPress}
                testID={`home-favcard-${city.id}`}
              />
            ))}
          </ScrollView>
        )}
      </View>

      {/* Recent cities section */}
      <View className="mt-6">
        <Body color="navy" className="font-manrope-bold mb-3">
          최근 본 도시
        </Body>
        {recentCities.length === 0 ? (
          <View
            className="py-8 items-center justify-center"
            testID="home-recent-empty"
          >
            <Body color="gray-2" className="text-center">
              최근 본 도시가 없어요
            </Body>
          </View>
        ) : (
          <View className="gap-2" testID="home-recent-list">
            {recentCities.map((city, idx) => (
              <RecentRow
                key={city.id}
                cityId={city.id}
                cityName={city.name.ko}
                cityNameEn={city.name.en}
                countryCode={city.country}
                mult={multMap[city.id] ?? '신규'}
                isLast={idx === recentCities.length - 1}
                onPress={handleCityPress}
                testID={`home-recentrow-${city.id}`}
              />
            ))}
          </View>
        )}
      </View>

      {/* Region pills */}
      <View className="mt-6 mb-4">
        <Body color="navy" className="font-manrope-bold mb-3">
          권역
        </Body>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
          testID="home-region-pills"
        >
          {REGIONS.map((region) => (
            <RegionPill
              key={region.id}
              label={region.label}
              count={regionCounts[region.id]}
              active={activeRegion === region.id}
              onSelect={() => handleRegionPress(region.id)}
              testID={`home-region-${region.id}`}
            />
          ))}
        </ScrollView>
      </View>

      {/* Bottom spacing for tab bar */}
      <View className="h-4" />
    </Screen>
  );
}
