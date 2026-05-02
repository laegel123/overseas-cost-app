# Step 1: fx

환율 자동 갱신 — `scripts/refresh/fx_backup.mjs` + `data/fx_fallback.json` 생성. 클라이언트 (`src/lib/currency.ts`) 의 3차 fallback 데이터 갱신용. 기존 currency.ts 로직은 변경 없음.

## 읽어야 할 파일

- `docs/AUTOMATION.md` §4.6 (`refresh-fx.yml`), §1, 부록 C
- `docs/DATA_SOURCES.md` 부록 C (환율 fallback chain)
- `src/lib/currency.ts` — 기존 환율 로직 (open.er-api.com primary)
- `scripts/refresh/_common.mjs` (step 0 산출물)
- `docs/TESTING.md` §9-A 의 테스트 환경

## 작업

### 1. `scripts/refresh/fx_backup.mjs`

- 한국은행 또는 ECB 의 환율 endpoint fetch (open.er-api.com 외 별도 출처 — fallback chain 의 3차 backup)
- 대상 통화: KRW, CAD, USD, GBP, EUR, AUD, JPY, SGD, VND, AED (10종)
- 응답 → `data/fx_fallback.json` atomic write
- 표준 `RefreshResult` 반환 (source: 'fx_backup', cities: [], fields: ['KRW', ...])

### 2. `data/fx_fallback.json` 신규

- 빈 시드 (실제 데이터는 워크플로우가 생성). 스키마 정의 + 빌드 fallback 용 default 값 1줄.

### 3. `src/lib/currency.ts` 통합

- 기존 `FX_BASELINE_2026Q2` 상수와 `data/fx_fallback.json` 의 우선순위 결정. 본 step 은 **읽기만** — 기존 로직 유지하되 fallback chain 마지막에 `fx_fallback.json` 추가 (없으면 baseline).
- 변경 최소화 — 기존 테스트 통과 유지.

### 4. 테스트

- `scripts/refresh/__tests__/fx_backup.test.ts` — fetch 모킹, 정상 응답·5xx·timeout·schema 깨짐 케이스
- `src/lib/__tests__/currency.test.ts` — fallback chain 에 `fx_fallback.json` 추가 검증

### 5. 인벤토리

`docs/TESTING.md` 에 §9-A.x `fx_backup.mjs` 섹션 신규 추가. `currency.ts` 인벤토리도 fallback chain 갱신 반영.

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
node scripts/refresh/fx_backup.mjs   # 실제 fetch 시도 — API 응답 정상이면 성공 (옵션)
```

## 검증 절차

1. AC 통과
2. 체크:
   - 기존 currency 테스트 모두 pass
   - `data/fx_fallback.json` 스키마는 `Record<CurrencyCode, number>` (기존 ExchangeRates 와 호환)
3. **API 키 필요 여부 보고**: 한국은행 API 가 키 필요한지 확인 후 명시 (필요하면 사용자 발급 대기)

## 금지사항

- `src/lib/currency.ts` 의 primary endpoint (open.er-api.com) 변경 금지. 이유: ADR-009 결정.
- 다른 도시 데이터 갱신 금지. 이유: fx 만 다루는 step.
- GitHub Actions yml 작성 금지. 이유: workflows step 10.
