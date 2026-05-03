# Step 3: canada

캐나다 출처 5종 — `ca_cmhc` (임차료) / `ca_statcan` (CPI 식재료·외식) / `ca_translink` (밴쿠버 fare) / `ca_ttc` (토론토 fare) / `ca_stm` (몬트리올 fare). 본 step 종료 시 **Vancouver / Toronto / Montreal 3개 도시 완성**.

## 읽어야 할 파일

- `docs/DATA_SOURCES.md` §2~4 (밴쿠버 / 토론토 / 몬트리올)
- `docs/AUTOMATION.md` §3, §5
- `docs/TESTING.md` §9-A.2, §9-A.3 (캐나다 섹션)
- `scripts/refresh/_common.mjs` (step 0), step 2 의 한국 스크립트 (패턴 참조)
- `data/cities/seoul.json` (step 2 산출물 — 도시 데이터 schema 참조)

## 작업

### 1. `scripts/refresh/ca_cmhc.mjs`

- 출처: CMHC (Canada Mortgage and Housing Corporation) Rental Market Survey
- 도시별 평균 rent → `{vancouver, toronto, montreal}.rent.{share, studio, oneBed, twoBed}`
- API key: 불필요 (정부 공개 데이터)

### 2. `scripts/refresh/ca_statcan.mjs`

- 출처: StatCan CPI (food, restaurant)
- → `food.groceries.*` + `food.restaurantMeal` + `food.cafe` (3개 도시)
- API key: 불필요

### 3. `scripts/refresh/ca_translink.mjs`

- 출처: TransLink fare (Vancouver) — 정적 페이지 또는 공식 API
- → `vancouver.transport`

### 4. `scripts/refresh/ca_ttc.mjs`

- 출처: TTC fare (Toronto) — 정적 페이지
- → `toronto.transport`

### 5. `scripts/refresh/ca_stm.mjs`

- 출처: STM fare (Montreal)
- → `montreal.transport`

### 6. 테스트

`scripts/refresh/__tests__/ca_*.test.ts` × 5. 표준 케이스 14건 + 도시별 변환 검증.

### 7. `data/cities/{vancouver,toronto,montreal}.json` 신규

각 5 스크립트 실행 → 3개 도시 JSON 생성 + commit.

### 8. 인벤토리

`docs/TESTING.md §9-A.3` 의 캐나다 섹션 `[x]` 갱신.

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
node scripts/build_data.mjs
node scripts/validate_cities.mjs
```

## 검증 절차

1. AC 통과
2. 체크:
   - 3개 도시 JSON 생성됨, schema 통과
   - 5 스크립트 모두 표준 인터페이스
3. **API 키 필요 보고**: 캐나다 출처는 모두 키 불필요 (CMHC / StatCan / TransLink·TTC·STM 공개)

## 금지사항

- 한국·미국 등 다른 지역 변경 금지. 이유: 캐나다 step.
- 부동산 사이트 (Zillow, Realtor.ca 등) 사용 금지. 이유: CLAUDE.md CRITICAL.
- 학비·세금·비자 자동화 금지. 이유: 별도 step (universities-visas / 정적 brackets).
