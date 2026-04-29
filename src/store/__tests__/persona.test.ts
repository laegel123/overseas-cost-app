/**
 * docs/TESTING.md §9.5 매트릭스 — usePersonaStore.
 *
 * 카테고리: 기본 동작 / 영속화 / Hydration race / 마이그레이션 / Selector.
 * AsyncStorage 는 jest.setup.js 의 AsyncStorageMock 으로 격리, 시간 의존 0.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { usePersonaStore } from '../persona';
import type { PersonaState } from '../persona';

const PERSIST_KEY = 'persona:v1';

beforeEach(async () => {
  await AsyncStorage.clear();
  // reset() 액션으로 초기화 — replace=true 사용 시 액션 함수까지 제거됨.
  usePersonaStore.getState().reset();
  // hydration 이 한 번 더 일어나도 INITIAL 위에 INITIAL 을 덮어쓰는 noop.
  await usePersonaStore.persist.rehydrate();
});

describe('기본 동작', () => {
  it('초기 상태는 { persona: "unknown", onboarded: false }', () => {
    const state = usePersonaStore.getState();
    expect(state.persona).toBe('unknown');
    expect(state.onboarded).toBe(false);
  });

  it("setPersona('student') → state 변경", () => {
    usePersonaStore.getState().setPersona('student');
    expect(usePersonaStore.getState().persona).toBe('student');
  });

  it("setPersona('worker') → state 변경", () => {
    usePersonaStore.getState().setPersona('worker');
    expect(usePersonaStore.getState().persona).toBe('worker');
  });

  it("setPersona('unknown') → state 변경 (이미 unknown 인 경우도 OK)", () => {
    usePersonaStore.getState().setPersona('student');
    usePersonaStore.getState().setPersona('unknown');
    expect(usePersonaStore.getState().persona).toBe('unknown');
  });

  it('setOnboarded(true) → state 변경', () => {
    usePersonaStore.getState().setOnboarded(true);
    expect(usePersonaStore.getState().onboarded).toBe(true);
  });

  it('reset() → 초기 상태 복귀', () => {
    usePersonaStore.getState().setPersona('worker');
    usePersonaStore.getState().setOnboarded(true);
    usePersonaStore.getState().reset();
    const state = usePersonaStore.getState();
    expect(state.persona).toBe('unknown');
    expect(state.onboarded).toBe(false);
  });
});

describe('영속화', () => {
  it("AsyncStorage 키는 정확히 'persona:v1'", async () => {
    usePersonaStore.getState().setPersona('student');
    // setState 후 persist 가 비동기로 storage 에 write — 한 microtask drain.
    await Promise.resolve();
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    expect(raw).not.toBeNull();
  });

  it('partialize: 액션은 영속화되지 않고 state 만 저장', async () => {
    usePersonaStore.getState().setPersona('worker');
    usePersonaStore.getState().setOnboarded(true);
    await Promise.resolve();
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as {
      state: Record<string, unknown>;
      version: number;
    };
    expect(parsed.state.persona).toBe('worker');
    expect(parsed.state.onboarded).toBe(true);
    // 액션 함수는 직렬화되지 않음
    expect(parsed.state.setPersona).toBeUndefined();
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
        state: { persona: 'student', onboarded: true },
        version: 1,
      }),
    );
    expect(usePersonaStore.getState().persona).toBe('unknown');

    await usePersonaStore.persist.rehydrate();
    expect(usePersonaStore.getState().persona).toBe('student');
    expect(usePersonaStore.getState().onboarded).toBe(true);
  });

  it('손상된 캐시 (잘못된 JSON) → 초기 상태 fallback + INITIAL 직렬화로 정리', async () => {
    // setState 호출이 persist 의 자동 setItem 을 트리거하기 때문에 setItem
    // 호출은 setState 다음에 와야 storage 에 손상 데이터가 살아남음.
    usePersonaStore.getState().setPersona('student');
    usePersonaStore.getState().setOnboarded(true);
    await Promise.resolve();
    await AsyncStorage.setItem(PERSIST_KEY, '{not json');

    await usePersonaStore.persist.rehydrate();
    await Promise.resolve();
    await Promise.resolve();

    expect(usePersonaStore.getState().persona).toBe('unknown');
    expect(usePersonaStore.getState().onboarded).toBe(false);
    // 우리 callback 의 setState(INITIAL_STATE) 가 persist setItem 을 자동 트리거
    // → 손상 데이터가 INITIAL 직렬화로 덮어씌워져 다음 부팅 시 정상 fallback.
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as { state: PersonaState };
    expect(parsed.state.persona).toBe('unknown');
    expect(parsed.state.onboarded).toBe(false);
  });

  it('손상된 캐시 (유효하지 않은 persona literal) → 초기 상태 fallback', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { persona: 'admin', onboarded: true },
        version: 1,
      }),
    );

    await usePersonaStore.persist.rehydrate();
    await Promise.resolve();
    await Promise.resolve();

    expect(usePersonaStore.getState().persona).toBe('unknown');
    expect(usePersonaStore.getState().onboarded).toBe(false);
    // INITIAL 직렬화로 덮어씌워져 다음 부팅 시 'admin' 다시 안 읽음
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as { state: PersonaState };
    expect(parsed.state.persona).toBe('unknown');
  });

  it('손상된 캐시 (onboarded 가 boolean 아님) → 초기 상태 fallback', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { persona: 'student', onboarded: 'yes' },
        version: 1,
      }),
    );

    await usePersonaStore.persist.rehydrate();
    await Promise.resolve();
    await Promise.resolve();

    expect(usePersonaStore.getState().persona).toBe('unknown');
    expect(usePersonaStore.getState().onboarded).toBe(false);
  });
});

describe('Hydration race', () => {
  it('hasHydrated() 가 rehydrate 후 true', async () => {
    await usePersonaStore.persist.rehydrate();
    expect(usePersonaStore.persist.hasHydrated()).toBe(true);
  });

  it('hydration 진행 중 read 는 현재 (이전) state 를 그대로 반환', async () => {
    // rehydrate() 직후 await 없이 getState 호출 — hasHydrated 는 false 일 수 있고,
    // state 는 storage merge 가 적용되기 전이라 직전 setState 그대로.
    usePersonaStore.getState().setPersona('student');
    usePersonaStore.getState().setOnboarded(true);

    // rehydrate 반환은 void | Promise<void> — Promise 로 좁히기 위해 await 로 안전하게.
    const inflight = Promise.resolve(usePersonaStore.persist.rehydrate());
    // 동기적으로 hydration 표시는 false (in-flight)
    expect(usePersonaStore.persist.hasHydrated()).toBe(false);

    // 진행 중 read — storage 에서 읽은 값 (이전에 persist 가 저장한 student/true)
    // 또는 현재 state 그대로. 메모리는 'student'/true 로 일관.
    expect(usePersonaStore.getState().persona).toBe('student');

    await inflight;
    expect(usePersonaStore.persist.hasHydrated()).toBe(true);
  });

  it('onFinishHydration 콜백이 hydration 완료 후 1회 호출', async () => {
    const cb = jest.fn();
    const unsubscribe = usePersonaStore.persist.onFinishHydration(cb);

    await usePersonaStore.persist.rehydrate();

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
        state: { persona: 'worker', onboarded: true },
        version: 1,
      }),
    );

    await usePersonaStore.persist.rehydrate();

    expect(usePersonaStore.getState().persona).toBe('worker');
    expect(usePersonaStore.getState().onboarded).toBe(true);
  });

  it('미래 v0 entry (구버전) 는 migrate stub 으로 통과 — placeholder', async () => {
    // 본 step 의 migrate 는 단순 cast (state) → state.
    // v2 도입 시 본 테스트가 실 변환 검증으로 확장됨 (별도 ADR + 테스트 갱신).
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { persona: 'student', onboarded: false },
        version: 0,
      }),
    );

    await usePersonaStore.persist.rehydrate();

    // migrate stub 이 state 를 그대로 통과시키므로 'student' 가 적용됨
    expect(usePersonaStore.getState().persona).toBe('student');
  });
});

describe('Selector', () => {
  it('selector 결과는 set 호출 없으면 ref equality 유지 (불필요한 리렌더 방지)', () => {
    const personaA = usePersonaStore.getState().persona;
    const personaB = usePersonaStore.getState().persona;
    expect(personaA).toBe(personaB);

    usePersonaStore.getState().setPersona('worker');
    const personaC = usePersonaStore.getState().persona;
    expect(personaC).toBe('worker');
    // primitive string — 동일 값은 항상 ===
    expect(usePersonaStore.getState().persona).toBe(personaC);
  });
});
