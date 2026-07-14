[← ADR 인덱스](../ADR.md)

# ADR-044: Expo SDK 52 → 54 업그레이드 (React 19 / RN 0.81 / Expo Router 6 / Reanimated 4)

> **상태**: Active

**결정**: 프로젝트 SDK 라인을 **Expo SDK 52 → 54** 로 업그레이드. 핵심 의존성 동시 갱신:

| 패키지                     | SDK 52        | SDK 54        |
| -------------------------- | ------------- | ------------- |
| expo                       | ~52.0.0       | ^54           |
| react                      | 18.3.1        | 19.1.0        |
| react-native               | 0.76.9        | 0.81.5        |
| expo-router                | ~4.0.0        | ~6.0.23       |
| react-native-reanimated    | ~3.16.1       | ~4.1.1        |
| react-native-worklets      | (stub 0.0.0)  | 0.5.1 (정식)  |
| react-native-gesture-handler | ~2.20.2     | ~2.28.0       |
| react-native-screens       | ~4.4.0        | ~4.16.0       |
| react-native-safe-area-context | 4.12.0    | ~5.6.0        |
| @react-native-async-storage/async-storage | ^1.23.1 | 2.2.0  |
| typescript                 | ~5.3.0        | ~5.9.2        |
| jest-expo                  | ~52.0.3       | ~54.0.17      |
| eslint-config-expo         | ~8.0.1        | ~10.0.0       |
| @types/react               | ~18.3.0       | ~19.1.0       |
| react-test-renderer        | ^18.3.1       | 19.1.0        |

**이유**:

- 사용자 디바이스의 Expo Go 가 SDK 54 클라이언트로 업데이트됨 — SDK 52 프로젝트를 더 이상 Expo Go 에서 실행할 수 없음 (Expo Go 는 단일 SDK 만 지원).
- SDK 52 가 React 18.3 / RN 0.76 lifecycle 의 마지막 — React 19 (server components, use(), Suspense 개선) + RN 0.81 (new architecture default 강화) 의 안정 도입 적기.
- Expo Router v6 는 typed routes, async routes 등 v4 에서 제공 안 되는 기능. 우리 프로젝트가 화면 5개 규모라 마이그레이션 비용 작음.
- Reanimated 4 는 worklets 를 `react-native-worklets` 별도 패키지로 분리 → SDK 52 에서 우리가 stub 으로 우회하던 의존성 누락 문제 (ADR-043) 가 자연 해소.

**핵심 변경 사항 (이번 PR 에서 함께 처리)**:

1. **`scripts/postinstall.js` 삭제 + `package.json scripts.postinstall` 제거** — ADR-043 우회책 폐기. 진짜 `react-native-worklets@0.5.1` 이 npm 으로 설치됨.
2. **`react-native-worklets-core@^1.6.3` devDependency 제거** — 코드에서 import 한 적 없는 미사용 패키지였고, reanimated 4 가 요구하는 것은 `react-native-worklets` (별개 패키지) 임을 확인.
3. **`tsconfig.json` 상속**: `expo/tsconfig.base` 가 `module: "preserve"` 를 사용 → TypeScript 5.9+ 필요.
4. **`eslint-config-expo` v8 → v10**: SDK 54 권장 버전. 기존 legacy `extends: ['expo']` 형태와 호환됨 (peer `eslint: >=8.10` 충족).
5. **npm install 시 `--legacy-peer-deps` 필요**: expo-router 6 의 `react-server-dom-webpack` peerOptional 이 19.0.4 || 19.1.5 || 19.2.4 만 허용하나 transitive 로 19.2.5 가 잡힘. peerOptional 이라 무시 가능. 향후 expo-router 패치 버전에서 peer 범위 완화되면 제거.

**트레이드오프**:

- Reanimated 4 는 worklets API 가 v3 와 일부 호환되지 않음 (`useSharedValue` 등은 동일하지만 일부 함수 시그니처 변화). 현재 우리는 worklets 사용 코드 0건이라 영향 없음. 향후 worklets 도입 시 v4 API 기준으로 작성.
- React 19 는 `forwardRef` deprecate 시작 (ref 가 prop 으로 들어옴). 현재 코드에 `forwardRef` 사용 0건 — 영향 없음. Phase 3+ 컴포넌트 작성 시 ref-as-prop 패턴 채택.
- `--legacy-peer-deps` 가 신규 기여자에게 약간의 마찰. README 또는 CLAUDE.md 에 명시 필요 (이번 PR 에 포함).
- Expo Go 만 지원 — dev client (네이티브 빌드) 사용 시 별도 검증 필요. v1.0 은 Expo Go 우선.

**검증**:

- `npm run typecheck`, `npm run lint`, `npm test` (3 passed) 모두 통과
- `npm run dev` → Metro 8081 LISTEN, `packager-status:running`, `expo doctor` `Incorrect dependencies: []`
- 사용자 디바이스 Expo Go 에서 실 부팅 확인은 머지 전 수동
