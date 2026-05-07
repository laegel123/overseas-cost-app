/**
 * docs/TESTING.md §9.4.2 매트릭스 — waitForAllStoresHydrated.
 *
 * 8 store 의 hydration 동시 await — app-shell phase 의 부트로더가 useFonts 와
 * Promise.all 로 합성하기 위한 boundary helper.
 *
 * 자동 hydration 은 모듈 로딩 시점에 시작 — 테스트에서는 jest.spyOn 으로
 * hasHydrated/onFinishHydration 을 mock 하여 controlled subject 로 검증한다.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  INITIAL_STATE as CATEGORY_INCLUSION_INITIAL,
  useCategoryInclusionStore,
} from '../categoryInclusion';
import { INITIAL_STATE as FAVORITES_INITIAL, useFavoritesStore } from '../favorites';
import {
  DEFAULT_HYDRATION_TIMEOUT_MS,
  waitForAllStoresHydrated,
  waitForStoresOrTimeout,
} from '../hydration';
import { INITIAL_STATE as PERSONA_INITIAL, usePersonaStore } from '../persona';
import { INITIAL_STATE as RECENT_INITIAL, useRecentStore } from '../recent';
import {
  INITIAL_STATE as RENT_CHOICE_INITIAL,
  useRentChoiceStore,
} from '../rentChoice';
import { INITIAL_STATE as SETTINGS_INITIAL, useSettingsStore } from '../settings';
import {
  INITIAL_STATE as TAX_CHOICE_INITIAL,
  useTaxChoiceStore,
} from '../taxChoice';
import {
  INITIAL_STATE as TUITION_CHOICE_INITIAL,
  useTuitionChoiceStore,
} from '../tuitionChoice';

const ALL_STORES = [
  usePersonaStore,
  useFavoritesStore,
  useRecentStore,
  useSettingsStore,
  useRentChoiceStore,
  useTuitionChoiceStore,
  useTaxChoiceStore,
  useCategoryInclusionStore,
] as const;

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

  it('8 store 모두 미완 → 모두 완료 후에야 resolve', async () => {
    let personaCb: (() => void) | undefined;
    let favoritesCb: (() => void) | undefined;
    let recentCb: (() => void) | undefined;
    let settingsCb: (() => void) | undefined;
    let rentCb: (() => void) | undefined;
    let tuitionCb: (() => void) | undefined;
    let taxCb: (() => void) | undefined;
    let inclusionCb: (() => void) | undefined;

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

    jest.spyOn(useRentChoiceStore.persist, 'hasHydrated').mockReturnValue(false);
    jest.spyOn(useRentChoiceStore.persist, 'onFinishHydration').mockImplementation((fn) => {
      rentCb = () => fn(useRentChoiceStore.getState());
      return () => {};
    });

    jest.spyOn(useTuitionChoiceStore.persist, 'hasHydrated').mockReturnValue(false);
    jest.spyOn(useTuitionChoiceStore.persist, 'onFinishHydration').mockImplementation((fn) => {
      tuitionCb = () => fn(useTuitionChoiceStore.getState());
      return () => {};
    });

    jest.spyOn(useTaxChoiceStore.persist, 'hasHydrated').mockReturnValue(false);
    jest.spyOn(useTaxChoiceStore.persist, 'onFinishHydration').mockImplementation((fn) => {
      taxCb = () => fn(useTaxChoiceStore.getState());
      return () => {};
    });

    jest
      .spyOn(useCategoryInclusionStore.persist, 'hasHydrated')
      .mockReturnValue(false);
    jest
      .spyOn(useCategoryInclusionStore.persist, 'onFinishHydration')
      .mockImplementation((fn) => {
        inclusionCb = () => fn(useCategoryInclusionStore.getState());
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
    expect(rentCb).toBeDefined();
    expect(tuitionCb).toBeDefined();
    expect(taxCb).toBeDefined();
    expect(inclusionCb).toBeDefined();

    // 7개 완료 — 아직 resolve 안 됨
    personaCb?.();
    favoritesCb?.();
    recentCb?.();
    settingsCb?.();
    rentCb?.();
    tuitionCb?.();
    taxCb?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(resolved).toBe(false);

    // 8번째 완료 → resolve
    inclusionCb?.();
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

  it('DEFAULT_HYDRATION_TIMEOUT_MS 는 ADR-052 의 3~5초 범위', () => {
    expect(DEFAULT_HYDRATION_TIMEOUT_MS).toBeGreaterThanOrEqual(3000);
    expect(DEFAULT_HYDRATION_TIMEOUT_MS).toBeLessThanOrEqual(5000);
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

describe('waitForStoresOrTimeout (ADR-052 timeout guard)', () => {
  let warnSpy: jest.SpyInstance;
  let setStateSpies: jest.SpyInstance[];

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    setStateSpies = [
      jest.spyOn(usePersonaStore, 'setState'),
      jest.spyOn(useFavoritesStore, 'setState'),
      jest.spyOn(useRecentStore, 'setState'),
      jest.spyOn(useSettingsStore, 'setState'),
      jest.spyOn(useRentChoiceStore, 'setState'),
      jest.spyOn(useTuitionChoiceStore, 'setState'),
      jest.spyOn(useTaxChoiceStore, 'setState'),
      jest.spyOn(useCategoryInclusionStore, 'setState'),
    ];
  });

  afterEach(() => {
    warnSpy.mockRestore();
    setStateSpies.forEach((s) => s.mockRestore());
  });

  it('모든 store hydrated → ok, setState fallback 호출 없음', async () => {
    const result = await waitForStoresOrTimeout(100);
    expect(result).toBe('ok');
    setStateSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('한 store 만 미완 + timeout → timeout, 그 store 만 INITIAL_STATE 강제', async () => {
    // persona 만 영구 미완 — onFinishHydration 콜백을 절대 발화하지 않음.
    jest.spyOn(usePersonaStore.persist, 'hasHydrated').mockReturnValue(false);
    jest
      .spyOn(usePersonaStore.persist, 'onFinishHydration')
      .mockImplementation(() => () => {});

    const promise = waitForStoresOrTimeout(100);
    await jest.advanceTimersByTimeAsync(150);
    const result = await promise;

    expect(result).toBe('timeout');
    const personaSpy = setStateSpies[0];
    expect(personaSpy).toHaveBeenCalledTimes(1);
    expect(personaSpy).toHaveBeenCalledWith(PERSONA_INITIAL);
    setStateSpies.slice(1).forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });

  it('8 store 모두 미완 + timeout → 8 store 모두 INITIAL_STATE 강제', async () => {
    [
      usePersonaStore,
      useFavoritesStore,
      useRecentStore,
      useSettingsStore,
      useRentChoiceStore,
      useTuitionChoiceStore,
      useTaxChoiceStore,
      useCategoryInclusionStore,
    ].forEach((store) => {
      jest.spyOn(store.persist, 'hasHydrated').mockReturnValue(false);
      jest
        .spyOn(store.persist, 'onFinishHydration')
        .mockImplementation(() => () => {});
    });

    const promise = waitForStoresOrTimeout(100);
    await jest.advanceTimersByTimeAsync(150);
    const result = await promise;

    expect(result).toBe('timeout');
    expect(setStateSpies[0]).toHaveBeenCalledWith(PERSONA_INITIAL);
    expect(setStateSpies[1]).toHaveBeenCalledWith(FAVORITES_INITIAL);
    expect(setStateSpies[2]).toHaveBeenCalledWith(RECENT_INITIAL);
    expect(setStateSpies[3]).toHaveBeenCalledWith(SETTINGS_INITIAL);
    expect(setStateSpies[4]).toHaveBeenCalledWith(RENT_CHOICE_INITIAL);
    expect(setStateSpies[5]).toHaveBeenCalledWith(TUITION_CHOICE_INITIAL);
    expect(setStateSpies[6]).toHaveBeenCalledWith(TAX_CHOICE_INITIAL);
    expect(setStateSpies[7]).toHaveBeenCalledWith(CATEGORY_INCLUSION_INITIAL);
  });

  it('timeout 만료 후에도 정상 hydrated store 는 fallback 에서 보존', async () => {
    // persona 만 미완. 다른 3개는 정상 hydrated 상태로 두고 timeout 만료시켜
    // forceInitial 가 그 3개는 건드리지 않는지 검증.
    jest.spyOn(usePersonaStore.persist, 'hasHydrated').mockReturnValue(false);
    jest
      .spyOn(usePersonaStore.persist, 'onFinishHydration')
      .mockImplementation(() => () => {});

    const promise = waitForStoresOrTimeout(100);
    await jest.advanceTimersByTimeAsync(150);
    await promise;

    // favorites/recent/settings 는 hasHydrated() === true 여서 setState 미호출.
    expect(setStateSpies[1]).not.toHaveBeenCalled();
    expect(setStateSpies[2]).not.toHaveBeenCalled();
    expect(setStateSpies[3]).not.toHaveBeenCalled();
  });

  it('timeout 만료 시 dev 빌드 콘솔 warn 1회 (ADR-052 참조 문구)', async () => {
    jest.spyOn(usePersonaStore.persist, 'hasHydrated').mockReturnValue(false);
    jest
      .spyOn(usePersonaStore.persist, 'onFinishHydration')
      .mockImplementation(() => () => {});

    const promise = waitForStoresOrTimeout(100);
    await jest.advanceTimersByTimeAsync(150);
    await promise;

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('ADR-052');
    expect(warnSpy.mock.calls[0][0]).toContain('100ms');
  });

  it('forceInitial — favorites/settings 만 미완 + persona/recent 보존', async () => {
    // forceInitialOnUnhydratedStores 의 4 store 분기 모두 (true + false) 를 cover.
    // 앞 테스트에서 persona/recent 의 false 분기가 안 잡혀 branch coverage 부족.
    [useFavoritesStore, useSettingsStore].forEach((store) => {
      jest.spyOn(store.persist, 'hasHydrated').mockReturnValue(false);
      jest
        .spyOn(store.persist, 'onFinishHydration')
        .mockImplementation(() => () => {});
    });

    const promise = waitForStoresOrTimeout(100);
    await jest.advanceTimersByTimeAsync(150);
    await promise;

    expect(setStateSpies[0]).not.toHaveBeenCalled(); // persona — 보존
    expect(setStateSpies[1]).toHaveBeenCalledWith(FAVORITES_INITIAL); // favorites — fallback
    expect(setStateSpies[2]).not.toHaveBeenCalled(); // recent — 보존
    expect(setStateSpies[3]).toHaveBeenCalledWith(SETTINGS_INITIAL); // settings — fallback
  });

  it('default timeout (인자 미제공) → DEFAULT_HYDRATION_TIMEOUT_MS 적용', async () => {
    [
      usePersonaStore,
      useFavoritesStore,
      useRecentStore,
      useSettingsStore,
      useRentChoiceStore,
      useTuitionChoiceStore,
      useTaxChoiceStore,
      useCategoryInclusionStore,
    ].forEach((store) => {
      jest.spyOn(store.persist, 'hasHydrated').mockReturnValue(false);
      jest
        .spyOn(store.persist, 'onFinishHydration')
        .mockImplementation(() => () => {});
    });

    const promise = waitForStoresOrTimeout();
    await jest.advanceTimersByTimeAsync(DEFAULT_HYDRATION_TIMEOUT_MS + 10);
    await expect(promise).resolves.toBe('timeout');
  });

  it('정상 완료가 timeout 보다 먼저 → ok, setState fallback 호출 없음 + warn 없음', async () => {
    let captured: (() => void) | undefined;
    jest.spyOn(usePersonaStore.persist, 'hasHydrated').mockReturnValue(false);
    jest.spyOn(usePersonaStore.persist, 'onFinishHydration').mockImplementation((fn) => {
      captured = () => fn(usePersonaStore.getState());
      return () => {};
    });

    const promise = waitForStoresOrTimeout(1000);
    // microtask drain — onFinishHydration 등록까지
    await Promise.resolve();
    await Promise.resolve();
    captured?.();
    // timeout 만료 전에 정상 resolve 도달
    await jest.advanceTimersByTimeAsync(50);
    const result = await promise;

    expect(result).toBe('ok');
    setStateSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
