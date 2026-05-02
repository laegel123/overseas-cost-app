/**
 * 환율 변환 + 환율 fetch + 24h 캐시 + fallback chain.
 *
 * 본 모듈은 환율만 책임진다. 도시 데이터 fetch 는 `src/lib/data.ts` 가 담당.
 *
 * Public API:
 *   - convertToKRW(amount, currency, fxTable): 순수 함수. fetch 없음.
 *   - fetchExchangeRates({ bypassCache }): 캐시 → primary → stale → baseline 순.
 *     절대 throw 하지 않는다 (항상 ExchangeRates 반환). 호출자는 stale 감지를
 *     `meta:fxLastSync` 메타키로 별도 판단 (ADR-026, DATA.md §5).
 *   - refreshFx(): bypassCache=true 의 alias.
 *
 * 정책:
 *   - 1차 fetch: open.er-api.com /v6/latest/USD (무료, 키 불필요)
 *   - 2차 ECB: v1.0 deferred — ADR-046
 *   - 3차 baseline: 분기 하드코딩 — ADR-047 (분기 갱신 책임)
 *   - TTL 24h, 정확 24h = 만료 (TESTING §9.2)
 *   - timeout 10s (AbortController)
 *   - in-flight dedup: 동일 시점 호출 시 fetch 1회 + 동일 Promise
 *   - 손상된 캐시 자동 정리
 *
 * 모든 사용자 노출 lib 함수의 throw 는 docs/ARCHITECTURE.md §에러 카탈로그
 * 의 5개 클래스 (FxFetchError / FxParseError / FxTimeoutError /
 * UnknownCurrencyError / InvalidAmountError) 만 사용한다.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ExchangeRates } from '@/types/city';

import fxFallbackJson from '../../data/static/fx_fallback.json';

import {
  FxFetchError,
  FxParseError,
  FxTimeoutError,
  InvalidAmountError,
  UnknownCurrencyError,
} from './errors';

// 캐시 / 메타 키 — DATA.md §6.6 단일 출처. 스키마 변경 시 v 접미사 bump (ADR-022).
const CACHE_KEY = 'fx:v1';
const META_LAST_SYNC_KEY = 'meta:fxLastSync';

const TTL_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 10_000;
const PRIMARY_URL = 'https://open.er-api.com/v6/latest/USD';

const CURRENCY_RE = /^[A-Z]{3}$/;

/**
 * 분기별 BoK 하드코딩 baseline — ADR-047.
 * 분기 시작 직후 갱신 (refresh-fx 워크플로우 또는 운영자 수동 PR).
 *
 * 출처: 한국은행 통계검색시스템 — 통화별 분기 평균 환율
 *   https://ecos.bok.or.kr/  → 4.1.1 환율 (분기)
 *
 * 값 의미: 1 단위 통화당 KRW 환산값 (예: 1 CAD = 1015 KRW).
 * 본 표는 사용자 노출 데이터가 아닌 "마지막 안전망" — 1차/캐시 모두 실패 시에만 사용.
 *
 * v1.1: fx_fallback.json 자동 갱신 도입 (refresh-fx workflow).
 *       이 const 는 JSON import 실패 시 방어용으로만 사용.
 */
export const FX_BASELINE_2026Q2: ExchangeRates = {
  KRW: 1,
  USD: 1380,
  CAD: 1015,
  EUR: 1500,
  JPY: 9.0,
  GBP: 1750,
  AUD: 905,
  SGD: 1020,
  VND: 0.054,
  AED: 376,
};

/**
 * fx_fallback.json (빌드 타임 import) 에서 baseline 구축.
 * JSON import 실패 또는 shape 위반 시 FX_BASELINE_2026Q2 로 fallback.
 */
function buildFallbackBaseline(): ExchangeRates {
  try {
    const rates = fxFallbackJson?.rates;
    if (typeof rates !== 'object' || rates === null) {
      return { ...FX_BASELINE_2026Q2 };
    }
    const out: ExchangeRates = { KRW: 1 };
    for (const [code, val] of Object.entries(rates)) {
      if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
        out[code] = val;
      }
    }
    return Object.keys(out).length > 1 ? out : { ...FX_BASELINE_2026Q2 };
  } catch {
    return { ...FX_BASELINE_2026Q2 };
  }
}

// ─── convertToKRW ──────────────────────────────────────────────────────────

/**
 * 현지통화 → KRW 변환 (순수 함수).
 *
 * - currency 는 trim + uppercase 정규화 후 처리 ('cad', 'CAD ' 모두 'CAD' 로 매칭).
 * - 'KRW' 는 fxTable 무관 pass-through (Math.round(amount)).
 * - 미지의 통화 / 잘못된 형식 → UnknownCurrencyError.
 * - amount 음수 / NaN / Infinity → InvalidAmountError.
 * - 정수 KRW 반환 (Math.round).
 *
 * @throws InvalidAmountError amount 가 finite 음수 아닌 number 가 아닐 때
 * @throws UnknownCurrencyError currency 가 ISO 4217 형식이 아니거나 fxTable 미등록
 */
export function convertToKRW(
  amount: number,
  currency: string,
  fxTable: ExchangeRates,
): number {
  // !Number.isFinite 단독으로 NaN / Infinity / -Infinity 모두 처리 (Number.isNaN 중복 X).
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new InvalidAmountError(`expected finite number, got ${String(amount)}`);
  }
  if (amount < 0) {
    throw new InvalidAmountError(`expected non-negative amount, got ${amount}`);
  }

  const normalized = String(currency).trim().toUpperCase();
  if (normalized === 'KRW') {
    return Math.round(amount);
  }
  if (!CURRENCY_RE.test(normalized)) {
    throw new UnknownCurrencyError(`invalid currency code: '${currency}'`);
  }
  const rate = fxTable[normalized];
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new UnknownCurrencyError(`no rate for currency: '${normalized}'`);
  }
  return Math.round(amount * rate);
}

// ─── fetchExchangeRates ────────────────────────────────────────────────────

type CachedEntry = { rates: ExchangeRates; fetchedAt: number };

let inflight: Promise<ExchangeRates> | null = null;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isExchangeRatesShape(v: unknown): v is ExchangeRates {
  if (!isPlainObject(v)) return false;
  const entries = Object.entries(v);
  if (entries.length === 0) return false;
  for (const [, val] of entries) {
    if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) return false;
  }
  return true;
}

function isCachedEntry(v: unknown): v is CachedEntry {
  if (!isPlainObject(v)) return false;
  if (typeof v.fetchedAt !== 'number' || !Number.isFinite(v.fetchedAt)) return false;
  return isExchangeRatesShape(v.rates);
}

async function safeRemoveCache(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY).catch(() => undefined);
}

async function loadCachedEntry(): Promise<CachedEntry | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEY).catch(() => null);
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
  // 24h 정각 = 만료 (TESTING §9.2 의 "24h 정확: 만료" 정책)
  return now - fetchedAt < TTL_MS;
}

/**
 * open.er-api.com /v6/latest/USD 호출 + KRW base 정규화.
 *
 * API 응답은 USD base ({ rates: { KRW: 1380, CAD: 1.36, ... } } 형태).
 * 우리는 KRW base 의 ExchangeRates 가 필요 — 1 X = (rates.KRW / rates.X) KRW.
 *
 * @throws FxTimeoutError 10s 초과
 * @throws FxFetchError HTTP 4xx/5xx, 네트워크 실패
 * @throws FxParseError 응답이 비-JSON, shape 불일치, KRW 누락, 0개 rates
 */
async function fetchPrimary(): Promise<ExchangeRates> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(PRIMARY_URL, { signal: controller.signal });
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') {
      throw new FxTimeoutError(`open.er-api.com timed out after ${TIMEOUT_MS}ms`, cause);
    }
    throw new FxFetchError('open.er-api.com network error', cause);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new FxFetchError(`open.er-api.com responded HTTP ${response.status}`);
  }

  let bodyText: string;
  try {
    bodyText = await response.text();
  } catch (cause) {
    throw new FxParseError('failed to read response body', cause);
  }
  if (bodyText.length === 0) {
    throw new FxParseError('empty response body');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch (cause) {
    throw new FxParseError('non-JSON response body', cause);
  }

  if (!isPlainObject(parsed)) {
    throw new FxParseError('response is not an object');
  }
  if (parsed.result !== 'success') {
    throw new FxParseError(`response.result !== 'success' (got: ${String(parsed.result)})`);
  }
  if (!isPlainObject(parsed.rates)) {
    throw new FxParseError('response.rates is not an object');
  }

  const rawRates = parsed.rates;
  const krwPerUsd = rawRates.KRW;
  if (typeof krwPerUsd !== 'number' || !Number.isFinite(krwPerUsd) || krwPerUsd <= 0) {
    throw new FxParseError('response.rates.KRW missing or invalid');
  }

  const out: ExchangeRates = { KRW: 1 };
  let count = 0;
  for (const [code, rate] of Object.entries(rawRates)) {
    if (code === 'KRW') continue;
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) continue;
    if (!CURRENCY_RE.test(code)) continue;
    out[code] = krwPerUsd / rate;
    count += 1;
  }
  if (count === 0) {
    throw new FxParseError('no valid rates in response');
  }
  return out;
}

/**
 * 환율 fetch (캐시 + fallback). 호출자에게 throw 하지 않는다.
 *
 * 1) 캐시 hit (24h 이내, bypassCache 미설정) → 캐시 반환
 * 2) primary fetch → 성공 시 캐시 저장 + 반환
 * 3) primary 실패 + 캐시 (stale 포함) 존재 → 캐시 반환 (lastSync 갱신 X)
 * 4) primary 실패 + 캐시 없음 → FX_BASELINE_2026Q2 사본 반환
 *
 * 동일 시점 2회 호출 시 fetch 1회만 (in-flight dedup).
 */
export function fetchExchangeRates(opts?: { bypassCache?: boolean }): Promise<ExchangeRates> {
  // ADR-046 의 알려진 트레이드오프: 진행 중 inflight 가 있으면 bypassCache=true
  // 라도 그 Promise 를 그대로 반환 (강제 새로고침 의도가 race 시 무시됨). v2 재검토.
  if (inflight !== null) return inflight;

  const bypassCache = opts?.bypassCache === true;
  const promise = (async (): Promise<ExchangeRates> => {
    const now = Date.now();
    const cached = await loadCachedEntry();

    if (!bypassCache && cached !== null && isFresh(cached.fetchedAt, now)) {
      return cached.rates;
    }

    try {
      const rates = await fetchPrimary();
      await saveCacheEntry({ rates, fetchedAt: now });
      return rates;
    } catch {
      if (cached !== null) {
        // stale 캐시 fallback — lastSync 는 갱신하지 않아 호출자가 staleness 감지 가능
        return cached.rates;
      }
      // 캐시도 없음 → 마지막 안전망 baseline (fx_fallback.json → FX_BASELINE_2026Q2)
      return buildFallbackBaseline();
    }
  })();

  inflight = promise.finally(() => {
    inflight = null;
  });
  return inflight;
}

/**
 * 강제 새로고침 — 설정 화면 "데이터 새로고침" 메뉴용.
 * fetchExchangeRates({ bypassCache: true }) 의 alias.
 */
export function refreshFx(): Promise<ExchangeRates> {
  return fetchExchangeRates({ bypassCache: true });
}

/**
 * @internal 테스트 격리 전용 — 모듈 스코프 inflight 변수를 강제 리셋.
 *
 * 의도된 사용처는 `beforeEach` 한정. 프로덕션 코드 경로에서 호출 금지.
 * 테스트가 inflight 가 미해결 상태에서 실패하면 다음 테스트로 누수되어
 * 무한 대기가 발생 — 이를 차단하기 위해 명시적 리셋 hook 을 노출한다.
 */
export function __resetInflightForTesting(): void {
  inflight = null;
}
