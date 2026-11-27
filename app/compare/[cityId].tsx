/**
 * Compare 화면 — 기준 도시 vs 대상 도시 1:1 비교 (앱의 메인 화면).
 *
 * design/README §3 + step0.md 구현. Hot 규칙, 데이터 정책 모두 준수.
 *
 * 기준 도시(왼쪽)는 query param `?base=<id>` 다 (ADR-089). 생략하거나 `seoul` 이면
 * **서울 모드** = 종전 동작과 완전히 동일. 서울이 아닌 기준 도시가 오면 도시끼리 모드:
 *   - 학비·세금 선택값을 도시별로 따로 적용한다 (한쪽 선택이 반대쪽 계산에 섞이면
 *     비교가 거짓이 된다).
 *   - 포함 토글 저장 키는 `"<base>|<cityId>"` — 서울 기준 화면의 토글과 분리.
 *   - 한쪽만 값이 없으면 그 값은 `—`, 배수 미표시, hero 합계에서 양쪽 모두 제외.
 *     0원으로 표시하지 않는다 ("무료" 로 오독됨 — CLAUDE.md 에러 삼킴 금지).
 *   - 즐겨찾기 별·최근 목록 기록은 하지 않는다 (어느 도시인지 모호).
 * 서울은 항상 왼쪽이다 — 서울이 대상으로 들어오면 서울 모드 주소로 정규화한다.
 *
 * 하단 footer: AdBanner (ready 상태만, ADR-077)
 */

import * as React from 'react';

import { ActivityIndicator, Pressable, View } from 'react-native';

import { useLocalSearchParams, useRouter } from 'expo-router';

import { AdBanner } from '@/components';
import { HeroCard } from '@/components/cards/HeroCard';
import { ComparePair } from '@/components/ComparePair';
import { ErrorView } from '@/components/ErrorView';
import { Screen } from '@/components/Screen';
import { TopBar, type TopBarProps } from '@/components/TopBar';
import { Small } from '@/components/typography/Text';
import {
  CATEGORY_LABEL,
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
import { useRecentStore } from '@/store/recent';
import { colors } from '@/theme/tokens';
import type {
  CityCostData,
  ExchangeRates,
  SourceCategory,
} from '@/types/city';

/** 서울은 항상 기준(왼쪽)이다 (ADR-089). `?base=` 기본값이자 서울 모드 판정 기준. */
const SEOUL_ID = 'seoul';

/**
 * 도시끼리 모드에서 한쪽 값이 결측일 때의 표기. 0원으로 쓰지 않는다 — 서울이
 * 아닌 도시의 결측을 0원으로 보이면 "무료" 로 오독된다 (ADR-089).
 */
const MISSING_VALUE = '—';

// 라벨은 본 타입에 두지 않는다 — `CATEGORY_LABEL[category]` 단일 출처 (ADR-071).
type CategoryConfig = {
  category: SourceCategory;
  /**
   * 카테고리 월 비용 (KRW). 사용자 선택 (`rentChoice` / `tuitionChoice` /
   * `taxChoice`) 에 따라 값이 바뀜 — Detail 의 단일 선택이 Compare hero / 카드
   * 에도 그대로 반영되도록 단일 출처화 (ADR-060 / ADR-061). 다른 카테고리는
   * 무시하는 인자도 항상 전달 — 호출부 일관성 유지.
   *
   * ADR-089 — 학비·세금 선택값은 **도시별**이다. 호출부는 기준 도시 열에
   * `choices[base]`, 대상 도시 열에 `choices[cityId]` 를 넘긴다.
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
  // 본 getValue 는 컴포넌트 본문 categoryData 빌드부에서 직접 호출되지 않는다
  // (PR #24 review 이슈 2). rent 는 대상 도시 기준 resolved key 를 1 회 결정 후
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
  getValue: (city, fx) => {
    return convertToKRW(city.transport.monthlyPass, city.currency, fx);
  },
};

const TUITION_CONFIG: CategoryConfig = {
  category: 'tuition',
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
  getValue: (city, fx) => {
    if (!city.visa) return null;
    const fee = city.visa.studentApplicationFee ?? city.visa.workApplicationFee ?? 0;
    const settle = city.visa.settlementApprox ?? 0;
    const total = fee + settle;
    if (total === 0) return null;
    return convertToKRW(total, city.currency, fx);
  },
};

// ADR-067 — 페르소나 제거로 Compare 는 항상 6 카테고리 (통합 뷰).
const COMPARE_CATEGORIES: CategoryConfig[] = [
  RENT_CONFIG,
  FOOD_CONFIG,
  TRANSPORT_CONFIG,
  TUITION_CONFIG,
  TAX_CONFIG,
  VISA_CONFIG,
];

type CompareData = {
  /** 왼쪽 = 기준 도시. 서울 모드면 서울. */
  base: CityCostData;
  /** 오른쪽 = 대상 도시. */
  city: CityCostData;
  fx: ExchangeRates;
  lastSync: string | null;
};

type CompareState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: CompareData };

/**
 * 부제의 환율 한 토막 — `1 CAD = 980원`. 환율 결측은 `?` 로 가시화 (삼키지 않는다).
 */
function formatRateLabel(currency: string, fx: ExchangeRates): string {
  const rate = fx[currency];
  const rateDisplay = rate !== undefined ? Math.round(rate) : '?';
  return `1 ${currency} = ${rateDisplay}원`;
}

export default function CompareScreen(): React.ReactElement {
  const { cityId, base } = useLocalSearchParams<{ cityId: string; base?: string }>();
  const router = useRouter();

  // ADR-089 — `?base=` 생략·빈 값 → 서울 모드 (종전 동작과 완전히 동일).
  const baseId = base !== undefined && base !== '' ? base : SEOUL_ID;
  const isCityPair = baseId !== SEOUL_ID;

  const isFavorite = useFavoritesStore((s) => s.has(cityId ?? ''));
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const pushRecent = useRecentStore((s) => s.push);
  // ADR-060 — Detail 에서 바꾼 주거 형태 선택이 Compare hero / 월세 카드에도
  // 즉시 반영되도록 동일 store 구독. (주거 형태는 전역 단일값.)
  const rentChoice = useRentChoiceStore((s) => s.rentChoice);
  // ADR-061 — 학비/세금 도시별 선택. cityId 미정 단계에선 undefined 반환 후
  // resolveTuitionChoice / resolveTaxChoice 가 첫 entry fallback 처리.
  // ADR-089 — 기준 도시 열에는 기준 도시의 선택값을 쓴다. 서울 모드에서 서울은
  // 학비·세금 데이터가 없어 어느 선택값이든 null 로 떨어지므로 결과는 불변.
  const tuitionChoice = useTuitionChoiceStore((s) =>
    cityId ? s.choices[cityId] : undefined,
  );
  const baseTuitionChoice = useTuitionChoiceStore((s) => s.choices[baseId]);
  const taxChoice = useTaxChoiceStore((s) =>
    cityId ? s.choices[cityId] : undefined,
  );
  const baseTaxChoice = useTaxChoiceStore((s) => s.choices[baseId]);
  // ADR-062 / ADR-067 — 도시별 inclusion (포함/제외 토글). 미설정 카테고리는
  // resolveInclusion 이 고정 default 적용. 도시 전체 map 을 구독하지만
  // 사용자 토글은 같은 도시 내에서만 발생 → 다른 도시 변경에 의한 리렌더링
  // 비용은 사실상 없음.
  const inclusions = useCategoryInclusionStore((s) => s.inclusions);
  const setInclusion = useCategoryInclusionStore((s) => s.setInclusion);

  // ADR-089 — 포함 토글 저장 키. 도시끼리 모드는 쌍 단위로 분리해 서울 기준
  // 화면의 토글을 건드리지 않는다. `categoryInclusion` store 는 문자열 키 map
  // 이라 store 변경 없이 성립.
  const inclusionKey = isCityPair ? `${baseId}|${cityId ?? ''}` : (cityId ?? '');

  const [state, setState] = React.useState<CompareState>({ status: 'loading' });

  // 서울이 대상(오른쪽)으로 들어온 주소는 서울 모드 주소로 정규화한다. 서울은
  // 학비·세금·비자가 정책상 0원이라 오른쪽에 두면 `0 ÷ 값` 배수가 되어
  // formatMultiplier·isHot 이 throw 한다 (ADR-089).
  const needsSeoulNormalize = cityId === SEOUL_ID && isCityPair;

  React.useEffect(() => {
    if (!needsSeoulNormalize) return;
    router.replace(`/compare/${baseId}`);
    // router 는 expo-router 의 모듈 싱글턴이라 deps 에 넣을 필요가 없다 (테스트
    // mock 은 렌더마다 새 객체를 돌려줘 deps 에 넣으면 매 렌더 재실행된다).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsSeoulNormalize, baseId]);

  React.useEffect(() => {
    if (!cityId) {
      setState({ status: 'error', message: '도시 ID가 없습니다' });
      return;
    }
    // 정규화 redirect 중 — loading 유지 (위 effect 가 화면을 교체한다).
    if (needsSeoulNormalize) return;
    if (baseId === cityId) {
      setState({ status: 'error', message: '같은 도시끼리는 비교할 수 없어요' });
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

        const baseCity = getCity(baseId);
        const city = getCity(cityId);

        if (!baseCity) {
          setState({
            status: 'error',
            message:
              baseId === SEOUL_ID
                ? '서울 데이터를 찾을 수 없습니다'
                : '도시 데이터를 찾을 수 없습니다',
          });
          return;
        }
        if (!city) {
          setState({ status: 'error', message: '도시 데이터를 찾을 수 없습니다' });
          return;
        }

        setState({ status: 'ready', data: { base: baseCity, city, fx, lastSync } });
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : '데이터 로드 실패';
        setState({ status: 'error', message: msg });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [cityId, baseId, needsSeoulNormalize]);

  React.useEffect(() => {
    // ADR-089 — 도시끼리 모드는 최근 목록에 쓰지 않는다. 홈의 최근 목록은
    // 누르면 서울 모드로 열리기 때문.
    if (!isCityPair && cityId && state.status === 'ready') {
      pushRecent(cityId);
    }
  }, [isCityPair, cityId, state.status, pushRecent]);

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

  // ADR-067 — 항상 6 카테고리 (통합 뷰). 정적 상수라 memo 불필요.
  const categories = COMPARE_CATEGORIES;

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

  const { base: baseCity, city, fx, lastSync } = state.data;

  const syncDisplay = lastSync ? formatShortDate(lastSync) : '?';
  // 서울 모드 = 대상 도시 통화 1개 (현행 문자열 그대로).
  // 도시끼리 모드 = 두 도시 통화 모두. 같은 통화면 한 번만, KRW 는 생략 (ADR-089).
  const subtitleCurrencies = isCityPair
    ? [baseCity.currency, city.currency].filter(
        (c, i, arr) => c !== 'KRW' && arr.indexOf(c) === i,
      )
    : [city.currency];
  const subtitle = [
    ...subtitleCurrencies.map((c) => formatRateLabel(c, fx)),
    syncDisplay,
  ].join(' · ');

  let baseTotal = 0;
  let cityTotal = 0;

  // PR #24 review 이슈 2 — rent 는 city.rent 기준으로 resolved key 를 1 회
  // 결정한 뒤 양쪽에 같은 key 를 강제 적용. 두 도시가 각각 독립 fallback 하면
  // "기준 oneBed vs 대상 share" 같은 의미 없는 비교가 발생할 수 있다.
  // (v1.0 데이터는 21개 도시 모두 4개 형태가 채워져 있어 같은 key 의 기준 도시
  // 데이터는 항상 존재 — 만약 결측이면 기준 값이 null 로 떨어진다.)
  const resolvedRent = resolveRentChoice(city.rent, rentChoice);

  const categoryData = categories.map((cfg) => {
    let baseVal: number | null;
    let cityVal: number | null;
    if (cfg.category === 'rent') {
      if (resolvedRent === null) {
        baseVal = null;
        cityVal = null;
      } else {
        const baseRaw = baseCity.rent[resolvedRent.key];
        baseVal =
          baseRaw !== null && baseRaw !== undefined
            ? convertToKRW(baseRaw, baseCity.currency, fx)
            : null;
        cityVal = convertToKRW(resolvedRent.value, city.currency, fx);
      }
    } else {
      // ADR-089 — 선택값은 열마다 그 도시의 것. 섞이면 비교가 거짓이 된다.
      baseVal = cfg.getValue(baseCity, fx, rentChoice, baseTuitionChoice, baseTaxChoice);
      cityVal = cfg.getValue(city, fx, rentChoice, tuitionChoice, taxChoice);
    }

    const sVal = baseVal ?? 0;
    const cVal = cityVal ?? 0;

    // ADR-089 — 도시끼리 모드에서 한쪽만 결측이면 그 값은 `—`, 배수 미표시,
    // 합계에서 **양쪽 모두** 제외. 서울 모드의 null 은 정책상 0원이므로 현행
    // 그대로 둔다 (`신규` 배지 포함).
    const baseMissing = isCityPair && baseVal === null;
    const cityMissing = isCityPair && cityVal === null;
    const partialMissing = baseMissing !== cityMissing;

    // ADR-062 — included 카테고리만 hero 합산에 누적. 카드 자체는 토글 OFF 라도
    // 화면에 표시 (opacity + 배지) — 사용자가 다시 켤 동선 확보.
    const included = resolveInclusion(inclusionKey, cfg.category, inclusions);
    if (included && !partialMissing) {
      baseTotal += sVal;
      cityTotal += cVal;
    }

    const mult: number | '신규' | null = partialMissing
      ? null
      : baseVal === null && cityVal !== null
        ? '신규'
        : baseVal !== null && cityVal !== null
          ? computeMultiplier(baseVal, cityVal)
          : 1;

    const { swPct, cwPct } = computeBarPcts(sVal, cVal);

    // PR #25 7차 review — 세금 custom 입력 시 takeHomePctApprox 는 entries[0]
    // 의 값을 차용 (단순화). Compare 한 줄 카드라 사용자가 정확한 수치로 오해
    // 하지 않도록 "(근사)" 표기. 도시끼리 모드는 어느 한쪽이라도 직접 입력이면
    // 붙인다 (ADR-089). v1.x 에서 takeHomePct 보간 정밀화 후 표기 정책 재검토
    // (ADR-061 Deferred).
    const label = CATEGORY_LABEL[cfg.category];
    const displayLabel =
      cfg.category === 'tax' &&
      (taxChoice?.kind === 'custom' || baseTaxChoice?.kind === 'custom')
        ? `${label} (근사)`
        : label;

    return {
      ...cfg,
      displayLabel,
      baseValue: baseMissing ? MISSING_VALUE : formatKRW(sVal),
      cityValue: cityMissing ? MISSING_VALUE : formatKRW(cVal),
      hidden: sVal === 0 && cVal === 0,
      mult,
      swPct,
      cwPct,
      included,
    };
  });

  // ADR-062 — 기준 합 = 0 (예: 학비/비자 등 서울 0원 카테고리만 ON) 이면
  // division by zero / `↑∞×` 회피 위해 hero 가운데 mult 영역 미표시. caption
  // (차액) 만으로 비교 정보 전달.
  const heroCenterMult: string | undefined =
    baseTotal > 0
      ? formatMultiplier(computeMultiplier(baseTotal, cityTotal))
      : undefined;
  const { swPct: heroSwPct, cwPct: heroCwPct } = computeBarPcts(baseTotal, cityTotal);
  const diff = cityTotal - baseTotal;
  const diffSign = diff >= 0 ? '+' : '';
  // ADR-075 — `/월` 접미사 제거. 합계는 항목 단가의 합이지 가계 월 지출 추정치가
  // 아니므로 "월 지출" 로 읽히는 표기를 쓰지 않는다.
  const centerCaption = `${diffSign}${formatKRW(diff)}`;

  // 도시끼리 모드는 두 도시 값을 함께 보여주므로 출처 개수도 양쪽 합 (ADR-076).
  const sourceCount = isCityPair
    ? baseCity.sources.length + city.sources.length
    : city.sources.length;

  // 도시끼리 모드에서는 즐겨찾기 별을 넘기지 않는다 — 어느 도시의 별인지 모호하다
  // (ADR-089). TopBar 는 rightIcon + onRightPress 가 모두 있을 때만 버튼을 그린다.
  const starProps: Pick<
    TopBarProps,
    'rightIcon' | 'rightIconAccent' | 'rightIconAccessibilityLabel' | 'onRightPress'
  > = isCityPair
    ? {}
    : {
        rightIcon: 'star',
        rightIconAccent: isFavorite ? 'star' : 'default',
        rightIconAccessibilityLabel: '즐겨찾기',
        onRightPress: handleToggleFavorite,
      };

  return (
    <Screen scroll testID="compare-screen" footer={<AdBanner />}>
      <TopBar
        title={`${baseCity.name.ko} vs ${city.name.ko}`}
        titleVariant="h3"
        subtitle={subtitle}
        onBack={handleBack}
        {...starProps}
        testID="compare-topbar"
      />

      <View className="px-screen-x mt-3">
        <HeroCard
          variant="orange"
          leftLabel={baseCity.name.ko}
          leftValue={formatKRW(baseTotal)}
          centerMult={heroCenterMult}
          centerCaption={centerCaption}
          rightLabel={city.name.ko}
          rightValue={formatKRW(cityTotal)}
          swPct={heroSwPct}
          cwPct={heroCwPct}
          footer="항목 단가 합"
          testID="compare-hero"
        />
      </View>

      <View className="px-screen-x mt-4 gap-3">
        {categoryData.map((item) => {
          if (item.hidden) return null;

          return (
            <ComparePair
              key={item.category}
              category={item.category}
              label={item.displayLabel}
              sLabel={baseCity.name.ko}
              sValue={item.baseValue}
              cLabel={city.name.ko}
              cValue={item.cityValue}
              mult={item.mult}
              swPct={item.swPct}
              cwPct={item.cwPct}
              hot={typeof item.mult === 'number' ? isHot(item.mult) : false}
              included={item.included}
              onToggleInclude={(next) => {
                if (cityId) setInclusion(inclusionKey, item.category, next);
              }}
              onPress={() =>
                router.push(
                  isCityPair
                    ? `/detail/${cityId}/${item.category}?base=${baseId}`
                    : `/detail/${cityId}/${item.category}`,
                )
              }
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
