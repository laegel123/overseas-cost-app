# Step 1: compare-tab

## 배경

하단 탭 "비교"는 지금 자체 화면이 없다. `app/(tabs)/compare.tsx` 는 빈 placeholder 이고, `app/(tabs)/_layout.tsx` 의 `tabPress` listener 가 `recent[0] ?? favorites[0]` 의 `/compare/<id>` 로 redirect 한다 (ADR-041). 홈의 최근 목록과 즐겨찾기 탭(ADR-084)이 같은 곳으로 가므로 중복이다.

이 step 은 비교 탭을 **두 도시를 고르는 선택 화면**으로 바꾼다. step 0 에서 만든 `useComparePairStore` 를 쓴다. 비교 화면이 서울이 아닌 기준 도시를 실제로 처리하는 것은 step 2 다 — 이 step 종료 시점에는 "비교하기"가 올바른 주소로 `push` 하는 것까지만 책임진다.

전체 설계: `docs/plans/city-vs-city-compare.md` (반드시 읽을 것 — "화면별 동작 1·2" 절이 이 step 의 기준).

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL: 디자인 토큰 단일 출처(매직 넘버 색 금지), 광고 위치 규칙(ADR-077), `fetch` 직접 호출 금지, 한국어 문구, 테스트 동시 작성, ADR 추가 규칙
- `docs/plans/city-vs-city-compare.md`
- `docs/adr/041-*.md` (비교 탭 라우팅 단축 — 이 step 이 supersede), `docs/adr/084-favorites-tab-list-screen.md` (즐겨찾기 탭을 일반 탭 화면으로 바꾼 선례 — ADR·테스트·문서 변경 형식의 모범)
- `docs/ADR.md` — 인덱스 형식. `docs/adr/` 의 마지막 번호를 확인해 **다음 번호**를 쓴다 (설계 문서 작성 시점엔 089 였다)
- `app/(tabs)/_layout.tsx`, `app/(tabs)/__tests__/_layout.test.tsx`
- `app/(tabs)/compare.tsx` (placeholder)
- `app/(tabs)/favorites.tsx`, `app/(tabs)/__tests__/favorites.test.tsx` — 탭 화면의 loading/error/ready 구조와 테스트 패턴
- `app/(tabs)/index.tsx` — 도시 목록 로드(`loadAllCities` → `getAllCities`)와 가나다순 정렬 방식
- `src/components/Screen.tsx` (`TAB_SCREEN_EDGES`), `src/components/BottomSheet.tsx`, `src/components/ErrorView.tsx`, `src/components/typography/Text.tsx`
- `src/store/comparePair.ts` (step 0 산출물)
- `docs/UI_GUIDE.md` — 토큰·터치 영역·접근성 규칙
- `docs/TESTING.md` — 화면 인벤토리 절 (favorites 탭 항목과 같은 형식)

## 작업

### 1. `app/(tabs)/compare.tsx` — 선택 화면

```
 도시끼리 비교
 ┌───────────┐      ┌───────────┐
 │  밴쿠버   │  vs  │  토론토   │
 │  바꾸기   │      │  바꾸기   │
 └───────────┘      └───────────┘
        [ 비교하기 ]
```

동작 규칙 (벗어나면 안 됨):

- 상태 3가지: loading / error(`ErrorView`) / ready. 도시 목록은 `loadAllCities()` 후 `getAllCities()`. 환율은 불러오지 않는다 (이 화면은 금액을 보여주지 않는다).
- 칸 두 개(왼쪽 = 기준, 오른쪽 = 대상). 값은 `useComparePairStore` 의 `baseId` / `cityId`. 처음엔 둘 다 비어 있고 "도시 선택" 같은 안내가 보인다.
- 저장된 id 가 현재 도시 목록에 없으면 그 칸은 **빈 칸으로 표시**한다 (store 값을 지우지는 않아도 된다).
- 칸을 누르면 도시 목록이 뜬다: 21개 도시 전부(**서울 포함**), 한글 이름 가나다순(`localeCompare(…, 'ko')`). 반대편 칸에 이미 들어간 도시는 비활성으로 표시하고 고를 수 없다. 도시를 고르면 즉시 store 에 저장하고 목록을 닫는다.
- "비교하기"는 두 칸이 모두 유효하게 채워졌을 때만 활성. 비활성 상태는 `accessibilityState.disabled` 로도 노출한다.
- "비교하기" 이동 규칙:
  - 두 도시 모두 서울이 아님 → `router.push('/compare/<오른쪽>?base=<왼쪽>')`
  - **어느 칸이든 서울이 들어 있음 → `router.push('/compare/<서울이 아닌 도시>')`** (`?base` 없음). 서울을 오른쪽 칸에 넣었어도 마찬가지다. 이유: 서울은 학비·세금·비자가 정책상 0원이라 오른쪽에 두면 `0 ÷ 값` 배수가 되어 `formatMultiplier`·`isHot` 이 throw 한다 (`src/lib/format.ts`). 공용 lib 을 고치지 않고 이 조합을 만들지 않는다. 칸에 보이는 순서는 사용자가 고른 그대로 둔다.
- **광고를 넣지 마라** (`AdBanner` / `Screen footer` 사용 금지). 이유: ADR-077 의 광고 위치는 홈·비교(`app/compare/[cityId].tsx`)·상세 ready 화면뿐이다. 선택 화면은 대상이 아니다.
- 색·간격·라운드는 기존 토큰 클래스만 사용. 터치 영역·접근성 라벨은 기존 화면 관례를 따른다.

testID (step 4 의 Maestro flow 가 의존 — 이름을 바꾸지 마라):

- 화면: `compare-tab-screen` (loading: `compare-tab-screen-loading`, error: `compare-tab-screen-error`)
- 칸: `compare-tab-slot-base`, `compare-tab-slot-city`
- 목록의 도시 행: `compare-tab-option-<cityId>`
- 버튼: `compare-tab-submit`

도시 목록을 띄우는 방식(기존 `BottomSheet` 재사용 등)과 세부 배치·문구는 재량이다. 목록 UI 가 별도 컴포넌트로 분리될 만큼 커지면 `src/components/` 에 1파일 1컴포넌트로 두고 테스트를 함께 작성한다.

### 2. `app/(tabs)/_layout.tsx` — redirect 제거

- `handleCompareTabPress`, compare `Tabs.Screen` 의 `listeners`, 그리고 그 때문에만 쓰이던 `useRecentStore` / `useFavoritesStore` / `Alert` / `useRouter` / `TabPressEvent` 를 제거한다.
- `renderTabBar` 의 `navigation.emit('tabPress')` 어댑터는 그대로 둔다.
- 파일 헤더 주석의 ADR-041 서술을 새 ADR 번호로 바꾼다.

### 3. 테스트

- `app/(tabs)/__tests__/compare.test.tsx` (신규): loading / error / ready / 빈 칸 초기 상태 / 칸 선택 → store 반영 / 반대편 도시 비활성 / 저장 id 가 목록에 없으면 빈 칸 / "비교하기" 비활성·활성 / 이동 주소 3종 (도시끼리 → `?base=`, 왼쪽 서울 → base 없음, **오른쪽 서울 → `/compare/<왼쪽 도시>`**) / 광고 미렌더.
- `app/(tabs)/__tests__/_layout.test.tsx`: 비교 탭 redirect·Alert 케이스를 "비교 탭 선택 → 기본 navigate(일반 탭)" 케이스로 교체. 나머지 케이스는 유지.

### 4. ADR + 문서

- `docs/adr/<다음 번호>-compare-tab-city-pair.md` 신규 + `docs/ADR.md` 인덱스 행. 내용: 맥락(비교 탭 중복, 서울 기준 비교만 가능), 결정(비교 탭 = 두 도시 선택 화면, 기준 도시는 `?base=` query param·생략 시 서울, 서울은 항상 왼쪽, 선택 화면 광고 없음, 포함 토글 키 `"<base>|<cityId>"`), 대안(경로 세그먼트 변경 / 전용 화면 신설 / 순위 탭 / 탭 3개 축소 — 설계 문서 "접근 방식" 표 참조), 결과(PRD 의 비교 탭 서술과 달라짐 — PRD 는 수정 금지라 여기 기록, 세금 데이터는 전 도시 미구현이라 현행 유지). ADR-041 파일 상단 상태 줄에 superseded 표기.
- `docs/ARCHITECTURE.md` 의 탭·라우팅 서술, `docs/UI_GUIDE.md` 의 탭 바/화면 목록 서술에서 비교 탭 설명을 갱신.
- `docs/TESTING.md` 화면 인벤토리에 비교 탭 화면 항목 추가, `_layout` 항목의 비교 탭 케이스 갱신 (**인벤토리 누락 = step 미완**).

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npx jest "app/\(tabs\)"
npm test
grep -n "handleCompareTabPress\|Alert" "app/(tabs)/_layout.tsx"        # 결과 없음
grep -n "AdBanner" "app/(tabs)/compare.tsx"                            # 결과 없음
grep -n "compare-tab-submit\|compare-tab-slot-base\|compare-tab-slot-city" "app/(tabs)/compare.tsx"   # 3종 모두 존재
ls docs/adr | tail -1 && grep -n "city-pair" docs/ADR.md
git diff --stat -- "app/compare/" "app/detail/" src/lib/ data/         # 비어 있음
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트: 토큰 외 색상값 없음, 광고 없음, `fetch` 직접 호출 없음, 한국어 문구, ADR + 인덱스, TESTING 인벤토리.
3. `phases/city-pair-compare/index.json` 의 step 1 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "ADR 번호, 도시 목록 UI 방식(시트/기타)과 신규 컴포넌트 경로, testID 목록, 이동 주소 규칙"`
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message": "…"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "…"` 후 즉시 중단

## 금지사항

- `app/compare/[cityId].tsx`, `app/detail/` 를 수정하지 마라. 이유: step 2·3 범위. (이 step 종료 시점에 `?base=` 주소는 아직 서울 기준으로 렌더된다 — 정상이다.)
- `src/lib/format.ts` 를 수정하지 마라. 이유: 서울 모드 회귀 위험. 서울-오른쪽 조합은 이동 규칙으로 피한다.
- `.maestro/` 를 수정하지 마라. 이유: step 4 범위. (비교 탭 redirect 를 검증하던 기존 flow 2개는 step 4 에서 고친다.)
- 좌우 바꾸기 버튼, 최근 비교 쌍 목록, 검색창을 추가하지 마라. 이유: 설계 문서의 비목표다 (도시는 21개뿐이다).
- 탭 라벨·아이콘·`BottomTabBar` 를 바꾸지 마라.
- `docs/PRD.md` 를 수정하지 마라.
- 기존 테스트를 깨뜨리지 마라 (`_layout.test.tsx` 의 비교 탭 redirect 케이스 교체만 예외).
