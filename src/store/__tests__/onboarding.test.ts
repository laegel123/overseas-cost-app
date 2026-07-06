/**
 * docs/TESTING.md §9.8.5 매트릭스 — useOnboardingStore (ADR-067).
 *
 * 카테고리: 기본 동작 / 영속화 / Hydration race / 마이그레이션.
 * AsyncStorage 는 jest.setup.js 의 AsyncStorageMock 으로 격리, 시간 의존 0.
 * persona/settings 테스트 구조 미러.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useOnboardingStore } from '../onboarding';
import type { OnboardingState } from '../onboarding';

const PERSIST_KEY = 'onboarding:v1';

beforeEach(async () => {
  await AsyncStorage.clear();
  // reset() 액션으로 초기화 — replace=true 사용 시 액션 함수까지 제거됨.
  useOnboardingStore.getState().reset();
  // hydration 이 한 번 더 일어나도 INITIAL 위에 INITIAL 을 덮어쓰는 noop.
  await useOnboardingStore.persist.rehydrate();
});

describe('기본 동작', () => {
  it('초기 상태는 { onboarded: false }', () => {
    expect(useOnboardingStore.getState().onboarded).toBe(false);
  });

  it('setOnboarded(true) → state 변경', () => {
    useOnboardingStore.getState().setOnboarded(true);
    expect(useOnboardingStore.getState().onboarded).toBe(true);
  });

  it('setOnboarded(false) → state 변경', () => {
    useOnboardingStore.getState().setOnboarded(true);
    useOnboardingStore.getState().setOnboarded(false);
    expect(useOnboardingStore.getState().onboarded).toBe(false);
  });

  it('reset() → 초기 상태 복귀', () => {
    useOnboardingStore.getState().setOnboarded(true);
    useOnboardingStore.getState().reset();
    expect(useOnboardingStore.getState().onboarded).toBe(false);
  });
});

describe('영속화', () => {
  it("AsyncStorage 키는 정확히 'onboarding:v1'", async () => {
    useOnboardingStore.getState().setOnboarded(true);
    // setState 후 persist 가 비동기로 storage 에 write — 한 microtask drain.
    await Promise.resolve();
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    expect(raw).not.toBeNull();
  });

  it('partialize: 액션은 영속화되지 않고 onboarded 만 저장', async () => {
    useOnboardingStore.getState().setOnboarded(true);
    await Promise.resolve();
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as {
      state: Record<string, unknown>;
      version: number;
    };
    expect(parsed.state.onboarded).toBe(true);
    // 액션 함수는 직렬화되지 않음
    expect(parsed.state.setOnboarded).toBeUndefined();
    expect(parsed.state.reset).toBeUndefined();
    expect(parsed.version).toBe(1);
  });

  it('round-trip: storage 에 박힌 v1 entry → rehydrate 후 메모리 반영', async () => {
    // setState 계열 호출은 persist middleware 가 자동으로 storage 를 덮어써서
    // round-trip 검증이 어려움 — storage 에 직접 v1 entry 를 박고 rehydrate.
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { onboarded: true },
        version: 1,
      }),
    );
    expect(useOnboardingStore.getState().onboarded).toBe(false);

    await useOnboardingStore.persist.rehydrate();
    expect(useOnboardingStore.getState().onboarded).toBe(true);
  });

  it('손상된 캐시 (잘못된 JSON) → 초기 상태 fallback + INITIAL 직렬화로 정리', async () => {
    // setState 호출이 persist 의 자동 setItem 을 트리거하기 때문에 setItem
    // 호출은 setState 다음에 와야 storage 에 손상 데이터가 살아남음.
    useOnboardingStore.getState().setOnboarded(true);
    await Promise.resolve();
    await AsyncStorage.setItem(PERSIST_KEY, '{not json');

    await useOnboardingStore.persist.rehydrate();
    await Promise.resolve();
    await Promise.resolve();

    expect(useOnboardingStore.getState().onboarded).toBe(false);
    // 우리 callback 의 setState(INITIAL_STATE) 가 persist setItem 을 자동 트리거
    // → 손상 데이터가 INITIAL 직렬화로 덮어씌워져 다음 부팅 시 정상 fallback.
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as { state: OnboardingState };
    expect(parsed.state.onboarded).toBe(false);
  });

  it('손상된 캐시 (onboarded 가 boolean 아님) → 초기 상태 fallback', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { onboarded: 'yes' },
        version: 1,
      }),
    );

    await useOnboardingStore.persist.rehydrate();
    await Promise.resolve();
    await Promise.resolve();

    expect(useOnboardingStore.getState().onboarded).toBe(false);
    // INITIAL 직렬화로 덮어씌워져 다음 부팅 시 'yes' 다시 안 읽음
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as { state: OnboardingState };
    expect(parsed.state.onboarded).toBe(false);
  });

  it('손상된 캐시 (onboarded 누락) → 초기 상태 fallback', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: {},
        version: 1,
      }),
    );

    await useOnboardingStore.persist.rehydrate();
    await Promise.resolve();
    await Promise.resolve();

    expect(useOnboardingStore.getState().onboarded).toBe(false);
  });
});

describe('Hydration race', () => {
  it('hasHydrated() 가 rehydrate 후 true', async () => {
    await useOnboardingStore.persist.rehydrate();
    expect(useOnboardingStore.persist.hasHydrated()).toBe(true);
  });

  it('hydration 진행 중 read 는 직전 setState 결과를 일관되게 반영', async () => {
    // rehydrate 가 동기 (AsyncStorageMock) 든 비동기 (실 디바이스) 든 무관하게,
    // 호출 직전 setState 한 메모리 값이 rehydrate 도중·후 일관되게 보인다.
    useOnboardingStore.getState().setOnboarded(true);

    const inflight = Promise.resolve(useOnboardingStore.persist.rehydrate());

    // 진행 중 read — storage merge 가 적용되기 전에는 직전 setState 그대로
    expect(useOnboardingStore.getState().onboarded).toBe(true);

    await inflight;
    expect(useOnboardingStore.persist.hasHydrated()).toBe(true);
  });

  it('onFinishHydration 콜백이 hydration 완료 후 1회 호출', async () => {
    const cb = jest.fn();
    const unsubscribe = useOnboardingStore.persist.onFinishHydration(cb);

    await useOnboardingStore.persist.rehydrate();

    expect(cb).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});

describe('마이그레이션', () => {
  it('v1 entry 는 migrate 함수에 진입하지 않음 (version 일치)', async () => {
    // version 일치 시 zustand 는 migrate 호출 안 함 (소스: persist.js).
    // storage 에 v1 entry 가 있을 때 rehydrate 가 정상 동작하는지만 확인.
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { onboarded: true },
        version: 1,
      }),
    );

    await useOnboardingStore.persist.rehydrate();

    expect(useOnboardingStore.getState().onboarded).toBe(true);
  });

  it('미래 v0 entry (구버전) 는 migrate stub 으로 통과 — placeholder', async () => {
    // 본 step 의 migrate 는 단순 cast (state) → state.
    // v2 도입 시 본 테스트가 실 변환 검증으로 확장됨 (별도 ADR + 테스트 갱신).
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { onboarded: true },
        version: 0,
      }),
    );

    await useOnboardingStore.persist.rehydrate();

    // migrate stub 이 state 를 그대로 통과시키므로 true 가 적용됨
    expect(useOnboardingStore.getState().onboarded).toBe(true);
  });
});
