[← ADR 인덱스](../ADR.md)

# ADR-043: `react-native-worklets` 빈 plugin stub (Expo SDK 52 한정 우회책) — Superseded by ADR-044

**상태**: **Superseded by ADR-044**. SDK 52→54 업그레이드와 함께 폐기됨. `scripts/postinstall.js` 삭제, `react-native-worklets@0.5.1` 정식 dependency 로 들어옴 (reanimated 4 의 peerDependency 충족). 본 ADR 은 이력 보존을 위해 남긴다.

**원래 결정 (참고용)**: `scripts/postinstall.js` 가 `node_modules/react-native-worklets/plugin.js` 와 `package.json` 을 빈 stub 으로 자동 생성한다. stub plugin 은 `module.exports = function() { return {}; };` — Babel 이 require 만 통과시키면 되는 형태.

**이유**:

- Expo SDK 52 의 `babel-preset-expo` 는 `reanimated` 옵션이 켜진 상태에서 `react-native-worklets/plugin` 을 require 한다.
- 그러나 `react-native-worklets` 패키지는 SDK 52 의 명시적 의존성에 포함되어 있지 않아, 일반 `npm install` 후 `expo start` 가 `Cannot find module 'react-native-worklets/plugin'` 으로 실패한다.
- 우리는 reanimated worklets 기반 기능 (UI thread shared values 등) 을 사용하지 않으므로 실제 plugin 동작은 필요 없다. require 만 성공하면 충분.
- `package.json` 에 `react-native-worklets` 를 정식 dependency 로 추가하지 않는 이유: 본 패키지는 reanimated 의 native 코드와 lockstep 으로 묶이는데, SDK 가 해당 버전을 명시하지 않은 상태에서 우리가 임의 버전을 박으면 차후 SDK 업그레이드에서 충돌 가능. stub 이 더 안전.

**트레이드오프**:

- `node_modules` 를 직접 수정 — 일반적으로 안티패턴. `postinstall` 자동 실행으로 항상 멱등하게 유지.
- 향후 reanimated worklets 기능을 실제로 사용하게 되면 본 우회책 제거 + 정식 의존성 추가 필요.

**폐기 조건**: Expo SDK 53+ 에서 `react-native-worklets` 가 정식 의존성으로 들어오는 시점 (SDK 53 부터 reanimated 4 가 worklets 를 별도 패키지로 명시 dependency 처리). SDK 업그레이드 PR 에서 본 파일·ADR 동시 제거 예정.
