[← ADR 인덱스](../ADR.md)

# ADR-076: 출처 표기 의무 보완 — ER-API 링크 · TfL 출처명 정정 · CMHC → StatCan 전환

**상태:** 채택 (2026-09-16)

**맥락:**

앱에 광고를 도입하면서(별도 ADR-077 예정) 21개 도시 데이터 출처·환율 API 의 약관을
다시 대조했다. 결론은 **공공 출처는 전부 상업 이용을 허용**한다는 것이었다 — 광고
자체가 약관과 충돌하지 않는다. 다만 광고와 **무관하게 이미 미충족인 표기 의무 3건**이
드러났고, 앱이 상업 앱이 되면 이 결함의 무게가 커진다. 그래서 광고보다 먼저 고친다.

1. **ER-API 링크 없음.** 환율 1차 출처 open.er-api.com 은 무료 endpoint 약관이
   `Rates By Exchange Rate API` 링크 표기를 **필수**로 요구한다. 앱 어디에도 없다.
2. **TfL 출처명이 사실과 다름.** `data/cities/london.json` 의 transport 출처명은
   `TfL Unified API + static estimates` 였다. 그러나 `scripts/refresh/uk_tfl.mjs` 는
   Unified API 를 `checkTflApiStatus()` 의 **운행 상태 연결 확인**에만 쓰고, 실제
   운임값은 `STATIC_TRANSPORT` 정적 상수다. API 데이터를 쓰지 않으므로 TfL Transport
   Data Service 약관의 `Powered by TfL Open Data` 의무는 애초에 **발생하지 않는다**.
   문제는 의무 미이행이 아니라 **우리가 쓴 출처명이 거짓**이라는 점이다.
3. **CMHC 출처 URL 이 금지 약관 쪽을 가리킴.** `scripts/refresh/ca_cmhc.mjs` 는
   데이터를 **StatCan WDS 벡터 API** 로 받으면서 출처 URL 은 CMHC 포털을 가리켰다.
   CMHC 포털 약관은 **상업 파생물을 금지**한다. 반면 우리가 실제로 경유하는 StatCan
   은 Open Licence 로 상업 이용을 허용하며 `Adapted from Statistics Canada, <product>`
   형식의 인용만 요구한다. 출처를 StatCan 표 34-10-0133-01 로 옮겨야 우리가 실제로
   기대는 라이선스와 표기가 일치한다.

부수적으로 `docs/DATA.md` §3.1 "사용 가능한 출처" 표에 **SUUMO** 가 남아 있었다.
스크립트 어디에도 사용처가 없고(grep 0건), ADR-032 가 금지하는 상업 플랫폼이다.

**결정:**

1. **ER-API 링크** — `/sources` 화면 푸터에 `Rates By Exchange Rate API` 링크를
   추가한다. 문구는 약관이 요구하는 **원문 그대로** 두고 번역하지 않는다. 환율
   데이터가 없거나 fallback(baseline) 만 쓰는 상황에도 1차 소스는 ER-API 이므로
   링크는 **항상** 표시한다. (구현은 `source-attribution` phase step 1.)
2. **TfL 출처명** — `TfL 운임 안내 페이지 (정적 추정치)` / `https://tfl.gov.uk/fares/`
   로 정정한다. 출처명에서 API 표기를 삭제하고 값이 정적 추정치임을 명시한다.
   `checkTflApiStatus()` 는 **유지**한다 — 연결 확인 기능이지 데이터 출처가 아니다.
3. **CMHC → StatCan** — 출처명을
   `Adapted from Statistics Canada, Table 34-10-0133-01 (CMHC 평균 월세 · share 는 studio×0.65 추정)`,
   URL 을 `https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410013301` 로 바꾼다.
   Open Licence 가 요구하는 인용 문구를 출처명에 그대로 담고, reference date 는 화면의
   `접속일 YYYY-MM-DD` 가 대신한다. 내부 ADR 번호(`ADR-059`)는 사용자 화면에서 뺀다.
4. 2·3 의 이름 이전은 **`legacyNames` + `hasLegacySourceName()`** 로 자동화 경로
   안에서 완결한다 (ADR-070 기전). 도시 JSON 직접 편집 금지 (ADR-032).
5. `docs/DATA.md` §3.1 에서 **SUUMO** 를 삭제하고, §9 에 "출처별 라이선스 요약"
   소절을 추가해 출처 / 상업 이용 / 요구 표기를 한 표로 모은다.

**대안 (기각):**

- **TfL 출처명 유지 + `Powered by TfL Open Data` 표기 추가** — 쓰지도 않는 API 를
  썼다고 표기하는 셈이라 거짓이 하나 더 는다. 의무는 발생하지 않았다.
- **CMHC 포털에서 직접 수신으로 전환** — 포털 약관이 상업 파생물을 금지하므로
  광고 도입과 정면 충돌한다. 이미 StatCan 으로 받고 있으니 표기만 맞추면 된다.
- **출처명 전반의 ADR 번호·계산식 노출을 이번에 함께 정리** — HUD·StatCan CPI·BLS
  3종이 더 있으나 약관 의무와 무관한 문구 품질 부채다. 범위를 섞지 않고 분리한다.

**결과 / 영향:**

- `data/cities/london.json` transport 출처명 교체. **운임 숫자는 무변경**
  (`--useStatic`, `STATIC_TRANSPORT` 그대로).
- `data/cities/{vancouver,toronto,montreal}.json` rent 출처명·URL 교체 — 단, 아래
  "후속" 의 벡터 결함 때문에 **데이터 반영은 보류**된다. 스크립트 쪽 결정은 확정이다.
- `/sources/[cityId]` 상세 화면에 노출되는 출처명이 바뀐다.
- `/sources` 푸터에 ER-API 링크가 생긴다 (step 1).

**후속 (이 결정의 범위 밖 — 별도 처리 필요):**

- **`ca_cmhc.mjs` 의 StatCan 벡터 ID 가 잘못돼 있다.** `v111426660` 등 9개 벡터는
  표 34-10-0133-01 이 아니라 **product 36100480**
  ("Labour productivity …, inactive" — ARCHIVED) 에 속하며 2019~2024 전 구간
  `value: null` 이다. 즉 이 fetcher 는 도입 이래 한 번도 값을 가져온 적이 없고,
  월 1회 `refresh-rent.yml` cron 은 매번 `updated 0 cities` 로 조용히 끝났다.
  현재 3개 도시의 rent 숫자는 초기 시드값이다. `No rent data found` 분기에서
  `continue` 하므로 본 ADR 의 출처명 이전도 데이터에 닿지 못한다. 올바른 벡터
  재매핑은 rent 숫자 자체를 바꾸는 데이터 결정이라 별도 ADR·phase 로 처리한다.
- 출처명 전반의 ADR 번호·계산식 노출 정리 (HUD·StatCan CPI·BLS 3종).

**검증:**

- `scripts/refresh/__tests__/uk_tfl.test.ts` — `SOURCE.name`/`url` 정확 일치,
  이름에 `API` 미포함, `legacyNames` 에 구 이름 포함, 값 변동 0 + 구 이름 잔존 시
  1회 이전 후 재실행 no-op.
- `scripts/refresh/__tests__/ca_cmhc.test.ts` — 동일 4종. URL 이 `cmhc-schl.gc.ca`
  미포함, 이름에 `ADR-` 미포함.
- `grep -c 'SUUMO' docs/DATA.md` = 0.

**참고:**

- ExchangeRate-API 무료 endpoint 약관: https://www.exchangerate-api.com/docs/free
- TfL Transport Data Service 약관: https://tfl.gov.uk/corporate/terms-and-conditions/transport-data-service
- Statistics Canada Open Licence: https://www.statcan.gc.ca/en/reference/licence
- StatCan 표 34-10-0133-01: https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410013301

**관련:** ADR-032 (공공 출처 100% 자동화), ADR-059 (자동화 추정·보정),
ADR-070 (출처명 언어 정책 + `legacyNames`), ADR-071 (출처 URL 도시별 실제화),
`docs/plans/admob-banner-ads.md` §A, `docs/AUTOMATION.md` §3·§8.
