# Step 0: cli-subcommands

## 읽어야 할 파일

먼저 아래 파일들을 읽고 현재 구조를 완전히 파악하라:

- `scripts/execute.py` — 전체 파일 (418줄). 특히 `main()` 함수와 `StepExecutor.__init__` 시그니처에 집중하라.
- `scripts/test_execute.py` — `TestMainCli` 클래스 부분을 확인하라. Step 1에서 테스트를 수정할 예정이므로 현재 구조를 파악해 두어라.

## 작업

`scripts/execute.py`의 `main()` 함수를 argparse subparser 구조로 교체하고, `StepExecutor`에 새 파라미터를 추가한다.

### 1. `main()` 함수 교체

기존의 단순 argparse를 subparser 구조로 교체한다. 각 subcommand는 별도 핸들러 함수(`cmd_run`, `cmd_status`, `cmd_reset`, `cmd_init`)로 위임한다. `cmd_status`, `cmd_reset`, `cmd_init`은 이번 step에서 stub(pass 또는 "Not implemented yet" 출력)으로 남겨도 된다.

```python
def main():
    parser = argparse.ArgumentParser(description="Harness Step Executor")
    sub = parser.add_subparsers(dest="command", metavar="subcommand")
    sub.required = True

    # run
    p_run = sub.add_parser("run", help="Phase 내 step 순차 실행")
    p_run.add_argument("phase_dir")
    p_run.add_argument("--push", action="store_true")
    p_run.add_argument("--from-step", type=int, default=0, metavar="N",
                       help="N번 step부터 시작 (기본: 0)")
    p_run.add_argument("--model", default="claude-opus-4-5",
                       help="Claude 모델 (기본: claude-opus-4-5)")
    p_run.add_argument("--timeout", type=int, default=1800,
                       help="Claude 호출 타임아웃(초) (기본: 1800)")
    p_run.add_argument("--verbose", action="store_true",
                       help="Claude 출력을 실시간으로 터미널에 표시")
    p_run.set_defaults(func=cmd_run)

    # status (stub)
    p_status = sub.add_parser("status", help="Phase 현황 조회")
    p_status.add_argument("phase_dir", nargs="?", help="특정 phase (생략 시 전체)")
    p_status.set_defaults(func=cmd_status)

    # reset (stub)
    p_reset = sub.add_parser("reset", help="Error/Blocked step을 pending으로 리셋")
    p_reset.add_argument("phase_dir")
    p_reset.add_argument("--step", type=int, metavar="N", help="특정 step 번호만 리셋")
    p_reset.add_argument("--all", action="store_true", help="모든 error/blocked step 리셋")
    p_reset.set_defaults(func=cmd_reset)

    # init (stub)
    p_init = sub.add_parser("init", help="새 phase 초기화")
    p_init.add_argument("phase_name")
    p_init.add_argument("--steps", type=int, required=True, help="생성할 step 수")
    p_init.add_argument("--project", default=None, help="project 이름")
    p_init.set_defaults(func=cmd_init)

    args = parser.parse_args()
    args.func(args)
```

### 2. `cmd_run()` 핸들러

기존 `StepExecutor(args.phase_dir, auto_push=args.push).run()` 호출을 새 파라미터를 포함하도록 업데이트한다:

```python
def cmd_run(args):
    StepExecutor(
        args.phase_dir,
        auto_push=args.push,
        from_step=args.from_step,
        model=args.model,
        timeout=args.timeout,
        verbose=args.verbose,
    ).run()
```

### 3. `StepExecutor.__init__` 파라미터 추가

```python
def __init__(
    self,
    phase_dir_name: str,
    *,
    auto_push: bool = False,
    from_step: int = 0,
    model: str = "claude-opus-4-5",
    timeout: int = 1800,
    verbose: bool = False,
):
```

`self._from_step`, `self._model`, `self._timeout`, `self._verbose` 로 저장한다.

### 4. `_invoke_claude()` 수정

- `timeout=1800` 하드코딩 → `self._timeout` 으로 교체
- 모델 선택: `["claude", "-p", ...]` → `["claude", "--model", self._model, "-p", ...]` 으로 교체
- `--verbose` 지원: `verbose=True`일 때 subprocess의 stdout/stderr를 실시간 출력하면서 동시에 캡처한다. `threading.Thread`를 사용해 stdout/stderr를 읽으며 `sys.stdout`/`sys.stderr`에 즉시 출력하고 버퍼에도 저장하는 패턴을 구현한다 (이미 `progress_indicator`에 threading 패턴이 있으니 참고). verbose 모드에서는 `progress_indicator`를 사용하지 않는다.

### 5. `_execute_all_steps()` 수정

pending step 탐색 시 `--from-step` 적용:

```python
pending = next(
    (s for s in index["steps"]
     if s["status"] == "pending" and s["step"] >= self._from_step),
    None
)
```

`--from-step` 이 0보다 크면 `_print_header()` 이후에 경고 메시지를 출력한다:
`"  WARN: --from-step {N} 지정됨. Step {N} 이전은 건너뜁니다."`

### 6. stub 핸들러

```python
def cmd_status(args):
    print("Not implemented yet.")

def cmd_reset(args):
    print("Not implemented yet.")

def cmd_init(args):
    print("Not implemented yet.")
```

## Acceptance Criteria

```bash
cd /path/to/harness_framework

python3 scripts/execute.py --help
# 출력에 "subcommand" 및 run, status, reset, init 포함 확인

python3 scripts/execute.py run --help
# --push, --from-step, --model, --timeout, --verbose 모두 표시 확인

python3 scripts/execute.py run nonexistent_phase
# "ERROR: .../nonexistent_phase not found" 출력 후 exit 1

python3 scripts/execute.py status
# "Not implemented yet." 출력

python3 scripts/execute.py reset some_phase
# "Not implemented yet." 출력

python3 scripts/execute.py init new_phase --steps 3
# "Not implemented yet." 출력

python3 -m py_compile scripts/execute.py
# 문법 오류 없음 (exit 0)
```

## 검증 절차

1. 위 AC 커맨드를 모두 실행한다.
2. `python3 -m py_compile scripts/execute.py` 로 문법 오류 없음을 확인한다.
3. 결과에 따라 `phases/improve-harness-dx/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "execute.py를 subparser 구조로 교체, --from-step/--model/--timeout/--verbose 파라미터 추가"`
   - 실패 3회 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `test_execute.py`를 수정하지 마라. 이유: Step 1에서 별도로 다룬다. 이번 step 완료 후 기존 TestMainCli 테스트가 실패하는 것은 허용된다.
- `cmd_status`, `cmd_reset`, `cmd_init`의 실제 구현을 이번 step에서 작성하지 마라. 이유: 각각 별도 step에서 다룬다.
- `_invoke_claude()`에서 `--dangerously-skip-permissions` 플래그를 제거하지 마라. 이유: Claude가 파일을 읽고 수정하려면 이 플래그가 필요하다.
