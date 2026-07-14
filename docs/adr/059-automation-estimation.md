[← ADR 인덱스](../ADR.md)

# ADR-059: 데이터 자동화 추정·보정 결정 — `share=studio×0.65` / CPI 기준년도 / BLS 도시 보정 / static fallback

**상태:** 채택 (2026-05-03)

**맥락:**

PR #19 review (data-automation step 0–3) 에서 다음 4 가지 방법론적 결정이 ADR 없이 도입됨이 지적됨. 자동화 출처가 정확히 매핑되지 않는 영역의 추정·보정 정책이 코드에만 기록되면 v1.x 에서 변경 사유 추적 불가.

**결정:**

1. **`share = studio × 0.65` 추정** (ca_cmhc.mjs / us_hud.mjs):
   - CMHC RMS 와 HUD FMR 둘 다 "shared accommodation / room" 데이터를 직접 제공하지 않음.
   - 캐나다·미국 도시의 share rent (방 1개) 를 studio (1인 unit) 의 65% 로 추정 — Statistics Canada Survey of Household Spending 의 평균 비율 근사.
   - 한국 (kr_molit) 은 별도 매핑 사용 (자치구 평균 직접 제공).

2. **CPI → 실가격 변환 기준년도 2020 = 100** (kr_kosis.mjs / 기타 CPI 출처):
   - 모든 통계청 CPI 가 동일 기준년도 (2020 = 100) 를 사용.
   - 변환식: `current = base_2020 × (cpi / 100)`. `BASE_PRICES` 는 통계청 발표 2020 평균가 사용.
   - 출처 추적:
     - `kr_kosis.mjs` `restaurantMeal`: KOSIS "도시별 소비자물가지수" 표 (코드 `DT_1J17001`) §외식 / 일반음식점 평균가 2020
     - `kr_kosis.mjs` `cafe`: 동 표의 §커피전문점 평균가 2020
   - 기준년도 변경 시 (예: 2025 = 100 으로 전환) 모든 출처 일괄 갱신 + 본 ADR 갱신.

3. **BLS 지역 → 도시별 보정계수** (us_bls.mjs `CITY_ADJUSTMENT` — step 4 도입 예정):
   - BLS 는 4 census region (Northeast / Midwest / South / West) 까지만 분리 제공 — 도시별 데이터 부재.
   - 도시 ↔ 지역 매핑 후 NYC=1.15 / SF=1.25 / LA=1.05 / Seattle=1.00 / Boston=1.10 보정.
   - 보정값 출처 (PR #20 review round 21 보완):
     - BLS Consumer Expenditure Survey "Geographic Variation in Regional Price Differentials" (2023 chart) — `https://www.bls.gov/cex/csxgeography.htm`.
     - BEA Regional Price Parities (RPPs) "Goods and All Items" 2022 — `https://www.bea.gov/data/prices-inflation/regional-price-parities-state-and-metro-area`.
     - 두 출처 모두 metro area 단위 RPP 를 제공하며 NYC/SF/LA/Seattle/Boston 의 "All items" RPP 가 위 보정계수와 ±2pt 이내 일치 (운영자가 분기 1회 재확인, 변경 5pt 이상 시 ADR 갱신).
     - 접근 시점: 2026-04 (data-automation step 4 작성 시점). v1.x 단위 검증 phase 에서 자동 fetch 검토.
   - **현재 상태**: 본 보정계수는 us_bls.mjs `CITY_CONFIGS` 에 hardcoded — `data/cities/*.json` 에는 적용된 결과만 적재. 운영자는 분기 1회 BEA RPP 갱신 시 본 ADR + 코드 동시 갱신.

4. **`bread` 필드 단위 — BLS APU per-lb 보존, 변환 X** (us_bls.mjs `mapToGroceries`):
   - BLS APU0x00702111 = "Bread, white, pan, per lb" 응답을 lb→kg 변환 없이 그대로 사용 (milk1L 의 ½gal→L, chicken1kg 의 lb→kg 와 다름).
   - 이유: 미국 슈퍼마켓 표준 식빵 한 덩어리가 약 1lb (454g) → "bread" 필드를 "한 덩어리 (loaf) 가격" 으로 해석. 서울 3500 KRW (약 500g 식빵 한 덩어리) 와 비교 가능.
   - 대안 검토: (B) lb→kg 변환 — 1kg 빵은 미국·한국 모두 비현실적 단위라 비교 무의미. 거부.
   - v1.x 에서 필드명 명시화 (`breadPerLoaf` 등) 검토 — 현재는 schemaVersion 1 호환을 위해 `bread` 유지.

5. **`ca_statcan` 식재료 8종 중 일부 항목 static fallback** (`onion1kg`, `apple1kg`, `ramen` 등):
   - StatCan CPI 는 식재료 8종 표준 중 5종만 제공 (milk / eggs / rice / chicken / bread).
   - 나머지 3종은 출처 부재 → static 값 + `sources[].name` 에 "static" 마커.
   - **STATIC_PRICES 기준년도 / CPI 기준년도 일치 검증** (✅ 해소 — 런타임 검증 도입):
     - `cpiToPrice(cpi, basePrice) = (cpi/100) × basePrice` 변환식이 정확하려면 `basePrice` 가 CPI 기준년도의 가격이어야 함.
     - StatCan WDS Vector (Table 18-10-0004) 의 CPI 기준년도가 2002=100 인지 2020=100 인지 — `getSeriesInfoFromVector` 호출로 base period 확인.
     - 확인 방법: `curl https://www150.statcan.gc.ca/t1/wds/rest/getSeriesInfoFromVector/41691028` → `referencePeriod`.
     - 현재 `STATIC_PRICES` 는 2024~2026 시장가 기준 (provisional) — 기준년도 일치 시 `staticPrices × (cpi_now / 100)` 가 현재가에 근접해야 함. 5–10% 이상 편차 시 STATIC_PRICES 를 기준년도 평균가로 교체.
     - **해소 방법**: `ca_statcan.mjs::fetchSeriesReferencePeriod` 가 CPI 갱신 시작 시 첫 vector 의 `referencePeriod` 를 인증. `ALLOWED_REFERENCE_PERIODS = {2002=100, 2020=100}` 외 값이면 `errors[]` push + 정적 fallback 으로 자동 우회. 1차 방어선 (referencePeriod 인증) + 2차 방어선 (`isCpiBasePeriodSuspect` 값 기반 heuristic) 이중.
   - v1.x 에서 식재료 정밀 데이터 출처 (StatCan Detailed CPI 또는 KOSIS 와 같은 입자도) 발굴 시 ADR 갱신.

6. **`kr_seoul_metro` STATIC_FARES** — HTML 파싱 실패 시 fallback:
   - 출처: 서울교통공사 공식 운임 안내 (https://www.seoulmetro.co.kr/) 2024.10 기준.
   - `singleRide: 1400` (기본 운임), `monthlyPass: 65000` (정기권), `taxiBase: 4800` (서울 택시 기본요금).
   - 갱신 정책: HTML 페이지 구조 변경 등으로 파싱 실패 시 errors push (round 4 부터). 운영자가 분기 1회 검토 + 변경 시 본 ADR + 코드 동시 갱신.

7. **`data/static/fx_fallback.json` 초기 baseline 동일 값**:
   - 현재 파일 (asOf: 2026-04-01) 환율값은 `currency.ts` 의 `FX_BASELINE_2026Q2` 와 의도적으로 동일.
   - 이유: `refresh-fx.yml` 워크플로우가 한 번도 실행되지 않은 출시 직전 시드 상태. v1.0 출시 전 cron 1회 실행으로 ECB 실시간 환율 덮어쓰기.
   - 운영 가이드: 출시 PR 체크리스트에 "refresh-fx.yml 1회 수동 dispatch 후 검증" 추가.

**대안 검토:**

- (A 선택) 추정·보정 모두 채택 + ADR 명시: v1.0 출시 가능. 출처 한계 명시적 추적. 채택.
- (B) share / 외식 / 보정계수 미제공으로 표시: PRD 요구사항 불충족 — 거부.
- (C) 상업 출처 (Numbeo 등) 보충: CLAUDE.md CRITICAL 위반 — 거부.

**결과 / 영향:**

- v1.0 출시에 필요한 모든 필드가 자동화로 채워짐.
- 추정·보정 영역은 `sources[]` 마커 + 본 ADR 으로 추적 가능.
- v1.x 데이터 정밀도 향상 시 보정계수 / static fallback 우선 검토.

**관련:** ADR-032 (자동화 정책), ADR-028 (수동 큐레이션 금지), `docs/AUTOMATION.md` §8 (자동화 한계), `docs/DATA_SOURCES.md` 부록 B, `scripts/refresh/{ca_cmhc,us_hud,kr_kosis,us_bls,ca_statcan}.mjs`.
