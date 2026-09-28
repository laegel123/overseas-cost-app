# Step 3: workflow-gate

## 배경

step 0~2 가 fetcher 경고를 `warnings` 채널로 분리했다. 이제 fetcher 가 exit 1 하는 것은 **진짜 실패**뿐이다 (throw, 또는 모든 대상 도시가 값을 못 냄).

그런데 `.github/workflows/refresh-*.yml` 의 fetcher step 에는 `continue-on-error` 가 없어서, fetcher 하나가 exit 1 이면 **뒤의 모든 fetcher 와 build·validate·detect_outliers·PR/commit step 이 통째로 skip** 된다. 예: `refresh-rent.yml` 의 `us_hud` 는 HUD API 토큰이 없어 진짜로 실패(401/403)하는데, 두 번째 step 이라 나머지 월세 갱신이 전부 막힌다.

사용자 결정: **fetcher step 을 격리하고 마지막에 실패를 모아 빨간불** — 성공한 fetcher 의 결과는 PR/커밋으로 반영되고, 실패는 숨지 않는다.

전체 계획: `docs/plans/refresh-warnings.md` §2 "워크플로우 게이트".

## 읽어야 할 파일

- `CLAUDE.md`
- `docs/plans/refresh-warnings.md`
- `docs/adr/079-refresh-warnings-channel.md`
- `docs/AUTOMATION.md` §4 (워크플로우), §7.1 (실패 처리), §12
- `.github/workflows/refresh-prices.yml` · `refresh-rent.yml` · `refresh-transit.yml` · `refresh-tuition.yml` · `refresh-visa.yml` · `refresh-fx.yml`
- `scripts/refresh/__tests__/integration.test.ts` — 워크플로우 yml 구조 회귀 검사 (cron, SHA pin, useStatic, push retry 등)
- `scripts/refresh/_run.mjs` — 종료 코드 규약
- `docs/TESTING.md` §9-A (integration 항목)

## 작업

### 1. 워크플로우 6개

각 `refresh-*.yml` 에서 **`node scripts/refresh/_run.mjs <module>` 를 실행하는 모든 step** 에:

- `id: <module>` (모듈명 그대로 — 예 `id: us_hud`. 하나의 워크플로우 안에서 유일해야 한다)
- `continue-on-error: true`

API 키 유무로 갈리는 step 쌍(`if: env.X == ''` 인 skip 안내 step 과 `if: env.X != ''` 인 실행 step)은 **실행 step 에만** 붙인다. skip 안내 step 은 그대로.

마지막 step 으로 게이트를 추가한다 (PR/commit step **뒤**):

```yaml
- name: Fail if any fetcher failed
  if: always()
  run: …   # 각 fetcher step 의 steps.<id>.outcome == 'failure' 인 id 를 모아 ::error:: 로 나열 후 exit 1. 없으면 exit 0.
```

- outcome 은 `${{ steps.<id>.outcome }}` 로 읽는다 (continue-on-error step 의 `conclusion` 은 항상 success 이므로 **outcome 을 봐야 한다**). skip 된 step 의 outcome 은 `skipped` — 실패가 아니다.
- 구현 방식(env 로 outcome 을 넘기고 셸에서 집계 등)은 재량. 단 **실패한 모듈 이름이 로그에 반드시 찍혀야** 한다.
- build·validate·detect_outliers·PR·commit step 에는 `continue-on-error` 를 붙이지 마라. 이유: 스키마 위반은 fail-fast 가 맞고, 게이트는 fetcher 실패만 집계한다.
- 기존 cron·SHA pin·concurrency·permissions·push retry 는 건드리지 마라.

### 2. 회귀 테스트 — `scripts/refresh/__tests__/integration.test.ts`

기존 yml 파싱 관례를 따라 추가:

- 모든 `refresh-*.yml` 에서 `_run.mjs` 를 `run` 하는 step 은 `id` 와 `continue-on-error: true` 를 가진다.
- 각 워크플로우의 **마지막 step** 은 `if: always()` 게이트이고, 그 워크플로우의 fetcher step id **전부**를 참조한다 (새 fetcher step 추가 시 게이트 누락을 잡기 위함).
- build/validate/detect_outliers step 에는 `continue-on-error` 가 없다.

### 3. 문서

- `docs/AUTOMATION.md` §4: fetcher step 격리 + 게이트 설명, §7.1: 실패 시 동작을 최종 형태로 정리 (경고 = `::warning::` 노란 표시·exit 0 / 진짜 실패 = 해당 fetcher exit 1 → 나머지는 계속 → PR/커밋 반영 → 게이트가 빨간불), §12 변경 이력.
- `docs/TESTING.md` §9-A integration 항목에 위 3케이스 (**인벤토리 누락 = step 미완**).
- ADR-079 의 "워크플로우 집계 게이트" 절을 구현 내용으로 보완.

### 4. 최종 순회 검증 (코드 변경 없음, 결과는 summary 에)

모든 refresh 워크플로우의 `_run.mjs` 호출을 **워크플로우와 같은 인자 + `--dryRun`** 으로 실행해 exit 코드를 표로 만든다. 기대: exit 1 은 **진짜 실패뿐** — API 키 부재 throw (kr_kca·kr_kosis·kr_molit·us_bls·us_census — 워크플로우에서는 skip), `us_hud` (토큰 없음), 그 시점의 실제 상류 장애. 경고만 있는 fetcher 가 exit 1 이면 step 1·2 누락이므로 summary 에 기록한다 (이 step 에서 fetcher 를 고치지 마라).

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npx jest scripts/refresh
npm test
grep -c "continue-on-error: true" .github/workflows/refresh-*.yml      # 파일마다 fetcher 실행 step 수와 일치
grep -n "Fail if any fetcher failed" .github/workflows/refresh-*.yml    # 6개 파일 모두
git diff --stat -- data/     # 비어 있음
```

가능하면 `npx --yes @action-validator/cli` 또는 `actionlint` 로 yml 문법을 확인한다 (설치가 막히면 생략하고 summary 에 기재).

## 검증 절차

1. 위 AC 와 §4 순회를 실행한다.
2. 체크리스트: 게이트가 실패를 숨기지 않는가 (silent fail 금지), 기존 워크플로우 보호 장치(SHA pin·push retry)를 건드리지 않았는가.
3. `phases/refresh-warnings/index.json` step 3 업데이트 (completed + summary: 워크플로우별 fetcher step 수, 게이트 구현 방식, §4 순회 exit 표 요약 / error / blocked).

## 금지사항

- `workflow_dispatch` 로 실제 워크플로우를 실행하지 마라. 이유: 데이터 PR/커밋이 생성된다 — 머지 후 운영자가 판단.
- fetcher·`_common.mjs`·`_run.mjs` 를 수정하지 마라. 이유: step 0~2 범위. 누락 발견 시 summary 에 보고.
- build·validate step 에 continue-on-error 를 붙이지 마라.
- `data/` 를 변경하지 마라.
- 기존 테스트를 깨뜨리지 마라.
