/**
 * 4 store 의 hasHydrated() 가 모두 true 가 될 때까지 대기.
 *
 * ARCHITECTURE.md §부팅·hydration 순서 의 Promise B/C/D/E 동시 await 패턴.
 * app-shell phase 의 _layout.tsx 가 useFonts 와 함께 Promise.all 로 합성한다.
 *
 * 본 헬퍼는 4 store 모두를 import 하는 유일한 모듈 — 도메인별 store 분리
 * (ARCHITECTURE.md §상태 관리, ADR-004) 를 깨지 않기 위해 store 간 직접
 * cross-import 는 금지되며, 본 함수만이 boundary 위에서 모두 참조한다.
 *
 * 각 store 는 zustand persist middleware 가 모듈 로딩 시점에 자동으로 hydration
 * 을 시작한다. 본 헬퍼는:
 *   - 이미 hydrated 된 store → 즉시 resolve
 *   - 미완 store → onFinishHydration 콜백 등록 후 그 콜백이 발화하면 resolve
 * 손상 캐시 (잘못된 JSON / 스키마 위반) 도 onRehydrateStorage 가 INITIAL 으로
 * fallback 시킨 후 hasHydrated() 가 true 가 되므로 정상적으로 resolve 된다.
 *
 * store 추가 시 본 함수의 Promise.all 인자에 한 줄 추가하는 패턴 (ADR-051).
 */

import {
  INITIAL_STATE as FAVORITES_INITIAL,
  useFavoritesStore,
} from './favorites';
import { INITIAL_STATE as PERSONA_INITIAL, usePersonaStore } from './persona';
import { INITIAL_STATE as RECENT_INITIAL, useRecentStore } from './recent';
import {
  INITIAL_STATE as SETTINGS_INITIAL,
  useSettingsStore,
} from './settings';

type PersistStoreLike<S> = {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (fn: (state: S) => void) => () => void;
  };
};

function waitOne<S>(store: PersistStoreLike<S>): Promise<void> {
  if (store.persist.hasHydrated()) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const unsubscribe = store.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });
}

export function waitForAllStoresHydrated(): Promise<void> {
  return Promise.all([
    waitOne(usePersonaStore),
    waitOne(useFavoritesStore),
    waitOne(useRecentStore),
    waitOne(useSettingsStore),
  ]).then(() => undefined);
}

/**
 * ADR-052 강제 요구사항 — hydration 영구 미완 latent edge case 차단.
 *
 * zustand persist middleware 는 JSON.parse 가 throw 하면 _hasHydrated 를 true
 * 로 전이시키지 않고 finishHydrationListeners 도 발화하지 않는다. 이 상태에서
 * 부트로더가 await 하면 splash 무한 hang. 본 헬퍼는 timeout 으로 race 를 끊고:
 *   - 미완 store 각각에 setState(INITIAL_STATE) 호출 → persist 가 자동 setItem
 *     트리거하여 손상 entry 가 INITIAL 직렬화로 덮어씌워진다 (ADR-050).
 *   - 정상 hydrated store 는 사용자 데이터 손실 방지 위해 보존.
 *   - dev 빌드는 console.warn. 운영 보고는 v2 이후 별도 ADR.
 *
 * @param timeoutMs 기본 5000ms — 정상 hydration 은 콜드스타트에서도 ~수십ms.
 * @returns 'ok' (정상 완료) | 'timeout' (fallback 적용)
 */
export const DEFAULT_HYDRATION_TIMEOUT_MS = 5000;

export async function waitForStoresOrTimeout(
  timeoutMs: number = DEFAULT_HYDRATION_TIMEOUT_MS,
): Promise<'ok' | 'timeout'> {
  // Promise 생성자는 동기 — timeoutId 는 Promise.race 진입 전에 항상 할당됨.
  let timeoutId!: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<'timeout'>((resolve) => {
    timeoutId = setTimeout(() => resolve('timeout'), timeoutMs);
  });
  const result = await Promise.race([
    waitForAllStoresHydrated().then(() => 'ok' as const),
    timeoutPromise,
  ]);
  clearTimeout(timeoutId);
  if (result === 'timeout') {
    forceInitialOnUnhydratedStores();
    /* istanbul ignore else: __DEV__ 는 jest 환경에서 항상 true — production 분기는 운영 빌드 한정 */
    if (__DEV__) {
      console.warn(
        `[app-shell] store hydration timeout (>=${timeoutMs}ms). INITIAL_STATE fallback applied. ADR-052.`,
      );
    }
  }
  return result;
}

/**
 * hasHydrated() === false 인 store 만 INITIAL_STATE 로 강제. 정상 hydrated 인
 * store 는 사용자 데이터 보존 위해 건드리지 않는다.
 */
function forceInitialOnUnhydratedStores(): void {
  if (!usePersonaStore.persist.hasHydrated()) {
    usePersonaStore.setState(PERSONA_INITIAL);
  }
  if (!useFavoritesStore.persist.hasHydrated()) {
    useFavoritesStore.setState(FAVORITES_INITIAL);
  }
  if (!useRecentStore.persist.hasHydrated()) {
    useRecentStore.setState(RECENT_INITIAL);
  }
  if (!useSettingsStore.persist.hasHydrated()) {
    useSettingsStore.setState(SETTINGS_INITIAL);
  }
}
