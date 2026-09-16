# Step 4: ad-banner

## 배경

이 phase(`admob-banner-ads`)는 Google AdMob 하단 배너를 홈·비교·상세 3개 화면에 도입한다. 지금까지: step 1 `src/lib/ads` (SDK 경유 단일 지점, `resolveAdsMode`/`resolveBannerUnitId`), step 2 `useAdsStore` (`status`, `canRequestAds`), step 3 `Screen.footer` 슬롯.

**이 step 은 배너 컴포넌트 `src/components/AdBanner.native.tsx` / `AdBanner.web.tsx` 를 만든다.** 화면 배선은 step 5 다. 핵심 규칙: **광고가 실제로 로드된 뒤에만 높이를 차지한다.** 로드 전·실패·오프라인·동의 미완료면 슬롯이 접혀 기존 레이아웃과 동일하다.

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래를 반드시 직접 Read 할 것:

- `CLAUDE.md` — 토큰 단일 출처, 매직 넘버 금지, silent fail 금지
- `docs/plans/admob-banner-ads.md` §E, §G 의 배너 시각 규칙(탭바 인접 `border-t`), 인벤토리 9.44 행, §테스트의 `BannerAd` mock 설명
- `docs/UI_GUIDE.md` §색상 토큰, §AI 슬롭 안티패턴
- `src/lib/ads.native.ts`, `src/lib/index.ts` — `resolveAdsMode`, `resolveBannerUnitId` 시그니처
- `src/store/ads.ts` — `useAdsStore` 셀렉터
- `src/components/Screen.tsx` — footer 슬롯 (이 컴포넌트가 들어갈 자리)
- `src/components/MenuRow.tsx` 또는 `RegionPill.tsx` — 컴포넌트 파일 형식·doc comment·NativeWind 클래스 사용 예
- `src/components/index.ts` — 배럴 형식
- `jest.setup.js` — step 1 이 추가한 `react-native-google-mobile-ads` mock (`BannerAd` 는 `jest.fn(() => null)`)
- `.eslintrc.js` — step 1 이 등록한 override (`src/components/AdBanner.native.tsx` 만 SDK import 허용)
- `node_modules/react-native-google-mobile-ads/src/ads/BannerAd.tsx` (또는 `src/index.ts`) — `BannerAd` props (`unitId`, `size`, `onAdLoaded`, `onAdFailedToLoad`), `BannerAdSize.ANCHORED_ADAPTIVE_BANNER`
- `tailwind.config.js` — 사용 가능한 색·border 토큰 (`bg-white`, `border-line`)
- `docs/TESTING.md` §9 컴포넌트 인벤토리 형식 (예: `MenuRow` 절)

## 작업

### 1. `src/components/AdBanner.native.tsx`

```tsx
export type AdBannerProps = { testID?: string };   // 기본값 'ad-banner'
export function AdBanner({ testID = 'ad-banner' }: AdBannerProps): React.ReactElement | null;
```

- **렌더 조건**: `useAdsStore((s) => s.status === 'ready' && s.canRequestAds)` 가 false 면 `null`. `Platform.OS` 가 `'ios' | 'android'` 가 아니면 `null`.
- `unitId = resolveBannerUnitId(resolveAdsMode(), Platform.OS)` — `useMemo` 로 1회 계산. `AdsConfigError` 가 throw 될 수 있으나 store 가 `ready` 라면 lib 이 이미 같은 검증을 통과한 뒤이므로 여기서 다시 잡지 않는다 (잡아서 삼키지 말 것 — 발생하면 ErrorBoundary 로 간다).
- 로컬 state `loaded: boolean` (초기 false). `onAdLoaded` → true. `onAdFailedToLoad(err)` → false + `__DEV__` 에서 `console.error('[ads] banner load failed:', err)` (silent fail 금지). `loaded === false` 여도 **`BannerAd` 는 마운트 유지** (재시도는 SDK 가 함) 하되 컨테이너를 접는다.
- 컨테이너 클래스: 접힘 `h-0 overflow-hidden`, 펼침 `bg-white border-t border-line items-center`. 높이는 SDK 가 기기 폭에 맞춰 계산하므로 코드에 px 를 쓰지 않는다 (매직 넘버 규칙과 충돌 없음 — ADR-077 에 명시 예정).
- `size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}`.
- 접근성: 컨테이너 `accessibilityLabel="광고"`, `accessibilityRole="none"` (SDK 뷰가 자체 라벨을 가짐). `testID` 는 접힌 상태에서도 같은 값 (E2E 가 존재만 확인 가능).
- 이 파일만 `react-native-google-mobile-ads` 를 직접 import 한다 (ESLint override).

### 2. `src/components/AdBanner.web.tsx`

같은 `AdBannerProps` 를 선언하고 항상 `null` 을 반환. SDK 미참조.

### 3. `src/components/index.ts`

`AdBanner`, `AdBannerProps` export (`./AdBanner` — 확장자 없이).

### 4. 테스트 — `src/components/__tests__/AdBanner.test.tsx` (§9.44)

`useAdsStore.setState(...)` 로 상태를 주입하고, `jest.requireMock('react-native-google-mobile-ads').BannerAd` 의 `mock.calls` 로 props 를 검사한다:

- `status: 'idle'` → `null` (`queryByTestId('ad-banner')` null, `BannerAd` 미호출)
- `status: 'ready', canRequestAds: false` → `null`
- `status: 'disabled'` → `null`
- `ready + canRequestAds` → `BannerAd` 1회 호출, `unitId === TestIds.ADAPTIVE_BANNER` (테스트 환경은 `__DEV__` → test 모드), `size === 'ANCHORED_ADAPTIVE_BANNER'`
- 로드 전 컨테이너 className 에 `h-0` 포함 → `act(() => props.onAdLoaded())` 후 `h-0` 없음 + `border-t` 포함
- `onAdFailedToLoad(new Error('no fill'))` → 다시 `h-0` + `console.error` 1회 (`jest.spyOn`)
- 컨테이너 `accessibilityLabel === '광고'`
- `testID` 기본값 `ad-banner`, prop 으로 override 가능
- `Platform.OS = 'web'` 주입(`jest.replaceProperty(Platform, 'OS', 'web')`) → `null`
- `AdBanner.web.tsx`: `jest.isolateModules` 로 로드 → `null`, SDK mock 미호출

### 5. 문서

- `docs/TESTING.md` §9 에 `### 9.44 src/components/AdBanner.native.tsx` 인벤토리 (**누락 = step 미완**).

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm test -- src/components
grep -l 'react-native-google-mobile-ads' src/components/*.tsx            # AdBanner.native.tsx 한 줄만
grep -c 'AdBanner' src/components/index.ts                               # ≥ 1
grep -c '9.44' docs/TESTING.md                                           # ≥ 1
```

## 검증 절차

1. 위 AC 를 실행한다. `src/components/**` 커버리지 85/75/85/85 유지.
2. 아키텍처 체크리스트:
   - 색·border 가 토큰 클래스만인가? px 매직 넘버 0건인가?
   - 로드 실패가 console.error 로 노출되는가? (삼키지 않음)
   - 로드 전·실패 시 높이 0 인가? (레이아웃 불변)
   - `AdBanner.web.tsx` 가 SDK 를 참조하지 않는가?
   - `Screen` 이나 화면 파일을 건드리지 않았는가?
3. 결과에 따라 `phases/admob-banner-ads/index.json` 의 step 4 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- 화면 파일(`app/**`)이나 `Screen.tsx` 를 수정하지 마라. 이유: 배선은 step 5 의 범위.
- 로드 전 placeholder 높이(예: 50px)를 예약하지 마라. 이유: 설계 결정 — 로드 후 1회 레이아웃 시프트를 수용하는 대신 실패·오프라인에서 빈 공간이 남지 않게 한다.
- `onAdFailedToLoad` 에서 `BannerAd` 를 언마운트하지 마라. 이유: SDK 의 자동 재시도를 잃는다.
- `AdsConfigError` 를 컴포넌트에서 try/catch 로 삼키지 마라. 이유: store 가 `ready` 인 상태에서는 발생할 수 없고, 발생한다면 설정 불일치 버그이므로 ErrorBoundary 로 드러나야 한다.
- 색상 리터럴(`#fff` 등)을 쓰지 마라. 이유: CLAUDE.md CRITICAL, ESLint `react-native/no-color-literals` 가 warn → `--max-warnings 0` 으로 실패한다.
- 기존 테스트를 깨뜨리지 마라.
