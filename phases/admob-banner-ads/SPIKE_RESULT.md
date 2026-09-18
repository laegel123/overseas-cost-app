# Step 0 스파이크 결과 — react-native-google-mobile-ads

- 실행일: 2026-09-17 (13:53 ~ 14:22 KST, 약 30분)
- 환경: macOS 26.6.2 · Xcode 27.0 (27A266a) · 시뮬레이터 iPhone 17 Pro (iOS 26.5 런타임) · eas-cli 로그인 `juno1001`
- 결론: **iOS 로컬 빌드·부팅·스모크 통과, Android EAS 빌드 FINISHED.** 단 16.5.0 은 Android 에서 빌드 불가 → **16.3.4 로 정확 고정**.

## 1. 설치 버전

| 항목 | 값 |
| --- | --- |
| 최초 설치 | `npx expo install react-native-google-mobile-ads -- --legacy-peer-deps` → `^16.5.0` (16.5.0) |
| 최종 고정 | `npm install react-native-google-mobile-ads@16.3.4 --save-exact --legacy-peer-deps` → `"16.3.4"` |
| 16.3.4 네이티브 SDK | iOS Google-Mobile-Ads-SDK 13.1.0 · UMP 3.1.0 / Android play-services-ads 25.0.0 · UMP 4.0.0 |
| 16.5.0 네이티브 SDK (폐기) | iOS 13.5.0 · UMP 3.1.0 / Android play-services-ads 25.4.0 · UMP 4.0.0 |

- `expo install` 이 `app.json` plugins 에 문자열 `"react-native-google-mobile-ads"` 를 자동 추가함 → 옵션 객체 튜플로 교체.
- `package-lock.json` 의 `devOptional → dev` 다수 변경은 `--legacy-peer-deps` 설치 시 npm 이 재계산한 부산물.

### 16.5.0 → 16.3.4 고정 사유 (ADR-077 에 옮길 것)

- Android EAS 빌드 `b5aafd52-30ea-40d7-9c1a-4cdfc62b70c8` 가 `:react-native-google-mobile-ads:compileReleaseKotlin` 에서 실패:
  `play-services-ads-25.4.0 ... Module was compiled with an incompatible version of Kotlin. The binary version of its metadata is 2.3.0, expected version is 2.1.0.`
- Expo SDK 54 의 Kotlin 은 `react-native` 0.81.5 `gradle/libs.versions.toml` 의 `kotlin = "2.1.20"`. Kotlin 2.1 컴파일러는 메타데이터를 한 단계 위(2.2)까지만 읽는다.
- Google Maven 에서 AAR 을 받아 `META-INF/*.kotlin_module` 헤더를 직접 확인:
  - `play-services-ads` 25.4.0 → 19개 모두 **2.3.0** (EAS 로그와 일치)
  - `play-services-ads` 25.0.0 → 19개 모두 **2.2.0** (읽기 가능)
  - `play-services-ads-api` 25.0.0 → kotlin_module 없음, `kotlin-stdlib` 2.1.0 의존 / `user-messaging-platform` 4.0.0 → kotlin_module 없음
- 16.x 버전별 Android SDK: 16.4.0·16.5.0 = 25.4.0 (불가) / 16.1.0 ~ 16.3.4 = 25.0.0 (가능) / 16.0.0 = 24.6.0. → 16.4.x 는 같은 실패가 확정이라 건너뛰고 16.3.x 최신 16.3.4 선택.
- `^` 없이 정확 고정: 범위 지정 시 재해석으로 16.4+ (25.4.0) 가 다시 잡힐 수 있음.
- 해제 조건: Kotlin ≥ 2.2 를 쓰는 Expo SDK 로 올리거나, 16.4+ 가 요구하는 Kotlin 버전을 맞출 때 재검토.

### step 1·4 참고 — 16.3.4 API 확인

`docs/plans/admob-banner-ads.md` §C·§E 가 쓰는 API 가 `lib/typescript` 에 모두 존재: `AdsConsent.gatherConsent` · `getConsentInfo` · `showPrivacyOptionsForm` · `canRequestAds` · `privacyOptionsRequirementStatus` · `mobileAds().initialize` · `BannerAd` (`onAdLoaded`/`onAdFailedToLoad`) · `TestIds.ADAPTIVE_BANNER` · `BannerAdSize.ANCHORED_ADAPTIVE_BANNER`.

- 단 `BannerAdSize.ANCHORED_ADAPTIVE_BANNER` 는 16.3.4 타입에 `@deprecated Use LARGE_ANCHORED_ADAPTIVE_BANNER instead` 표시가 있다 (값은 동작). step 4 에서 선택할 것.

## 2. `expo config --type introspect`

- `app.json` 에 `skadnetwork` 50개 (중복 0), `version`/`versionCode`/`buildNumber` 무변경.
- `grep -c "GADApplicationIdentifier\|NSUserTrackingUsageDescription\|SKAdNetworkItems"` = **6** (≥ 3; `ios.infoPlist` 가 출력에 2회 나타남). 16.5.0·16.3.4 양쪽 동일.
- iOS Info.plist: `GADApplicationIdentifier = ca-app-pub-3940256099942544~1458002511`, `NSUserTrackingUsageDescription` = 지정 한국어 문구, `SKAdNetworkItems` 50개, `GADDelayAppMeasurementInit = false`.
- Android manifest meta-data: `com.google.android.gms.ads.APPLICATION_ID = ca-app-pub-3940256099942544~3347511713`, `...flag.OPTIMIZE_INITIALIZATION = true`, `...flag.OPTIMIZE_AD_LOADING = true` (모두 `tools:replace`).
- prebuild 산출 `ios/app/Info.plist` 에도 위 키와 `SKAdNetworkIdentifier` 50개 반영 확인.

## 3. 플랫폼 분기 해석 (jest · tsc · ESLint)

임시 `src/lib/__spike__/probe.{native,web}.ts` + `probe.test.ts` 로 검증 후 디렉터리 삭제.

| 도구 | 결과 | 설정 변경 |
| --- | --- | --- |
| jest (jest-expo preset) | `./probe` → `.native` 해석, 통과 | **haste 설정 추가 안 함** (불필요) |
| tsc | 추가 전 `TS2307 Cannot find module './probe'` → 추가 후 통과. `const CHECK: 'native' = PLATFORM` 로 `.web` 이 아닌 `.native` 선택 확인 | **`moduleSuffixes: [".ios", ".android", ".native", ""]` 추가 (유지)** |
| ESLint | `./probe` import 경고·에러 0 | 없음 |

- 이후 전체 `npm run typecheck` / `npm run lint` / `npm test` (94 suites, 2072 passed, 1 skipped — 기존 `fx_backup.test.ts` skip) 그린.

## 4. iOS 로컬 빌드

### 지정 명령 `npx expo run:ios --device "iPhone 17 Pro"` 은 이 머신에서 사용 불가 (광고와 무관)

1. **Simulator.app 부재**: `CommandError: Can't determine id of Simulator app; the Simulator is most likely not installed on this machine.`
   - Expo CLI (`@expo/cli` `SimulatorAppPrerequisite`) 가 `Xcode.app/Contents/Developer/Applications/Simulator.app` (bundle id `com.apple.iphonesimulator`) 를 요구하는데, Xcode 27 에는 이 앱이 없고 `Xcode.app/Contents/Applications/DeviceHub.app` (`com.apple.dt.Devices`) 만 있다. 컴파일 이전 단계에서 종료.
2. **Pods deployment target**: 직접 `xcodebuild` 시 `The iOS Simulator deployment target 'IPHONEOS_DEPLOYMENT_TARGET' is set to 12.0, but the range of supported deployment target versions is 15.0 to 27.0.x` 에러 5건.
   - 대상: `GoogleUserMessagingPlatform-UserMessagingPlatformResources`, `Google-Mobile-Ads-SDK-GoogleMobileAdsResources` **및 기존 pod** `RNSVG-RNSVGFilters`(12.4), `ReachabilitySwift`(12.0), `RNCAsyncStorage-RNCAsyncStorage_resources`(13.4).
   - 기존 pod 도 같은 에러이므로 광고 SDK 없이도 Xcode 27 에서는 실패한다 (7월 `ios/` 빌드는 이전 Xcode).

→ 실패 사다리 (a)~(c) 는 광고 SDK 호환성 대응이라 적용 대상이 아님. 커밋 파일은 건드리지 않고 `expo run:ios` 가 내부에서 하는 일을 직접 수행했다:

```bash
EXPO_NO_GIT_STATUS=1 npx expo prebuild --platform ios --clean   # 기존 ios/ 는 7월 산출물이라 새 plugin 미반영 → 재생성
xcodebuild -workspace ios/app.xcworkspace -scheme app -configuration Debug \
  -destination "id=69B3C6EA-F7D9-418C-8F80-633F51BF3ADF" -derivedDataPath ios/build \
  IPHONEOS_DEPLOYMENT_TARGET=15.1 build                          # 앱 target 과 같은 15.1 로 전체 target 통일 (명령행 한정)
xcrun simctl install 69B3C6EA-F7D9-418C-8F80-633F51BF3ADF ios/build/Build/Products/Debug-iphonesimulator/app.app
npm run dev   # 별도 프로세스
npm run e2e:smoke
```

### 결과

| 시도 | 버전 | pod install | xcodebuild | 스모크 |
| --- | --- | --- | --- | --- |
| 1 | 16.5.0 | 성공 (GMA 13.5.0 · UMP 3.1.0) | override 없이 실패 (위 2), override 로 **BUILD SUCCEEDED** (13:58:19 → 14:00:08) | **통과** |
| 2 | 16.3.4 | 성공 (GMA 13.1.0 · UMP 3.1.0 · RNGoogleMobileAds 16.3.4) | override 로 **BUILD SUCCEEDED** (14:04:28 → 14:06:35) | **통과** |

- 앱 번들에 `GoogleMobileAdsResources.bundle`, `UserMessagingPlatformResources.bundle`, GAD 심볼, `GADApplicationIdentifier` 포함 확인.
- 실패 사다리: iOS 에는 적용 안 함. **`expo-build-properties` 추가 안 함** (정적 프레임워크 없이 빌드 성공).
- 기존에 떠 있던 Metro (PID 83669, 2026-09-07 이전 세션이 띄운 이 프로젝트 Metro) 는 의존성 설치 전 상태라 종료하고 새로 띄움.

스모크 로그 (16.3.4):

```
Running on iPhone 17 Pro - iOS 26.5 - 69B3C6EA-F7D9-418C-8F80-633F51BF3ADF
 > Flow smoke
Launch app "com.laegel.overseascostapp" with clear state... COMPLETED
Assert that id: onboarding-screen is visible... COMPLETED
Assert that "어디로 떠나시나요?" is visible... COMPLETED
Tap on id: onboarding-city-vancouver... COMPLETED
Assert that id: compare-screen is visible... COMPLETED
```

### 스모크 후 관찰

- 1차 스모크 직후 시뮬레이터가 홈 화면으로 돌아감 → 원인은 앱이 아니라 **SpringBoard 크래시** (`EXC_BAD_ACCESS` in `XCTAutomationSupport -[XCTAutomationSession initWithAccessibilityFramework:dataSource:]`, Maestro XCTest 드라이버). 광고 SDK 도입 전인 2026-09-14·09-15 리포트와 스택 동일 → 기존 문제.
- 2차 스모크 후 `simctl launch` 로 직접 실행, 12초 뒤 프로세스 생존·Compare 화면 정상 렌더 확인. red-box 없음, 신규 크래시 리포트 없음.

## 5. Android EAS 빌드

- 지정 명령 `eas build --platform android --profile development --non-interactive --no-wait` 은 빌드 생성 전에 거부됨:
  `You want to build a development client build ... However, we detected that you don't have expo-dev-client installed ... Install expo-dev-client manually and try again later.`
  → `expo-dev-client` 추가는 범위 밖 신규 의존성이고 `expo run:ios` 디버그 빌드 동작도 바꾸므로 넣지 않음. `eas.json` 수정 없이 기존 **`preview` 프로필** (APK release, dev client 불필요) 로 같은 네이티브 컴파일을 검증.

| 시도 | 빌드 ID | 버전 | status | 비고 |
| --- | --- | --- | --- | --- |
| 1 | `b5aafd52-30ea-40d7-9c1a-4cdfc62b70c8` | 16.5.0 | **ERRORED** (`EAS_BUILD_UNKNOWN_GRADLE_ERROR`) | Kotlin 메타데이터 2.3.0 비호환 (§1). 빌드 4분 29초 |
| 2 | `55d11aac-32fb-4cac-833e-9d5d1d481b19` | 16.3.4 | **FINISHED** | 빌드 약 16분 (05:03:19Z → 05:19:22Z) |

- 빌드 페이지: https://expo.dev/accounts/juno1001/projects/overseas-cost-app/builds/55d11aac-32fb-4cac-833e-9d5d1d481b19
- APK: https://expo.dev/artifacts/eas/InGsuJRhM14uC-PQ3LiIxdsLPfB1JKvit3rdgEV1rSo.apk
- 실패 사다리: (a) `npx expo install --fix` 는 **적용 안 함** — 변경 대상이 `expo`·`expo-constants`·`expo-font`·`expo-router`·`expo-updates`·`jest-expo` 패치 버전뿐이고 Kotlin 버전(`react-native` 소유)은 바뀌지 않아 원인과 무관. (b) 16.3.4 고정으로 1회 재시도 → 성공.
- 재시도 로그의 `e: The daemon has terminated unexpectedly on startup attempt #1` 은 `expo-updates-gradle-plugin` 컴파일 중 Kotlin 데몬 재시작 메시지로 빌드에 영향 없음.
- **APK 실기기 부팅은 미확인** — 사용자가 위 APK 로 수동 확인 필요.

## 6. ATT 프롬프트 관찰

- 스모크·직접 실행 모두 **ATT 알림 및 예상 밖 시스템 다이얼로그 없음** (동의 코드가 아직 없으므로 정상). Maestro 가 온보딩 → Compare 탭까지 막힘 없이 진행.

## 7. 이후 step 이 알아야 할 것

- iOS 재빌드가 필요한 step (4·5·9 의 시뮬레이터 검증) 은 §4 의 `prebuild --clean` + `xcodebuild ... IPHONEOS_DEPLOYMENT_TARGET=15.1` + `simctl install` 절차를 쓴다. `.maestro/README.md` 의 `npx expo run:ios` 안내는 Xcode 27 에서 동작하지 않는다 (문서 정정은 이 step 범위 밖).
- Android 는 `development` 프로필로 EAS 빌드할 수 없다 (`expo-dev-client` 미설치). `preview` 프로필을 쓰거나, dev client 도입 여부를 별도 결정해야 한다.
- 버전 표기는 `^16.5.0` 이 아니라 `16.3.4` 정확 고정이 전제다.
