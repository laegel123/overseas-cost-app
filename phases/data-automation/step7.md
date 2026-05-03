# Step 7: au-jp

호주·일본 출처 4종 — `au_abs` / `au_transit` / `jp_estat` / `jp_transit`. 본 step 종료 시 **Sydney / Melbourne / Tokyo / Osaka 4개 도시 완성**.

## 읽어야 할 파일

- `docs/DATA_SOURCES.md` §15~18 (시드니 / 멜버른 / 도쿄 / 오사카)
- `docs/AUTOMATION.md` §3, §5
- `docs/TESTING.md` §9-A.3
- step 2~6 패턴

## 작업

### 1. `scripts/refresh/au_abs.mjs`

- 출처: ABS (Australian Bureau of Statistics) — Residential Property Price Indexes + CPI
- → Sydney / Melbourne `rent.*` + `food.*`
- API key: 불필요

### 2. `scripts/refresh/au_transit.mjs`

- 출처: Transport NSW (시드니) + PTV (멜버른) fare
- → Sydney / Melbourne `transport.*`
- API key: 불필요

### 3. `scripts/refresh/jp_estat.mjs`

- 출처: e-Stat (일본 정부 통계 포털) — 住宅統計 + CPI
- → Tokyo / Osaka `rent.*` + `food.*`
- API key: `JP_ESTAT_APP_ID` 필요

### 4. `scripts/refresh/jp_transit.mjs`

- 출처: 도쿄메트로 + 大阪Metro fare 페이지
- → Tokyo / Osaka `transport.*`
- API key: 불필요

### 5. 테스트

`scripts/refresh/__tests__/{au,jp}_*.test.ts` × 4.

### 6. `data/cities/{sydney,melbourne,tokyo,osaka}.json` 신규

### 7. 인벤토리

`docs/TESTING.md §9-A.3` 갱신.

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
node scripts/build_data.mjs && node scripts/validate_cities.mjs
```

## 검증 절차

1. AC 통과
2. 체크: 4개 도시 JSON, 4 스크립트
3. **API 키 필요 보고**: `JP_ESTAT_APP_ID` (https://www.e-stat.go.jp/api/, 무료 가입)

## 금지사항

- Sydney / Melbourne / Tokyo / Osaka 외 도시 추가 금지.
- jp_estat 의 dataset 코드 임의 추정 금지 — DATA_SOURCES.md 명시 코드만 사용.
