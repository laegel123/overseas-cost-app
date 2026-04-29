# Step 3: currency-converter

## 읽어야 할 파일

- `CLAUDE.md` — 데이터·환율 lib 경유 규칙, 에러 카탈로그 사용 규칙
- `docs/DATA.md` §5 (환율 운영 — fallback chain, 캐시, timeout, 통화 정규화)
- `docs/ARCHITECTURE.md` §데이터 흐름 §환율 + §에러 타입 카탈로그 (FxFetchError / FxParseError / FxTimeoutError / UnknownCurrencyError / InvalidAmountError)
- `docs/ARCHITECTURE.md` §컴포넌트 위계 (currency.ts 위치 — `src/lib/`)
- `docs/TESTING.md` §5.3 (`fetch` 모킹 규약), §5.2 (시간 모킹), §9.2 (currency.ts 매트릭스)
- step 0 결과: `src/types/city.ts` (`ExchangeRates`), `src/lib/errors.ts` (FxFetchError / FxParseError / FxTimeoutError / UnknownCurrencyError / InvalidAmountError)

## 작업

이 step 은 **환율 변환과 환율 fetch + 캐시** 만 만든다. 도시 데이터 fetch (data.ts) 는 손대지 않는다 (step 4 의 책임).

### 1. `src/lib/currency.ts` 신규 작성

공개 API:

```ts
import type { ExchangeRates } from '@/types/city';

/**
 * 현지통화 → KRW 변환 (순수 함수, fetch 없음)
 *
 * - currency: 'KRW' 이면 amount pass-through 그대로 반환 (fxTable 무관)
 * - currency: ISO 4217 alpha-3 양식 검증 (대문자 3자리). 입력이 lowercase 또는 trailing space 면 정규화 후 처리: `currency.trim().toUpperCase()`
 * - fxTable[currency] 가 number 면 amount * rate 의 정수 반올림 KRW 반환
 * - fxTable[currency] 미존재 + currency !== 'KRW' → throws UnknownCurrencyError
 * - amount 가 음수·NaN·Infinity → throws InvalidAmountError
 */
export function convertToKRW(
  amount: number,
  currency: string,
  fxTable: ExchangeRates,
): number;

/**
 * 환율 fetch + 24h 캐시 + fallback chain.
 *
 * - 캐시 hit (24h 이내) → 네트워크 호출 없이 캐시 반환
 * - 캐시 miss → primary (open.er-api.com) fetch
 *   - 성공: 정규화된 ExchangeRates 반환 + AsyncStorage 저장 + timestamp 동시 저장
 *   - HTTP 4xx/5xx → throws FxFetchError (caller 가 다음 단계 fallback 결정)
 *   - 응답 shape 불일치 (rates 없음 / non-JSON) → throws FxParseError
 *   - 10s 초과 → throws FxTimeoutError
 * - in-flight dedup: 동일 시점 2회 호출 시 fetch 1회만 + 동일 Promise 반환
 *
 * v1.0 fallback policy (ADR-N — 본 step 에서 추가):
 *   1차: open.er-api.com /v6/latest/USD
 *   3차: 분기 하드코딩 (`FX_BASELINE_2026Q2`, src/lib/currency.ts 의 const)
 * 2차 ECB 는 v1.0 deferred (ADR-N).
 *
 * 모든 fetch 시도 실패 + stale 캐시 존재 시: stale 캐시 반환 + `staleAt` 플래그 (반환 객체에 포함하지 않고 별도 신호 — 예: 메타키 `fx:lastSync`).
 * 모든 fetch 시도 실패 + 캐시 없음: hardcoded baseline 반환 (FX_BASELINE_2026Q2).
 */
export function fetchExchangeRates(opts?: { bypassCache?: boolean }): Promise<ExchangeRates>;

/** 강제 새로고침 (설정 화면용). bypassCache=true 의 alias. */
export function refreshFx(): Promise<ExchangeRates>;
```

### 2. 캐시 키와 TTL

DATA.md §6.6 + ARCHITECTURE.md §캐시 전략:

- AsyncStorage 키: `fx:v1` — 값은 `{ rates: ExchangeRates, fetchedAt: number /* epoch ms */ }`
- TTL: 24h. **24h 정확 = 만료** (경계 정책 — TESTING §9.2). 23h 59m = hit.
- 추가 키: `meta:fxLastSync` — ISO datetime, 마지막 성공 fetch 시각 (settings 표시용)

캐시가 손상 (잘못된 JSON / shape 위반) → 캐시 무시 + 자동 정리 (key 삭제) + miss 처리.

### 3. Primary fetch (open.er-api.com)

- URL: `https://open.er-api.com/v6/latest/USD`
- Method: GET, no auth
- 응답 shape (성공):
  ```json
  {
    "result": "success",
    "base_code": "USD",
    "rates": { "KRW": 1380.5, "CAD": 1.36, "EUR": 0.92, ... }
  }
  ```
- 정규화: API 가 USD base 를 주므로 `KRW base` 로 변환해야 한다. `ExchangeRates[X]` 는 "1 X = N KRW" 의미이므로:
  ```ts
  // rates_USD: API 응답의 rates (USD base)
  // 1 X = (1 / rates_USD[X]) USD = (rates_USD['KRW'] / rates_USD[X]) KRW
  const krwPerUsd = rates_USD['KRW'];
  const exchangeRates: ExchangeRates = {};
  for (const [code, rateUsd] of Object.entries(rates_USD)) {
    if (code === 'KRW') continue; // KRW 는 pass-through, 테이블에 넣지 않거나 1로
    exchangeRates[code] = krwPerUsd / rateUsd;
  }
  exchangeRates['KRW'] = 1; // pass-through
  ```
- shape 검증:
  - `result === 'success'` 아니면 `FxParseError`
  - `rates` 가 객체 아니면 `FxParseError`
  - `rates.KRW` 가 양수 아니면 `FxParseError`
  - `rates` 가 빈 객체면 `FxParseError`

### 4. Timeout 구현

`AbortController` + `setTimeout(10_000)`. abort 시 `FxTimeoutError` throws.

```ts
const controller = new AbortController();
const t = setTimeout(() => controller.abort(), 10_000);
try {
  const res = await fetch(url, { signal: controller.signal });
  // ...
} catch (e) {
  if (e instanceof Error && e.name === 'AbortError') throw new FxTimeoutError('open.er-api.com timeout', e);
  throw new FxFetchError('open.er-api.com network error', e);
} finally {
  clearTimeout(t);
}
```

### 5. In-flight dedup

모듈 스코프 변수:

```ts
let inflight: Promise<ExchangeRates> | null = null;
```

`fetchExchangeRates` 진입 시 캐시 검사 → miss 면 `inflight` 검사 → 있으면 그것 반환, 없으면 새 Promise 시작 + `inflight` 에 저장. Promise resolve/reject 직후 `inflight = null`.

### 6. Hardcoded baseline (3차 fallback)

```ts
// 2026 Q2 기준 (BoK 분기 평균 환율 — fxBaseDate 와 정렬). 분기 갱신 시 본 const 도 갱신.
const FX_BASELINE_2026Q2: ExchangeRates = {
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
```

값들은 BoK 통화별 분기 평균 환율 페이지에서 추출 (DATA.md §5.1 의 3차 fallback). 출처 URL 을 위 const 위 주석에 명시.

> 본 const 는 `data/sources.md` 에 entry 를 만들지 않는다 — 코드 내 fallback 이지 사용자에게 보이는 데이터 포인트가 아니다. 단, 분기 갱신 책임을 ADR 에 명시.

### 7. ADR 추가

`docs/ADR.md` 마지막에 다음 ADR 두 개 추가:

- **ADR-M: 환율 fallback v1.0 = 1차(open.er-api) + 3차(하드코딩)**. 2차 ECB 는 v1.x 로 deferred. 이유: ECB endpoint 는 XML 기반이라 RN 환경에서 별도 파서 필요 — 출시 일정 단축. 1차 + 3차 만으로 가용성 99%+ 확보.
- **ADR-M+1: `FX_BASELINE_<year>Q<n>` 분기 갱신 정책**. 분기마다 currency.ts 의 const 를 BoK 평균 환율로 갱신. 자동화는 후속 phase.

### 8. 테스트

`src/lib/__tests__/currency.test.ts` 신규. TESTING.md §9.2 매트릭스 그대로 cover.

`src/__test-utils__/mockFetchSequence.ts` (TESTING §8.4) 가 이미 존재한다고 가정. 없으면 본 step 에서 가볍게 추가:

```ts
// src/__test-utils__/mockFetchSequence.ts
export type FetchResponse =
  | { ok: true; status: number; body: object | string }
  | { ok: false; status: number }
  | { error: 'timeout' | 'network' };

export function mockFetchSequence(responses: FetchResponse[]): jest.SpyInstance {
  const spy = jest.spyOn(global, 'fetch') as jest.SpyInstance;
  responses.forEach((r) => {
    spy.mockImplementationOnce(async () => {
      if ('error' in r) {
        if (r.error === 'timeout') throw Object.assign(new Error('aborted'), { name: 'AbortError' });
        throw new TypeError('Network request failed');
      }
      return {
        ok: r.ok,
        status: r.status,
        json: async () => (typeof r.body === 'string' ? JSON.parse(r.body) : r.body),
        text: async () => (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)),
      } as unknown as Response;
    });
  });
  return spy;
}
```

**테스트 케이스 (TESTING §9.2 와 1대1 일치):**

`convertToKRW`:
- 정상값 6종 (CAD, KRW pass-through, EUR, JPY, VND, large + small rate)
- 소수 정밀도 3종
- 미지의 통화 throws UnknownCurrencyError + code
- 빈 fxTable + 비-KRW throws
- 음수·NaN·Infinity throws InvalidAmountError
- lowercase / trailing space 정규화 (정책: 정규화 후 처리)

`fetchExchangeRates`:
- 캐시 hit (jest.useFakeTimers + setSystemTime 으로 24h 미만)
- 캐시 miss → 정상 fetch + 저장
- 23h 59m hit, 24h 정각 expire
- HTTP 200 정상 shape → 통과
- HTTP 200 빈 body / non-JSON / shape 불일치 → FxParseError
- HTTP 404 / 500 → FxFetchError
- timeout → FxTimeoutError
- in-flight dedup: 동시 2회 호출 시 fetch 1회 + 동일 Promise
- stale 캐시 + fetch 실패: stale 반환 + lastSync 유지
- 캐시 없음 + fetch 실패: hardcoded baseline 반환

`loadCachedFx` / `saveFx` (내부 헬퍼 — 테스트는 export 안 한 채로 indirectly 검증):
- save 후 load 동일 객체
- timestamp 보존
- 잘못된 JSON 캐시 → 자동 정리 + null 동작 (다음 fetch 시 miss 처리)

### 9. `src/lib/index.ts` export 확장

```ts
export * from './errors';
export { validateCity, validateAllJson, parseAllCitiesText } from './citySchema';
export { convertToKRW, fetchExchangeRates, refreshFx } from './currency';
```

### 10. TESTING.md 업데이트

§9.2 는 이미 매트릭스가 있으므로 항목 추가 불필요. 단:

- §9.2 의 "fetchExchangeRates" 시그니처가 본 step 의 `opts?: { bypassCache?: boolean }` 와 일치하는지 확인. 불일치하면 §9.2 갱신.
- §9.2 끝에 "v1.0 fallback policy: 1차 (open.er-api) + 3차 (hardcoded). ADR-M 참조" 한 줄 추가.

## Acceptance Criteria

```bash
npm run typecheck \
  && npm run lint \
  && npm test -- src/lib/__tests__/currency.test.ts src/lib/__tests__/citySchema.test.ts src/lib/__tests__/errors.test.ts src/__fixtures__/seed-roundtrip.test.ts
```

- typecheck / lint 통과
- currency.test.ts 의 모든 케이스 통과 (대략 30+ 케이스, TESTING §9.2 매트릭스)
- 다른 모든 기존 테스트 회귀 없음
- 새 파일: `src/lib/currency.ts`, `src/lib/__tests__/currency.test.ts`, (선택) `src/__test-utils__/mockFetchSequence.ts`
- 수정 파일: `src/lib/index.ts`, `docs/ADR.md` (+2 ADR), `docs/TESTING.md` §9.2 (시그니처 정렬 시) — 그 외 변경 없음
- `git diff --stat` 으로 위 범위 확인

## 검증 절차

1. AC 명령 실행
2. **체크리스트:**
   - 모든 throws 가 카탈로그 5개 (FxFetchError, FxParseError, FxTimeoutError, UnknownCurrencyError, InvalidAmountError) 만 사용하는가?
   - 캐시 키가 정확히 `fx:v1` 인가? (`grep -n "'fx:v1'" src/lib/currency.ts`)
   - 10s timeout 이 명시되는가? (`grep -n "10_000\|10000" src/lib/currency.ts`)
   - in-flight dedup 모듈 스코프 변수가 있는가?
   - hardcoded baseline 위에 BoK 출처 URL 주석이 있는가?
   - `convertToKRW` 가 `fetch` 를 호출하지 않는가? (순수 함수 보장)
3. `phases/data-layer/index.json` step 3 업데이트:
   - 성공 → `"summary": "convertToKRW (순수) + fetchExchangeRates (open.er-api → 하드코딩 fallback, 24h fx:v1 캐시, in-flight dedup, 10s timeout). ADR-M (fallback v1.0 정책) + ADR-M+1 (하드코딩 분기 갱신 정책)."`

## 금지사항

- **2차 ECB fallback 구현 금지.** 이유: ADR-M 으로 v1.x deferred. 본 step 에서는 1차 + 3차만.
- **`data/all.json` 또는 도시 JSON fetch 코드 작성 금지.** 이유: step 4 의 책임. currency.ts 는 환율 전담.
- **`convertToKRW` 안에서 fetch 호출 금지.** 이유: 순수 함수여야 함 (decoupled — 컴포넌트가 fxTable 을 인자로 넘긴다). fxTable 획득은 호출부에서 별개로.
- **새로운 에러 클래스 추가 금지.** 이유: step 0 의 카탈로그가 단일 출처. 부족하면 카탈로그 자체를 갱신해야지 ad-hoc 추가 X.
- **fxTable 의 KRW 누락 처리 금지 (silent default).** 이유: 'KRW' currency 입력은 명시 분기로 pass-through. 다른 미지 통화는 throws.
- **AsyncStorage 키 prefix 변경 금지** (`fx:v1` 고정). 이유: ARCHITECTURE.md §캐시 키 단일 출처.
- **타이머 모킹 없는 시간 의존 테스트 금지.** 이유: TESTING.md §5.2 — flaky 0건 정책.
- 기존 테스트 깨뜨리지 마라.
