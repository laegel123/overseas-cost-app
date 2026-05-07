/**
 * Compare 화면 — 서울 vs 도시 1:1 비교 (앱의 메인 화면).
 *
 * design/README §3 + step0.md 구현. 페르소나 분기, Hot 규칙, 데이터 정책 모두 준수.
 */

import * as React from 'react';

import { ActivityIndicator, Pressable, View } from 'react-native';

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
import {
  resolveInclusion,
  resolveRentChoice,
  resolveTaxChoice,
  resolveTuitionChoice,
  useCategoryInclusionStore,
  useRentChoiceStore,
  useTaxChoiceStore,
  useTuitionChoiceStore,
} from '@/store';
import type { RentChoice, TaxChoice, TuitionChoice } from '@/store';
import { useFavoritesStore } from '@/store/favorites';
import { usePersonaStore } from '@/store/persona';
import { useRecentStore } from '@/store/recent';
import { colors } from '@/theme/tokens';
import type {
  CityCostData,
  ExchangeRates,
  Persona,
  SourceCategory,
} from '@/types/city';

type CategoryConfig = {
  category: SourceCategory;
  label: string;
  /**
   * 카테고리 월 비용 (KRW). 사용자 선택 (`rentChoice` / `tuitionChoice` /
   * `taxChoice`) 에 따라 값이 바뀜 — Detail 의 단일 선택이 Compare hero / 카드
   * 에도 그대로 반영되도록 단일 출처화 (ADR-060 / ADR-061). 다른 카테고리는
   * 무시하는 인자도 항상 전달 — 호출부 일관성 유지.
   */
  getValue: (
    city: CityCostData,
    fx: ExchangeRates,
    rentChoice: RentChoice,
    tuitionChoice: TuitionChoice | undefined,
    taxChoice: TaxChoice | undefined,
  ) => number | null;
};

const RENT_CONFIG: CategoryConfig = {
  category: 'rent',
  label: '월세',
  // 본 getValue 는 컴포넌트 본문 categoryData 빌드부에서 직접 호출되지 않는다
  // (PR #24 review 이슈 2). rent 는 city 기준 resolved key 를 1 회 결정 후
  // 양쪽 동일 key 적용. 본 정의는 CategoryConfig 인터페이스 충족용 +
  // 단일 도시 호출 시 일관된 결과 (city 기반 fallback) 보장.
  getValue: (city, fx, rentChoice) => {
    const resolved = resolveRentChoice(city.rent, rentChoice);
    if (resolved === null) return null;
    return convertToKRW(resolved.value, city.currency, fx);
  },
};

// 한 달 식비 추정 휴리스틱 (Compare hero 용 — 월 비용 표시).
// design/README §4 의 "자취 70% + 외식 30% 가정" 가이드라인 단순화 버전:
//   - 외식: 평일 점심 + 가벼운 카페 = 한 끼 평균가 * 약 20일 (주말 제외 + 일부 일치).
//   - 식재료: 4 핵심 항목 (우유 1L · 계란 12 · 쌀 1kg · 닭고기 1kg) 의 단가 합 * 4.
//     주 1회 장보기 * 4주 가정. Detail 의 8 항목 단가 합 (raw 비교) 과는 다른 의미 —
//     Compare 는 "월 예상", Detail 은 "항목 단가" (PR #17 review 이슈 1·4).
// v1.x 에서 lib 으로 추출 (compare.ts) + 휴리스틱 정밀화.
const FOOD_RESTAURANT_DAYS_PER_MONTH = 20;
const FOOD_GROCERY_TRIPS_PER_MONTH = 4;

const FOOD_CONFIG: CategoryConfig = {
  category: 'food',
  label: '식비',
  getValue: (city, fx) => {
    const meal = (city.food.restaurantMeal + city.food.cafe) * FOOD_RESTAURANT_DAYS_PER_MONTH;
    const groceryUnitSum =
      city.food.groceries.milk1L +
      city.food.groceries.eggs12 +
      city.food.groceries.rice1kg +
      city.food.groceries.chicken1kg;
    const total = meal + groceryUnitSum * FOOD_GROCERY_TRIPS_PER_MONTH;
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
  // ADR-061 — Detail 에서 선택한 학교 (preset) 또는 직접 입력값을 동일 단일
  // 출처에서 적용. 미선택이면 첫 entry fallback. 도시 데이터 결측 → null.
  // PR #25 3차 review — Compare 가 seoul 도 동일 호출에 통과하므로, entries 가
  // 비어있으면 (서울 정책 + 도시 데이터 미보유) tuitionChoice 의 custom kind 가
  // 의도치 않게 통과하지 않도록 짧게 null 반환. resolveTuitionChoice 자체는
  // sheet 컨텍스트에서 custom 을 entries 와 무관하게 허용하는 의도가 있어
  // 호출부에서 가드.
  getValue: (city, fx, _rentChoice, tuitionChoice) => {
    if (!city.tuition || city.tuition.length === 0) return null;
    const resolved = resolveTuitionChoice(city.tuition, tuitionChoice);
    if (resolved === null) return null;
    return convertToKRW(resolved.annual / 12, city.currency, fx);
  },
};

const TAX_CONFIG: CategoryConfig = {
  category: 'tax',
  label: '세금',
  // ADR-061 — Detail 에서 선택한 연봉 tier 또는 직접 입력값. 도시 첫 preset 의
  // takeHomePctApprox 사용 (custom 일 때).
  getValue: (city, fx, _rentChoice, _tuitionChoice, taxChoice) => {
    const resolved = resolveTaxChoice(city.tax, taxChoice);
    if (resolved === null) return null;
    const monthlySalary = resolved.annualSalary / 12;
    // takeHomePctApprox 는 [0,1] 소수 (citySchema 검증 — 0.74 = 74%). PR #25 review.
    const tax = monthlySalary * (1 - resolved.takeHomePctApprox);
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
  // ADR-060 — Detail 에서 바꾼 주거 형태 선택이 Compare hero / 월세 카드에도
  // 즉시 반영되도록 동일 store 구독.
  const rentChoice = useRentChoiceStore((s) => s.rentChoice);
  // ADR-061 — 학비/세금 도시별 선택. cityId 미정 단계에선 undefined 반환 후
  // resolveTuitionChoice / resolveTaxChoice 가 첫 entry fallback 처리.
  const tuitionChoice = useTuitionChoiceStore((s) =>
    cityId ? s.choices[cityId] : undefined,
  );
  const taxChoice = useTaxChoiceStore((s) =>
    cityId ? s.choices[cityId] : undefined,
  );
  // ADR-062 — 도시별 inclusion (포함/제외 토글). 미설정 카테고리는
  // resolveInclusion 이 페르소나 default 적용. 도시 전체 map 을 구독하지만
  // 사용자 토글은 같은 도시 내에서만 발생 → 다른 도시 변경에 의한 리렌더링
  // 비용은 사실상 없음.
  const inclusions = useCategoryInclusionStore((s) => s.inclusions);
  const setInclusion = useCategoryInclusionStore((s) => s.setInclusion);

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

  // 페르소나가 바뀔 때만 카테고리 배열 재생성 (PR #17 review 이슈 7).
  // 모든 hook 은 early return 보다 위에 있어야 한다 (rules-of-hooks).
  const categories = React.useMemo(() => getCategoriesForPersona(persona), [persona]);

  if (state.status === 'loading') {
    return (
      <Screen testID="compare-screen-loading">
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

  let seoulTotal = 0;
  let cityTotal = 0;

  // PR #24 review 이슈 2 — rent 는 city.rent 기준으로 resolved key 를 1 회
  // 결정한 뒤 양쪽에 같은 key 를 강제 적용. 두 도시가 각각 독립 fallback 하면
  // "서울 oneBed vs 도시 share" 같은 의미 없는 비교가 발생할 수 있다.
  // (seoul.rent 가 v1.0 시드에서 모두 채워져 있어 같은 key 의 seoul 데이터는
  // 항상 존재 — 만약 결측이면 seoulVal=null 로 표시.)
  const resolvedRent = resolveRentChoice(city.rent, rentChoice);

  const categoryData = categories.map((cfg) => {
    let seoulVal: number | null;
    let cityVal: number | null;
    if (cfg.category === 'rent') {
      if (resolvedRent === null) {
        seoulVal = null;
        cityVal = null;
      } else {
        const seoulRaw = seoul.rent[resolvedRent.key];
        seoulVal =
          seoulRaw !== null && seoulRaw !== undefined
            ? convertToKRW(seoulRaw, seoul.currency, fx)
            : null;
        cityVal = convertToKRW(resolvedRent.value, city.currency, fx);
      }
    } else {
      seoulVal = cfg.getValue(seoul, fx, rentChoice, tuitionChoice, taxChoice);
      cityVal = cfg.getValue(city, fx, rentChoice, tuitionChoice, taxChoice);
    }

    const sVal = seoulVal ?? 0;
    const cVal = cityVal ?? 0;

    // ADR-062 — included 카테고리만 hero 합산에 누적. 카드 자체는 토글 OFF 라도
    // 화면에 표시 (opacity + 배지) — 사용자가 다시 켤 동선 확보.
    const included = resolveInclusion(
      cityId ?? '',
      cfg.category,
      persona,
      inclusions,
    );
    if (included) {
      seoulTotal += sVal;
      cityTotal += cVal;
    }

    const mult: number | '신규' = seoulVal === null && cityVal !== null
      ? '신규'
      : seoulVal !== null && cityVal !== null
        ? computeMultiplier(seoulVal, cityVal)
        : 1;

    const { swPct, cwPct } = computeBarPcts(sVal, cVal);

    // PR #25 7차 review — 세금 custom 입력 시 takeHomePctApprox 는 entries[0]
    // 의 값을 차용 (단순화). Compare 한 줄 카드라 사용자가 정확한 수치로 오해
    // 하지 않도록 "(근사)" 표기. v1.x 에서 takeHomePct 보간 정밀화 후 표기
    // 정책 재검토 (ADR-061 Deferred).
    const displayLabel =
      cfg.category === 'tax' && taxChoice?.kind === 'custom'
        ? `${cfg.label} (근사)`
        : cfg.label;

    return {
      ...cfg,
      displayLabel,
      seoulVal: sVal,
      cityVal: cVal,
      mult,
      swPct,
      cwPct,
      included,
    };
  });

  // ADR-062 — 서울 합 = 0 (예: 학비/비자 등 한국 0원 카테고리만 ON) 이면
  // division by zero / `↑∞×` 회피 위해 hero 가운데 mult 영역 미표시. caption
  // (차액) 만으로 비교 정보 전달.
  const heroCenterMult: string | undefined =
    seoulTotal > 0
      ? formatMultiplier(computeMultiplier(seoulTotal, cityTotal))
      : undefined;
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
          centerMult={heroCenterMult}
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
              label={item.displayLabel}
              sLabel="서울"
              sValue={formatKRW(item.seoulVal)}
              cLabel={city.name.ko}
              cValue={formatKRW(item.cityVal)}
              mult={item.mult}
              swPct={item.swPct}
              cwPct={item.cwPct}
              hot={typeof item.mult === 'number' ? isHot(item.mult) : false}
              included={item.included}
              onToggleInclude={(next) => {
                if (cityId) setInclusion(cityId, item.category, next);
              }}
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
