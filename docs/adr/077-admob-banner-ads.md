[← ADR 인덱스](../ADR.md)

# ADR-077: Google AdMob 하단 배너 광고 도입

**상태:** 채택 (2026-09-17) · **Supersedes ADR-011** (광고 SDK 부분만 — 분석·오류 추적 SDK 미도입은 여전히 유효)

**맥락:**

앱을 스토어에 배포하면서 운영비를 광고로 회수하기로 했다. 데이터 출처 약관이 광고
(상업 이용)를 막는지는 ADR-076 에서 대조했고, 공공 출처는 전부 상업 이용을 허용한다.
실제 부담은 약관이 아니라 **광고 SDK 가 "개인정보 수집 0건" 전제를 깨뜨린다**는 점이다.
ADR-011 은 "분석/오류 추적 SDK 를 도입하지 않는다" 를 근거로 처리방침·스토어 개인정보
라벨·PIPA 고지를 전부 "수집 없음" 으로 단순화했는데, AdMob SDK 는 기기 광고 식별자
(IDFA·광고 ID)·대략적 위치·광고 상호작용·진단 정보를 수집하고 Google LLC 로 국외 이전한다.

사용자가 확정한 제품 결정 (2026-09-16, 설계 문서 `docs/plans/admob-banner-ads.md`):
배너만 · 홈·비교·상세 3개 화면 · iOS ATT 표시 · 버전 1.1.0 · 네트워크는 Google AdMob.
이 ADR 은 그 결정과 phase `admob-banner-ads` step 0~7 의 **구현**을 고정한다. 설계
문서와 구현이 다른 곳은 구현을 기준으로 적고 차이를 명시한다.

**결정:**

1. **네트워크·라이브러리·형식.** Google AdMob, `react-native-google-mobile-ads`
   **`16.3.4` 정확 고정** (`^` 없음). 네이티브 SDK 는 iOS Google-Mobile-Ads-SDK 13.1.0 ·
   UMP 3.1.0 / Android play-services-ads 25.0.0 · UMP 4.0.0. 형식은 화면 하단 고정
   **anchored adaptive 배너 1종** (`BannerAdSize.ANCHORED_ADAPTIVE_BANNER`).
   - 16.4.0·16.5.0 을 쓰지 않는 이유: 둘 다 play-services-ads 25.4.0 을 끌어오는데 그
     AAR 의 Kotlin 메타데이터가 **2.3.0** 이다. Expo SDK 54 (`react-native` 0.81.5) 의
     Kotlin 은 2.1.20 이고 한 단계 위(2.2)까지만 읽는다 → Android EAS 빌드가
     `compileReleaseKotlin` 에서 실패 (빌드 `b5aafd52`). 25.0.0 은 메타데이터 2.2.0 이라
     16.3.4 로 빌드가 끝났다 (빌드 `55d11aac`, FINISHED). 범위 지정은 16.4+ 로 재해석될
     수 있어 정확 고정한다. **해제 조건**: Kotlin ≥ 2.2 를 쓰는 Expo SDK 로 올릴 때 재검토.
   - `ANCHORED_ADAPTIVE_BANNER` 는 16.3.4 타입에 `@deprecated Use LARGE_ANCHORED_ADAPTIVE_BANNER`
     표시가 있으나 값은 동작한다. 설계대로 이 값을 쓰고, 라이브러리 버전을 올릴 때 함께 검토한다.
   - `app.json` plugin 에 App ID(현재 Google 공식 샘플값)·`userTrackingUsageDescription`
     (한국어 목적 문구)·SKAdNetwork 식별자 50개를 둔다. App ID 는 바이너리에 그대로
     들어가는 공개값이라 커밋한다.

2. **노출 화면 = 홈·비교·상세의 ready 상태만.** `app/(tabs)/index.tsx`,
   `app/compare/[cityId].tsx`, `app/detail/[cityId]/[category].tsx` 의 **ready 분기
   `<Screen>` 에만** `footer={<AdBanner />}` 를 둔다. 같은 파일의 loading·error `<Screen>`
   에는 두지 않는다 — AdMob 은 콘텐츠 없는 화면(로딩·에러)에 붙은 광고를 무효 트래픽
   요인으로 본다. 온보딩·설정·출처(`/sources`, `/sources/[cityId]`)·개인정보(`/privacy`)
   화면에는 광고를 두지 않는다.
   - `Screen.footer` 는 광고를 모르는 레이아웃 슬롯이다. `SafeAreaView` 의 마지막 자식으로
     ScrollView(또는 inner View) 의 **형제**로 렌더하고, 래퍼·padding·배경을 더하지 않는다
     (배너가 폭 전체 사용). 스크롤 콘텐츠 밖에 고정된다.
   - 홈은 Tabs 안이라 배너가 `BottomTabBar` 바로 위에 온다. AdMob 은 내비게이션 인접
     배너를 권장하지 않으므로 배너 상단 `border-t border-line` 으로 구분하고 간격은 두지
     않는다. 실측 오클릭 문제가 생기면 홈만 제외하는 것을 1차 대응으로 한다.

3. **동의 흐름 = UMP → SDK 초기화 → 동의 상태 조회, 부팅 비차단.**
   - 트리거: `app/_layout.tsx` effect — `if (!bootReady || !onboarded) return;` →
     `beginAds()` → `initializeAds().then(settleAds)`. 온보딩 미완료면 시작하지 않으므로
     **온보딩 화면 위에는 어떤 프롬프트도 뜨지 않는다.** 첫 실행에서는 도시 선택 →
     `setOnboarded(true)` 커밋 → Compare 화면 위에서 동의 폼·ATT 가 뜬다. splash 해제는
     이 흐름을 기다리지 않는다.
   - `initializeAds()` 순서 (`src/lib/ads.native.ts`):
     (a) 설정 검증 `resolveBannerUnitId(resolveAdsMode(), Platform.OS)` — 실패면 SDK 를
     건드리지 않고 `disabled`. (b) `AdsConsent.gatherConsent()` — 필요한 지역에서만 폼을
     띄운다. **실패해도 중단하지 않고** 다음 단계로 간다 (이전 세션 동의로 진행, 에러는
     결과에 담음). (c) `mobileAds().initialize()`. (d) `AdsConsent.getConsentInfo()` →
     `canRequestAds`, `privacyOptionsRequired = privacyOptionsRequirementStatus === 'REQUIRED'`.
   - **iOS ATT 를 쓴다.** 앱 코드는 ATT API 를 직접 호출하지 않는다 — UMP 가 AdMob 콘솔에
     게시된 IDFA 설명 메시지와 함께 `gatherConsent` 안에서 시스템 알림을 띄운다. 샘플
     App ID·메시지 미게시 상태에서는 뜨지 않는다.
   - 비맞춤형 강제 플래그(`requestNonPersonalizedAdsOnly`)는 쓰지 않는다. UMP 가 저장한
     TCF 동의를 SDK 가 직접 읽는다 (`gatherConsent` 도 인자 없이 호출).
   - **멱등.** 첫 호출의 Promise 를 세션 동안 캐시한다 — 동시 호출은 한 번만 실행되고,
     완료 뒤 재호출은 캐시된 결과(실패 포함)를 돌려준다. 세션 안 재시도는 없다.
   - 설정 화면 "광고 개인정보 설정"(`menu-ads-privacy`)은 `privacyOptionsRequired` 일 때만
     "개인정보 처리방침" 과 "앱 정보" 사이에 렌더한다 (EEA·영국·스위스). 요청되지 않은
     기능이 아니라 **TCF 의 동의 철회 진입점 의무**다. 탭 → `showPrivacyOptionsForm()`,
     reject 면 `Alert('알림', '광고 설정 화면을 열지 못했어요. 잠시 후 다시 시도해 주세요.')`.

4. **광고 SDK 경유 단일 지점.** CLAUDE.md 의 "외부 데이터는 lib 경유" 규칙을 광고 SDK
   에도 적용한다.
   - `src/lib/ads.native.ts` — SDK import. `initializeAds` · `showPrivacyOptionsForm`
     (위임, reject 전파) · `resolveBannerUnitId` · `__resetForTesting`(배럴 미노출).
   - `src/lib/ads.web.ts` — SDK·native 파일 미참조. `initializeAds` 는
     `{ status: 'disabled', canRequestAds: false, privacyOptionsRequired: false, error: null }`
     즉시 resolve, `showPrivacyOptionsForm` 은 no-op.
   - `src/lib/adsConfig.ts` — SDK 미참조 공유 모듈. 타입 `AdsMode`·`AdsStatus`·`AdsInitResult`,
     `AD_UNIT_IDS`, `resolveAdsMode`, `resolveProductionUnitId`. (설계에 없던 분리 — native·web
     이 같은 설정 로직을 쓰되 웹 번들에 SDK 가 끌려오지 않게 한다.)
   - `src/components/AdBanner.native.tsx` — `BannerAd` 는 네이티브 뷰라 lib 으로 감쌀 수
     없어, SDK 를 import 하는 **두 번째이자 마지막** 파일로 허용한다. `AdBanner.web.tsx` 는
     항상 `null`.
   - 강제: `.eslintrc.js` `no-restricted-imports` 가 `react-native-google-mobile-ads` 를
     금지하고 위 두 파일만 override 로 허용한다 (`jest.setup.js` 의 전역 mock 은 ESLint
     ignore 대상).
   - 배럴은 확장자 없이 `./ads`·`./AdBanner` 를 export — Metro·jest·tsc 가 플랫폼 파일을 고른다.

5. **테스트/프로덕션 스위치.** `resolveAdsMode(env = process.env.EXPO_PUBLIC_ADS_TEST, dev = __DEV__)`
   가 `env === '1' || dev` 면 `'test'` → `TestIds.ADAPTIVE_BANNER`, 아니면 `'production'` →
   `AD_UNIT_IDS[platform]`. 개발·프리뷰 빌드는 `EXPO_PUBLIC_ADS_TEST=1` 로 빌드해 Google
   테스트 광고 단위만 쓴다 (프리뷰를 지인에게 배포해도 무효 트래픽 없음).
   - `AD_UNIT_IDS` 는 placeholder(`ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY`)로 커밋돼 있다.
     프로덕션 모드에서 placeholder 패턴(`/X{16}\/Y{10}/`)이면 `AdsConfigError`
     (`ADS_CONFIG`) → `initializeAds` 가 SDK 호출 없이 `disabled`. ios/android 외
     플랫폼도 같은 에러로 `disabled`.
   - **빌드 실패가 아니라 광고만 꺼진다.** 개발·프리뷰 빌드가 샘플값으로 빌드돼야 하므로
     빌드 타임 검증을 두지 않는다. 대신 실제 App ID·`AD_UNIT_IDS` 교체를
     `docs/RELEASE_CHECKLIST.md` 로 강제한다.

6. **에러 정책 — ErrorView 없이 상태로 노출.** 광고는 핵심 기능이 아니고 no-fill 은 정상
   상황이라 ErrorView·inline 배지를 띄우지 않는다. CLAUDE.md 의 "silent fail 금지" 는
   다음 세 경로로 지킨다 — **삼키는 것이 아니라 상태로 노출**한다.
   - 결과 객체: `initializeAds` 는 throw·reject 하지 않고 `AdsInitResult.error`
     (`AdsConfigError` | 동의·초기화 실패)에 **반드시** 담는다. `initialize`·`getConsentInfo`
     실패는 `disabled`, `gatherConsent` 단독 실패는 `ready` + `error` (부분 실패).
   - store: `settle(result)` 가 `status`·`canRequestAds`·`privacyOptionsRequired` 를 반영한다.
     `error` 는 store 에 보관하지 않는다 — 화면은 `status` 만 본다.
   - 로그: `__DEV__` 에서 `console.error('[ads] initialization error:', error)` 를 세션당 1회,
     배너 로드 실패는 `console.error('[ads] banner load failed:', error)`. 프로덕션 콘솔 로그는 없다.
   - 루트 레이아웃은 `.catch` 를 붙이지 않는다 — `initializeAds` 가 reject 하지 않으므로
     catch 는 삼키기만 된다. `ready` 인데 `AdBanner` 의 unit ID 해석이 throw 하면 설정
     불일치 버그이므로 try/catch 없이 ErrorBoundary 로 노출한다.

7. **배너 높이는 SDK 가 계산한다 — 코드에 px 없음.** 펼친 높이는 SDK 가 기기 폭에 맞춰
   정한다. 컨테이너 클래스는 토큰만 쓴다 (로드 후 `bg-white border-t border-line items-center`,
   로드 전·실패 `h-0 overflow-hidden`). 따라서 **디자인 토큰·매직 넘버 규칙의 예외가 아니다**
   — 규칙을 그대로 지킨다.
   - 로드 전·실패·오프라인·동의 미완료면 높이 0 으로 기존 레이아웃과 같다. placeholder 높이를
     예약하지 않는 대신 **로드 후 1회의 레이아웃 시프트를 수용**한다.
   - 로드 실패여도 `BannerAd` 는 언마운트하지 않는다 (SDK 자동 재시도 보존).
   - 접근성: 컨테이너 `accessibilityLabel="광고"` + `accessibilityRole="none"` (SDK 뷰가 자체
     라벨을 가짐). `testID` 기본값 `ad-banner` — 접힌 상태도 같은 값.

8. **`useAdsStore` 는 비영속·hydration 미참여.** `src/store/ads.ts` 는 zustand `create` 만
   쓰고 `persist`·AsyncStorage 가 없다. 동의 상태는 UMP SDK 가 자체 저장하고 초기화 결과는
   매 부팅 `initializeAds()` 로 다시 얻는다 — 앱이 중복 저장하면 두 출처가 어긋난다.
   `waitForStoresOrTimeout`·`hydration.ts` 는 무변경. 상태는
   `idle → initializing → ready | disabled`, 액션은 `begin`·`settle`·`reset`.

9. **버전·빌드 설정.**
   - **버전 1.1.0.** 네이티브 의존성 추가라 새 바이너리가 필요하지만 호환성 파괴가 아닌
     기능 추가이므로 major 가 아니다. `runtimeVersion.policy = appVersion` 이라 `version` 을
     올리면 OTA 호환 키도 갈려 1.0.x 바이너리에 1.1.0 JS 가 가지 않는다 (`docs/RELEASE.md` §1).
   - **`tsconfig.json` `moduleSuffixes: [".ios", ".android", ".native", ""]` 추가.**
     `./ads`·`./AdBanner` 는 플랫폼 중립 파일이 없어 tsc 가 `TS2307` 을 낸다. Metro 와
     jest(jest-expo preset — haste 설정 추가 불필요)는 원래 플랫폼 확장자를 해석한다.
     tsc 는 `.native` 를 고르므로 web 파일의 export 시그니처 일치는 테스트(TESTING §9.42-w·§9.44)로 지킨다.
   - **`expo-build-properties` 는 추가하지 않는다.** iOS 는 정적 프레임워크 설정 없이
     빌드·스모크가 통과했고, Android 는 16.3.4 고정으로 빌드가 끝났다. 스파이크의 iOS
     로컬 빌드 장애(Xcode 27 에 Simulator.app 부재, 기존 pod 포함 deployment target 에러)는
     광고 SDK 와 무관해 빌드 설정으로 대응하지 않았다 (`phases/admob-banner-ads/SPIKE_RESULT.md` §4).
   - **Expo Go 로는 실행할 수 없다** (네이티브 모듈). dev build(`npx expo run:ios`)가 필요하다.
     Android `development` 프로필은 `expo-dev-client` 미설치로 EAS 가 거부해 빌드 검증은
     `preview` 프로필로 했다 — dev client 도입은 별도 결정.

**결과:**

- **처리방침·스토어 공개가 SDK 실태를 따른다.** 정본 `src/lib/privacyPolicy.json` 에
  '광고' 섹션(Google LLC 국외 이전, IDFA·광고 ID 등 수집 항목)과 lead 개정 → `npm run gen:privacy`
  (ADR-072). App Store 개인정보 라벨·ATT 사용, Play Data safety, PIPA 표는 `docs/RELEASE.md`
  §5·§6.1 과 `docs/store-metadata.md` §6. **SDK 버전·설정을 바꿀 때 이 공개 항목과 어긋나면 안 된다.**
- ADR-011 의 광고 부분은 폐기, **분석·오류 추적 SDK 미도입은 유효**하다.
- 동의 폼·ATT 는 E2E 로 검증할 수 없다 — Maestro `launchApp` 기본 permissions 가 시뮬레이터에
  추적 권한을 미리 허용으로 기록해 ATT 가 구조적으로 뜨지 않는다. `docs/TESTING.md` §18.9 수동 체크.

**대안 (기각):**

- **Kakao AdFit** — React Native/Expo 공식 지원이 없다. 자체 네이티브 모듈을 작성·유지해야 해
  Managed Workflow 와 사이드 프로젝트 규모에 맞지 않는다.
- **전면 광고(interstitial)** — AdMob 전면 광고 배치 정책(콘텐츠 전환 지점 한정·예기치 않은
  노출 금지)을 지키기 어렵고, 도시 비교 흐름을 끊는다. 배너 1종으로 시작한다.
- **분석 SDK 동시 도입** — 범위 밖. 처리방침·라벨의 수집 항목이 더 늘고, ADR-011 의 판단
  (정성 피드백 우선)은 광고와 무관하게 유효하다.
- **placeholder 광고 단위를 빌드 타임에 실패시키기** — 샘플값으로 빌드해야 하는 개발·프리뷰
  빌드까지 막는다. 런타임 `AdsConfigError` + 릴리스 체크리스트로 대체.

**트레이드오프:**

- "개인정보 수집 0건" 이라는 단순한 전제를 잃는다. 처리방침·스토어 라벨·국외이전 고지를
  SDK 변경마다 맞춰야 한다.
- 로드 후 1회의 레이아웃 시프트. 홈은 탭바 인접 배치라 오클릭 위험이 남는다.
- 프로덕션에서 광고 실패는 사용자 화면에 드러나지 않는다 (배너 부재뿐). 개발 로그와 결과
  객체로만 원인을 본다. 세션 안 초기화 재시도가 없어 다음 콜드 스타트까지 광고가 꺼진다.
- Expo Go 사용 불가 — 모든 개발·E2E 가 dev build 를 전제한다.
- 라이브러리가 16.3.4 에 묶여 Expo SDK 업그레이드 전까지 SDK 최신 수정을 받지 못한다.

**후속 (범위 밖):**

- 미디에이션, 광고 빈도 제어, 전면·보상형 광고.
- 다크 모드 배너 배경, 태블릿 레이아웃.
- 출처명 전반의 ADR 번호·계산식 노출 정리 (HUD·StatCan CPI·BLS) — 별도 부채.
- 홈 ready `Screen` 의 하단 inset 중복 (`BottomTabBar` 가 `insets.bottom` 을 이미 적용하는데
  `Screen` 기본 edges 도 bottom 포함 → 배너와 탭바 사이 흰 띠). 광고 도입 전부터 있던 결함 — 수정 여부 결정 필요.
- `LARGE_ANCHORED_ADAPTIVE_BANNER` 전환, Kotlin ≥ 2.2 Expo SDK 에서 16.4+ 재검토.
- 운영자 수동 작업 (코드 무관): AdMob 계정·실제 App ID(`app.json`)·배너 광고 단위(`AD_UNIT_IDS`)·
  GDPR/IDFA 메시지 게시·`app-ads.txt`(`laegel123.github.io` 루트)·스토어 개인정보 라벨 —
  `docs/RELEASE_CHECKLIST.md`.

**검증:**

- `src/lib/__tests__/ads.test.ts`·`ads.web.test.ts` (TESTING §9.42·§9.42-w), `src/store/__tests__/ads.test.ts`
  (§9.43), `src/components/__tests__/AdBanner.test.tsx` (§9.44), `Screen.test.tsx` footer (§9.45),
  `app/__tests__/_layout.test.tsx` 광고 트리거 (§9.46), 홈·비교·상세 화면 테스트의 광고 배너 블록
  (§9.24·§9.25·§9.26), 설정 조건부 메뉴 (§9.29), 처리방침 광고 섹션 (§9.40).
- `npm run lint` — 컴포넌트·화면의 SDK 직접 import 를 `no-restricted-imports` 가 거부.
- 시뮬레이터(iPhone 17 Pro): 홈·비교·상세 하단에 테스트 배너 표시, 온보딩·설정에는 없음 (phase step 5).
