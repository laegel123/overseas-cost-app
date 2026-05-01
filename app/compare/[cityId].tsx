/**
 * Compare 화면 — 서울 vs 도시 1:1 비교 (앱의 메인 화면).
 *
 * design/README §3 + step0.md 구현. 페르소나 분기, Hot 규칙, 데이터 정책 모두 준수.
 */

import * as React from 'react';

import { Pressable, View } from 'react-native';

import { useLocalSearchParams, useRouter } from 'expo-router';

import { HeroCard } from '@/components/cards/HeroCard';
import { ComparePair } from '@/components/ComparePair';
import { ErrorView } from '@/components/ErrorView';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { Small } from '@/components/typography/Text';
import {
  computeBarPcts,
  computeMultiplier,
  convertToKRW,
  fetchExchangeRates,
  formatKRW,
  formatMultiplier,
  formatShortDate,
  getCity,
  getLastSync,
  isHot,
  loadAllCities,
} from '@/lib';
import { useFavoritesStore } from '@/store/favorites';
import { usePersonaStore } from '@/store/persona';
import { useRecentStore } from '@/store/recent';
import type {
  CityCostData,
  ExchangeRates,
  Persona,
  SourceCategory,
} from '@/types/city';

type CategoryConfig = {
  category: SourceCategory;
  label: string;
  getValue: (city: CityCostData, fx: ExchangeRates) => number | null;
};

const RENT_CONFIG: CategoryConfig = {
  category: 'rent',
  label: '월세',
  getValue: (city, fx) => {
    const val = city.rent.share ?? city.rent.studio ?? city.rent.oneBed;
    if (val === null) return null;
    return convertToKRW(val, city.currency, fx);
  },
};

const FOOD_CONFIG: CategoryConfig = {
  category: 'food',
  label: '식비',
  getValue: (city, fx) => {
    const meal = city.food.restaurantMeal * 20;
    const grocery = city.food.groceries.milk1L + city.food.groceries.eggs12 +
      city.food.groceries.rice1kg + city.food.groceries.chicken1kg;
    const total = meal + grocery * 4;
    return convertToKRW(total, city.currency, fx);
  },
};

const TRANSPORT_CONFIG: CategoryConfig = {
  category: 'transport',
  label: '교통',
  getValue: (city, fx) => {
    return convertToKRW(city.transport.monthlyPass, city.currency, fx);
  },
};

const TUITION_CONFIG: CategoryConfig = {
  category: 'tuition',
  label: '학비',
  getValue: (city, fx) => {
    if (!city.tuition || city.tuition.length === 0) return null;
    const entry = city.tuition[0];
    if (!entry) return null;
    const monthly = entry.annual / 12;
    return convertToKRW(monthly, city.currency, fx);
  },
};

const TAX_CONFIG: CategoryConfig = {
  category: 'tax',
  label: '세금',
  getValue: (city, fx) => {
    if (!city.tax || city.tax.length === 0) return null;
    const entry = city.tax[0];
    if (!entry) return null;
    const monthlySalary = entry.annualSalary / 12;
    const tax = monthlySalary * (1 - entry.takeHomePctApprox / 100);
    return convertToKRW(tax, city.currency, fx);
  },
};

const VISA_CONFIG: CategoryConfig = {
  category: 'visa',
  label: '비자/정착',
  getValue: (city, fx) => {
    if (!city.visa) return null;
    const fee = city.visa.studentApplicationFee ?? city.visa.workApplicationFee ?? 0;
    const settle = city.visa.settlementApprox ?? 0;
    const total = fee + settle;
    if (total === 0) return null;
    return convertToKRW(total, city.currency, fx);
  },
};

function getCategoriesForPersona(persona: Persona): CategoryConfig[] {
  const base = [RENT_CONFIG, FOOD_CONFIG, TRANSPORT_CONFIG];

  if (persona === 'student') {
    return [...base, TUITION_CONFIG, VISA_CONFIG];
  }
  if (persona === 'worker') {
    return [...base, TAX_CONFIG, VISA_CONFIG];
  }
  return [...base, TUITION_CONFIG, TAX_CONFIG, VISA_CONFIG];
}

type CompareData = {
  seoul: CityCostData;
  city: CityCostData;
  fx: ExchangeRates;
  lastSync: string | null;
};

type CompareState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: CompareData };

export default function CompareScreen(): React.ReactElement {
  const { cityId } = useLocalSearchParams<{ cityId: string }>();
  const router = useRouter();

  const persona = usePersonaStore((s) => s.persona);
  const isFavorite = useFavoritesStore((s) => s.has(cityId ?? ''));
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const pushRecent = useRecentStore((s) => s.push);

  const [state, setState] = React.useState<CompareState>({ status: 'loading' });

  React.useEffect(() => {
    if (!cityId) {
      setState({ status: 'error', message: '도시 ID가 없습니다' });
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const [, fx, lastSync] = await Promise.all([
          loadAllCities(),
          fetchExchangeRates(),
          getLastSync(),
        ]);

        if (cancelled) return;

        const seoul = getCity('seoul');
        const city = getCity(cityId);

        if (!seoul) {
          setState({ status: 'error', message: '서울 데이터를 찾을 수 없습니다' });
          return;
        }
        if (!city) {
          setState({ status: 'error', message: '도시 데이터를 찾을 수 없습니다' });
          return;
        }

        setState({ status: 'ready', data: { seoul, city, fx, lastSync } });
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : '데이터 로드 실패';
        setState({ status: 'error', message: msg });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [cityId]);

  React.useEffect(() => {
    if (cityId && state.status === 'ready') {
      pushRecent(cityId);
    }
  }, [cityId, state.status, pushRecent]);

  const handleBack = React.useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [router]);

  const handleToggleFavorite = React.useCallback(() => {
    if (cityId) {
      toggleFavorite(cityId);
    }
  }, [cityId, toggleFavorite]);

  if (state.status === 'loading') {
    return (
      <Screen testID="compare-screen-loading">
        <View className="flex-1 items-center justify-center" />
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen testID="compare-screen-error">
        <ErrorView
          variant="screen"
          message={state.message}
          onRetry={handleBack}
          retryLabel="돌아가기"
        />
      </Screen>
    );
  }

  const { seoul, city, fx, lastSync } = state.data;

  const rate = fx[city.currency];
  const rateDisplay = rate !== undefined ? Math.round(rate) : '?';
  const syncDisplay = lastSync ? formatShortDate(lastSync) : '?';
  const subtitle = `1 ${city.currency} = ${rateDisplay}원 · ${syncDisplay}`;

  const categories = getCategoriesForPersona(persona);

  let seoulTotal = 0;
  let cityTotal = 0;

  const categoryData = categories.map((cfg) => {
    const seoulVal = cfg.getValue(seoul, fx);
    const cityVal = cfg.getValue(city, fx);

    const sVal = seoulVal ?? 0;
    const cVal = cityVal ?? 0;

    seoulTotal += sVal;
    cityTotal += cVal;

    const mult: number | '신규' = seoulVal === null && cityVal !== null
      ? '신규'
      : seoulVal !== null && cityVal !== null
        ? computeMultiplier(seoulVal, cityVal)
        : 1;

    const { swPct, cwPct } = computeBarPcts(sVal, cVal);

    return {
      ...cfg,
      seoulVal: sVal,
      cityVal: cVal,
      mult,
      swPct,
      cwPct,
    };
  });

  const totalMult = computeMultiplier(seoulTotal, cityTotal);
  const { swPct: heroSwPct, cwPct: heroCwPct } = computeBarPcts(seoulTotal, cityTotal);
  const diff = cityTotal - seoulTotal;
  const diffSign = diff >= 0 ? '+' : '';
  const centerCaption = `${diffSign}${formatKRW(diff)}/월`;

  const sourceCount = city.sources.length;

  return (
    <Screen scroll testID="compare-screen">
      <TopBar
        title={`서울 vs ${city.name.ko}`}
        titleVariant="h3"
        subtitle={subtitle}
        onBack={handleBack}
        rightIcon="star"
        rightIconAccent={isFavorite ? 'star' : 'default'}
        rightIconAccessibilityLabel="즐겨찾기"
        onRightPress={handleToggleFavorite}
        testID="compare-topbar"
      />

      <View className="px-screen-x mt-3">
        <HeroCard
          variant="orange"
          leftLabel="서울"
          leftValue={formatKRW(seoulTotal)}
          centerMult={formatMultiplier(totalMult)}
          centerCaption={centerCaption}
          rightLabel={city.name.ko}
          rightValue={formatKRW(cityTotal)}
          swPct={heroSwPct}
          cwPct={heroCwPct}
          footer="평균 가정 기준"
          testID="compare-hero"
        />
      </View>

      <View className="px-screen-x mt-4 gap-3">
        {categoryData.map((item) => {
          if (item.seoulVal === 0 && item.cityVal === 0) return null;

          return (
            <ComparePair
              key={item.category}
              category={item.category}
              label={item.label}
              sLabel="서울"
              sValue={formatKRW(item.seoulVal)}
              cLabel={city.name.ko}
              cValue={formatKRW(item.cityVal)}
              mult={item.mult}
              swPct={item.swPct}
              cwPct={item.cwPct}
              hot={typeof item.mult === 'number' ? isHot(item.mult) : false}
              onPress={() => router.push(`/detail/${cityId}/${item.category}`)}
              testID={`compare-pair-${item.category}`}
            />
          );
        })}
      </View>

      <View className="px-screen-x mt-6 pt-4 border-t border-dashed border-line">
        <View className="flex-row items-center justify-between">
          <Small color="gray-2">
            출처 {sourceCount}개 · 갱신 {lastSync ? formatShortDate(lastSync) : '?'}
          </Small>
          {/* v1.0 미구현 — onPress 부착은 v1.x 외부 링크 / 모달 결정 후 (PR #17 review 이슈 3) */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="출처 보기 (준비 중)"
            disabled
          >
            <Small color="gray-2" className="font-manrope-bold">
              출처 보기 →
            </Small>
          </Pressable>
        </View>
      </View>

      <View className="h-6" />
    </Screen>
  );
}
