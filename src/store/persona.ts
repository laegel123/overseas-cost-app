/**
 * 페르소나 store — `'student' | 'worker' | 'unknown'` + `onboarded` 플래그.
 *
 * AsyncStorage 영속화 (`zustand/middleware persist` + `createJSONStorage`).
 * 단일 거대 store 금지 정책 (ADR-004) — 본 모듈은 페르소나만 책임.
 *
 * Public API:
 *   - usePersonaStore: zustand hook + .getState() + .setState() + .persist.*
 *   - PersonaState / PersonaActions: 외부 타입
 *
 * 정책:
 *   - 초기값 { persona: 'unknown', onboarded: false } — TESTING §9.5 단일 출처
 *   - persist 키 `persona:v1` — DATA.md §13.5.1 단일 출처. v 접미사 bump 시 ADR-022.
 *   - partialize: 액션 제외, state 만 영속화
 *   - 손상된 캐시 (잘못된 JSON / 알 수 없는 persona literal) → 초기값 fallback +
 *     캐시 정리 (silent fail 금지 — onRehydrateStorage 가 명시적으로 처리)
 *   - migrate: v1 only — stub. v2 도입 시 별도 ADR + 본 함수 구현
 *
 * 본 store 는 throw 하지 않는다. 페르소나 literal 3 값은 type-level 로 차단.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Persona } from '@/types/city';

export type PersonaState = {
  persona: Persona;
  onboarded: boolean;
};

export type PersonaActions = {
  setPersona: (next: Persona) => void;
  setOnboarded: (next: boolean) => void;
  reset: () => void;
};

// 초기 상태 — reset() 와 손상 캐시 fallback 이 같은 상수를 참조 (drift 방지).
// app-shell phase 의 hydration timeout guard (ADR-052) 도 본 상수를 참조.
export const INITIAL_STATE: PersonaState = {
  persona: 'unknown',
  onboarded: false,
};

const PERSIST_KEY = 'persona:v1';
const PERSIST_VERSION = 1;

// persist 가 디스크에서 읽은 값이 PersonaState 인지 검증.
// 손상된 캐시 또는 유효하지 않은 persona literal → 초기값 fallback.
function isValidPersistedState(v: unknown): v is PersonaState {
  /* istanbul ignore next: defensive — zustand 의 default merge 가 항상 객체를 반환하므로 발생 불가 */
  if (v === null || typeof v !== 'object') return false;
  const candidate = v as Record<string, unknown>;
  if (
    candidate.persona !== 'student' &&
    candidate.persona !== 'worker' &&
    candidate.persona !== 'unknown'
  ) {
    return false;
  }
  if (typeof candidate.onboarded !== 'boolean') return false;
  return true;
}

export const usePersonaStore = create<PersonaState & PersonaActions>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,
      setPersona: (next) => set({ persona: next }),
      setOnboarded: (next) => set({ onboarded: next }),
      reset: () => set(INITIAL_STATE),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: PERSIST_VERSION,
      // 액션은 영속화 X — state 만.
      partialize: (state) => ({
        persona: state.persona,
        onboarded: state.onboarded,
      }),
      // v1 only — v2 도입 시 본 함수를 named export (예: `migratePersonaV1ToV2`)
      // 로 분리 + 테스트에서 jest.spyOn 으로 호출/인자/결과 검증 (TESTING §9.5
      // 의 deferred 항목). 현재 stub 은 단순 cast 로 v0/v1 entry 를 통과시킴.
      migrate: (persistedState) => persistedState as PersonaState,
      // 손상 캐시 / 유효하지 않은 literal → INITIAL fallback. silent fail 금지
      // (CLAUDE.md CRITICAL) — setState(INITIAL_STATE) 가 persist middleware
      // 를 통해 storage 도 갱신 (별도 removeItem 은 race 가능 — setItem 재트리거).
      onRehydrateStorage: () => (rehydratedState, error) => {
        if (error !== undefined && error !== null) {
          usePersonaStore.setState(INITIAL_STATE);
          return;
        }
        if (rehydratedState !== undefined && !isValidPersistedState(rehydratedState)) {
          usePersonaStore.setState(INITIAL_STATE);
        }
      },
    },
  ),
);
