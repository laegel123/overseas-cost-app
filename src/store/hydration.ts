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

import { useFavoritesStore } from './favorites';
import { usePersonaStore } from './persona';
import { useRecentStore } from './recent';
import { useSettingsStore } from './settings';

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
