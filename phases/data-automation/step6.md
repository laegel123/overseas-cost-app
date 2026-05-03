# Step 6: fr-nl

프랑스·네덜란드 출처 4종 — `fr_insee` / `fr_ratp` / `nl_cbs` / `nl_gvb`. 본 step 종료 시 **Paris / Amsterdam 2개 도시 완성**.

## 읽어야 할 파일

- `docs/DATA_SOURCES.md` §13~14 (파리 / 암스테르담)
- `docs/AUTOMATION.md` §3, §5
- `docs/TESTING.md` §9-A.3 (프랑스·네덜란드 섹션)
- step 2~5 패턴

## 작업

### 1. `scripts/refresh/fr_insee.mjs`

- 출처: INSEE (프랑스 국립통계청) — Loyers (임차료) + IPC (CPI)
- → Paris `rent.*` + `food.*`

### 2. `scripts/refresh/fr_ratp.mjs`

- 출처: RATP (Régie Autonome des Transports Parisiens) fare 페이지
- → Paris `transport.*`

### 3. `scripts/refresh/nl_cbs.mjs`

- 출처: CBS (네덜란드 통계청) — Huurprijzen + CPI
- → Amsterdam `rent.*` + `food.*`

### 4. `scripts/refresh/nl_gvb.mjs`

- 출처: GVB (Gemeentevervoerbedrijf Amsterdam) fare
- → Amsterdam `transport.*`

### 5. 테스트

`scripts/refresh/__tests__/{fr,nl}_*.test.ts` × 4.

### 6. `data/cities/{paris,amsterdam}.json` 신규

### 7. 인벤토리

`docs/TESTING.md §9-A.3` 갱신.

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
node scripts/build_data.mjs && node scripts/validate_cities.mjs
```

## 검증 절차

1. AC 통과
2. 체크: 2개 도시 JSON, 4 스크립트
3. **API 키 필요 보고**: 모두 키 불필요

## 금지사항

- Paris / Amsterdam 외 도시 추가 금지.
- INSEE 의 dataset 임의 매핑 금지 — DATA_SOURCES.md 명시 매핑만 사용.
