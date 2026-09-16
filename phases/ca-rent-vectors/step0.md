# Step 0: vectors-remap

## 배경

`scripts/refresh/ca_cmhc.mjs` 는 밴쿠버·토론토·몬트리올의 `rent` 를 StatCan WDS 에서 받아 갱신하는 fetcher 다. **이 fetcher 가 쓰는 벡터 ID 9개가 전부 잘못된 표를 가리킨다.**

확인된 사실 (StatCan WDS `getSeriesInfoFromVector` 실호출 결과):

- `v111426660` 은 productId **36100480** 의 `"Northwest Territories including Nunavut;Labour productivity;Engineering construction"` 이다. 임차료가 아니라 **노동생산성** 시리즈이고, 해당 테이블은 **ARCHIVED** 이며 2019~2024 전 구간 `value: null` 이다.
- 그 결과 API 는 HTTP 200 `SUCCESS` 를 돌려주지만 값이 비어 `refresh()` 가 3개 도시 모두 `No rent data found in StatCan response` 로 끝난다.
- **이 fetcher 는 도입 이래 한 번도 값을 가져온 적이 없다.** 월 1회 `refresh-rent.yml` cron 은 매번 `updated 0 cities` 로 조용히 끝나왔고, 현재 3개 도시의 rent 숫자는 초기 시드값이다.

올바른 표는 `SOURCE.url` 이 이미 가리키고 있는 **34-10-0133-01** (`Canada Mortgage and Housing Corporation, average rents for areas with a population of 10,000 and over`) 이다. 이 표는 `CURRENT` 이고 최신 참조기간은 `2025-01-01` 이다.

이 phase 는 3 step 이다. **이 step 은 0번만 구현한다:**

0. **(이 step)** 벡터 ID 9개 재매핑 + 테스트 + ADR-078
1. 자동화 경로로 데이터 재생성 (3개 도시 rent 값 실제 반영 + 출처명 자동 이전) + 문서 정합
2. `_run.mjs` 가 "대상 전부 실패" 를 exit 1 로 구분하도록 수정 (재발 방지)

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래를 반드시 직접 Read 할 것:

- `CLAUDE.md` — CRITICAL 규칙. 특히 **데이터는 공공 출처에서 자동으로만 갱신**(ADR-032), **에러를 삼키지 않는다**
- `docs/adr/076-source-attribution-compliance.md` — 직전 phase 가 `ca_cmhc` 의 `SOURCE` 를 CMHC 포털에서 StatCan 표로 전환한 결정. 이 step 은 그 위에 벡터를 맞춘다
- `docs/ADR.md` — 인덱스 행 형식. 마지막 행이 076 인지 확인하고 **078** 을 쓴다. **077 은 광고 phase(`phases/admob-banner-ads/step8.md`)가 예약했으므로 쓰지 마라**
- `docs/adr/075-hero-basket-sum-wording.md` — ADR 파일 형식 참고
- `docs/AUTOMATION.md` §3 (스크립트 표준 인터페이스), §6 (변동 검증 임계치)
- `docs/DATA.md` §9.1 (출처별 라이선스 요약 — 076 이 신설)
- `scripts/refresh/ca_cmhc.mjs` — 수정 대상. `CITY_CONFIGS`(19행 부근)·`SOURCE`·`mapToRent()`·`refresh()`
- `scripts/refresh/_common.mjs` 의 `parseStatCanResponse()`(358행 부근) — 응답을 `object.vectorId` 기준 Map 으로 만든다. **순서에 의존하지 않으므로 이 함수는 고칠 것이 없다**
- `scripts/refresh/__tests__/ca_cmhc.test.ts` — 기존 테스트. `CITY_CONFIGS` 벡터를 참조하는 fixture 가 있으면 함께 맞춰야 한다
- `docs/TESTING.md` §9-A (자동화 스크립트 인벤토리) 의 `ca_cmhc` 항목

## 작업

### 1. `scripts/refresh/ca_cmhc.mjs` — 벡터 ID 교체

`CITY_CONFIGS` 의 `vectors` 를 아래 값으로 **정확히** 교체한다. 세 도시 모두 `Apartment structures of six units and over` (6세대 이상 아파트) 기준이다.

| 도시 | bachelor (studio) | oneBed | twoBed |
| --- | --- | --- | --- |
| vancouver | `v3824445` | `v3824633` | `v3824821` |
| toronto | `v3824443` | `v3824631` | `v3824819` |
| montreal | `v3824429` | `v3824617` | `v3824805` |

이 9개는 `getSeriesInfoFromCubePidCoord` 를 좌표 하나씩 호출해 `SeriesTitleEn` 으로 27/27 자기검증한 값이다 (도시명·structure·unit 이 모두 제목과 일치함을 확인).

- `CITY_CONFIGS` 의 다른 필드(`id`, `name`, `country`, `currency`, `region`)는 건드리지 마라.
- 파일 상단 doc comment 의 "방법" 줄에 structure 기준을 명시한다: 6세대 이상 아파트(`Apartment structures of six units and over`) 평균 임대료를 쓴다는 사실과, `share` 는 여전히 `studio × 0.65` 추정(ADR-059)이라는 점.
- 각 도시 `vectors` 위에 좌표를 주석으로 남긴다 (`productId 34100133`, `coordinate <geo>.4.<unit>.0.0.0.0.0.0.0`, geo: vancouver=184 / toronto=125 / montreal=46, unit: bachelor=1 / oneBed=2 / twoBed=3). 다음 사람이 벡터를 검증할 수 있어야 한다.

**`SOURCE` 는 수정하지 마라.** ADR-076 이 확정한 값이고 표 34-10-0133-01 을 이미 정확히 가리킨다.

### 2. 테스트 (`scripts/refresh/__tests__/ca_cmhc.test.ts`)

기존 테스트를 유지하면서 추가·갱신한다:

- `CITY_CONFIGS` 3개 도시의 `vectors` 9개가 위 표와 **정확히 일치** (`toBe`)
- 폐기된 벡터 접두사 `v1114266` 으로 시작하는 벡터가 `CITY_CONFIGS` 어디에도 **없다** — 회귀 방지
- 기존 fixture 가 구 벡터 ID 를 쓰고 있으면 새 ID 로 갱신한다. `mapToRent()`·멱등성·`legacyNames` 이전 테스트는 그대로 통과해야 한다

`docs/TESTING.md` §9-A 의 `ca_cmhc` 항목에 추가한 케이스를 기재한다 (**인벤토리 누락 = step 미완**).

### 3. ADR-078

`docs/adr/078-ca-rent-statcan-vectors.md` 신규 (형식은 075·076 참고). 담을 내용:

- **결함**: 벡터 9개가 ARCHIVED product 36100480(노동생산성)을 가리켜 전 구간 `value: null`. HTTP 200 `SUCCESS` 라 네트워크 오류로도 보이지 않았고, fetcher 는 `No rent data found` 로 조용히 끝났다. 도입 이래 무동작.
- **결정 1**: 표 34-10-0133-01 의 `Apartment structures of six units and over` 기준 벡터로 재매핑한다. structure 3종(`Apartment 3+` / `Row and apartment 3+` / `Apartment 6+`)의 값 차이는 0~5% 로 작으며, CMHC 표준 보도 기준이고 도심 아파트 임차 실상에 가장 가까워 6+ 를 택했다.
- **결정 2**: 재매핑 직후 발생하는 대폭 변동(최대 −45%)은 **이상치가 아니라 최초 정상화**다. `docs/AUTOMATION.md` §6 의 OUTLIER 임계치(≥30%)를 넘더라도 step 1 에서 사람이 근거를 확인하고 1회 반영한다. 이후의 변동은 통상 임계치 규칙을 그대로 따른다.
- **결정 3**: `share` 는 CMHC 가 직접 제공하지 않으므로 `studio × 0.65` 추정을 유지한다 (ADR-059 계승).
- **영향**: 3개 도시 rent 가 시드값 대비 10~45% 하락한다. 앱이 캐나다 생활비를 과대 표시해 온 것이 교정된다.
- **재발 방지**: step 2 에서 `_run.mjs` 가 "대상 전부 실패" 를 exit 1 로 구분하게 한다.

`docs/ADR.md` 인덱스에 078 행 추가.

### 4. 이 step 에서 데이터를 건드리지 않는다

`data/cities/*.json` 재생성은 **step 1 의 작업**이다. 이 step 은 스크립트와 문서만 바꾼다.

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm test
```

추가 검증 (모두 통과해야 함):

```bash
# 새 벡터 9개가 모두 존재
for v in v3824445 v3824633 v3824821 v3824443 v3824631 v3824819 v3824429 v3824617 v3824805; do
  grep -c "$v" scripts/refresh/ca_cmhc.mjs
done   # 각 1
# 구 벡터 잔존 0
grep -c 'v1114266' scripts/refresh/ca_cmhc.mjs   # 0
# ADR 078 존재 + 인덱스 행
test -f docs/adr/078-ca-rent-statcan-vectors.md && grep -c '\[078\]' docs/ADR.md   # 1
# 데이터는 무변경
git diff --stat data/   # 출력 없음
```

## 검증 절차

1. 위 AC 커맨드를 순서대로 실행한다.
2. 아키텍처 체크리스트:
   - 벡터 9개가 지시된 표와 정확히 일치하는가?
   - `SOURCE` 와 `_common.mjs` 를 건드리지 않았는가?
   - ADR 파일 + 인덱스 행, TESTING §9-A 인벤토리를 갱신했는가?
   - `any` 를 쓰지 않았는가? (TypeScript strict)
3. 결과에 따라 `phases/ca-rent-vectors/index.json` 의 step 0 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (교체한 벡터, ADR 번호, 테스트 건수를 담을 것)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `data/cities/*.json`, `data/all.json`, `data/seed/all.json` 을 건드리지 마라. 이유: 데이터 재생성은 step 1 이 자동화 경로로 수행한다 (ADR-032).
- `SOURCE` 상수를 수정하지 마라. 이유: ADR-076 이 확정한 값이며 이미 표 34-10-0133-01 을 정확히 가리킨다.
- `scripts/refresh/_common.mjs` 의 `parseStatCanResponse()` 를 수정하지 마라. 이유: 이 함수는 응답의 `object.vectorId` 로 Map 을 만들어 배치 응답 순서에 의존하지 않는다. 결함은 벡터 ID 에만 있다.
- `_run.mjs` 를 수정하지 마라. 이유: step 2 의 작업 범위다.
- `mapToRent()` 의 `share = studio × 0.65` 추정을 바꾸지 마라. 이유: ADR-059 의 결정이고 이 step 의 범위 밖이다.
- 다른 refresh 스크립트(`ca_statcan`, `ca_stm`, `ca_ttc`, `ca_translink` 등)를 손대지 마라. 이유: 이 step 은 `ca_cmhc` 의 벡터 결함만 다룬다.
- 기존 테스트를 깨뜨리지 마라.
