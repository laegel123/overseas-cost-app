/**
 * docs/TESTING.md §9.6 매트릭스 — useFavoritesStore.
 *
 * 카테고리: 기본 / 상한·정책 / Bulk / Persist / toggle·atomic.
 * AsyncStorage 는 jest.setup.js 의 AsyncStorageMock 으로 격리, 시간 의존 0.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { MAX_FAVORITES, useFavoritesStore } from '../favorites';
import type { FavoritesState } from '../favorites';

const PERSIST_KEY = 'favorites:v1';

beforeEach(async () => {
  await AsyncStorage.clear();
  useFavoritesStore.getState().clear();
  await useFavoritesStore.persist.rehydrate();
});

describe('기본 동작', () => {
  it('초기 상태는 cityIds: []', () => {
    expect(useFavoritesStore.getState().cityIds).toEqual([]);
  });

  it("add('vancouver') → ['vancouver'] + { ok: true }", () => {
    const result = useFavoritesStore.getState().add('vancouver');
    expect(result).toEqual({ ok: true });
    expect(useFavoritesStore.getState().cityIds).toEqual(['vancouver']);
  });

  it('동일 도시 add 두 번: 중복 제거, 길이 1 유지, 두 번째도 { ok: true } (idempotent)', () => {
    const r1 = useFavoritesStore.getState().add('vancouver');
    const r2 = useFavoritesStore.getState().add('vancouver');
    expect(r1).toEqual({ ok: true });
    expect(r2).toEqual({ ok: true });
    expect(useFavoritesStore.getState().cityIds).toEqual(['vancouver']);
  });

  it("add('toronto') 후 ['vancouver', 'toronto'] (추가 순서)", () => {
    useFavoritesStore.getState().add('vancouver');
    useFavoritesStore.getState().add('toronto');
    expect(useFavoritesStore.getState().cityIds).toEqual(['vancouver', 'toronto']);
  });

  it("remove('vancouver') → ['toronto']", () => {
    useFavoritesStore.getState().add('vancouver');
    useFavoritesStore.getState().add('toronto');
    useFavoritesStore.getState().remove('vancouver');
    expect(useFavoritesStore.getState().cityIds).toEqual(['toronto']);
  });

  it('존재하지 않는 도시 remove → 에러 없이 무시', () => {
    useFavoritesStore.getState().add('toronto');
    expect(() => useFavoritesStore.getState().remove('nonexistent')).not.toThrow();
    expect(useFavoritesStore.getState().cityIds).toEqual(['toronto']);
  });

  it("has('toronto') → true", () => {
    useFavoritesStore.getState().add('toronto');
    expect(useFavoritesStore.getState().has('toronto')).toBe(true);
  });

  it("has('paris') → false", () => {
    expect(useFavoritesStore.getState().has('paris')).toBe(false);
  });

  it('clear() → []', () => {
    useFavoritesStore.getState().add('vancouver');
    useFavoritesStore.getState().add('toronto');
    useFavoritesStore.getState().clear();
    expect(useFavoritesStore.getState().cityIds).toEqual([]);
  });
});

describe('상한·정책', () => {
  it('50개 도달 후 51번째 add → { ok: false, reason: "limit" }, state 변경 없음', () => {
    const ids = Array.from({ length: MAX_FAVORITES }, (_, i) => `city-${i}`);
    const r = useFavoritesStore.getState().addMany(ids);
    expect(r).toEqual({ ok: true });
    expect(useFavoritesStore.getState().cityIds.length).toBe(50);

    const before = useFavoritesStore.getState().cityIds;
    const result = useFavoritesStore.getState().add('city-overflow');
    expect(result).toEqual({ ok: false, reason: 'limit' });
    expect(useFavoritesStore.getState().cityIds).toBe(before);
    expect(useFavoritesStore.getState().cityIds.length).toBe(50);
  });

  it('49개 + add 1 → 50, OK', () => {
    const ids = Array.from({ length: 49 }, (_, i) => `city-${i}`);
    useFavoritesStore.getState().addMany(ids);
    expect(useFavoritesStore.getState().cityIds.length).toBe(49);

    const result = useFavoritesStore.getState().add('city-49');
    expect(result).toEqual({ ok: true });
    expect(useFavoritesStore.getState().cityIds.length).toBe(50);
  });

  it('50개 + remove 1 + add 1 → 50, OK', () => {
    const ids = Array.from({ length: MAX_FAVORITES }, (_, i) => `city-${i}`);
    useFavoritesStore.getState().addMany(ids);
    expect(useFavoritesStore.getState().cityIds.length).toBe(50);

    useFavoritesStore.getState().remove('city-0');
    expect(useFavoritesStore.getState().cityIds.length).toBe(49);

    const result = useFavoritesStore.getState().add('new-city');
    expect(result).toEqual({ ok: true });
    expect(useFavoritesStore.getState().cityIds.length).toBe(50);
  });
});

describe('Bulk', () => {
  it("addMany(['v', 't']) → 순서 보존, 중복 제거, { ok: true }", () => {
    const result = useFavoritesStore.getState().addMany(['vancouver', 'toronto', 'vancouver']);
    expect(result).toEqual({ ok: true });
    expect(useFavoritesStore.getState().cityIds).toEqual(['vancouver', 'toronto']);
  });

  it("removeMany(['v']) → 일부만 제거", () => {
    useFavoritesStore.getState().addMany(['vancouver', 'toronto', 'paris']);
    useFavoritesStore.getState().removeMany(['vancouver']);
    expect(useFavoritesStore.getState().cityIds).toEqual(['toronto', 'paris']);
  });
});

describe('Persist', () => {
  it("AsyncStorage 키는 정확히 'favorites:v1'", async () => {
    useFavoritesStore.getState().add('vancouver');
    await Promise.resolve();
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    expect(raw).not.toBeNull();
  });

  it('partialize: 액션은 영속화되지 않고 cityIds 만 저장', async () => {
    useFavoritesStore.getState().add('vancouver');
    useFavoritesStore.getState().add('toronto');
    await Promise.resolve();
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    const parsed = JSON.parse(raw as string) as {
      state: Record<string, unknown>;
      version: number;
    };
    expect(parsed.state.cityIds).toEqual(['vancouver', 'toronto']);
    expect(parsed.state.add).toBeUndefined();
    expect(parsed.state.addMany).toBeUndefined();
    expect(parsed.state.remove).toBeUndefined();
    expect(parsed.state.toggle).toBeUndefined();
    expect(parsed.state.clear).toBeUndefined();
    expect(parsed.version).toBe(1);
  });

  it('round-trip: storage v1 entry → rehydrate 후 메모리 반영 (add → reload)', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { cityIds: ['vancouver', 'toronto'] },
        version: 1,
      }),
    );
    expect(useFavoritesStore.getState().cityIds).toEqual([]);

    await useFavoritesStore.persist.rehydrate();
    expect(useFavoritesStore.getState().cityIds).toEqual(['vancouver', 'toronto']);
  });

  it('round-trip: remove → reload 후 갱신 반영', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { cityIds: ['vancouver', 'toronto'] },
        version: 1,
      }),
    );
    await useFavoritesStore.persist.rehydrate();
    useFavoritesStore.getState().remove('vancouver');
    await Promise.resolve();

    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    const parsed = JSON.parse(raw as string) as { state: FavoritesState };
    expect(parsed.state.cityIds).toEqual(['toronto']);
  });

  it('손상된 캐시 (잘못된 JSON) → 초기 상태 fallback + INITIAL 직렬화로 정리', async () => {
    useFavoritesStore.getState().add('vancouver');
    await Promise.resolve();
    await AsyncStorage.setItem(PERSIST_KEY, '{not json');

    await useFavoritesStore.persist.rehydrate();
    await Promise.resolve();
    await Promise.resolve();

    expect(useFavoritesStore.getState().cityIds).toEqual([]);
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as { state: FavoritesState };
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

    await useFavoritesStore.persist.rehydrate();
    await Promise.resolve();
    await Promise.resolve();

    expect(useFavoritesStore.getState().cityIds).toEqual([]);
  });

  it('손상된 캐시 (cityIds 원소가 string 아님) → 초기 상태 fallback', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { cityIds: ['vancouver', 42, null] },
        version: 1,
      }),
    );

    await useFavoritesStore.persist.rehydrate();
    await Promise.resolve();
    await Promise.resolve();

    expect(useFavoritesStore.getState().cityIds).toEqual([]);
  });
});

describe('toggle / atomic addMany', () => {
  it("toggle('vancouver') 두 번 → 결과 []", () => {
    const r1 = useFavoritesStore.getState().toggle('vancouver');
    expect(r1).toEqual({ ok: true });
    expect(useFavoritesStore.getState().cityIds).toEqual(['vancouver']);

    const r2 = useFavoritesStore.getState().toggle('vancouver');
    expect(r2).toEqual({ ok: true });
    expect(useFavoritesStore.getState().cityIds).toEqual([]);
  });

  it("toggle 이 limit 도달 시 add 분기에서 { ok: false, reason: 'limit' }", () => {
    const ids = Array.from({ length: MAX_FAVORITES }, (_, i) => `city-${i}`);
    useFavoritesStore.getState().addMany(ids);

    const before = useFavoritesStore.getState().cityIds;
    const result = useFavoritesStore.getState().toggle('overflow');
    expect(result).toEqual({ ok: false, reason: 'limit' });
    expect(useFavoritesStore.getState().cityIds).toBe(before);
  });

  it('addMany atomic: limit 위반 시 부분 추가 안 함 (state 그대로)', () => {
    const ids49 = Array.from({ length: 49 }, (_, i) => `city-${i}`);
    useFavoritesStore.getState().addMany(ids49);
    expect(useFavoritesStore.getState().cityIds.length).toBe(49);

    const before = useFavoritesStore.getState().cityIds;
    // 49 + 2 = 51 → limit 위반 → 둘 다 추가 안 됨
    const result = useFavoritesStore.getState().addMany(['extra-1', 'extra-2']);
    expect(result).toEqual({ ok: false, reason: 'limit' });
    expect(useFavoritesStore.getState().cityIds).toBe(before);
    expect(useFavoritesStore.getState().cityIds.length).toBe(49);
  });
});
