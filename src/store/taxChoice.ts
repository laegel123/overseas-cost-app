/**
 * 세금 선택 store — 사용자가 비교 기준으로 삼는 연봉 (또는 직접 입력값).
 *
 * AsyncStorage 영속화. 단일 거대 store 금지 정책 (ADR-004).
 *
 * 배경 (ADR-061):
 *   세금 카테고리는 도시별로 등록된 연봉 tier 가 다르고 (예: 60k / 80k / 100k
 *   CAD), 사용자는 자신의 실제 연봉을 직접 입력하고 싶을 수 있다. 합산 비교는
 *   의미 없다 (한 사람이 여러 연봉을 동시에 받지 않음).
 *
 * 도시별 map (Record<cityId, choice>):
 *   학비와 동일하게 도시별 연봉 tier 가 다르므로 cityId 별로 저장.
 *
 * Public API:
 *   - useTaxChoiceStore
 *   - TaxChoice: union — preset (annualSalary 매칭) | custom (annualSalary)
 *   - resolveTaxChoice: 도시 데이터 + 선택값 → 표시용 entry. custom 의
 *     takeHomePctApprox 는 도시의 첫 preset 값을 사용한다 (단순화).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { CityCostData, CityTaxEntry } from '@/types/city';

export type TaxChoice =
  | { kind: 'preset'; annualSalary: number }
  | { kind: 'custom'; annualSalary: number };

export type TaxChoiceState = {
  choices: Record<string, TaxChoice>;
};

export type TaxChoiceActions = {
  setTaxChoice: (cityId: string, next: TaxChoice) => void;
  clearTaxChoice: (cityId: string) => void;
  reset: () => void;
};

export const INITIAL_STATE: TaxChoiceState = {
  choices: {},
};

const PERSIST_KEY = 'taxChoice:v1';
const PERSIST_VERSION = 1;

function isValidChoice(v: unknown): v is TaxChoice {
  if (v === null || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  if (c.kind !== 'preset' && c.kind !== 'custom') return false;
  return (
    typeof c.annualSalary === 'number' &&
    Number.isFinite(c.annualSalary) &&
    c.annualSalary > 0
  );
}

function isValidPersistedState(v: unknown): v is TaxChoiceState {
  /* istanbul ignore next: defensive */
  if (v === null || typeof v !== 'object') return false;
  const candidate = v as Record<string, unknown>;
  if (candidate.choices === null || typeof candidate.choices !== 'object') return false;
  const choices = candidate.choices as Record<string, unknown>;
  for (const key of Object.keys(choices)) {
    if (!isValidChoice(choices[key])) return false;
  }
  return true;
}

export type ResolvedTax = {
  /** 표시용 라벨 ('연봉 8만 CAD' 같은 raw 값 — UI 단에서 formatKRW 등으로 변환). */
  annualSalary: number;
  /** 실수령률 (0.74 = 74%). custom 일 때는 도시 첫 preset 의 값을 사용. */
  takeHomePctApprox: number;
  isCustom: boolean;
};

/**
 * 사용자 선택값을 도시 데이터에 적용해 표시용 entry 를 반환.
 *
 * - choice 가 `custom` → 사용자 입력 annualSalary + 도시 첫 preset 의 takeHomePct.
 *   도시에 preset 이 없으면 null.
 * - choice 가 `preset` → annualSalary 매칭. 매칭 실패 시 entries[0] fallback.
 * - choice 가 undefined → entries[0] fallback.
 * - entries 부재 → null.
 *
 * `resolveTuitionChoice` 와의 의도적 비대칭 (PR #25 3차 review):
 * tax custom 은 `takeHomePctApprox` 가 사용자 입력 annualSalary 만으로 결정
 * 불가하므로 도시 첫 preset 의 값을 차용한다 — entries 부재 시 null. 반면
 * tuition custom 은 연 학비만으로 충분 (월 환산만 필요) 하여 entries 와 무관.
 * UI 단 (TaxChoiceSheet) 에서 entries 부재 도시는 custom 행 자체를 노출하지
 * 않아 사용자에게 silent failure 가 발생하지 않도록 한다.
 */
export function resolveTaxChoice(
  cityTax: CityCostData['tax'],
  choice: TaxChoice | undefined,
): ResolvedTax | null {
  const entries: CityTaxEntry[] = cityTax ?? [];
  // entries[0] 은 length>0 이면 정의됨 — noUncheckedIndexedAccess 보호용 단언.
  const first = entries.length > 0 ? entries[0]! : null;

  if (choice !== undefined && choice.kind === 'custom') {
    if (first === null) return null;
    return {
      annualSalary: choice.annualSalary,
      takeHomePctApprox: first.takeHomePctApprox,
      isCustom: true,
    };
  }

  if (first === null) return null;

  if (choice !== undefined && choice.kind === 'preset') {
    const matched = entries.find((e) => e.annualSalary === choice.annualSalary);
    if (matched) {
      return {
        annualSalary: matched.annualSalary,
        takeHomePctApprox: matched.takeHomePctApprox,
        isCustom: false,
      };
    }
  }

  return {
    annualSalary: first.annualSalary,
    takeHomePctApprox: first.takeHomePctApprox,
    isCustom: false,
  };
}

export const useTaxChoiceStore = create<TaxChoiceState & TaxChoiceActions>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,
      setTaxChoice: (cityId, next) =>
        set((s) => ({ choices: { ...s.choices, [cityId]: next } })),
      clearTaxChoice: (cityId) =>
        set((s) => {
          if (!(cityId in s.choices)) return s;
          const { [cityId]: _drop, ...rest } = s.choices;
          return { choices: rest };
        }),
      reset: () => set(INITIAL_STATE),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: PERSIST_VERSION,
      partialize: (state) => ({ choices: state.choices }),
      // PR #25 7차 review — v1 단계에선 의도적 no-op (단일 버전이라 변환 불필요).
      // version > 1 으로 bump 시 반드시 v(version-1) → v(version) 의 실제 변환
      // 분기를 본 함수에 추가해야 한다. 캐스팅만 두면 손상 캐시가
      // onRehydrateStorage 검증보다 먼저 통과해 silent fail 위험.
      // TODO(v2): version 분기 추가 — case 1: { ...persisted, ... } 형태 변환.
      migrate: (persistedState, version) => {
        if (version === PERSIST_VERSION) return persistedState as TaxChoiceState;
        return INITIAL_STATE as TaxChoiceState;
      },
      onRehydrateStorage: () => (rehydratedState, error) => {
        if (error !== undefined && error !== null) {
          useTaxChoiceStore.setState(INITIAL_STATE);
          return;
        }
        if (rehydratedState !== undefined && !isValidPersistedState(rehydratedState)) {
          useTaxChoiceStore.setState(INITIAL_STATE);
        }
      },
    },
  ),
);
