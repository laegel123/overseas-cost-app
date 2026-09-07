# Step 3: sources-index

## 배경

이 phase(`in-app-policy-pages`)는 데이터 출처·개인정보 처리방침을 외부 브라우저 링크에서 **앱 내부 화면**으로 옮긴다.

현재 설정 화면의 "데이터 출처 보기" 메뉴는 `Linking.openURL` 로 GitHub 의 `docs/DATA_SOURCES.md` (848줄 개발자용 마크다운) 를 연다. 이 step 은 그것을 대체할 **앱 내 도시 목록 화면**을 만든다. 설정 화면의 배선 교체는 step 7 에서 하므로, **이 step 이 끝난 시점에는 화면이 존재하지만 앱에서 도달할 경로가 아직 없다** (테스트로만 검증된다).

### 화면 구조 (드릴다운 1단계)

```
/sources                              /sources/[cityId]   ← step 4
┌──────────────────────────────┐
│ ←  데이터 출처               │      탭하면 push
│    출처 46개                 │      ─────────▶
│                              │
│  서울                  4  ›  │
│  뉴욕                  5  ›  │
│  로스앤젤레스          5  ›  │
│  …                           │
└──────────────────────────────┘
```

- 서울을 맨 위에 고정하고, 나머지는 권역 순서 `na → eu → asia → oceania → me`, 권역 내에서는 한국어 이름 가나다순.
- **권역 그룹 헤더는 두지 않는다.** 평평한 목록이며 정렬 순서만 권역을 따른다.
- 각 행: 도시 한국어 이름 + 그 도시의 출처 수 + chevron.
- 헤더 부제에 전체 unique 출처 수를 표시한다 (실측 46개. 번들 시드만 있는 첫 실행 시에는 10개 — 의도된 동작, ADR-071 결정 2).

### 이미 만들어져 있는 것 (선행 step 산출물)

`src/lib/sources.ts` (step 2):

```ts
export type CitySourceGroup = { cityId: string; cityNameKo: string; count: number };
export function getCitySourceGroups(): CitySourceGroup[];   // 이미 표시 순서로 정렬되어 반환됨
export function countUniqueSources(): number;
```

**정렬은 lib 이 이미 끝냈다. 화면에서 다시 정렬하지 마라.**

`src/lib/categoryMeta.ts` (step 1): `CATEGORY_LABEL`, `CATEGORY_ICON`, `CATEGORY_ORDER` — 이 화면에서는 쓰지 않는다 (step 4 용).

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래 목록을 반드시 직접 Read 할 것:

- `docs/ARCHITECTURE.md` — §라우팅, §라우팅 디테일, §화면별 백 동작, §에러 핸들링 전략
- `docs/ADR.md` (인덱스) — `docs/adr/071-in-app-policy-pages.md` (이 phase 의 결정, step 0 작성). 특히 **결정 3: 화면은 full-screen modal 이 아니라 일반 Stack push** 라는 점.
- `docs/UI_GUIDE.md` — §디자인 원칙, §AI 슬롭 안티패턴, §Sheet C(출처 보기 — 원안 명세. **이 phase 는 modal 대신 push 로 구현하며 그 편차는 step 8 이 편차표에 기록한다**), §MenuRow, §화면별 상태(로딩/에러)
- `docs/design/README.md` — §5 Settings 의 메뉴 행 시각 사양 (행 높이·아이콘 박스·chevron)
- `docs/TESTING.md` — §5 모킹 전략(특히 §5.4 도시 데이터, §5.6 react-native), §8.2 `mockRouter`, §9 인벤토리 형식
- `src/lib/sources.ts` — **step 2 산출물**. `getCitySourceGroups`, `countUniqueSources`
- `src/components/Screen.tsx` — `ScreenProps` (`scroll`, `padding`, `edges`)
- `src/components/TopBar.tsx` — `TopBarProps` (`title`, `titleVariant`, `subtitle`, `onBack`)
- `src/components/MenuRow.tsx` — 행 컴포넌트 사양 (아이콘 박스 + 라벨 + rightText + chevron). **아이콘이 필수 prop 이라 도시 행에는 그대로 쓰기 어렵다** — 시각 규격 참고용.
- `src/components/typography/Text.tsx` — `H1/H2/H3/Body/Small/Tiny/MonoLabel` 과 `TextColor`
- `src/components/Icon.tsx` — `ICON_NAMES` (`chev-right` 등)
- `app/(tabs)/settings.tsx` — 이 앱의 화면 골격·카드/메뉴 리스트 마크업 관례 (가장 가까운 참고 화면)
- `app/compare/[cityId].tsx` — 데이터 로딩·에러·`TopBar onBack`·`router` 사용 패턴
- `app/(tabs)/__tests__/settings.test.tsx` — 화면 테스트 작성 관례
- `tailwind.config.js`, `src/theme/tokens.ts` — 사용 가능한 디자인 토큰 (색·radius·spacing)

## 작업

### 1. `app/sources/index.tsx` 신규

Expo Router 파일 기반 라우팅이므로 이 파일이 곧 `/sources` 라우트다. `app/(tabs)/` 밖이므로 하단 탭 바 없이 Stack push 로 뜬다 (compare·detail 과 동일).

화면 요구:

- `Screen` + `TopBar` 조합. 루트 `testID="sources-screen"`.
- `TopBar`: `title="데이터 출처"`, `subtitle={`출처 ${uniqueCount}개`}`, `onBack` → `router.back()`. `testID="sources-topbar"`.
- 도시 목록: `getCitySourceGroups()` 결과를 **받은 순서 그대로** 렌더.
  - 각 행 `testID={`source-city-${cityId}`}`, 탭 → `router.push(`/sources/${cityId}`)`.
  - 행 내용: 도시 한국어 이름(좌) / `${count}개`(우, `Tiny` 또는 `Small` gray-2) / `chev-right` 아이콘.
  - 접근성: `accessibilityRole="button"`, `accessibilityLabel` 은 행 의미가 드러나게 (예: `서울 출처 4개 보기`).
  - 마지막 행은 bottom border 없음 (`MenuRow` 의 `isLast` 관례와 동일).
- 목록이 비어 있을 때(데이터 미로드 등): "출처 정보를 불러오지 못했어요" 류의 빈 상태를 표시한다. `testID="sources-empty"`. **빈 화면을 그대로 두지 마라.**

행 컴포넌트는 이 화면 파일 안의 지역 컴포넌트로 둔다 (`settings.tsx` 의 `StatCard` 와 같은 방식). `src/components/` 에 새 공용 컴포넌트를 만들지 마라 — 재사용처가 이 화면 하나뿐이다.

**시각 규칙 (CLAUDE.md CRITICAL):** 모든 색·radius·spacing 은 `tailwind.config.js` / `src/theme/tokens.ts` 토큰만 사용한다. 매직 hex·px 금지.

**문구는 한국어 1차.** 도시 영문명은 이 화면에 표시하지 않는다 (한국어 이름 + 출처 수만).

### 2. 테스트 — `app/sources/__tests__/index.test.tsx` 신규

`docs/TESTING.md` §5.4 도시 데이터 모킹 + §8.2 `mockRouter` 관례를 따를 것.

최소 케이스:

- 도시 목록이 lib 이 준 순서 그대로 렌더된다 (서울이 첫 행)
- 각 행에 출처 수가 `N개` 형식으로 표시된다
- 행 탭 → `router.push('/sources/<cityId>')` 가 정확한 경로로 호출된다
- back 탭 → `router.back()` 호출
- 헤더 부제에 unique 출처 수가 표시된다
- 도시 0개(빈 목록) → 빈 상태 표시, 크래시 없음
- 접근성: 각 행이 `button` role 을 갖는다

`docs/TESTING.md` §9 인벤토리에 `app/sources/index.tsx` 절을 신규 추가한다. **인벤토리 누락 = step 미완** (CLAUDE.md).

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `app/` 아래 Expo Router 파일 규약을 따랐는가? (ARCHITECTURE.md §라우팅)
   - 화면이 `fetch` 를 직접 호출하지 않고 `src/lib` 을 경유하는가? (CLAUDE.md CRITICAL)
   - 정렬·집계를 화면에서 다시 하지 않았는가? (lib 책임)
   - 매직 색상값·px 없이 토큰만 썼는가? (CLAUDE.md CRITICAL)
   - `any` 없이 strict 를 통과하는가?
   - 빈 상태를 처리했는가? (silent 빈 화면 금지)
   - `docs/TESTING.md` 인벤토리에 새 화면을 기재했는가?
3. 결과에 따라 `phases/in-app-policy-pages/index.json` 의 step 3 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `app/sources/[cityId].tsx` 를 만들지 마라. 이유: step 4 의 범위다. 이 step 에서는 `router.push` 대상 경로만 정하면 된다 (테스트에서는 push 인자만 검증).
- `app/(tabs)/settings.tsx` 를 수정하지 마라. 이유: step 7 의 범위다. 이 step 이 끝난 시점에 화면이 앱에서 도달 불가한 것은 **의도된 상태**다.
- `presentation: 'modal'` 을 설정하거나 `app/_layout.tsx` 의 `Stack` 옵션을 바꾸지 마라. 이유: ADR-071 결정 3 에서 일반 push 로 정했다. `docs/UI_GUIDE.md` §Sheet C 의 modal 명세와 다른 것은 의도된 편차이며 step 8 이 문서에 기록한다.
- 권역 그룹 헤더(북미·유럽 …)를 넣지 마라. 이유: 헤더 없는 평평한 목록으로 결정됐다. 권역은 정렬 순서로만 반영된다.
- `app/(tabs)/index.tsx` 의 `REGIONS` 를 import 하거나 복사하지 마라. 이유: 이 화면에 권역 라벨 문자열이 필요 없다.
- `src/components/` 에 새 공용 컴포넌트를 추가하지 마라. 이유: 사용처가 이 화면 하나뿐이라 추상화 계층이 불필요하다 (CLAUDE.md §2 단순성 우선).
- 도시 목록에 검색·필터·정렬 UI 를 추가하지 마라. 이유: 요청되지 않은 기능이다 (CLAUDE.md §2).
- 기존 테스트를 깨뜨리지 마라.
