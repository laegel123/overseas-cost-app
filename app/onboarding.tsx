/**
 * Onboarding — 설치 직후 1회 **도시 선택** (ADR-067).
 *
 * 페르소나 선택을 도시 선택으로 전면 교체. 도시를 고르면 즐겨찾기에 담고
 * 서울 vs 그 도시 Compare 화면으로 바로 이동한다.
 *
 * 선택 흐름: add(cityId) → setOnboarded(true) → router.replace('/compare/{id}').
 * `pushRecent` 는 호출하지 않는다 — Compare 가 마운트 시 자체 실행하므로 중복 방지
 * (app/compare/[cityId].tsx §254~258).
 *
 * 도시 리스트/권역 필터/배수 계산은 Home (app/(tabs)/index.tsx) 패턴을 이식하되
 * 온보딩용으로 슬림화 (검색바 생략 — v1 범위). 배수는 홈과 동일한
 * multFromTotals (homeTotals 단일 출처, ADR-056) 로 시각 일관.
 */

import * as React from 'react';

import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { useRouter } from 'expo-router';

import { Icon } from '@/components/Icon';
import { RecentRow } from '@/components/RecentRow';
import { RegionPill } from '@/components/RegionPill';
import { Screen } from '@/components/Screen';
import { Body, Display, MonoLabel } from '@/components/typography/Text';
import {
  computeCityTotal,
  fetchExchangeRates,
  getAllCities,
  loadAllCities,
  multFromTotals,
} from '@/lib';
import { useFavoritesStore, useOnboardingStore } from '@/store';
import { colors, shadows } from '@/theme/tokens';
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

type OnboardingDataState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; seoul: CityCostData; fx: ExchangeRates };

export default function OnboardingScreen(): React.ReactElement {
  const router = useRouter();
  const add = useFavoritesStore((s) => s.add);
  const setOnboarded = useOnboardingStore((s) => s.setOnboarded);
  // 빠른 연타 가드 — 첫 탭만 store/navigate 실행. router.replace 후 unmount 되지만
  // 첫 동작이 동기 setState 라 같은 tick 안의 두 번째 탭이 navigate 직전 통과 가능.
  const isNavigatingRef = React.useRef(false);

  const [state, setState] = React.useState<OnboardingDataState>({ status: 'loading' });
  const [activeRegion, setActiveRegion] = React.useState<Region | 'all'>('all');
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
    // reloadKey 는 에러 상태에서 사용자가 "다시 시도" 누를 때 useEffect 재실행.
  }, [reloadKey]);

  const handleRetry = React.useCallback(() => {
    setState({ status: 'loading' });
    setReloadKey((k) => k + 1);
  }, []);

  const handleSelect = React.useCallback(
    (cityId: string) => {
      if (isNavigatingRef.current) return;
      isNavigatingRef.current = true;
      add(cityId);
      setOnboarded(true);
      router.replace(`/compare/${cityId}`);
    },
    [add, setOnboarded, router],
  );

  // RegionPill 의 onSelect 가 () => void 시그니처라 regionId 를 인자로 받지 못함.
  // REGIONS 는 정적 배열이므로 region 별 핸들러를 한 번만 생성해 안정화.
  const regionHandlers = React.useMemo(
    () =>
      Object.fromEntries(
        REGIONS.map((r) => [r.id, () => setActiveRegion(r.id)]),
      ) as Record<Region | 'all', () => void>,
    [],
  );

  const cities = React.useMemo(
    () => (state.status === 'ready' ? getAllCities() : {}),
    [state.status],
  );

  const seoulTotal = React.useMemo(() => {
    if (state.status !== 'ready') return 0;
    return computeCityTotal(state.seoul, state.fx);
  }, [state]);

  // status 'ready' 일 때만 fx 가 존재 — discriminated union narrowing.
  const fx = state.status === 'ready' ? state.fx : null;

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

  // cityId → mult 사전 계산. Home 과 동일 (homeTotals 단일 출처, ADR-056).
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

  if (state.status === 'loading') {
    return (
      <Screen testID="onboarding-screen-loading">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.orange} accessibilityLabel="로딩 중" />
        </View>
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen testID="onboarding-screen-error">
        <View className="flex-1 items-center justify-center px-4 gap-4">
          <Body color="gray-2" className="text-center">
            {state.message}
          </Body>
          <Pressable
            onPress={handleRetry}
            accessibilityRole="button"
            accessibilityLabel="다시 시도"
            className="px-4 py-2 rounded-button bg-orange"
            testID="onboarding-retry-btn"
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
    <Screen scroll testID="onboarding-screen">
      {/* Hero section */}
      <View className="mt-6 gap-3">
        {/* Hero icon */}
        <View
          className="w-14 h-14 rounded-hero-icon bg-orange items-center justify-center"
          style={shadows.orangeCta}
        >
          <Icon name="globe" size={28} color={colors.white} strokeWidth={2.2} />
        </View>

        {/* Greeting */}
        <View className="gap-1">
          <Display>안녕하세요</Display>
          <Display color="orange">어디로 떠나시나요?</Display>
        </View>

        {/* Description */}
        <Body className="max-w-60">서울 기준으로 해외 도시 생활비를 비교해 드려요.</Body>
      </View>

      {/* Region pills */}
      <View className="mt-6">
        <MonoLabel className="mb-3">도시를 골라보세요</MonoLabel>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
          testID="onboarding-region-pills"
        >
          {REGIONS.map((region) => (
            <RegionPill
              key={region.id}
              label={region.label}
              count={regionCounts[region.id]}
              active={activeRegion === region.id}
              onSelect={regionHandlers[region.id]}
              testID={`onboarding-region-${region.id}`}
            />
          ))}
        </ScrollView>
      </View>

      {/* City list */}
      <View className="mt-4 mb-4 gap-2" testID="onboarding-city-list">
        {regionFilteredCities.map((city, idx) => (
          <RecentRow
            key={city.id}
            cityId={city.id}
            cityName={city.name.ko}
            cityNameEn={city.name.en}
            countryCode={city.country}
            mult={multMap[city.id] ?? '신규'}
            isLast={idx === regionFilteredCities.length - 1}
            onPress={handleSelect}
            testID={`onboarding-city-${city.id}`}
          />
        ))}
      </View>

      {/* Bottom spacing */}
      <View className="h-4" />
    </Screen>
  );
}
