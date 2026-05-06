/**
 * 주거 형태 선택 store — 사용자가 비교 기준으로 삼는 한 가지 주거 형태.
 *
 * AsyncStorage 영속화 (`zustand/middleware persist` + `createJSONStorage`).
 * 단일 거대 store 금지 정책 (ADR-004) — 본 모듈은 rent choice 만 책임.
 *
 * 배경:
 *   월세 카테고리는 다른 카테고리와 달리 "셰어하우스/원룸/1베드룸/2베드룸 단가
 *   합산" 이 의미가 없다 (한 사람이 4 형태 동시 거주 X). v1.0 이전엔 Compare 화면
 *   `RENT_CONFIG.getValue` 가 `share ?? studio ?? oneBed` fallback 으로 단일값을
 *   썼고, Detail 화면 hero 는 4 형태 합산을 보여주는 의미 mismatch 가 있었다.
 *   본 store 는 "사용자가 비교 기준으로 정한 거주 형태" 를 단일 출처로 두어
 *   Compare hero / Compare 월세 카드 / Detail hero 가 모두 동일 기준으로 비교
 *   되도록 한다 (ADR-060).
 *
 * Public API:
 *   - useRentChoiceStore: zustand hook + .getState() + .setState() + .persist.*
 *   - RentChoice: 4 literal union — `'share' | 'studio' | 'oneBed' | 'twoBed'`
 *   - RENT_CHOICE_FALLBACK_ORDER: null fallback 검색 순서 (도시별 데이터 결측 시)
 *   - resolveRentChoice: 선택값이 도시에서 결측이면 fallback 순으로 첫 non-null 키
 *   - INITIAL_STATE / setRentChoice / reset: 액션
 *
 * 정책:
 *   - 초기값 { rentChoice: 'share' } — TESTING §9.x 단일 출처
 *   - persist 키 `rentChoice:v1` — DATA.md §13.5.1 단일 출처. v 접미사 bump 시 ADR.
 *   - partialize: 액션 제외, state 만 영속화
 *   - 손상된 캐시 (잘못된 JSON / 알 수 없는 RentChoice literal) → 초기값 fallback +
 *     캐시 정리 (silent fail 금지 — onRehydrateStorage 가 명시적으로 처리)
 *
 * 본 store 는 throw 하지 않는다. RentChoice literal 4 값은 type-level 로 차단.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { CityCostData } from '@/types/city';

export type RentChoice = 'share' | 'studio' | 'oneBed' | 'twoBed';

/**
 * 도시 데이터에서 선택한 키가 null 일 때 fallback 검색 순서.
 *
 * 가장 보편적인 형태 (share) 부터 점차 큰 형태로 — Compare 화면 v1.0 이전
 * `share ?? studio ?? oneBed` 와 의미 일치. 단 본 함수는 사용자가 선택한 키를
 * 항상 우선 시도한 뒤 fallback 으로 들어간다.
 */
export const RENT_CHOICE_FALLBACK_ORDER: readonly RentChoice[] = [
  'share',
  'studio',
  'oneBed',
  'twoBed',
] as const;

export type RentChoiceState = {
  rentChoice: RentChoice;
};

export type RentChoiceActions = {
  setRentChoice: (next: RentChoice) => void;
  reset: () => void;
};

// 초기 상태 — reset() 와 손상 캐시 fallback 이 같은 상수를 참조 (drift 방지).
export const INITIAL_STATE: RentChoiceState = {
  rentChoice: 'share',
};

const PERSIST_KEY = 'rentChoice:v1';
const PERSIST_VERSION = 1;

const VALID_CHOICES = new Set<RentChoice>(RENT_CHOICE_FALLBACK_ORDER);

function isValidPersistedState(v: unknown): v is RentChoiceState {
  /* istanbul ignore next: defensive — zustand 의 default merge 가 항상 객체를 반환하므로 발생 불가 */
  if (v === null || typeof v !== 'object') return false;
  const candidate = v as Record<string, unknown>;
  if (typeof candidate.rentChoice !== 'string') return false;
  return VALID_CHOICES.has(candidate.rentChoice as RentChoice);
}

/**
 * 사용자가 선택한 rent 키를 도시 데이터에 적용.
 *
 * 선택 키가 null 이면 `RENT_CHOICE_FALLBACK_ORDER` 를 순회하며 첫 non-null 키
 * 반환. 모든 키가 null 이면 null (호출자가 "데이터 없음" 분기 처리).
 *
 * 본 함수는 store 와 독립 — 순수 함수. Compare/Detail 양쪽이 동일 정책으로
 * 도시 데이터 결측을 처리하도록 단일 출처화.
 */
export function resolveRentChoice(
  rent: CityCostData['rent'],
  choice: RentChoice,
): { key: RentChoice; value: number } | null {
  const direct = rent[choice];
  if (direct !== null && direct !== undefined) {
    return { key: choice, value: direct };
  }
  for (const k of RENT_CHOICE_FALLBACK_ORDER) {
    if (k === choice) continue;
    const v = rent[k];
    if (v !== null && v !== undefined) {
      return { key: k, value: v };
    }
  }
  return null;
}

export const useRentChoiceStore = create<RentChoiceState & RentChoiceActions>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,
      setRentChoice: (next) => set({ rentChoice: next }),
      reset: () => set(INITIAL_STATE),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: PERSIST_VERSION,
      partialize: (state) => ({ rentChoice: state.rentChoice }),
      // v1 only — v2 도입 시 본 함수를 named export 로 분리 + 테스트에서 spy 검증.
      migrate: (persistedState) => persistedState as RentChoiceState,
      onRehydrateStorage: () => (rehydratedState, error) => {
        if (error !== undefined && error !== null) {
          useRentChoiceStore.setState(INITIAL_STATE);
          return;
        }
        if (rehydratedState !== undefined && !isValidPersistedState(rehydratedState)) {
          useRentChoiceStore.setState(INITIAL_STATE);
        }
      },
    },
  ),
);
