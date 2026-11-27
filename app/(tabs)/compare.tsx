/**
 * 비교 탭 — 도시끼리 비교할 두 도시를 고르는 선택 화면 (ADR-089).
 *
 * ADR-041 의 라우팅 단축(비교 탭 → `recent[0] ?? favorites[0]` 의 `/compare/<id>`)을
 * 대체한다. 홈의 최근 목록·즐겨찾기 탭(ADR-084)이 이미 같은 곳으로 데려가므로
 * 탭 한 칸이 중복이었다.
 *
 * - 왼쪽 칸 = 기준 도시(base), 오른쪽 칸 = 대상 도시(city). 값은
 *   `useComparePairStore` 에 칸을 고를 때마다 저장된다.
 * - 칸 탭 → `BottomSheet` 에 21개 도시(서울 포함) 한글 가나다순. 반대편 칸에 든
 *   도시는 비활성.
 * - "비교하기" → 두 도시 모두 서울이 아니면 `/compare/<대상>?base=<기준>`,
 *   어느 칸이든 서울이면 `/compare/<서울이 아닌 도시>` (서울은 항상 기준).
 *   서울은 학비·세금·비자가 정책상 0원이라 대상(오른쪽)에 두면 `0 ÷ 값` 배수로
 *   `formatMultiplier`·`isHot` 이 throw 한다 — 그 조합을 애초에 만들지 않는다.
 * - 광고 없음 (ADR-077: 광고는 홈·비교(`/compare/[cityId]`)·상세 ready 만).
 * - 환율은 읽지 않는다 — 이 화면은 금액을 보여주지 않는다.
 */

import * as React from 'react';

import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { useRouter } from 'expo-router';

import { BottomSheet } from '@/components/BottomSheet';
import { ErrorView } from '@/components/ErrorView';
import { Screen, TAB_SCREEN_EDGES } from '@/components/Screen';
import { Body, H1, Tiny } from '@/components/typography/Text';
import { getAllCities, loadAllCities } from '@/lib';
import { useComparePairStore } from '@/store/comparePair';
import { useSettingsStore } from '@/store/settings';
import { colors } from '@/theme/tokens';
import type { CityCostData } from '@/types/city';

/** 서울은 항상 기준(왼쪽)으로 연다 — 위 헤더 주석의 배수 throw 회피. */
const SEOUL_ID = 'seoul';

/** 어느 칸을 고르는 중인지. null = 시트 닫힘. */
type Slot = 'base' | 'city';

type CompareTabState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  // 한글 이름 가나다순으로 정렬된 전체 도시(서울 포함).
  | { status: 'ready'; cities: CityCostData[] };

export default function CompareTabScreen(): React.ReactElement {
  const router = useRouter();
  const baseId = useComparePairStore((s) => s.baseId);
  const cityId = useComparePairStore((s) => s.cityId);
  const setBase = useComparePairStore((s) => s.setBase);
  const setCity = useComparePairStore((s) => s.setCity);
  // 설정 새로고침으로 외부 도시 캐시가 갱신되면 목록을 다시 읽는다 (홈·즐겨찾기와 동일).
  const lastSync = useSettingsStore((s) => s.lastSync);

  const [state, setState] = React.useState<CompareTabState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = React.useState(0);
  const [picking, setPicking] = React.useState<Slot | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await loadAllCities();
        if (cancelled) return;

        const cities = Object.values(getAllCities()).sort((a, b) =>
          a.name.ko.localeCompare(b.name.ko, 'ko'),
        );
        setState({ status: 'ready', cities });
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

  const handlePickBase = React.useCallback(() => setPicking('base'), []);
  const handlePickCity = React.useCallback(() => setPicking('city'), []);
  const handleClosePicker = React.useCallback(() => setPicking(null), []);

  const handleSelect = React.useCallback(
    (id: string) => {
      if (picking === 'base') setBase(id);
      else if (picking === 'city') setCity(id);
      setPicking(null);
    },
    [picking, setBase, setCity],
  );

  // 저장된 id 가 현재 도시 목록에 없으면 그 칸은 빈 칸 (store 값은 건드리지 않는다).
  const cities = state.status === 'ready' ? state.cities : [];
  const baseCity = cities.find((c) => c.id === baseId) ?? null;
  const cityCity = cities.find((c) => c.id === cityId) ?? null;
  const canSubmit = baseCity !== null && cityCity !== null && baseCity.id !== cityCity.id;

  const handleSubmit = React.useCallback(() => {
    if (baseCity === null || cityCity === null || baseCity.id === cityCity.id) return;
    // 서울은 항상 기준(왼쪽). 어느 칸에 넣었든 서울 모드 주소로 연다.
    if (baseCity.id === SEOUL_ID) {
      router.push(`/compare/${cityCity.id}`);
      return;
    }
    if (cityCity.id === SEOUL_ID) {
      router.push(`/compare/${baseCity.id}`);
      return;
    }
    router.push(`/compare/${cityCity.id}?base=${baseCity.id}`);
  }, [router, baseCity, cityCity]);

  if (state.status === 'loading') {
    return (
      <Screen edges={TAB_SCREEN_EDGES} testID="compare-tab-screen-loading">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.orange} accessibilityLabel="로딩 중" />
        </View>
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen edges={TAB_SCREEN_EDGES} testID="compare-tab-screen-error">
        <View className="flex-1 justify-center">
          <ErrorView variant="screen" message={state.message} onRetry={handleRetry} />
        </View>
      </Screen>
    );
  }

  const pickerCurrentId = picking === 'base' ? baseId : cityId;
  const pickerOppositeId = picking === 'base' ? cityId : baseId;

  return (
    <Screen scroll edges={TAB_SCREEN_EDGES} testID="compare-tab-screen">
      <View className="pt-2 pb-1">
        <H1>도시끼리 비교</H1>
      </View>
      <Body color="gray-2">두 도시를 골라 생활비를 나란히 비교해요</Body>

      <View className="mt-6 flex-row items-center gap-3">
        <CitySlot
          label="기준 도시"
          city={baseCity}
          onPress={handlePickBase}
          testID="compare-tab-slot-base"
        />
        <Body color="gray-2" className="font-manrope-bold">
          vs
        </Body>
        <CitySlot
          label="비교 도시"
          city={cityCity}
          onPress={handlePickCity}
          testID="compare-tab-slot-city"
        />
      </View>

      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        accessibilityRole="button"
        accessibilityLabel="비교하기"
        accessibilityState={{ disabled: !canSubmit }}
        className={`mt-6 items-center justify-center rounded-button py-4 ${
          canSubmit ? 'bg-orange' : 'bg-orange-soft'
        }`}
        testID="compare-tab-submit"
      >
        <Body color="white" className="font-manrope-bold">
          비교하기
        </Body>
      </Pressable>

      {!canSubmit ? (
        <Tiny color="gray-2" className="mt-2 text-center">
          서로 다른 두 도시를 골라주세요
        </Tiny>
      ) : null}

      {picking !== null ? (
        <BottomSheet
          visible
          onDismiss={handleClosePicker}
          title={picking === 'base' ? '기준 도시 선택' : '비교 도시 선택'}
          testID="compare-tab-picker"
        >
          <ScrollView className="max-h-[420px]" showsVerticalScrollIndicator={false}>
            {state.cities.map((c) => {
              // 반대편 칸에 이미 들어간 도시는 고를 수 없다 (같은 도시끼리 비교 방지).
              const isDisabled = c.id === pickerOppositeId;
              const isSelected = c.id === pickerCurrentId;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => handleSelect(c.id)}
                  disabled={isDisabled}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isDisabled ? `${c.name.ko} · 반대편 칸에 선택됨` : c.name.ko
                  }
                  accessibilityState={{ disabled: isDisabled, selected: isSelected }}
                  className={`flex-row items-center justify-between gap-3 px-3 py-3 rounded-card ${
                    isSelected ? 'bg-orange' : ''
                  }`}
                  testID={`compare-tab-option-${c.id}`}
                >
                  <Body
                    color={isDisabled ? 'gray-2' : isSelected ? 'white' : 'navy'}
                    numberOfLines={1}
                    className="flex-1 font-manrope-bold"
                  >
                    {c.name.ko}
                  </Body>
                  <Tiny color={isSelected ? 'white' : 'gray-2'} numberOfLines={1}>
                    {isDisabled ? '반대편 칸' : c.name.en}
                  </Tiny>
                </Pressable>
              );
            })}
          </ScrollView>
        </BottomSheet>
      ) : null}
    </Screen>
  );
}

type CitySlotProps = {
  /** 칸 역할 안내 ("기준 도시" / "비교 도시") */
  label: string;
  /** 선택된 도시. null = 빈 칸 */
  city: CityCostData | null;
  onPress: () => void;
  testID: string;
};

/** 선택 칸 — 비었으면 "도시 선택", 채워졌으면 한글 이름 + "바꾸기". */
function CitySlot({ label, city, onPress, testID }: CitySlotProps): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${city !== null ? city.name.ko : '선택'}`}
      className="flex-1 items-center gap-1 rounded-card border border-line bg-light-2 px-3 py-5"
      testID={testID}
    >
      <Tiny color="gray-2">{label}</Tiny>
      <Body
        color={city !== null ? 'navy' : 'gray-2'}
        numberOfLines={1}
        className="font-manrope-bold"
      >
        {city !== null ? city.name.ko : '도시 선택'}
      </Body>
      <Tiny color="orange">{city !== null ? '바꾸기' : '고르기'}</Tiny>
    </Pressable>
  );
}
