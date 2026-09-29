# 계획: refresh 경고 채널 분리 + 워크플로우 집계 게이트

작성 2026-09-28. 실행은 하네스 phase `refresh-warnings` (4 step). 결정 기록은 ADR-079 (step 0 이 작성).

## 1. 문제

ADR-078 (ca-rent-vectors, 2026-09-16) 이 `_run.mjs` 에 "대상 전부 실패(갱신 0 + errors ≥ 1) → exit 1" 판정(`isTotalFailure`)을 넣었다. 판정 자체는 옳다 — `ca_cmhc` 가 수개월간 조용히 무동작이던 결함을 잡기 위한 장치다.

그런데 fetcher 20여 개가 `errors` 배열을 **경고 채널로도** 쓴다 — "사이트 접근 실패, 정적값 사용", "API 실패, static fallback 사용", "CPI 값 의심" 같은 메시지. 이 경우 결과값은 유효한데(정적값·기존값), 값이 main 과 같으면 `cities=0` 이라 판정이 exit 1 을 낸다.

게다가 refresh 워크플로우의 fetcher step 에 `continue-on-error` 가 없어서, fetcher 하나가 exit 1 이면 **뒤의 모든 fetcher 와 build·validate·PR step 이 통째로 skip** 된다.

실제 발생:

- **2026-09-21 Refresh Prices (run 35621047217)** — `ca_statcan` 의 StatCan API POST 가 러너에서 네트워크 실패 → 3개 도시 모두 정적값으로 대체(결과 유효) → 값이 main 과 같아 cities=0 → exit 1 → 워크플로우 실패. 이 API 실패는 간헐적이다 (최근 8회 중 2회).
- 로컬 dryRun (2026-09-28) 예측: 10-01 refresh-rent 는 `us_hud`(진짜 실패, HUD API 토큰 없음 401/403)에서, 10-02 refresh-transit 은 첫 step `kr_seoul_metro`(정적 대체)에서 exit 1 → 나머지 전부 skip.

(참고: 2026-09-14 이전의 refresh 실패는 전부 "GitHub Actions is not permitted to create pull requests" — 2026-09-17 리포 설정으로 해소됨. 이 계획과 무관.)

## 2. 결정 (사용자 확정 2026-09-28)

**A 안 — fetcher 가 경고를 errors 와 분리한다.** 판정 규칙(`isTotalFailure`)은 느슨하게 하지 않는다 (ADR-078 취지 유지).

**추가 — 워크플로우 집계 게이트.** A 만으로는 진짜 실패(us_hud)가 나머지를 계속 막으므로, fetcher step 을 격리하고 마지막에 실패를 모아 빨간불로 만든다.

### 분류 규칙 (단일 기준)

| 채널 | 의미 | 예 | 종료 코드 영향 |
|---|---|---|---|
| `errors` | 그 도시에 대해 **신뢰할 수 있는 값을 내지 못함** | 대체값(STATIC) 없음, Unknown city, 기존 파일 읽기 실패, write 실패, 파싱 실패 후 대체 경로 없음 | `isTotalFailure` 대상 — 전부 실패면 exit 1 |
| `warnings` | 결과값은 유효(정적값·기존값·실값)하지만 **출처 이상 또는 품질 의심** | 도달성 확인 실패(값은 원래 STATIC), 실 fetch 실패 → STATIC 대체, 보조 호출 실패, 데이터 품질 의심 | 없음. 로그에 `::warning::` 로 노출 |

- W1 (도달성만 확인, 값은 항상 STATIC) → `warnings` (사용자 선택: console.info 강등 아님).
- W2 (실 fetch/파싱 실패 → STATIC 대체) → `warnings` (사용자 선택).
- W3 (계속 진행하는 품질·보조 경고) → `warnings`.
- 대체 경로 없는 실패 → `errors` 유지.

### 계약

```js
/** @typedef {Object} RefreshWarning  @property {string} cityId  @property {string} reason */
/** RefreshResult 에 선택 필드 추가: @property {RefreshWarning[]} [warnings] */
```

선택 필드 — `_run.mjs` 는 `result?.warnings ?? []` 로 읽는다 (기존 `errors ?? []` 관례).

### 워크플로우 게이트

- 모든 `refresh-*.yml` 의 `_run.mjs` 호출 step 에 `id: <module>` + `continue-on-error: true`.
- 마지막 step `Fail if any fetcher failed` — `if: always()`, 각 fetcher step 의 `outcome` 이 `failure` 인 것을 나열해 `::error::` 출력 후 `exit 1`. build·validate·PR·commit step 은 그 전에 정상 수행.
- build·validate·detect_outliers 는 continue-on-error 를 붙이지 않는다 (스키마 위반은 fail-fast 유지).

## 3. 조사 결과 — fetcher 분류 (2026-09-28, origin/main 3fbb62f 기준 라인)

라인 번호는 조사 시점 기준이며 이동했을 수 있다 — step 실행 시 `grep -n "errors.push" scripts/refresh/<name>.mjs` 로 재확인할 것.

모든 fetcher 공통: `Unknown city` / `Failed to read existing data` / `Write failed` push 는 **진짜 실패 → errors 유지**.

| 분류 | fetcher: 경고성 push 라인 |
|---|---|
| W1 도달성만 (값은 항상 STATIC) | ae_fcsc:144,150 · ae_rta:86 · au_transit:107 · de_destatis:175 · de_transit:118,124 · fr_insee:141 · fr_ratp:89 · jp_transit:107 · nl_cbs:142 · nl_gvb:89 · sg_lta:89 · uk_tfl:95 · vn_gso:142 · sg_singstat:188,195 · (visas:252-256 은 이미 console.info — warnings 로 통일) |
| W2 실 fetch/파싱 실패 → STATIC 대체 | ca_stm:106 · ca_translink:107 · ca_ttc:104 · us_transit:194 · kr_seoul_metro:129,136,151,158 · ca_statcan:355 (API 실패→static), 304·311 (base period 확인 불가→static) · us_bls:291 (범위 밖→static), 298 (fetch 실패→static) · au_abs:192 · uk_ons:166,180 · jp_estat:185 |
| W3 품질·보조 경고 | ca_statcan:319 (referencePeriod 404), 345 (CPI ≥ 145 의심) · kr_molit:186 (`'WARN: …'` 문자열 접두어) |
| 진짜 실패 (errors 유지) | ca_statcan:357 (STATIC_PRICES 없는 도시) · ca_cmhc · us_hud · us_census · kr_kca · kr_kosis · kr_molit 143/148/154 · fx_backup · universities:249 · visas:292 · eu_eurostat |

기타: `ca_statcan` 은 304/311/345 에서 errors push 와 별개로 `console.warn('::warning::…')` 를 **이중 출력** — warnings 로 옮기면서 `_run.mjs` 가 출력하므로 중복 제거. `universities.mjs:210` 은 errors 에 **문자열** push 후 247 에서 `{cityId, reason}` 로 감쌈 — 분류 규칙에 따라 정리.

errors 소비처는 `_run.mjs` 와 테스트뿐이다 (PR 본문은 정적 텍스트, `GITHUB_STEP_SUMMARY` 미사용, detect_outliers·build_data 는 파일 diff 만 봄).

## 4. Step

| # | name | 범위 |
|---|---|---|
| 0 | warnings-contract | `_common.mjs` typedef · `_run.mjs` 출력 · `_common.test.ts` · ADR-079 · AUTOMATION §3·§7.1·§12 · TESTING §9-A.1·§9-A.2 |
| 1 | fetchers-reachability | W1 fetcher + visas 통일 + 각 테스트 · TESTING §9-A fetcher 항목 |
| 2 | fetchers-fallback | W2·W3 fetcher (+ ca_statcan 이중 출력, universities 문자열, kr_molit WARN 접두어) + 각 테스트 · TESTING |
| 3 | workflow-gate | `refresh-*.yml` 6개 · `integration.test.ts` · AUTOMATION §4 · 전 fetcher dryRun 순회 검증 |

## 5. 범위 밖 (후속)

- **us_hud HUD API 토큰** — 사용자 발급 필요. 게이트 도입 후 refresh-rent 는 us_hud 때문에 빨간불이지만 나머지 fetcher 결과는 PR/커밋으로 반영된다.
- **ca_statcan CPI base 의심 값** — 2026-09-28 dryRun 에서 vancouver milk 3.25→6.5, chicken 15→31.19 (+100%). fetcher 스스로 "CPI ≥ 145 의심" 경고. 이런 outlier PR 은 머지하지 말 것. 원인 조사는 별도.
- **경고 장기 지속 감지** — W1/W2 출처가 영구히 죽어도 노란 경고만 남는다 (ADR-078 이 막으려던 조용한 무동작과 같은 위험). N회 연속 경고 에스컬레이션은 상태 저장소가 없어 보류.
