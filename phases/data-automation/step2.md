# Step 2: korea

한국 출처 4종 — `kr_molit` (임차료) / `kr_kca` (식재료) / `kr_kosis` (외식·교통 CPI) / `kr_seoul_metro` (지하철 fare). 본 step 종료 시 **Seoul (`data/cities/seoul.json`) 완성**.

## 읽어야 할 파일

- `docs/DATA_SOURCES.md` §1 (서울)
- `docs/AUTOMATION.md` §3 (표준 인터페이스), §5 (API keys)
- `docs/TESTING.md` §9-A.2, §9-A.3
- `src/types/city.ts` — `CityCostData`, `CityRent`, `CityFood`, `CityTransport`, `CityTuition`, `CityTax`, `CityVisa`
- `scripts/refresh/_common.mjs` / `_outlier.mjs` / `_diff.mjs` / `_registry.mjs` (step 0)

## 작업

### 1. `scripts/refresh/kr_molit.mjs`

- 출처: 국토부 실거래가 공개 시스템 — `data.go.kr` 의 RTMS_DataSvcAptRent endpoint
- 25개 자치구 응답 → 평균 → `seoul.rent.{share, studio, oneBed, twoBed}` 매핑
- API key: `KR_DATA_API_KEY` 필요

### 2. `scripts/refresh/kr_kca.mjs`

- 출처: 한국소비자원 참가격 — 식재료 8종 표준 (`milk1L`, `eggs12`, `rice1kg`, `chicken1kg`, `beef1kg`, `apple1kg`, `bread500g`, `ramen5pk`)
- → `seoul.food.groceries.*`
- API key: `KR_DATA_API_KEY` (재사용)

### 3. `scripts/refresh/kr_kosis.mjs`

- 출처: KOSIS — 외식 CPI (`food.restaurantMeal`, `food.cafe`) + 보정 계수 적용
- API key: `KR_DATA_API_KEY` (재사용)

### 4. `scripts/refresh/kr_seoul_metro.mjs`

- 출처: 서울교통공사 fare 표 (정적 페이지 fetch + parse) 또는 공공 API
- → `seoul.transport.{singleRide, monthlyPass, taxiBase}`
- API key: 불필요

### 5. 테스트

각 스크립트 별 `__tests__/kr_*.test.ts`:

- 정상 응답 (fixture) → 변환 + write
- HTTP 4xx/5xx, timeout, 응답 shape 변경
- API 키 부재 → `MissingApiKeyError`
- 표준 케이스 14건 (TESTING.md §9-A.2)

### 6. `data/cities/seoul.json` 신규

- step 2 종료 시 4 스크립트 한 번씩 실행 → seoul.json 생성 + commit
- (실제 fetch 가 가능하면 실데이터, 불가능하면 fixture 기반 정적 값)

### 7. 인벤토리

`docs/TESTING.md §9-A.3` 의 `[ ]` → `[x]`.

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
node scripts/build_data.mjs
node scripts/validate_cities.mjs
```

## 검증 절차

1. AC 통과
2. 체크:
   - `data/cities/seoul.json` 생성됨, schema 통과
   - 4 스크립트 모두 표준 인터페이스 (`RefreshResult`)
   - sources[] 에 (category, name, url, accessedAt) 4개 출처 모두 기록
3. **API 키 필요 보고**: `KR_DATA_API_KEY` 발급 필요 — 사용자에게 https://www.data.go.kr 가입 안내 후 secrets 등록 요청

## 금지사항

- 다른 도시 데이터 변경 금지. 이유: 한국 step.
- GitHub Actions yml 작성 금지. 이유: workflows step 10.
- 수동 큐레이션 금지. 이유: ADR-028 supersede + ADR-032 — 모든 데이터는 자동 fetch.
- `kr_molit` 외 부동산 출처 (Numbeo, Kijiji 등) 사용 금지. 이유: CLAUDE.md CRITICAL 상업 플랫폼 금지.
