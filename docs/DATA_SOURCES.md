# 도시별 데이터 출처 매핑 (공공 출처 100%)

각 도시·항목의 **공공 출처 + 자동 fetch endpoint + 데이터 정의** 를 명시한다. 모든 데이터는 `scripts/refresh/<source>.mjs` 가 자동으로 갱신 (AUTOMATION.md 참조).

수동 큐레이션은 **금지** (ADR-028 supersede). 자동화 한계가 있는 항목은 명시적으로 "static" 또는 "estimated" 마커.

> ⚠️ **동기화 경고 (수동 카운트):**
>
> **출처 유형 총수: 12** — 정부 통계 / 공식 교통공사 / 공식 대학 페이지 / 환율 API 등 카테고리별 활용 출처.
>
> 본 파일에 출처를 추가/제거할 때 **반드시 함께 갱신**:
> 1. 본 라인의 "출처 유형 총수" 숫자
> 2. `app/(tabs)/settings.tsx` 의 `DATA_SOURCES_COUNT` 상수
> 3. (선택) `docs/TESTING.md` §9.29 "출처 rightText" 케이스의 기대값
>
> v1.x 빌드 타임 자동 카운트 도입 시 본 경고 제거 예정 (TODO 주석 참조).

---

## 0. 데이터 정의 표준 (모든 도시 공통)

ADR-027 + 자동화 정책에 따른 표준. 공공 통계 입자도가 거칠어 일부 항목은 "도시 평균" 으로 정의 변경.

### 0.1 월세 (rent)

| 필드     | 정의 (자동화 기준)                                          | 출처 종류 |
| -------- | ----------------------------------------------------------- | --------- |
| `share`  | 공공 통계상 single room rent 메디안. 도시 평균.             | 정부 통계 |
| `studio` | 1-bedroom 또는 studio median rent (도시 평균). 가구 미포함. | 정부 통계 |
| `oneBed` | 1-bedroom median rent. 도시 평균.                           | 정부 통계 |
| `twoBed` | 2-bedroom median rent. 도시 평균.                           | 정부 통계 |

**자동화 한계**: 동네별 입자도 손실. 시내 vs 외곽 구분 불가 → 도시 평균만.

### 0.2 식비 외식 (food.restaurantMeal, food.cafe)

| 필드             | 정의                                                      | 출처                  |
| ---------------- | --------------------------------------------------------- | --------------------- |
| `restaurantMeal` | CPI "Food away from home" 카테고리 평균값 + 도시 보정계수 | 정부 통계 + 정적 보정 |
| `cafe`           | CPI 카페·음료 평균값 또는 정적 추정                       | 정부 통계             |

**자동화 한계**: CPI 는 인플레이션 지수 + 평균값. 실제 식당 1끼 가격은 추정. 도시 보정계수 (예: 도쿄 1.0 vs 오사카 0.9) 는 정적, 연 1회 검토.

### 0.3 식재료 (food.groceries) 8개 표준

CPI 또는 공공 가격조사 데이터에서 매핑. 항목별 매핑은 도시별 섹션 참조.

| 항목         | 정의                                                               |
| ------------ | ------------------------------------------------------------------ |
| `milk1L`     | 우유 1L 평균가                                                     |
| `eggs12`     | 계란 12개 평균가                                                   |
| `rice1kg`    | 백미 1kg 평균가                                                    |
| `chicken1kg` | 닭고기 1kg 평균가                                                  |
| `bread`      | 식빵 1봉 평균가                                                    |
| `onion1kg`   | 양파 1kg 평균가                                                    |
| `apple1kg`   | 사과 1kg 평균가                                                    |
| `ramen`      | 라면 1봉 평균가 (한국식 라면 매핑 어려운 도시는 일반 인스턴트라면) |

### 0.4 교통 (transport)

| 필드          | 정의                   | 출처          |
| ------------- | ---------------------- | ------------- |
| `monthlyPass` | 시내 월정기권 성인 1인 | 교통공사 공식 |
| `singleRide`  | 1회권 기본 구간        | 동일          |
| `taxiBase`    | 일반택시 기본요금      | 동일          |

### 0.5 학비 (tuition)

| 필드     | 정의                            | 출처             |
| -------- | ------------------------------- | ---------------- |
| `school` | 도시별 한국인 인기 대학 1~3개   | 대학 공식        |
| `level`  | undergrad / graduate / language | —                |
| `annual` | 국제학생 연간 등록금            | 대학 공식 페이지 |

### 0.6 세금/실수령 (tax)

각국 공식 정적 brackets 적용. 연 1회 갱신.

### 0.7 비자 (visa)

| 필드                    | 정의                                                  |
| ----------------------- | ----------------------------------------------------- |
| `studentApplicationFee` | 정부 공식 학생비자 신청 수수료                        |
| `workApplicationFee`    | 워홀·취업비자 (한국인 적용) 수수료                    |
| `settlementApprox`      | 정착 추정 (visa + 건강검진 + 편도 항공권). 정적 추정. |

---

## 1. 서울 (KRW) — 본국

### 임차료

- **출처**: 국토교통부 **실거래가 공개시스템**
- **API**: `https://apis.data.go.kr/1613000/RTMSDataSvcRHRent` (전월세)
- **공공데이터포털 키 필요** (`KR_DATA_API_KEY`)
- **자동화**: `scripts/refresh/kr_molit.mjs` — 월 1회
- **방법**: 서울특별시 25개 자치구 임대료 메디안 → share/studio/oneBed/twoBed 매핑
- **한계**: 매물 면적 기준 → "share" 는 면적 가장 작은 그룹 (10㎡ 이하)

### 식재료

- **출처**: 한국소비자원 **참가격**
- **API**: `https://www.data.go.kr/data/15047042/openapi.do` (생필품 가격)
- **공공데이터포털 키 필요**
- **자동화**: `scripts/refresh/kr_kca.mjs` — 주 1회
- **방법**: 32개 품목 중 우리 8개 매핑 (우유·계란·쌀·닭가슴살·식빵·양파·사과·라면). 서울 대형마트 평균가.

### 외식·카페

- **출처**: 통계청 **KOSIS 소비자물가지수 (외식)** + 정적 보정
- **API**: `https://kosis.kr/openapi/`
- **자동화**: `scripts/refresh/kr_kosis.mjs` — 주 1회
- **방법**: 외식·음료 카테고리 평균값 + 정적 보정계수 1.0

### 교통

- **출처**: 서울교통공사 + 서울 열린데이터광장
- **API**: `http://openapi.seoul.go.kr:8088/`
- **자동화**: `scripts/refresh/kr_seoul_metro.mjs` — 분기 1회
- **방법**: 정기권·1회권·택시 기본요금 공식 페이지 fetch + parse

### 학비/세금/비자

- **N/A** (서울은 본국, 비교 안 함)

---

## 2. 밴쿠버 (CAD)

### 임차료

- **출처**: **CMHC** (Canada Mortgage and Housing Corporation) Rental Market Survey
- **API**: `https://www03.cmhc-schl.gc.ca/hmip-pimh/en/TableMapChart/RentalMarketAreaTable` (CSV/XML download + parse) 또는 `Statistics Canada Table 34-10-0133` API
- **자동화**: `scripts/refresh/ca_cmhc.mjs` — 월 1회
- **방법**: Vancouver CMA 평균 임대료 by # bedrooms

### 식재료·외식

- **출처**: **Statistics Canada CPI by item** (Vancouver CMA)
- **API**: `https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectors` (StatCan WDS API, 키 불필요)
- **자동화**: `scripts/refresh/ca_statcan.mjs` — 주 1회
- **방법**: CPI 항목별 (밀크, 계란, 쌀, 치킨, 빵, 양파, 사과) Vancouver CMA 평균가. ramen 은 정적 (한인 마트 평균).

### 교통 — TransLink

- **출처**: TransLink fare 공식 페이지
- **URL**: https://www.translink.ca/transit-fares
- **자동화**: `scripts/refresh/ca_translink.mjs` — 분기 1회
- **방법**: HTML fetch + parse (table 구조 안정)

### 학비

- **자동화**: `scripts/refresh/universities.mjs` (공통)
- **출처**: UBC, SFU, BCIT 공식 international tuition 페이지
- **URL**:
  - UBC: https://you.ubc.ca/financial-planning/cost/
  - SFU: https://www.sfu.ca/students/fees/calculator.html
  - BCIT: https://www.bcit.ca/admission/international/
- **방법**: HTML fetch + parse (international undergrad Arts 또는 average)

### 세금

- **출처**: Canada Revenue Agency + BC provincial tax 정적 brackets
- **자동화**: 정적 데이터 (`data/static/tax_brackets.json`), 연초 갱신
- **방법**: 연봉 60k/80k/100k 에 federal + BC 세율 적용 후 takeHomePctApprox 계산

### 비자

- **출처**: IRCC 공식
- **URL**: https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit.html
- **자동화**: `scripts/refresh/visas.mjs` — 분기 1회. HTML fetch.

---

## 3. 토론토 (CAD)

### 임차료

- **출처**: CMHC Rental Market Survey + Statistics Canada Toronto CMA
- **자동화**: `ca_cmhc.mjs` (서울과 동일 스크립트, 도시 ID 만 다름)

### 식재료·외식

- **출처**: Statistics Canada CPI Toronto CMA
- **자동화**: `ca_statcan.mjs`

### 교통 — TTC

- **출처**: TTC fare 공식
- **URL**: https://www.ttc.ca/Fares-and-passes
- **자동화**: `ca_ttc.mjs`

### 학비

- **출처**: University of Toronto, York, Seneca 공식 international tuition
- **URL**:
  - U of T: https://studentaccount.utoronto.ca/tuition-fees/
  - York: https://sfs.yorku.ca/fees/
  - Seneca: https://www.senecapolytechnic.ca/admissions/fees-and-financial.html
- **자동화**: `universities.mjs`

### 세금

- Canada federal + Ontario provincial 정적 brackets

### 비자

- 캐나다 공통 (밴쿠버와 동일 IRCC)

---

## 4. 몬트리올 (CAD)

### 임차료·식재료·외식

- CMHC + StatCan Montreal CMA (자동화 동일)

### 교통 — STM

- **URL**: https://www.stm.info/en/info/fares
- **자동화**: `ca_stm.mjs`

### 학비

- McGill, Concordia, Université de Montréal
- McGill: https://www.mcgill.ca/student-accounts/tuition-charges
- 자동화: `universities.mjs`

### 세금

- Canada federal + Quebec provincial brackets (QC 별도 세금 시스템)

### 비자

- 캐나다 공통 + Quebec CAQ 추가 (정부 페이지 fetch)

---

## 5. 뉴욕 (USD)

### 임차료

- **출처**: **HUD Fair Market Rents** + **US Census ACS** (American Community Survey 5-year median rent)
- **API**:
  - HUD: https://www.huduser.gov/hudapi/public/fmr (키 필요 — `US_HUD_API_KEY`)
  - Census ACS: https://api.census.gov/data/2022/acs/acs5 (키 필요 — `US_CENSUS_API_KEY`)
- **자동화**: `scripts/refresh/us_hud.mjs` + `us_census.mjs` — 월 1회
- **방법**: New York-Newark-Jersey City MSA HUD FMR + ACS B25064 median gross rent

### 식재료·외식

- **출처**: **US BLS Average Retail Food Prices** + **CPI by Region**
- **API**: `https://api.bls.gov/publicAPI/v2/timeseries/data/` (키 필요 — `US_BLS_API_KEY`)
- **자동화**: `scripts/refresh/us_bls.mjs` — 주 1회
- **방법**: BLS Series ID for milk, eggs, rice, chicken, bread, onion, apple. NY 지역 우선, 부족 시 Northeast region 대체.

### 교통 — MTA

- **URL**: https://new.mta.info/fares
- **자동화**: `us_transit.mjs` — 분기 1회

### 학비

- Columbia, NYU, CUNY 공식
- Columbia: https://www.studentfinancialservices.columbia.edu/tuition-fees
- NYU: https://www.nyu.edu/admissions/tuition-and-financial-aid.html
- CUNY: https://www.cuny.edu/admissions/tuition-fees/

### 세금

- US federal + NY state + NYC city tax 정적 brackets

### 비자

- US State Department visa fees: https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/fees.html
- 자동화: `visas.mjs`

---

## 6. LA (USD)

### 임차료

- HUD FMR LA-Long Beach-Anaheim MSA + Census ACS
- 자동화: `us_hud.mjs` + `us_census.mjs`

### 식재료·외식

- BLS Western region (WA·CA 묶음)
- 자동화: `us_bls.mjs`

### 교통 — LA Metro

- URL: https://www.metro.net/riding/fares/
- 자동화: `us_transit.mjs`

### 학비

- UCLA, USC, Santa Monica College 공식
- UCLA: https://www.registrar.ucla.edu/Fees-Residence/Fee-Amounts
- USC: https://financialaid.usc.edu/tuition-costs/
- SMC: https://www.smc.edu/admission/

### 세금

- federal + CA state 정적

### 비자

- 미국 공통

---

## 7. 샌프란시스코 베이 (USD)

### 임차료

- HUD FMR San Francisco-Oakland-Hayward MSA + Census ACS

### 식재료·외식

- BLS Western region (LA 와 같은 시리즈, 도시 보정계수 다름)

### 교통 — SFMTA

- URL: https://www.sfmta.com/fares
- 자동화: `us_transit.mjs`

### 학비

- UC Berkeley, Stanford, City College of SF
- Berkeley: https://registrar.berkeley.edu/tuition-fees-residency/
- Stanford: https://financialaid.stanford.edu/undergrad/cost/

### 세금/비자

- 미국 공통 (CA state)

---

## 8. 시애틀 (USD)

### 임차료

- HUD FMR Seattle-Tacoma-Bellevue MSA + Census ACS

### 식재료·외식

- BLS Western region

### 교통 — King County Metro

- URL: https://kingcounty.gov/en/dept/metro/fares-and-payment

### 학비

- University of Washington, Seattle Central College
- UW: https://opb.washington.edu/content/tuition-fees

### 세금

- federal only (WA 는 주 소득세 없음)

### 비자

- 미국 공통

---

## 9. 보스턴 (USD)

### 임차료

- HUD FMR Boston-Cambridge-Newton MSA + Census ACS

### 식재료·외식

- BLS Northeast region (NY 와 같은 시리즈, 보정계수 약간 다름)

### 교통 — MBTA

- URL: https://www.mbta.com/fares

### 학비

- Harvard, MIT, BU, Northeastern
- Harvard: https://college.harvard.edu/financial-aid/cost-attendance
- MIT: https://sfs.mit.edu/undergraduate-students/the-cost-of-attendance/
- BU: https://www.bu.edu/admissions/tuition-aid/
- Northeastern: https://studentfinance.northeastern.edu/billing-payments/tuition-fees/

### 세금/비자

- 미국 공통 (MA state)

---

## 10. 런던 (GBP)

### 임차료

- **출처**: **ONS Private Rental Market Statistics** (UK Office for National Statistics)
- **API**: `https://api.ons.gov.uk/dataset/rentinurkmonth/editions/time-series/versions/X` (JSON, 키 불필요)
- **자동화**: `scripts/refresh/uk_ons.mjs` — 월 1회
- **방법**: London median rent by # bedrooms

### 식재료·외식

- **출처**: ONS **Consumer Price Inflation by item**
- **API**: 동일 ONS API
- **자동화**: `uk_ons.mjs`
- **방법**: COICOP 코드별 평균가 (밀크 = 01.1.4.1, 계란 = 01.1.4.7 등)

### 교통 — TfL

- **출처**: TfL Unified API (https://api.tfl.gov.uk/)
- **API**: `https://api.tfl.gov.uk/Line/Mode/tube,bus/Status` 등 + fare endpoint
- **자동화**: `uk_tfl.mjs` — 분기 1회

### 학비

- Imperial, UCL, KCL 공식
- Imperial: https://www.imperial.ac.uk/study/fees-and-funding/tuition-fees/
- UCL: https://www.ucl.ac.uk/prospective-students/undergraduate/fees-funding
- KCL: https://www.kcl.ac.uk/study/undergraduate/fees-and-funding

### 세금

- HMRC 정적 brackets (income tax + NI)

### 비자

- gov.uk visa fees: https://www.gov.uk/government/publications/visa-regulations-revised-table
- 자동화: `visas.mjs`

---

## 11. 베를린 (EUR)

### 임차료

- **출처**: **Destatis** (Federal Statistical Office) GENESIS-Online API
- **API**: `https://www-genesis.destatis.de/genesis/online`
- **자동화**: `scripts/refresh/de_destatis.mjs` — 월 1회
- **방법**: Berlin Bundesland 평균 임대료 통계

### 식재료·외식

- **출처**: Destatis CPI by item (COICOP)
- **API**: 동일 GENESIS
- **자동화**: `de_destatis.mjs`
- **방법**: 항목별 독일 평균 + Berlin 보정계수 1.0

### 교통 — BVG

- URL: https://www.bvg.de/en/tickets-fares
- 자동화: `de_transit.mjs`

### 학비

- TU Berlin, HU Berlin, FU Berlin 공식 (모두 등록비 EUR 350/학기)
- TU Berlin: https://www.tu.berlin/en/studying/courses-of-study/fees-and-financing
- 자동화: `universities.mjs`

### 세금

- 독일 federal + Berlin solidarity surcharge 정적 brackets

### 비자

- BAMF: https://www.bamf.de/EN/Themen/MigrationAufenthalt/ZuwandererDrittstaaten/zuwandererdrittstaaten-node.html
- 자동화: `visas.mjs`

---

## 12. 뮌헨 (EUR)

### 임차료

- Destatis Bavaria 평균 + Munich 보정계수 (높음)

### 식재료·외식

- Destatis CPI Germany 평균 + Munich 보정계수

### 교통 — MVV

- URL: https://www.mvv-muenchen.de/en/tickets-fares/
- 자동화: `de_transit.mjs`

### 학비

- LMU München, TU München (등록비만, 학비 무료)
- LMU: https://www.lmu.de/en/study/all-information-on-degree-programmes/student-fees-and-charges/

### 세금/비자

- 독일 공통

---

## 13. 파리 (EUR)

### 임차료

- **출처**: **INSEE** (Institut national de la statistique)
- **API**: `https://api.insee.fr/series/BDM/V1/`
- **자동화**: `scripts/refresh/fr_insee.mjs` — 월 1회
- **방법**: Paris Île-de-France region 평균 임대료

### 식재료·외식

- INSEE CPI by item
- 자동화: `fr_insee.mjs`

### 교통 — RATP

- URL: https://www.ratp.fr/en/titres-et-tarifs
- 자동화: `fr_ratp.mjs`

### 학비

- Sorbonne Université, Sciences Po, École Polytechnique
- Sorbonne: https://www.sorbonne-universite.fr/en/admissions
- Sciences Po: https://www.sciencespo.fr/students/en/cost-of-studies
- 자동화: `universities.mjs`

### 세금

- France 정적 brackets

### 비자

- France-Visas: https://france-visas.gouv.fr/
- 자동화: `visas.mjs`

---

## 14. 암스테르담 (EUR)

### 임차료

- **출처**: **CBS** (Centraal Bureau voor de Statistiek)
- **API**: `https://opendata.cbs.nl/ODataApi/odata/`
- **자동화**: `scripts/refresh/nl_cbs.mjs` — 월 1회
- **방법**: Amsterdam 평균 임대료

### 식재료·외식

- CBS CPI

### 교통 — GVB

- URL: https://en.gvb.nl/abonnementen
- 자동화: `nl_gvb.mjs`

### 학비

- UvA, VU Amsterdam, Amsterdam UAS 공식
- UvA: https://www.uva.nl/en/education/fees-and-finance/tuition-fees/

### 세금

- Belastingdienst 정적 brackets (30% ruling 별도 노트)

### 비자

- IND 공식: https://ind.nl/en/Pages/Costs.aspx

---

## 15. 시드니 (AUD)

### 임차료

- **출처**: **ABS** (Australian Bureau of Statistics) Residential Property Price Indexes + NSW Family & Community Services Rent and Sales Report
- **API**: `https://api.data.gov.au/` + `https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation`
- **자동화**: `scripts/refresh/au_abs.mjs` — 월 1회
- **방법**: Sydney median weekly rent × 4.33 (월 환산)

### 식재료·외식

- ABS CPI Sydney
- 자동화: `au_abs.mjs`

### 교통 — Transport NSW

- URL: https://transportnsw.info/tickets-opal/opal/fares
- 자동화: `au_transit.mjs`

### 학비

- USyd, UNSW, Macquarie
- USyd: https://www.sydney.edu.au/students/student-fees.html
- UNSW: https://www.unsw.edu.au/study/how-to-apply/fees
- 자동화: `universities.mjs`

### 세금

- ATO 정적 brackets

### 비자

- Department of Home Affairs: https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing
- 자동화: `visas.mjs`

---

## 16. 멜버른 (AUD)

### 임차료·식재료·외식

- ABS Melbourne CMA (시드니와 같은 스크립트, 도시 ID만 다름)

### 교통 — PTV

- URL: https://www.ptv.vic.gov.au/tickets/myki-fares/
- 자동화: `au_transit.mjs`

### 학비

- UniMelb, Monash, RMIT
- UniMelb: https://study.unimelb.edu.au/how-to-apply/international-fees
- Monash: https://www.monash.edu/fees/international
- RMIT: https://www.rmit.edu.au/study-with-us/international-students/applying-to-rmit-international-students/fees

### 세금/비자

- 호주 공통

---

## 17. 도쿄 (JPY)

### 임차료

- **출처**: **e-Stat (政府統計)** 住宅・土地統計調査 + 都道府県別民営賃貸住宅平均賃料
- **API**: `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData` (`JP_ESTAT_APP_ID` 필요)
- **자동화**: `scripts/refresh/jp_estat.mjs` — 월 1회
- **방법**: 東京都 23구 평균 임대료

### 식재료·외식

- e-Stat 消費者物価指数 (CPI Tokyo)
- 자동화: `jp_estat.mjs`

### 교통 — JR + 도쿄메트로

- URL: 도쿄메트로 https://www.tokyometro.jp/en/ticket/, JR https://www.jreast.co.jp/e/
- 자동화: `jp_transit.mjs`

### 학비

- 東京大学, 早稲田, 慶應
- 東大: https://www.u-tokyo.ac.jp/en/prospective-students/admission_fees.html
- 早稲田: https://www.waseda.jp/inst/admission/en/
- 慶應: https://www.keio.ac.jp/en/admissions/

### 세금

- 国税庁 정적 brackets (소득세 + 주민세)

### 비자

- 외무성: https://www.mofa.go.jp/j_info/visit/visa/short/novisa.html
- 자동화: `visas.mjs`

---

## 18. 오사카 (JPY)

### 임차료·식재료·외식

- e-Stat 大阪府 CMA (도쿄와 같은 스크립트)

### 교통 — 大阪Metro

- URL: https://subway.osakametro.co.jp/en/guide/page/fare.php
- 자동화: `jp_transit.mjs`

### 학비

- 大阪大学, 京大, 関西学院
- 阪大: https://www.osaka-u.ac.jp/en/admissions/tuition_fees
- 京大: https://www.kyoto-u.ac.jp/en/admissions/

### 세금/비자

- 일본 공통

---

## 19. 싱가포르 (SGD)

### 임차료

- **출처**: **SingStat** (Singapore Department of Statistics) Rental Index
- **API**: `https://tablebuilder.singstat.gov.sg/api/table/tabledata/<resourceId>`
- **자동화**: `scripts/refresh/sg_singstat.mjs` — 월 1회
- **방법**: HDB rental + private property rental 평균

### 식재료·외식

- SingStat CPI by item
- 자동화: `sg_singstat.mjs`
- **특수**: hawker centre 가격은 별도 정적 추정 (CPI 의 "Hawker food" 카테고리 사용)

### 교통 — LTA

- URL: https://www.lta.gov.sg/content/ltagov/en/getting_around/public_transport/fares_payment_methods.html
- API: `https://datamall.lta.gov.sg/` (LTA DataMall, 키 필요)
- 자동화: `sg_lta.mjs`

### 학비

- NUS, NTU, SMU 공식
- NUS: https://www.nus.edu.sg/oam/admissions/international/applying/fees

### 세금

- IRAS 정적 brackets (낮음 — 0~22%)

### 비자

- ICA: https://www.ica.gov.sg/enter-transit-depart/entering-singapore
- 자동화: `visas.mjs`

---

## 20. 호치민 (VND)

### 임차료·식재료·외식

- **출처**: **GSO** (General Statistics Office of Vietnam)
- **URL**: https://www.gso.gov.vn/en/
- **API**: 제한적 (CSV 다운로드 위주). 영문 부족.
- **자동화**: `scripts/refresh/vn_gso.mjs` — 월 1회 best-effort
- **한계**: 도시별 입자도 거침. Hồ Chí Minh City 단위 데이터 일부 부재.
- **fallback**: 부재 시 기본값 + sources 에 "estimated, GSO 도시 단위 데이터 부재" 마커

### 교통

- 호치민시 공식: https://hochiminhcity.gov.vn/
- HTML fetch (영문 일부) + 정적 보완

### 학비

- VNU-HCMC, RMIT Vietnam, Fulbright
- VNU: https://en.vnuhcm.edu.vn/admissions/
- RMIT: https://www.rmit.edu.vn/study-at-rmit/fees-scholarships
- 자동화: `universities.mjs`

### 세금

- General Department of Taxation (Vietnam) 정적 brackets

### 비자

- Vietnam Immigration Department: https://immigration.gov.vn/en/
- 자동화: `visas.mjs`

---

## 21. 두바이 (AED)

### 임차료

- **출처**: **DSC** (Dubai Statistics Center) + **RERA** (Real Estate Regulatory Agency) Rent Index
- **URL**:
  - DSC: https://www.dsc.gov.ae/en-us/
  - RERA: https://dubailand.gov.ae/en/eservices/rental-index/
- **API**: 제한적 (CSV)
- **자동화**: `scripts/refresh/ae_fcsc.mjs` — 월 1회 (DSC + FCSC 통합)

### 식재료·외식

- **출처**: **FCSC** (UAE Federal Competitiveness and Statistics Centre) CPI
- **URL**: https://fcsc.gov.ae/en-us/
- **자동화**: `ae_fcsc.mjs`

### 교통 — RTA

- URL: https://www.rta.ae/wps/portal/rta/ae/home/fares-and-payment
- 자동화: `ae_rta.mjs`

### 학비

- AUD (American University in Dubai), University of Wollongong Dubai (선택)
- AUD: https://www.aud.edu/admissions/tuition-fees/
- 자동화: `universities.mjs`

### 세금

- N/A (UAE 개인소득세 0%)

### 비자

- UAE Government Portal: https://u.ae/en/information-and-services/visa-and-emirates-id
- 자동화: `visas.mjs`

---

## 부록 A — 자동화 스크립트 매핑

| 도시       | 임차료           | 식재료·외식     | 교통           | 학비         | 세금   | 비자  |
| ---------- | ---------------- | --------------- | -------------- | ------------ | ------ | ----- |
| 서울       | kr_molit         | kr_kca·kr_kosis | kr_seoul_metro | N/A          | N/A    | N/A   |
| 밴쿠버     | ca_cmhc          | ca_statcan      | ca_translink   | universities | static | visas |
| 토론토     | ca_cmhc          | ca_statcan      | ca_ttc         | universities | static | visas |
| 몬트리올   | ca_cmhc          | ca_statcan      | ca_stm         | universities | static | visas |
| 뉴욕       | us_hud·us_census | us_bls          | us_transit     | universities | static | visas |
| LA         | us_hud·us_census | us_bls          | us_transit     | universities | static | visas |
| SF Bay     | us_hud·us_census | us_bls          | us_transit     | universities | static | visas |
| 시애틀     | us_hud·us_census | us_bls          | us_transit     | universities | static | visas |
| 보스턴     | us_hud·us_census | us_bls          | us_transit     | universities | static | visas |
| 런던       | uk_ons           | uk_ons          | uk_tfl         | universities | static | visas |
| 베를린     | de_destatis      | de_destatis     | de_transit     | universities | static | visas |
| 뮌헨       | de_destatis      | de_destatis     | de_transit     | universities | static | visas |
| 파리       | fr_insee         | fr_insee        | fr_ratp        | universities | static | visas |
| 암스테르담 | nl_cbs           | nl_cbs          | nl_gvb         | universities | static | visas |
| 시드니     | au_abs           | au_abs          | au_transit     | universities | static | visas |
| 멜버른     | au_abs           | au_abs          | au_transit     | universities | static | visas |
| 도쿄       | jp_estat         | jp_estat        | jp_transit     | universities | static | visas |
| 오사카     | jp_estat         | jp_estat        | jp_transit     | universities | static | visas |
| 싱가포르   | sg_singstat      | sg_singstat     | sg_lta         | universities | static | visas |
| 호치민     | vn_gso           | vn_gso          | static         | universities | static | visas |
| 두바이     | ae_fcsc          | ae_fcsc         | ae_rta         | universities | N/A    | visas |

## 부록 B — 자동화 한계 명시 매트릭스

| 도시·항목               | 자동화 가능? | 한계                                                   |
| ----------------------- | ------------ | ------------------------------------------------------ |
| 호치민 임차료           | ⚠️ 부분      | GSO 도시별 데이터 부재 → "estimated" 마커              |
| 호치민 외식             | ⚠️ 부분      | 동일                                                   |
| 두바이 학비             | ⚠️ 부분      | DSC 데이터 부재 → AUD/Wollongong 공식만                |
| 모든 도시 외식 1끼      | ⚠️ 보정      | CPI 평균값 + 정적 보정계수. 실제 식당 가격 추정.       |
| 모든 도시 세금          | ✅ 정적      | 연 1회 brackets 갱신 (`data/static/tax_brackets.json`) |
| 호치민·두바이 비자 영문 | ⚠️ 부분      | 영문 정보 제한 → 추정 + 마커                           |

위 한계는 모두 sources 배열에 "static", "estimated", "manual-fallback" 마커로 표기하여 사용자에게 투명하게 노출.

## 부록 C — 환율 fallback chain (재확인)

ADR-026 에 따라 3단계:

1. open.er-api.com (클라이언트, 일별)
2. ECB Exchange Rates (자동 백업)
3. 한국은행 환율 (`scripts/refresh/fx_backup.mjs` 가 분기별 갱신, `data/fx_fallback.json`)
