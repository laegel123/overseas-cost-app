/**
 * 도시끼리 비교 쌍 store — 비교 탭에서 마지막으로 고른 두 도시.
 *
 * AsyncStorage 영속화 (`zustand/middleware persist` + `createJSONStorage`).
 * 단일 거대 store 금지 정책 (ADR-004) — 본 모듈은 비교 쌍 두 칸만 책임.
 *
 * 배경:
 *   비교 탭은 도시 두 곳을 골라 맞붙이는 선택 화면이다 (왼쪽 = 기준 base,
 *   오른쪽 = 대상 city). 앱을 다시 켰을 때 직전에 고른 조합이 남아 있도록
 *   칸을 고를 때마다 값을 저장한다. 처음에는 두 칸 모두 비어 있다 (null).
 *
 * Public API:
 *   - useComparePairStore: zustand hook + .getState() + .setState() + .persist.*
 *   - ComparePairState / ComparePairActions: 외부 타입
 *   - INITIAL_STATE: 초기 상태 (hydration.ts 의 timeout fallback 도 참조)
 *
 * 정책:
 *   - 초기값 `{ baseId: null, cityId: null }` — 미선택 = null
 *   - persist 키 `comparePair:v1` — v 접미사 bump 시 ADR
 *   - partialize: 액션 제외, state 만 영속화
 *   - 손상된 캐시 (잘못된 JSON / 필드가 `string | null` 아님) → INITIAL fallback +
 *     setState(INITIAL) 의 자동 setItem 으로 정리 (silent fail 금지 — CLAUDE.md
 *     CRITICAL). 한 칸만 살아남은 반쯤 깨진 상태는 화면에서 구분할 수 없으므로
 *     **부분 복구하지 않고 두 칸 모두 초기화**한다.
 *
 * 본 store 가 검증하지 않는 것 (의도된 책임 분리):
 *   - 도시 id 의 실제 존재 여부 — store 는 도시 데이터(`src/lib/data.ts`) 에
 *     의존하지 않는다. 목록에 없는 id 는 화면이 빈 칸으로 취급한다.
 *   - `baseId === cityId` — 같은 도시 방지는 화면 규칙(반대편 칸에 든 도시는
 *     고를 수 없음)이며 store 는 값만 보관한다.
 *
 * 본 store 는 throw 하지 않는다.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ComparePairState = {
  /** 왼쪽(기준) 칸. 미선택 = null */
  baseId: string | null;
  /** 오른쪽(대상) 칸. 미선택 = null */
  cityId: string | null;
};

export type ComparePairActions = {
  setBase: (id: string) => void;
  setCity: (id: string) => void;
};

// 초기 상태 — 손상 캐시 fallback 과 hydration timeout guard (ADR-052) 가 같은
// 상수를 참조 (drift 방지).
export const INITIAL_STATE: ComparePairState = {
  baseId: null,
  cityId: null,
};

const PERSIST_KEY = 'comparePair:v1';
const PERSIST_VERSION = 1;

function isValidSlot(v: unknown): v is string | null {
  return v === null || typeof v === 'string';
}

function isValidPersistedState(v: unknown): v is ComparePairState {
  /* istanbul ignore next: defensive — zustand 의 default merge 가 항상 객체를 반환하므로 발생 불가 */
  if (v === null || typeof v !== 'object') return false;
  const candidate = v as Record<string, unknown>;
  // 한쪽만 깨져도 전체 무효 — 부분 복구 금지.
  return isValidSlot(candidate.baseId) && isValidSlot(candidate.cityId);
}

export const useComparePairStore = create<ComparePairState & ComparePairActions>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,
      setBase: (id) => set({ baseId: id }),
      setCity: (id) => set({ cityId: id }),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: PERSIST_VERSION,
      partialize: (state) => ({ baseId: state.baseId, cityId: state.cityId }),
      // v1 only — v2 도입 시 본 함수를 named export 로 분리 + 테스트에서 spy 검증.
      migrate: (persistedState) => persistedState as ComparePairState,
      // 손상 캐시 / 필드 타입 위반 → 초기 상태 fallback. setState(INITIAL_STATE) 가
      // persist middleware 의 자동 setItem 을 트리거 → 손상 데이터 정리됨.
      // silent fail 금지 (CLAUDE.md CRITICAL) — invalid 시 명시적으로 INITIAL 적용.
      onRehydrateStorage: () => (rehydratedState, error) => {
        if (error !== undefined && error !== null) {
          useComparePairStore.setState(INITIAL_STATE);
          return;
        }
        if (rehydratedState !== undefined && !isValidPersistedState(rehydratedState)) {
          useComparePairStore.setState(INITIAL_STATE);
        }
      },
    },
  ),
);
