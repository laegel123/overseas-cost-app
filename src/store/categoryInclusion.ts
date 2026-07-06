/**
 * 카테고리 포함 토글 store — 도시별로 사용자가 hero 합산에 포함할 카테고리를
 * 직접 ON/OFF 한다 (ADR-062).
 *
 * AsyncStorage 영속화 (`zustand/middleware persist` + `createJSONStorage`).
 * 단일 거대 store 금지 정책 (ADR-004) — 본 모듈은 inclusion 만 책임.
 *
 * 배경 (ADR-062, ADR-067):
 *   통합 뷰(6 카테고리)에서 "이 항목을 내 케이스 합계에 포함할지" 는 별개 의도다
 *   (회사 기숙사 → 월세 OFF / 영주권자 → 비자 OFF / 학원 다닐 계획 → 학비 ON).
 *   사용자가 카드별 토글로 직접 결정하고 도시별 영속.
 *
 * 도시별 map (Record<cityId, Partial<Record<SourceCategory, boolean>>>):
 *   ADR-061 의 tuitionChoice / taxChoice 와 동일 패턴. 도시 전환 시 다른
 *   상황을 가정할 수 있도록 cityId 별 분리.
 *
 * Public API:
 *   - useCategoryInclusionStore: zustand hook
 *   - getDefaultInclusion(category): 고정 기본값(통합 뷰, ADR-067) 단일 출처
 *   - resolveInclusion(cityId, category, inclusions): 사용자 토글 또는 default
 *   - INITIAL_STATE / setInclusion / resetCity / reset
 *
 * 정책:
 *   - 초기값 `{ inclusions: {} }` — 모두 미설정 = 고정 default 적용
 *   - persist 키 `categoryInclusion:v1`
 *   - partialize: 액션 제외, inclusions 만 영속화
 *   - 손상된 캐시 → INITIAL fallback (silent fail 금지, ADR-014)
 *
 * 본 store 는 throw 하지 않는다.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { SourceCategory } from '@/types/city';

export type CategoryInclusionMap = Partial<Record<SourceCategory, boolean>>;

export type CategoryInclusionState = {
  /** cityId → 카테고리별 사용자 토글값. 미설정 카테고리는 entry 부재 (default 적용). */
  inclusions: Record<string, CategoryInclusionMap>;
};

export type CategoryInclusionActions = {
  /** 특정 도시의 특정 카테고리 토글값 갱신. */
  setInclusion: (cityId: string, category: SourceCategory, included: boolean) => void;
  /** 특정 도시의 모든 토글값 제거 → 모두 default 로 회귀. */
  resetCity: (cityId: string) => void;
  /** 전체 초기화. */
  reset: () => void;
};

export const INITIAL_STATE: CategoryInclusionState = {
  inclusions: {},
};

const PERSIST_KEY = 'categoryInclusion:v1';
const PERSIST_VERSION = 1;

// ADR-067 Decision §3 — 고정 기본값(통합 뷰) 단일 출처. 페르소나 제거로
// ADR-062 의 persona-aware default 를 고정 default 로 대체 (기존 'unknown' 동작과 동일).
// rent/food/transport: 항상 ON (기본 평상 비용)
// tuition/tax/visa: 항상 OFF (일회성/조건부 비용)
export function getDefaultInclusion(category: SourceCategory): boolean {
  switch (category) {
    case 'rent':
    case 'food':
    case 'transport':
      return true;
    case 'tuition':
    case 'tax':
    case 'visa':
      return false;
    default: {
      // exhaustiveness — SourceCategory 확장 시 컴파일 에러로 감지.
      const _exhaustive: never = category;
      return false;
    }
  }
}

/**
 * 사용자 명시 토글값 → 고정 기본값 순으로 한 카테고리의 inclusion 결정.
 *
 * - 도시 map 에 해당 카테고리 entry 가 boolean → 그 값 반환.
 * - 미설정 → `getDefaultInclusion(category)`.
 *
 * Compare 화면이 매 카테고리마다 호출. store 와 독립 — 순수 함수.
 */
export function resolveInclusion(
  cityId: string,
  category: SourceCategory,
  inclusions: Record<string, CategoryInclusionMap>,
): boolean {
  const cityMap = inclusions[cityId];
  const explicit = cityMap?.[category];
  if (typeof explicit === 'boolean') return explicit;
  return getDefaultInclusion(category);
}

const VALID_CATEGORIES: ReadonlySet<SourceCategory> = new Set<SourceCategory>([
  'rent',
  'food',
  'transport',
  'tuition',
  'tax',
  'visa',
]);

function isValidCityMap(v: unknown): v is CategoryInclusionMap {
  if (v === null || typeof v !== 'object') return false;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (!VALID_CATEGORIES.has(k as SourceCategory)) return false;
    if (typeof val !== 'boolean') return false;
  }
  return true;
}

function isValidPersistedState(v: unknown): v is CategoryInclusionState {
  /* istanbul ignore next: defensive — zustand 의 default merge 가 항상 객체를 반환하므로 발생 불가 */
  if (v === null || typeof v !== 'object') return false;
  const candidate = v as Record<string, unknown>;
  if (candidate.inclusions === null || typeof candidate.inclusions !== 'object') {
    return false;
  }
  const inclusions = candidate.inclusions as Record<string, unknown>;
  for (const cityId of Object.keys(inclusions)) {
    if (!isValidCityMap(inclusions[cityId])) return false;
  }
  return true;
}

export const useCategoryInclusionStore = create<
  CategoryInclusionState & CategoryInclusionActions
>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,
      setInclusion: (cityId, category, included) =>
        set((s) => ({
          inclusions: {
            ...s.inclusions,
            [cityId]: { ...(s.inclusions[cityId] ?? {}), [category]: included },
          },
        })),
      resetCity: (cityId) =>
        set((s) => {
          if (!(cityId in s.inclusions)) return s;
          const { [cityId]: _drop, ...rest } = s.inclusions;
          return { inclusions: rest };
        }),
      reset: () => set(INITIAL_STATE),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: PERSIST_VERSION,
      partialize: (state) => ({ inclusions: state.inclusions }),
      // ADR-061 패턴 — v1 단독이라 의도적 no-op. v2 schema 변경 시 v1→v2 변환
      // 분기 추가 필수 (그렇지 않으면 isValidPersistedState 가 v1 캐시를 reject
      // → 사용자 토글 전부 소실).
      migrate: (persistedState, version) => {
        if (version === PERSIST_VERSION) return persistedState as CategoryInclusionState;
        return INITIAL_STATE as CategoryInclusionState;
      },
      onRehydrateStorage: () => (rehydratedState, error) => {
        if (error !== undefined && error !== null) {
          useCategoryInclusionStore.setState(INITIAL_STATE);
          return;
        }
        if (rehydratedState !== undefined && !isValidPersistedState(rehydratedState)) {
          useCategoryInclusionStore.setState(INITIAL_STATE);
        }
      },
    },
  ),
);
