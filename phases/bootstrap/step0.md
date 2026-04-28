# Step 0: expo-init

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 설계 의도를 파악하라:

- `CLAUDE.md` — 기술 스택·CRITICAL 규칙
- `docs/ARCHITECTURE.md` §디렉터리 구조 (lines 5–80) — 최종 디렉터리 형태
- `docs/ADR.md` §ADR-002 (Expo Managed + Expo Router), §ADR-016 (다크모드·다국어 미지원), §ADR-019 (SemVer + runtimeVersion), §ADR-024 (로깅 정책)

## 작업

이 step 은 **Expo Managed Workflow + TypeScript strict** 의 가장 얕은 골격만 깐다. 라우팅·NativeWind·테스트·폰트·ESLint 는 후속 step (1~5) 의 책임이므로 **이 step 에서는 손대지 않는다**.

이 phase 의 root 는 현재 작업 디렉터리 (`.`) 이다. 별도 하위 디렉터리를 만들지 말고, 기존 `docs/`, `phases/`, `scripts/`, `CLAUDE.md`, `README.md`, `.git/`, `.github/`, `.gitignore` 와 공존하도록 **현재 폴더 자체를 Expo 프로젝트로 초기화**한다.

### 1. `package.json` 신규 작성

`expo init` CLI 를 그대로 실행하지 말고, 의존성과 스크립트를 직접 정의한다 (Expo CLI 가 README/.gitignore 를 덮어쓸 수 있어 안전).

요구사항:

- `name`: `"overseas-cost-app"`, `version`: `"0.1.0"`, `private`: `true`
- `main`: `"expo-router/entry"` (Expo Router entry — Step 2 에서 활용)
- `scripts`:
  - `dev`: `"expo start"`
  - `ios`: `"expo start --ios"`
  - `android`: `"expo start --android"`
  - `typecheck`: `"tsc --noEmit"`
  - `lint`: `"echo 'lint configured in step 5'"` (Step 5 에서 교체)
  - `test`: `"echo 'jest configured in step 4' && exit 0"` (Step 4 에서 교체. `--passWithNoTests` 허용은 step 4 책임)
  - `build`: `"eas build"` (요청 시에만 실행 — README 그대로)
- `dependencies`:
  - `expo` (SDK 52 계열 최신: `~52.0.0`)
  - `react`, `react-native` (expo SDK 52 와 정합한 버전을 `expo install` 추천 페어로 — react `18.3.1`, react-native `0.76.x` 계열)
  - `expo-router` (`~4.0.0` — Step 2 에서 사용)
  - `expo-status-bar`
  - `react-native-safe-area-context`
  - `react-native-screens`
- `devDependencies`:
  - `typescript` (`~5.3.x` — Expo SDK 52 권장 페어)
  - `@types/react`
  - `@babel/core`

> NativeWind / 폰트 / Jest / ESLint 의존성은 각각 step 1, 5, 4, 5 에서 추가한다. **이 step 에서는 추가하지 않는다.**

### 2. `app.json`

- `expo.name`: `"해외 생활비 비교"`
- `expo.slug`: `"overseas-cost-app"`
- `expo.scheme`: `"overseascost"` (ADR-016: 예약만)
- `expo.version`: `"1.0.0"`
- `expo.runtimeVersion`: `{ "policy": "appVersion" }` (ADR-019)
- `expo.orientation`: `"portrait"`
- `expo.userInterfaceStyle`: `"light"` (ADR-016: 다크모드 미지원, light 강제)
- `expo.icon`: `"./assets/icon.png"` (파일 부재 시 placeholder PNG 1×1 transparent 생성 — Step 5 에서 실제 자산 교체)
- `expo.splash`: `{ "image": "./assets/splash.png", "resizeMode": "contain", "backgroundColor": "#FFFFFF" }`
- `expo.assetBundlePatterns`: `["**/*"]`
- `expo.ios`: `{ "supportsTablet": false, "bundleIdentifier": "com.laegel.overseascostapp" }`
- `expo.android`: `{ "package": "com.laegel.overseascostapp", "adaptiveIcon": { "foregroundImage": "./assets/icon.png", "backgroundColor": "#FFFFFF" } }`
- `expo.plugins`: `["expo-router"]`
- `expo.experiments`: `{ "typedRoutes": true }`

### 3. `tsconfig.json`

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "moduleResolution": "bundler",
    "jsx": "react-native"
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"],
  "exclude": ["node_modules"]
}
```

> Path alias (`@/*`) 는 Step 3 에서 추가한다.

### 4. `babel.config.js`

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
```

> NativeWind plugin / `transform-remove-console` 는 각각 Step 1, 5 에서 추가.

### 5. `metro.config.js`

```js
const { getDefaultConfig } = require('expo/metro-config');
module.exports = getDefaultConfig(__dirname);
```

### 6. `.gitignore` 보강

기존 `.gitignore` 끝에 Expo·RN 표준 패턴 append (중복 라인 발생하지 않게 확인 후 추가):

```
node_modules/
.expo/
dist/
web-build/
ios/
android/
*.jks
*.keystore
.env*
.DS_Store
npm-debug.*
yarn-debug.*
yarn-error.*
```

### 7. `assets/` placeholder

`assets/icon.png`, `assets/splash.png` 가 없으면 1×1 transparent PNG 를 생성 (실제 자산은 Phase 7 에서 교체). 생성 방법은 Node 의 `fs` 로 minimal PNG byte 작성 또는 `python3 -c` 로 PIL 없이 생성 — 도구 부재 시 빈 파일 + `app.json` 의 splash/icon 항목을 임시로 제거하는 대신, `assets/.gitkeep` 만 두고 `app.json` 의 image 경로를 유지해도 된다 (Expo 가 빌드 시까지는 검증하지 않음). 단, **`expo doctor` 가 패스되어야 한다** — 통과하지 않는 우회는 금지.

### 8. `expo-env.d.ts`

```ts
/// <reference types="expo/types" />
```

### 9. 최소 entry 보장

이 step 에서는 `app/` 디렉터리를 만들지 않는다. Expo Router 는 Step 2 에서 추가한다. 따라서 `npm run dev` 가 라우트 부재로 실패할 수 있는데, 그건 Step 2 의 책임이다. **이 step 의 AC 는 빌드/타입체크/`expo doctor` 만 검증**한다.

만약 `expo-router` 가 `app/` 디렉터리 부재로 install 후에도 metro 가 즉시 throw 하면, 임시로 `app/_layout.tsx` 를 다음 stub 로만 둔다 (Step 2 가 덮어쓰는 것을 명시):

```tsx
// TEMP: replaced in Step 2 (expo-router)
import { Slot } from 'expo-router';
export default function RootLayout() {
  return <Slot />;
}
```

그리고 `app/index.tsx` 도 임시 stub:

```tsx
// TEMP: replaced in Step 2 (expo-router)
import { Text, View } from 'react-native';
export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>bootstrap step 0</Text>
    </View>
  );
}
```

> 위 두 파일이 임시인 이유를 파일 상단 한 줄 주석으로 남긴다 (Step 2 에서 정식 라우팅으로 교체됨을 명시).

### 10. `.expo/`, `dist/`, `node_modules/` 등 산출물은 커밋하지 않는다

`.gitignore` 에 포함되어 있어야 한다.

### 11. README 갱신은 하지 않는다

`README.md` 는 이미 작성되어 있다 (하네스 framework 안내). 이 step 에서 수정하지 않는다.

## Acceptance Criteria

```bash
npm install
npm run typecheck
npx expo-doctor
```

- `npm install` 이 에러 없이 완료
- `npm run typecheck` 가 통과 (출력 없음 = 성공)
- `npx expo-doctor` 가 모든 체크 통과 (경고는 허용, error 는 0건)

> **참고**: `npm run dev` 는 시뮬레이터/실기기 의존이라 AC 에 포함하지 않는다. Step 2 완료 후 사용자 수동 검증.

## 검증 절차

1. 위 AC 커맨드를 순차 실행한다.
2. 아키텍처 체크리스트:
   - `CLAUDE.md` 의 디렉터리 구조 (Expo Managed + Expo Router 전제) 와 일치하는가?
   - TypeScript strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` 가 켜져 있는가?
   - `userInterfaceStyle: "light"` 가 명시되었는가? (ADR-016)
   - `runtimeVersion.policy: "appVersion"` 인가? (ADR-019)
   - `assets/`, `data/`, `src/` 디렉터리는 **만들지 않았는가**? (이 step 의 책임 아님 — 후속 step 책임)
3. 결과에 따라 `phases/bootstrap/index.json` 의 step 0 항목을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "Expo Managed + TS strict 초기화 (app.json, tsconfig.json, babel/metro config, package.json)"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "사유"` 후 즉시 중단

## 금지사항

- NativeWind 의존성 추가 금지. 이유: Step 1 의 책임. babel plugin 충돌 시 디버깅 비용 증가.
- ESLint / Prettier / Jest 의존성 추가 금지. 이유: Step 4, 5 에서 통합 셋업.
- `app/(tabs)/`, `app/onboarding.tsx`, `app/compare/`, `app/detail/` 등 도메인 라우트 생성 금지. 이유: Step 2 의 책임.
- `src/` 하위 디렉터리 생성 금지. 이유: Step 3 의 책임.
- `assets/fonts/` 생성 또는 폰트 파일 추가 금지. 이유: Step 5 의 책임.
- `eas.json` 생성 금지. 이유: Phase 7 (release) 의 책임. ADR-023 정책에 따라 별도로 셋업.
- `data/` 디렉터리 생성 금지. 이유: Phase 3 (state-data) 의 책임.
- 기존 `README.md` 수정 금지. 이유: 하네스 framework 안내가 이미 작성되어 있고, 앱용 README 는 Phase 7 에서 별도 작성.
- `console.log` 직접 사용 금지 (이 step 에서 작성하는 코드 안에서). 이유: ADR-024.
- 의존성 버전을 `*` 또는 `latest` 로 두는 것 금지. 이유: 재현성. 정확한 SemVer 또는 caret(`^`)/tilde(`~`) 사용.
