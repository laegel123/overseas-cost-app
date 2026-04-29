/**
 * docs/TESTING.md §9.7 매트릭스 — useRecentStore.
 *
 * 카테고리: 기본 동작 / FIFO·dedupe / Persist / 손상 캐시.
 * AsyncStorage 는 jest.setup.js 의 AsyncStorageMock 으로 격리, 시간 의존 0.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { MAX_RECENT, useRecentStore } from '../recent';
import type { RecentState } from '../recent';

const PERSIST_KEY = 'recent:v1';

beforeEach(async () => {
  await AsyncStorage.clear();
  useRecentStore.getState().clear();
  await useRecentStore.persist.rehydrate();
});

describe('기본 동작', () => {
  it('초기 상태는 cityIds: []', () => {
    expect(useRecentStore.getState().cityIds).toEqual([]);
  });

  it("push('vancouver') → ['vancouver']", () => {
    useRecentStore.getState().push('vancouver');
    expect(useRecentStore.getState().cityIds).toEqual(['vancouver']);
  });

  it("push('toronto') 후 push('vancouver') → ['vancouver', 'toronto'] (최신 [0])", () => {
    useRecentStore.getState().push('toronto');
    useRecentStore.getState().push('vancouver');
    expect(useRecentStore.getState().cityIds).toEqual(['vancouver', 'toronto']);
  });

  it('clear() → 빈 배열', () => {
    useRecentStore.getState().push('vancouver');
    useRecentStore.getState().push('toronto');
    useRecentStore.getState().clear();
    expect(useRecentStore.getState().cityIds).toEqual([]);
  });
});

describe('FIFO · dedupe', () => {
  it('같은 도시 재진입: 기존 위치 제거 후 [0] 으로 — 중복 제거 + 최신화', () => {
    useRecentStore.getState().push('vancouver');
    useRecentStore.getState().push('toronto');
    expect(useRecentStore.getState().cityIds).toEqual(['toronto', 'vancouver']);

    useRecentStore.getState().push('vancouver');
    expect(useRecentStore.getState().cityIds).toEqual(['vancouver', 'toronto']);
    expect(useRecentStore.getState().cityIds.length).toBe(2);
  });

  it('정확히 5개일 때 max 유지', () => {
    useRecentStore.getState().push('a');
    useRecentStore.getState().push('b');
    useRecentStore.getState().push('c');
    useRecentStore.getState().push('d');
    useRecentStore.getState().push('e');
    expect(useRecentStore.getState().cityIds).toEqual(['e', 'd', 'c', 'b', 'a']);
    expect(useRecentStore.getState().cityIds.length).toBe(MAX_RECENT);
  });

  it('5개 push 후 6번째: 가장 오래된 (마지막) 항목 evict', () => {
    useRecentStore.getState().push('a');
    useRecentStore.getState().push('b');
    useRecentStore.getState().push('c');
    useRecentStore.getState().push('d');
    useRecentStore.getState().push('e');
    // 현재: ['e', 'd', 'c', 'b', 'a']

    useRecentStore.getState().push('f');
    // 'a' (마지막, 가장 오래된) evict
    expect(useRecentStore.getState().cityIds).toEqual(['f', 'e', 'd', 'c', 'b']);
    expect(useRecentStore.getState().cityIds.length).toBe(MAX_RECENT);
  });

  it('5개 가득 + 같은 도시 재진입: 길이 5 유지 (evict 없음, 위치만 변경)', () => {
    useRecentStore.getState().push('a');
    useRecentStore.getState().push('b');
    useRecentStore.getState().push('c');
    useRecentStore.getState().push('d');
    useRecentStore.getState().push('e');
    // 현재: ['e', 'd', 'c', 'b', 'a']

    useRecentStore.getState().push('a');
    // 'a' 가 [0] 으로 — 다른 항목은 모두 유지
    expect(useRecentStore.getState().cityIds).toEqual(['a', 'e', 'd', 'c', 'b']);
    expect(useRecentStore.getState().cityIds.length).toBe(MAX_RECENT);
  });
});

describe('Persist', () => {
  it("AsyncStorage 키는 정확히 'recent:v1'", async () => {
    useRecentStore.getState().push('vancouver');
    await Promise.resolve();
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    expect(raw).not.toBeNull();
  });

  it('partialize: 액션은 영속화되지 않고 cityIds 만 저장', async () => {
    useRecentStore.getState().push('vancouver');
    useRecentStore.getState().push('toronto');
    await Promise.resolve();
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    const parsed = JSON.parse(raw as string) as {
      state: Record<string, unknown>;
      version: number;
    };
    expect(parsed.state.cityIds).toEqual(['toronto', 'vancouver']);
    expect(parsed.state.push).toBeUndefined();
    expect(parsed.state.clear).toBeUndefined();
    expect(parsed.version).toBe(1);
  });

  it('round-trip: push → 모듈 reload (rehydrate) 후 같은 배열', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { cityIds: ['vancouver', 'toronto'] },
        version: 1,
      }),
    );
    expect(useRecentStore.getState().cityIds).toEqual([]);

    await useRecentStore.persist.rehydrate();
    expect(useRecentStore.getState().cityIds).toEqual(['vancouver', 'toronto']);
  });

  it('손상된 캐시 (잘못된 JSON) → 초기 상태 fallback + INITIAL 직렬화로 정리', async () => {
    useRecentStore.getState().push('vancouver');
    await Promise.resolve();
    await AsyncStorage.setItem(PERSIST_KEY, '{not json');

    await useRecentStore.persist.rehydrate();
    await Promise.resolve();
    await Promise.resolve();

    expect(useRecentStore.getState().cityIds).toEqual([]);
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as { state: RecentState };
    expect(parsed.state.cityIds).toEqual([]);
  });

  it('손상된 캐시 (cityIds 가 배열 아님) → 초기 상태 fallback', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { cityIds: 'not-an-array' },
        version: 1,
      }),
    );

    await useRecentStore.persist.rehydrate();
    await Promise.resolve();
    await Promise.resolve();

    expect(useRecentStore.getState().cityIds).toEqual([]);
  });

  it('손상된 캐시 (cityIds 원소가 string 아님) → 초기 상태 fallback', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { cityIds: ['vancouver', 42, null] },
        version: 1,
      }),
    );

    await useRecentStore.persist.rehydrate();
    await Promise.resolve();
    await Promise.resolve();

    expect(useRecentStore.getState().cityIds).toEqual([]);
  });
});
