/**
 * 즐겨찾기 store — 도시 ID 배열, 추가 순서 보존, dedupe 보장.
 *
 * AsyncStorage 영속화 (`zustand/middleware persist` + `createJSONStorage`).
 * 단일 거대 store 금지 정책 (ADR-004) — 본 모듈은 즐겨찾기만 책임.
 *
 * Public API:
 *   - useFavoritesStore: zustand hook + .getState() + .setState() + .persist.*
 *   - FavoritesState / FavoritesActions / AddResult: 외부 타입
 *
 * 정책:
 *   - 초기값 { cityIds: [] }
 *   - 상한 MAX_FAVORITES = 50 (TESTING §9.6, ARCHITECTURE 카탈로그). 초과 시
 *     `FavoritesLimitError` throw 가 아니라 `{ ok: false, reason: 'limit' }` 결과
 *     객체로 표현 — 화면 단 (별도 phase) 이 toast 메시지로 변환.
 *   - persist 키 `favorites:v1` — DATA.md §13.5.1 단일 출처
 *   - partialize: 액션 제외, state 만 영속화
 *   - 손상 캐시 (잘못된 JSON / cityIds 타입 위반) → 초기값 fallback +
 *     setState(INITIAL) 자동 setItem 으로 정리
 *   - addMany 는 atomic — limit 위반이면 부분 추가 금지 (UI 가 transactional 로 인식)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type FavoritesState = {
  cityIds: string[];
};

export type AddResult = { ok: true } | { ok: false; reason: 'limit' };

export type FavoritesActions = {
  add: (cityId: string) => AddResult;
  addMany: (ids: string[]) => AddResult;
  remove: (cityId: string) => void;
  removeMany: (ids: string[]) => void;
  toggle: (cityId: string) => AddResult;
  has: (cityId: string) => boolean;
  clear: () => void;
};

export const MAX_FAVORITES = 50;

// app-shell phase 의 hydration timeout guard (ADR-052) 도 본 상수를 참조.
export const INITIAL_STATE: FavoritesState = {
  cityIds: [],
};

const PERSIST_KEY = 'favorites:v1';
const PERSIST_VERSION = 1;

function isValidPersistedState(v: unknown): v is FavoritesState {
  /* istanbul ignore next: defensive — zustand 의 default merge 가 항상 객체를 반환하므로 발생 불가 */
  if (v === null || typeof v !== 'object') return false;
  const candidate = v as Record<string, unknown>;
  if (!Array.isArray(candidate.cityIds)) return false;
  return candidate.cityIds.every((id) => typeof id === 'string');
}

export const useFavoritesStore = create<FavoritesState & FavoritesActions>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      add: (cityId) => {
        const current = get().cityIds;
        if (current.includes(cityId)) {
          return { ok: true };
        }
        if (current.length >= MAX_FAVORITES) {
          return { ok: false, reason: 'limit' };
        }
        set({ cityIds: [...current, cityId] });
        return { ok: true };
      },

      addMany: (ids) => {
        const current = get().cityIds;
        // dedupe 입력 + 기존 favorites 제외
        const seen = new Set(current);
        const candidates: string[] = [];
        for (const id of ids) {
          if (!seen.has(id)) {
            seen.add(id);
            candidates.push(id);
          }
        }
        if (candidates.length === 0) {
          return { ok: true };
        }
        if (current.length + candidates.length > MAX_FAVORITES) {
          // atomic — 부분 추가 금지
          return { ok: false, reason: 'limit' };
        }
        set({ cityIds: [...current, ...candidates] });
        return { ok: true };
      },

      remove: (cityId) => {
        const current = get().cityIds;
        if (!current.includes(cityId)) return;
        set({ cityIds: current.filter((id) => id !== cityId) });
      },

      removeMany: (ids) => {
        const current = get().cityIds;
        const drop = new Set(ids);
        const next = current.filter((id) => !drop.has(id));
        if (next.length === current.length) return;
        set({ cityIds: next });
      },

      toggle: (cityId) => {
        const current = get().cityIds;
        if (current.includes(cityId)) {
          set({ cityIds: current.filter((id) => id !== cityId) });
          return { ok: true };
        }
        if (current.length >= MAX_FAVORITES) {
          return { ok: false, reason: 'limit' };
        }
        set({ cityIds: [...current, cityId] });
        return { ok: true };
      },

      has: (cityId) => get().cityIds.includes(cityId),

      clear: () => set({ cityIds: [] }),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: PERSIST_VERSION,
      partialize: (state) => ({ cityIds: state.cityIds }),
      // v1 only — v2 도입 시 본 함수를 named export 로 분리 + 테스트에서
      // jest.spyOn 으로 호출/인자 검증 (TESTING §9.6 의 deferred 항목).
      migrate: (persistedState) => persistedState as FavoritesState,
      // 손상 캐시 / cityIds 타입 위반 → 초기 상태 fallback. setState(INITIAL_STATE) 가
      // persist middleware 의 자동 setItem 을 트리거 → 손상 데이터 정리됨.
      // silent fail 금지 (CLAUDE.md CRITICAL) — invalid 시 명시적으로 INITIAL 적용.
      onRehydrateStorage: () => (rehydratedState, error) => {
        if (error !== undefined && error !== null) {
          useFavoritesStore.setState(INITIAL_STATE);
          return;
        }
        if (rehydratedState !== undefined && !isValidPersistedState(rehydratedState)) {
          useFavoritesStore.setState(INITIAL_STATE);
        }
      },
    },
  ),
);
