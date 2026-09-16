[← ADR 인덱스](../ADR.md)

# ADR-078: 캐나다 3도시 rent 벡터 재매핑 — 표 34-10-0133-01 `Apartment 6+`

**상태:** 채택 (2026-09-16)

**맥락:**

`scripts/refresh/ca_cmhc.mjs` 는 밴쿠버·토론토·몬트리올의 `rent` 를 StatCan WDS
벡터 API 로 받는다. **이 fetcher 가 쓰던 벡터 ID 9개가 전부 잘못된 표를 가리켰다.**

`getSeriesInfoFromVector` 실호출로 확인한 사실:

- `v111426660` 은 productId **36100480** 의
  `"Northwest Territories including Nunavut;Labour productivity;Engineering construction"` 이다.
  임차료가 아니라 **노동생산성** 시리즈이고, 해당 테이블은 **ARCHIVED** 이며
  2019~2024 전 구간 `value: null` 이다. 나머지 8개도 같은 product 소속이다.
- 그 결과 API 는 HTTP 200 `SUCCESS` 를 돌려주지만 값이 비어
  `parseStatCanResponse` 가 빈 Map 을 만들고, `refresh()` 는 3개 도시 모두
  `No rent data found in StatCan response` 로 끝난다.

즉 **이 fetcher 는 도입 이래 한 번도 값을 가져온 적이 없다.** 월 1회
`refresh-rent.yml` cron 은 매번 `updated 0 cities` 로 조용히 끝나왔고, 현재 3개
도시의 rent 숫자는 초기 시드값이다. 응답이 `SUCCESS` 라 네트워크 오류로도 보이지
않았고, `continue` 분기가 도시 단위 에러만 남겨 워크플로우는 계속 녹색이었다.

ADR-076 이 `SOURCE` 를 CMHC 포털에서 StatCan 표 **34-10-0133-01** 로 옮겼으나,
같은 ADR 의 "후속" 절이 밝혔듯 벡터 결함 때문에 그 출처명 이전조차 데이터에 닿지
못했다. `SOURCE.url` 이 이미 가리키는 34-10-0133-01
(`Canada Mortgage and Housing Corporation, average rents for areas with a
population of 10,000 and over`) 이 올바른 표이고, 이 표는 `CURRENT` 이며 최신
참조기간은 `2025-01-01` 이다.

**결정:**

1. **표 34-10-0133-01 의 `Apartment structures of six units and over` 기준 벡터로
   재매핑한다.**

   | 도시 | geo | bachelor | oneBed | twoBed |
   | --- | --- | --- | --- | --- |
   | vancouver | 184 | `v3824445` | `v3824633` | `v3824821` |
   | toronto | 125 | `v3824443` | `v3824631` | `v3824819` |
   | montreal | 46 | `v3824429` | `v3824617` | `v3824805` |

   좌표는 `<geo>.4.<unit>.0.0.0.0.0.0.0` (structure=4 = Apartment 6+, unit:
   bachelor=1 / oneBed=2 / twoBed=3). 9개 모두 `getSeriesInfoFromVector` 로
   `SeriesTitleEn` 의 도시·structure·unit 일치를 확인했다.

   structure 3종(`Apartment 3+` / `Row and apartment 3+` / `Apartment 6+`) 의 값
   차이는 0~5% 로 작다. **6+** 를 택한 이유는 CMHC 표준 보도 기준이고, 도심 아파트
   임차 실상(우리 사용자가 비교하려는 대상)에 가장 가깝기 때문이다.

2. **재매핑 직후의 대폭 변동은 이상치가 아니라 최초 정상화다.** 실측 dry-run 결과
   3개 도시 rent 가 −9.8% ~ −45.4% 변동한다. `docs/AUTOMATION.md` §6 의 OUTLIER
   임계치(≥30%)를 넘지만, 이는 시세 급변이 아니라 **시드값 → 실제 공공통계값**
   1회 교체다. 사람이 근거를 확인하고 1회 반영한다 (`ca-rent-vectors` phase step 1).
   이후의 변동은 통상 임계치 규칙(§6)을 그대로 따른다.

3. **`share` 는 `studio × 0.65` 추정을 유지한다.** CMHC 는 share(룸셰어) 임대료를
   직접 제공하지 않는다. ADR-059 의 추정 결정을 그대로 계승한다.

`SOURCE` 상수는 **수정하지 않는다** — ADR-076 이 확정한 값이고 이미 표
34-10-0133-01 을 정확히 가리킨다. `_common.mjs` 의 `parseStatCanResponse()` 도
수정하지 않는다 — 응답의 `object.vectorId` 로 Map 을 만들어 배치 응답 순서에
의존하지 않으므로 결함은 벡터 ID 에만 있었다.

**대안 (기각):**

- **`Apartment structures of three units and over` (structure=2) 채택** — 표본이
  넓지만 3~5세대 저층 건물이 섞여 도심 아파트 임차 실상에서 멀어진다. CMHC 보도
  기준도 아니다. 값 차이가 0~5% 에 불과해 이득도 작다.
- **CMHC 포털에서 직접 수신** — 포털 약관이 상업 파생물을 금지한다 (ADR-076).
- **벡터 대신 좌표(`getDataFromCubePidCoordAndLatestNPeriods`) 로 호출** — 좌표는
  자기설명적이지만 호출 수가 도시×unit 만큼 늘고, 기존 배치 벡터 호출 1회 구조를
  바꿔야 한다. 좌표는 주석으로 남겨 검증 가능성만 확보한다.

**결과 / 영향:**

- 3개 도시 rent 가 시드값 대비 **10~45% 하락**한다 (몬트리올이 가장 큼).
  앱이 캐나다 생활비를 과대 표시해 온 것이 교정된다.
- `refresh-rent.yml` cron 이 실제로 동작하기 시작한다 — 이후 매월 CMHC 최신값이
  반영된다.
- 데이터 재생성은 자동화 경로로만 수행한다 (ADR-032). 도시 JSON 직접 편집 금지.

**재발 방지:**

- `_run.mjs` 가 **"대상 전부 실패"** 를 exit 1 로 구분하게 한다
  (`ca-rent-vectors` phase step 2). 지금 구조에서는 모든 도시가 실패해도
  워크플로우가 성공으로 끝나 결함이 수개월간 보이지 않았다.
- 테스트로 벡터 9개를 `toBe` 고정하고, 폐기 접두사 `v1114266` 이 `CITY_CONFIGS`
  어디에도 없음을 회귀 차단한다.

**검증:**

- `scripts/refresh/__tests__/ca_cmhc.test.ts` — 벡터 9개 정확 일치,
  `v1114266` 접두사 부재, 벡터 9개 고유성. 기존 `mapToRent`·멱등성·`legacyNames`
  이전 테스트는 새 벡터 fixture 로 갱신 후 그대로 통과.
- `getSeriesInfoFromVector` 실호출 — 9개 전부 `SUCCESS` · `productId 34100133` ·
  `SeriesTitleEn` 의 도시·`Apartment structures of six units and over`·unit 일치.
- `refresh({ dryRun: true })` 실호출 — `errors: []`, 3개 도시 전부 값 수신.

**참고:**

- StatCan 표 34-10-0133-01: https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410013301
- Statistics Canada Open Licence: https://www.statcan.gc.ca/en/reference/licence

**관련:** ADR-032 (공공 출처 100% 자동화), ADR-059 (자동화 추정·보정 —
`share = studio × 0.65`), ADR-070 (`legacyNames` 이름 이전),
ADR-076 (출처 표기 의무 보완 — 이 결함을 "후속" 으로 식별),
`docs/AUTOMATION.md` §3·§6, `phases/ca-rent-vectors/`.
