# Step 0: typography

8 variant 타이포 컴포넌트 — Display / H1 / H2 / H3 / Body / Small / Tiny / MonoLabel. NativeWind 클래스 + tailwind.config.js fontFamily / fontSize / colors 단일 출처. 다른 모든 컴포넌트의 의존 — 본 step 이 phase 진입점.

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL (디자인 토큰 단일 출처 + strict TS)
- `docs/design/README.md` §Typography (type scale 8 단계)
- `docs/UI_GUIDE.md` (한국어 1차, 안티패턴)
- `docs/TESTING.md` §9.9 (8개 컴포넌트별 매트릭스)
- `tailwind.config.js` (fontFamily / fontSize / colors)
- `src/theme/fonts.ts` (FONT_MAP)
- `jest.config.js` (`src/components/**` threshold 100/100/100/100 — app-shell phase 에서 강제)

## 작업

### 1. `src/components/typography/Text.tsx` (단일 파일, 8 named export)

design/README.md §Typography 의 type scale 을 그대로 옮긴다:

| 컴포넌트 | fontFamily | size | line-height | letter-spacing | color (기본) |
|---|---|---|---|---|---|
| `Display` | Manrope-ExtraBold | 30 | 33 | -0.6 | navy |
| `H1` | Manrope-ExtraBold | 24 | 28 | -0.48 | navy |
| `H2` | Manrope-Bold | 18 | 22 | -0.18 | navy |
| `H3` | Manrope-Bold | 14 | 18 | — | navy |
| `Body` | Mulish | 14 | 20 | — | navy |
| `Small` | Mulish | 12 | 16 | — | gray |
| `Tiny` | Mulish | 11 | 14 | — | gray-2 |
| `MonoLabel` | Manrope-SemiBold | 10 | 12 | 1px (0.1em) | gray-2, **uppercase 자동 변환** |

각 컴포넌트는 동일한 props 시그니처:

```ts
type TextProps = {
  children: React.ReactNode;
  color?: 'navy' | 'gray' | 'gray-2' | 'white' | 'orange';
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  className?: string;            // NativeWind 추가 클래스
  accessibilityRole?: 'header' | 'text';  // h1/h2/h3 의 default 는 'header'
  testID?: string;
};

export function Display(props: TextProps): JSX.Element;
export function H1(props: TextProps): JSX.Element;
// ... 나머지 6개
```

내부 구현은 단일 base 컴포넌트 + variant 매핑으로 boilerplate 최소화. **매직 hex 컬러 박지 마라** — `tailwind.config.js` colors 토큰만 사용.

`MonoLabel` 만 `style={{ textTransform: 'uppercase' }}` 또는 children 렌더 시 `.toUpperCase()` 적용.

`numberOfLines={1}` 전달 시 ellipsis (RN Text 기본 동작 — 명시 prop 만 전달).

### 2. `src/components/index.ts` re-export

```ts
export {
  Display, H1, H2, H3, Body, Small, Tiny, MonoLabel,
} from './typography/Text';
export type { TextProps } from './typography/Text';
```

기존 `ErrorBoundary`, `ErrorView` re-export 유지.

### 3. 테스트 — `src/components/typography/__tests__/Text.test.tsx`

8 variant × 매트릭스 항목으로 개수 폭증 가능 — 합성 케이스로 압축:

- 각 variant 1회 한국어 + 1회 영문 + 1회 한글+이모지 렌더 확인
- variant 별 fontFamily / fontSize 정확 매칭 (rendered style 검증)
- color prop override 작동 (default → custom)
- `numberOfLines={1}` ellipsis 적용 props 전달
- `numberOfLines={2}` 다중 라인
- `MonoLabel` uppercase 변환 (`'foo' → 'FOO'`)
- H1/H2/H3 의 default `accessibilityRole='header'`
- Body/Small/Tiny default `accessibilityRole` 없음 (또는 'text')
- `style` prop 으로 추가 override (RN Text 기본 동작 — passthrough 검증)
- 매우 긴 텍스트 wrap (default)

대략 35~45 case. 각 variant 의 fontFamily / fontSize 검증은 `getByText().props.style` 로 합성된 style 객체에서 확인.

### 4. TESTING.md §9.9 인벤토리

체크박스 갱신. step 0 으로 cover 된 항목 표시.

## Acceptance Criteria

```bash
npm run typecheck \
  && npm run lint \
  && npm test -- --coverage src/components
```

- typecheck / lint 통과
- 35~45 case 통과
- `src/components/**` 100/100/100/100 유지
- 변경 파일:
  - 신규 `src/components/typography/Text.tsx`, `src/components/typography/__tests__/Text.test.tsx`
  - 수정 `src/components/index.ts`, `docs/TESTING.md`

## 검증 절차

1. AC 명령 실행
2. 체크리스트:
   - 8 variant 모두 export 됨?
   - tailwind.config.js 의 fontSize / fontFamily 와 1:1 정합?
   - MonoLabel 의 uppercase 가 작동?
   - 매직 hex / 매직 숫자 없음?
   - h1/h2/h3 default `accessibilityRole='header'`?
3. `phases/components/index.json` step 0 → completed

## 금지사항

- **단일 base 외 다른 추상화 도입 금지** (예: HOC, render prop). 이유: 8 variant 는 단순 매핑이라 over-engineering.
- **매직 hex / 매직 px 박지 마라.** 이유: CLAUDE.md CRITICAL 의 디자인 토큰 단일 출처.
- **외부 typography 라이브러리 추가 금지** (예: react-native-typography). 이유: NativeWind v4 + 디자인 토큰만으로 충분.
- **`Display` / `H1` 외에 더 큰 사이즈 추가 금지.** 이유: design/README.md type scale 이 8 단계로 fix.
- **`Text` (RN core) 와 충돌하지 않게 export 명 분리.** 이유: 사용처에서 `import { Text } from 'react-native'` 와 충돌.
- 기존 테스트 깨뜨리지 마라.
