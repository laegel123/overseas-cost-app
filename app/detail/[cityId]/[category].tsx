/**
 * Detail 화면 — 카테고리별 항목 단위 비교.
 *
 * design/README §4 + step1.md 구현. 페르소나 분기, Hot 규칙, 데이터 정책 모두 준수.
 *
 * Hot 판정은 isHot(mult) 단일 함수 (CLAUDE.md CRITICAL).
 *
 * 단일 선택 모드 (rent / tuition / tax):
 *   - rent: 인라인 행 탭으로 4 형태 순환 (ADR-060)
 *   - tuition / tax: 칩 탭 → 바텀시트 (학교/연봉 목록 + 직접 입력) (ADR-061)
 *   서울 데이터 결측 (한국 거주 기준 — 학비/세금 0원) 정책: seoulVal=0 직접 사용.
 */

import * as React from 'react';

import { ActivityIndicator, Pressable, View } from 'react-native';

import { useLocalSearchParams, useRouter } from 'expo-router';

import { useShallow } from 'zustand/react/shallow';

import { HeroCard } from '@/components/cards/HeroCard';
import { ErrorView } from '@/components/ErrorView';
import { GroceryRow } from '@/components/GroceryRow';
import { Screen } from '@/components/Screen';
import { TaxChoiceSheet } from '@/components/TaxChoiceSheet';
import { TopBar } from '@/components/TopBar';
import { TuitionChoiceSheet } from '@/components/TuitionChoiceSheet';
import { Body, MonoLabel, Small, Tiny } from '@/components/typography/Text';
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
import {
  resolveRentChoice,
  resolveTaxChoice,
  resolveTuitionChoice,
  useRentChoiceStore,
  useTaxChoiceStore,
  useTuitionChoiceStore,
} from '@/store';
import type { RentChoice, TaxChoice, TuitionChoice } from '@/store';
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
  /**
   * rent 인라인 단일 선택 — 사용자가 행을 직접 탭해 4 형태 중 하나로 cycle (ADR-060).
   */
  selectable?: boolean;
  /**
   * tuition / tax 시트 기반 단일 선택 — 행은 1개 (현재 선택), 탭 시 시트 오픈 (ADR-061).
   */
  pickerKind?: 'tuition' | 'tax';
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
  tuitionChoice: TuitionChoice | undefined,
  taxChoice: TaxChoice | undefined,
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
        selectable: true,
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
    // ADR-061 — 합산 비교는 의미 없어 사용자 선택 1개를 단일 출처로.
    // 서울 학비 데이터는 정책상 부재 (한국 거주 기준 — 학비 0원). seoulVal=0 직접 사용.
    const resolved = resolveTuitionChoice(city.tuition, tuitionChoice);
    if (resolved === null) {
      return [
        {
          label: '학교 (월 환산)',
          rows: [],
          emptyText: '학비 데이터가 아직 준비되지 않았어요.',
          pickerKind: 'tuition',
        },
      ];
    }
    return [
      {
        label: '학교 (월 환산)',
        rows: [
          {
            key: `tuition-${resolved.isCustom ? 'custom' : resolved.school}`,
            emoji: resolved.isCustom ? '✏️' : '🎓',
            // resolved.school 은 custom 일 때 이미 '직접 입력' 문자열 (resolver 정책).
            name: resolved.school,
            seoulVal: 0,
            cityVal: convertToKRW(resolved.annual / 12, city.currency, fx),
          },
        ],
        pickerKind: 'tuition',
      },
    ];
  }

  if (category === 'tax') {
    // ADR-061 — 사용자 연봉 1개 선택. 서울 세금 데이터 부재 → seoulVal=0.
    const resolved = resolveTaxChoice(city.tax, taxChoice);
    if (resolved === null) {
      return [
        {
          label: '월 세금 (대략)',
          rows: [],
          emptyText: '세금 데이터가 아직 준비되지 않았어요.',
          pickerKind: 'tax',
        },
      ];
    }
    // takeHomePctApprox 는 [0,1] 소수 (citySchema 검증 — 0.74 = 74%).
    // 세금 비율 = 1 - takeHome (PR #25 review 반영 — 이전 `/100` 은 명백한 버그).
    const monthlyTaxLocal =
      (resolved.annualSalary / 12) * (1 - resolved.takeHomePctApprox);
    const annualSalaryKRW = convertToKRW(resolved.annualSalary, city.currency, fx);
    return [
      {
        label: '월 세금 (대략)',
        rows: [
          {
            key: `tax-${resolved.isCustom ? 'custom' : resolved.annualSalary}`,
            emoji: resolved.isCustom ? '✏️' : '💼',
            name: `연봉 ${formatKRW(annualSalaryKRW)}${resolved.isCustom ? ' (직접 입력)' : ''}`,
            seoulVal: 0,
            cityVal: convertToKRW(monthlyTaxLocal, city.currency, fx),
          },
        ],
        pickerKind: 'tax',
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
  // ADR-060: rent — 전역 단일 선택. ADR-061: tuition/tax — 도시별 map.
  const { rentChoice, setRentChoice } = useRentChoiceStore(
    useShallow((s) => ({ rentChoice: s.rentChoice, setRentChoice: s.setRentChoice })),
  );
  const tuitionChoice = useTuitionChoiceStore((s) =>
    cityId ? s.choices[cityId] : undefined,
  );
  const taxChoice = useTaxChoiceStore((s) =>
    cityId ? s.choices[cityId] : undefined,
  );

  // 시트 visibility — tuition/tax 만. category 별로 1 시트만 사용 (다른 카테고리에선
  // false 유지). Detail 화면은 한 카테고리 한 화면이라 동시 오픈 불가.
  const [sheetVisible, setSheetVisible] = React.useState(false);

  // PR #25 7차 review — buildSections 는 카테고리·도시·환율·선택값에 의존하므로
  // 입력 동일 시 동일 결과 (순수). 외부 store 갱신으로 컴포넌트 리렌더가 일어나도
  // 의미 있는 입력 변화가 없으면 재계산 회피. ready 외 status 일 때는 빈 array
  // 반환 — 후속 코드는 ready 분기 안에서만 sections 사용.
  const sections = React.useMemo(() => {
    if (state.status !== 'ready') return [];
    if (!category || !isValidCategory(category)) return [];
    return buildSections(
      category as SourceCategory,
      state.data.seoul,
      state.data.city,
      state.data.fx,
      tuitionChoice,
      taxChoice,
    );
  }, [state, category, tuitionChoice, taxChoice]);

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
  // PR #25 7차 review — seoul 은 sections useMemo 안에서만 참조해 본 분기에선
  // 미사용. fx/city/lastSync 는 환율 표기 / 시트 props / 헤더 동기화에 그대로 사용.
  const cat = category as SourceCategory;
  const { city, fx, lastSync } = state.data;

  // 단일 선택 섹션 (rent / tuition / tax) — hero 가 "선택된 행 1 개 기준" 으로 비교.
  // rent: 인라인 행 탭으로 cycle. tuition/tax: 행 탭 → 시트 오픈.
  const singlePickSection = sections.find((s) => s.selectable || s.pickerKind);

  const resolvedRentKey =
    singlePickSection?.selectable === true
      ? resolveRentChoice(city.rent, rentChoice)?.key
      : undefined;

  const selectedRow =
    singlePickSection !== undefined
      ? singlePickSection.selectable === true
        ? // rent: resolved key 로 row 매칭
          singlePickSection.rows.find((r) => r.key === resolvedRentKey) ??
          singlePickSection.rows[0]
        : // tuition/tax: rows 가 항상 0 또는 1 개 (resolveX 결과)
          singlePickSection.rows[0]
      : undefined;

  const seoulHeroVal =
    selectedRow !== undefined
      ? selectedRow.seoulVal
      : sections.reduce(
          (acc, sec) => acc + sec.rows.reduce((a, r) => a + r.seoulVal, 0),
          0,
        );
  const cityHeroVal =
    selectedRow !== undefined
      ? selectedRow.cityVal
      : sections.reduce(
          (acc, sec) => acc + sec.rows.reduce((a, r) => a + r.cityVal, 0),
          0,
        );
  const totalMult = computeMultiplier(seoulHeroVal, cityHeroVal);
  const { swPct, cwPct } = computeBarPcts(seoulHeroVal, cityHeroVal);

  const rate = fx[city.currency];
  const rateDisplay = rate !== undefined ? Math.round(rate) : '?';
  const syncDisplay = lastSync ? formatShortDate(lastSync) : '?';
  const subtitle = `1 ${city.currency} = ${rateDisplay}원 · ${syncDisplay}`;

  const categoryLabel = CATEGORY_LABEL[cat];
  const categorySources = city.sources.filter((s) => s.category === cat);
  const sourceCount = categorySources.length;

  // hero caption / footer — 단일 선택 모드에선 "{카테고리} · {선택 행 이름}" + 안내 문구.
  const heroCaption =
    selectedRow !== undefined
      ? `${categoryLabel} · ${selectedRow.name}`
      : `${categoryLabel} 합계`;
  const heroFooter =
    singlePickSection?.pickerKind !== undefined
      ? '선택된 항목 기준 (탭으로 변경)'
      : selectedRow !== undefined
        ? '선택한 항목 기준 (탭으로 변경)'
        : '항목 단가 합';

  return (
    <Screen scroll testID="detail-screen">
      <TopBar
        title={`${categoryLabel} · ${city.name.ko}`}
        titleVariant="h3"
        subtitle={subtitle}
        onBack={handleBack}
        testID="detail-topbar"
      />

      <View className="px-screen-x mt-3">
        <HeroCard
          variant="navy"
          leftLabel="서울"
          leftValue={formatKRW(seoulHeroVal)}
          centerMult={formatMultiplier(totalMult)}
          centerCaption={heroCaption}
          rightLabel={city.name.ko}
          rightValue={formatKRW(cityHeroVal)}
          swPct={swPct}
          cwPct={cwPct}
          footer={heroFooter}
          testID="detail-hero"
        />
      </View>

      <View className="px-screen-x mt-4 gap-4">
        {sections.map((section) => (
          <View key={section.label} testID={`detail-section-${section.label}`}>
            <View className="flex-row items-center justify-between mb-2">
              <MonoLabel>{section.label}</MonoLabel>
              {section.rows.length > 0 && section.pickerKind === undefined && (
                <Tiny color="gray-2">{section.rows.length} 항목</Tiny>
              )}
            </View>
            {section.rows.length === 0 ? (
              <View className="bg-light-2 rounded-card p-4 gap-2">
                <Small color="gray-2">{section.emptyText ?? '데이터 준비 중'}</Small>
                {section.pickerKind !== undefined ? (
                  <Pressable
                    onPress={() => setSheetVisible(true)}
                    accessibilityRole="button"
                    className="self-start px-4 py-2 rounded-button bg-orange"
                    testID={`detail-picker-empty-${section.pickerKind}`}
                  >
                    <Body color="white" className="font-manrope-bold">
                      직접 입력
                    </Body>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View className="bg-white rounded-card border border-line overflow-hidden">
                {section.rows.map((row, idx) => {
                  const mult = computeMultiplier(row.seoulVal, row.cityVal);
                  const isSinglePick =
                    section.selectable === true || section.pickerKind !== undefined;
                  const isSelected =
                    isSinglePick && selectedRow !== undefined && row.key === selectedRow.key;
                  // GroceryRow 가 자체 px-3 을 가짐 — selected 배경이 카드 좌우
                  // 모서리까지 닿게 하기 위해 wrapping padding 제거.
                  // exactOptionalPropertyTypes: onPress 는 단일 선택일 때만 spread.
                  const singlePickProps =
                    section.selectable === true
                      ? {
                          onPress: () => setRentChoice(row.key as RentChoice),
                          selected: isSelected,
                        }
                      : section.pickerKind !== undefined
                        ? {
                            onPress: () => setSheetVisible(true),
                            selected: isSelected,
                          }
                        : {};
                  return (
                    <GroceryRow
                      key={row.key}
                      name={row.name}
                      emoji={row.emoji}
                      seoulPrice={formatKRW(row.seoulVal)}
                      cityPrice={formatKRW(row.cityVal)}
                      mult={typeof mult === 'number' ? mult : 1}
                      isLast={idx === section.rows.length - 1}
                      {...singlePickProps}
                      testID={`detail-row-${row.key}`}
                    />
                  );
                })}
                {section.pickerKind !== undefined ? (
                  <Pressable
                    onPress={() => setSheetVisible(true)}
                    accessibilityRole="button"
                    className="px-3 py-2.5 border-t border-line bg-light-2"
                    testID={`detail-picker-change-${section.pickerKind}`}
                  >
                    <Tiny color="gray" className="text-center">
                      {section.pickerKind === 'tuition'
                        ? '학교 변경 / 직접 입력'
                        : '연봉 변경 / 직접 입력'}{' '}
                      →
                    </Tiny>
                  </Pressable>
                ) : null}
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

      {cat === 'tuition' && cityId ? (
        <TuitionChoiceSheet
          visible={sheetVisible}
          onDismiss={() => setSheetVisible(false)}
          cityId={cityId}
          cityCurrency={city.currency}
          cityTuition={city.tuition}
          fx={fx}
          testID="detail-tuition-sheet"
        />
      ) : null}
      {cat === 'tax' && cityId ? (
        <TaxChoiceSheet
          visible={sheetVisible}
          onDismiss={() => setSheetVisible(false)}
          cityId={cityId}
          cityCurrency={city.currency}
          cityTax={city.tax}
          fx={fx}
          testID="detail-tax-sheet"
        />
      ) : null}
    </Screen>
  );
}
