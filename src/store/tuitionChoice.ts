/**
 * 학비 선택 store — 사용자가 비교 기준으로 삼는 학교 (또는 직접 입력값).
 *
 * AsyncStorage 영속화 (`zustand/middleware persist` + `createJSONStorage`).
 * 단일 거대 store 금지 정책 (ADR-004) — 본 모듈은 tuition choice 만 책임.
 *
 * 배경 (ADR-061):
 *   학비 카테고리는 도시별로 학교 라인업이 완전히 다르고 (Sorbonne / UBC / NYU
 *   등), 학교 단가가 매우 큰 편차 (예: Sorbonne 3,800 EUR vs Sciences Po
 *   14,500 EUR) 라 합산이 의미 없다. 또한 사용자는 자신이 다닐 학교를 정확히
 *   특정하고 싶거나 (e.g., 합격 통보를 이미 받음), 등록된 학교 목록 밖의 임의
 *   값을 직접 넣고 싶을 수 있다. 본 store 는 도시별로 "선택된 학교" 또는
 *   "직접 입력값" 을 단일 출처로 둔다.
 *
 * 도시별 map (Record<cityId, choice>):
 *   ADR-060 의 rentChoice 는 전역 단일값이지만 (사용자 형태 = 도시 무관),
 *   학비는 도시별 학교 라인업이 다르므로 cityId 별로 별도 선택을 보존한다.
 *
 * Public API:
 *   - useTuitionChoiceStore: zustand hook
 *   - TuitionChoice: union — preset (school 이름) | custom (연 학비)
 *   - resolveTuitionChoice: 도시 데이터 + 선택값 → 표시용 entry (단일 fallback 정책)
 *   - INITIAL_STATE / setTuitionChoice / clearTuitionChoice / reset
 *
 * 정책:
 *   - 초기값 `{ choices: {} }` — 도시별 미선택 = 첫 entry fallback
 *   - persist 키 `tuitionChoice:v1`
 *   - partialize: 액션 제외, choices 만 영속화
 *   - 손상된 캐시 → INITIAL fallback (silent fail 금지, ADR-014)
 *
 * 본 store 는 throw 하지 않는다.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { CityCostData, CityTuitionEntry } from '@/types/city';

export type TuitionChoice =
  | { kind: 'preset'; school: string }
  | { kind: 'custom'; annual: number };

export type TuitionChoiceState = {
  /** cityId → 선택값. 미선택 도시는 entry 부재. */
  choices: Record<string, TuitionChoice>;
};

export type TuitionChoiceActions = {
  /** 특정 도시의 선택값 갱신 (preset 또는 custom). */
  setTuitionChoice: (cityId: string, next: TuitionChoice) => void;
  /** 특정 도시의 선택값 제거 → 첫 entry fallback. */
  clearTuitionChoice: (cityId: string) => void;
  /** 전체 초기화. */
  reset: () => void;
};

export const INITIAL_STATE: TuitionChoiceState = {
  choices: {},
};

const PERSIST_KEY = 'tuitionChoice:v1';
const PERSIST_VERSION = 1;

function isValidChoice(v: unknown): v is TuitionChoice {
  if (v === null || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  if (c.kind === 'preset') return typeof c.school === 'string' && c.school.length > 0;
  if (c.kind === 'custom') {
    return typeof c.annual === 'number' && Number.isFinite(c.annual) && c.annual > 0;
  }
  return false;
}

function isValidPersistedState(v: unknown): v is TuitionChoiceState {
  /* istanbul ignore next: defensive — zustand 의 default merge 가 항상 객체를 반환하므로 발생 불가 */
  if (v === null || typeof v !== 'object') return false;
  const candidate = v as Record<string, unknown>;
  if (candidate.choices === null || typeof candidate.choices !== 'object') return false;
  const choices = candidate.choices as Record<string, unknown>;
  for (const key of Object.keys(choices)) {
    if (!isValidChoice(choices[key])) return false;
  }
  return true;
}

export type ResolvedTuition = {
  /** 표시용 학교명 (custom 일 땐 '직접 입력'). */
  school: string;
  /** 연 학비 (city currency). */
  annual: number;
  /** custom 입력 여부 — UI 표시 분기용. */
  isCustom: boolean;
};

/**
 * 사용자 선택값을 도시 데이터에 적용해 표시용 entry 를 반환.
 *
 * - choice 가 `custom` → 그대로 사용 (도시 entry 무시).
 * - choice 가 `preset` → school 이름으로 도시 entries 매칭. 매칭 실패 시
 *   (데이터 갱신으로 학교가 사라진 경우) entries[0] 로 fallback.
 * - choice 가 undefined (미선택) → entries[0] 로 fallback.
 * - 모든 fallback 실패 (entries 부재) → null.
 *
 * 본 함수는 store 와 독립 — 순수 함수. Compare/Detail 양쪽이 동일 정책으로
 * 결측을 처리하도록 단일 출처화.
 *
 * `resolveTaxChoice` 와의 의도적 비대칭 (PR #25 3차 review):
 * tuition 의 custom 은 도시 entries 와 무관하게 통과 — 사용자가 입력한 연
 * 학비만으로 충분한 정보 (월 = 연/12 환산만 필요). 반면 tax 의 custom 은
 * `takeHomePctApprox` 차용을 위해 entries[0] 가 반드시 필요. Compare 호출부
 * (`TUITION_CONFIG.getValue`) 가 seoul 처럼 entries 가 비어있는 경우 본 함수
 * 호출 전 단계에서 짧게 null 처리한다 (서울 학비 0원 정책 일치).
 */
export function resolveTuitionChoice(
  cityTuition: CityCostData['tuition'],
  choice: TuitionChoice | undefined,
): ResolvedTuition | null {
  if (choice !== undefined && choice.kind === 'custom') {
    return { school: '직접 입력', annual: choice.annual, isCustom: true };
  }

  const entries: CityTuitionEntry[] = cityTuition ?? [];
  if (entries.length === 0) return null;

  if (choice !== undefined && choice.kind === 'preset') {
    const matched = entries.find((e) => e.school === choice.school);
    if (matched) {
      return { school: matched.school, annual: matched.annual, isCustom: false };
    }
  }

  // entries[0] 은 length>0 이면 정의됨 — noUncheckedIndexedAccess 보호용 단언.
  const first = entries[0]!;
  return { school: first.school, annual: first.annual, isCustom: false };
}

export const useTuitionChoiceStore = create<TuitionChoiceState & TuitionChoiceActions>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,
      setTuitionChoice: (cityId, next) =>
        set((s) => ({ choices: { ...s.choices, [cityId]: next } })),
      clearTuitionChoice: (cityId) =>
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
      migrate: (persistedState) => persistedState as TuitionChoiceState,
      onRehydrateStorage: () => (rehydratedState, error) => {
        if (error !== undefined && error !== null) {
          useTuitionChoiceStore.setState(INITIAL_STATE);
          return;
        }
        if (rehydratedState !== undefined && !isValidPersistedState(rehydratedState)) {
          useTuitionChoiceStore.setState(INITIAL_STATE);
        }
      },
    },
  ),
);
