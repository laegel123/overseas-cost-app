/**
 * docs/TESTING.md §9.8.6 매트릭스 — useComparePairStore.
 *
 * 카테고리: 기본 동작 / Persist / 손상 캐시 (부분 복구 금지).
 * AsyncStorage 는 jest.setup.js 의 AsyncStorageMock 으로 격리, 시간 의존 0.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { INITIAL_STATE, useComparePairStore } from '../comparePair';
import type { ComparePairState } from '../comparePair';

const PERSIST_KEY = 'comparePair:v1';

beforeEach(async () => {
  await AsyncStorage.clear();
  useComparePairStore.setState(INITIAL_STATE);
  await useComparePairStore.persist.rehydrate();
});

describe('기본 동작', () => {
  it('초기 상태는 두 칸 모두 null', () => {
    expect(useComparePairStore.getState().baseId).toBeNull();
    expect(useComparePairStore.getState().cityId).toBeNull();
  });

  it("setBase('vancouver') → baseId 만 변경", () => {
    useComparePairStore.getState().setBase('vancouver');
    expect(useComparePairStore.getState().baseId).toBe('vancouver');
    expect(useComparePairStore.getState().cityId).toBeNull();
  });

  it("setCity('toronto') → cityId 만 변경", () => {
    useComparePairStore.getState().setCity('toronto');
    expect(useComparePairStore.getState().baseId).toBeNull();
    expect(useComparePairStore.getState().cityId).toBe('toronto');
  });

  it('두 칸을 모두 채우면 둘 다 보관', () => {
    useComparePairStore.getState().setBase('vancouver');
    useComparePairStore.getState().setCity('toronto');
    expect(useComparePairStore.getState()).toMatchObject({
      baseId: 'vancouver',
      cityId: 'toronto',
    });
  });

  it('같은 칸 재선택 → 마지막 값으로 교체', () => {
    useComparePairStore.getState().setBase('vancouver');
    useComparePairStore.getState().setBase('tokyo');
    expect(useComparePairStore.getState().baseId).toBe('tokyo');
  });

  it('도시 목록에 없는 id 도 그대로 보관 (존재 검증은 화면 책임)', () => {
    useComparePairStore.getState().setBase('atlantis');
    expect(useComparePairStore.getState().baseId).toBe('atlantis');
  });

  it('두 칸에 같은 도시도 store 는 막지 않는다 (같은 도시 방지는 화면 규칙)', () => {
    useComparePairStore.getState().setBase('vancouver');
    useComparePairStore.getState().setCity('vancouver');
    expect(useComparePairStore.getState()).toMatchObject({
      baseId: 'vancouver',
      cityId: 'vancouver',
    });
  });
});

describe('Persist', () => {
  it("AsyncStorage 키는 정확히 'comparePair:v1'", async () => {
    useComparePairStore.getState().setBase('vancouver');
    await Promise.resolve();
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    expect(raw).not.toBeNull();
  });

  it('partialize: 액션은 영속화되지 않고 두 칸만 저장', async () => {
    useComparePairStore.getState().setBase('vancouver');
    useComparePairStore.getState().setCity('toronto');
    await Promise.resolve();
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    const parsed = JSON.parse(raw as string) as {
      state: Record<string, unknown>;
      version: number;
    };
    expect(parsed.state).toEqual({ baseId: 'vancouver', cityId: 'toronto' });
    expect(parsed.state.setBase).toBeUndefined();
    expect(parsed.state.setCity).toBeUndefined();
    expect(parsed.version).toBe(1);
  });

  it('round-trip: 저장된 entry → rehydrate 후 같은 두 칸', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { baseId: 'vancouver', cityId: 'toronto' },
        version: 1,
      }),
    );
    expect(useComparePairStore.getState().baseId).toBeNull();

    await useComparePairStore.persist.rehydrate();
    expect(useComparePairStore.getState()).toMatchObject({
      baseId: 'vancouver',
      cityId: 'toronto',
    });
  });

  it('한 칸만 고른 상태 (null 포함) 도 round-trip', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { baseId: 'vancouver', cityId: null },
        version: 1,
      }),
    );

    await useComparePairStore.persist.rehydrate();
    expect(useComparePairStore.getState()).toMatchObject({
      baseId: 'vancouver',
      cityId: null,
    });
  });

  it('구버전 entry (v0) → migrate stub 통과 + 메모리 반영', async () => {
    // migrate 는 v1 only 단계의 placeholder — persistedState 를 그대로
    // 통과시키는지만 확인.
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { baseId: 'vancouver', cityId: 'toronto' },
        version: 0,
      }),
    );

    await useComparePairStore.persist.rehydrate();
    expect(useComparePairStore.getState()).toMatchObject({
      baseId: 'vancouver',
      cityId: 'toronto',
    });
  });
});

describe('손상 캐시 → 초기 상태 (부분 복구 금지)', () => {
  it('잘못된 JSON → 초기 상태 fallback + INITIAL 직렬화로 정리', async () => {
    useComparePairStore.getState().setBase('vancouver');
    await Promise.resolve();
    await AsyncStorage.setItem(PERSIST_KEY, '{not json');

    await useComparePairStore.persist.rehydrate();
    await Promise.resolve();
    await Promise.resolve();

    expect(useComparePairStore.getState()).toMatchObject(INITIAL_STATE);
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as { state: ComparePairState };
    expect(parsed.state).toEqual({ baseId: null, cityId: null });
  });

  it('저장된 state 가 객체 아님 → 초기 상태', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({ state: 42, version: 1 }),
    );

    await useComparePairStore.persist.rehydrate();
    await Promise.resolve();
    await Promise.resolve();

    expect(useComparePairStore.getState()).toMatchObject(INITIAL_STATE);
  });

  it('baseId 가 string|null 아님 (number) → 두 칸 모두 초기화', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { baseId: 42, cityId: 'toronto' },
        version: 1,
      }),
    );

    await useComparePairStore.persist.rehydrate();
    await Promise.resolve();
    await Promise.resolve();

    // 살아남은 'toronto' 를 부분 복구하지 않는다 — 반쯤 깨진 상태는 화면에서
    // 구분할 수 없다.
    expect(useComparePairStore.getState()).toMatchObject(INITIAL_STATE);
  });

  it('cityId 가 string|null 아님 (객체) → 두 칸 모두 초기화', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { baseId: 'vancouver', cityId: { id: 'toronto' } },
        version: 1,
      }),
    );

    await useComparePairStore.persist.rehydrate();
    await Promise.resolve();
    await Promise.resolve();

    expect(useComparePairStore.getState()).toMatchObject(INITIAL_STATE);
  });

  it('필드 누락 → 그 칸은 미선택 (null) 으로 복원', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({ state: { baseId: 'vancouver' }, version: 1 }),
    );

    await useComparePairStore.persist.rehydrate();
    await Promise.resolve();
    await Promise.resolve();

    // merge 가 INITIAL 의 null 로 채우므로 유효한 상태 — 타입 위반이 아니다.
    expect(useComparePairStore.getState()).toMatchObject({
      baseId: 'vancouver',
      cityId: null,
    });
  });
});

describe('Hydration', () => {
  it('rehydrate 후 hasHydrated() === true', async () => {
    await useComparePairStore.persist.rehydrate();
    expect(useComparePairStore.persist.hasHydrated()).toBe(true);
  });
});
