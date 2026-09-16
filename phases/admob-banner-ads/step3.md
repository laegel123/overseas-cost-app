# Step 3: screen-footer

## 배경

이 phase(`admob-banner-ads`)는 Google AdMob 하단 배너를 홈·비교·상세 3개 화면에 도입한다. 배너는 스크롤 콘텐츠와 함께 움직이지 않고 **화면 하단 SafeArea 안에 고정**되어야 한다.

**이 step 은 모든 화면의 chrome wrapper `src/components/Screen.tsx` 에 `footer` 슬롯을 추가한다.** step 4 의 `AdBanner` 가 이 슬롯에 들어가고, step 5 가 3개 화면에서 `footer={<AdBanner />}` 를 넘긴다. 이 step 에서는 광고 관련 코드를 전혀 참조하지 않는다 — 순수한 레이아웃 슬롯이다.

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래를 반드시 직접 Read 할 것:

- `CLAUDE.md` — 디자인 토큰 단일 출처, 매직 넘버 금지
- `docs/plans/admob-banner-ads.md` §F, §G 의 "홈은 Tabs 안이라 배너가 BottomTabBar 바로 위" 설명, 인벤토리 9.45 행
- `docs/UI_GUIDE.md` §컴포넌트 사양
- `src/components/Screen.tsx` — 수정 대상 (전문 ~90행). `scroll` 분기 두 개 모두 `SafeAreaView` 가 루트
- `src/components/__tests__/Screen.test.tsx` — 기존 9개 테스트 형식
- `app/(tabs)/_layout.tsx` — 홈이 `BottomTabBar` 와 어떻게 합성되는지 (footer 가 탭바 **위**에 오는지 확인용)
- `docs/TESTING.md` §9 의 Screen 인벤토리 절 (`grep -n "Screen.tsx" docs/TESTING.md` 로 위치 확인)

## 작업

### 1. `src/components/Screen.tsx`

`ScreenProps` 에 추가:

```ts
/** ScrollView 밖, SafeArea 안에 고정 렌더되는 하단 요소 (광고 배너 등). 기본 없음 */
footer?: React.ReactNode;
```

- `scroll` 여부와 무관하게 `SafeAreaView` 의 **마지막 자식**으로 `{footer}` 를 렌더한다. `footer` 가 `undefined` 이면 DOM(요소 트리)에 아무것도 추가하지 않는다 (`{footer}` 자체는 무해하지만 래퍼 View 를 조건 없이 두지 말 것).
- footer 에는 **horizontal padding 을 적용하지 않는다** (배너는 폭 전체 사용). 기존 `padding` prop 은 ScrollView/inner View 에만 남는다.
- 기존 호출부는 변경 없음 (optional prop). 기존 스냅샷·테스트가 깨지면 안 된다.
- `exactOptionalPropertyTypes` 가 켜져 있으므로 `footer?: React.ReactNode` 에 `undefined` 를 명시적으로 넘기는 호출이 있으면 타입 에러가 난다 — 호출부는 step 5 에서 항상 요소를 넘기므로 문제 없지만, 타입은 `footer?: React.ReactNode | undefined` 로 두는 것을 허용한다.

### 2. 테스트 — `src/components/__tests__/Screen.test.tsx` 에 추가 (§9.45)

- `scroll=true` + `footer=<View testID="f" />` → `f` 가 렌더되고, ScrollView 의 **형제**(자식 아님)이며 SafeAreaView 자식 중 마지막. `jest.setup.js` 의 SafeAreaView mock 은 children passthrough 이므로 `UNSAFE_getByType(ScrollView)` 의 children 에 `f` 가 없는 것 + 루트 컨테이너 children 순서로 검증.
- `scroll=false` + footer → 동일하게 inner View 의 형제.
- `footer` 미지정 → 렌더 트리가 기존과 동일 (기존 스냅샷/구조 테스트 무변경).
- footer 가 `px-screen-x` 류 padding 클래스를 갖지 않음 (footer 요소의 부모 className 에 `px-` 없음).

### 3. 문서

- `docs/TESTING.md` 의 Screen 인벤토리 절에 위 케이스 추가 (**누락 = step 미완**).
- `docs/UI_GUIDE.md` §컴포넌트 사양 에 `Screen.footer` 한 줄: "ScrollView 밖·SafeArea 안 하단 고정 슬롯, 폭 전체, 광고 배너용 (ADR-077)".

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm test -- src/components
grep -c 'footer' src/components/Screen.tsx        # ≥ 3 (타입·구조분해·렌더)
grep -c 'footer' docs/TESTING.md                  # ≥ 1
```

## 검증 절차

1. 위 AC 를 실행한다. `src/components/**` 커버리지 85/75/85/85 유지.
2. 아키텍처 체크리스트:
   - 기존 호출부 무변경, 기존 테스트·스냅샷 무변경인가?
   - 매직 px 를 쓰지 않았는가?
   - 광고 관련 import 가 없는가? (이 컴포넌트는 광고를 모른다)
3. 결과에 따라 `phases/admob-banner-ads/index.json` 의 step 3 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- `Screen` 에서 `useAdsStore` 나 `AdBanner` 를 참조하지 마라. 이유: Screen 은 범용 chrome 이다. 광고 결합은 호출부(step 5)의 책임.
- footer 를 ScrollView **안**에 넣지 마라. 이유: 배너는 스크롤과 무관하게 하단 고정이어야 한다.
- footer 에 기본 높이·배경을 주지 마라. 이유: 로드 전 0 높이는 `AdBanner`(step 4) 가 스스로 관리한다.
- 화면 파일(`app/**`)을 수정하지 마라. 이유: step 5 의 범위.
- 기존 테스트를 깨뜨리지 마라.
