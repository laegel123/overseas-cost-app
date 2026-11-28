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
 *   서울 데이터 결측 (한국 거주 기준 — 학비/세금 0원) 정책: baseVal=0 직접 사용.
 *
 * 기준 도시(왼쪽)는 query param `?base=<id>` 다 (ADR-089). 생략하거나 `seoul` 이면
 * **서울 모드** = 종전 동작과 완전히 동일. 서울이 아닌 기준 도시가 오면 도시끼리 모드:
 *   - 학비·세금은 **도시마다 선택 줄 1개** (`detail-picker-city-<도시 id>`). 줄을 누르면
 *     그 도시의 시트가 열리고, 값은 열마다 `choices[그 도시]` 로 따로 resolve 한다
 *     (한쪽 선택이 반대쪽 계산에 섞이면 비교가 거짓이 된다).
 *   - 비자는 양쪽 모두 실제 값 (서울 모드는 현행대로 왼쪽 0원).
 *   - 한쪽만 값이 없으면 그 값은 `—`, 배수 미표시, 합계에서 양쪽 모두 제외.
 *     0원으로 표시하지 않는다 ("무료" 로 오독됨 — CLAUDE.md 에러 삼킴 금지).
 *   - 출처는 도시별로 묶어 양쪽 모두 노출 (ADR-076 — 화면에 나온 값의 출처는 화면에).
 * 서울은 항상 왼쪽이다 — 서울이 대상으로 들어오면 서울 모드 주소로 정규화한다.
 *
 * 하단 footer: AdBanner (ready 상태만, ADR-077)
 */

import * as React from 'react';

import { ActivityIndicator, Pressable, View } from 'react-native';

import { useLocalSearchParams, useRouter } from 'expo-router';

import { useShallow } from 'zustand/react/shallow';

import { AdBanner } from '@/components';
import { HeroCard } from '@/components/cards/HeroCard';
import { ErrorView } from '@/components/ErrorView';
import { GroceryRow } from '@/components/GroceryRow';
import { Screen } from '@/components/Screen';
import { TaxChoiceSheet } from '@/components/TaxChoiceSheet';
import { TopBar } from '@/components/TopBar';
import { TuitionChoiceSheet } from '@/components/TuitionChoiceSheet';
import { Body, MonoLabel, Small, Tiny } from '@/components/typography/Text';
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

/** 서울은 항상 기준(왼쪽)이다 (ADR-089). `?base=` 기본값이자 서울 모드 판정 기준. */
const SEOUL_ID = 'seoul';

/**
 * 도시끼리 모드에서 한쪽 값이 결측일 때의 표기. 0원으로 쓰지 않는다 — 서울이
 * 아닌 도시의 결측을 0원으로 보이면 "무료" 로 오독된다 (ADR-089).
 */
const MISSING_VALUE = '—';

/**
 * 도시끼리 모드의 학비·세금 비교 행 이름. 양쪽 항목 이름이 서로 달라 (UBC vs
 * 東京大学) 한 이름으로 묶을 수 없으므로 hero caption 은 `{카테고리} · 선택 항목`
 * 이 된다 (ADR-089). 각 도시의 실제 선택 항목은 위 선택 줄에 적힌다.
 */
const PAIR_ROW_NAME = '선택 항목';

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
  /**
   * 기준 도시(왼쪽) 값 (KRW). `null` = 도시끼리 모드의 결측 → `—` 표기 + 배수
   * 미표시 (ADR-089). 서울 모드에서는 null 이 생기지 않는다 (서울 0원 정책은 숫자 0).
   */
  baseVal: number | null;
  /** 대상 도시(오른쪽) 값 (KRW). `null` 정책은 `baseVal` 과 동일. */
  cityVal: number | null;
};

/**
 * 도시끼리 모드의 도시별 선택 줄 (학비·세금) — ADR-089.
 */
type PickerCity = {
  /** 선택값 store 키 = 라우트 param 의 도시 id. */
  id: string;
  /** 줄 왼쪽 라벨 — 도시 한글명. */
  name: string;
  /** 현재 선택 항목 이름. `null` = 그 도시에 데이터가 없음. */
  choice: string | null;
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
  /**
   * ADR-089 — 도시끼리 모드에서만 채운다 (서울 모드는 항상 undefined → 선택 줄
   * 1개 + `detail-picker-change-<kind>` 현행 UI 유지). 양쪽 모두 데이터가 없으면
   * 빈 상태를 한 번만 보여주므로 이 값도 비운다.
   */
  pickerCities?: PickerCity[];
};

/**
 * 도시끼리 모드의 추가 입력. `null` 이면 서울 모드 (종전 동작).
 */
type PairContext = {
  baseId: string;
  cityId: string;
  /** 기준 도시의 학비 선택값 — `choices[baseId]`. 대상 도시 값과 섞으면 비교가 거짓이 된다. */
  baseTuitionChoice: TuitionChoice | undefined;
  /** 기준 도시의 세금 선택값 — `choices[baseId]`. */
  baseTaxChoice: TaxChoice | undefined;
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

/**
 * 한 행의 양쪽 값 (KRW). 반환 `null` = 행 자체 생략.
 *
 * - 서울 모드: 한쪽이라도 결측이면 행 생략 (현행 유지).
 * - 도시끼리 모드: 한쪽만 결측이면 그쪽을 `null` 로 남겨 `—` 로 표시한다 (ADR-089 —
 *   서울이 아닌 도시의 결측을 0원으로 꾸미지 않는다). 양쪽 결측은 행 생략.
 */
function rowValues(
  baseRaw: number | null | undefined,
  cityRaw: number | null | undefined,
  base: CityCostData,
  city: CityCostData,
  fx: ExchangeRates,
  isPair: boolean,
): Pick<Row, 'baseVal' | 'cityVal'> | null {
  const hasBase = baseRaw !== null && baseRaw !== undefined;
  const hasCity = cityRaw !== null && cityRaw !== undefined;
  if (isPair ? !hasBase && !hasCity : !hasBase || !hasCity) return null;
  return {
    baseVal:
      baseRaw !== null && baseRaw !== undefined
        ? convertToKRW(baseRaw, base.currency, fx)
        : null,
    cityVal:
      cityRaw !== null && cityRaw !== undefined
        ? convertToKRW(cityRaw, city.currency, fx)
        : null,
  };
}

/** 세금 행·선택 줄의 표시 이름 — `연봉 8,000만원 (직접 입력)`. */
function taxChoiceName(
  annualSalary: number,
  isCustom: boolean,
  currency: string,
  fx: ExchangeRates,
): string {
  const annualSalaryKRW = convertToKRW(annualSalary, currency, fx);
  return `연봉 ${formatKRW(annualSalaryKRW)}${isCustom ? ' (직접 입력)' : ''}`;
}

/**
 * 월 세금 (KRW). takeHomePctApprox 는 [0,1] 소수 (citySchema 검증 — 0.74 = 74%).
 * 세금 비율 = 1 - takeHome (PR #25 review 반영 — 이전 `/100` 은 명백한 버그).
 */
function monthlyTaxKRW(
  annualSalary: number,
  takeHomePctApprox: number,
  currency: string,
  fx: ExchangeRates,
): number {
  return convertToKRW((annualSalary / 12) * (1 - takeHomePctApprox), currency, fx);
}

function buildSections(
  category: SourceCategory,
  base: CityCostData,
  city: CityCostData,
  fx: ExchangeRates,
  tuitionChoice: TuitionChoice | undefined,
  taxChoice: TaxChoice | undefined,
  pair: PairContext | null,
): Section[] {
  const isPair = pair !== null;

  if (category === 'food') {
    const restaurant: Row[] = FOOD_RESTAURANT_ROWS.map((r) => ({
      key: r.key,
      emoji: r.emoji,
      name: r.name,
      baseVal: convertToKRW(base.food[r.key], base.currency, fx),
      cityVal: convertToKRW(city.food[r.key], city.currency, fx),
    }));

    const grocery: Row[] = FOOD_GROCERY_ROWS.flatMap((r) => {
      const vals = rowValues(
        base.food.groceries[r.key],
        city.food.groceries[r.key],
        base,
        city,
        fx,
        isPair,
      );
      if (vals === null) return [];
      return [
        {
          key: String(r.key),
          emoji: r.emoji,
          name: r.name,
          ...vals,
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
      const vals = rowValues(base.rent[r.key], city.rent[r.key], base, city, fx, isPair);
      if (vals === null) return [];
      return [
        {
          key: r.key,
          emoji: r.emoji,
          name: r.name,
          ...vals,
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
      baseVal: convertToKRW(base.transport[r.key], base.currency, fx),
      cityVal: convertToKRW(city.transport[r.key], city.currency, fx),
    }));
    return [{ label: '교통 수단', rows }];
  }

  if (category === 'tuition') {
    // ADR-061 — 합산 비교는 의미 없어 사용자 선택 1개를 단일 출처로.
    const label = '학교 (월 환산)';
    const emptyText = '학비 데이터가 아직 준비되지 않았어요.';
    const resolved = resolveTuitionChoice(city.tuition, tuitionChoice);

    if (pair === null) {
      // 서울 모드 — 서울 학비 데이터는 정책상 부재 (한국 거주 기준 — 학비 0원).
      // baseVal=0 직접 사용.
      if (resolved === null) {
        return [{ label, rows: [], emptyText, pickerKind: 'tuition' }];
      }
      return [
        {
          label,
          rows: [
            {
              key: `tuition-${resolved.isCustom ? 'custom' : resolved.school}`,
              emoji: resolved.isCustom ? '✏️' : '🎓',
              // resolved.school 은 custom 일 때 이미 '직접 입력' 문자열 (resolver 정책).
              name: resolved.school,
              baseVal: 0,
              cityVal: convertToKRW(resolved.annual / 12, city.currency, fx),
            },
          ],
          pickerKind: 'tuition',
        },
      ];
    }

    // ADR-089 도시끼리 — 열마다 그 도시의 선택값으로 resolve.
    const resolvedBase = resolveTuitionChoice(base.tuition, pair.baseTuitionChoice);
    if (resolvedBase === null && resolved === null) {
      // 양쪽 모두 데이터 없음 → 빈 상태 1회 (선택 줄 없음 — 열어도 안내 문구뿐).
      return [{ label, rows: [], emptyText, pickerKind: 'tuition' }];
    }
    const basePick =
      resolvedBase === null
        ? null
        : {
            choice: resolvedBase.school,
            value: convertToKRW(resolvedBase.annual / 12, base.currency, fx),
          };
    const cityPick =
      resolved === null
        ? null
        : {
            choice: resolved.school,
            value: convertToKRW(resolved.annual / 12, city.currency, fx),
          };
    return [
      {
        label,
        rows: [
          {
            key: 'tuition-pair',
            emoji: '🎓',
            name: PAIR_ROW_NAME,
            baseVal: basePick?.value ?? null,
            cityVal: cityPick?.value ?? null,
          },
        ],
        pickerKind: 'tuition',
        pickerCities: [
          { id: pair.baseId, name: base.name.ko, choice: basePick?.choice ?? null },
          { id: pair.cityId, name: city.name.ko, choice: cityPick?.choice ?? null },
        ],
      },
    ];
  }

  if (category === 'tax') {
    // ADR-061 — 사용자 연봉 1개 선택. 서울 세금 데이터 부재 → baseVal=0.
    const label = '월 세금 (대략)';
    const emptyText = '세금 데이터가 아직 준비되지 않았어요.';
    const resolved = resolveTaxChoice(city.tax, taxChoice);

    if (pair === null) {
      if (resolved === null) {
        return [{ label, rows: [], emptyText, pickerKind: 'tax' }];
      }
      return [
        {
          label,
          rows: [
            {
              key: `tax-${resolved.isCustom ? 'custom' : resolved.annualSalary}`,
              emoji: resolved.isCustom ? '✏️' : '💼',
              name: taxChoiceName(
                resolved.annualSalary,
                resolved.isCustom,
                city.currency,
                fx,
              ),
              baseVal: 0,
              cityVal: monthlyTaxKRW(
                resolved.annualSalary,
                resolved.takeHomePctApprox,
                city.currency,
                fx,
              ),
            },
          ],
          pickerKind: 'tax',
        },
      ];
    }

    // ADR-089 도시끼리 — 학비와 같은 구조 (코드 경로 공유). v1.0 실데이터는 21개
    // 도시 모두 tax 가 비어 있어 아래 분기는 fixture 로만 검증된다.
    const resolvedBase = resolveTaxChoice(base.tax, pair.baseTaxChoice);
    if (resolvedBase === null && resolved === null) {
      return [{ label, rows: [], emptyText, pickerKind: 'tax' }];
    }
    const basePick =
      resolvedBase === null
        ? null
        : {
            choice: taxChoiceName(
              resolvedBase.annualSalary,
              resolvedBase.isCustom,
              base.currency,
              fx,
            ),
            value: monthlyTaxKRW(
              resolvedBase.annualSalary,
              resolvedBase.takeHomePctApprox,
              base.currency,
              fx,
            ),
          };
    const cityPick =
      resolved === null
        ? null
        : {
            choice: taxChoiceName(
              resolved.annualSalary,
              resolved.isCustom,
              city.currency,
              fx,
            ),
            value: monthlyTaxKRW(
              resolved.annualSalary,
              resolved.takeHomePctApprox,
              city.currency,
              fx,
            ),
          };
    return [
      {
        label,
        rows: [
          {
            key: 'tax-pair',
            emoji: '💼',
            name: PAIR_ROW_NAME,
            baseVal: basePick?.value ?? null,
            cityVal: cityPick?.value ?? null,
          },
        ],
        pickerKind: 'tax',
        pickerCities: [
          { id: pair.baseId, name: base.name.ko, choice: basePick?.choice ?? null },
          { id: pair.cityId, name: city.name.ko, choice: cityPick?.choice ?? null },
        ],
      },
    ];
  }

  // visa
  const visaEmptyText = '비자 데이터가 아직 준비되지 않았어요.';

  if (pair === null) {
    // 서울 모드 — 서울 비자 데이터 부재 정책 (baseVal=0) 현행 유지.
    const visa = city.visa;
    if (!visa) {
      return [
        {
          label: CATEGORY_LABEL.visa,
          rows: [],
          emptyText: visaEmptyText,
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
        baseVal: 0,
        cityVal: convertToKRW(fee, city.currency, fx),
      });
    }
    if (visa.settlementApprox !== undefined) {
      rows.push({
        key: 'visa-settle',
        emoji: '📦',
        name: '정착 비용 (대략)',
        baseVal: 0,
        cityVal: convertToKRW(visa.settlementApprox, city.currency, fx),
      });
    }
    return [
      {
        label: CATEGORY_LABEL.visa,
        rows,
        emptyText: visaEmptyText,
      },
    ];
  }

  // ADR-089 도시끼리 — 양쪽 모두 실제 값.
  const rows: Row[] = [];
  const feeVals = rowValues(
    base.visa ? base.visa.studentApplicationFee ?? base.visa.workApplicationFee : undefined,
    city.visa ? city.visa.studentApplicationFee ?? city.visa.workApplicationFee : undefined,
    base,
    city,
    fx,
    true,
  );
  if (feeVals !== null) {
    rows.push({
      key: 'visa-fee',
      emoji: '🛂',
      name: '비자 신청 수수료',
      ...feeVals,
    });
  }
  const settleVals = rowValues(
    base.visa?.settlementApprox,
    city.visa?.settlementApprox,
    base,
    city,
    fx,
    true,
  );
  if (settleVals !== null) {
    rows.push({
      key: 'visa-settle',
      emoji: '📦',
      name: '정착 비용 (대략)',
      ...settleVals,
    });
  }
  return [
    {
      label: CATEGORY_LABEL.visa,
      rows,
      emptyText: visaEmptyText,
    },
  ];
}

/**
 * 합계 모드 hero 값 — 한쪽만 결측인 행은 **양쪽 합계에서 모두** 제외한다 (ADR-089).
 * 결측을 0 으로 더하면 합계가 거짓이 된다. 서울 모드에서는 null 행이 생기지 않아
 * 종전과 같은 결과 (`counted` 도 행 수와 같다).
 */
function sumSections(sections: Section[]): {
  baseVal: number;
  cityVal: number;
  counted: number;
} {
  let baseVal = 0;
  let cityVal = 0;
  let counted = 0;
  for (const section of sections) {
    for (const row of section.rows) {
      if (row.baseVal === null || row.cityVal === null) continue;
      baseVal += row.baseVal;
      cityVal += row.cityVal;
      counted += 1;
    }
  }
  return { baseVal, cityVal, counted };
}

/**
 * 부제의 환율 한 토막 — `1 CAD = 980원`. 환율 결측은 `?` 로 가시화 (삼키지 않는다).
 * Compare 화면(`app/compare/[cityId].tsx`) 에 같은 함수가 있다 — 화면 로컬 표기
 * 규칙이라 lib 으로 올리지 않았다.
 */
function formatRateLabel(currency: string, fx: ExchangeRates): string {
  const rate = fx[currency];
  const rateDisplay = rate !== undefined ? Math.round(rate) : '?';
  return `1 ${currency} = ${rateDisplay}원`;
}

type DetailData = {
  /** 왼쪽 = 기준 도시. 서울 모드면 서울. */
  base: CityCostData;
  /** 오른쪽 = 대상 도시. */
  city: CityCostData;
  fx: ExchangeRates;
  lastSync: string | null;
};

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: DetailData };

export default function DetailScreen(): React.ReactElement {
  const { cityId, category, base } = useLocalSearchParams<{
    cityId: string;
    category: string;
    base?: string;
  }>();
  const router = useRouter();

  // ADR-089 — `?base=` 생략·빈 값 → 서울 모드 (종전 동작과 완전히 동일).
  const baseId = base !== undefined && base !== '' ? base : SEOUL_ID;
  const isCityPair = baseId !== SEOUL_ID;

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
  // ADR-089 — 기준 도시 열에는 기준 도시의 선택값을 쓴다. 서울 모드에서 서울은
  // 학비·세금 데이터가 없어 어느 선택값이든 null 로 떨어지므로 결과는 불변.
  const baseTuitionChoice = useTuitionChoiceStore((s) => s.choices[baseId]);
  const baseTaxChoice = useTaxChoiceStore((s) => s.choices[baseId]);

  // 시트 대상 도시 — tuition/tax 만. `null` = 닫힘. 도시끼리 모드는 선택 줄이 둘이라
  // boolean visibility 로는 "어느 도시의 시트" 를 표현할 수 없다 (ADR-089).
  // category 별로 1 시트만 사용 (Detail 은 한 카테고리 한 화면이라 동시 오픈 불가).
  const [sheetCityId, setSheetCityId] = React.useState<string | null>(null);

  // PR #25 7차 review — buildSections 는 카테고리·도시·환율·선택값에 의존하므로
  // 입력 동일 시 동일 결과 (순수). 외부 store 갱신으로 컴포넌트 리렌더가 일어나도
  // 의미 있는 입력 변화가 없으면 재계산 회피. ready 외 status 일 때는 빈 array
  // 반환 — 후속 코드는 ready 분기 안에서만 sections 사용.
  const sections = React.useMemo(() => {
    if (state.status !== 'ready') return [];
    if (!category || !isValidCategory(category)) return [];
    return buildSections(
      category as SourceCategory,
      state.data.base,
      state.data.city,
      state.data.fx,
      tuitionChoice,
      taxChoice,
      isCityPair && cityId
        ? { baseId, cityId, baseTuitionChoice, baseTaxChoice }
        : null,
    );
  }, [
    state,
    category,
    tuitionChoice,
    taxChoice,
    isCityPair,
    cityId,
    baseId,
    baseTuitionChoice,
    baseTaxChoice,
  ]);

  const handleBack = React.useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [router]);

  // 서울이 대상(오른쪽)으로 들어온 주소는 서울 모드 주소로 정규화한다. 서울은
  // 학비·세금·비자가 정책상 0원이라 오른쪽에 두면 `0 ÷ 값` 배수가 되어
  // formatMultiplier·isHot 이 throw 한다 (ADR-089).
  const needsSeoulNormalize =
    cityId === SEOUL_ID && isCityPair && isValidCategory(category);

  React.useEffect(() => {
    if (!needsSeoulNormalize) return;
    router.replace(`/detail/${baseId}/${category}`);
    // router 는 expo-router 의 모듈 싱글턴이라 deps 에 넣을 필요가 없다 (테스트
    // mock 은 렌더마다 새 객체를 돌려줘 deps 에 넣으면 매 렌더 재실행된다).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsSeoulNormalize, baseId, category]);

  React.useEffect(() => {
    if (!cityId || !category) {
      setState({ status: 'error', message: '잘못된 경로입니다' });
      return;
    }
    if (!isValidCategory(category)) {
      setState({ status: 'error', message: '알 수 없는 카테고리입니다' });
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
        const city = getCity(cityId as string);
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
    return () => {
      cancelled = true;
    };
  }, [cityId, category, baseId, needsSeoulNormalize]);

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
  // PR #25 7차 review — fx/city/lastSync 는 환율 표기 / 시트 props / 헤더 동기화에
  // 그대로 사용. baseCity 는 ADR-089 이후 제목·라벨·출처·시트에도 쓰인다.
  const cat = category as SourceCategory;
  const { base: baseCity, city, fx, lastSync } = state.data;

  // 단일 선택 섹션 (rent / tuition / tax) — hero 가 "선택된 행 1 개 기준" 으로 비교.
  // rent: 인라인 행 탭으로 cycle. tuition/tax: 행 탭 → 시트 오픈 (도시끼리 모드는
  // 행 대신 도시별 선택 줄이 시트를 연다).
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

  // 합계 모드 — 도시끼리 모드에서 합산된 행이 하나도 없으면 (모든 행이 한쪽만
  // 결측) 양쪽 모두 `—`. 서울 모드는 종전대로 0 합계도 그대로 표시한다.
  const totals = sumSections(sections);
  const hasSum = !isCityPair || totals.counted > 0;

  const baseHeroVal: number | null =
    selectedRow !== undefined
      ? selectedRow.baseVal
      : hasSum
        ? totals.baseVal
        : null;
  const cityHeroVal: number | null =
    selectedRow !== undefined
      ? selectedRow.cityVal
      : hasSum
        ? totals.cityVal
        : null;
  const totalMult: number | '신규' | null =
    baseHeroVal === null || cityHeroVal === null
      ? null
      : computeMultiplier(baseHeroVal, cityHeroVal);
  const { swPct, cwPct } = computeBarPcts(baseHeroVal ?? 0, cityHeroVal ?? 0);

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

  const categoryLabel = CATEGORY_LABEL[cat];
  const categorySources = city.sources.filter((s) => s.category === cat);
  // 도시끼리 모드는 양쪽 값을 함께 보여주므로 출처도 도시별로 묶어 둘 다 (ADR-076).
  const baseCategorySources = baseCity.sources.filter((s) => s.category === cat);
  const sourceCount = isCityPair
    ? baseCategorySources.length + categorySources.length
    : categorySources.length;
  const sourceGroups = [
    { id: baseId, name: baseCity.name.ko, sources: baseCategorySources },
    { id: cityId as string, name: city.name.ko, sources: categorySources },
  ];

  // hero caption / footer — 단일 선택 모드에선 "{카테고리} · {선택 행 이름}" + 안내 문구.
  // 도시끼리 모드의 학비·세금은 양쪽 항목 이름이 달라 행 이름이 '선택 항목' 이다.
  const heroCaption =
    selectedRow !== undefined
      ? `${categoryLabel} · ${selectedRow.name}`
      : `${categoryLabel} 합계`;
  const heroFooter =
    singlePickSection?.pickerCities !== undefined
      ? '도시별 선택 항목 기준 (바꾸기로 변경)'
      : singlePickSection?.pickerKind !== undefined
        ? '선택된 항목 기준 (탭으로 변경)'
        : selectedRow !== undefined
          ? '선택한 항목 기준 (탭으로 변경)'
          : '항목 단가 합';

  // 시트가 열릴 도시 — 선택값 store 키는 라우트 param 의 id 를 쓴다 (서울 모드와 동일).
  const sheetTarget =
    sheetCityId === null
      ? undefined
      : sheetCityId === cityId
        ? { id: sheetCityId, data: city }
        : sheetCityId === baseId
          ? { id: sheetCityId, data: baseCity }
          : undefined;

  return (
    <Screen scroll testID="detail-screen" footer={<AdBanner />}>
      <TopBar
        title={
          isCityPair
            ? `${categoryLabel} · ${baseCity.name.ko} vs ${city.name.ko}`
            : `${categoryLabel} · ${city.name.ko}`
        }
        titleVariant="h3"
        subtitle={subtitle}
        onBack={handleBack}
        testID="detail-topbar"
      />

      <View className="px-screen-x mt-3">
        <HeroCard
          variant="navy"
          leftLabel={baseCity.name.ko}
          leftValue={baseHeroVal === null ? MISSING_VALUE : formatKRW(baseHeroVal)}
          centerMult={totalMult === null ? undefined : formatMultiplier(totalMult)}
          centerCaption={heroCaption}
          rightLabel={city.name.ko}
          rightValue={cityHeroVal === null ? MISSING_VALUE : formatKRW(cityHeroVal)}
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
            {/* ADR-089 도시끼리 모드 — 도시마다 선택 줄 1개. 줄을 누르면 그 도시의
                시트가 열린다 (서울 모드는 이 블록 없이 현행 UI). */}
            {section.pickerCities !== undefined ? (
              <View className="bg-white rounded-card border border-line overflow-hidden mb-2">
                {section.pickerCities.map((picker, idx, arr) => (
                  <Pressable
                    key={picker.id}
                    onPress={() => setSheetCityId(picker.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${picker.name} ${
                      section.pickerKind === 'tuition' ? '학교' : '연봉'
                    } 변경`}
                    className={`flex-row items-center px-3 py-2.5 gap-3 ${
                      idx === arr.length - 1 ? '' : 'border-b border-line'
                    }`}
                    testID={`detail-picker-city-${picker.id}`}
                  >
                    <Small
                      color="gray-2"
                      numberOfLines={1}
                      className="shrink-0 font-manrope-bold"
                    >
                      {picker.name}
                    </Small>
                    <Small
                      color="navy"
                      numberOfLines={1}
                      className="flex-1 min-w-0 font-manrope-bold"
                    >
                      {picker.choice ?? '데이터 없음'}
                    </Small>
                    <Tiny color="gray" className="shrink-0">
                      바꾸기 ›
                    </Tiny>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {section.rows.length === 0 ? (
              <View className="bg-light-2 rounded-card p-4 gap-2">
                <Small color="gray-2">{section.emptyText ?? '데이터 준비 중'}</Small>
                {/* 직접 입력 버튼은 서울 모드 전용 — 도시끼리 모드에선 어느 도시의
                    입력인지 모호하고, 양쪽 모두 결측일 때만 이 분기에 온다 (ADR-089). */}
                {section.pickerKind !== undefined && !isCityPair ? (
                  <Pressable
                    onPress={() => setSheetCityId(cityId ?? null)}
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
                  // ADR-089 — 한쪽만 결측이면 배수를 내지 않는다 (0 으로 꾸미지 않음).
                  const mult: number | '신규' | null =
                    row.baseVal === null || row.cityVal === null
                      ? null
                      : computeMultiplier(row.baseVal, row.cityVal);
                  // 도시끼리 모드의 학비·세금 행은 선택 줄이 따로 있어 행 자체는
                  // 탭 대상이 아니다 (어느 도시의 시트인지 모호).
                  const isSheetPick =
                    section.pickerKind !== undefined &&
                    section.pickerCities === undefined;
                  const isSinglePick = section.selectable === true || isSheetPick;
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
                      : isSheetPick
                        ? {
                            onPress: () => setSheetCityId(cityId ?? null),
                            selected: isSelected,
                          }
                        : {};
                  return (
                    <GroceryRow
                      key={row.key}
                      name={row.name}
                      emoji={row.emoji}
                      seoulPrice={
                        row.baseVal === null ? MISSING_VALUE : formatKRW(row.baseVal)
                      }
                      cityPrice={
                        row.cityVal === null ? MISSING_VALUE : formatKRW(row.cityVal)
                      }
                      mult={mult}
                      isLast={idx === section.rows.length - 1}
                      {...singlePickProps}
                      testID={`detail-row-${row.key}`}
                    />
                  );
                })}
                {section.pickerKind !== undefined && !isCityPair ? (
                  <Pressable
                    onPress={() => setSheetCityId(cityId ?? null)}
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
        {isCityPair ? (
          // ADR-076 — 왼쪽 값도 실제 통계값이므로 양쪽 출처를 도시별로 묶어 노출.
          sourceGroups.map((group) => (
            <View
              key={group.id}
              className="gap-1"
              testID={`detail-sources-city-${group.id}`}
            >
              <Tiny color="gray-2" className="font-manrope-bold">
                {group.name}
              </Tiny>
              {group.sources.length === 0 ? (
                <Small color="gray-2">출처 정보가 없어요</Small>
              ) : (
                group.sources.map((s, idx) => (
                  <Small
                    key={`${s.name}-${idx}`}
                    color="navy"
                    testID={`detail-source-${group.id}-${idx}`}
                  >
                    {s.name}
                  </Small>
                ))
              )}
            </View>
          ))
        ) : sourceCount === 0 ? (
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

      {cat === 'tuition' && sheetTarget !== undefined ? (
        <TuitionChoiceSheet
          visible
          onDismiss={() => setSheetCityId(null)}
          cityId={sheetTarget.id}
          cityCurrency={sheetTarget.data.currency}
          cityTuition={sheetTarget.data.tuition}
          fx={fx}
          testID="detail-tuition-sheet"
        />
      ) : null}
      {cat === 'tax' && sheetTarget !== undefined ? (
        <TaxChoiceSheet
          visible
          onDismiss={() => setSheetCityId(null)}
          cityId={sheetTarget.id}
          cityCurrency={sheetTarget.data.currency}
          cityTax={sheetTarget.data.tax}
          fx={fx}
          testID="detail-tax-sheet"
        />
      ) : null}
    </Screen>
  );
}
