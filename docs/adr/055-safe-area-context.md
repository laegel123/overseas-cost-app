[← ADR 인덱스](../ADR.md)

# ADR-055: SafeAreaView 는 `react-native-safe-area-context` 만 사용 (RN core SafeAreaView 금지)

**상태:** 채택 (2026-05-01)

**맥락:**

- React Native core 의 `SafeAreaView` (`from 'react-native'`) 는 deprecated 이고, **New Architecture (Fabric / Bridgeless) 에서 0 크기로 마운트되는 회귀**가 있다. 자식 트리가 화면에 렌더링되지만 부모 크기가 0 이라 시각적으로는 빈 화면으로 보인다.
- ADR-044 의 SDK 54 업그레이드로 New Architecture 가 default 활성화. **Expo Go 는 `app.json` 의 `newArchEnabled: false` 를 강제로 무시**한다 (런타임 콘솔에 "React Native's New Architecture is always enabled in Expo Go" 명시 경고 출력). 따라서 dev 빌드에서 RN core SafeAreaView 사용 시 흰 화면 발생이 결정적.
- 실제로 5 placeholder 화면 (`onboarding`, `(tabs)/index`, `(tabs)/settings`, `compare/[cityId]`, `detail/[cityId]/[category]`) 이 RN core SafeAreaView 를 사용해 dev 빌드에서 흰 화면 회귀 발생. 단, `src/components/Screen.tsx` 는 이미 `react-native-safe-area-context` 기반이라 영향 없음.
- `react-native-safe-area-context@~5.6.0` 은 Expo Managed Workflow (ADR-002) 의 표준 의존성으로 이미 설치 — 신규 의존성 도입 아님.

**결정:**

1. **모든 `SafeAreaView` import 는 `react-native-safe-area-context` 에서만 수행.** `import { SafeAreaView } from 'react-native'` 는 금지.
2. `app/_layout.tsx` 는 `<SafeAreaProvider>` 로 트리 wrapping (safe-area-context 의 요구사항).
3. 화면 chrome 이 필요한 경우 `src/components/Screen.tsx` 사용 권장 (이미 safe-area-context 기반 + padding 토큰 캡슐화). 직접 `SafeAreaView` 사용은 chrome 이 필요 없는 단순 화면에 한함.
4. 본 결정 시점에 5 placeholder + `_layout.tsx` 수정 적용. Phase 5 실제 화면 구현 시 본 정책 준수.

**대안 검토:**

- (A 선택) safe-area-context 만 사용 + RN core 금지: dev/prod / Expo Go / standalone build 양쪽 New Arch 호환 보장. 신규 의존성 0. 채택.
- (B) RN core SafeAreaView + manual padding: deprecated API 의존 + New Arch 회귀 잠재. 거부.
- (C) `useSafeAreaInsets` + 일반 `View` 조합: safe-area-context 의 `SafeAreaView` 가 동일 동작을 더 적은 코드로 제공. 거부 (단순 케이스 한정 fallback 옵션으로만 허용).

**결과 / 영향:**

- 흰 화면 회귀 차단 (dev / prod / Expo Go / standalone build).
- 신규 의존성 0 (safe-area-context 는 이미 ADR-002 의 Expo 표준 의존성).
- 5 placeholder 의 import 교체 + `_layout.tsx` SafeAreaProvider 추가 1 회. eslint import/order 자동 정렬.
- 디자인 hifi mock (ADR-012 reference) 의 `<SafeAreaView>` 를 RN 으로 포팅할 때 본 정책에 따라 자동으로 safe-area-context 채택.
- 강제 lint 규칙 (`no-restricted-imports` 로 RN core SafeAreaView 차단) 은 본 ADR 에서 도입 안 함. 회귀 재발 시 추가 검토 — 현재 코드베이스가 모두 정책 준수 상태라 우선순위 낮음.

**관련:** ADR-002 (Expo Managed Workflow + safe-area-context 기본 의존성), ADR-044 (SDK 54 / RN 0.81 / New Arch default), ADR-012 (hifi mock RN 포팅), `src/components/Screen.tsx`, ARCHITECTURE.md §부팅·hydration 순서.
