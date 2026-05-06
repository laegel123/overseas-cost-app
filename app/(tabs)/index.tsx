/**
 * Home 화면 — 재방문 사용자가 빠르게 즐겨찾기 도시로 진입하거나 새 도시를 검색.
 *
 * design/README §2 + step2.md 구현.
 * - Greeting block + avatar placeholder
 * - Search bar (한글/영어 도시명 부분 일치 — PRD F2 "도시 검색")
 * - Favorite cards (horizontal scroll, accent=true 첫 카드)
 * - Recent cities list (vertical, max 5)
 * - Region pills + 권역별 도시 리스트 (PRD F2.2 "지역별 도시 리스트")
 *
 * 검색 시: 즐겨찾기/최근/권역 섹션을 검색 결과 리스트로 교체.
 */

import * as React from 'react';

import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';

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
import { useSettingsStore } from '@/store/settings';
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
  { id: 'me', label: '중동' },
];

const FOOD_RESTAURANT_DAYS_PER_MONTH = 20;
const FOOD_GROCERY_TRIPS_PER_MONTH = 4;

// Home 카드 배수용 단순화된 총비용. 페르소나·세금·비자비·학비 제외.
// Compare 화면의 페르소나별 정밀 계산과 의도적으로 다름 (ADR-056).
function computeCityTotal(city: CityCostData, fx: ExchangeRates): number {
  const rent = city.rent.share ?? city.rent.studio ?? city.rent.oneBed ?? 0;
  const rentKRW = convertToKRW(rent, city.currency, fx);

  const meal = (city.food.restaurantMeal + city.food.cafe) * FOOD_RESTAURANT_DAYS_PER_MONTH;
  // groceries 4종 (milk / eggs / rice / chicken) 만 합산. ramen 은 optional 필드라
  // 의도적으로 제외 — Home 단순화 근사값 (ADR-056). 도시 간 비교 가능 지표만 포함.
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
  // Settings 새로고침 후 외부 (data.ts citiesInMemory) 가 갱신될 때 cities memo 가
  // 재계산되도록 lastSync 를 dep 으로 사용 (탭 전환 시 unmount 안 됨).
  const lastSync = useSettingsStore((s) => s.lastSync);

  const [state, setState] = React.useState<HomeState>({ status: 'loading' });
  const [activeRegion, setActiveRegion] = React.useState<Region | 'all'>('all');
  const [query, setQuery] = React.useState('');

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
    // lastSync 가 변할 때 외부 caches (cities + fx) 가 갱신된 상태 — load() 재실행으로
    // state.fx 도 동기화. loadAllCities / fetchExchangeRates 의 in-flight dedup
    // (ADR-046) 이 초기 마운트 + lastSync 변경 이중 호출을 흡수.
    // reloadKey 는 에러 상태에서 사용자가 "다시 시도" 누를 때 의도적으로 useEffect 재실행.
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

  const handleSettingsPress = React.useCallback(() => {
    // Settings 는 동일 탭 stack 의 화면 — push 대신 navigate 로 탭 전환
    // (push 사용 시 setting 위에 setting 이 누적되어 뒤로가기 버튼 노출).
    router.navigate('/settings');
  }, [router]);

  // RegionPill 의 onSelect 가 () => void 시그니처라 regionId 를 인자로 받지 못함.
  // REGIONS 는 정적 배열이므로 region 별 핸들러를 한 번만 생성해 안정화.
  const regionHandlers = React.useMemo(
    () =>
      Object.fromEntries(
        REGIONS.map((r) => [r.id, () => setActiveRegion(r.id)]),
      ) as Record<Region | 'all', () => void>,
    [],
  );

  const seoulTotal = React.useMemo(() => {
    if (state.status !== 'ready') return 0;
    return computeCityTotal(state.seoul, state.fx);
  }, [state]);

  // lastSync 가 변할 때 외부 citiesInMemory 도 갱신된 상태 — getAllCities 재호출.
  // ESLint 의 exhaustive-deps 는 외부 모듈 상태를 모르므로 lastSync dep 명시 사유 주석.
  const cities = React.useMemo(
    () => (state.status === 'ready' ? getAllCities() : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.status, lastSync],
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

  // status 'ready' 일 때만 fx 가 존재 — discriminated union narrowing.
  const fx = state.status === 'ready' ? state.fx : null;

  // cityId → mult 사전 계산. FavCard / RecentRow 양쪽이 같은 도시를 참조해도 한 번만 계산.
  // deps: cities (lastSync 변화 흡수) + seoulTotal (state 파생) + fx (state.fx 만 추출).
  const multMap = React.useMemo(() => {
    if (fx === null) return {};
    return Object.fromEntries(
      Object.values(cities)
        .filter((c) => c.id !== 'seoul')
        .map((c) => [c.id, multFromTotals(c, seoulTotal, fx)]),
    );
  }, [cities, seoulTotal, fx]);

  // 권역 필터 적용된 도시 리스트. 한글 도시명 가나다 순으로 안정 정렬.
  const regionFilteredCities = React.useMemo(() => {
    const overseas = Object.values(cities).filter((c) => c.id !== 'seoul');
    const filtered =
      activeRegion === 'all' ? overseas : overseas.filter((c) => c.region === activeRegion);
    return filtered.slice().sort((a, b) => a.name.ko.localeCompare(b.name.ko, 'ko'));
  }, [cities, activeRegion]);

  // 검색어 정규화. trim + 소문자 (영문) — 한글은 lower 영향 없음.
  const normalizedQuery = query.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;

  // name.ko / name.en 부분 일치. 서울은 비교 대상이 아니라 결과에서도 제외.
  const searchResults = React.useMemo(() => {
    if (!isSearching) return [];
    const overseas = Object.values(cities).filter((c) => c.id !== 'seoul');
    return overseas
      .filter(
        (c) =>
          c.name.ko.toLowerCase().includes(normalizedQuery) ||
          c.name.en.toLowerCase().includes(normalizedQuery),
      )
      .sort((a, b) => a.name.ko.localeCompare(b.name.ko, 'ko'));
  }, [cities, normalizedQuery, isSearching]);

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
        <View className="flex-1 items-center justify-center px-4 gap-4">
          <Body color="gray-2" className="text-center">
            {state.message}
          </Body>
          <Pressable
            onPress={handleRetry}
            accessibilityRole="button"
            accessibilityLabel="다시 시도"
            className="px-4 py-2 rounded-button bg-orange"
            testID="home-retry-btn"
          >
            <Body color="white" className="font-manrope-bold">
              다시 시도
            </Body>
          </Pressable>
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

      {/* Search bar */}
      <View
        className="mt-4 flex-row items-center px-3.5 py-3 bg-light rounded-button"
        testID="home-search"
      >
        <Icon name="search" size={18} color={colors.gray2} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="도시 검색 · 한글/영어"
          placeholderTextColor={colors.gray2}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="도시 검색"
          className="flex-1 ml-3 font-mulish text-body text-navy"
          testID="home-search-input"
        />
        {query.length > 0 && (
          <Pressable
            onPress={() => setQuery('')}
            accessibilityRole="button"
            accessibilityLabel="검색어 지우기"
            testID="home-search-clear"
            hitSlop={8}
          >
            <Icon name="close" size={18} color={colors.gray2} />
          </Pressable>
        )}
      </View>

      {isSearching ? (
        <View className="mt-6 mb-4">
          <Body color="navy" className="font-manrope-bold mb-3">
            검색 결과 ({searchResults.length})
          </Body>
          {searchResults.length === 0 ? (
            <View
              className="py-8 items-center justify-center"
              testID="home-search-empty"
            >
              <Body color="gray-2" className="text-center">
                검색 결과가 없어요
              </Body>
            </View>
          ) : (
            <View className="gap-2" testID="home-search-results">
              {searchResults.map((city, idx) => (
                <RecentRow
                  key={city.id}
                  cityId={city.id}
                  cityName={city.name.ko}
                  cityNameEn={city.name.en}
                  countryCode={city.country}
                  mult={multMap[city.id] ?? '신규'}
                  isLast={idx === searchResults.length - 1}
                  onPress={handleCityPress}
                  testID={`home-search-result-${city.id}`}
                />
              ))}
            </View>
          )}
        </View>
      ) : (
        <>
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

      {/* Region pills + 권역별 도시 리스트 (PRD F2.2) */}
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
              onSelect={regionHandlers[region.id]}
              testID={`home-region-${region.id}`}
            />
          ))}
        </ScrollView>

        <View className="mt-4 gap-2" testID="home-region-cities">
          {regionFilteredCities.map((city, idx) => (
            <RecentRow
              key={city.id}
              cityId={city.id}
              cityName={city.name.ko}
              cityNameEn={city.name.en}
              countryCode={city.country}
              mult={multMap[city.id] ?? '신규'}
              isLast={idx === regionFilteredCities.length - 1}
              onPress={handleCityPress}
              testID={`home-region-city-${city.id}`}
            />
          ))}
        </View>
      </View>
        </>
      )}

      {/* Bottom spacing for tab bar */}
      <View className="h-4" />
    </Screen>
  );
}
