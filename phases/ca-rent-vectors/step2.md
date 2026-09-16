# Step 2: refresh-fail-visibility

## 배경

`scripts/refresh/ca_cmhc.mjs` 의 StatCan 벡터 ID 9개가 엉뚱한 표를 가리켜 밴쿠버·토론토·몬트리올의 rent 자동 갱신이 **도입 이래 한 번도 동작하지 않았다.** step 0 이 벡터를 고치고, step 1 이 데이터를 반영했다.

이 step 은 **왜 그 결함이 그렇게 오래 숨어 있었는가** 를 고친다.

`scripts/refresh/_run.mjs` 의 종료 코드 정책은 현재 이렇다 (파일 상단 doc comment):

```
0 = 정상 (errors 가 있어도 부분 갱신 성공으로 간주 — fetcher 책임)
1 = throw 발생 (MissingApiKeyError 등)
```

`ca_cmhc` 는 3개 도시가 **전부** `No rent data found` 로 실패하면서도 throw 하지 않고 `errors` 배열에만 기록했다. 그래서 `_run.mjs` 는 exit 0 으로 끝났고, 월 1회 `refresh-rent.yml` cron 은 매번 초록불이었다. **"부분 실패"와 "전부 실패"를 구분하지 않은 것이 결함을 숨긴 원인이다.** 이는 `CLAUDE.md` 의 CRITICAL 규칙 "에러는 삼키지 않는다"에 어긋난다.

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래를 반드시 직접 Read 할 것:

- `CLAUDE.md` — CRITICAL 규칙, 특히 "에러는 삼키지 않는다. silent fail 금지"
- `docs/adr/078-ca-rent-statcan-vectors.md` — step 0 이 작성한 결정. "재발 방지" 항목이 이 step 을 가리킨다
- `docs/AUTOMATION.md` §3 (스크립트 표준 인터페이스 — `RefreshResult` 형태), §4 (워크플로우), §6 (변동 검증)
- `scripts/refresh/_run.mjs` — 수정 대상. 종료 코드 doc comment(18행 부근)와 결과 처리부(82~96행 부근)
- `scripts/refresh/_common.mjs` — `RefreshResult` typedef 와 공용 헬퍼들이 있는 곳. 순수 함수를 여기에 추가한다
- `scripts/refresh/__tests__/_common.test.ts` — 공용 헬퍼 테스트 패턴
- `docs/TESTING.md` §9-A (자동화 스크립트 인벤토리)
- `.github/workflows/refresh-rent.yml` 과 같은 디렉터리의 다른 refresh 워크플로우 — 각 step 이 `_run.mjs` 를 어떻게 호출하는지

## 작업

### 1. 판정 함수를 `scripts/refresh/_common.mjs` 에 추가

`_run.mjs` 는 top-level await 를 쓰는 CLI 라 jest 로 import 할 수 없다 (import 하는 순간 실행된다). 따라서 **판정 로직을 순수 함수로 분리해** `_common.mjs` 에 두고, `_run.mjs` 는 그것을 호출만 한다.

시그니처:

```js
/**
 * refresh 결과가 "대상 전부 실패" 인지 판정한다.
 * @param {RefreshResult} result
 * @returns {boolean}
 */
export function isTotalFailure(result) { /* ... */ }
```

판정 규칙 (이 규칙에서 벗어나지 마라):

- **갱신된 도시가 0개이고 에러가 1건 이상이면 `true`** — 이것이 `ca_cmhc` 가 빠져 있던 상태다.
- **에러가 0건이면 항상 `false`** — 값 변동이 없어 `cities` 가 비는 것은 정상이다. 대부분의 fetcher 가 평상시 이 상태다. 이걸 실패로 보면 모든 cron 이 빨간불이 된다.
- **갱신된 도시가 1개 이상이면 항상 `false`** — 일부라도 성공했으면 부분 실패이고, 기존 정책대로 exit 0 이다.
- `result` 가 `null`/`undefined` 이거나 `cities`·`errors` 가 배열이 아니면 `false` 를 돌려준다 (판정 불가를 실패로 단정하지 않는다).

### 2. `scripts/refresh/_run.mjs` — 종료 코드 분기

결과 처리부에서 `isTotalFailure(result)` 가 `true` 면:

- 기존 경고 출력(도시별 `reason` 목록)은 **그대로 유지**한 뒤,
- `console.error` 로 전부 실패임을 한 줄 덧붙이고 (어느 source 인지, 에러가 몇 건인지 포함),
- `process.exit(1)` 한다.

파일 상단 doc comment 의 종료 코드 설명을 실제 동작에 맞게 갱신한다. `1` 항목에 "대상 전부 실패 (갱신 0건 + 에러 1건 이상)" 를 추가하고, `0` 항목의 "errors 가 있어도 부분 갱신 성공으로 간주" 는 **부분** 실패에만 해당한다는 점을 분명히 쓴다.

기존 `catch` 블록의 `process.exit(1)` 은 건드리지 마라.

### 3. 테스트

`scripts/refresh/__tests__/_common.test.ts` 에 `isTotalFailure` 케이스를 추가한다 (기존 파일 관례를 따를 것):

- 갱신 0 + 에러 3건 → `true` (`ca_cmhc` 가 빠져 있던 실제 형태)
- 갱신 0 + 에러 0건 → `false` (평상시 무변동)
- 갱신 2 + 에러 1건 → `false` (부분 실패)
- 갱신 0 + 에러 1건 → `true` (경계)
- `undefined` / `{}` / `cities` 가 배열이 아닌 값 → `false`

`docs/TESTING.md` §9-A 에 `_common.isTotalFailure` 항목과 위 케이스를 기재한다 (**인벤토리 누락 = step 미완**).

### 4. 기존 fetcher 를 빨간불로 만들지 않는지 확인

이 변경은 9개 refresh 워크플로우 전체에 영향을 준다. 새 판정이 **정상 동작을 실패로 뒤집지 않는지** 반드시 확인하라.

`--dryRun` 으로 여러 fetcher 를 돌려 종료 코드를 확인한다. API 키가 필요한 fetcher(`kr_molit` 등)는 키가 없으면 건너뛰고, 건너뛴 목록을 summary 에 적는다.

```bash
for m in uk_tfl universities visas us_hud us_bls ca_statcan; do
  node scripts/refresh/_run.mjs "$m" --dryRun --useStatic >/dev/null 2>&1
  echo "$m exit=$?"
done
```

`--useStatic` 을 지원하지 않는 모듈은 해당 플래그 없이 돌린다. **exit 1 이 나오는 모듈이 있으면 그 자체가 발견**이다 — 판정 함수를 느슨하게 고쳐 덮지 말고, 해당 fetcher 가 실제로 전부 실패 중인지 확인해 summary 에 보고하라 (이 step 에서 그 fetcher 를 고치지는 마라).

### 5. 문서

`docs/AUTOMATION.md` §3 의 종료 코드 규약에 새 동작을 반영한다. "부분 실패는 exit 0, 대상 전부 실패는 exit 1" 이 규약임을 명시하고, 그렇게 정한 이유(`ca_cmhc` 가 무동작인 채로 오래 숨어 있었던 사례, ADR-078)를 한 줄 덧붙인다.

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm test
```

추가 검증 (모두 통과해야 함):

```bash
# 판정 함수 존재 + _run 이 사용
grep -c 'isTotalFailure' scripts/refresh/_common.mjs   # ≥ 1
grep -c 'isTotalFailure' scripts/refresh/_run.mjs      # ≥ 1
grep -c 'isTotalFailure' docs/TESTING.md               # ≥ 1
# 정상 동작이 exit 0 인지 (변동 없는 정적 fetcher)
node scripts/refresh/_run.mjs uk_tfl --useStatic --dryRun >/dev/null 2>&1; echo "uk_tfl exit=$?"   # 0
# 데이터는 무변경
git diff --stat data/   # 출력 없음
```

## 검증 절차

1. 위 AC 커맨드를 순서대로 실행한다.
2. 작업 §4 의 fetcher 순회를 실행하고 결과(모듈별 exit code, 건너뛴 모듈)를 summary 에 적는다.
3. 아키텍처 체크리스트:
   - 판정 규칙 4개(갱신0+에러≥1 → true / 에러0 → false / 갱신≥1 → false / 형태 불명 → false)를 정확히 지켰는가?
   - 순수 함수로 분리해 테스트 가능하게 했는가?
   - `catch` 블록의 기존 `process.exit(1)` 을 건드리지 않았는가?
   - TESTING §9-A 인벤토리, AUTOMATION §3 규약을 갱신했는가?
4. 결과에 따라 `phases/ca-rent-vectors/index.json` 의 step 2 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (§4 순회 결과를 포함할 것)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 에러가 0건인데 `cities` 가 비었다고 실패로 판정하지 마라. 이유: 값 변동이 없는 것이 대부분 fetcher 의 평상시 정상 상태이고, 그렇게 하면 9개 cron 이 전부 빨간불이 된다.
- `--dryRun` 순회에서 exit 1 이 나온 fetcher 를 통과시키려고 판정 규칙을 느슨하게 만들지 마라. 이유: 그 exit 1 이야말로 이 step 이 찾으려던 신호다. 보고하고 넘어가라.
- `--dryRun` 순회에서 발견된 다른 fetcher 의 결함을 이 step 에서 고치지 마라. 이유: 이 step 은 가시성 장치만 넣는다. 각 fetcher 수정은 별도 결정이 필요하다.
- `scripts/refresh/*.mjs` 의 개별 fetcher 를 수정하지 마라 (`_common.mjs`·`_run.mjs` 제외). 이유: 범위 밖이다.
- `data/` 를 건드리지 마라. 이유: 이 step 은 데이터를 갱신하지 않는다.
- `.github/workflows/*.yml` 을 수정하지 마라. 이유: 워크플로우는 `_run.mjs` 의 종료 코드를 이미 그대로 전파한다. 변경이 필요하다고 판단되면 고치지 말고 summary 에 근거를 적어 보고하라.
- 기존 테스트를 깨뜨리지 마라.
