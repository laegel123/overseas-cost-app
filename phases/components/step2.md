# Step 2: layout-chrome

화면 chrome — Screen (SafeArea + 배경) + TopBar (제목/뒤로/우측 버튼) + BottomTabBar (4 탭). 모든 화면이 본 컴포넌트 위에서 동작.

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL
- `docs/design/README.md` §Status Bar / Phone Frame, §Spacing & Radius
- `docs/UI_GUIDE.md` §화면별 패턴, §하단 탭
- `docs/TESTING.md` §9.11 (Screen), §9.12 (TopBar 8 prop 매트릭스), §9.13 (BottomTabBar)
- `docs/ARCHITECTURE.md` §라우팅, §하단 탭
- step 0~1 산출물: Text variants, Icon

## 작업

### 1. `src/components/Screen.tsx`

```ts
export type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;             // 기본 false — ScrollView wrap
  padding?: 'none' | 'screen-x' | 'screen-x-tight' | 'screen-x-loose';
  edges?: ('top' | 'bottom' | 'left' | 'right')[]; // SafeArea edges
  testID?: string;
};
```

- SafeAreaView (`react-native-safe-area-context`) 로 wrap. iOS notch / iPhone SE 모두 정상.
- 배경 `bg-white` (디자인 토큰).
- `scroll=true` 시 ScrollView + `contentContainerStyle` 로 padding 전달, 일반 View 면 그대로.
- padding 은 tailwind config 의 spacing 토큰 매핑.

### 2. `src/components/TopBar.tsx`

```ts
export type TopBarProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;          // 미제공 시 back 버튼 미표시
  rightIcon?: IconName;         // 미제공 시 우측 버튼 미표시
  rightIconAccent?: 'default' | 'star';  // star → orange-soft bg
  onRightPress?: () => void;
  testID?: string;
};
```

- 8 prop 조합 매트릭스 (TESTING.md §9.12).
- back 버튼: 36×36, `bg-light` (#F0F5F9), 좌측. Icon `back` 22 navy.
- right 버튼: 36×36, accent='star' 일 때 `bg-orange-soft`. Icon prop 으로 명시.
- title: 가운데 정렬, H2 navy, `numberOfLines={1}` ellipsis.
- subtitle: title 아래 11px Tiny gray-2, `numberOfLines={1}`.
- header padding 좌우 16px, 상하 SafeArea + 8px.

### 3. `src/components/BottomTabBar.tsx`

```ts
export type Tab = 'home' | 'compare' | 'favorites' | 'settings';

export type BottomTabBarProps = {
  active: Tab;
  onSelect: (tab: Tab) => void;
  testID?: string;
};
```

- 4 탭: home / compare / favorites / settings. 각 탭은 Icon (22px) + Label (10px Mulish 600 = MonoLabel 의 size 와 다름 — 별도 micro 텍스트).
- active 탭: orange icon + orange label.
- inactive: gray-2 icon + gray-2 label.
- safe area bottom padding (`useSafeAreaInsets().bottom` 14px iPhone X+, 0 SE).
- 탭 클릭 → `onSelect(tab)` 호출. 햅틱은 옵션 (v1.0 미구현 — `Haptics.selectionAsync()` 시 ADR 추가).
- 탭 라벨은 한국어: 홈 / 비교 / 즐겨찾기 / 설정.

### 4. `src/components/index.ts` re-export

```ts
export { Screen } from './Screen';
export type { ScreenProps } from './Screen';
export { TopBar } from './TopBar';
export type { TopBarProps } from './TopBar';
export { BottomTabBar } from './BottomTabBar';
export type { BottomTabBarProps, Tab } from './BottomTabBar';
```

### 5. 테스트

#### `Screen.test.tsx` (~10 case)

- 자식 렌더, SafeArea 적용
- scroll=true → ScrollView wrap
- scroll=false → View
- padding 토큰 적용
- edges prop 전달

#### `TopBar.test.tsx` (~20 case)

- 8 prop 조합 매트릭스
- back 탭 → onBack
- right 탭 → onRightPress
- right accent 'star' → orange-soft bg
- subtitle ellipsis
- 긴 title ellipsis

#### `BottomTabBar.test.tsx` (~15 case)

- 4 탭 렌더
- active 탭 색상
- 탭 클릭 → onSelect(tab)
- 한국어 라벨 정확
- safe area bottom 적용

대략 45 case 합계.

### 6. TESTING.md §9.11~13 인벤토리

체크박스 갱신.

## Acceptance Criteria

```bash
npm run typecheck \
  && npm run lint \
  && npm test
```

- typecheck / lint 통과
- 모든 테스트 통과
- `src/components/**` 100/100/100/100 유지
- 변경 파일: 3 신규 컴포넌트 + 3 테스트, `src/components/index.ts`, `docs/TESTING.md`

## 검증 절차

1. AC 명령 실행
2. 체크리스트:
   - SafeArea edges 가 prop 으로 제어 가능?
   - TopBar 8 조합 모두 동작?
   - BottomTabBar 한국어 라벨 (홈/비교/즐겨찾기/설정)?
   - Icon / Text variants 만 사용 (직접 RN core import 없음)?
3. `phases/components/index.json` step 2 → completed

## 금지사항

- **header 안에 다른 chrome 추가 금지** (예: gradient 배경, 그림자). 이유: 디자인 토큰 외 시각 변형은 별도 ADR.
- **하단 탭에 5번째 탭 추가 금지.** 이유: PRD §F1 4 탭 고정.
- **햅틱 / 애니메이션 도입 금지.** 이유: v1.0 미스코프, 별도 ADR.
- **헤더 / 탭 의 색상에 매직 hex 금지.** 이유: tokens 만.
- **Screen 안에 KeyboardAvoidingView 자동 wrap 금지.** 이유: v1.0 입력 폼 없음 (PRD §M3 검색은 화면 단 책임).
- 기존 테스트 깨뜨리지 마라.
