[← ADR 인덱스](../ADR.md)

# ADR-085: refresh-rent — `us_hud` Bearer 토큰 인증 + 실행 시각 14:00 UTC

**상태:** 채택 (2026-11-27)

**맥락:**

`refresh-rent.yml` 은 2026-05-04 도입 이후 7번 실행됐고 한 번도 성공하지 못했다.
6~9월은 리포 설정(Actions 의 PR 생성 권한) 때문에, 10월부터는 아래 두 fetcher 때문에 실패했다.

1. **`us_hud` — 코드 결함.** HUD User API 는 계정에서 발급한 access token 을
   `Authorization: Bearer` 헤더로 요구한다. fetcher 는 헤더 없이 호출했고, 파일 주석과
   워크플로 주석에는 "API 키 불필요"라고 적혀 있었다. Actions 로그(9/1~11/8, 4건)는 5개 도시 모두
   `HTTP 401` 이다. 설계 문서(`DATA_SOURCES.md`, `DATA.md` §13.5.5)는 `US_HUD_API_KEY` 를
   요구했는데 구현과 `AUTOMATION.md` §5 에서 빠졌다. ADR-078·079 의 게이트가 들어온 뒤로 이 실패가
   매달 빨간불로 보였다.
2. **`ca_cmhc` — 실행 시각.** StatCan WDS 는 미 동부 기준 00:00~08:30 에 일부 메서드가 데이터를
   주지 않는다 (HTTP 409/503, WDS 사용자 가이드 Availability 절). cron `0 9 1 * *` (09:00 UTC =
   04:00 EST / 05:00 EDT) 은 이 구간 한가운데다. 2026-11-08 수동 실행(02:18 EST)에서 3개 도시가
   503 으로 실패했다. 정기 실행은 GitHub 가 1.5~7시간 늦게 시작해서 대부분 구간을 벗어났을 뿐이다.

**결정:**

1. `us_hud.mjs` 는 `US_HUD_API_KEY` 를 읽어 `Authorization: Bearer` 헤더로 보낸다. 키가 없으면
   fetch 전에 `MissingApiKeyError` 를 던진다 (`us_census` 와 같은 패턴).
2. `refresh-rent.yml` 은 secret 을 job env 로 넘기고, 키가 없으면 실행 step 을 skip 하고 안내 step 이
   `::warning::` 을 남긴다 (AUTOMATION.md §4.5c). 키 등록 전에도 `us_hud` 때문에 게이트가
   빨간불이 되지 않는다.
3. refresh-rent cron 을 `0 14 1 * *` (14:00 UTC = 23:00 KST = 09:00 EST / 10:00 EDT) 로 옮긴다.
   서머타임 여부와 관계없이 점검 구간 밖이고, 관찰된 지연(최대 7시간)을 더해도 다음 구간 전에
   끝난다. 수동 실행도 점검 구간(KST 14:00~22:30, 서머타임 13:00~21:30)을 피하도록 문서에 적는다.

**대안:**

- **Census ACS `B25031` 로 HUD 대체** — 5년 추정치라 시차가 크고 재구현 범위가 크다. 기각.
- **us_hud step 을 경고로 낮추기 (키 없이 실행 + 실패 무시)** — 결함이 조용히 숨는다. ADR-078 의
  `ca_cmhc` 전례와 같은 실패. 기각.
- **409/503 에 더 길게 재시도** — `fetchWithRetry` 는 409 를 재시도하지 않고, 점검 구간은 8시간이라
  재시도로 넘길 수 없다. 시각을 옮기는 쪽이 작고 확실하다. 필요하면 별도로 다룬다.
- **prices cron (`0 9 * * 1`) 도 이동** — 같은 구간이지만 `ca_statcan` 실시간 경로가 ADR-082 로 꺼져
  있어 지금은 영향이 없다. 이 ADR 범위 밖.

**결과:**

- 토큰이 등록되기 전까지 `us_hud` 는 skip + 경고다. 미국 5개 도시 rent 는 그동안 5월 초기값 그대로다.
- **남은 검증:** 토큰 등록 뒤 수동 실행 1회로 실제 응답을 확인한다. SF·시애틀·보스턴은 HUD 가 MSA 를
  HMFA 로 나누는 지역이라 `entityId` 가 다를 수 있고, Small Area FMR 지역은 `basicdata` 가 우편번호
  배열로 올 수 있다 (`parseHudResponse` 는 객체만 처리). 파서·`entityId` 는 실제 응답을 본 뒤 따로
  고친다.
- 첫 성공 실행은 5월 추정값과 차이가 커서 outlier PR 이 생길 가능성이 크다. 값을 검토한 뒤 병합한다.
