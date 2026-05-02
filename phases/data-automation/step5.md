# Step 5: uk-de

영국·독일 출처 4종 — `uk_ons` / `uk_tfl` / `de_destatis` / `de_transit`. 본 step 종료 시 **London / Berlin / Munich 3개 도시 완성**.

## 읽어야 할 파일

- `docs/DATA_SOURCES.md` §10~12 (런던 / 베를린 / 뮌헨)
- `docs/AUTOMATION.md` §3, §5
- `docs/TESTING.md` §9-A.3 (영국·독일 섹션)
- step 2~4 의 출처 스크립트 패턴

## 작업

### 1. `scripts/refresh/uk_ons.mjs`

- 출처: UK ONS (Office for National Statistics) — Index of Private Housing Rental Prices + CPI
- → London `rent.*` + `food.*`
- API key: 불필요

### 2. `scripts/refresh/uk_tfl.mjs`

- 출처: TfL (Transport for London) fare API
- → London `transport.*`
- API key: 불필요 (TfL Open Data Portal — 키는 익명 가능)

### 3. `scripts/refresh/de_destatis.mjs`

- 출처: Destatis (독일 통계청) — Mietspiegel + CPI
- → Berlin / Munich `rent.*` + `food.*`
- API key: 불필요

### 4. `scripts/refresh/de_transit.mjs`

- 출처: BVG (베를린) + MVV (뮌헨) fare 페이지
- → Berlin / Munich `transport.*`
- API key: 불필요

### 5. 테스트

`scripts/refresh/__tests__/{uk,de}_*.test.ts` × 4. 표준 케이스 14건.

### 6. `data/cities/{london,berlin,munich}.json` 신규

### 7. 인벤토리

`docs/TESTING.md §9-A.3` 영국·독일 섹션 `[x]`.

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
node scripts/build_data.mjs && node scripts/validate_cities.mjs
```

## 검증 절차

1. AC 통과
2. 체크: 3개 도시 JSON, 4 스크립트
3. **API 키 필요 보고**: 모두 키 불필요

## 금지사항

- Numbeo / Mietmarkt 등 상업 사이트 금지.
- Berlin / Munich 외 다른 독일 도시 추가 금지. 이유: PRD 21개 도시 한정.
