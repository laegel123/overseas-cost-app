# Step 5: onboarding-screen

온보딩 화면을 페르소나 선택 → **도시 선택**으로 전면 재작성한다. 도시를 고르면 즐겨찾기에 담고 서울 vs 그 도시 Compare 로 바로 이동한다.

## 읽어야 할 파일

- `docs/plans/persona-removal-city-onboarding.md` §B
- `app/onboarding.tsx` — 현재(페르소나 3카드). 유지할 hero 시각 요소(globe 아이콘 히어로, "안녕하세요/어디로 떠나시나요?", 연타 가드 `isNavigatingRef`) 확인.
- `app/(tabs)/index.tsx` — 도시 리스트 패턴: `REGIONS` 상수(44~51줄), loading/error/ready 상태 머신, `Promise.all([loadAllCities(), fetchExchangeRates()])`, `getAllCities()` 로 도시 렌더.
- `src/components/RecentRow.tsx` — props(`cityId`, `mult: number | '신규'`, `onPress`).
- `src/components/RegionPill.tsx`.
- `src/lib/homeTotals.ts` (step 3 산출물 — `computeCityTotal` / `multFromTotals`).
- `src/store/onboarding.ts` (step 1 — `useOnboardingStore().setOnboarded`).
- `src/store/favorites.ts` (`useFavoritesStore().add`).
- `app/compare/[cityId].tsx` 259~263줄 — Compare 가 마운트 시 `pushRecent` 자체 실행하는 것 확인.
- `app/__tests__/onboarding.test.tsx`.

## 작업

### 1. `app/onboarding.tsx` 전면 재작성

- **Hero 유지**: globe 아이콘 히어로 + "안녕하세요 / 어디로 떠나시나요?". 설명 문구에서 "본인 페르소나에 맞게" 제거 → "서울 기준으로 해외 도시 생활비를 비교해 드려요". 하단 "설정에서 언제든 변경..." 문구 제거.
- **도시 리스트**: `Object.values(getAllCities()).filter(c => c.id !== 'seoul')` 를 한글명 가나다 정렬해 `RecentRow` 세로 리스트로 렌더. `mult` 는 `multFromTotals(city, seoulTotal, fx)` — 홈과 동일 배수(시각 일관).
- **권역 필터**: `RegionPill` + `REGIONS` 상수 이식(Home 패턴).
- **검색바 생략**(v1 범위). 리스트 + 권역 필터만.
- **상태 머신**: Home 과 동일한 loading/error/ready + `Promise.all([loadAllCities(), fetchExchangeRates()])`. seoul 데이터로 `seoulTotal = computeCityTotal(seoul, fx)` 계산(배수 기준).
- **선택 흐름**(`handleSelect`, 연타 가드 `isNavigatingRef` 유지):
  ```
  add(cityId);                     // useFavoritesStore
  setOnboarded(true);              // useOnboardingStore
  router.replace(`/compare/${cityId}`);
  ```
  `pushRecent` 는 호출하지 마라 — Compare 가 마운트 시 자체 실행(중복 방지).

### 2. 테스트 재작성 `app/__tests__/onboarding.test.tsx`

- 도시 리스트 렌더(seoul 제외), 권역 필터, 도시 탭 → `add` + `setOnboarded(true)` + `router.replace('/compare/{id}')`, 연타 가드(첫 탭만 실행), loading/error 상태.
- 옛 페르소나 카드 테스트 삭제.

### 3. 옛 스냅샷 삭제

- `app/__tests__/__snapshots__/onboarding.test.tsx.snap` (있으면) 삭제 후 재생성.

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
npx jest app/__tests__/onboarding.test.tsx
```

## 검증 절차

1. AC 통과.
2. 체크:
   - `PersonaCard` / `usePersonaStore` 참조 0(온보딩 화면).
   - 도시 탭 → 즐겨찾기 `add` + `setOnboarded(true)` + `compare/{id}` replace 순서인가?
   - `pushRecent` 를 호출하지 않는가(Compare 중복 방지)?
   - seoul 이 리스트에서 제외되는가?
3. `phases/persona-removal/index.json` step 5 → `completed`.

## 금지사항

- `onboarding.tsx` 에서 `pushRecent` 를 호출하지 마라. 이유: Compare 가 마운트 시 자체 실행 → 최근 목록 중복.
- 검색바를 추가하지 마라(v1 범위 밖). 이유: 도시 20개라 리스트+권역으로 충분, 범위 최소화.
- `setOnboarded` 를 persona store 에서 가져오지 마라 — `useOnboardingStore` 사용(step 1).
- 배럴 `usePersonaStore` export 를 제거하지 마라(settings 가 아직 사용 — step 7).
- 기존 테스트를 깨뜨리지 마라.
