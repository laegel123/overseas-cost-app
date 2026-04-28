# Step 2: expo-router

## 읽어야 할 파일

- `phases/bootstrap/step0.md`, `phases/bootstrap/step1.md` 와 그 산출물
- `docs/ARCHITECTURE.md` §라우팅 (lines 81–96), §부팅·hydration 순서 (lines 216–234)
- `docs/PRD.md` §6. 기능 요구사항 — 화면 구성 확인
- `docs/UI_GUIDE.md` §온보딩, §홈, §Compare/Detail, §설정 (UI 텍스트 한국어 표준)
- `docs/ADR.md` §ADR-016 (다크모드·다국어·푸시·딥링크 v1.0 미지원), §ADR-041 (탭 동작 — 즐겨찾기·비교 탭 라우팅 단축)

## 작업

Expo Router 의 **빈 라우트 구조**만 만든다. 실제 화면 구현 (UI, 데이터, 상태 연결) 은 **Phase 5 (screens) 의 책임**이며, 본 step 에서는 라우터가 모든 라우트를 인식하고 `expo-doctor` / `tsc` / smoke render 가 통과하는 것까지만 검증한다.

화면 본문은 모두 "준비 중" placeholder 로 채운다. 추후 phase 에서 덮어쓴다.

### 1. 라우트 트리

`docs/ARCHITECTURE.md` §라우팅 과 1:1 일치하게 다음 파일을 만든다 (모두 **placeholder**):

```
app/
├── _layout.tsx                       # 루트 레이아웃 (Stack + 임시 hydration gate stub)
├── onboarding.tsx                    # 1회성 페르소나 선택 placeholder
├── (tabs)/
│   ├── _layout.tsx                   # Tabs 레이아웃 (홈·설정 두 탭만 — 비교·즐겨찾기는 ADR-041 라우팅 단축)
│   ├── index.tsx                     # 홈 placeholder
│   └── settings.tsx                  # 설정 placeholder
├── compare/
│   └── [cityId].tsx                  # Compare placeholder
└── detail/
    └── [cityId]/
        └── [category].tsx            # Detail placeholder
```

기존 `app/index.tsx` (Step 0 의 임시 stub) 가 있다면 삭제한다. 새 홈은 `app/(tabs)/index.tsx`.

### 2. `app/_layout.tsx`

```tsx
import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

/**
 * 루트 레이아웃. 폰트 로딩 / Zustand hydration gate 는 각각 Step 5 / Phase 3 에서 추가된다.
 * 본 step 에서는 Stack 만 깐다.
 */
export default function RootLayout() {
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

> hex `#FFFFFF` 가 직접 쓰인 것은 토큰의 `white` 와 동일하다. 이 step 에서 `src/theme/tokens.ts` import 도 가능하지만, alias 미정 (Step 3 책임) 이라 상대경로로 쓸 거면 가능. 단순함 유지를 위해 hex 한 곳 허용 — Phase 2 design-system 에서 `<Screen>` 컴포넌트로 흡수될 때 토큰 참조로 교체.

### 3. `app/(tabs)/_layout.tsx`

```tsx
import { Tabs } from 'expo-router';

/**
 * 하단 탭. v1.0 은 홈·설정 두 탭만 실제 화면 보유 (ADR-041).
 * 비교·즐겨찾기 탭은 Phase 5 에서 라우팅 단축 (홈으로 redirect + state 변형) 으로 구현.
 * 본 step 에서는 두 탭만 등록한다.
 */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: '홈' }} />
      <Tabs.Screen name="settings" options={{ title: '설정' }} />
    </Tabs>
  );
}
```

### 4. 화면 placeholder 5종

각 placeholder 는 **공통 패턴**: SafeArea 안에 화면 이름 + "준비 중" 문구. 다음 표 그대로 작성.

| 파일                                 | 표시 텍스트                                               |
| ------------------------------------ | --------------------------------------------------------- |
| `app/(tabs)/index.tsx`               | `홈 (준비 중)`                                            |
| `app/(tabs)/settings.tsx`            | `설정 (준비 중)`                                          |
| `app/onboarding.tsx`                 | `온보딩 (준비 중)`                                        |
| `app/compare/[cityId].tsx`           | `Compare: {cityId} (준비 중)` (useLocalSearchParams 사용) |
| `app/detail/[cityId]/[category].tsx` | `Detail: {cityId} / {category} (준비 중)`                 |

각 파일 시그니처 예 (`app/compare/[cityId].tsx`):

```tsx
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView, Text, View } from 'react-native';

export default function CompareScreen() {
  const { cityId } = useLocalSearchParams<{ cityId: string }>();
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center">
        <Text className="font-manrope text-h2 text-navy">{`Compare: ${cityId ?? '?'} (준비 중)`}</Text>
      </View>
    </SafeAreaView>
  );
}
```

각 placeholder 파일 상단에 한 줄 주석:

```tsx
// Placeholder. 실제 구현은 Phase 5 (screens) 에서.
```

> NativeWind 클래스 (`flex-1`, `bg-white`, `font-manrope`, `text-h2`, `text-navy`) 가 정상 적용되는지 동시 확인. `react-native-safe-area-context` 의 `SafeAreaView` 는 Phase 2 에서 도입할 `<Screen>` 컴포넌트가 흡수할 예정이지만, 이 step 에서는 RN 표준 `SafeAreaView` 를 쓴다 (의존성 추가 회피).

### 5. expo-router typed routes 활성화

step0 에서 `app.json` 에 `expo.experiments.typedRoutes: true` 가 이미 설정되어 있다. 본 step 에서 `npx expo` 첫 실행 시 `.expo/types/router.d.ts` 가 생성된다. `tsconfig.json` 의 `include` 에 `.expo/types/**/*.ts` 가 들어 있는지 확인 — Step 0 에서 추가했으므로 OK.

### 6. routing 검증

수동 1회 (사용자가 `npm run dev` 로 실행 가능해야 한다):

- 콜드스타트 → 홈 화면 ("홈 (준비 중)") 표시
- 하단 탭에 홈/설정 두 탭, 탭 전환 시 각 placeholder 표시
- Deep link / 탭 전환은 동작하지 않아도 OK (Phase 5 책임)

본 step 의 자동 AC 는 typecheck + expo-doctor 로 한정. router smoke 는 Phase 5 의 통합 테스트가 검증.

### 7. `index.json` 업데이트 시 라우트 list 명시

step 2 의 `summary` 에 만든 라우트 5개를 한 줄로 적는다. 예: `"summary": "Expo Router 5 라우트 placeholder (_layout, (tabs)/{index,settings}, onboarding, compare/[cityId], detail/[cityId]/[category])"`.

## Acceptance Criteria

```bash
npm run typecheck
npx expo-doctor
```

- `tsc --noEmit` 통과 — `useLocalSearchParams<{ cityId: string }>()` 같은 typed route 가 strict 모드에서 에러 없이 컴파일
- `expo-doctor` 통과
- `.expo/types/router.d.ts` 가 자동 생성됨 (typed routes)

추가 수동 (사용자가 1회 확인):

```bash
npm run dev
# Expo Go 또는 시뮬레이터에서 콜드스타트 → 홈 placeholder 표시 확인
```

## 검증 절차

1. AC 커맨드 실행.
2. 라우팅 체크리스트:
   - 5개 placeholder 파일 존재? (`app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/settings.tsx`, `app/onboarding.tsx`, `app/compare/[cityId].tsx`, `app/detail/[cityId]/[category].tsx` — 7개 파일)
   - `(tabs)/_layout.tsx` 가 홈·설정 두 탭만 등록 (비교·즐겨찾기 탭 X — ADR-041)
   - `app.json` 의 `expo.scheme: "overseascost"` 그대로 유지 (ADR-016: 예약만)
   - `userInterfaceStyle: "light"` 유지 (다크모드 미지원)
   - 모든 placeholder 가 **"준비 중"** 표기 (UI_GUIDE.md §UI 텍스트 한국어 표준 — 임시 placeholder 라도 한국어 우선)
3. `phases/bootstrap/index.json` 의 step 2 업데이트.

## 금지사항

- placeholder 화면에 실제 도메인 컴포넌트 (`HeroCard`, `ComparePair` 등) import 금지. 이유: Phase 2 (design-system) 가 만들기 전이라 존재하지 않음.
- placeholder 화면에서 Zustand 스토어 import 금지. 이유: Phase 3 (state-data) 의 책임. 본 step 에서 import 하면 의존 그래프 역전.
- placeholder 화면에서 `fetch` 또는 `data.ts` 함수 호출 금지. 이유: 동일.
- 비교/즐겨찾기 탭을 `Tabs.Screen` 으로 추가 금지. 이유: ADR-041 — 비교·즐겨찾기 탭은 라우팅 단축으로 구현되며 별도 화면 아님. 본 step 에서 두 탭을 만들면 사용자가 화면이 비어 있다고 오해.
- `expo-splash-screen` 명시적 import / hide 금지. 이유: Step 5 (또는 Phase 5) 가 폰트 / hydration 게이트와 함께 일괄 처리.
- Stack/Tabs 의 `screenOptions` 에 색상 hex 직접 박기 (단, `_layout.tsx` 의 `contentStyle: { backgroundColor: '#FFFFFF' }` 한 곳만 예외 허용 — Phase 2 에서 토큰 참조로 교체 예정). 이유: 단일 출처 원칙은 컴포넌트 단위에서 강제, 라우터 boilerplate 는 toleration 인정.
- 디자인 토큰 `tokens.ts` 의 import 강제 금지 (alias 미정 — Step 3 책임). 이유: 상대경로 의존이 Step 3 의 alias 도입 시 양산 수정 필요.
- 라우트별 `Stack.Screen options` 에 한국어 title (`'온보딩'`, `'비교'` 등) 채우기 금지. 이유: 헤더는 UI_GUIDE.md 의 `<TopBar>` 가 담당 (Phase 2). expo-router 기본 헤더는 모두 hidden.
