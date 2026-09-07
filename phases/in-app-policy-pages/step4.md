# Step 4: sources-city

## 배경

이 phase(`in-app-policy-pages`)는 데이터 출처·개인정보 처리방침을 외부 브라우저 링크에서 **앱 내부 화면**으로 옮긴다.

step 3 이 만든 `/sources` (도시 목록) 에서 도시를 탭하면 이 step 이 만드는 **도시별 출처 화면**으로 push 된다. 설정 화면 배선은 step 7 이므로, 이 step 이 끝난 시점에도 앱에서 도달할 경로는 아직 없다 (테스트로만 검증).

### 화면 구조 (드릴다운 2단계)

```
/sources/vancouver
┌────────────────────────────────────┐
│ ←  밴쿠버                          │
│    출처 5개                        │
│                                    │
│  🏠 월세                           │
│  ┌──────────────────────────────┐  │
│  │ CMHC Rental Market Survey…   │  │
│  │ 접속일 2026-05-03            │  │
│  │ 페이지 열기 →                │  │
│  └──────────────────────────────┘  │
│                                    │
│  🍴 식비                           │
│  ┌──────────────────────────────┐  │
│  │ Statistics Canada CPI…       │  │
│  │ …                            │  │
│  └──────────────────────────────┘  │
│  …                                 │
└────────────────────────────────────┘
```

- 카테고리별로 그룹핑하고 `CATEGORY_ORDER` (rent → food → transport → tuition → tax → visa) 순서로 배치.
- 각 출처: 이름 / `접속일 YYYY-MM-DD` / "페이지 열기 →" (`Linking.openURL`, 외부 브라우저).
- 하단에 자동 갱신 정책 안내 문구 1~2줄 (`docs/UI_GUIDE.md` §Sheet C 원안의 "📊 자동화 정책 안내" 에 해당).

### 데이터 사실 (조사 완료)

- **`tax` 카테고리 출처는 21개 도시 모두 0개**다 (v1.0 에 tax 데이터 자체가 없음). step 2 의 `getCitySourcesByCategory` 가 **빈 그룹을 아예 반환하지 않으므로** 화면은 자연스럽게 tax 를 렌더하지 않는다. 별도 분기 불필요.
- **서울은 출처 4개**(rent 1 / food **2** / transport 1) 로, tuition·visa 그룹이 없고 food 그룹에 출처가 2개다. 한 카테고리에 여러 출처가 오는 경우를 반드시 처리해야 한다.
- 해외 20개 도시는 각 5개(rent/food/transport/tuition/visa 각 1).
- 출처 이름은 언어가 섞여 있다: `국토교통부 실거래가 공개시스템`(한국어), `Statistics Canada CPI …`(영어), `東京メトロ …`(일본어). **기관 고유명은 원어 유지가 정책이다** (ADR-070). 화면에서 번역하거나 가공하지 마라.
- step 0 이후 모든 `url` 은 실제 공공 출처를 가리킨다 (GitHub 문서를 가리키던 tuition/visa 40개가 교체됨).
- 출처 이름이 길다 (예: `東京大学 · 早稲田大学 · 慶應義塾大学 공식 국제학생 학비 페이지 (정적 추정치)`). **줄바꿈으로 전부 보이게 하라 — 말줄임(`numberOfLines`)으로 잘라내지 마라.** 출처 투명성이 이 화면의 존재 이유다 (`docs/UI_GUIDE.md` §디자인 원칙 5: "출처를 숨기지 않는다").

### 이미 만들어져 있는 것 (선행 step 산출물)

`src/lib/sources.ts` (step 2):

```ts
export type CategorySourceGroup = { category: SourceCategory; sources: CitySource[] };
/** 출처 0개 카테고리 그룹은 반환하지 않음. 존재하지 않는 cityId 는 throw. */
export function getCitySourcesByCategory(cityId: string): CategorySourceGroup[];
```

`src/lib/categoryMeta.ts` (step 1): `CATEGORY_LABEL`(`rent`→`월세` …), `CATEGORY_ICON`(`rent`→`house` …), `CATEGORY_ORDER`.

`src/lib/linking.ts`: `openURL(url)` — `react-native` 의 `Linking` 을 감싼 얇은 wrapper. 테스트에서 `jest.mock('@/lib/linking')` 로 mock 한다 (`docs/TESTING.md` §5 의 Linking mock 회피책). **`react-native` 의 `Linking` 을 직접 import 하지 마라.**

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래 목록을 반드시 직접 Read 할 것:

- `docs/ARCHITECTURE.md` — §라우팅, §화면별 백 동작, §에러 핸들링 전략·에러 처리 룰
- `docs/ADR.md` (인덱스) — `docs/adr/071-in-app-policy-pages.md` (이 phase 의 결정), `docs/adr/070-source-name-language.md` (출처명 언어 정책 — 화면에서 번역 금지의 근거)
- `docs/UI_GUIDE.md` — §Sheet C(출처 보기 원안: 카테고리 그룹핑 + "페이지 열기 →" + 자동화 정책 안내), §디자인 원칙, §AI 슬롭 안티패턴, §화면별 상태
- `docs/design/README.md` — §4 Detail 의 카드 그룹화 규칙(섹션 라벨은 카드 외부 mono-label, 항목은 카드 안), §출처 영역 시각 사양
- `docs/DATA.md` — §3.3 출처 표기 정책
- `docs/AUTOMATION.md` — 갱신 주기 (환율 매일 / 가격 매주 / 임차료 매월 / 교통·학비·비자 분기). 하단 안내 문구의 사실 근거로 삼을 것.
- `docs/TESTING.md` — §5 모킹(특히 Linking mock), §8.2 `mockRouter`, §9 인벤토리 형식
- `src/lib/sources.ts` — **step 2 산출물**
- `src/lib/categoryMeta.ts` — **step 1 산출물**
- `src/lib/linking.ts` — `openURL`
- `app/detail/[cityId]/[category].tsx` — **가장 가까운 참고 화면**. `useLocalSearchParams` 로 `cityId` 받기, 도시 미발견 시 `ErrorView`, 출처 영역 마크업(600~640줄 부근, `testID="detail-sources"`), 카테고리 섹션 라벨 패턴
- `app/(tabs)/settings.tsx` — `safeOpenURL` 패턴 (openURL 실패 시 `Alert`)
- `src/components/ErrorView.tsx` — `ErrorViewProps`
- `src/components/Icon.tsx`, `src/components/typography/Text.tsx`, `src/components/Screen.tsx`, `src/components/TopBar.tsx`
- `app/detail/__tests__/[category].test.tsx` — 동적 라우트 화면 테스트 관례
- `tailwind.config.js`, `src/theme/tokens.ts` — 디자인 토큰

## 작업

### 1. `app/sources/[cityId].tsx` 신규

화면 요구:

- `useLocalSearchParams` 로 `cityId` 를 읽는다 (`app/detail/[cityId]/[category].tsx` 와 동일 방식).
- 루트 `testID="source-city-screen"`.
- `TopBar`: `title={city.name.ko}`, `subtitle={`출처 ${n}개`}` (n = 그 도시 출처 총 개수), `onBack` → `router.back()`. `testID="source-city-topbar"`.
- 카테고리 그룹 반복:
  - 섹션 라벨: `CATEGORY_ICON[category]` 아이콘 + `CATEGORY_LABEL[category]`. `testID={`source-group-${category}`}`.
  - 그 아래 출처 카드들. 각 카드 `testID={`source-item-${category}-${idx}`}`:
    - 이름 (navy, 줄바꿈 허용 — 자르지 마라)
    - `접속일 {accessedAt}` (gray-2, tiny)
    - "페이지 열기 →" 버튼 — `accessibilityRole="button"`, `accessibilityLabel` 에 출처 이름을 포함해 무엇을 여는지 알 수 있게 할 것. `testID={`source-open-${category}-${idx}`}`.
- 하단 안내: 자동 갱신 정책 1~2줄. `testID="source-city-footer"`. 문구는 `docs/AUTOMATION.md` 의 실제 주기와 **모순되지 않아야** 한다. 있지도 않은 주기를 지어내지 마라.
- **도시를 찾을 수 없을 때**: `getCitySourcesByCategory` 가 throw 하므로 이를 잡아 `ErrorView` 를 렌더한다 (`app/detail/[cityId]/[category].tsx` 의 처리 방식을 따를 것). `testID="source-city-error"`. 크래시로 흘려보내지 마라.

### 2. 외부 링크 처리

- `@/lib/linking` 의 `openURL` 을 쓴다.
- 실패 시 `Alert.alert` 로 사용자에게 알린다 — `app/(tabs)/settings.tsx` 의 `safeOpenURL` 패턴과 동일하게. **silent fail 금지** (CLAUDE.md CRITICAL).

이 화면의 "페이지 열기 →" 는 외부 브라우저로 나가는 것이 **정상**이다. ADR-071 이 없앤 것은 "앱의 정책 페이지를 외부 웹 문서로 대체하는 것" 이지, 개별 출처 기관 페이지로의 이동이 아니다.

### 3. 테스트 — `app/sources/__tests__/[cityId].test.tsx` 신규

`jest.mock('@/lib/linking')` 로 `openURL` 을 mock 할 것.

최소 케이스:

- 카테고리 그룹이 `CATEGORY_ORDER` 순서로 렌더된다
- 각 그룹에 라벨과 아이콘이 표시된다
- 한 카테고리에 출처가 2개인 경우(서울 food) 둘 다 렌더된다
- 출처 이름·접속일이 표시된다
- 출처 이름이 말줄임 처리되지 않는다 (`numberOfLines` 미적용 단언)
- "페이지 열기 →" 탭 → `openURL(정확한 url)` 호출
- `openURL` 이 reject → `Alert.alert` 호출 (silent fail 아님)
- `tax` 그룹은 렌더되지 않는다 (출처 0개)
- 존재하지 않는 cityId → `ErrorView` 렌더, 크래시 없음
- back 탭 → `router.back()`
- 헤더 부제에 출처 수 표시

`docs/TESTING.md` §9 인벤토리에 `app/sources/[cityId].tsx` 절을 신규 추가한다. **인벤토리 누락 = step 미완** (CLAUDE.md).

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 화면이 `fetch` 를 직접 호출하지 않고 `src/lib` 을 경유하는가? (CLAUDE.md CRITICAL)
   - `react-native` 의 `Linking` 을 직접 쓰지 않고 `@/lib/linking` 을 경유하는가?
   - 링크 열기 실패를 사용자에게 노출하는가? (silent fail 금지 — CLAUDE.md CRITICAL)
   - 출처 이름을 원문 그대로 표시하는가? (ADR-070 — 번역·축약 금지)
   - 매직 색상값·px 없이 토큰만 썼는가? (CLAUDE.md CRITICAL)
   - 도시 미발견을 `ErrorView` 로 처리하는가?
   - `docs/TESTING.md` 인벤토리에 새 화면을 기재했는가?
3. 결과에 따라 `phases/in-app-policy-pages/index.json` 의 step 4 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 출처 이름을 번역·축약·말줄임 처리하지 마라. 이유: 기관 고유명 원어 유지가 ADR-070 정책이고, 출처 투명성이 이 화면의 목적이다 (UI_GUIDE §디자인 원칙 5).
- `react-native` 의 `Linking` 을 직접 import 하지 마라. 이유: 테스트에서 mock 이 어렵다 (`docs/TESTING.md` §5 — `@/lib/linking` wrapper 가 존재하는 이유).
- `tax` 를 위한 "출처 없음" 빈 그룹을 렌더하지 마라. 이유: lib 이 빈 그룹을 반환하지 않으며, v1.0 에 tax 데이터 자체가 없어 사용자에게 의미 없는 정보다.
- `app/(tabs)/settings.tsx` 를 수정하지 마라. 이유: step 7 의 범위다.
- `presentation: 'modal'` 을 설정하지 마라. 이유: ADR-071 결정 3 (일반 push).
- 출처에 대한 설명·평가·신뢰도 배지 같은 것을 지어내지 마라. 이유: 데이터에 없는 정보다 (CLAUDE.md §2 추측 기반 코드 배제).
- 자동 갱신 주기를 추측해서 쓰지 마라. `docs/AUTOMATION.md` 에 적힌 실제 주기만 인용하라.
- 기존 테스트를 깨뜨리지 마라.
