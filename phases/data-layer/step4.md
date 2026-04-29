# Step 4: data-loader

## 읽어야 할 파일

- `CLAUDE.md` — "외부 데이터는 src/lib/data.ts 경유", 에러·테스트 정책
- `docs/DATA.md` §6 (호스팅 + fetch 전략 — primary GitHub raw / backup jsDelivr / seed fallback / 캐시 키)
- `docs/DATA.md` §6.5 fallback chain, §6.6 캐시 키, §6.7 fetch 시점
- `docs/ARCHITECTURE.md` §데이터 흐름 — `data.ts` 공개 API (loadAllCities / getCity / getAllCities / refreshCache)
- `docs/ARCHITECTURE.md` §에러 타입 카탈로그 (CityFetchError / CityTimeoutError / CityParseError / CitySchemaError / CityNotFoundError / AllCitiesUnavailableError)
- `docs/ARCHITECTURE.md` §부팅·hydration 순서 (data.ts 가 호출되는 시점 — `_layout.tsx`, 본 phase 외)
- `docs/TESTING.md` §9.4 (`src/lib/data.ts` 매트릭스), §5.3 (fetch 모킹), §5.2 (시간 모킹)
- step 0~3 산출물:
  - `src/types/city.ts` (`CityCostData`, `CitiesMap`, `AllCitiesData`)
  - `src/lib/errors.ts` (City* 에러 클래스)
  - `src/lib/citySchema.ts` (`parseAllCitiesText`, `validateAllJson`)
  - `data/seed/all.json` (서울 + 밴쿠버)
  - `src/lib/currency.ts` (통합 smoke 에서 사용)

## 작업

이 step 은 **도시 데이터 batch loader + 통합 smoke** 를 만든다. 본 phase 의 마지막 step.

### 1. `src/lib/data.ts` 신규 작성

ARCHITECTURE.md §데이터 흐름 의 공개 API 시그니처 정확히 따름:

```ts
import type { CityCostData, CitiesMap } from '@/types/city';

/**
 * 21개 도시 batch 데이터를 fetch 하거나 캐시에서 로드.
 * 동일 모듈 lifecycle 내 전역 메모리 맵을 갱신한다 (이후 getCity/getAllCities 가 동기 조회).
 *
 * Fallback chain (DATA.md §6.5):
 *   1. cache hit (24h 이내) → 즉시 반환
 *   2. primary fetch (GitHub raw)
 *   3. backup fetch (jsDelivr)
 *   4. bundled seed (data/seed/all.json — 서울 + 밴쿠버 2개)
 *   5. 모두 실패 → throws AllCitiesUnavailableError (시드도 손상된 매우 예외적 케이스)
 *
 * - opts.bypassCache=true: 캐시 무시 + primary 강제 호출 (수동 새로고침)
 * - 캐시 키: 'data:all:v1', timestamp 동시 저장
 * - in-flight dedup: 동시 호출 시 fetch 1회 + 동일 Promise
 * - 10s timeout per attempt
 * - schemaVersion ≠ 1 → CitySchemaError + 다음 단계 fallback 시도 (구조 변경에 안전)
 */
export function loadAllCities(opts?: { bypassCache?: boolean }): Promise<CitiesMap>;

/**
 * loadAllCities 후 호출. 메모리 맵에서 동기 조회.
 * - 존재 → CityCostData
 * - 없음 → undefined
 * - loadAllCities 호출 전 (메모리 비어있음) → undefined (throw 하지 않음 — UI 가 첫 렌더 시 빈 맵을 자연스럽게 처리)
 */
export function getCity(id: string): CityCostData | undefined;

/**
 * 전체 도시 맵 즉시 반환. loadAllCities 호출 전이면 빈 객체.
 */
export function getAllCities(): CitiesMap;

/**
 * 강제 새로고침 (설정 화면 "데이터 갱신" 버튼).
 * - 'data:all:v1' 삭제 → loadAllCities({ bypassCache: true }) 실행
 * - 환율도 같이 갱신 (currency.refreshFx 호출)
 * - 메타키 'meta:lastSync' 갱신
 *
 * 실패 시 이전 캐시·시드는 그대로 보존된다 (호출 직전 상태로 복귀).
 */
export function refreshCache(): Promise<{ ok: true; lastSync: string } | { ok: false; reason: string }>;
```

### 2. URL 과 환경변수

- baseURL 환경변수: `EXPO_PUBLIC_DATA_BASE_URL` (DATA.md §6.3)
  - default: `https://raw.githubusercontent.com/<user>/<repo>/main/data` — `<user>/<repo>` 는 본 step 에서 placeholder 로 두지 말고, **실제 GitHub 저장소** 로 채운다 (현재 git remote 에서 추출). 추출 실패 시 step `blocked` 처리.
- backup URL: `https://cdn.jsdelivr.net/gh/<user>/<repo>@main/data/all.json`
- target path: `/all.json`

git remote 추출 명령:

```bash
git remote get-url origin
# → git@github.com:laegel123/overseas-cost-app.git 또는 https://github.com/laegel123/overseas-cost-app.git
```

`<user>/<repo>` 를 추출해 `app.json` 의 `extra.dataBaseUrl` 또는 `.env.example` 에 명시 + currency.ts 가 아닌 `src/lib/dataConfig.ts` (또는 동일 파일 안의 const) 에 두 URL 을 export.

### 3. Fetch 시도 함수

```ts
async function tryFetch(url: string, timeoutMs = 10_000): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.status === 404) throw new CityNotFoundError(`404 ${url}`);
    if (!res.ok) throw new CityFetchError(`HTTP ${res.status} ${url}`);
    return await res.text();
  } catch (e) {
    if (e instanceof AppError) throw e;
    if (e instanceof Error && e.name === 'AbortError') throw new CityTimeoutError(`timeout ${url}`, e);
    throw new CityFetchError(`network error ${url}`, e);
  } finally {
    clearTimeout(t);
  }
}
```

### 4. Fallback 흐름

```ts
async function loadFromNetworkThenSeed(): Promise<{ data: AllCitiesData; from: 'primary' | 'backup' | 'seed' }> {
  for (const [from, url] of [['primary', PRIMARY_URL], ['backup', BACKUP_URL]] as const) {
    try {
      const text = await tryFetch(url);
      const data = parseAllCitiesText(text); // throws CityParseError / CitySchemaError
      return { data, from };
    } catch (e) {
      if (e instanceof AppError) {
        // CityNotFoundError / CityFetchError / CityTimeoutError / CityParseError / CitySchemaError
        // 모두 다음 단계로 fallback
        // dev 콘솔에 warn (silent fail 금지 — 가시성 유지)
        if (__DEV__) console.warn(`[data] ${from} failed: ${e.code} ${e.message}`);
        continue;
      }
      throw e; // 알 수 없는 에러 — 상위로
    }
  }
  // 시드 fallback
  try {
    const seed = require('@/../data/seed/all.json'); // tsconfig resolveJsonModule
    return { data: validateAllJson(seed), from: 'seed' };
  } catch (e) {
    throw new AllCitiesUnavailableError('all sources failed including seed', e);
  }
}
```

### 5. 캐시

- 키: `data:all:v1` (DATA.md §6.6)
- 값: `{ data: AllCitiesData, fetchedAt: number /* epoch */ }`
- TTL: 24h 정확 만료
- 저장 시 `meta:lastSync` 도 ISO datetime 으로 갱신
- 손상된 캐시 (잘못된 JSON / shape 위반): 캐시 무시 + 자동 정리

### 6. In-flight dedup

`currency.ts` 와 같은 패턴. 모듈 스코프 `let inflight: Promise<CitiesMap> | null = null`.

### 7. 메모리 맵

```ts
let citiesInMemory: CitiesMap = {};

export function getCity(id: string): CityCostData | undefined {
  return citiesInMemory[id];
}
export function getAllCities(): CitiesMap {
  return citiesInMemory;
}
```

`loadAllCities` 가 성공할 때마다 `citiesInMemory = data.cities` 로 갱신.

### 8. 테스트

`src/lib/__tests__/data.test.ts` 신규. TESTING.md §9.4 매트릭스 그대로 cover.

핵심 케이스 (요약 — 정확한 목록은 TESTING §9.4 따름):

- 캐시 hit / miss / 만료 / bypassCache
- HTTP 200 정상 / 깨진 JSON / shape 위반 / 빈 body / HTML / 404 / 500 / 타임아웃
- primary 실패 → backup → 시드 폴백 chain (각 실패 종류별 검증)
- in-flight dedup
- getCity / getAllCities loadAllCities 전후 동작
- refreshCache: 캐시 삭제 + bypassCache + lastSync 갱신
- 한 도시 schema 위반: TESTING §9.4 의 정책에 따라 (a) 그 도시만 제외 + 나머지 반환 + warn, 또는 (b) 전체 throw 정책 중 하나로 결정. 본 step 은 **(a) 정책** 채택 (일관성 — 시드 fallback 의 부분 가용성과 같은 정신)

### 9. 통합 smoke 테스트

`__integration__/dataLayer.integration.test.ts` 신규.

```ts
import { loadAllCities, getCity } from '@/lib/data';
import { convertToKRW, fetchExchangeRates } from '@/lib/currency';

describe('data-layer integration (시드 + 환율 → KRW 변환)', () => {
  beforeEach(() => {
    // primary, backup 모두 실패 → 시드 fallback 강제
    jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('Network'));
  });

  it('시드 fallback 으로 서울 + 밴쿠버 로드 → 밴쿠버 oneBed 가 KRW 로 변환됨', async () => {
    const cities = await loadAllCities({ bypassCache: true });
    expect(Object.keys(cities).sort()).toEqual(['seoul', 'vancouver']);

    const vancouver = getCity('vancouver');
    expect(vancouver).toBeDefined();
    expect(vancouver?.currency).toBe('CAD');

    // 환율은 fetch 실패 시 hardcoded baseline 사용 (currency.ts step 3)
    const rates = await fetchExchangeRates({ bypassCache: true });
    const cadRate = rates['CAD'];
    expect(typeof cadRate).toBe('number');
    expect(cadRate).toBeGreaterThan(500); // sanity (BoK 분기 환율 ~1000원대)

    const oneBedCad = vancouver?.rent.oneBed;
    if (typeof oneBedCad === 'number') {
      const oneBedKrw = convertToKRW(oneBedCad, 'CAD', rates);
      expect(oneBedKrw).toBeGreaterThan(0);
      expect(Number.isInteger(oneBedKrw)).toBe(true);
    }
  });

  it('서울 KRW 패스스루 (환율 무관)', async () => {
    await loadAllCities({ bypassCache: true });
    const seoul = getCity('seoul');
    expect(seoul?.currency).toBe('KRW');
    if (typeof seoul?.rent.oneBed === 'number') {
      const krw = convertToKRW(seoul.rent.oneBed, 'KRW', {});
      expect(krw).toBe(seoul.rent.oneBed);
    }
  });
});
```

`jest.config.js` 가 `__integration__/` 를 어떻게 다루는지 확인 — bootstrap step 4 에서 testPathIgnorePatterns 에 포함 안 되었다면 그대로 발견됨. 안 된다면 jest.config 수정 (한 줄 추가).

### 10. ADR 추가

`docs/ADR.md` 마지막에 추가:

- **ADR-K: 부분 schema 실패 정책 (한 도시 invalid → 그 도시 제외 + warn, 전체는 통과)**. 이유: 21개 중 1개 깨졌다고 전체 ErrorView 는 사용자 경험상 과도. dev 콘솔 warn + sentry-like (v2 이후) 보고로 가시성 확보.
- **ADR-L: 시드 fallback 시 partial 가용성 명시**. 시드는 서울 + 밴쿠버 2개만 — 사용자가 다른 도시 진입 시 ErrorView (fetch 재시도 CTA + "현재 오프라인 데이터로 동작 중" 배지). v1.1 에서 "더 많은 시드 도시" 검토.

### 11. TESTING.md 인벤토리 갱신

§9.4 가 이미 매트릭스를 담고 있다. 본 step 에서 추가 작업:

1. §9.4 의 시그니처가 본 step 의 공개 API 와 1대1 일치하는지 확인 — 불일치 시 §9.4 갱신.
2. 통합 테스트 항목을 §9 후반에 추가 (현재는 단위 테스트 위주):
   ```
   ### 9.x dataLayer.integration.test.ts (신규)
   - [ ] 네트워크 실패 → 시드 fallback → 메모리 맵 갱신 → getCity / getAllCities 즉시 반환
   - [ ] 서울 KRW pass-through
   - [ ] 밴쿠버 CAD → KRW 변환 (hardcoded baseline 사용)
   - [ ] refreshCache: 캐시 삭제 + bypassCache + lastSync 갱신
   ```
   §9 의 적절한 위치 (§9.4 직후 또는 §9 의 끝) 에 새 subsection 추가.

### 12. `src/lib/index.ts` 마무리

```ts
export * from './errors';
export { validateCity, validateAllJson, parseAllCitiesText } from './citySchema';
export { convertToKRW, fetchExchangeRates, refreshFx } from './currency';
export { loadAllCities, getCity, getAllCities, refreshCache } from './data';
```

### 13. `app/_layout.tsx` 호출 추가 — **본 step 에서 하지 마라**

ARCHITECTURE 의 부팅 순서에는 `loadAllCities` 가 _layout 에서 호출돼야 하지만, 그 통합은 store hydration / splash 제어 로직과 얽혀 있어 별도 phase (예: `app-shell`) 의 책임. 본 step 은 lib 만 완성. _layout.tsx 는 손대지 않는다.

## Acceptance Criteria

```bash
npm run typecheck \
  && npm run lint \
  && npm test -- --coverage src/lib/__tests__ src/__fixtures__ __integration__
```

- typecheck / lint 통과
- 모든 lib 테스트 + 시드 round-trip + integration 테스트 통과
- coverage threshold (TESTING §4 기준 lib 100/95/100/100) 통과
- 새 파일: `src/lib/data.ts`, `src/lib/__tests__/data.test.ts`, `__integration__/dataLayer.integration.test.ts`
- 수정 파일: `src/lib/index.ts`, `docs/ADR.md` (+2 ADR), `docs/TESTING.md` §9.4 (시그니처 정렬) + 신규 통합 subsection
- (해당 시) `jest.config.js` testRegex / testMatch 에 `__integration__` 포함 1줄 수정

## 검증 절차

1. AC 명령 실행
2. **체크리스트:**
   - 모든 throws 가 카탈로그 (CityFetch/Timeout/Parse/SchemaInvalid/NotFound, AllCitiesUnavailable) 만 사용?
   - 캐시 키가 정확히 `data:all:v1` 인가?
   - primary URL 의 `<user>/<repo>` 가 실제 git remote 와 일치하는가?
   - 컴포넌트가 fetch 를 직접 호출하는 코드가 늘어나지 않았는가? (`grep -rn "fetch(" app/ src/components/ src/store/` 가 본 phase 진입 시점과 동일한가)
   - integration 테스트가 시드만으로 KRW 변환 round-trip 을 검증하는가?
3. `phases/data-layer/index.json` step 4 업데이트 + phase 전체 `completed` 처리:
   - step 4 → `"summary": "loadAllCities/getCity/getAllCities/refreshCache. GitHub raw → jsDelivr → seed fallback chain, data:all:v1 24h 캐시, in-flight dedup, 10s timeout. 통합 smoke (시드 + 환율 → KRW). ADR-K/L 추가."`
   - `phases/index.json` 의 `data-layer` 를 `"status": "completed"` 로 갱신

## 금지사항

- **`app/_layout.tsx` 수정 금지.** 이유: 부트로더 통합은 별도 phase. 본 phase 는 lib 한정.
- **`src/store/*` 수정 금지.** 이유: 동일.
- **컴포넌트 추가·수정 금지.** 이유: 동일.
- **에러 클래스 신규 추가 금지.** 이유: step 0 카탈로그가 단일 출처.
- **`scripts/build_data.mjs` 자동화 추가 금지.** 이유: 별도 automation phase.
- **`<user>/<repo>` 가 추출되지 않은 채 placeholder 채워넣기 금지.** 이유: 잘못된 URL 이 production 에 들어가면 모든 fetch 가 실패한다 → step 을 `blocked` 처리하고 사용자 결정 받아라.
- **integration 테스트가 실 네트워크에 의존하지 마라.** 이유: TESTING §1 결정성 정책. fetch 는 항상 mock.
- 기존 테스트 깨뜨리지 마라.
