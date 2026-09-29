# Step 2: fetchers-fallback

## 배경

step 0 이 `warnings` 채널을 만들고, step 1 이 도달성만 확인하는 fetcher(W1)를 옮겼다.

이 step 은 나머지 경고성 push 를 옮긴다:

- **W2 — 실 fetch/파싱 실패 → 정적값(STATIC) 대체.** 출처는 진짜로 실패했지만 결과값은 유효하다. 사용자 결정: **warnings**. 2026-09-21 Refresh Prices 실패(`ca_statcan` API 네트워크 실패 → 3개 도시 static 대체 → 값 동일 → exit 1)가 이 경우다.
- **W3 — 계속 진행하는 품질·보조 경고.** 예: `ca_statcan` referencePeriod 조회 404, CPI ≥ 145 의심, `kr_molit` 의 `'WARN: …'` 접두어 문자열.

전체 계획: `docs/plans/refresh-warnings.md` §2 분류 규칙, §3 분류 표.

## 읽어야 할 파일

- `CLAUDE.md`
- `docs/plans/refresh-warnings.md`
- `docs/adr/079-refresh-warnings-channel.md`
- `scripts/refresh/_common.mjs`, `scripts/refresh/_run.mjs` (step 0)
- step 1 에서 수정된 fetcher 하나 (예: `scripts/refresh/de_transit.mjs` 와 테스트) — 반환 형태·테스트 관례를 맞출 것
- `docs/TESTING.md` §9-A
- 대상 fetcher 와 테스트 (아래)

## 작업

대상: `ca_stm` · `ca_translink` · `ca_ttc` · `us_transit` · `kr_seoul_metro` · `ca_statcan` · `us_bls` · `au_abs` · `uk_ons` · `jp_estat` · `kr_molit` · `universities`.

각 fetcher 에서 `grep -n "errors.push" scripts/refresh/<name>.mjs` 로 push 지점을 확인하고 분류 규칙으로 판정한다:

- **static/기존값으로 대체하고 계속 진행** → `warnings`
- **대체값 없음** (예: `ca_statcan` 의 STATIC_PRICES 가 없는 도시), `Unknown city` · `Failed to read existing data` · `Write failed` → `errors` 유지

개별 지시:

1. **`ca_statcan`** — API 실패→static (조사 시점 355행), base period 확인 불가→static (304·311), referencePeriod 404 (319), CPI ≥ 145 의심 (345) → warnings. STATIC 없는 도시 (357) → errors. 이 파일은 304/311/345 에서 errors push 와 **별개로** `console.warn('::warning::…')` 를 이중 출력한다 — warnings 로 옮긴 뒤에는 `_run.mjs` 가 `::warning::` 를 출력하므로 **해당 console.warn 은 제거**한다.
   - CPI ≥ 145 의심 값을 **쓰는 동작 자체는 바꾸지 마라.** 이유: 값 정합성 조사는 범위 밖(계획 §5). 채널만 옮긴다.
2. **`kr_molit`** — `'WARN: No rental data… publication lag'` 처럼 문자열 접두어로 경고를 표시하는 push → warnings 로 옮기고 `WARN:` 접두어 제거. 진짜 실패 (143/148/154 부근) 는 errors.
3. **`universities`** — 조사 시점 210행이 errors 에 **문자열**을 push 하고 247행에서 `{cityId, reason}` 로 감싼다. 이 경로가 값을 못 내는 실패인지, 정적값으로 계속 가는 경고인지 코드로 판정해 분류하고, 어느 쪽이든 `{cityId, reason}` 객체 형태로 정리한다.
4. **`us_bls`** — 범위 밖→static (291), fetch 실패→static (298) → warnings.
5. 나머지 (`ca_stm` · `ca_translink` · `ca_ttc` · `us_transit` · `kr_seoul_metro` · `au_abs` · `uk_ons` · `jp_estat`) — 파싱/fetch 실패→static 대체 push → warnings.

각 테스트 (`scripts/refresh/__tests__/<name>.test.ts`): 옮긴 경로는 `result.warnings` 단언 + `result.errors` 비어 있음 단언. 진짜 실패 경로는 `errors` 단언 유지. `ca_statcan` 은 "API 실패 + STATIC 있는 도시 → warnings, 갱신 0 이어도 isTotalFailure false" 를 한 케이스로 명시해 2026-09-21 회귀를 고정한다 (`isTotalFailure` 는 `_common.mjs` 에서 import).

`docs/TESTING.md` §9-A 해당 fetcher 항목 갱신 (**인벤토리 누락 = step 미완**).

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npx jest scripts/refresh
npm test
grep -n "WARN:" scripts/refresh/kr_molit.mjs; echo "grep_exit=$?"          # grep_exit=1 (접두어 제거)
grep -n "console.warn('::warning" scripts/refresh/ca_statcan.mjs; echo "grep_exit=$?"   # grep_exit=1 (이중 출력 제거)
# 키 불필요 fetcher 를 워크플로우 인자 + --dryRun 으로 — 네트워크 결과와 무관하게 static 대체 경로면 exit 0
for m in ca_stm ca_translink ca_ttc us_transit kr_seoul_metro ca_statcan au_abs uk_ons; do node scripts/refresh/_run.mjs $m --dryRun >/dev/null 2>&1; echo "$m exit=$?"; done
node scripts/refresh/_run.mjs jp_estat --useStatic --dryRun >/dev/null 2>&1; echo "jp_estat exit=$?"
node scripts/refresh/_run.mjs universities --useStatic --dryRun >/dev/null 2>&1; echo "universities exit=$?"
git diff --stat -- data/     # 비어 있음
```

(`us_bls`·`kr_molit` 는 API 키가 없으면 throw → exit 1 이 정상이다. 워크플로우는 키가 없으면 skip 한다.)

dryRun 에서 exit 1 이 남으면 로그로 원인을 확인하고, 진짜 실패면 옮기지 말고 summary 에 기록한다.

## 검증 절차

1. 위 AC 를 실행한다.
2. 체크리스트: 대체값 없는 실패를 warnings 로 옮기지 않았는가, CPI 의심 값 쓰기 동작을 바꾸지 않았는가, 대상 외 파일을 건드리지 않았는가.
3. `phases/refresh-warnings/index.json` step 2 업데이트 (completed + summary: fetcher 별 옮긴/남긴 push, universities 판정 결과, dryRun exit 결과 / error / blocked).

## 금지사항

- step 1 에서 이미 옮긴 W1 fetcher 를 다시 수정하지 마라. 이유: 범위 분리.
- `_common.mjs`·`_run.mjs`·워크플로우를 수정하지 마라.
- `ca_statcan` 의 값 계산·CPI base 처리를 바꾸지 마라. 이유: 계획 §5 범위 밖 — 별도 조사 필요.
- reason 문구를 대대적으로 바꾸지 마라 (`WARN:` 접두어 제거만 예외).
- `data/` 를 변경하지 마라.
- 기존 테스트를 깨뜨리지 마라.
