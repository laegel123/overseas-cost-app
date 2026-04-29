/**
 * 설정 store — 마지막 데이터 동기화 시각 (UI 표시용).
 *
 * AsyncStorage 영속화 (`zustand/middleware persist` + `createJSONStorage`).
 * 단일 거대 store 금지 정책 (ADR-004) — 본 모듈은 lastSync 만 책임.
 *
 * Public API:
 *   - useSettingsStore: zustand hook + .getState() + .setState() + .persist.*
 *   - SettingsState / SettingsActions: 외부 타입
 *
 * 정책:
 *   - 초기값 { lastSync: null } — TESTING §9.8 단일 출처
 *   - persist 키 `settings:v1` — DATA.md §13.5.1 단일 출처. v 접미사 bump 시 ADR-022.
 *   - partialize: 액션 제외, state 만 영속화
 *   - 손상된 캐시 (잘못된 JSON / lastSync 타입 위반) → 초기값 fallback +
 *     setState(INITIAL) 자동 setItem 으로 정리 (silent fail 금지 — CLAUDE.md CRITICAL)
 *
 * updateLastSync 입력 정규화:
 *   - Date → date.toISOString()
 *   - string → new Date(string).toISOString() 정규화 (drift 방지)
 *   - null → clear (lastSync: null)
 *   - 잘못된 string (Date 가 NaN) → silent 무시 (호출자 책임 — ADR-014 의 lib
 *     "결정적 에러 throw" 는 lib 영역, store 는 reactive 표시용이라 throw 안 함)
 *
 * 본 store 의 lastSync 는 React 컴포넌트의 reactive 표시용. AsyncStorage 메타키
 * `meta:lastSync` (lib data.ts 가 직접 갱신) 와 정보 중복이며, 둘 사이의 동기화는
 * app-shell phase 의 부트로더 책임 (본 store 가 자동 동기화하지 않는다).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type SettingsState = {
  lastSync: string | null;
};

export type SettingsActions = {
  updateLastSync: (date: Date | string | null) => void;
  reset: () => void;
};

const INITIAL_STATE: SettingsState = {
  lastSync: null,
};

const PERSIST_KEY = 'settings:v1';
const PERSIST_VERSION = 1;

function isValidPersistedState(v: unknown): v is SettingsState {
  if (v === null || typeof v !== 'object') return false;
  const candidate = v as Record<string, unknown>;
  if (candidate.lastSync !== null && typeof candidate.lastSync !== 'string') return false;
  return true;
}

// Date | string | null → ISO string | null 로 정규화.
// 잘못된 string (NaN Date) → undefined (호출 무시 신호).
function normalizeLastSync(input: Date | string | null): string | null | undefined {
  if (input === null) return null;
  if (input instanceof Date) {
    const ms = input.getTime();
    if (Number.isNaN(ms)) return undefined;
    return input.toISOString();
  }
  // string
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      updateLastSync: (date) => {
        const next = normalizeLastSync(date);
        if (next === undefined) return;
        set({ lastSync: next });
      },

      reset: () => set(INITIAL_STATE),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: PERSIST_VERSION,
      partialize: (state) => ({ lastSync: state.lastSync }),
      // v1 only — v2 도입 시 본 함수에서 변환 로직 작성.
      migrate: (persistedState) => persistedState as SettingsState,
      // 손상 캐시 / lastSync 타입 위반 → 초기 상태 fallback. setState(INITIAL_STATE) 가
      // persist middleware 의 자동 setItem 을 트리거 → 손상 데이터 정리됨.
      // silent fail 금지 (CLAUDE.md CRITICAL) — invalid 시 명시적으로 INITIAL 적용.
      onRehydrateStorage: () => (rehydratedState, error) => {
        if (error !== undefined && error !== null) {
          useSettingsStore.setState(INITIAL_STATE);
          return;
        }
        if (rehydratedState !== undefined && !isValidPersistedState(rehydratedState)) {
          useSettingsStore.setState(INITIAL_STATE);
        }
      },
    },
  ),
);
