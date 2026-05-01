# Step 4: onboarding

Onboarding 화면 — 설치 직후 1회. 페르소나 선택. 이후 홈으로 진입.

`app/onboarding.tsx` placeholder 를 실제 구현으로 교체.

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL (페르소나 3 값)
- `docs/PRD.md` — Onboarding 화면 요구사항
- `docs/design/README.md` §1 (Onboarding)
- `docs/UI_GUIDE.md` §Onboarding
- `docs/ARCHITECTURE.md` §라우팅 / §부팅·hydration (onboarded 가드)
- `docs/TESTING.md` §10
- `docs/ADR.md` ADR-016 (다국어·다크모드 미지원)
- 데이터·스토어:
  - `src/store/persona.ts` — `setPersona`, `setOnboarded`
- 컴포넌트:
  - `Screen`, `Icon`
  - typography (`Display`, `H3`, `Body`, `Small`, `Tiny`)
- step 3 (settings) 산출물 — 페르소나 라벨 단일 출처 (`src/lib/persona.ts` 또는 `src/i18n/persona.ko.ts`) 재사용

## 작업

### 1. `app/onboarding.tsx`

- Layout (Screen edges=top+bottom):
  - **Hero icon** (56×56 orange 18px 라운드 + shadow):
    - 흰색 글로브 아이콘 28px (Icon `globe` 또는 `world` — IconName 매핑 확인). 시각적 강조용.
  - **Greeting** (Display 30px Manrope 800):
    - 첫 줄 navy: `해외 생활비,`
    - 둘째 줄 orange: `한눈에 비교해요`
    - letter-spacing -0.02em, line-height 1.1
  - **Sub-greeting** (Body gray-2): `서울 vs 해외 도시 1:1 비교 · 환율 자동 변환`
  - **`어떤 분이신가요?`** label (H3 navy mb-3)
  - **Persona cards × 3**:
    - `student` (primary): border `1.5 solid orange`, `bg-orange-tint`. 좌측 아이콘 박스 44×44 12px 라운드 orange. Title `유학생` (H3 Manrope 700) / Sub `학비 · 셰어 · 식비 중심` (Tiny gray-2). 우측 chevron orange.
    - `worker` (secondary): border `1 solid line`, `bg-white`. 아이콘 박스 light. Title `취업자` / Sub `실수령 · 1베드 · 세금 중심`.
    - `unknown` (tertiary): border-style `dashed`, `bg-transparent`. 텍스트 약화 (gray). Title `아직 모름` / Sub `둘 다 보여드릴게요`.
  - **Footer text**: `설정에서 언제든 변경할 수 있어요` (Tiny gray-2 center)
- 각 카드 탭 → `setPersona(value) + setOnboarded(true) + router.replace('/(tabs)')`
- 카드는 `Pressable` + `accessibilityRole="button"` + `accessibilityLabel`
- 탭 시각 효과: 약 100ms scale-down (transform translateY(1px)) — design §Interactions

### 2. 페르소나 라벨·sub 단일 출처

step 3 에서 만든 `PERSONA_LABEL` / `PERSONA_SUB` 재사용. 본 화면도 동일 카탈로그 import. drift 방지.

### 3. 라우팅 가드

- `_layout.tsx` 가 이미 `!onboarded` 시 `/onboarding` 으로 redirect — 수정 X
- `setOnboarded(true)` 후 `router.replace('/(tabs)')` 명시적 호출 (segments effect 의존 X — 즉시 이동)

### 4. 테스트 (`app/__tests__/onboarding.test.tsx`)

- 3 카드 mount + 라벨·sub 일치
- student 탭 → `setPersona('student')` + `setOnboarded(true)` + `router.replace('/(tabs)')`
- worker 탭, unknown 탭 동일
- accessibilityLabel 검증 (각 카드 페르소나 라벨 포함)
- snapshot 1 케이스

### 5. `docs/TESTING.md` §10 인벤토리 추가 + phase 종료 인벤토리 검토 (5 화면 모두 등재)

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
```

- 신규 테스트 모두 통과
- 5 화면 인벤토리 §10 완비

## 검증 절차

1. AC 통과
2. 체크:
   - 페르소나 3 값만 사용 (CLAUDE.md CRITICAL)
   - 라벨·sub 단일 출처 import (하드코딩 X)
   - 카드 모두 a11y label
   - 매직 색상 X
3. `phases/screens/index.json` step 4 update + phase 전체 `completed`

## 금지사항

- 페르소나 4번째 값 추가 금지. 이유: CLAUDE.md CRITICAL.
- 라벨·sub 컴포넌트 안에 하드코딩 금지 (step 3 의 단일 출처 재사용). 이유: drift 방지.
- 다국어 (영어 fallback 등) 추가 금지. 이유: ADR-016 / ADR-034.
- `_layout.tsx` 의 라우팅 가드 변경 금지. 이유: app-shell phase 산출물 — 변경은 별도 ADR 필요.
- 시각 효과를 위해 `react-native-reanimated` 직접 사용 금지 (본 step). 이유: scale-down 100ms 는 RN core 의 `Pressable` `pressed` state 또는 단순 `style: pressed ? translateY 1 : 0` 로 충분. 추가 dep 회피.
