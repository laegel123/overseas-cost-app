[← ADR 인덱스](../ADR.md)

# ADR-080: EAS iOS 빌드 이미지를 `sdk-54`(Xcode 26.0) 로 고정

**상태:** 채택 (2026-10-29)

**맥락:**

iOS 27 은 **iOS 27 SDK(Xcode 27) 로 빌드된 앱이 UIScene 라이프사이클을 채택하지 않으면
실행 직후 강제 종료**한다. 크래시 서명은 메인 스레드 `EXC_BREAKPOINT (SIGTRAP)` —
`_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption_block_invoke` 로, 앱 코드가
돌기 전에 죽는다. Expo SDK 54 의 iOS 템플릿은 `AppDelegate` 가 `window` 를 직접 만드는
window 기반이라 `UIApplicationSceneManifest` / SceneDelegate 가 없다.

실제 발생 — **2026-10-29 출시 전 실기기 검증**: 로컬 Xcode 27.1 (`iphoneos27.1` SDK) 로
Release 빌드해 iPhone 13 Pro (iOS 27.0.1) 에 설치 → 실행 즉시 종료, 위 서명 확인.
시뮬레이터 E2E 는 iOS 26.5 런타임이라 통과했다 — 이 결함은 시뮬레이터로 드러나지 않는다.

EAS 는 `eas.json` 에 `image` 가 없으면 `auto` 를 쓰고, SDK 54 프로젝트는 현재 Xcode 26
이미지로 해석된다(SDK 54 changelog, 빌드 인프라 문서). 따라서 **현재 출시 빌드는 안전**하다.
그러나 `auto` 의 해석은 Expo 가 바꿀 수 있고, 핀 없는 빌드가 Xcode 27.1 이미지로 넘어가
크래시한 외부 사례가 있다. 그렇게 되면 iOS 27 사용자 전원이 실행 불가가 된다.

**결정:**

`eas.json` 의 development / preview / production 세 프로필 모두 `ios.image` 를
**`sdk-54`** 로 명시한다 (현재 `macos-sequoia-15.6-xcode-26.0`, Xcode 26.0).

- 출시 빌드가 Xcode 26 SDK 로 링크됨이 설정으로 고정된다 — iOS 27 기기에서도 정상 실행.
- Xcode 26 SDK 는 2026-04-28 부터의 App Store 업로드 최소 요건(Xcode 26+)을 충족한다.

**대안:**

- **UIScene 채택 (SceneDelegate 추가 config plugin)** — 근본 해결이지만 SDK 54 템플릿은
  backport 가 없어 직접 작성해야 하고, 딥링크(`application(_:open:options:)`) 를 scene
  delegate 로 포워딩하지 않으면 `overseascost://` 링크가 끊긴다. 출시 직전 범위로는 과하다.
- **Expo SDK 57+ 업그레이드** (`ios.enableSceneSupport`, SDK 58 은 기본 지원) — 아래 후속.
- **`auto` 유지** — 오늘은 동작하지만 Expo 측 alias 변경에 무방비. 기각.

**결과:**

- EAS iOS 빌드가 Xcode 26.0 으로 고정된다. 빌드 로그 "Spin up build environment" 에서
  이미지명을 확인할 수 있다.
- **로컬 Xcode 27 빌드는 iOS 27 실기기에서 실행되지 않는다** (시뮬레이터 iOS 26.x 는 무관).
  실기기 검증은 EAS `preview` (internal) 또는 TestFlight 빌드로 한다.
- **후속 (기한 있음):** Apple 이 업로드 최소 요건을 Xcode 27 SDK 로 올리면(예년 패턴상 다음 해
  4월) 이 고정은 더 이상 제출을 통과하지 못한다. 그 전에 Expo SDK 57+ 업그레이드 + UIScene
  채택(딥링크 포워딩 검증 포함)을 별도 phase 로 진행하고, 그때 이 ADR 을 supersede 한다.
