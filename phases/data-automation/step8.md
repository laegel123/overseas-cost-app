# Step 8: sg-vn-ae

싱가포르·베트남·UAE 출처 5종 + EU Eurostat fallback — `sg_singstat` / `sg_lta` / `vn_gso` / `ae_fcsc` / `ae_rta` / `eu_eurostat`. 본 step 종료 시 **Singapore / Hanoi / Dubai 3개 도시 완성**.

## 읽어야 할 파일

- `docs/DATA_SOURCES.md` §19~21 (싱가포르 / 호치민·하노이 / 두바이) + 부록 B (자동화 한계)
- `docs/AUTOMATION.md` §3, §5, §8 (자동화 한계 — 호치민 / 두바이)
- `docs/TESTING.md` §9-A.3
- step 2~7 패턴

## 작업

### 1. `scripts/refresh/sg_singstat.mjs`

- 출처: SingStat (싱가포르 통계청) — Rental Index + CPI
- → Singapore `rent.*` + `food.*`
- API key: `SG_DATA_GOV_KEY` 필요할 수 있음

### 2. `scripts/refresh/sg_lta.mjs`

- 출처: LTA (Land Transport Authority) fare
- → Singapore `transport.*`

### 3. `scripts/refresh/vn_gso.mjs`

- 출처: GSO (Vietnam General Statistics Office) — 입자도 한계 (도시별 분리 약함)
- → Hanoi `rent.*` + `food.*` (도시 평균 + 보정)
- AUTOMATION.md §8 의 한계 명시 — `sources[].name` 에 "추정" 마커
- API key: 불필요

### 4. `scripts/refresh/ae_fcsc.mjs`

- 출처: FCSC (UAE Federal Competitiveness and Statistics Centre) + DSC (Dubai Statistics Centre)
- → Dubai `rent.*` + `food.*`
- 학비는 별도 step 9 (universities.mjs 가 Wollongong Dubai 등 fetch)

### 5. `scripts/refresh/ae_rta.mjs`

- 출처: RTA (Roads and Transport Authority) Dubai fare
- → Dubai `transport.*`

### 6. `scripts/refresh/eu_eurostat.mjs`

- 출처: Eurostat fallback (EU 도시 입자도 보조)
- 본 step 에서는 fallback 만 — 실제 사용은 step 5/6 의 EU 스크립트가 호출.
- 스크립트 단독으로 실행 가능 + 표준 인터페이스 유지

### 7. 테스트

`scripts/refresh/__tests__/{sg,vn,ae,eu}_*.test.ts` × 6. 표준 케이스 + 한계 마커 검증.

### 8. `data/cities/{singapore,hanoi,dubai}.json` 신규

### 9. 인벤토리

`docs/TESTING.md §9-A.3` 갱신.

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
node scripts/build_data.mjs && node scripts/validate_cities.mjs
```

## 검증 절차

1. AC 통과
2. 체크:
   - 3개 도시 JSON, 6 스크립트
   - Hanoi sources[] 에 "추정" 마커, Dubai 에 "static" 마커 (학비 부재 영역)
3. **API 키 필요 보고**: `SG_DATA_GOV_KEY` (data.gov.sg, 일부 dataset 키 필요)

## 금지사항

- Hanoi 도시 평균 외 동네별 데이터 추정 금지. 이유: GSO 입자도 한계.
- Numbeo / Expatistan 등 상업 사이트 fallback 금지. 이유: CLAUDE.md CRITICAL.
