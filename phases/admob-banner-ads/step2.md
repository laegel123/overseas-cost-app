# Step 2: ads-store

## 배경

이 phase(`admob-banner-ads`)는 Google AdMob 하단 배너를 홈·비교·상세 3개 화면에 도입한다. step 1 이 `src/lib/ads` (`initializeAds(): Promise<AdsInitResult>`, `AdsStatus`, `AdsInitResult` 타입)를 만들었다.

**이 step 은 광고 초기화 상태를 담는 비영속 Zustand store `src/store/ads.ts` 를 만든다.** `AdBanner`(step 4) 는 이 store 의 `status === 'ready' && canRequestAds` 를 보고 렌더하고, 설정 화면(step 6) 은 `privacyOptionsRequired` 로 메뉴를 조건부 노출하며, 루트 레이아웃(step 5) 이 `begin()` → `initializeAds().then(settle)` 로 채운다.

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래를 반드시 직접 Read 할 것:

- `CLAUDE.md`
- `docs/plans/admob-banner-ads.md` §D, 인벤토리 9.43 행
- `docs/ARCHITECTURE.md` §상태 관리 (171~185행), §부팅·hydration 순서 (226행 부근)
- `docs/adr/004-*.md` (단일 거대 store 금지) — `docs/ADR.md` 에서 파일명 확인
- `src/lib/ads.native.ts` — step 1 산출물. `AdsStatus`, `AdsInitResult` 타입을 **재사용**한다 (`import type { AdsInitResult, AdsStatus } from '@/lib'`)
- `src/store/onboarding.ts` — store 파일 형식(doc comment · 타입 · `INITIAL_STATE` 상수). 단 이 store 는 **persist 를 쓰지 않는다**
- `src/store/hydration.ts` — `waitForAllStoresHydrated` 가 어떤 store 를 기다리는지 (**여기에 추가하지 않는다**)
- `src/store/index.ts` — 배럴 export 형식
- `src/store/__tests__/onboarding.test.ts` — store 테스트 형식
- `jest.config.js` — `src/store/**` 커버리지 100/90/100/100
- `docs/TESTING.md` §9 의 store 인벤토리 (예: §9.8) 형식

## 작업

### 1. `src/store/ads.ts`

```ts
import type { AdsInitResult, AdsStatus } from '@/lib';

export type AdsState = {
  status: AdsStatus;              // 'idle' | 'initializing' | 'ready' | 'disabled'
  canRequestAds: boolean;
  privacyOptionsRequired: boolean;
};

export type AdsActions = {
  begin: () => void;                          // status → 'initializing'
  settle: (result: AdsInitResult) => void;    // status/canRequestAds/privacyOptionsRequired 를 result 로
  reset: () => void;                          // INITIAL_STATE
};

export const INITIAL_STATE: AdsState = { status: 'idle', canRequestAds: false, privacyOptionsRequired: false };
export const useAdsStore = create<AdsState & AdsActions>()(...);
```

- **`persist` 없음.** 동의 상태는 UMP SDK 가 자체 저장하고, 초기화 결과는 매 부팅마다 다시 얻는다. `AsyncStorage` import 없음.
- **hydration 대기 목록(`src/store/hydration.ts`)에 넣지 않는다.** 영속 데이터가 없어 기다릴 것이 없고, 광고 초기화는 부팅을 막지 않는 비차단 흐름이다 (설계 결정, ADR-077 에 기록됨).
- `settle` 은 `result.error` 를 store 에 담지 않는다 — 에러 노출은 lib 이 `__DEV__` console.error 로 이미 했고, 화면은 status 만 본다.
- 이 store 는 throw 하지 않는다.

### 2. `src/store/index.ts`

`useAdsStore` 와 타입 `AdsState`, `AdsActions` export. 파일 상단 주석의 "7 도메인 store" 서술에 "+ 비영속 ads store (hydration 미참여)" 를 한 줄 덧붙인다.

### 3. 테스트 — `src/store/__tests__/ads.test.ts` (§9.43)

- 초기 상태가 `INITIAL_STATE` 와 동일 (`idle` / false / false)
- `begin()` → `initializing`, 다른 필드 불변
- `settle({ status: 'ready', canRequestAds: true, privacyOptionsRequired: true, error: null })` → 세 필드 반영
- `settle({ status: 'disabled', canRequestAds: false, privacyOptionsRequired: false, error: new Error('x') })` → `disabled`, error 는 store 에 없음
- `reset()` → `INITIAL_STATE`
- persist 미사용: 액션 호출 후 `AsyncStorage.setItem` mock 호출 0회 (`@react-native-async-storage/async-storage` mock 은 `jest.setup.js` 전역)
- `useAdsStore.persist` 가 `undefined`

각 테스트 전 `useAdsStore.getState().reset()`.

### 4. 문서

- `docs/TESTING.md` §9 에 `### 9.43 src/store/ads.ts` 인벤토리 추가 (**누락 = step 미완**).
- `docs/ARCHITECTURE.md` §상태 관리 — store 목록에 `useAdsStore` 한 줄 추가 ("비영속, hydration 합성 미참여, 광고 초기화 상태 — ADR-077").

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm test -- --coverage --collectCoverageFrom='src/store/**/*.ts'
grep -c 'useAdsStore' src/store/index.ts docs/ARCHITECTURE.md    # 각 ≥ 1
grep -c 'persist' src/store/ads.ts                               # 0 (주석에도 쓰지 말 것 — grep 검증 단순화)
grep -c 'useAdsStore' src/store/hydration.ts                     # 0
grep -c '9.43' docs/TESTING.md                                   # ≥ 1
```

## 검증 절차

1. 위 AC 를 실행한다. `src/store/**` 커버리지 100/90/100/100 유지.
2. 아키텍처 체크리스트:
   - 단일 목적 store 인가? (ADR-004)
   - persist·AsyncStorage 미사용, hydration 미참여인가?
   - 타입을 lib 에서 재사용하고 중복 선언하지 않았는가?
3. 결과에 따라 `phases/admob-banner-ads/index.json` 의 step 2 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` (파일·액션·hydration 미참여 사실)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- `src/store/hydration.ts` 의 대기 목록에 이 store 를 넣지 마라. 이유: 영속 데이터가 없고, 광고 초기화는 부팅 비차단 흐름이다. 넣으면 `waitForStoresOrTimeout` 이 광고 SDK 를 기다리게 된다.
- `persist` 미들웨어를 쓰지 마라. 이유: 동의 상태는 UMP SDK 가 저장한다. 앱이 중복 저장하면 두 출처가 어긋난다.
- `app/_layout.tsx`, `AdBanner`, 화면 파일을 수정하지 마라. 이유: step 4·5 의 범위다.
- `src/lib/ads.native.ts` 를 수정하지 마라. 이유: step 1 에서 완성됐다. 타입이 부족하면 이 step 을 `error` 로 두고 사유를 적는다.
- 기존 테스트를 깨뜨리지 마라.
