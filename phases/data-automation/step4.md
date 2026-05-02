# Step 4: usa

미국 출처 4종 — `us_hud` (FMR 임차료) / `us_census` (ACS median rent) / `us_bls` (CPI 식재료·외식, 지역별) / `us_transit` (MTA / LA Metro / SFMTA / King County / MBTA fare). 본 step 종료 시 **NY / LA / SF / Seattle / Boston 5개 도시 완성**.

## 읽어야 할 파일

- `docs/DATA_SOURCES.md` §5~9 (NY / LA / SF / Seattle / Boston)
- `docs/AUTOMATION.md` §3, §5
- `docs/TESTING.md` §9-A.3 (미국 섹션)
- `scripts/refresh/_common.mjs` + step 2/3 패턴

## 작업

### 1. `scripts/refresh/us_hud.mjs`

- 출처: HUD Fair Market Rent (FMR) — 메트로/지역별
- → 5개 도시 `rent.{share, studio, oneBed, twoBed}`
- API key: 불필요

### 2. `scripts/refresh/us_census.mjs`

- 출처: US Census ACS (American Community Survey) median rent
- → 5개 도시 `rent.*` (HUD 와 cross-validation)
- API key: `US_CENSUS_API_KEY` 필요

### 3. `scripts/refresh/us_bls.mjs`

- 출처: BLS CPI (지역별 — Northeast / Midwest / South / West)
- → 5개 도시 `food.groceries.*` + `food.restaurantMeal` + `food.cafe`
- API key: `US_BLS_API_KEY` 필요

### 4. `scripts/refresh/us_transit.mjs`

- 출처: 5개 transit agency fare 페이지 / API
  - NY: MTA
  - LA: LA Metro
  - SF: SFMTA
  - Seattle: King County Metro
  - Boston: MBTA
- → 5개 도시 `transport.*`
- API key: 불필요 (대부분)

### 5. 테스트

`scripts/refresh/__tests__/us_*.test.ts` × 4. 표준 케이스 14건 + 도시별 변환 + 지역 매핑 (BLS).

### 6. `data/cities/{nyc,la,sf,seattle,boston}.json` 신규

step 2 패턴: 4 스크립트 실행 → 5개 도시 JSON 생성 + commit.

### 7. 인벤토리

`docs/TESTING.md §9-A.3` 의 미국 섹션 `[x]`.

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
node scripts/build_data.mjs && node scripts/validate_cities.mjs
```

## 검증 절차

1. AC 통과
2. 체크: 5개 도시 JSON, 4 스크립트 표준 인터페이스
3. **API 키 필요 보고**:
   - `US_BLS_API_KEY` (https://www.bls.gov/developers/, 무료)
   - `US_CENSUS_API_KEY` (https://api.census.gov/data/key_signup.html, 무료)

## 금지사항

- Zillow / Apartments.com 등 상업 부동산 사이트 사용 금지. 이유: CLAUDE.md CRITICAL.
- BLS 지역 매핑 임의 추정 금지. 이유: 공식 BLS region 코드 사용.
