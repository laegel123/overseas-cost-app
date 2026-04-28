# Step 1: cli-test-update

## 읽어야 할 파일

먼저 아래 파일들을 읽고 현재 상태를 파악하라:

- `scripts/execute.py` — Step 0에서 변경된 최신 상태. 특히 `main()`, `cmd_run()`, `StepExecutor.__init__` 시그니처를 확인하라.
- `scripts/test_execute.py` — 전체 파일. 특히 `TestMainCli` 클래스와 `TestInvokeClaude` 클래스를 집중적으로 읽어라.

## 작업

`scripts/test_execute.py`를 Step 0에서 변경된 `execute.py`의 새 인터페이스에 맞게 업데이트한다.

### 1. `TestMainCli` 업데이트

기존 테스트들이 `"execute.py <phase_dir>"` 형식을 사용했다면, 새 형식인 `"execute.py run <phase_dir>"` 으로 수정한다.

업데이트 방향:
- `sys.argv` 패치를 새 subcommand 형식으로 변경
- subcommand 없이 실행 시 에러로 종료됨을 검증하는 테스트 추가
- `--help` 출력에 subcommand 이름들이 포함되는지 검증하는 테스트 추가

### 2. `TestRunCmd` 클래스 추가

`cmd_run()`과 새 플래그들의 파싱을 검증하는 테스트 클래스를 추가한다:

```python
class TestRunCmd(unittest.TestCase):
    """run subcommand 파싱 및 StepExecutor 파라미터 전달 검증"""
```

검증할 케이스:
- `run <phase>` → `from_step=0`, `model="claude-opus-4-5"`, `timeout=1800`, `verbose=False` 기본값 확인
- `run <phase> --from-step 2` → `from_step=2`
- `run <phase> --model claude-sonnet-4-5` → `model="claude-sonnet-4-5"`
- `run <phase> --timeout 3600` → `timeout=3600`
- `run <phase> --verbose` → `verbose=True`
- `run <phase> --push` → `auto_push=True`

### 3. `TestInvokeClaude` 업데이트

`_invoke_claude()`가 `self._model`과 `self._timeout`을 사용하도록 변경되었으므로, 관련 테스트에서:
- subprocess 호출 시 `--model <model>` 인자가 포함되는지 검증
- timeout 값이 `self._timeout`으로 전달되는지 검증
- `verbose=True` 케이스: subprocess가 `capture_output=False` 또는 threading 방식으로 호출되는지 검증

## Acceptance Criteria

```bash
cd /path/to/harness_framework

pytest scripts/test_execute.py -v
# 전체 테스트 통과 (실패 0건)

pytest scripts/test_execute.py -k "TestMainCli or TestRunCmd" -v
# 해당 클래스 테스트 모두 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 결과에 따라 `phases/improve-harness-dx/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "TestMainCli를 subparser 형식으로 업데이트, TestRunCmd 추가, TestInvokeClaude에 model/timeout/verbose 검증 추가"`
   - 실패 3회 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `scripts/execute.py`를 수정하지 마라. 이유: 이번 step은 테스트 파일만 다룬다.
- 기존 테스트를 삭제하지 마라. 이유: 테스트 커버리지를 유지해야 한다. 인터페이스가 바뀐 테스트는 삭제가 아닌 수정으로 처리한다.
- `unittest.mock.patch` 없이 실제 파일시스템이나 git을 건드리는 테스트를 작성하지 마라. 이유: CI 환경에서 side effect가 발생한다.
