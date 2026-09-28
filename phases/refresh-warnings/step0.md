# Step 0: warnings-contract

## 배경

`scripts/refresh/_run.mjs` 는 ADR-078 이후 "대상 전부 실패(갱신 0 + errors ≥ 1)" 면 exit 1 한다 (`_common.mjs` 의 `isTotalFailure`). 그런데 fetcher 20여 개가 `errors` 배열을 **경고 채널로도** 쓴다 — "사이트 접근 실패, 정적값 사용", "API 실패, static fallback" 처럼 결과값은 유효한 경우. 값이 main 과 같으면 `cities=0` 이라 이 경고만으로 exit 1 이 된다. 2026-09-21 Refresh Prices 가 정확히 이렇게 실패했다 (`ca_statcan` StatCan API 네트워크 실패 → 정적값 대체 → 값 동일 → exit 1).

해결 방향(사용자 확정): **판정 규칙은 그대로 두고, fetcher 가 경고를 `errors` 가 아닌 별도 `warnings` 채널로 보고한다.** 이 step 은 그 **계약과 러너**만 만든다. 개별 fetcher 이전은 step 1·2, 워크플로우는 step 3.

전체 계획: `docs/plans/refresh-warnings.md` (반드시 읽을 것 — §2 분류 규칙이 이 phase 의 단일 기준).

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로, 아래를 반드시 직접 Read 할 것:

- `CLAUDE.md` — CRITICAL "에러는 삼키지 않는다", 새 결정은 ADR 파일 + 인덱스 행
- `docs/plans/refresh-warnings.md` — 계획 전체, §2 분류 규칙·계약
- `docs/adr/078-ca-rent-statcan-vectors.md` — `isTotalFailure` 도입 결정 (이 step 이 보완)
- `docs/ADR.md` — 인덱스 형식
- `docs/AUTOMATION.md` §3 (스크립트 표준 인터페이스·`RefreshResult`·종료 코드 규약), §7.1 (실패 처리 서술), §12 (변경 이력)
- `docs/TESTING.md` §9-A.1 (`isTotalFailure`), §9-A.2 (fetcher 표준 테스트 패턴·반환 객체 형태)
- `scripts/refresh/_common.mjs` — `RefreshError`·`RefreshResult` typedef, `isTotalFailure`
- `scripts/refresh/_run.mjs` — 결과 처리부와 상단 종료 코드 doc comment
- `scripts/refresh/__tests__/_common.test.ts` — `describe('isTotalFailure (ADR-078)')` 블록

## 작업

### 1. `scripts/refresh/_common.mjs` — 계약

- `RefreshWarning` typedef 추가 (`{ cityId: string, reason: string }` — `RefreshError` 와 같은 형태).
- `RefreshResult` 에 **선택** 필드 `warnings?: RefreshWarning[]` 추가. 필수로 만들지 마라 — 이유: step 1·2 가 fetcher 를 옮기기 전까지 기존 fetcher 가 계약 위반이 되면 안 된다.
- `RefreshError` typedef 설명을 분류 규칙에 맞게 고친다: "그 도시에 대해 신뢰할 수 있는 값을 내지 못함". `RefreshWarning` 설명: "결과값은 유효하지만 출처 이상·품질 의심".
- `isTotalFailure` 의 **판정 로직은 바꾸지 마라.** 이유: ADR-078 의 조용한 무동작 방지 장치이고, warnings 는 애초에 `errors` 에 없으므로 자연히 판정에서 빠진다. doc comment 에 "warnings 는 판정 대상이 아니다" 한 줄만 덧붙인다.

### 2. `scripts/refresh/_run.mjs` — 출력

- `const warnings = result?.warnings ?? [];`
- warnings 가 있으면 도시별로 GitHub Actions 경고 annotation 형식으로 출력한다: `::warning title=<source>::<cityId>: <reason>` (한 줄에 하나). errors 출력은 기존 형식 그대로 유지.
- `updated N cities` 요약 줄 뒤에 warnings 건수가 보이도록 한다 (예: `[src] 3 warning(s)`).
- 상단 종료 코드 doc comment 에 "warnings 는 종료 코드에 영향 없음" 을 추가한다.
- 기존 exit 경로(throw → 1, isTotalFailure → 1)는 건드리지 마라.

### 3. 테스트 — `scripts/refresh/__tests__/_common.test.ts`

`isTotalFailure` 블록에 추가:

- 갱신 0 + errors 0 + warnings 3 → `false` (2026-09-21 형태가 경고로 옮겨진 뒤의 모습)
- 갱신 0 + errors 1 + warnings 2 → `true` (진짜 실패는 여전히 잡힘)
- warnings 필드 없음 (기존 형태) → 기존 결과와 동일

`_run.mjs` 는 top-level await CLI 라 jest 로 import 하지 마라 (import 순간 실행된다).

### 4. ADR-079

`docs/adr/079-refresh-warnings-channel.md` 신규 + `docs/ADR.md` 인덱스 행. 내용: 맥락(ADR-078 판정 + fetcher 의 errors 경고 겸용 + 2026-09-21 실패), 결정(분류 규칙 표 — 계획 §2 그대로, warnings 선택 필드, 판정 불변, 워크플로우 집계 게이트는 step 3), 대안(B: 판정 완화 — ADR-078 취지 위배로 기각 / W1 을 console.info 로 강등 — 출처 생존 신호가 사라져 기각), 결과(경고 장기 지속은 노란 경고로만 남는 위험 — 후속).

### 5. 문서

- `docs/AUTOMATION.md` §3: `RefreshResult` 에 `warnings` 필드, 분류 규칙 표, 종료 코드 규약에 "warnings 무영향". §7.1 의 "4회 실패 시 source 스킵 + 워크플로우 결과에 warning" 서술이 현행 동작과 맞는지 확인하고, 이 phase 완료 후의 동작(경고 = `::warning::`, 진짜 실패 = fetcher exit 1 → step 3 게이트가 집계)으로 정정. §12 변경 이력 1행.
- `docs/TESTING.md` §9-A.1 에 위 3케이스, §9-A.2 표준 패턴의 반환 객체 형태에 `warnings` 반영 (**인벤토리 누락 = step 미완**).

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npx jest scripts/refresh            # 전부 통과 (기존 fetcher 테스트 포함 — 이 step 은 fetcher 무수정)
npm test
node scripts/refresh/_run.mjs uk_tfl --useStatic --dryRun; echo "exit=$?"   # exit=0
grep -n "RefreshWarning" scripts/refresh/_common.mjs            # ≥ 1
grep -n "::warning" scripts/refresh/_run.mjs                     # ≥ 1
test -f docs/adr/079-refresh-warnings-channel.md && grep -n "079" docs/ADR.md
git diff --stat -- data/                                         # 비어 있음
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트: CLAUDE.md CRITICAL (에러 삼킴 금지 — warnings 는 삼킴이 아니라 노출 채널), ADR 추가 규칙, TESTING 인벤토리.
3. `phases/refresh-warnings/index.json` 의 step 0 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약 (typedef 이름, _run 출력 형식, ADR 번호)"`
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message": "…"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "…"` 후 즉시 중단

## 금지사항

- fetcher(`scripts/refresh/<source>.mjs`)를 수정하지 마라. 이유: step 1·2 범위, 한 step 한 레이어.
- `isTotalFailure` 판정 조건을 바꾸지 마라. 이유: ADR-078 의 무동작 감지 장치를 느슨하게 만든다.
- `warnings` 를 필수 필드로 만들지 마라. 이유: 미이전 fetcher 가 계약 위반이 된다.
- `.github/workflows/` 를 수정하지 마라. 이유: step 3 범위.
- `data/` 를 변경하지 마라 (dryRun 만 사용).
- 기존 테스트를 깨뜨리지 마라.
