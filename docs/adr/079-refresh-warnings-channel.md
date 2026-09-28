[← ADR 인덱스](../ADR.md)

# ADR-079: refresh 경고 채널 분리 — `warnings` 를 `errors` 에서 떼어낸다

**상태:** 채택 (2026-09-28)

**맥락:**

ADR-078 이 `_run.mjs` 에 **"대상 전부 실패(갱신 0건 + errors 1건 이상) → exit 1"**
판정(`_common.mjs` 의 `isTotalFailure`)을 넣었다. 판정 자체는 옳다 — `ca_cmhc` 가
도입 이래 3개 도시 **전부** 실패하면서도 exit 0 으로 끝나 결함이 수개월간 초록불
아래 숨어 있던 것을 잡기 위한 장치다.

그런데 fetcher 20여 개가 `errors` 배열을 **경고 채널로도** 쓴다 — "사이트 접근 실패,
정적값 사용", "API 실패, static fallback 사용", "CPI 값 의심" 같은 메시지. 이때
결과값은 유효하다(정적값·기존값). 그런데 정적값은 main 의 값과 같으므로 `cities` 가
비고, 이 경고만으로 `isTotalFailure` 가 참이 되어 exit 1 이 난다.

실제 발생 — **2026-09-21 Refresh Prices (run 35621047217)**: `ca_statcan` 의 StatCan
API POST 가 러너에서 네트워크 실패 → 3개 도시 모두 정적값으로 대체(결과 유효) →
값이 main 과 같아 `cities=0` → exit 1 → 워크플로우 실패. 이 API 실패는 간헐적이다
(최근 8회 중 2회). 즉 판정은 **정상 동작을 실패로 오인**하고 있다.

**결정:**

**fetcher 가 경고를 `errors` 가 아닌 별도 `warnings` 채널로 보고한다. 판정 규칙은
바꾸지 않는다.**

1. **분류 규칙 (단일 기준).**

   | 채널 | 의미 | 예 | 종료 코드 영향 |
   | --- | --- | --- | --- |
   | `errors` | 그 도시에 대해 **신뢰할 수 있는 값을 내지 못함** | 대체값(STATIC) 없음, Unknown city, 기존 파일 읽기 실패, write 실패, 파싱 실패 후 대체 경로 없음 | `isTotalFailure` 대상 — 전부 실패면 exit 1 |
   | `warnings` | 결과값은 유효(정적값·기존값·실값)하지만 **출처 이상 또는 품질 의심** | 도달성 확인 실패(값은 원래 STATIC), 실 fetch 실패 → STATIC 대체, 보조 호출 실패, 데이터 품질 의심 | 없음. 로그에 `::warning::` 로 노출 |

   세부: W1(도달성만 확인, 값은 항상 STATIC) → `warnings`. W2(실 fetch·파싱 실패 →
   STATIC 대체) → `warnings`. W3(계속 진행하는 품질·보조 경고) → `warnings`.
   대체 경로 없는 실패 → `errors` 유지.

2. **`warnings` 는 `RefreshResult` 의 선택 필드다.**

   ```js
   /** @typedef {Object} RefreshWarning @property {string} cityId @property {string} reason */
   /** RefreshResult: @property {RefreshWarning[]} [warnings] */
   ```

   필수로 만들지 않는 이유: fetcher 이전은 step 1·2 에서 순차적으로 진행하므로,
   그 사이 미이전 fetcher 가 계약 위반이 되면 안 된다. `_run.mjs` 는 기존 `errors`
   관례와 같이 `result?.warnings ?? []` 로 읽는다.

3. **`isTotalFailure` 판정 로직은 불변이다.** `warnings` 는 애초에 `errors` 에 없으니
   자연히 판정에서 빠진다 — 판정식에 예외를 넣을 필요가 없다. doc comment 에만
   "warnings 는 판정 대상이 아니다" 를 명시한다.

4. **`_run.mjs` 가 warnings 를 노출한다.** 도시별로 GitHub Actions 경고 annotation
   `::warning title=<source>::<cityId>: <reason>` 한 줄씩 + 요약 `[src] N warning(s)`.
   에러는 기존 출력 형식 그대로. silent fail 이 아니라 **채널 분리**다 (CLAUDE.md
   "에러는 삼키지 않는다" 준수).

5. **워크플로우 집계 게이트는 별도 범위 (step 3).** 1~4 만으로는 진짜 실패
   (`us_hud` 의 HUD API 토큰 부재 등) 가 exit 1 을 내고, refresh 워크플로우의 fetcher
   step 에 `continue-on-error` 가 없어 **뒤의 모든 fetcher 와 build·validate·PR step
   이 통째로 skip** 된다. 각 fetcher step 을 격리하고 마지막 step 이 실패를 모아
   빨간불로 만든다. 구현 (step 3):
   - 6개 `refresh-*.yml` 에서 `_run.mjs` 를 실행하는 모든 step 에 `id: <module>` +
     `continue-on-error: true`. API 키 분기 쌍은 실행 step 에만 (skip 안내 step 은 그대로).
   - 마지막 step `Fail if any fetcher failed` (`if: always()`) 가 env
     `FETCHER_OUTCOMES` 로 `<module>=${{ steps.<module>.outcome }}` 목록을 받아 셸에서
     `failure` 만 골라 `::error title=<module>::` 로 나열 후 exit 1 (없으면 exit 0).
     `continue-on-error` step 의 `conclusion` 은 항상 success 라 **outcome** 을 본다.
     skip 된 step 의 outcome 은 `skipped` — 실패로 세지 않는다.
   - build·validate·detect_outliers·PR·commit step 에는 `continue-on-error` 를 붙이지
     않는다 (스키마 위반은 fail-fast). 게이트는 fetcher 실패만 집계한다.
   - 결과: 성공한 fetcher 의 값은 PR/커밋으로 반영되고, 실패는 워크플로우 빨간불로
     드러난다 (AUTOMATION §4.5d·§7.1).

**대안 (기각):**

- **B: 판정 완화** — `isTotalFailure` 가 "정적 대체" 류 에러를 무시하게 한다. `reason`
  문자열 패턴 매칭이 되거나 에러에 severity 플래그를 달아야 하는데, 어느 쪽이든
  **조용한 무동작을 놓칠 수 있는 구멍**을 판정식 안에 만든다. ADR-078 이 넣은
  장치의 취지를 정면으로 위배한다. 분류 책임은 사실을 아는 쪽(fetcher)에 있다.
- **W1 을 `console.info` 로 강등** — 도달성만 확인하고 값은 항상 STATIC 인 경고는
  아예 구조화하지 않고 정보 로그로 흘린다. 출처가 영구히 죽었을 때
  **생존 신호가 사라져** 아무도 모르게 된다. 노란 경고로 남기는 편이 낫다.
- **`errors` 를 유지하고 워크플로우에서만 무시** — 종료 코드가 이미 1 이라 step 격리
  없이는 불가능하고, 격리해도 "정적 대체" 와 "진짜 실패" 를 워크플로우가 구분할
  방법이 없다.

**결과 / 영향:**

- 2026-09-21 형태의 실패(정적 대체 → 값 동일 → exit 1)가 사라진다. 워크플로우는
  노란 경고를 달고 초록으로 끝난다.
- 진짜 실패(대체 경로 없음)는 여전히 exit 1 → step 3 의 집계 게이트가 빨간불.
- **위험: 경고가 장기 지속되면 노란 경고로만 남는다.** W1/W2 출처가 영구히 죽어도
  값은 정적값으로 계속 유효하므로 판정에 걸리지 않는다 — ADR-078 이 막으려던
  "조용한 무동작" 과 같은 위험이 경고 채널로 옮겨간 것이다. N회 연속 경고
  에스컬레이션은 상태 저장소(연속 실패 카운터)가 없어 **보류**하고 후속으로 남긴다.
- fetcher 이전(step 1·2) 이 끝날 때까지 두 채널이 섞여 있는 과도기가 존재한다.
  선택 필드라 과도기에도 계약 위반은 없다.

**검증:**

- `scripts/refresh/__tests__/_common.test.ts` — 갱신 0 + errors 0 + warnings 3 →
  `false`, 갱신 0 + errors 1 + warnings 2 → `true`, `warnings` 필드 없음 → 기존 결과
  동일. (`_run.mjs` 는 top-level await CLI 라 jest 로 import 하지 않는다.)
- `node scripts/refresh/_run.mjs uk_tfl --useStatic --dryRun` → exit 0.
- `scripts/refresh/__tests__/integration.test.ts` — fetcher step 의 `id` +
  `continue-on-error`, 마지막 step 이 모든 fetcher id 를 참조하는 `always()` 게이트,
  build·validate·detect_outliers 에 `continue-on-error` 부재.

**관련:** ADR-032 (공공 출처 100% 자동화), ADR-078 (`isTotalFailure` 도입 — 본 ADR 이
보완), `docs/AUTOMATION.md` §3·§4.5d·§7.1, `docs/TESTING.md` §9-A.1·§9-A.2·§9-A.13,
`docs/plans/refresh-warnings.md`, `phases/refresh-warnings/`.
