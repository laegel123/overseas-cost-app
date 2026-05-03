# Step 9: universities-visas

대학 학비 + 비자 fee 자동화 — `universities.mjs` (각 대학 공식 페이지 fetch) + `visas.mjs` (각국 정부 페이지 fetch). 21개 도시 모두에 `tuition[]` + `visa[]` 보강.

## 읽어야 할 파일

- `docs/DATA_SOURCES.md` §0.5 (학비), §0.7 (비자) + 각 도시 학비 / 비자 섹션
- `docs/AUTOMATION.md` §3, §8 (한계 — 두바이 학비, 호치민 비자)
- `docs/TESTING.md` §9-A.3 의 universities / visas 섹션
- `src/types/city.ts` — `CityTuition`, `CityVisa` 스키마
- step 2~8 의 도시 JSON (`data/cities/*.json`)

## 작업

### 1. `scripts/refresh/universities.mjs`

- 출처: 각 도시별 대표 대학 공식 페이지 fetch (DATA_SOURCES.md 명시 URL)
  - 예: UBC (밴쿠버), U of Toronto, McGill (몬트리올), NYU, UCLA, UC Berkeley, UW Seattle, Harvard 등
- 각 대학별 `tuition[]` 항목 (학부 / 대학원 / 국제학생 분기)
- 모든 21개 도시에 학비 매핑 (도시당 1~3개 대학)
- API key: 불필요 (페이지 scraping)
- HTML parsing 은 `cheerio` 또는 정규식 — 페이지 구조 변경 시 명시적 에러

### 2. `scripts/refresh/visas.mjs`

- 출처: 각국 정부 비자 페이지 (DATA_SOURCES.md 명시 URL)
  - 예: 대한민국 출입국, Canada IRCC, US USCIS, UK GOV, 독일 BMI, 일본 외무성 등
- 각 국가별 `visa[]` (학생 / 취업 / 워킹홀리데이 분기)
- 21개 도시 모두 매핑 (도시 → 국가 → 비자 fee)
- API key: 불필요

### 3. 한계 명시

- 두바이 학비: DSC·FCSC 학비 데이터 부재 → AUS Dubai / Wollongong Dubai 공식 페이지 fetch
- 호치민 / 두바이 비자: 영문 정보 한계 → `sources[].name` 에 "limited" 마커

### 4. 테스트

- `scripts/refresh/__tests__/universities.test.ts` — 페이지 응답 fixture × 대학 N개, 정상 / 페이지 구조 변경 (HTML 파싱 실패) / 4xx
- `scripts/refresh/__tests__/visas.test.ts` — 비자 fee 변환 + 분기

### 5. `data/cities/*.json` 21개 모두 갱신 — `tuition[]` + `visa[]` 추가

### 6. 인벤토리

`docs/TESTING.md §9-A.3` 학비·비자 섹션 `[x]`.

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
node scripts/build_data.mjs && node scripts/validate_cities.mjs
```

## 검증 절차

1. AC 통과
2. 체크:
   - 21개 도시 JSON 모두에 tuition / visa 필드
   - 페이지 구조 변경 시나리오에 명시적 에러 (silent fail 금지)
3. **API 키 필요 보고**: 모두 키 불필요

## 금지사항

- College Board / QS Rankings 등 commercial source 금지. 이유: 공식 페이지만 — CLAUDE.md CRITICAL.
- HTML 구조 변경 시 fallback 임시 값 사용 금지. 이유: silent fail 금지 — 명시적 에러 + skip + warning.
