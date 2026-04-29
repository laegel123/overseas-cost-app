/**
 * 도시 batch 데이터 fetch + 24h 캐시 + fallback chain.
 *
 * 본 모듈은 도시 비교 데이터만 책임진다. 환율은 `src/lib/currency.ts` 가 담당.
 *
 * Public API:
 *   - loadAllCities({ bypassCache }): 캐시 → primary → backup → seed 순.
 *     절대 throw 하지 않는다 (시드도 손상된 매우 예외적 케이스만 AllCitiesUnavailableError).
 *     성공 시 모듈 메모리 맵 갱신 — 이후 getCity / getAllCities 동기 조회 가능.
 *   - getCity(id): 메모리 맵 동기 조회. loadAllCities 전 또는 미존재 시 undefined.
 *   - getAllCities(): 메모리 맵 동기 조회.
 *   - refreshCache(): 캐시 + 환율 함께 강제 갱신, 결과 + lastSync 반환.
 *
 * 정책:
 *   - 1차: GitHub Raw (laegel123/overseas-cost-app/main/data/all.json)
 *   - 2차: jsDelivr CDN 자동 미러 (DATA.md §6.4)
 *   - 3차: 번들 시드 (`data/seed/all.json` — 서울 + 밴쿠버, ADR-045)
 *   - 4차: 모두 손상 → AllCitiesUnavailableError
 *   - TTL 24h, 정확 24h = 만료 (TESTING §9.4)
 *   - timeout 10s per attempt (AbortController)
 *   - in-flight dedup: 동일 시점 호출 시 fetch 1회 + 동일 Promise
 *   - 손상된 캐시 자동 정리
 *   - schemaVersion ≠ 1 → CitySchemaError → 다음 단계 fallback 시도
 *   - 한 도시 schema 위반 → 그 도시만 제외 + warn (ADR-K, 부분 가용성)
 *
 * 모든 사용자 노출 lib 함수의 throw 는 docs/ARCHITECTURE.md §에러 카탈로그 의
 * City* + AllCitiesUnavailableError 만 사용한다.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AllCitiesData, CitiesMap, CityCostData } from '@/types/city';

import seedData from '../../data/seed/all.json';

import { validateCity } from './citySchema';
import { refreshFx } from './currency';
import {
  AllCitiesUnavailableError,
  AppError,
  CityFetchError,
  CityNotFoundError,
  CityParseError,
  CitySchemaError,
  CityTimeoutError,
} from './errors';

// 캐시 / 메타 키 — DATA.md §6.6 단일 출처. 스키마 변경 시 v 접미사 bump (ADR-022).
const CACHE_KEY = 'data:all:v1';
const META_LAST_SYNC_KEY = 'meta:lastSync';

const TTL_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 10_000;

// GitHub Raw — laegel123/overseas-cost-app/main/data/all.json (DATA.md §6.3).
// EXPO_PUBLIC_DATA_BASE_URL override 가능 (운영 환경 전환용).
const DEFAULT_PRIMARY_BASE = 'https://raw.githubusercontent.com/laegel123/overseas-cost-app/main/data';
const PRIMARY_BASE = process.env.EXPO_PUBLIC_DATA_BASE_URL ?? DEFAULT_PRIMARY_BASE;
const PRIMARY_URL = `${PRIMARY_BASE}/all.json`;

// jsDelivr 자동 미러 — GitHub raw 다운 시 fallback (DATA.md §6.4).
const BACKUP_URL = 'https://cdn.jsdelivr.net/gh/laegel123/overseas-cost-app@main/data/all.json';

// ─── 내부 상태 ──────────────────────────────────────────────────────────────

type CachedEntry = { data: AllCitiesData; fetchedAt: number };

let citiesInMemory: CitiesMap = {};
let inflight: Promise<CitiesMap> | null = null;

// ─── 타입 가드 ──────────────────────────────────────────────────────────────

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isAllCitiesShape(v: unknown): v is AllCitiesData {
  if (!isPlainObject(v)) return false;
  if (v.schemaVersion !== 1) return false;
  if (typeof v.generatedAt !== 'string' || v.generatedAt.length === 0) return false;
  if (typeof v.fxBaseDate !== 'string' || v.fxBaseDate.length === 0) return false;
  if (!isPlainObject(v.cities)) return false;
  return true;
}

function isCachedEntry(v: unknown): v is CachedEntry {
  if (!isPlainObject(v)) return false;
  // !Number.isFinite 분기는 JSON.parse 가 NaN/Infinity 를 생산할 수 없어 실용 도달 불가.
  /* istanbul ignore next: defensive — JSON 으로는 non-finite number 표현 불가 */
  if (typeof v.fetchedAt !== 'number' || !Number.isFinite(v.fetchedAt)) return false;
  return isAllCitiesShape(v.data);
}

// ─── 캐시 helpers ───────────────────────────────────────────────────────────

async function safeRemoveCache(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY).catch(
    /* istanbul ignore next: AsyncStorageMock 은 reject 안 함 — 실 device 방어 */
    () => undefined,
  );
}

async function loadCachedEntry(): Promise<CachedEntry | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEY).catch(
    /* istanbul ignore next: AsyncStorageMock 은 reject 안 함 — 실 device 방어 */
    () => null,
  );
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await safeRemoveCache();
    return null;
  }
  if (!isCachedEntry(parsed)) {
    await safeRemoveCache();
    return null;
  }
  return parsed;
}

async function saveCacheEntry(entry: CachedEntry): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  await AsyncStorage.setItem(META_LAST_SYNC_KEY, new Date(entry.fetchedAt).toISOString());
}

function isFresh(fetchedAt: number, now: number): boolean {
  return now - fetchedAt < TTL_MS;
}

// ─── parsing (lenient — ADR-K) ──────────────────────────────────────────────

/**
 * Lenient parser — ADR-K 부분 가용성 정책.
 *
 * - JSON.parse 실패 → CityParseError
 * - top-level shape 위반 (schemaVersion ≠ 1, cities 누락 등) → CitySchemaError
 * - 한 도시 schema 위반 → 그 도시만 제외 + dev warn (조용한 무시 아님)
 * - 0개 도시만 통과 → CitySchemaError
 */
function parseLenient(text: string, sourceLabel: string): AllCitiesData {
  if (text.length === 0) {
    throw new CityParseError(`empty body from ${sourceLabel}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new CityParseError(`failed to parse JSON from ${sourceLabel}`, cause);
  }

  if (!isPlainObject(parsed)) {
    throw new CitySchemaError(`response from ${sourceLabel} is not an object`);
  }
  if (parsed.schemaVersion !== 1) {
    throw new CitySchemaError(
      `${sourceLabel}: unsupported schemaVersion (got ${String(parsed.schemaVersion)}, expected 1)`,
    );
  }
  if (typeof parsed.generatedAt !== 'string' || parsed.generatedAt.length === 0) {
    throw new CitySchemaError(`${sourceLabel}: generatedAt missing or invalid`);
  }
  if (typeof parsed.fxBaseDate !== 'string' || parsed.fxBaseDate.length === 0) {
    throw new CitySchemaError(`${sourceLabel}: fxBaseDate missing or invalid`);
  }
  if (!isPlainObject(parsed.cities)) {
    throw new CitySchemaError(`${sourceLabel}: cities is not an object`);
  }

  const validCities: CitiesMap = {};
  for (const [cityId, cityData] of Object.entries(parsed.cities)) {
    try {
      validCities[cityId] = validateCity(cityData);
    } catch (e) {
      // ADR-K: 부분 가용성 — 그 도시만 제외, dev 콘솔 가시성 유지
      /* istanbul ignore next: __DEV__ 가드는 jest 환경에서 false (TESTING §4) */
      if (e instanceof AppError && __DEV__) {
        // eslint-disable-next-line no-console
        console.warn(`[data] city '${cityId}' excluded: ${e.code} ${e.message}`);
      }
      // silent fail 아님 — warn 으로 가시성 확보 후 다음 도시로
    }
  }
  if (Object.keys(validCities).length === 0) {
    throw new CitySchemaError(`${sourceLabel}: no valid cities`);
  }
  return {
    schemaVersion: 1,
    generatedAt: parsed.generatedAt,
    fxBaseDate: parsed.fxBaseDate,
    cities: validCities,
  };
}

// ─── network ────────────────────────────────────────────────────────────────

/**
 * url 에서 텍스트를 가져온다. AbortController 로 timeout, 결정적 에러 매핑.
 *
 * @throws CityNotFoundError 404
 * @throws CityFetchError 그 외 HTTP 오류 + 네트워크 실패
 * @throws CityTimeoutError 10s 초과
 */
async function tryFetch(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(
    /* istanbul ignore next: 실 device 타임아웃 callback — jest fake timers 환경에서 자연 호출 안 됨 */
    () => controller.abort(),
    TIMEOUT_MS,
  );

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') {
      throw new CityTimeoutError(`timeout ${url}`, cause);
    }
    throw new CityFetchError(`network error ${url}`, cause);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 404) {
    throw new CityNotFoundError(`404 ${url}`);
  }
  if (!response.ok) {
    throw new CityFetchError(`HTTP ${response.status} ${url}`);
  }

  try {
    return await response.text();
  } catch (cause) {
    throw new CityFetchError(`failed to read body ${url}`, cause);
  }
}

/**
 * primary → backup 순서로 시도. 각 단계 실패는 dev warn 후 다음 단계로.
 * 둘 다 실패 시 마지막 단계의 에러를 throws — 시드 fallback 은 호출자가 처리.
 */
async function loadFromNetwork(): Promise<AllCitiesData> {
  const attempts: ['primary' | 'backup', string][] = [
    ['primary', PRIMARY_URL],
    ['backup', BACKUP_URL],
  ];

  let lastError: AppError | null = null;
  for (const [label, url] of attempts) {
    try {
      const text = await tryFetch(url);
      return parseLenient(text, label);
    } catch (e) {
      /* istanbul ignore next: lib 내 모든 throw 는 AppError — 도달 불가 (방어) */
      if (!(e instanceof AppError)) throw e;
      /* istanbul ignore next: __DEV__ 가드는 jest 환경에서 false (TESTING §4) */
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn(`[data] ${label} failed: ${e.code} ${e.message}`);
      }
      lastError = e;
    }
  }
  // 두 단계 모두 실패 — 마지막 에러를 호출자에게 (호출자가 시드 fallback 결정)
  /* istanbul ignore next: lastError 는 항상 set (loop iteration ≥ 1) — 방어 */
  throw lastError ?? new CityFetchError('network unavailable');
}

/**
 * 시드 fallback. 번들된 `data/seed/all.json` 을 검증해 반환.
 * 시드도 손상된 매우 예외적 케이스만 AllCitiesUnavailableError.
 */
function loadFromSeed(): AllCitiesData {
  try {
    return parseLenient(JSON.stringify(seedData), 'seed');
  } catch (cause) {
    throw new AllCitiesUnavailableError('all sources failed including seed', cause);
  }
}

// ─── public API ─────────────────────────────────────────────────────────────

/**
 * 21개 도시 batch 데이터를 fetch 하거나 캐시에서 로드.
 *
 * Fallback chain (DATA.md §6.5):
 *   1. cache hit (24h 이내, !bypassCache) → 즉시 반환
 *   2. primary fetch (GitHub raw) → 성공 시 캐시 저장
 *   3. backup fetch (jsDelivr) → 성공 시 캐시 저장
 *   4. bundled seed → 캐시 저장하지 않음 (시드는 항상 사용 가능)
 *   5. 시드도 손상 → AllCitiesUnavailableError throws
 *
 * 동일 시점 2회 호출 시 fetch 1회만 (in-flight dedup).
 * 성공 시 모듈 메모리 맵을 갱신 — 이후 getCity / getAllCities 동기 조회 가능.
 *
 * @throws AllCitiesUnavailableError 모든 단계 실패 (시드 손상 포함)
 */
export function loadAllCities(opts?: { bypassCache?: boolean }): Promise<CitiesMap> {
  if (inflight !== null) return inflight;

  const bypassCache = opts?.bypassCache === true;
  const promise = (async (): Promise<CitiesMap> => {
    const now = Date.now();

    if (!bypassCache) {
      const cached = await loadCachedEntry();
      if (cached !== null && isFresh(cached.fetchedAt, now)) {
        citiesInMemory = cached.data.cities;
        return citiesInMemory;
      }
    }

    let data: AllCitiesData;
    try {
      data = await loadFromNetwork();
      await saveCacheEntry({ data, fetchedAt: now });
    } catch (e) {
      /* istanbul ignore next: lib 내 모든 throw 는 AppError — 도달 불가 (방어) */
      if (!(e instanceof AppError)) throw e;
      // 네트워크 단계 실패 → 시드 fallback (캐시 저장하지 않음 — 시드는 stale 의미 X)
      /* istanbul ignore next: __DEV__ 가드는 jest 환경에서 false (TESTING §4) */
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn(
          `[data] network fallback to seed: ${e.code} ${e.message}`,
        );
      }
      data = loadFromSeed();
    }

    citiesInMemory = data.cities;
    return citiesInMemory;
  })();

  inflight = promise.finally(() => {
    inflight = null;
  });
  return inflight;
}

/**
 * loadAllCities 후 호출. 메모리 맵에서 동기 조회.
 * - 존재 → CityCostData
 * - 없음 → undefined
 * - loadAllCities 호출 전 → undefined (UI 가 빈 맵을 자연스럽게 처리)
 */
export function getCity(id: string): CityCostData | undefined {
  return citiesInMemory[id];
}

/**
 * 전체 도시 맵 즉시 반환. loadAllCities 호출 전이면 빈 객체.
 */
export function getAllCities(): CitiesMap {
  return citiesInMemory;
}

/**
 * 강제 새로고침 — 설정 화면 "데이터 갱신" 메뉴.
 *
 * - data:all:v1 캐시 삭제 → bypassCache=true 로 loadAllCities 호출
 * - 환율도 함께 갱신 (refreshFx)
 * - lastSync 메타키는 saveCacheEntry / refreshFx 가 각자 갱신
 * - 실패 시 이전 캐시·시드는 보존 (loadAllCities 가 시드 fallback)
 */
export async function refreshCache(): Promise<
  { ok: true; lastSync: string } | { ok: false; reason: string }
> {
  try {
    await safeRemoveCache();
    await loadAllCities({ bypassCache: true });
    await refreshFx();
    const lastSync = await AsyncStorage.getItem(META_LAST_SYNC_KEY);
    return { ok: true, lastSync: lastSync ?? new Date().toISOString() };
  } catch (e) {
    const reason = e instanceof AppError
      ? `${e.code}: ${e.message}`
      : /* istanbul ignore next: defensive — loadAllCities/refreshFx 는 모두 AppError 만 throw */
        `unknown: ${String(e)}`;
    return { ok: false, reason };
  }
}

/**
 * @internal 테스트 격리 전용 — 모듈 스코프 inflight + 메모리 맵을 강제 리셋.
 *
 * 의도된 사용처는 `beforeEach` 한정. 프로덕션 코드 경로에서 호출 금지.
 */
export function __resetForTesting(): void {
  inflight = null;
  citiesInMemory = {};
}
