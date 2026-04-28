# Step 4: testing-setup

## 읽어야 할 파일

- `phases/bootstrap/step{0,1,2,3}.md` 와 산출물
- `docs/TESTING.md` §1 철학, §2 도구 (lines 20–62), §3 파일 위치·네이밍, §5 모킹 전략 (lines 102–211), §7 fixture (디렉터리 구조만)
- `docs/ADR.md` §ADR-013 (Jest + RNTL, 인벤토리 강제), §ADR-035 (시각 회귀 — 스냅샷 1차 방어)
- `CLAUDE.md` §개발 프로세스 — TDD 지향 / 신규 모듈 인벤토리 강제

## 작업

Jest + @testing-library/react-native 셋업과 전역 mock (AsyncStorage, expo-router, expo-font, expo-splash-screen, react-native-svg, Linking) 을 갖춘다. 본 step 의 smoke test 는 1건 (alias 검증 + tokens import) 으로 한정. 실제 도메인 테스트는 Phase 3+ 책임.

### 1. 의존성 추가 (`devDependencies`)

- `jest` (`^29.7.x`)
- `jest-expo` (Expo SDK 52 페어 — `~52.0.0`)
- `@testing-library/react-native` (`^12.7.x`)
- `@types/jest` (`^29.5.x`)
- `react-test-renderer` (React 18.3 페어 — `18.3.1` 정확 일치)
- `react-native-svg-mock` (`^2.0.x`) — TESTING.md §5.1
- `babel-jest` (transitive 가 명시 install 필요할 경우)

> RNTL v12 + RN 0.76 + react-test-renderer 18.3 호환 페어를 명시적으로 고정. `expo install` 추천 페어가 있으면 그 쪽 우선.

### 2. `jest.config.js`

```js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEach: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/dist/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|react-native-css-interop))',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/index.ts',
    '!**/__fixtures__/**',
    '!**/__tests__/**',
    '!**/__test-utils__/**',
  ],
  coverageThreshold: {
    global:              { statements: 85, branches: 80, lines: 85, functions: 85 },
    'src/lib/**':        { statements: 100, branches: 95, lines: 100, functions: 100 },
    'src/store/**':      { statements: 100, branches: 90, lines: 100, functions: 100 },
    'src/components/**': { statements: 85, branches: 75, lines: 85, functions: 85 },
    'app/**':            { statements: 75, branches: 65, lines: 75, functions: 75 },
  },
};
```

> bootstrap 단계에서는 lib/store/components/app 모두 비어 있어 coverage threshold 가 0 으로 실패할 수 있다. 이를 회피하기 위해 본 step 은 **`--passWithNoTests`** 와 **`--coverage` 미적용** 으로 AC 를 잡는다 (아래 §5). coverage threshold 는 Phase 3+ 에서 첫 코드가 들어왔을 때 실효성 발생.

### 3. `jest.setup.js`

```js
import 'react-native-gesture-handler/jestSetup';

// AsyncStorage
jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// expo-font
jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  loadAsync: jest.fn(() => Promise.resolve()),
  isLoaded: jest.fn(() => true),
}));

// expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  Link: ({ children }) => children,
  Stack: Object.assign(({ children }) => children, { Screen: () => null }),
  Tabs: Object.assign(({ children }) => children, { Screen: () => null }),
  Slot: ({ children }) => children,
  Redirect: () => null,
}));

// react-native-svg
jest.mock('react-native-svg', () => require('react-native-svg-mock'));

// expo-splash-screen
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

// react-native Linking (legacy path 보강)
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: jest.fn(() => Promise.resolve(true)),
  canOpenURL: jest.fn(() => Promise.resolve(true)),
}));

// fakeTimers 기본 활성화 — TESTING.md §5.2
jest.useFakeTimers();
```

> **주의**: TESTING.md §5.1 의 `Stack: { Screen: () => null }` 한 줄짜리 spec 은 placeholder 라우트를 RNTL 로 렌더할 때 children 을 받지 못해 throw 한다. 본 step 의 mock 은 `Object.assign(({ children }) => children, { Screen: () => null })` 형태로 양쪽 사용 케이스 모두 지원 (직접 렌더 + `<Stack.Screen />` 호출 양립).

### 4. AsyncStorage 의존성

`@react-native-async-storage/async-storage` 가 아직 설치돼 있지 않다면 `dependencies` 에 추가 (`~2.1.0` Expo SDK 52 페어). Phase 3 (Zustand persist) 가 사용한다.

### 5. `package.json` 스크립트 갱신

```json
{
  "scripts": {
    "test": "jest --passWithNoTests",
    "test:coverage": "jest --coverage --passWithNoTests"
  }
}
```

> Step 0 에서 `"test": "echo 'jest configured in step 4' && exit 0"` 였다. 본 step 에서 실제 jest 호출로 교체.

### 6. Smoke test 1건

`src/__test-utils__/sanity.test.ts`:

```ts
import { colors, HOT_MULTIPLIER_THRESHOLD } from '@/theme/tokens';

describe('bootstrap sanity', () => {
  it('@/theme/tokens alias 가 jest 에서 resolve 된다', () => {
    expect(colors.orange).toBe('#FC6011');
  });

  it('HOT_MULTIPLIER_THRESHOLD 가 2.0 이다 (CLAUDE.md CRITICAL)', () => {
    expect(HOT_MULTIPLIER_THRESHOLD).toBe(2.0);
  });
});
```

> 위 테스트는 Phase 3+ 의 인벤토리 (`docs/TESTING.md` §9) 에는 포함되지 않는다 (smoke). 대신 본 step 에서 `docs/TESTING.md` §7 인벤토리에 본 파일을 명시 등록 (다음 항목).

### 7. `docs/TESTING.md` §7 인벤토리 초기화

`docs/TESTING.md` 의 §7 또는 §9 (전체 테스트 인벤토리) 에 본 step 산출물을 기록한다. 새 섹션 또는 기존 섹션 끝에 다음 추가:

```markdown
### 9.0 bootstrap sanity (`src/__test-utils__/sanity.test.ts`)

- [x] `@/theme/tokens` alias resolve 검증 (`colors.orange === '#FC6011'`)
- [x] `HOT_MULTIPLIER_THRESHOLD === 2.0` (CLAUDE.md CRITICAL)

> bootstrap step 4 에서 추가. 정식 lib/store/component 인벤토리는 Phase 3+ 에서 §9.1 이하로 채워진다.
```

> **주의**: `docs/TESTING.md` 가 이미 §9.1 이하로 lib/store/components 인벤토리를 미리 작성해 두었다 (수많은 항목). 본 step 은 그 항목들을 **건드리지 않고** §9.0 만 신규 추가한다.

### 8. NativeWind / RN 컴포넌트 테스트는 본 step 미포함

`<App>` 또는 `app/_layout.tsx` 의 RNTL render smoke 는 **본 step 에서 하지 않는다**. 이유: expo-router 의 Stack/Tabs mock 정합성, NativeWind 의 className-to-style 변환이 테스트 환경에서 동작하는지 등 요인이 많아 별도 step (Phase 5 의 화면 통합 테스트) 에서 검증.

본 step 의 RNTL 의존성은 import 검증만 (mock 설정의 typo 발견용 — 실제 render 호출은 안 함):

`src/__test-utils__/rntl-import.test.ts`:

```ts
import { render } from '@testing-library/react-native';

it('RNTL render 함수가 import 된다', () => {
  expect(typeof render).toBe('function');
});
```

### 9. `index.json` summary

`"summary": "Jest + RNTL 셋업 (jest.config.js, jest.setup.js — AsyncStorage/expo-router/expo-font/svg/Linking mock), smoke test 2건 통과"`

## Acceptance Criteria

```bash
npm install
npm run typecheck
npm test
```

- 의존성 설치 성공
- `tsc --noEmit` 통과
- `jest --passWithNoTests` 통과 — smoke test 2건 PASS, coverage 미체크 (bootstrap 단계)

## 검증 절차

1. AC 커맨드 실행.
2. 테스트 인프라 체크리스트:
   - `jest.config.js` 에 `preset: 'jest-expo'` + `moduleNameMapper @/*` 둘 다 존재
   - `jest.setup.js` 에 6개 mock (AsyncStorage, expo-font, expo-router, react-native-svg, expo-splash-screen, Linking) 모두 존재
   - `jest.useFakeTimers()` 가 setup 마지막에 있어 모든 테스트 기본 fake timer
   - `coverageThreshold.global` 이 TESTING.md §2 와 일치 (statements 85, branches 80, lines 85, functions 85)
   - `expo-router` mock 의 `Stack`/`Tabs` 가 children 렌더 + Screen subcomponent 양립 형태인가?
   - `docs/TESTING.md` §9.0 가 신규 추가되었는가?
3. `phases/bootstrap/index.json` 의 step 4 업데이트.

## 금지사항

- 도메인 테스트 (formatKRW, ComparePair 등) 작성 금지. 이유: Phase 3+ 의 책임.
- `coverage` AC 강제 금지. 이유: bootstrap 단계는 코드가 거의 없어 threshold 가 의미 없음. Phase 3 첫 lib 추가 시 자동 활성화.
- 기존 `docs/TESTING.md` §9.1 이하 인벤토리 항목 수정·삭제 금지 (오직 §9.0 추가). 이유: 인벤토리는 Phase 3+ 의 단일 출처. bootstrap 이 임의 변경하면 후속 phase 의 작업 명세가 흔들린다.
- `jest-expo` 가 아닌 `react-native` preset 사용 금지. 이유: Expo Managed 환경에서 `jest-expo` 가 transformIgnorePatterns + Expo 모듈 mock 을 자동 처리.
- `react-test-renderer` 버전을 `react` 와 다르게 설정 금지. 이유: 18.3.x 가 일치하지 않으면 RNTL render 시 silent crash.
- `setupFiles` 와 `setupFilesAfterEach` 혼용 시 잘못된 키 사용 금지. 본 step 은 **`setupFilesAfterEach`** 가 아니라 **`setupFilesAfterEach`** 한 가지만 쓴다 (TESTING.md §2 의 정확 spec).
  > **참고**: jest 표준 키는 `setupFiles` (각 테스트 파일 transform 전) 와 `setupFilesAfterEach` (jest 환경 셋업 후, 테스트 실행 전 — `beforeEach`/`afterEach` 와는 다름). TESTING.md §2 spec 그대로 따른다.
- 폰트 mock 을 setup 에서 제거 금지 (RNTL 렌더 시 `useFonts` 가 false 반환하면 화면이 splash 상태로 멈춤). 이유: §5.1.
- jest globals (`describe`, `it`, `expect`) 의 type 선언을 `tsconfig.json` 의 `types` 에 명시하지 않는 것 금지 — `tsconfig.json` 의 `compilerOptions.types: ["jest", "node"]` 추가 (이 step 에서 추가). 이유: TS strict 에서 globals 가 unknown 으로 잡힘.
