# Step 2: home

Home 화면 — 재방문 사용자가 빠르게 즐겨찾기 도시로 진입하거나 새 도시를 검색.

`app/(tabs)/index.tsx` placeholder 를 실제 구현으로 교체.

## 읽어야 할 파일

- `CLAUDE.md`
- `docs/PRD.md` — Home 화면 요구사항
- `docs/design/README.md` §2 (Home)
- `docs/UI_GUIDE.md` §Home
- `docs/ARCHITECTURE.md`
- `docs/TESTING.md` §10
- `docs/ADR.md` ADR-041 (탭 동작), ADR-038 (도시 picker)
- 데이터·스토어:
  - `src/lib/data.ts` — `getAllCities`
  - `src/store/persona.ts` / `favorites.ts` / `recent.ts`
  - `src/lib/format.ts` — `formatMultiplier`, `isHot`
- 컴포넌트:
  - `Screen`, `Icon`, `FavCard`, `RecentRow`, `RegionPill`, `BottomTabBar`
  - typography (`H1`, `H3`, `Body`, `Small`, `Tiny`)
- step 0 산출물 — `(tabs)/_layout.tsx` 의 4 탭 구성

## 작업

### 1. `app/(tabs)/index.tsx`

- 데이터:
  - `getAllCities()` → 권역별 그룹 + 즐겨찾기·최근 cityId 매핑
  - `useFavoritesStore.cityIds` → FavCard 가로 스크롤 데이터
  - `useRecentStore.cityIds` → RecentRow 세로 리스트 데이터
  - 각 도시의 mult 계산: `compare.ts` 의 헬퍼 (도시 vs 서울 단일 배수)
- Layout (Screen scroll=true):
  - **Greeting**: `안녕하세요 👋` (Tiny) + `어디 가시나요?` (H1). 우측 상단 user 아바타 (placeholder — settings 으로 navigate)
  - **Search bar** (v1.0 stub): View 만 렌더 + onPress 시 검색 화면이 없으니 단순 무동작. UI_GUIDE 의 stub 정책 따름. icon (search / filter) 시각만 일치
  - **Favorite cards (horizontal scroll)**:
    - `cityIds.length === 0` → 빈 상태 (`아직 즐겨찾기가 없어요. 도시를 탭해 ⭐ 추가해보세요` Body gray-2 center)
    - 첫 카드 `accent: true` (navy bg), 나머지 white. 탭 → `router.push(\`/compare/\${cityId}\`)`
  - **Recent cities list**:
    - `cityIds.length === 0` → 빈 상태 (`최근 본 도시가 없어요`)
    - `RecentRow` × N (max 5, FIFO). 마지막 행 `isLast=true`. 탭 → `/compare/${cityId}`
  - **Region pills** (v1.0): RegionPill 5개 (`전체`, `북미`, `유럽`, `아시아`, `오세아니아`). active 토글 후 RecentRow / FavCard 가 그 권역으로 필터링 — 또는 v1.0 stub (시각만, 실제 필터링 미구현). **결정: 시각만 + active state 만 토글**. 실제 검색 화면이 없어서 필터 결과 화면도 없음. 후속 phase 결정.
- 페르소나는 본 화면에선 직접 사용 X (settings 의 변경 진입점만 노출)

### 2. 빈 상태 정책

- 즐겨찾기 / 최근 본 도시 0건 시 안내 텍스트만. 첫 진입 사용자 (onboarded=true 직후) 가정한 디폴트 상태로 viable 한 화면이 되도록.
- `cityNameEn` / `countryCode` 누락 시 `getCity` 가 throw — 단 `getAllCities` 결과에서 1차 필터링 후 화면에 전달하므로 일반 경로에선 발생 X.

### 3. `app/(tabs)/_layout.tsx` — step 0 에서 이미 4 탭 + redirect 처리. 본 step 에서 추가 변경 없음.

### 4. 테스트 (`app/(tabs)/__tests__/index.test.tsx`)

- 즐겨찾기 0건 / N건 분기
- 최근 0건 / N건 분기
- FavCard 첫 카드 accent
- RecentRow 마지막 isLast
- 탭 → `/compare/{id}` push 검증 (router mock)
- snapshot 1 케이스 (즐겨찾기 3건 + 최근 5건)

### 5. `docs/TESTING.md` §10 인벤토리 추가

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
```

## 검증 절차

1. AC 통과
2. 체크:
   - 컴포넌트 fetch 직접 호출 X
   - `isHot` 단일 함수
   - 매직 색상 X
   - 빈 상태 한국어 1차
3. `phases/screens/index.json` step 2 update

## 금지사항

- 도시 검색 화면 신규 구현 금지. 이유: v1.0 미구현 (PRD).
- RegionPill 클릭 시 실제 필터링 로직 추가 금지. 이유: 검색 화면 부재로 결과 화면이 없음. v1.0 시각만.
- 도시 picker 신규 추가 금지. 이유: ADR-038.
- 본 step 에서 step 0 의 `(tabs)/_layout.tsx` 변경 금지 (이미 처리됨).
