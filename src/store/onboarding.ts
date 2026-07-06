/**
 * 온보딩 store — `onboarded` 플래그 (1회성 도시 선택 온보딩 완료 여부).
 *
 * AsyncStorage 영속화 (`zustand/middleware persist` + `createJSONStorage`).
 * 단일 거대 store 금지 정책 (ADR-004) — 본 모듈은 onboarded 플래그만 책임.
 *
 * ADR-067 (페르소나 제거): `onboarded` 는 원래 persona store 소유였으나, persona
 * 개념 제거와 함께 본 단일 목적 store 로 이전. `_layout.tsx` 게이트는 onboarded
 * 만 참조한다 (persona 값에 무관).
 *
 * Public API:
 *   - useOnboardingStore: zustand hook + .getState() + .setState() + .persist.*
 *   - OnboardingState / OnboardingActions: 외부 타입
 *
 * 정책:
 *   - 초기값 { onboarded: false } — TESTING §9.8.5 단일 출처
 *   - persist 키 `onboarding:v1` — DATA.md §13.5.1 단일 출처. v 접미사 bump 시 ADR-022.
 *   - partialize: 액션 제외, state 만 영속화
 *   - 손상된 캐시 (잘못된 JSON / onboarded 타입 위반) → 초기값 fallback +
 *     setState(INITIAL) 자동 setItem 으로 정리 (silent fail 금지 — CLAUDE.md CRITICAL)
 *   - migrate: v1 only — stub. v2 도입 시 별도 ADR + 본 함수 구현
 *
 * 본 store 는 throw 하지 않는다.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type OnboardingState = {
  onboarded: boolean;
};

export type OnboardingActions = {
  setOnboarded: (next: boolean) => void;
  reset: () => void;
};

// 초기 상태 — reset() 와 손상 캐시 fallback 이 같은 상수를 참조 (drift 방지).
// app-shell phase 의 hydration timeout guard (ADR-052) 도 본 상수를 참조.
export const INITIAL_STATE: OnboardingState = {
  onboarded: false,
};

const PERSIST_KEY = 'onboarding:v1';
const PERSIST_VERSION = 1;

// persist 가 디스크에서 읽은 값이 OnboardingState 인지 검증.
// 손상된 캐시 또는 onboarded 타입 위반 → 초기값 fallback.
function isValidPersistedState(v: unknown): v is OnboardingState {
  /* istanbul ignore next: defensive — zustand 의 default merge 가 항상 객체를 반환하므로 발생 불가 */
  if (v === null || typeof v !== 'object') return false;
  const candidate = v as Record<string, unknown>;
  if (typeof candidate.onboarded !== 'boolean') return false;
  return true;
}

export const useOnboardingStore = create<OnboardingState & OnboardingActions>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,
      setOnboarded: (next) => set({ onboarded: next }),
      reset: () => set(INITIAL_STATE),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: PERSIST_VERSION,
      // 액션은 영속화 X — state 만.
      partialize: (state) => ({ onboarded: state.onboarded }),
      // v1 only — v2 도입 시 본 함수를 named export 로 분리 + 테스트에서
      // jest.spyOn 으로 호출/인자 검증 (TESTING §9.8.5 의 deferred 항목).
      migrate: (persistedState) => persistedState as OnboardingState,
      // 손상 캐시 / onboarded 타입 위반 → INITIAL fallback. silent fail 금지
      // (CLAUDE.md CRITICAL) — setState(INITIAL_STATE) 가 persist middleware
      // 를 통해 storage 도 갱신 (별도 removeItem 은 race 가능 — setItem 재트리거).
      onRehydrateStorage: () => (rehydratedState, error) => {
        if (error !== undefined && error !== null) {
          useOnboardingStore.setState(INITIAL_STATE);
          return;
        }
        if (rehydratedState !== undefined && !isValidPersistedState(rehydratedState)) {
          useOnboardingStore.setState(INITIAL_STATE);
        }
      },
    },
  ),
);
