# Step 1: ads-lib

## 배경

이 phase(`admob-banner-ads`)는 Google AdMob 하단 배너를 홈·비교·상세 3개 화면에 도입한다. step 0 스파이크가 `react-native-google-mobile-ads` 16.x 설치·네이티브 빌드 부팅·`.native.ts` 해석(`tsconfig` `moduleSuffixes`)을 검증했다.

**이 step 은 광고 SDK 를 경유하는 단일 지점 `src/lib/ads` 를 만든다.** CLAUDE.md 의 "외부 데이터는 lib 경유" 규칙을 광고 SDK 에도 적용한다 — 컴포넌트·화면은 `react-native-google-mobile-ads` 를 직접 import 하지 않으며, ESLint 가 이를 기계적으로 막는다.

이후 step: 2 store → 3 Screen footer → 4 AdBanner → 5 루트 트리거·화면 배선 → 6 설정 메뉴 → 7 처리방침 → 8 문서 → 9 릴리스·E2E.

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래를 반드시 직접 Read 할 것:

- `CLAUDE.md` — CRITICAL: `any` 금지, 에러 삼키기 금지, 외부 라이브러리 타입은 `unknown` + 타입 가드
- `docs/plans/admob-banner-ads.md` — §C (C-1~C-4), §J, §테스트의 "모킹 — jest.setup.js" 와 인벤토리 9.42 · 9.42-w 행
- `phases/admob-banner-ads/SPIKE_RESULT.md` — step 0 결과 (설치 버전, haste 설정 여부)
- `docs/ARCHITECTURE.md` §에러 핸들링 전략·§에러 타입 카탈로그 (261행 부근)
- `docs/TESTING.md` §5.1 전역 mock (116~162행 — jest.setup.js 사본이 문서에 있다, 함께 갱신), §9 인벤토리 형식 (예: §9.36·§9.37, 2529행 부근)
- `src/lib/errors.ts` — `AppError` 베이스 + 19개 클래스 (같은 형식으로 추가)
- `src/lib/currency.ts` 144행·284~317행·329행 — 모듈 스코프 `inflight` in-flight dedup + `__resetInflightForTesting` 패턴
- `src/lib/index.ts` — 배럴 export 스타일 (테스트 전용 `__reset*` 은 배럴에서 export 하지 않는다)
- `src/lib/__tests__/currency.test.ts` — inflight 멱등 테스트 패턴
- `jest.setup.js`, `jest.config.js` (coverage threshold `src/lib/**` 100/95/100/100), `.eslintrc.js`
- `node_modules/react-native-google-mobile-ads/src/AdsConsent.ts`, `src/specs/modules/NativeConsentModule.ts` — 실제 API 시그니처 (`gatherConsent`, `getConsentInfo`, `showPrivacyOptionsForm`, `AdsConsentInfo.canRequestAds`, `privacyOptionsRequirementStatus: 'REQUIRED' | 'NOT_REQUIRED' | 'UNKNOWN'`), `src/index.ts` (`mobileAds`, `TestIds`, `BannerAdSize` export 확인)

## 작업

### 1. `src/lib/errors.ts` — `AdsConfigError`

```ts
export class AdsConfigError extends AppError {
  readonly code = 'ADS_CONFIG';
}
```

파일 상단 주석의 클래스 수(19개)를 갱신하고, `docs/ARCHITECTURE.md` §에러 타입 카탈로그 표에 행을 추가한다 (발생 위치 `src/lib/ads.native.ts`, 의미: 프로덕션 모드인데 광고 단위 ID 가 placeholder).

### 2. `src/lib/ads.native.ts`

```ts
export type AdsMode = 'test' | 'production';
export type AdsStatus = 'idle' | 'initializing' | 'ready' | 'disabled';

export type AdsInitResult = {
  status: 'ready' | 'disabled';
  canRequestAds: boolean;
  privacyOptionsRequired: boolean; // 설정 메뉴 노출 조건 (privacyOptionsRequirementStatus === 'REQUIRED')
  error: Error | null;             // disabled 사유 또는 부분 실패 (AdsConfigError | 동의·초기화 실패)
};

/** 운영자가 AdMob 콘솔 값으로 교체. placeholder 패턴은 resolveBannerUnitId 가 거부한다. */
export const AD_UNIT_IDS = {
  ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY',
  android: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY',
} as const;

export function resolveAdsMode(env = process.env.EXPO_PUBLIC_ADS_TEST, dev = __DEV__): AdsMode;
// env === '1' || dev → 'test', 아니면 'production'

export function resolveBannerUnitId(mode: AdsMode, platform: 'ios' | 'android'): string;
// 'test' → TestIds.ADAPTIVE_BANNER
// 'production' → AD_UNIT_IDS[platform]; 값이 /X{16}\/Y{10}/ 패턴이면 AdsConfigError throw

export function initializeAds(): Promise<AdsInitResult>;   // throw 하지 않는다 — 실패는 결과 객체로
export function showPrivacyOptionsForm(): Promise<void>;   // AdsConsent.showPrivacyOptionsForm() 위임 (SDK 반환값은 버린다). 실패는 그대로 reject
export function __resetForTesting(): void;                 // inflight + 캐시 결과 초기화
```

`initializeAds()` 순서 (invertase 문서 권장 순서):

1. `resolveBannerUnitId(resolveAdsMode(), Platform.OS as 'ios' | 'android')` 로 설정 검증. `AdsConfigError` 면 **SDK 를 전혀 호출하지 않고** `{ status: 'disabled', canRequestAds: false, privacyOptionsRequired: false, error }` 반환. `Platform.OS` 가 ios/android 외면 같은 disabled 결과 (error 는 `AdsConfigError`).
2. `AdsConsent.gatherConsent()` — 필요한 지역에서만 폼이 뜬다. **reject 되어도 중단하지 않고** 3 으로 진행 (문서: 이전 세션 동의로 진행). 에러는 결과의 `error` 에 담는다.
3. `mobileAds().initialize()`.
4. `AdsConsent.getConsentInfo()` → `canRequestAds`, `privacyOptionsRequired = privacyOptionsRequirementStatus === 'REQUIRED'`.
5. 3·4 가 reject 되면 `{ status: 'disabled', canRequestAds: false, privacyOptionsRequired: false, error }`.
6. 성공: `{ status: 'ready', canRequestAds, privacyOptionsRequired, error: (2 의 에러 또는 null) }`.
7. **멱등**: 모듈 레벨 inflight promise (`currency.ts` 패턴). 동시 호출은 같은 Promise 를 받고, 완료 후 재호출은 캐시된 결과를 반환한다. `__resetForTesting()` 이 둘 다 초기화.
8. `error` 가 non-null 이면 `__DEV__` 에서 `console.error('[ads] …', error)` 1회 — `app/_layout.tsx` 의 `bridgeLastSyncFromMeta` 실패 처리와 동일 패턴. 삼키는 것이 아니라 **상태로 노출**하는 것이다 (ErrorView 는 띄우지 않는다 — 광고는 핵심 기능이 아님).

- `requestNonPersonalizedAdsOnly` 류 비맞춤형 강제 플래그는 쓰지 않는다. UMP 가 저장한 TCF 동의를 SDK 가 직접 읽는다.
- SDK 에러는 `unknown` 으로 받아 `Error` 인스턴스가 아니면 `new Error(String(e))` 로 감싼다 (`any` 금지).

### 3. `src/lib/ads.web.ts`

같은 export 시그니처. `initializeAds` 는 `{ status: 'disabled', canRequestAds: false, privacyOptionsRequired: false, error: null }` 을 즉시 resolve, `showPrivacyOptionsForm` 은 no-op resolve, `resolveAdsMode`/`resolveBannerUnitId`/`AD_UNIT_IDS` 는 native 와 동일 로직이되 `TestIds` 대신 문자열 상수 `'ca-app-pub-3940256099942544/2435281174'` 를 쓴다. **`react-native-google-mobile-ads` 를 import 하지 않는다.** 타입은 `ads.native.ts` 에서 `import type` 으로 가져오지 말고 두 파일이 각각 선언한다 (한쪽이 다른 쪽을 import 하면 웹 번들에 네이티브 모듈이 끌려온다). 중복을 피하려면 타입·`AD_UNIT_IDS`·`resolveAdsMode`·placeholder 판정만 `src/lib/adsConfig.ts` 로 분리해 양쪽이 import 하는 것을 **허용**한다 (SDK 미참조 파일이므로).

### 4. `src/lib/index.ts`

`initializeAds`, `showPrivacyOptionsForm`, `resolveAdsMode`, `resolveBannerUnitId`, `AD_UNIT_IDS` 와 타입 `AdsMode`, `AdsStatus`, `AdsInitResult` 를 `./ads` 에서 export (`ads.ts` 가 아니라 `ads` — Metro·jest·tsc 가 플랫폼 확장자를 고른다). `__resetForTesting` 은 배럴에서 export 하지 않는다 (currency 의 `__resetInflightForTesting` 과 같은 이유 — 파일 상단 주석에 한 줄 추가).

### 5. `jest.setup.js` — 전역 mock

```js
jest.mock('react-native-google-mobile-ads', () => ({
  __esModule: true,
  default: () => ({ initialize: jest.fn(async () => []) }),
  AdsConsent: {
    gatherConsent: jest.fn(async () => ({ status: 'NOT_REQUIRED', canRequestAds: true })),
    getConsentInfo: jest.fn(async () => ({ canRequestAds: true, privacyOptionsRequirementStatus: 'NOT_REQUIRED' })),
    showPrivacyOptionsForm: jest.fn(async () => undefined),
    reset: jest.fn(),
  },
  BannerAd: jest.fn(() => null), // step 4 테스트가 mock.calls[0][0].onAdLoaded() 로 로드/실패를 시뮬레이션. NativeWind 제약으로 JSX 미사용
  BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER' },
  TestIds: { ADAPTIVE_BANNER: 'ca-app-pub-3940256099942544/2435281174' },
}));
```

`default` 는 `mobileAds()` 호출 형태를 흉내 낸다. 테스트에서 호출 순서를 검증하려면 `initialize` 를 모듈 밖 변수로 끌어내 `jest.mock` factory 안에서 참조 (변수명 `mock*` 접두 필수 — jest 호이스팅 규칙). `docs/TESTING.md` §5.1 의 jest.setup.js 사본 코드블록에 같은 내용을 반영한다.

### 6. `.eslintrc.js` — `no-restricted-imports`

`rules` 에 추가:

```js
'no-restricted-imports': ['error', {
  paths: [{
    name: 'react-native-google-mobile-ads',
    message: '광고 SDK 는 src/lib/ads.native.ts 와 src/components/AdBanner.native.tsx 만 import 한다 (ADR-077).',
  }],
}],
```

`overrides` 에 `{ files: ['src/lib/ads.native.ts', 'src/components/AdBanner.native.tsx'], rules: { 'no-restricted-imports': 'off' } }`. `jest.setup.js` 는 이미 `ignorePatterns` 에 있어 별도 허용이 필요 없다 (설계 문서 §J 의 jest.setup.js 언급은 이 사실로 대체). `src/components/AdBanner.native.tsx` 는 step 4 에서 생기지만 override 는 지금 등록해 둔다.

검증: `src/lib/__spike-eslint.ts` 에 `import { TestIds } from 'react-native-google-mobile-ads';` 한 줄을 만들고 `npm run lint` 가 **실패**하는지 확인한 뒤 파일을 삭제한다.

### 7. 테스트 — `src/lib/__tests__/ads.test.ts` (+ `ads.web.test.ts`)

인벤토리 §9.42 (전부 작성):

- `resolveAdsMode`: env `'1'` → `test`; env 없음 + dev=true → `test`; env 없음 + dev=false → `production`; env `'0'` + dev=false → `production`
- `resolveBannerUnitId`: `test` → `TestIds.ADAPTIVE_BANNER`; `production` + placeholder → `AdsConfigError` throw (code `ADS_CONFIG`); `production` + 실제 형식(`ca-app-pub-1234567890123456/1234567890` 을 `jest.replaceProperty` 또는 모듈 격리로 주입) → 그대로 반환
- `initializeAds`: 호출 순서 `gatherConsent → initialize → getConsentInfo`; `gatherConsent` reject 여도 `initialize` 호출 + 결과 `error` 에 담김 + status `ready`; `initialize` reject → `disabled` + error; `AdsConfigError` 면 SDK 3종 **미호출** + `disabled`; `privacyOptionsRequirementStatus: 'REQUIRED'` → `privacyOptionsRequired: true`; 동시 2회 호출 → SDK 1회 + 같은 결과 (멱등); 완료 후 재호출 → SDK 추가 호출 0 + 캐시 결과; `__resetForTesting` 후 재실행 → SDK 재호출; `__DEV__` 에서 error 있을 때 `console.error` 1회 (`jest.spyOn(console, 'error').mockImplementation`)
- `showPrivacyOptionsForm`: `AdsConsent.showPrivacyOptionsForm` 1회 위임; reject 전파
- `Platform.OS = 'windows'` 류 → disabled + `AdsConfigError`
- §9.42-w `ads.web.ts`: `jest.isolateModules` 로 `require('../ads.web')` — disabled 즉시 반환, `showPrivacyOptionsForm` resolve, `jest.requireMock('react-native-google-mobile-ads')` 의 어떤 함수도 호출되지 않음

커버리지: `src/lib/**` 100/95/100/100 유지. `ads.web.ts` 가 커버리지 수집에서 빠지면(플랫폼 해석 때문에) `collectCoverageFrom` 에 명시적으로 포함하고 web 테스트로 채운다.

### 8. 문서

- `docs/TESTING.md` §9 에 `### 9.42 src/lib/ads.native.ts` + `### 9.42-w src/lib/ads.web.ts` 인벤토리 추가 (형식은 §9.37 참고). §5.1 갱신 (위 5). **인벤토리 누락 = step 미완.**
- `docs/ARCHITECTURE.md` §에러 타입 카탈로그 행 (위 1).

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm test -- --coverage --collectCoverageFrom='src/lib/**/*.ts'
grep -c 'AdsConfigError' src/lib/errors.ts docs/ARCHITECTURE.md         # 각 ≥ 1
grep -c 'no-restricted-imports' .eslintrc.js                              # ≥ 2 (rule + override)
grep -c '9.42' docs/TESTING.md                                            # ≥ 2
test ! -f src/lib/__spike-eslint.ts
```

## 검증 절차

1. 위 AC 를 실행한다. 커버리지 임계치(`src/lib/**` 100/95/100/100) 미달이면 실패다.
2. 아키텍처 체크리스트:
   - `ads.web.ts`(및 `adsConfig.ts`) 가 `react-native-google-mobile-ads` 를 참조하지 않는가? (`grep -l 'react-native-google-mobile-ads' src/lib/*.ts` 결과가 `ads.native.ts` 뿐)
   - `initializeAds` 가 절대 throw 하지 않고 결과 객체로 실패를 전달하는가? 에러가 `error` 필드 + `__DEV__` console.error 로 노출되는가? (silent fail 금지)
   - `any` 0건, SDK 에러는 `unknown` 으로 받는가?
   - 배럴이 `__resetForTesting` 을 노출하지 않는가?
   - ESLint 가 컴포넌트의 직접 import 를 거부하는 것을 의도적 위반 파일로 확인했는가?
3. 결과에 따라 `phases/admob-banner-ads/index.json` 의 step 1 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 에 생성 파일·export 목록·`adsConfig.ts` 분리 여부·커버리지 결과
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- `src/store/ads.ts`, `AdBanner`, `Screen`, 화면 파일을 만들거나 수정하지 마라. 이유: step 2~5 의 범위다. 이 step 은 lib 계층만 다룬다.
- `initializeAds` 에서 throw 하지 마라. 이유: 설계 결정 — 광고 실패는 부팅을 막지 않고 `disabled` 상태로 노출한다. 단 결과 `error` 필드를 비우거나 로그를 생략하는 것은 silent fail 로 금지.
- `ads.web.ts` 에서 `ads.native.ts` 를 import 하지 마라. 이유: 웹 번들에 네이티브 모듈이 끌려온다.
- `requestNonPersonalizedAdsOnly` 같은 비맞춤형 강제 옵션을 넣지 마라. 이유: UMP 동의 결과를 SDK 가 직접 읽는 설계다.
- `AD_UNIT_IDS` 에 실제 값을 지어 넣지 마라. 이유: 운영자가 AdMob 콘솔에서 받은 값만 유효하다. placeholder 는 프로덕션에서 `AdsConfigError` 로 광고가 꺼지도록 설계됐다.
- `tsconfig.json` 의 `moduleSuffixes` 를 되돌리지 마라. 이유: step 0 이 `.native.ts` 해석을 위해 추가했다.
- 기존 테스트를 깨뜨리지 마라.
