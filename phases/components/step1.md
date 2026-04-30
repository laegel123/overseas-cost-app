# Step 1: icon

Icon 컴포넌트 — design/README.md §Assets 의 line-style SVG 22~25개 + `more` (fill circle 3개). 단일 `<Icon name="..." />` API 로 통일.

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL
- `docs/design/README.md` §Assets (아이콘 목록 + 권장 라이브러리: lucide-react)
- `docs/TESTING.md` §9.10 (전체 / Props / Stroke 매트릭스)
- `docs/UI_GUIDE.md` §Icons
- `tailwind.config.js` colors
- step 0 산출물: `src/components/typography/Text.tsx` (필요 시 fallback 텍스트)

## 작업

### 1. SVG 아이콘 source 결정

design/README.md 가 lucide-react 권장. RN 환경에서는 `lucide-react-native` 가 동등 — peer dep `react-native-svg` (이미 `package.json` 에 있음).

**대안 검토:**

- (A) lucide-react-native 도입: 경량, 정확 1:1, 추가 의존성 1개 → 신규 ADR 필요.
- (B) 22개 SVG 를 직접 인라인 작성: 의존성 0, 단 작업 시간 + 유지비.

**결정 기준:** ADR 추가 + lucide-react-native 의 번들 크기 확인. ADR-017 번들 예산 ≤5MB 영향 평가 (lucide-react-native 는 tree-shake 친화적, ~수십 KB).

본 step 의 첫 작업: 도입 여부 결정 → 필요 시 ADR + 의존성 추가. 결정 후 구현.

### 2. `src/components/Icon.tsx`

```ts
export const ICON_NAMES = [
  'home', 'compare', 'star', 'settings', 'search', 'back', 'more',
  'house', 'fork', 'bus', 'passport', 'graduation', 'briefcase',
  'globe', 'chev-right', 'chev-down', 'info', 'refresh', 'mail',
  'shield', 'book', 'user', 'plus', 'filter', 'up',
] as const;

export type IconName = typeof ICON_NAMES[number];

export type IconProps = {
  name: IconName;
  size?: number;        // 기본 22
  color?: string;       // 기본 colors.navy (tokens 만 사용 — caller 가 주입)
  strokeWidth?: number; // 기본 2
  testID?: string;
  accessibilityLabel?: string;
};

export function Icon(props: IconProps): JSX.Element;
```

**lucide 매핑** (라이브러리 도입 결정 시):

```
home → Home, compare → ArrowLeftRight, star → Star, settings → Settings,
search → Search, back → ChevronLeft, more → MoreHorizontal,
house → Home (또는 House), fork → UtensilsCrossed,
bus → Bus, passport → BookMarked, graduation → GraduationCap,
briefcase → Briefcase, globe → Globe,
chev-right → ChevronRight, chev-down → ChevronDown,
info → Info, refresh → RefreshCw, mail → Mail, shield → Shield,
book → Book, user → User, plus → Plus, filter → SlidersHorizontal, up → ArrowUp,
```

매핑은 design/README.md 와 hifi/_shared.jsx 의 SVG path 와 시각 정합성 검증. lucide 와 디자인이 완전 일치하지 않으면 직접 인라인 SVG 로 대체 (해당 아이콘 한정).

### 3. fallback

TS 가 `IconName` literal 외 차단하므로 런타임 fallback 은 defensive — `null` 또는 빈 `<View>` 반환. `/* istanbul ignore next */` 후 noop.

### 4. 테스트 — `src/components/__tests__/Icon.test.tsx`

- 모든 `IconName` 25개 렌더 (forEach 루프)
- size / color / strokeWidth prop 적용 검증 (rendered SVG props)
- testID / accessibilityLabel 전달
- `more` 가 fill circle 3개 (line-style 외 예외)
- 잘못된 name 은 TS 차단되므로 런타임 테스트 불요 (defensive 만 ignore)

대략 35~40 case (25 렌더 + 10~15 prop 매트릭스).

### 5. TESTING.md §9.10 인벤토리 + ADR (필요 시)

lucide-react-native 도입 결정 시 ADR 추가 — "ADR-N: 아이콘 라이브러리 = lucide-react-native (이유: design/README.md 권장, 번들 영향 ~수십 KB, viewBox 일치)".

ADR-017 번들 예산 표에 lucide-react-native 측정값 추가.

## Acceptance Criteria

```bash
npm run typecheck \
  && npm run lint \
  && npm test -- --coverage src/components
```

- typecheck / lint / test 통과
- `src/components/**` 100/100/100/100 유지
- 25 IconName 모두 렌더
- 변경 파일:
  - 신규 `src/components/Icon.tsx`, `src/components/__tests__/Icon.test.tsx`
  - 수정 `src/components/index.ts`, `docs/TESTING.md`
  - (lucide 도입 시) `package.json`, `package-lock.json`, `docs/ADR.md`

## 검증 절차

1. AC 명령 실행
2. 체크리스트:
   - 25 IconName 모두 export?
   - design/README.md 시각과 1:1 정합? (수동 dev 빌드에서 확인)
   - 라이브러리 도입 시 ADR + ADR-017 영향 명시?
   - tokens.ts colors 외 hex 직접 사용 없음?
3. `phases/components/index.json` step 1 → completed

## 금지사항

- **외부 다중 아이콘 라이브러리 혼용 금지** (lucide + heroicons 등). 이유: 시각 일관성 + 번들 중복.
- **stroke 1.8~2.2 외 값 사용 금지** (design/README.md). 이유: 시각 균질성.
- **viewBox 24×24 외 형식 금지.** 이유: 디자인 표준 + size prop 동작 일관성.
- **emoji 를 Icon 으로 wrap 금지.** 이유: emoji 는 GroceryRow 의 식재료 표기 전용 (design/README.md §Assets).
- **fill 사용 금지** (`more` 제외). 이유: line-style 통일.
- 기존 테스트 깨뜨리지 마라.
