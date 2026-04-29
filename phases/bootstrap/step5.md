# Step 5: fonts-lint

## 읽어야 할 파일

- `phases/bootstrap/step{0,1,2,3,4}.md` 와 산출물
- `docs/UI_GUIDE.md` §타이포그래피 (Manrope/Mulish/Pretendard fallback chain)
- `docs/design/README.md` §Design Tokens — Typography (lines 202–218)
- `docs/ARCHITECTURE.md` §부팅·hydration 순서 (lines 216–234) — `useFonts` + splash 게이트의 의도
- `docs/ADR.md` §ADR-024 (로깅 정책 — `transform-remove-console`), §ADR-016 (다크모드 미지원, light 강제), §ADR-034 (i18n 한국어 단일 출처)
- `CLAUDE.md` §네이밍·코드 스타일 (import 순서)

## 작업

폰트 등록 (3 family) + ESLint + Prettier + 프로덕션 console 제거 babel plugin. bootstrap phase 의 마지막 step 으로 전체 toolchain 을 마무리한다.

### 1. 폰트 자산 추가

`assets/fonts/` 에 다음 파일을 추가한다 (Google Fonts Manrope/Mulish 의 weight 별 .ttf, Pretendard 의 한국어 fallback). 정확한 weight 선정:

```
assets/fonts/
├── Manrope-Regular.ttf       # 400
├── Manrope-Medium.ttf        # 500
├── Manrope-SemiBold.ttf      # 600
├── Manrope-Bold.ttf          # 700
├── Manrope-ExtraBold.ttf     # 800
├── Mulish-Regular.ttf        # 400
├── Mulish-Medium.ttf         # 500
├── Mulish-SemiBold.ttf       # 600
├── Mulish-Bold.ttf           # 700
└── Pretendard-Regular.ttf    # 400 (한국어 fallback — 본문/숫자 모두)
```

> Pretendard 는 weight 1종만 (Regular). UI_GUIDE.md §타이포그래피 에서 한국어는 weight 별 컴포넌트 분기 없이 fallback 하므로 1종으로 충분. Phase 5 이후 시각 검증 후 SemiBold/Bold 추가 결정.

폰트 라이선스: Manrope (OFL), Mulish (OFL), Pretendard (OFL). 모두 재배포 허용. `assets/fonts/LICENSE.md` 한 줄 코멘트:

```
Manrope: SIL OFL 1.1 — https://fonts.google.com/specimen/Manrope
Mulish:  SIL OFL 1.1 — https://fonts.google.com/specimen/Mulish
Pretendard: SIL OFL 1.1 — https://github.com/orioncactus/pretendard
```

> **자산 다운로드 주의**: 본 step 은 자동화된 환경에서 실행될 수 있어 외부 다운로드가 막힐 수 있다. 다운로드 실패 시 본 step 을 `blocked` 로 마킹하고 `blocked_reason: "폰트 .ttf 다운로드 실패 — 사용자가 assets/fonts/ 에 9개 .ttf 직접 배치 필요"` 로 종료. 폰트 등록 코드 (§2~§3) 는 그대로 작성하되, 실 파일이 없어도 typecheck 는 통과해야 한다.

### 2. `src/theme/fonts.ts` — `useFonts` 매핑

```ts
import { useFonts as useExpoFonts } from 'expo-font';

/**
 * 폰트 family key → 파일 매핑. NativeWind 의 fontFamily 값 ('Manrope', 'Mulish', 'Pretendard')
 * 와 정확히 일치해야 한다 (tailwind.config.js fontFamily 참조).
 */
export const FONT_MAP = {
  Manrope: require('../../assets/fonts/Manrope-Regular.ttf'),
  'Manrope-Medium': require('../../assets/fonts/Manrope-Medium.ttf'),
  'Manrope-SemiBold': require('../../assets/fonts/Manrope-SemiBold.ttf'),
  'Manrope-Bold': require('../../assets/fonts/Manrope-Bold.ttf'),
  'Manrope-ExtraBold': require('../../assets/fonts/Manrope-ExtraBold.ttf'),
  Mulish: require('../../assets/fonts/Mulish-Regular.ttf'),
  'Mulish-Medium': require('../../assets/fonts/Mulish-Medium.ttf'),
  'Mulish-SemiBold': require('../../assets/fonts/Mulish-SemiBold.ttf'),
  'Mulish-Bold': require('../../assets/fonts/Mulish-Bold.ttf'),
  Pretendard: require('../../assets/fonts/Pretendard-Regular.ttf'),
} as const;

/**
 * 본 hook 은 `app/_layout.tsx` 에서 호출. 모든 폰트 로딩 완료 시 splash 해제 가능.
 */
export function useAppFonts(): { ready: boolean; error: Error | null } {
  const [loaded, error] = useExpoFonts(FONT_MAP);
  return { ready: loaded, error };
}
```

> NativeWind 가 `font-manrope` 클래스를 받으면 `fontFamily: 'Manrope'` 로 변환. weight 변형 (`Manrope-Bold` 등) 은 Phase 2 의 `<Display>`, `<H1>` 등 typography 컴포넌트가 inline `style={{ fontFamily: 'Manrope-Bold' }}` 로 처리. 본 step 은 등록만.

### 3. `app/_layout.tsx` 갱신 — 폰트 게이트 + splash

```tsx
import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useAppFonts } from '@/theme/fonts';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* splash 가 이미 hide 된 경우 무시 — dev fast refresh */
});

export default function RootLayout() {
  const { ready, error } = useAppFonts();

  useEffect(() => {
    if (ready || error) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [ready, error]);

  if (!ready && !error) {
    return null;
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#FFFFFF' },
        }}
      />
    </>
  );
}
```

> Zustand hydration 게이트 (Promise.all([폰트, persona, favorites, recent, settings])) 는 Phase 3 (state-data) 에서 추가. 본 step 은 폰트만.

> `error` 도 ready 처럼 splash 해제 트리거 — 폰트 로딩 실패 시 화면이 영원히 splash 에 머무르는 사고 방지. 실제 처리 (시스템 폰트 fallback) 는 Phase 5 의 ErrorView 가 담당.

### 4. ESLint 셋업

`devDependencies` 추가:

- `eslint` (`^8.57.x`)
- `eslint-config-expo` (Expo SDK 52 페어)
- `@typescript-eslint/eslint-plugin` (`^7.x`)
- `@typescript-eslint/parser` (`^7.x`)
- `eslint-plugin-import` (`^2.29.x`)
- `eslint-plugin-react` (`^7.34.x`)
- `eslint-plugin-react-native` (`^4.x`)

`.eslintrc.js`:

```js
module.exports = {
  root: true,
  extends: [
    'expo',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import', 'react-native'],
  settings: {
    'import/resolver': {
      typescript: { project: './tsconfig.json' },
      node: true,
      'babel-module': {},
    },
    react: { version: 'detect' },
  },
  rules: {
    // CLAUDE.md import 순서: 1) RN/Expo → 2) 외부 → 3) @/ alias → 4) 상대
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        pathGroups: [
          { pattern: 'react', group: 'external', position: 'before' },
          { pattern: 'react-native', group: 'external', position: 'before' },
          { pattern: 'expo*/**', group: 'external', position: 'before' },
          { pattern: 'expo*', group: 'external', position: 'before' },
          { pattern: '@/**', group: 'internal', position: 'before' },
        ],
        pathGroupsExcludedImportTypes: ['builtin', 'external'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    // ADR-024: 프로덕션 console 정책
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    // any 금지 (CLAUDE.md CRITICAL — strict 모드)
    '@typescript-eslint/no-explicit-any': 'error',
    // 미사용 import 제거 강제
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    // RN: inline style 사용은 허용 (NativeWind 는 className 우선이지만 inline 보강 필요)
    'react-native/no-inline-styles': 'off',
    'react-native/no-color-literals': 'warn', // 색 hex 직접 박지 마라 (CLAUDE.md CRITICAL)
    // import resolver
    'import/no-unresolved': 'error',
  },
  ignorePatterns: [
    'node_modules/',
    '.expo/',
    'dist/',
    'web-build/',
    'ios/',
    'android/',
    'docs/design/hifi/**', // 웹 React 레퍼런스 (RN 아님)
    '*.config.js', // root config 는 ESLint scope 외
  ],
};
```

> `eslint-import-resolver-babel-module` 와 `eslint-import-resolver-typescript` 는 `babel-plugin-module-resolver` 의 `@/*` alias 와 typescript paths 를 동시 인식하기 위해 둘 다 필요. devDependencies 에 추가:
>
> - `eslint-import-resolver-typescript` (`^3.6.x`)
> - `eslint-import-resolver-babel-module` (`^5.3.x`)

### 5. Prettier 셋업

`devDependencies`:

- `prettier` (`^3.3.x`)
- `eslint-config-prettier` (`^9.x`) — ESLint 와 충돌 룰 비활성화

`.prettierrc.js`:

```js
module.exports = {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  arrowParens: 'always',
};
```

`.eslintrc.js` 의 `extends` 에 `'prettier'` 를 마지막에 추가 (룰 충돌 무력화).

### 6. `babel-plugin-transform-remove-console` (ADR-024)

`devDependencies`: `babel-plugin-transform-remove-console` (`^6.9.x`)

`babel.config.js` 갱신:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: { '@': './src' },
        },
      ],
      ...(process.env.NODE_ENV === 'production'
        ? [['transform-remove-console', { exclude: ['warn', 'error'] }]]
        : []),
    ],
  };
};
```

### 7. `package.json` 스크립트 갱신

```json
{
  "scripts": {
    "dev": "expo start",
    "ios": "expo start --ios",
    "android": "expo start --android",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.tsx --max-warnings 0",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "format": "prettier --write \"**/*.{ts,tsx,js,json,md}\" --ignore-path .gitignore",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,json,md}\" --ignore-path .gitignore",
    "test": "jest --passWithNoTests",
    "test:coverage": "jest --coverage --passWithNoTests",
    "build": "eas build"
  }
}
```

> `--max-warnings 0` 으로 ESLint warn 도 실패 처리. ADR-024 의 console policy + react-native/no-color-literals 둘 다 warn → 위반 시 빌드 실패.

### 8. `.eslintignore` (필요 시)

`.eslintrc.js` 의 `ignorePatterns` 로 충분하므로 별도 파일 미작성. (Prettier 는 `--ignore-path .gitignore` 로 통일.)

### 9. 첫 lint 통과를 위한 정리

`npm run lint` 실행 시 본 phase 에서 작성된 모든 파일이 통과해야 한다:

- `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/settings.tsx`, `app/onboarding.tsx`, `app/compare/[cityId].tsx`, `app/detail/[cityId]/[category].tsx`
- `src/theme/tokens.ts`, `src/theme/fonts.ts`
- `src/{components,store,lib,types}/index.ts` (stub)
- `src/__test-utils__/sanity.test.ts`, `rntl-import.test.ts`
- `jest.setup.js`

위반 발견 시 lint 룰을 약화하지 말고 코드를 고친다 (예: import 순서 재배열, unused import 제거).

### 10. 환경 변수 검증 — 본 step 은 추가하지 않는다

`.env*` 는 v1.0 에서 사용 안 함. ADR-013 의 hooks 가 `.env` 파일 직접 쓰기를 차단하고 있다. 본 step 에서 `.env.example` 도 만들지 않는다.

### 11. `index.json` summary

`"summary": "폰트 등록 (Manrope/Mulish/Pretendard 10 weight) + useAppFonts hook + ESLint(import order, no-console warn, no-color-literals) + Prettier + transform-remove-console (production)"`

## Acceptance Criteria

```bash
npm install
npm run typecheck
npm run lint
npm run format:check
npm test
```

- 의존성 설치 성공
- `tsc --noEmit` 통과
- `eslint . --max-warnings 0` 통과 — warn 0건
- `prettier --check` 통과 — 미포맷 파일 0건
- `jest --passWithNoTests` 통과 — bootstrap step 4 의 smoke 2건 PASS

수동 (사용자가 1회 확인):

```bash
npm run dev
# Expo Go 또는 시뮬레이터에서 콜드스타트 → splash → 폰트 로드 후 홈 placeholder 표시
# 폰트가 로드되면 화면이 시스템 폰트 → Manrope/Mulish 로 visibly 전환되어야 함
```

## 검증 절차

1. AC 커맨드 순차 실행.
2. 폰트·lint 체크리스트:
   - `assets/fonts/` 에 9개 .ttf + LICENSE.md 존재 (Pretendard 1종 + Manrope 5종 + Mulish 4종 → **10개** — 확인: Mulish ExtraBold 가 빠진 이유는 design hifi 가 800 weight 를 Manrope 로만 사용하기 때문. UI_GUIDE.md §타이포그래피 의 weight 표 확인 후 9개 또는 10개 결정 — display/h1 (Manrope 800), h2/h3 (Manrope 700), body (Mulish 400), small/tiny (Mulish 400), mono-label (Manrope 600). Mulish 는 400 만 필요. 따라서 최종 **6개**: Manrope 5 weight + Mulish 1 weight + Pretendard 1. 본 §1 의 9개 spec 을 6개로 줄여 작성하라 — 사용 안 하는 weight 는 등록하지 않는다)
   - `useAppFonts` 가 `[true, null]` 반환 시 splash 해제
   - ESLint import 순서가 CLAUDE.md spec (RN/Expo → 외부 → @/ → 상대) 과 일치
   - `react-native/no-color-literals` 가 warn 으로 등록 (color hex 직접 박기 차단)
   - `babel.config.js` 의 `transform-remove-console` 가 production NODE_ENV 에서만 활성화
3. `phases/bootstrap/index.json` 의 step 5 업데이트.
4. **phase 전체 종료 처리**: `phases/bootstrap/index.json` 의 phase-level 에 `completed_at` 타임스탬프 추가 (다른 step 모두 completed 일 때만).

> §1 의 폰트 weight 개수 ambiguity 정리: 본 step 은 **Manrope 5 weight (400/500/600/700/800) + Mulish 1 weight (400) + Pretendard 1 weight (400)** = 총 **7 파일**로 진행한다. UI_GUIDE.md §타이포그래피 가 Manrope 400/500 을 명시 지정하지 않지만, 디자인 hifi 가 일부 영역에서 weight transition 을 사용하므로 5 weight 모두 등록. Mulish 는 본문 전용 (400 만) — Phase 5 시각 검증 후 추가 weight 필요 시 별도 PR. 위 §1 의 spec 도 이 7 파일로 정정.

## 금지사항

- 폰트 weight 별 typography 컴포넌트 (`<H1>`, `<Body>` 등) 작성 금지. 이유: Phase 2 (design-system) 의 책임. 본 step 은 폰트 _등록_ 만.
- `expo-font` 의 직접 import 금지 (반드시 `useAppFonts` hook 경유). 이유: Phase 3 의 hydration 게이트 합성 시 단일 진입점 필요.
- ESLint rule 을 약화시켜 lint 통과 시도 금지. 이유: 본 phase 에서 작성된 코드가 룰을 만족하지 못하면 코드를 고친다 — 룰을 늘리는 건 가능하지만 줄이는 건 ADR.
- `react-native/no-color-literals` 를 `off` 처리 금지. 이유: CLAUDE.md CRITICAL — 토큰 외 hex 금지.
- `no-console` 을 `error` 로 격상 금지 (현재 warn). 이유: 개발 중 `console.log` 가 빈번하고 production build 에서 babel 이 자동 제거. 둘 다 error 면 dev 도 차단되어 마찰 ↑. ADR-024 명시.
- Prettier `singleQuote: false` 설정 금지. 이유: TS/RN ecosystem 표준 single quote.
- `eslint-config-airbnb-*` 도입 금지. 이유: Expo / RN ecosystem 과 충돌이 잦고, expo config + custom rules 로 충분.
- `babel.config.js` 에서 production NODE_ENV 외 환경에서 `transform-remove-console` 활성화 금지. 이유: dev 디버깅 시 로그가 사라져 진단 어려움.
- 라이선스 명시 없이 폰트 추가 금지 (`assets/fonts/LICENSE.md` 필수). 이유: 외부 자산은 출처·라이선스 추적이 ADR-018 의 라이선스 결정 시 자료가 됨.
