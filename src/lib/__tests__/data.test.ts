/**
 * docs/TESTING.md §9.4 매트릭스 — loadAllCities / getCity / getAllCities / refreshCache.
 *
 * 시간은 jest.setSystemTime, 네트워크는 mockFetchSequence, AsyncStorage 는
 * jest.setup.js 의 AsyncStorageMock 으로 격리. flaky 0건 정책 (TESTING §1).
 *
 * 시드 fallback 테스트는 fetch 를 모두 실패시켜 자연스럽게 시드 로드 경로 검증.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { mockFetchSequence } from '@/__test-utils__/mockFetchSequence';

import seedJson from '../../../data/seed/all.json';
import {
  __resetForTesting,
  getAllCities,
  getCity,
  getLastSync,
  loadAllCities,
  refreshCache,
} from '../data';

const CACHE_KEY = 'data:all:v1';
const META_KEY = 'meta:lastSync';

// ─── helpers ────────────────────────────────────────────────────────────────

function buildBatch(cities: Record<string, unknown>): Record<string, unknown> {
  return {
    schemaVersion: 1,
    generatedAt: '2026-04-29T00:00:00+09:00',
    fxBaseDate: '2026-04-01',
    cities,
  };
}

/**
 * 시드 데이터에서 한 도시를 가져와 ID 만 바꿔 새 도시처럼 흉내낸다.
 * 시드는 schema 통과 보장 — 무작위 가짜 도시 만드느니 시드 변형이 안전.
 */
function makeFakeCity(id: string): Record<string, unknown> {
  const base = JSON.parse(JSON.stringify(seedJson.cities.vancouver)) as {
    id: string;
    name: { ko: string; en: string };
  };
  base.id = id;
  base.name = { ko: id, en: id };
  return base;
}

async function seedCache(
  data: Record<string, unknown>,
  fetchedAt: number,
): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data, fetchedAt }));
  await AsyncStorage.setItem(META_KEY, new Date(fetchedAt).toISOString());
}

// ─── beforeEach / afterEach ─────────────────────────────────────────────────

beforeEach(async () => {
  __resetForTesting();
  await AsyncStorage.clear();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-04-29T00:00:00.000Z'));
});

afterEach(() => {
  jest.restoreAllMocks();
  __resetForTesting();
});

// ─── loadAllCities — 캐시 동작 ──────────────────────────────────────────────

describe('loadAllCities — 캐시', () => {
  it('cache hit (24h 이내): 네트워크 호출 없음', async () => {
    const data = buildBatch({ tokyo: makeFakeCity('tokyo') });
    const t0 = new Date('2026-04-29T00:00:00.000Z').getTime();
    await seedCache(data, t0);

    jest.setSystemTime(new Date(t0 + 12 * 60 * 60 * 1000)); // 12h 후
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    const cities = await loadAllCities();
    expect(Object.keys(cities)).toEqual(['tokyo']);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('23h 59m 59.999s — 여전히 hit', async () => {
    const data = buildBatch({ tokyo: makeFakeCity('tokyo') });
    const t0 = new Date('2026-04-29T00:00:00.000Z').getTime();
    await seedCache(data, t0);

    jest.setSystemTime(new Date(t0 + 24 * 60 * 60 * 1000 - 1));
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    await loadAllCities();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('24h 정각 — 만료 → refetch', async () => {
    const oldData = buildBatch({ old: makeFakeCity('old') });
    const newData = buildBatch({ fresh: makeFakeCity('fresh') });
    const t0 = new Date('2026-04-29T00:00:00.000Z').getTime();
    await seedCache(oldData, t0);

    jest.setSystemTime(new Date(t0 + 24 * 60 * 60 * 1000));
    mockFetchSequence([{ ok: true, status: 200, body: newData }]);

    const cities = await loadAllCities();
    expect(Object.keys(cities)).toEqual(['fresh']);
  });

  it('bypassCache=true → 캐시 무시하고 fetch', async () => {
    const oldData = buildBatch({ old: makeFakeCity('old') });
    const newData = buildBatch({ fresh: makeFakeCity('fresh') });
    const t0 = new Date('2026-04-29T00:00:00.000Z').getTime();
    await seedCache(oldData, t0);

    // 1시간 후 (캐시 fresh) — 강제 refetch
    jest.setSystemTime(new Date(t0 + 60 * 60 * 1000));
    mockFetchSequence([{ ok: true, status: 200, body: newData }]);

    const cities = await loadAllCities({ bypassCache: true });
    expect(Object.keys(cities)).toEqual(['fresh']);
  });

  it('cache miss → primary fetch + 저장', async () => {
    const data = buildBatch({ tokyo: makeFakeCity('tokyo') });
    mockFetchSequence([{ ok: true, status: 200, body: data }]);

    await loadAllCities();

    const stored = await AsyncStorage.getItem(CACHE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored as string) as { fetchedAt: number };
    expect(parsed.fetchedAt).toBe(new Date('2026-04-29T00:00:00.000Z').getTime());

    const lastSync = await AsyncStorage.getItem(META_KEY);
    expect(lastSync).toBe('2026-04-29T00:00:00.000Z');
  });

  it('손상된 캐시 (잘못된 JSON) → 자동 정리 + miss 처리', async () => {
    await AsyncStorage.setItem(CACHE_KEY, '{not valid');
    const data = buildBatch({ tokyo: makeFakeCity('tokyo') });
    mockFetchSequence([{ ok: true, status: 200, body: data }]);

    await loadAllCities();

    // 새 캐시로 갱신
    const after = await AsyncStorage.getItem(CACHE_KEY);
    expect(after).not.toBeNull();
    expect(after).not.toBe('{not valid');
  });

  it('손상된 캐시 (cached entry 자체가 array) → 자동 정리', async () => {
    await AsyncStorage.setItem(CACHE_KEY, '[1, 2, 3]');
    const data = buildBatch({ tokyo: makeFakeCity('tokyo') });
    mockFetchSequence([{ ok: true, status: 200, body: data }]);

    await loadAllCities();
    expect(getCity('tokyo')).toBeDefined();
  });

  it('손상된 캐시 (cached entry 가 plain string) → 자동 정리', async () => {
    await AsyncStorage.setItem(CACHE_KEY, '"just a string"');
    const data = buildBatch({ tokyo: makeFakeCity('tokyo') });
    mockFetchSequence([{ ok: true, status: 200, body: data }]);

    await loadAllCities();
    expect(getCity('tokyo')).toBeDefined();
  });

  it('손상된 캐시 (shape 위반: data 가 객체 아님) → 자동 정리 + miss 처리', async () => {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data: 'not an object', fetchedAt: 1 }),
    );
    const data = buildBatch({ tokyo: makeFakeCity('tokyo') });
    mockFetchSequence([{ ok: true, status: 200, body: data }]);

    await loadAllCities();

    const after = await AsyncStorage.getItem(CACHE_KEY);
    expect(after).not.toBeNull();
    const reparsed = JSON.parse(after as string) as { data: { schemaVersion: number } };
    expect(reparsed.data.schemaVersion).toBe(1);
  });

  it('손상된 캐시 (data.schemaVersion ≠ 1) → 자동 정리', async () => {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        data: { schemaVersion: 2, generatedAt: 'x', fxBaseDate: 'y', cities: {} },
        fetchedAt: 1,
      }),
    );
    const data = buildBatch({ tokyo: makeFakeCity('tokyo') });
    mockFetchSequence([{ ok: true, status: 200, body: data }]);

    await loadAllCities();

    const after = await AsyncStorage.getItem(CACHE_KEY);
    const reparsed = JSON.parse(after as string) as { data: { schemaVersion: number } };
    expect(reparsed.data.schemaVersion).toBe(1);
  });

  it('손상된 캐시 (fetchedAt 누락) → 자동 정리', async () => {
    const validData = buildBatch({ x: makeFakeCity('x') });
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: validData }));
    const data = buildBatch({ tokyo: makeFakeCity('tokyo') });
    mockFetchSequence([{ ok: true, status: 200, body: data }]);

    await loadAllCities();
    expect(getCity('tokyo')).toBeDefined();
  });

  it('손상된 캐시 (data.generatedAt 누락) → 자동 정리', async () => {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        data: { schemaVersion: 1, fxBaseDate: 'y', cities: {} },
        fetchedAt: Date.now(),
      }),
    );
    const data = buildBatch({ tokyo: makeFakeCity('tokyo') });
    mockFetchSequence([{ ok: true, status: 200, body: data }]);

    await loadAllCities();
    expect(getCity('tokyo')).toBeDefined();
  });

  it('손상된 캐시 (data.fxBaseDate 누락) → 자동 정리', async () => {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        data: { schemaVersion: 1, generatedAt: 'x', cities: {} },
        fetchedAt: Date.now(),
      }),
    );
    const data = buildBatch({ tokyo: makeFakeCity('tokyo') });
    mockFetchSequence([{ ok: true, status: 200, body: data }]);

    await loadAllCities();
    expect(getCity('tokyo')).toBeDefined();
  });

  it('손상된 캐시 (data.cities 누락) → 자동 정리', async () => {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        data: { schemaVersion: 1, generatedAt: 'x', fxBaseDate: 'y' /* cities 누락 */ },
        fetchedAt: Date.now(),
      }),
    );
    const data = buildBatch({ tokyo: makeFakeCity('tokyo') });
    mockFetchSequence([{ ok: true, status: 200, body: data }]);

    await loadAllCities();
    expect(getCity('tokyo')).toBeDefined();
  });
});

// ─── loadAllCities — HTTP/JSON 파싱 ────────────────────────────────────────

describe('loadAllCities — primary HTTP', () => {
  it('200 정상 JSON: 도시 21개 성공 가정 (테스트는 1~2개로 축소)', async () => {
    const data = buildBatch({
      seoul: makeFakeCity('seoul'),
      tokyo: makeFakeCity('tokyo'),
    });
    mockFetchSequence([{ ok: true, status: 200, body: data }]);

    const cities = await loadAllCities();
    expect(Object.keys(cities).sort()).toEqual(['seoul', 'tokyo']);
  });

  it('200 + schemaVersion ≠ 1 → fallback to backup', async () => {
    const bad = { ...buildBatch({ x: makeFakeCity('x') }), schemaVersion: 2 };
    const good = buildBatch({ tokyo: makeFakeCity('tokyo') });
    mockFetchSequence([
      { ok: true, status: 200, body: bad },
      { ok: true, status: 200, body: good },
    ]);

    const cities = await loadAllCities();
    expect(Object.keys(cities)).toEqual(['tokyo']);
  });

  it('200 + 깨진 JSON → fallback to backup', async () => {
    const good = buildBatch({ tokyo: makeFakeCity('tokyo') });
    mockFetchSequence([
      { ok: true, status: 200, body: '{not json' },
      { ok: true, status: 200, body: good },
    ]);

    const cities = await loadAllCities();
    expect(Object.keys(cities)).toEqual(['tokyo']);
  });

  it('200 + 빈 body → fallback to backup', async () => {
    const good = buildBatch({ tokyo: makeFakeCity('tokyo') });
    mockFetchSequence([
      { ok: true, status: 200, body: '' },
      { ok: true, status: 200, body: good },
    ]);

    const cities = await loadAllCities();
    expect(Object.keys(cities)).toEqual(['tokyo']);
  });

  it('200 + HTML (프록시 에러) → fallback to backup', async () => {
    const good = buildBatch({ tokyo: makeFakeCity('tokyo') });
    mockFetchSequence([
      { ok: true, status: 200, body: '<!DOCTYPE html><html>' },
      { ok: true, status: 200, body: good },
    ]);

    const cities = await loadAllCities();
    expect(Object.keys(cities)).toEqual(['tokyo']);
  });

  it('200 + JSON.parse 결과가 배열 → fallback to backup', async () => {
    const good = buildBatch({ tokyo: makeFakeCity('tokyo') });
    mockFetchSequence([
      { ok: true, status: 200, body: '[1,2,3]' },
      { ok: true, status: 200, body: good },
    ]);

    const cities = await loadAllCities();
    expect(Object.keys(cities)).toEqual(['tokyo']);
  });

  it('200 + generatedAt 누락 → fallback to backup', async () => {
    const bad = { schemaVersion: 1, fxBaseDate: '2026-04-01', cities: {} };
    const good = buildBatch({ tokyo: makeFakeCity('tokyo') });
    mockFetchSequence([
      { ok: true, status: 200, body: bad },
      { ok: true, status: 200, body: good },
    ]);

    const cities = await loadAllCities();
    expect(Object.keys(cities)).toEqual(['tokyo']);
  });

  it('200 + fxBaseDate 누락 → fallback to backup', async () => {
    const bad = { schemaVersion: 1, generatedAt: '2026-04-29T00:00:00+09:00', cities: {} };
    const good = buildBatch({ tokyo: makeFakeCity('tokyo') });
    mockFetchSequence([
      { ok: true, status: 200, body: bad },
      { ok: true, status: 200, body: good },
    ]);

    const cities = await loadAllCities();
    expect(Object.keys(cities)).toEqual(['tokyo']);
  });

  it('200 + cities 가 배열 → fallback to backup', async () => {
    const bad = {
      schemaVersion: 1,
      generatedAt: '2026-04-29T00:00:00+09:00',
      fxBaseDate: '2026-04-01',
      cities: ['not', 'an', 'object'],
    };
    const good = buildBatch({ tokyo: makeFakeCity('tokyo') });
    mockFetchSequence([
      { ok: true, status: 200, body: bad },
      { ok: true, status: 200, body: good },
    ]);

    const cities = await loadAllCities();
    expect(Object.keys(cities)).toEqual(['tokyo']);
  });

  it('200 + 모든 도시 schema 위반 → fallback to backup (0 valid)', async () => {
    const bad = buildBatch({
      a: { id: 'a' },
      b: { id: 'b', name: { ko: 'X' } },
    });
    const good = buildBatch({ tokyo: makeFakeCity('tokyo') });
    mockFetchSequence([
      { ok: true, status: 200, body: bad },
      { ok: true, status: 200, body: good },
    ]);

    const cities = await loadAllCities();
    expect(Object.keys(cities)).toEqual(['tokyo']);
  });

  it('200 + 한 도시 schema 위반 → 그 도시만 제외 + warn (ADR-K)', async () => {
    const data = buildBatch({
      seoul: makeFakeCity('seoul'),
      broken: { id: 'broken' /* 필수 필드 거의 없음 */ },
      tokyo: makeFakeCity('tokyo'),
    });
    mockFetchSequence([{ ok: true, status: 200, body: data }]);

    const cities = await loadAllCities();
    expect(Object.keys(cities).sort()).toEqual(['seoul', 'tokyo']);
    expect(cities.broken).toBeUndefined();
  });

  it('200 + 추가 알 수 없는 필드 → 통과 + 무시', async () => {
    const data = {
      ...buildBatch({ tokyo: makeFakeCity('tokyo') }),
      unknownField: 'foo',
    };
    mockFetchSequence([{ ok: true, status: 200, body: data }]);

    const cities = await loadAllCities();
    expect(Object.keys(cities)).toEqual(['tokyo']);
  });

  it('404 → fallback to backup', async () => {
    const good = buildBatch({ tokyo: makeFakeCity('tokyo') });
    mockFetchSequence([
      { ok: false, status: 404 },
      { ok: true, status: 200, body: good },
    ]);

    const cities = await loadAllCities();
    expect(Object.keys(cities)).toEqual(['tokyo']);
  });

  it('500 → fallback to backup', async () => {
    const good = buildBatch({ tokyo: makeFakeCity('tokyo') });
    mockFetchSequence([
      { ok: false, status: 500 },
      { ok: true, status: 200, body: good },
    ]);

    const cities = await loadAllCities();
    expect(Object.keys(cities)).toEqual(['tokyo']);
  });

  it('timeout (primary) → fallback to backup', async () => {
    const good = buildBatch({ tokyo: makeFakeCity('tokyo') });
    mockFetchSequence([
      { error: 'timeout' },
      { ok: true, status: 200, body: good },
    ]);

    const cities = await loadAllCities();
    expect(Object.keys(cities)).toEqual(['tokyo']);
  });

  it('네트워크 실패 (primary) → fallback to backup', async () => {
    const good = buildBatch({ tokyo: makeFakeCity('tokyo') });
    mockFetchSequence([
      { error: 'network' },
      { ok: true, status: 200, body: good },
    ]);

    const cities = await loadAllCities();
    expect(Object.keys(cities)).toEqual(['tokyo']);
  });

  it('response.text() 가 throw → fallback to backup', async () => {
    const good = buildBatch({ tokyo: makeFakeCity('tokyo') });
    const fetchMock = jest.spyOn(globalThis, 'fetch') as jest.SpyInstance;
    fetchMock.mockImplementationOnce(
      async () =>
        ({
          ok: true,
          status: 200,
          text: async () => {
            throw new Error('body read failed');
          },
        }) as unknown as Response,
    );
    fetchMock.mockImplementationOnce(
      async () =>
        ({
          ok: true,
          status: 200,
          text: async () => JSON.stringify(good),
        }) as unknown as Response,
    );

    const cities = await loadAllCities();
    expect(Object.keys(cities)).toEqual(['tokyo']);
  });
});

// ─── loadAllCities — 시드 fallback ──────────────────────────────────────────

describe('loadAllCities — 시드 fallback', () => {
  it('primary + backup 둘 다 실패 → 시드 로드 (서울+밴쿠버)', async () => {
    mockFetchSequence([{ error: 'network' }, { error: 'network' }]);

    const cities = await loadAllCities();
    expect(Object.keys(cities).sort()).toEqual(['seoul', 'vancouver']);
    expect(cities.seoul?.currency).toBe('KRW');
    expect(cities.vancouver?.currency).toBe('CAD');
  });

  it('primary 깨짐 + backup 깨짐 → 시드', async () => {
    mockFetchSequence([
      { ok: true, status: 200, body: '{not' },
      { ok: false, status: 503 },
    ]);

    const cities = await loadAllCities();
    expect(Object.keys(cities).sort()).toEqual(['seoul', 'vancouver']);
  });

  it('시드 fallback 시 캐시는 저장하지 않는다', async () => {
    mockFetchSequence([{ error: 'network' }, { error: 'network' }]);

    await loadAllCities();
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    expect(cached).toBeNull();
  });

  it('두 단계 모두 timeout → 시드', async () => {
    mockFetchSequence([{ error: 'timeout' }, { error: 'timeout' }]);

    const cities = await loadAllCities();
    expect(Object.keys(cities).sort()).toEqual(['seoul', 'vancouver']);
  });
});

// ─── loadAllCities — 동시성 (in-flight dedup) ───────────────────────────────

describe('loadAllCities — 동시성', () => {
  it('동시 호출 2회: fetch 1회만, 동일 Promise', async () => {
    const data = buildBatch({ tokyo: makeFakeCity('tokyo') });
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => data,
            text: async () => JSON.stringify(data),
          }) as unknown as Response,
      );

    const p1 = loadAllCities();
    const p2 = loadAllCities();
    expect(p1).toBe(p2); // same Promise

    await Promise.all([p1, p2]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('첫 호출 완료 후 두 번째 호출: 캐시 hit (fetch 1회 추가 없음)', async () => {
    const data = buildBatch({ tokyo: makeFakeCity('tokyo') });
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => data,
            text: async () => JSON.stringify(data),
          }) as unknown as Response,
      );

    await loadAllCities();
    await loadAllCities(); // 두 번째는 캐시 hit
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

// ─── getCity / getAllCities ─────────────────────────────────────────────────

describe('getCity / getAllCities', () => {
  it('loadAllCities 호출 전 → 빈 객체 / undefined', () => {
    expect(getAllCities()).toEqual({});
    expect(getCity('seoul')).toBeUndefined();
  });

  it('loadAllCities 후: 메모리 맵 즉시 조회', async () => {
    const data = buildBatch({
      seoul: makeFakeCity('seoul'),
      tokyo: makeFakeCity('tokyo'),
    });
    mockFetchSequence([{ ok: true, status: 200, body: data }]);
    await loadAllCities();

    expect(getAllCities()).toEqual(expect.objectContaining({ seoul: expect.any(Object), tokyo: expect.any(Object) }));
    expect(getCity('seoul')).toBeDefined();
    expect(getCity('tokyo')).toBeDefined();
    expect(getCity('nonexistent')).toBeUndefined();
  });

  it('getCity 는 동기 함수 (Promise 아님)', async () => {
    const data = buildBatch({ tokyo: makeFakeCity('tokyo') });
    mockFetchSequence([{ ok: true, status: 200, body: data }]);
    await loadAllCities();

    const result = getCity('tokyo');
    // Promise 가 아닌 직접 객체
    expect(result).not.toBeInstanceOf(Promise);
    expect(result?.id).toBe('tokyo');
  });
});

// ─── refreshCache ───────────────────────────────────────────────────────────

describe('refreshCache', () => {
  it('성공 시 ok=true + lastSync ISO 반환', async () => {
    const data = buildBatch({ tokyo: makeFakeCity('tokyo') });
    // refreshCache 는 loadAllCities + refreshFx 둘 다 fetch 시도
    mockFetchSequence([
      { ok: true, status: 200, body: data }, // loadAllCities (primary)
      {
        ok: true,
        status: 200,
        body: { result: 'success', rates: { KRW: 1380, USD: 1, CAD: 1.36 } },
      }, // refreshFx
    ]);

    const result = await refreshCache();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.lastSync).toBe('string');
      expect(result.lastSync.length).toBeGreaterThan(0);
    }
  });

  it('refreshCache 는 캐시 삭제 후 bypassCache=true 로 호출', async () => {
    // 1. 캐시 시드
    const cached = buildBatch({ stale: makeFakeCity('stale') });
    const t0 = new Date('2026-04-29T00:00:00.000Z').getTime();
    await seedCache(cached, t0);

    // 2. refresh — primary 호출 가도록
    const fresh = buildBatch({ updated: makeFakeCity('updated') });
    mockFetchSequence([
      { ok: true, status: 200, body: fresh },
      {
        ok: true,
        status: 200,
        body: { result: 'success', rates: { KRW: 1380, USD: 1 } },
      },
    ]);

    await refreshCache();
    expect(getCity('updated')).toBeDefined();
    expect(getCity('stale')).toBeUndefined();
  });

  it('실패 시 ok=false + reason — 시드까지 손상', async () => {
    jest.resetModules();
    jest.doMock('../../../data/seed/all.json', () => ({
      schemaVersion: 999,
      cities: {},
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const data: typeof import('../data') = require('../data');
    data.__resetForTesting();

    mockFetchSequence([
      { error: 'network' },
      { error: 'network' },
      { error: 'network' },
    ]);
    const result = await data.refreshCache();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('ALL_CITIES_UNAVAILABLE');
    }
    jest.dontMock('../../../data/seed/all.json');
  });

  it('실패 시 ok=false + reason (defensive — non-AppError 케이스 미도달, 시드 가용)', async () => {
    // primary, backup, fx 모두 실패 → 시드 fallback 으로 loadAllCities 는 성공.
    // 이 테스트는 시드도 손상시켜야 ok=false 를 만들 수 있다 — 시드 mock 어렵.
    // 대신 의도적으로 throw 시킬 다른 경로 — fetch 모킹 후 AsyncStorage 손상.
    // 단순화: refreshFx 가 hardcoded baseline 으로 fallback 해 항상 성공.
    // → "ok=false" 는 시드도 loadable 하지 않을 때만 발생 (extreme).
    //
    // 그래서 본 케이스는 "정상 실패 시나리오 없음" 을 확인 — refreshCache 는
    // 통상 ok=true 로 떨어진다 (시드가 안전망).
    mockFetchSequence([
      { error: 'network' }, // primary
      { error: 'network' }, // backup
      { error: 'network' }, // fx primary
    ]);

    const result = await refreshCache();
    // 시드가 성공하므로 ok=true
    expect(result.ok).toBe(true);
  });
});

// ─── getLastSync ────────────────────────────────────────────────────────────

describe('getLastSync', () => {
  it('meta:lastSync 키 존재 → ISO string 반환', async () => {
    const iso = '2026-04-30T10:00:00.000Z';
    await AsyncStorage.setItem(META_KEY, iso);

    await expect(getLastSync()).resolves.toBe(iso);
  });

  it('meta:lastSync 키 없음 → null 반환', async () => {
    await expect(getLastSync()).resolves.toBeNull();
  });

  it('saveCacheEntry 가 갱신한 메타키와 일치 (round-trip)', async () => {
    // refreshCache 등 본 모듈이 lastSync 를 갱신할 때 저장하는 것을 직접 읽음.
    const stored = '2026-04-30T12:00:00.000Z';
    await AsyncStorage.setItem(META_KEY, stored);

    await expect(getLastSync()).resolves.toBe(stored);
  });
});

// ─── AllCitiesUnavailableError (시드 손상) ─────────────────────────────────

describe('AllCitiesUnavailableError — 시드 손상', () => {
  // 본 시나리오는 모듈 mock 으로 검증 (시드 require 결과를 깨뜨리는 게 어려움).
  // 통합적으로는 실 시나리오에서 거의 발생하지 않음 — DEFENSIVE 가드.
  // jest.doMock 으로 시드 자체를 망가진 객체로 교체.

  it('시드까지 손상된 경우 → AllCitiesUnavailableError', async () => {
    jest.resetModules();
    jest.doMock('../../../data/seed/all.json', () => ({
      schemaVersion: 999, // 잘못된 schemaVersion
      cities: {},
    }));
    // require 로 모듈을 새로 가져와 mock 적용 보장 (jest.resetModules 직후 한정)
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const data: typeof import('../data') = require('../data');
    data.__resetForTesting();

    mockFetchSequence([{ error: 'network' }, { error: 'network' }]);

    // jest.resetModules 후에는 본 파일의 import 와 require 결과의 클래스가
    // 별도 객체이므로 instanceof 비교 X. code 로 검증.
    await expect(data.loadAllCities()).rejects.toMatchObject({
      code: 'ALL_CITIES_UNAVAILABLE',
    });

    jest.dontMock('../../../data/seed/all.json');
  });
});
