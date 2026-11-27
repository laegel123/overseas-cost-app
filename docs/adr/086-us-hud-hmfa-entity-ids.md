[← ADR 인덱스](../ADR.md)

# ADR-086: `us_hud` — 도시 중심 HMFA 코드 + Small Area FMR 의 `MSA level` 행

**상태:** 채택 (2026-11-27)

**맥락:**

ADR-085 로 `Authorization: Bearer` 토큰을 붙인 뒤 첫 수동 실행(Actions run `45923660387`)에서
5개 도시 모두 `HTTP 404` 였다 (응답 본문 `{"error":"No data found for the entityid"}`). 토큰이 없던
이전 실행은 같은 주소가 401 이었으니 인증은 통과했고, 요청한 지역 코드가 틀렸다.

fetcher 는 MSA 코드 `METRO{CBSA}M{CBSA}` (예: `METRO35620M35620`) 를 썼다. HUD 는 한국 IP 의
`/hudapi/` 요청을 막아(403) Actions 진단 실행(`45924160488`, `45924310393`)으로 실제 응답을 확인했다.

- `GET /fmr/listMetroAreas` (639개) 에 5개 MSA 코드가 없다. HUD 는 5개 MSA 를 모두 하위 FMR 지역
  (HUD Metro FMR Area, HMFA) 으로 나누고, 코드는 `METRO{CBSA}MM{4자리}` 형식이다.
- 성공 응답은 두 형식이다.
  - 일반 FMR 지역 (뉴욕·SF·보스턴): `data.basicdata` 가 객체
    `{Efficiency, One-Bedroom, ..., Four-Bedroom, year}`. 값은 문자열이 아니라 숫자다.
  - Small Area FMR 지역 (`data.smallarea_status: "1"` — LA·시애틀): `data.basicdata` 가 우편번호별 행
    배열이다 (LA 475행, 시애틀 154행). 첫 행이 `zip_code: "MSA level"` 이고, 그 값은
    `GET /fmr/statedata/{CA,WA}` 가 주는 같은 HMFA 의 FMR (`FMR Percentile: 40`) 과 같다.
    연도는 `data.year`.
- `year` 를 지정하지 않으면 최신 회계연도(현재 FY2027) 가 온다. `?year=2025|2026|2027` 도 200.

기존 `parseHudResponse` 는 `basicdata` 를 객체로만 다뤄 LA·시애틀 응답에서 값을 못 찾는다.
테스트 fixture 는 손으로 만든 문자열 값이라 실제 응답으로 검증된 적이 없었다.

**결정:**

1. 도시마다 도시 중심 HMFA 코드를 쓴다 (`listMetroAreas` 확인값).

   | 도시    | entityId           | HUD 지역명                                             | 포함 카운티                                                      |
   | ------- | ------------------ | ------------------------------------------------------ | ---------------------------------------------------------------- |
   | nyc     | `METRO35620MM5600` | New York, NY HUD Metro FMR Area                        | Bronx·Kings·New York·Putnam·Queens·Richmond·Rockland·Westchester |
   | la      | `METRO31080MM4480` | Los Angeles-Long Beach-Glendale, CA HUD Metro FMR Area | Los Angeles (SAFMR)                                              |
   | sf      | `METRO41860MM7360` | San Francisco, CA HUD Metro FMR Area                   | Marin·San Francisco·San Mateo                                    |
   | seattle | `METRO42660MM7600` | Seattle-Bellevue, WA HUD Metro FMR Area                | King·Snohomish (SAFMR)                                           |
   | boston  | `METRO14460MM1120` | Boston-Cambridge-Quincy, MA-NH HUD Metro FMR Area      | Essex·Middlesex·Norfolk·Plymouth·Suffolk (MA)·Rockingham (NH)    |

2. `basicdata` 가 배열이면 `zip_code === "MSA level"` 행만 쓴다 (순서에 기대지 않음). 그 행이 없으면
   null 을 돌려 `No rent data found in HUD response` 오류가 된다. 우편번호 행 값으로 대체하지 않는다.
3. `year` 는 지정하지 않는다. HUD 가 새 회계연도를 내면 다음 실행에서 자동 반영된다 (ADR-032).

**대안:**

- **MSA 전체 값 (HMFA 여러 개의 평균·가중)** — HUD 는 분할된 MSA 의 단일 FMR 을 내지 않는다. 가중치
  자료가 따로 필요하고 교외(뉴저지·오클랜드·타코마 등) 가 섞인다. 기각.
- **SAFMR 우편번호 값 (특정 우편번호·중앙값)** — 도시 경계와 우편번호를 손으로 맞춰야 한다
  (ADR-032 수동 큐레이션 금지). 다른 3개 도시와 기준도 달라진다. 기각.
- **연도 고정** — 매년 코드를 바꿔야 한다. 기각.

**결과:**

- 5개 도시 rent 가 2026-05 초기값에서 HUD FY2027 값으로 바뀐다 (share 는 계속 studio × 0.65 추정,
  ADR-059). 값은 40백분위 FMR 이라 중앙값인 `censusMedian` 과 기준이 다르다.
- 뉴욕은 뉴저지 쪽 HMFA, SF 는 오클랜드-프리몬트 HMFA, 시애틀은 타코마 HMFA 를 포함하지 않는다.
  `DATA_SOURCES.md` 의 MSA 표기를 HMFA 로 고친다.
- HUD 가 HMFA 를 다시 나누거나 코드를 바꾸면 404 로 드러난다 (`fetchWithRetry` 4xx 즉시 실패 →
  도시별 errors → 게이트 빨간불).
