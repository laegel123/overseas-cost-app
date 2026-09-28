# Step 1: fetchers-reachability

## 배경

step 0 이 `RefreshResult` 에 선택 필드 `warnings` 를 추가하고 `_run.mjs` 가 이를 `::warning::` 로 출력하게 했다. 판정(`isTotalFailure`)은 `errors` 만 본다.

이 step 은 **W1 — 도달성만 확인하는 fetcher** 를 옮긴다. 이 fetcher 들은 출처 페이지에 접속해 보기만 하고, **값은 항상 정적값(STATIC)** 을 쓴다 (`apiAvailable` 같은 변수가 값 경로에 쓰이지 않음). 접속 실패는 결과에 영향이 없는데 `errors` 에 push 되어, 값 변동이 없는 평상시에 exit 1 을 만든다 (예: 로컬 dryRun 에서 de_transit·fr_ratp·nl_gvb·sg_lta·vn_gso·ae_fcsc 가 exit 1).

전체 계획: `docs/plans/refresh-warnings.md` §2 분류 규칙, §3 분류 표.

## 읽어야 할 파일

- `CLAUDE.md`
- `docs/plans/refresh-warnings.md` — §2 분류 규칙, §3 W1 목록과 조사 시점 라인 번호
- `docs/adr/079-refresh-warnings-channel.md` — step 0 이 작성한 결정
- `scripts/refresh/_common.mjs` — `RefreshWarning`·`RefreshResult` typedef (step 0)
- `scripts/refresh/_run.mjs` — warnings 출력 (step 0)
- `docs/TESTING.md` §9-A (fetcher 별 항목)
- 대상 fetcher 와 테스트 (아래 목록)

## 작업

대상 (W1): `ae_fcsc` · `ae_rta` · `au_transit` · `de_destatis` · `de_transit` · `fr_insee` · `fr_ratp` · `jp_transit` · `nl_cbs` · `nl_gvb` · `sg_lta` · `uk_tfl` · `vn_gso` · `sg_singstat` + `visas`.

각 fetcher 에 대해:

1. `grep -n "errors.push\|console.info" scripts/refresh/<name>.mjs` 로 push 지점을 확인한다 (계획 §3 의 라인 번호는 조사 시점 기준).
2. **도달성 확인 실패 / "unavailable, using static values"** 류 push 만 `warnings` 로 옮긴다. 반환 객체에 `warnings` 배열을 포함한다.
3. 공통 진짜 실패 (`Unknown city` · `Failed to read existing data` · `Write failed`) 는 **`errors` 에 그대로 둔다.**
4. `visas.mjs` 는 도달성 실패를 이미 `console.info` 로 강등해 두었다 — 같은 분류이므로 `warnings` 로 통일한다 (사용자 결정: W1 은 console.info 가 아니라 warnings).
5. 해당 테스트(`scripts/refresh/__tests__/<name>.test.ts`)의 단언을 `result.errors` → `result.warnings` 로 바꾸고, **`result.errors` 가 비어 있음**도 함께 단언한다. 진짜 실패 경로 테스트는 그대로 `errors` 단언.
6. 판단이 애매한 push (값에 영향을 주는지 불분명) 는 분류 규칙 §2 로 판정한다 — **값을 못 내면 errors, 값이 유효하면 warnings.** 옮기지 않기로 한 push 가 있으면 summary 에 이유와 함께 적는다.

reason 문구는 바꾸지 않아도 된다 (문구 정리는 범위 밖).

`docs/TESTING.md` §9-A 의 각 fetcher 항목에서 "errors 에 unavailable" 류 서술을 warnings 로 고친다 (**인벤토리 누락 = step 미완**).

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npx jest scripts/refresh
npm test
# 워크플로우와 같은 인자 + --dryRun — 모두 exit 0 이어야 한다 (도달 실패여도 warnings 만 남음)
for m in ae_fcsc ae_rta au_transit de_destatis de_transit fr_insee fr_ratp jp_transit nl_cbs nl_gvb sg_lta uk_tfl vn_gso; do node scripts/refresh/_run.mjs $m --dryRun >/dev/null 2>&1; echo "$m exit=$?"; done
for m in sg_singstat visas; do node scripts/refresh/_run.mjs $m --useStatic --dryRun >/dev/null 2>&1; echo "$m exit=$?"; done
git diff --stat -- data/     # 비어 있음
```

dryRun 에서 exit 1 이 남으면 원인을 로그로 확인한다. 진짜 실패(예: write·파싱 경로)라면 옮기지 말고 summary 에 기록 — 억지로 0 을 만들지 마라.

## 검증 절차

1. 위 AC 를 실행한다.
2. 체크리스트: 진짜 실패를 warnings 로 옮기지 않았는가 (에러 삼킴 금지), 대상 외 fetcher 를 건드리지 않았는가.
3. `phases/refresh-warnings/index.json` step 1 업데이트 (completed + summary: 옮긴 fetcher 수, 남긴 예외와 이유, dryRun exit 결과 / error / blocked).

## 금지사항

- W2·W3 fetcher (`ca_stm` · `ca_translink` · `ca_ttc` · `us_transit` · `kr_seoul_metro` · `ca_statcan` · `us_bls` · `au_abs` · `uk_ons` · `jp_estat` · `kr_molit` · `universities`) 를 수정하지 마라. 이유: step 2 범위.
- `_common.mjs`·`_run.mjs`·워크플로우를 수정하지 마라. 이유: step 0·3 범위.
- `isTotalFailure` 를 우회하려고 `cities` 에 억지로 값을 넣지 마라. 이유: 판정 왜곡.
- `data/` 를 변경하지 마라.
- 기존 테스트를 깨뜨리지 마라.
