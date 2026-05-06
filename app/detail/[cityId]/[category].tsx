/**
 * Detail 화면 — 카테고리별 항목 단위 비교.
 *
 * design/README §4 + step1.md 구현. v1.0 1차 타겟은 food (외식·식재료 GroceryRow).
 * 다른 카테고리 (rent/transport/tuition/tax/visa) 도 동일 골격 + 데이터 있는 항목만 렌더.
 *
 * Hot 판정은 isHot(mult) 단일 함수 (CLAUDE.md CRITICAL).
 */

import * as React from 'react';

import { ActivityIndicator, View } from 'react-native';

import { useLocalSearchParams, useRouter } from 'expo-router';

import { HeroCard } from '@/components/cards/HeroCard';
import { ErrorView } from '@/components/ErrorView';
import { GroceryRow } from '@/components/GroceryRow';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { MonoLabel, Small, Tiny } from '@/components/typography/Text';
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
  loadAllCities,
} from '@/lib';
import { colors } from '@/theme/tokens';
import type {
  CityCostData,
  ExchangeRates,
  SourceCategory,
} from '@/types/city';

const CATEGORY_LABEL: Record<SourceCategory, string> = {
  rent: '월세',
  food: '식비',
  transport: '교통',
  tuition: '학비',
  tax: '세금',
  visa: '비자/정착',
};

const VALID_CATEGORIES = new Set<SourceCategory>([
  'rent',
  'food',
  'transport',
  'tuition',
  'tax',
  'visa',
]);

function isValidCategory(c: string | undefined): c is SourceCategory {
  return c !== undefined && VALID_CATEGORIES.has(c as SourceCategory);
}

type Row = {
  key: string;
  emoji: string;
  name: string;
  seoulVal: number;
  cityVal: number;
};

type Section = {
  label: string;
  rows: Row[];
  emptyText?: string;
};

const FOOD_RESTAURANT_ROWS: { key: 'restaurantMeal' | 'cafe'; emoji: string; name: string }[] = [
  { key: 'restaurantMeal', emoji: '🍱', name: '식당 한 끼' },
  { key: 'cafe', emoji: '☕', name: '카페 음료' },
];

const FOOD_GROCERY_ROWS: { key: keyof CityCostData['food']['groceries']; emoji: string; name: string }[] = [
  { key: 'milk1L', emoji: '🥛', name: '우유 1L' },
  { key: 'eggs12', emoji: '🥚', name: '계란 12개' },
  { key: 'rice1kg', emoji: '🍚', name: '쌀 1kg' },
  { key: 'chicken1kg', emoji: '🍗', name: '닭고기 1kg' },
  { key: 'bread', emoji: '🍞', name: '식빵' },
  { key: 'onion1kg', emoji: '🧅', name: '양파 1kg' },
  { key: 'apple1kg', emoji: '🍎', name: '사과 1kg' },
  { key: 'ramen', emoji: '🍜', name: '라면' },
];

const RENT_ROWS: { key: keyof Pick<CityCostData['rent'], 'share' | 'studio' | 'oneBed' | 'twoBed'>; emoji: string; name: string }[] = [
  { key: 'share', emoji: '🛏️', name: '셰어하우스' },
  { key: 'studio', emoji: '🏠', name: '원룸·스튜디오' },
  { key: 'oneBed', emoji: '🏡', name: '1베드룸' },
  { key: 'twoBed', emoji: '🏘️', name: '2베드룸' },
];

const TRANSPORT_ROWS: { key: keyof CityCostData['transport']; emoji: string; name: string }[] = [
  { key: 'monthlyPass', emoji: '🎫', name: '대중교통 정기권' },
  { key: 'singleRide', emoji: '🚇', name: '1회권' },
  { key: 'taxiBase', emoji: '🚕', name: '택시 기본요금' },
];

function buildSections(
  category: SourceCategory,
  seoul: CityCostData,
  city: CityCostData,
  fx: ExchangeRates,
): Section[] {
  if (category === 'food') {
    const restaurant: Row[] = FOOD_RESTAURANT_ROWS.map((r) => ({
      key: r.key,
      emoji: r.emoji,
      name: r.name,
      seoulVal: convertToKRW(seoul.food[r.key], seoul.currency, fx),
      cityVal: convertToKRW(city.food[r.key], city.currency, fx),
    }));

    const grocery: Row[] = FOOD_GROCERY_ROWS.flatMap((r) => {
      const sRaw = seoul.food.groceries[r.key];
      const cRaw = city.food.groceries[r.key];
      if (sRaw === undefined || cRaw === undefined) return [];
      return [
        {
          key: String(r.key),
          emoji: r.emoji,
          name: r.name,
          seoulVal: convertToKRW(sRaw, seoul.currency, fx),
          cityVal: convertToKRW(cRaw, city.currency, fx),
        },
      ];
    });

    return [
      { label: '외식', rows: restaurant },
      { label: '식재료', rows: grocery },
    ];
  }

  if (category === 'rent') {
    const rows: Row[] = RENT_ROWS.flatMap((r) => {
      const sRaw = seoul.rent[r.key];
      const cRaw = city.rent[r.key];
      if (sRaw === null || cRaw === null) return [];
      return [
        {
          key: r.key,
          emoji: r.emoji,
          name: r.name,
          seoulVal: convertToKRW(sRaw, seoul.currency, fx),
          cityVal: convertToKRW(cRaw, city.currency, fx),
        },
      ];
    });
    return [
      {
        label: '주거 형태',
        rows,
        emptyText: '주거 데이터가 아직 준비되지 않았어요.',
      },
    ];
  }

  if (category === 'transport') {
    const rows: Row[] = TRANSPORT_ROWS.map((r) => ({
      key: r.key,
      emoji: r.emoji,
      name: r.name,
      seoulVal: convertToKRW(seoul.transport[r.key], seoul.currency, fx),
      cityVal: convertToKRW(city.transport[r.key], city.currency, fx),
    }));
    return [{ label: '교통 수단', rows }];
  }

  if (category === 'tuition') {
    // 인덱스 매핑 정책 (PR #17 review 이슈 5):
    // 도시 entries 가 N 개, 서울 entries 가 M 개 (M < N) 일 때, idx 가 M 이상인
    // 도시 entry 는 서울 entry[0] 와 비교 — "기준 학교" 와 비교한다는 fallback.
    // 의미가 약하지만 v1.0 에선 단일 페르소나 화면이라 "비교 가능한 무언가" 를
    // 제공하는 게 우선. v1.x 에서 학위·학교 수준 매칭 (level: undergrad/graduate)
    // 으로 정밀화.
    const seoulEntries = seoul.tuition ?? [];
    const cityEntries = city.tuition ?? [];
    const rows: Row[] = cityEntries.flatMap((cEntry, idx) => {
      const sEntry = seoulEntries[idx] ?? seoulEntries[0];
      if (!sEntry) return [];
      return [
        {
          key: `tuition-${idx}`,
          emoji: '🎓',
          name: cEntry.school,
          seoulVal: convertToKRW(sEntry.annual / 12, seoul.currency, fx),
          cityVal: convertToKRW(cEntry.annual / 12, city.currency, fx),
        },
      ];
    });
    return [
      {
        label: '학교 (월 환산)',
        rows,
        emptyText: '학비 데이터가 아직 준비되지 않았어요.',
      },
    ];
  }

  if (category === 'tax') {
    // tuition 과 동일한 인덱스 매핑 정책. 추가로 row name 에 연봉을 표시 — Row.name
    // 자체가 표현 문자열이라 formatKRW 호출. PR #17 review 이슈 6 의 "data 와 표현
    // 분리" 권장이지만, Row 가 이미 표현 레이어 (`emoji`, `name`) 라 일관 유지.
    // 입력 (`cEntry.annualSalary`) 은 데이터 schema 강제 양수 number — formatKRW
    // 가 throw 할 가능성 ≈ 0 (정상 fixture / 자동화 검증 통과 후 도달).
    const seoulEntries = seoul.tax ?? [];
    const cityEntries = city.tax ?? [];
    const rows: Row[] = cityEntries.flatMap((cEntry, idx) => {
      const sEntry = seoulEntries[idx] ?? seoulEntries[0];
      if (!sEntry) return [];
      const sMonthlyTax = (sEntry.annualSalary / 12) * (1 - sEntry.takeHomePctApprox / 100);
      const cMonthlyTax = (cEntry.annualSalary / 12) * (1 - cEntry.takeHomePctApprox / 100);
      return [
        {
          key: `tax-${idx}`,
          emoji: '💼',
          name: `연봉 ${formatKRW(convertToKRW(cEntry.annualSalary, city.currency, fx))}`,
          seoulVal: convertToKRW(sMonthlyTax, seoul.currency, fx),
          cityVal: convertToKRW(cMonthlyTax, city.currency, fx),
        },
      ];
    });
    return [
      {
        label: '월 세금 (대략)',
        rows,
        emptyText: '세금 데이터가 아직 준비되지 않았어요.',
      },
    ];
  }

  // visa
  const visa = city.visa;
  if (!visa) {
    return [
      {
        label: '비자/정착',
        rows: [],
        emptyText: '비자 데이터가 아직 준비되지 않았어요.',
      },
    ];
  }
  const rows: Row[] = [];
  const fee = visa.studentApplicationFee ?? visa.workApplicationFee;
  if (fee !== undefined) {
    rows.push({
      key: 'visa-fee',
      emoji: '🛂',
      name: '비자 신청 수수료',
      seoulVal: 0,
      cityVal: convertToKRW(fee, city.currency, fx),
    });
  }
  if (visa.settlementApprox !== undefined) {
    rows.push({
      key: 'visa-settle',
      emoji: '📦',
      name: '정착 비용 (대략)',
      seoulVal: 0,
      cityVal: convertToKRW(visa.settlementApprox, city.currency, fx),
    });
  }
  return [
    {
      label: '비자/정착',
      rows,
      emptyText: '비자 데이터가 아직 준비되지 않았어요.',
    },
  ];
}

type DetailData = {
  seoul: CityCostData;
  city: CityCostData;
  fx: ExchangeRates;
  lastSync: string | null;
};

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: DetailData };

export default function DetailScreen(): React.ReactElement {
  const { cityId, category } = useLocalSearchParams<{ cityId: string; category: string }>();
  const router = useRouter();

  const [state, setState] = React.useState<DetailState>({ status: 'loading' });

  const handleBack = React.useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [router]);

  React.useEffect(() => {
    if (!cityId || !category) {
      setState({ status: 'error', message: '잘못된 경로입니다' });
      return;
    }
    if (!isValidCategory(category)) {
      setState({ status: 'error', message: '알 수 없는 카테고리입니다' });
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
        const city = getCity(cityId as string);
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
    return () => {
      cancelled = true;
    };
  }, [cityId, category]);

  if (state.status === 'loading') {
    return (
      <Screen testID="detail-screen-loading">
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
      <Screen testID="detail-screen-error">
        <ErrorView
          variant="screen"
          message={state.message}
          onRetry={handleBack}
          retryLabel="돌아가기"
        />
      </Screen>
    );
  }

  // category 는 isValidCategory 통과 후라 SourceCategory 로 단언 가능.
  const cat = category as SourceCategory;
  const { seoul, city, fx, lastSync } = state.data;
  const sections = buildSections(cat, seoul, city, fx);

  const seoulTotal = sections.reduce(
    (acc, sec) => acc + sec.rows.reduce((a, r) => a + r.seoulVal, 0),
    0,
  );
  const cityTotal = sections.reduce(
    (acc, sec) => acc + sec.rows.reduce((a, r) => a + r.cityVal, 0),
    0,
  );
  const totalMult = computeMultiplier(seoulTotal, cityTotal);
  const { swPct, cwPct } = computeBarPcts(seoulTotal, cityTotal);

  const rate = fx[city.currency];
  const rateDisplay = rate !== undefined ? Math.round(rate) : '?';
  const syncDisplay = lastSync ? formatShortDate(lastSync) : '?';
  const subtitle = `1 ${city.currency} = ${rateDisplay}원 · ${syncDisplay}`;

  const categoryLabel = CATEGORY_LABEL[cat];
  const categorySources = city.sources.filter((s) => s.category === cat);
  const sourceCount = categorySources.length;

  return (
    <Screen scroll testID="detail-screen">
      <TopBar
        title={`${categoryLabel} · ${city.name.ko}`}
        titleVariant="h3"
        subtitle={subtitle}
        onBack={handleBack}
        testID="detail-topbar"
      />

      {/*
        Detail hero 합계는 본 화면 섹션의 단가(또는 월 환산 entry) 합 — Compare
        화면의 "월 예상 총비용" 휴리스틱과 의도가 다름 (PR #17 review 이슈 1).
        예: food 의 Compare 카드 = restaurantMeal*20 + grocery*4 (월 추정);
        Detail food hero = 외식 2 항목 + 식재료 8 항목 단가 합. 사용자 혼동을
        피하기 위해 hero footer 에 "항목 단가 합" 으로 명시.
      */}
      <View className="px-screen-x mt-3">
        <HeroCard
          variant="navy"
          leftLabel="서울"
          leftValue={formatKRW(seoulTotal)}
          centerMult={formatMultiplier(totalMult)}
          centerCaption={`${categoryLabel} 합계`}
          rightLabel={city.name.ko}
          rightValue={formatKRW(cityTotal)}
          swPct={swPct}
          cwPct={cwPct}
          footer="항목 단가 합"
          testID="detail-hero"
        />
      </View>

      <View className="px-screen-x mt-4 gap-4">
        {sections.map((section) => (
          <View key={section.label} testID={`detail-section-${section.label}`}>
            <View className="flex-row items-center justify-between mb-2">
              <MonoLabel>{section.label}</MonoLabel>
              {section.rows.length > 0 && (
                <Tiny color="gray-2">{section.rows.length} 항목</Tiny>
              )}
            </View>
            {section.rows.length === 0 ? (
              <View className="bg-light-2 rounded-card p-4">
                <Small color="gray-2">{section.emptyText ?? '데이터 준비 중'}</Small>
              </View>
            ) : (
              <View className="bg-white rounded-card border border-line overflow-hidden">
                {section.rows.map((row, idx) => {
                  const mult = computeMultiplier(row.seoulVal, row.cityVal);
                  return (
                    <View key={row.key} className="px-3">
                      <GroceryRow
                        name={row.name}
                        emoji={row.emoji}
                        seoulPrice={formatKRW(row.seoulVal)}
                        cityPrice={formatKRW(row.cityVal)}
                        mult={typeof mult === 'number' ? mult : 1}
                        isLast={idx === section.rows.length - 1}
                        testID={`detail-row-${row.key}`}
                      />
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ))}
      </View>

      <View
        className="px-screen-x mt-6 pt-4 border-t border-dashed border-line gap-2"
        testID="detail-sources"
      >
        <View className="flex-row items-center justify-between">
          <MonoLabel color="gray-2">출처 {sourceCount}개</MonoLabel>
          <Tiny color="gray-2">
            갱신 {lastSync ? formatShortDate(lastSync) : '?'}
          </Tiny>
        </View>
        {sourceCount === 0 ? (
          <Small color="gray-2">출처 정보가 없어요</Small>
        ) : (
          <View className="gap-1">
            {categorySources.map((s, idx) => (
              <Small
                key={`${s.name}-${idx}`}
                color="navy"
                testID={`detail-source-${idx}`}
              >
                {s.name}
              </Small>
            ))}
          </View>
        )}
      </View>

      <View className="h-6" />
    </Screen>
  );
}
