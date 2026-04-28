# Step 1: nativewind-tokens

## 읽어야 할 파일

- `phases/bootstrap/step0.md` 와 step0 산출물 (`package.json`, `babel.config.js`, `metro.config.js`, `tsconfig.json`, `app.json`)
- `docs/ADR.md` §ADR-003 (NativeWind v4), §ADR-035 (시각 회귀 — 스냅샷 1차 방어)
- `docs/UI_GUIDE.md` (전체) — 색·shadow·타이포·간격 토큰 정확값
- `docs/design/README.md` §Design Tokens (lines 174–232) — 1:1 일치 강제

CLAUDE.md CRITICAL: "**모든 디자인 토큰(색·폰트·간격·라운드·shadow)은 `tailwind.config.js` + `src/theme/tokens.ts` 단일 출처에서만 정의한다.**"

## 작업

NativeWind v4 셋업과 디자인 토큰의 단일 출처 (tailwind.config.js + src/theme/tokens.ts) 를 확립한다. 컴포넌트는 이번 step 에서 만들지 않는다 (Phase 2 design-system 의 책임). 토큰만 깐다.

### 1. 의존성 추가

`package.json` 에 추가 (`expo install` 또는 `npm install` 권장 페어로):

- `nativewind` (`^4.0.36` 이상 — v4 stable)
- `tailwindcss` (`^3.4.x` — NativeWind v4 페어)
- `react-native-reanimated` (`~3.16.x` — Expo SDK 52 페어; NativeWind v4 가 일부 표현에 reanimated 사용)
- `react-native-css-interop` (NativeWind v4 의 transitive — 명시적으로 추가)

> NativeWind v4 와 Expo SDK / RN 버전 페어가 안 맞으면 metro bundling 에러 발생. `expo install nativewind tailwindcss@3` 로 호환 페어 강제 설치 권장.

### 2. `tailwind.config.js` 작성 — 디자인 토큰 단일 출처

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        orange: '#FC6011',
        'orange-soft': '#FFE9DC',
        'orange-tint': '#FFF4ED',
        navy: '#11263C',
        'navy-2': '#1d3a55',
        gray: '#52616B',
        'gray-2': '#8A98A0',
        light: '#F0F5F9',
        'light-2': '#F7FAFC',
        white: '#FFFFFF',
        line: '#E4ECF2',
      },
      fontFamily: {
        // 실제 로딩은 Step 5 에서. fallback chain 은 여기 정의.
        manrope: ['Manrope', 'Pretendard', 'Apple SD Gothic Neo', 'system-ui'],
        mulish: ['Mulish', 'Pretendard', 'Apple SD Gothic Neo', 'system-ui'],
        pretendard: ['Pretendard', 'Apple SD Gothic Neo', 'system-ui'],
      },
      fontSize: {
        // [size, lineHeight 또는 letterSpacing 별도 className]
        display: ['30px', { lineHeight: '33px', letterSpacing: '-0.6px' }], // 30 * -0.02em
        h1: ['24px', { lineHeight: '28px', letterSpacing: '-0.48px' }],
        h2: ['18px', { lineHeight: '22px', letterSpacing: '-0.18px' }], // 18 * -0.01em
        h3: ['14px', { lineHeight: '18px' }],
        body: ['14px', { lineHeight: '20px' }], // 14 * 1.4
        small: ['12px', { lineHeight: '16px' }],
        tiny: ['11px', { lineHeight: '14px' }],
        'mono-label': ['10px', { lineHeight: '12px', letterSpacing: '1px' }], // 10 * 0.1em
      },
      borderRadius: {
        chip: '999px',
        button: '14px',
        card: '16px',
        'card-lg': '18px',
        hero: '20px',
        'hero-lg': '22px',
        'icon-sm': '10px',
        'icon-md': '16px',
      },
      spacing: {
        // 디자인 mock 기준 자주 쓰이는 값 별칭 — 일반 4px 그리드는 Tailwind 기본 유지
        'screen-x': '20px', // phone padding 16~22 의 중앙
        'screen-x-tight': '16px',
        'screen-x-loose': '22px',
        section: '16px', // section gap 14~18 의 중앙
        'card-pad': '14px', // card internal padding 12~18 의 중앙
      },
    },
  },
  plugins: [],
};
```

### 3. `global.css` — NativeWind directives

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 4. `babel.config.js` 갱신 — NativeWind preset 추가

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  };
};
```

### 5. `metro.config.js` 갱신 — NativeWind metro wrapper

```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: './global.css' });
```

### 6. `nativewind-env.d.ts`

```ts
/// <reference types="nativewind/types" />
```

### 7. `src/theme/tokens.ts` — NativeWind 로 표현 어려운 토큰

NativeWind 클래스만으로 처리 어려운 값 (gradient, shadow, fontWeight 매핑) 을 코드에서 직접 import 가능하게 export. **색은 여기서 다시 정의하지 않고 tailwind.config.js 의 raw hex 값을 단순 re-export 또는 동일 상수로 export** (단일 출처 원칙 — tailwind.config.js 가 진실, tokens.ts 는 코드용 거울).

```ts
// src/theme/tokens.ts
/**
 * 단일 출처: tailwind.config.js. 본 파일은 NativeWind 클래스로 표현하기 어려운
 * 동적 값 (gradient, shadow Platform.select, 폰트 weight 매핑) 만 노출한다.
 *
 * 색 hex 가 필요한 경우 반드시 본 파일의 export 를 사용하라 — 컴포넌트에 hex 직접 박지 마라.
 * tailwind.config.js 의 colors 와 1:1 일치해야 한다 (변경 시 양쪽 동시 수정 + ADR).
 */

export const colors = {
  orange: '#FC6011',
  orangeSoft: '#FFE9DC',
  orangeTint: '#FFF4ED',
  navy: '#11263C',
  navy2: '#1d3a55',
  gray: '#52616B',
  gray2: '#8A98A0',
  light: '#F0F5F9',
  light2: '#F7FAFC',
  white: '#FFFFFF',
  line: '#E4ECF2',
} as const;

export type ColorToken = keyof typeof colors;

export const gradients = {
  // settings 의 페르소나 카드: navy → navy-2
  navyPersonaCard: { start: colors.navy, end: colors.navy2 } as const,
} as const;

import { Platform } from 'react-native';

/**
 * iOS 는 shadow*, Android 는 elevation 을 쓴다. 본 export 는 양쪽 모두 한 객체로 반환.
 * 컴포넌트는 `style={shadows.card}` 형태로 직접 적용.
 */
export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: colors.navy,
      shadowOpacity: 0.06,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 2 },
    default: {},
  }),
  deep: Platform.select({
    ios: {
      shadowColor: colors.navy,
      shadowOpacity: 0.1,
      shadowRadius: 50,
      shadowOffset: { width: 0, height: 20 },
    },
    android: { elevation: 6 },
    default: {},
  }),
  orangeCta: Platform.select({
    ios: {
      shadowColor: colors.orange,
      shadowOpacity: 0.25,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    },
    android: { elevation: 4 },
    default: {},
  }),
  orangeHero: Platform.select({
    ios: {
      shadowColor: colors.orange,
      shadowOpacity: 0.25,
      shadowRadius: 32,
      shadowOffset: { width: 0, height: 12 },
    },
    android: { elevation: 8 },
    default: {},
  }),
  navyCard: Platform.select({
    ios: {
      shadowColor: colors.navy,
      shadowOpacity: 0.18,
      shadowRadius: 32,
      shadowOffset: { width: 0, height: 12 },
    },
    android: { elevation: 6 },
    default: {},
  }),
} as const;

/**
 * Manrope / Mulish weight → React Native fontWeight 매핑.
 * NativeWind className 으로 fontFamily 만 지정하고 weight 는 inline style 로 설정할 때 사용.
 */
export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;
export type FontWeight = (typeof fontWeight)[keyof typeof fontWeight];

/**
 * Hot 판정 임계값 — CLAUDE.md CRITICAL.
 * isHot(mult) 함수는 src/lib/format.ts 에서 본 상수를 import 한다 (Phase 3).
 */
export const HOT_MULTIPLIER_THRESHOLD = 2.0;
```

### 8. Smoke 검증용 import

`app/_layout.tsx` (step0 의 임시 stub) 상단에 `import '../global.css';` 를 추가하여 NativeWind 가 metro bundle 에 들어오는지 확인. **이 한 줄만 변경**, 다른 라우팅 코드는 손대지 않는다 (Step 2 의 책임).

> 만약 step0 에서 `app/_layout.tsx` 를 만들지 않았다면 (route 부재로도 expo doctor 가 통과한 경우), 이 step 에서도 만들지 않는다 — 대신 `metro.config.js` 의 `withNativeWind` 만 적용하고 smoke 는 Step 2 에서 검증.

### 9. NativeWind v4 의 `@/components/ui/...` 경로 alias

이 step 에서 path alias (`@/`) 는 다루지 않는다 (Step 3 책임). NativeWind 가 alias 없이도 동작함을 확인.

## Acceptance Criteria

```bash
npm install
npm run typecheck
npx expo-doctor
```

- 의존성 설치 성공
- `tsc --noEmit` 통과 (`tokens.ts` 가 type 에러 없이 컴파일)
- `expo-doctor` 통과 (NativeWind plugin 충돌·peer dep 경고가 error 가 아니어야 함)

추가로 (수동 1회):

```bash
# metro 가 global.css 를 인식하는지 1회 확인 (3초 후 ctrl+c)
npx expo start --no-dev --minify 2>&1 | head -50
```

stdout 에 `Compiling NativeWind` / `tailwind` 관련 정상 처리 메시지가 보이면 OK. error 가 있으면 metro/babel/nativewind 페어 버전을 교정.

## 검증 절차

1. AC 커맨드를 순차 실행.
2. 토큰 일치 체크리스트:
   - `tailwind.config.js` 의 colors 가 `docs/UI_GUIDE.md` §색상 토큰 (lines 30–42) 과 1:1 일치하는가?
   - `src/theme/tokens.ts` 의 `colors` hex 가 위 tailwind.config 와 1:1 일치하는가?
   - `HOT_MULTIPLIER_THRESHOLD = 2.0` 인가? (CLAUDE.md CRITICAL — Hot 규칙)
   - shadow 5종 (card / deep / orangeCta / orangeHero / navyCard) 모두 정의되어 있는가? (UI_GUIDE.md §그림자 토큰)
3. `phases/bootstrap/index.json` 의 step 1 업데이트.

## 금지사항

- 컴포넌트 (Text, Icon, Screen 등) 생성 금지. 이유: Phase 2 (design-system) 의 책임. 토큰 셋업 step 에서 컴포넌트까지 만들면 의존 그래프가 흔들린다.
- `src/components/`, `src/lib/`, `src/store/`, `src/types/` 디렉터리 생성 금지 (오직 `src/theme/` 만). 이유: Step 3 의 책임.
- 폰트 로딩 코드 (`useFonts`) 작성 금지. 이유: Step 5 책임.
- `tailwind.config.js` 와 `src/theme/tokens.ts` 사이 색상 hex 가 어긋나는 것 금지. 이유: 단일 출처 원칙 (CLAUDE.md CRITICAL).
- NativeWind 클래스로 표현 가능한 토큰 (color, fontSize, borderRadius, spacing) 을 `tokens.ts` 에 중복 정의 금지. 이유: 동일.
- `eslint-plugin-tailwindcss` 추가 금지. 이유: Step 5 의 ESLint 셋업과 충돌 가능 — Step 5 에서 종합 결정.
- `nativewind/babel` plugin 의 위치를 plugins 가 아닌 `presets` 에 두는 정확한 이유: NativeWind v4 가 preset 형태로 제공된다. plugins 항목에 넣으면 동작 안 함.
