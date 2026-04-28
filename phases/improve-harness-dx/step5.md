# Step 5: preflight-validation

## 읽어야 할 파일

먼저 아래 파일들을 읽고 현재 상태를 파악하라:

- `scripts/execute.py` — 전체 파일. 특히 `StepExecutor.__init__`, `run()`, `_check_blockers()` 를 확인하라. `run()` 의 실행 순서를 파악해 `_preflight_check()` 삽입 위치를 결정하라.
- `phases/improve-harness-dx/index.json` — 현재 steps 배열 구조를 확인하라.

## 작업

`StepExecutor`에 `_preflight_check()` 메서드를 추가하고, `run()` 에서 `_check_blockers()` 직후에 호출한다.

### `_preflight_check()` 검증 항목

#### 검증 1: step 파일 존재 여부

`index.json`의 모든 step 번호에 대해 `phases/<phase>/step{N}.md` 파일이 존재하는지 확인한다.

```
ERROR: Missing step file: phases/0-mvp/step2.md
```

#### 검증 2: step 번호 연속성

step 번호가 0부터 시작하여 연속적인지 확인한다 (gap 없음).

```
ERROR: Step numbers must be consecutive starting from 0. Found gap at step 2.
```

#### 검증 3: `--from-step` 범위

`self._from_step` 이 0 이상, 전체 step 수 미만인지 확인한다.

```
ERROR: --from-step 5 is out of range. Phase has 3 steps (0-2).
```

#### 검증 4: `--from-step` 이전 step 상태 경고

`self._from_step` 이 0보다 크고, 건너뛰는 step 중 pending 상태인 step이 있으면 경고를 출력한다 (실행 중단은 아님):

```
  WARN: Skipping step 0 (project-setup) which is still 'pending'.
```

### 구현 위치

```python
def run(self):
    self._print_header()
    self._check_blockers()
    self._preflight_check()   # ← 여기에 추가
    self._checkout_branch()
    guardrails = self._load_guardrails()
    self._ensure_created_at()
    self._execute_all_steps(guardrails)
    self._finalize()
```

모든 검증 실패는 즉시 `sys.exit(1)` 한다. 검증 항목은 모두 실행하지 않고 첫 번째 실패에서 즉시 중단한다.

## Acceptance Criteria

```bash
cd /path/to/harness_framework

# step 파일 하나를 임시로 rename:
# mv phases/improve-harness-dx/step1.md phases/improve-harness-dx/step1.md.bak
# python3 scripts/execute.py run improve-harness-dx
# → "ERROR: Missing step file: phases/improve-harness-dx/step1.md" 출력, exit 1
# mv phases/improve-harness-dx/step1.md.bak phases/improve-harness-dx/step1.md

# --from-step 범위 초과:
# python3 scripts/execute.py run improve-harness-dx --from-step 99
# → "ERROR: --from-step 99 is out of range." 출력, exit 1

python3 -m py_compile scripts/execute.py
# 문법 오류 없음

pytest scripts/test_execute.py -k "TestPreflightCheck" -v
# 해당 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 실제 파일 rename을 통해 에러 메시지를 직접 눈으로 확인한다.
3. 결과에 따라 `phases/improve-harness-dx/index.json`의 step 5를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "_preflight_check() 추가, step 파일 존재/연속성/from-step 범위 검증, TestPreflightCheck 추가"`
   - 실패 3회 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `_preflight_check()`를 `__init__`에서 호출하지 마라. 이유: 초기화 시점에는 아직 branch checkout이 안 된 상태이므로 `run()` 내에서 적절한 순서로 호출해야 한다.
- 검증 실패 시 예외(Exception)를 raise하지 마라. 이유: 일관성을 위해 모든 에러 처리는 `sys.exit(1)` 패턴을 따른다.
- `scripts/execute.py` 이외의 파일을 수정하지 마라 (test_execute.py에 TestPreflightCheck 추가는 예외).
