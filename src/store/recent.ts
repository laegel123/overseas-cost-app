/**
 * 최근 본 도시 store — FIFO 정책, 최신이 [0], 최대 5개, dedupe 보장.
 *
 * AsyncStorage 영속화 (`zustand/middleware persist` + `createJSONStorage`).
 * 단일 거대 store 금지 정책 (ADR-004) — 본 모듈은 최근 본 도시만 책임.
 *
 * Public API:
 *   - useRecentStore: zustand hook + .getState() + .setState() + .persist.*
 *   - RecentState / RecentActions: 외부 타입
 *
 * 정책:
 *   - 초기값 { cityIds: [] }
 *   - MAX_RECENT = 5 (PRD §F7) — 6번째 push 시 가장 오래된 (마지막) 항목 evict
 *   - push 흐름: 기존 위치 제거 → [id, ...filtered].slice(0, MAX_RECENT)
 *   - 자동 관리 — 사용자에게 보일 에러 케이스 없음. throw 안 함, 빈 입력 silent.
 *   - persist 키 `recent:v1` — DATA.md §13.5.1 단일 출처. v 접미사 bump 시 ADR-022.
 *   - partialize: 액션 제외, state 만 영속화
 *   - 손상 캐시 (잘못된 JSON / cityIds 타입 위반) → 초기값 fallback +
 *     setState(INITIAL) 자동 setItem 으로 정리 (silent fail 금지 — CLAUDE.md CRITICAL)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type RecentState = {
  cityIds: string[];
};

export type RecentActions = {
  push: (cityId: string) => void;
  clear: () => void;
};

export const MAX_RECENT = 5;

const INITIAL_STATE: RecentState = {
  cityIds: [],
};

const PERSIST_KEY = 'recent:v1';
const PERSIST_VERSION = 1;

function isValidPersistedState(v: unknown): v is RecentState {
  if (v === null || typeof v !== 'object') return false;
  const candidate = v as Record<string, unknown>;
  if (!Array.isArray(candidate.cityIds)) return false;
  return candidate.cityIds.every((id) => typeof id === 'string');
}

export const useRecentStore = create<RecentState & RecentActions>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      // 최신을 [0] 으로 — 기존 위치는 제거 (dedupe + 최신화).
      // 6번째 진입 시 가장 오래된 (마지막) 항목 evict.
      push: (cityId) => {
        const filtered = get().cityIds.filter((id) => id !== cityId);
        const next = [cityId, ...filtered].slice(0, MAX_RECENT);
        set({ cityIds: next });
      },

      clear: () => set({ cityIds: [] }),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: PERSIST_VERSION,
      partialize: (state) => ({ cityIds: state.cityIds }),
      // v1 only — v2 도입 시 본 함수에서 변환 로직 작성.
      migrate: (persistedState) => persistedState as RecentState,
      // 손상 캐시 / cityIds 타입 위반 → 초기 상태 fallback. setState(INITIAL_STATE) 가
      // persist middleware 의 자동 setItem 을 트리거 → 손상 데이터 정리됨.
      // silent fail 금지 (CLAUDE.md CRITICAL) — invalid 시 명시적으로 INITIAL 적용.
      onRehydrateStorage: () => (rehydratedState, error) => {
        if (error !== undefined && error !== null) {
          useRecentStore.setState(INITIAL_STATE);
          return;
        }
        if (rehydratedState !== undefined && !isValidPersistedState(rehydratedState)) {
          useRecentStore.setState(INITIAL_STATE);
        }
      },
    },
  ),
);
