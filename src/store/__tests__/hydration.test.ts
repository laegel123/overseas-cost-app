/**
 * docs/TESTING.md §9.4.2 매트릭스 — waitForAllStoresHydrated.
 *
 * 4 store 의 hydration 동시 await — app-shell phase 의 부트로더가 useFonts 와
 * Promise.all 로 합성하기 위한 boundary helper.
 *
 * 자동 hydration 은 모듈 로딩 시점에 시작 — 테스트에서는 jest.spyOn 으로
 * hasHydrated/onFinishHydration 을 mock 하여 controlled subject 로 검증한다.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useFavoritesStore } from '../favorites';
import { waitForAllStoresHydrated } from '../hydration';
import { usePersonaStore } from '../persona';
import { useRecentStore } from '../recent';
import { useSettingsStore } from '../settings';

const ALL_STORES = [usePersonaStore, useFavoritesStore, useRecentStore, useSettingsStore] as const;

beforeEach(async () => {
  await AsyncStorage.clear();
  // 각 store 의 자동 hydration 이 모듈 로딩 시점에 이미 끝났을 가능성. 명시적으로
  // rehydrate 하여 hasHydrated() === true 상태로 정렬.
  for (const store of ALL_STORES) {
    await store.persist.rehydrate();
  }
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('waitForAllStoresHydrated', () => {
  it('모든 store 가 이미 hydrated → 즉시 resolve', async () => {
    for (const store of ALL_STORES) {
      expect(store.persist.hasHydrated()).toBe(true);
    }
    await expect(waitForAllStoresHydrated()).resolves.toBeUndefined();
  });

  it('한 store 만 미완 → 그 store 의 콜백 발화 후 resolve', async () => {
    // persona store 만 미완 상태로 mock — 나머지 3개는 이미 hydrated.
    jest.spyOn(usePersonaStore.persist, 'hasHydrated').mockReturnValue(false);
    let captured: (() => void) | undefined;
    jest.spyOn(usePersonaStore.persist, 'onFinishHydration').mockImplementation((fn) => {
      // fn 은 PersistListener<PersonaState & PersonaActions> — 헬퍼는 state 인자
      // 사용 X 라 getState() 를 채워서 no-arg trigger 로 wrap.
      captured = () => fn(usePersonaStore.getState());
      return () => {};
    });

    let resolved = false;
    const promise = waitForAllStoresHydrated().then(() => {
      resolved = true;
    });

    // microtask drain — 다른 3개 store 의 즉시 resolve 처리 + onFinishHydration 등록
    await Promise.resolve();
    await Promise.resolve();
    expect(resolved).toBe(false);
    expect(captured).toBeDefined();

    captured?.();
    await promise;
    expect(resolved).toBe(true);
  });

  it('4 store 모두 미완 → 모두 완료 후에야 resolve', async () => {
    let personaCb: (() => void) | undefined;
    let favoritesCb: (() => void) | undefined;
    let recentCb: (() => void) | undefined;
    let settingsCb: (() => void) | undefined;

    jest.spyOn(usePersonaStore.persist, 'hasHydrated').mockReturnValue(false);
    jest.spyOn(usePersonaStore.persist, 'onFinishHydration').mockImplementation((fn) => {
      personaCb = () => fn(usePersonaStore.getState());
      return () => {};
    });

    jest.spyOn(useFavoritesStore.persist, 'hasHydrated').mockReturnValue(false);
    jest.spyOn(useFavoritesStore.persist, 'onFinishHydration').mockImplementation((fn) => {
      favoritesCb = () => fn(useFavoritesStore.getState());
      return () => {};
    });

    jest.spyOn(useRecentStore.persist, 'hasHydrated').mockReturnValue(false);
    jest.spyOn(useRecentStore.persist, 'onFinishHydration').mockImplementation((fn) => {
      recentCb = () => fn(useRecentStore.getState());
      return () => {};
    });

    jest.spyOn(useSettingsStore.persist, 'hasHydrated').mockReturnValue(false);
    jest.spyOn(useSettingsStore.persist, 'onFinishHydration').mockImplementation((fn) => {
      settingsCb = () => fn(useSettingsStore.getState());
      return () => {};
    });

    let resolved = false;
    const promise = waitForAllStoresHydrated().then(() => {
      resolved = true;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(resolved).toBe(false);
    expect(personaCb).toBeDefined();
    expect(favoritesCb).toBeDefined();
    expect(recentCb).toBeDefined();
    expect(settingsCb).toBeDefined();

    // 3개 완료 — 아직 resolve 안 됨
    personaCb?.();
    favoritesCb?.();
    recentCb?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(resolved).toBe(false);

    // 4번째 완료 → resolve
    settingsCb?.();
    await promise;
    expect(resolved).toBe(true);
  });

  it('resolve 후 unsubscribe 호출 (콜백 누수 방지)', async () => {
    const unsubMock = jest.fn();
    jest.spyOn(usePersonaStore.persist, 'hasHydrated').mockReturnValue(false);
    let captured: (() => void) | undefined;
    jest.spyOn(usePersonaStore.persist, 'onFinishHydration').mockImplementation((fn) => {
      captured = () => fn(usePersonaStore.getState());
      return unsubMock;
    });

    const promise = waitForAllStoresHydrated();

    await Promise.resolve();
    expect(unsubMock).not.toHaveBeenCalled();

    captured?.();
    await promise;
    expect(unsubMock).toHaveBeenCalledTimes(1);
  });

  it('스키마 위반 캐시 → onRehydrateStorage fallback 후 정상 resolve', async () => {
    // JSON 은 valid 지만 스키마 위반 (cityIds 가 배열 아님) — zustand 의 success
    // 경로로 rehydrate 가 완료되고 onRehydrateStorage 가 error=undefined 로 호출된다.
    // 우리 store 의 isValidPersistedState 검증 실패 → setState(INITIAL_STATE) 적용.
    // 이 시나리오에서 _hasHydrated 는 true 가 되어 본 helper 가 정상 resolve 한다.
    //
    // 주의: JSON parse 자체 실패 (예: '{not json') 는 zustand 의 catch 분기로 가
    // hasHydrated 가 false 로 남는 latent edge case (ADR-052).
    await AsyncStorage.setItem(
      'favorites:v1',
      JSON.stringify({ state: { cityIds: 'not-an-array' }, version: 1 }),
    );
    await useFavoritesStore.persist.rehydrate();
    // onRehydrateStorage 의 setState(INITIAL) 가 microtask 로 적용되도록 drain.
    await Promise.resolve();
    await Promise.resolve();

    expect(useFavoritesStore.persist.hasHydrated()).toBe(true);
    expect(useFavoritesStore.getState().cityIds).toEqual([]);

    await expect(waitForAllStoresHydrated()).resolves.toBeUndefined();
  });
});
