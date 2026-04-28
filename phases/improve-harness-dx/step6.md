# Step 6: phase-summary

## 읽어야 할 파일

먼저 아래 파일들을 읽고 현재 상태를 파악하라:

- `scripts/execute.py` — 전체 파일. 특히 `_finalize()` 메서드와 `_stamp()`, 타임스탬프 관련 로직을 확인하라.
- `phases/improve-harness-dx/index.json` — 실제 완료된 step의 데이터 구조(started_at, completed_at, summary 등)를 확인하라.

## 작업

`StepExecutor`에 `_print_phase_summary()` 메서드를 추가하고, `_finalize()` 에서 완료 배너 직전에 호출한다.

### 출력 형식

```
============================================================
  Phase 'improve-harness-dx' Summary
============================================================
  Step  Name                   Elapsed  Summary
  ──────────────────────────────────────────────────────────
  0     cli-subcommands        42s      execute.py를 subparser 구조로 교체, 새 플래그 추가
  1     cli-test-update        38s      TestMainCli 업데이트, TestRunCmd 추가
  2     status-command         91s      cmd_status() 구현, 전체/상세 조회 지원
  3     reset-command          55s      cmd_reset() 구현, --step/--all 지원
  4     init-command           67s      cmd_init() 구현, 스캐폴딩 자동 생성
  5     preflight-validation   44s      _preflight_check() 추가
  6     phase-summary          (this step)
  ──────────────────────────────────────────────────────────
  Total: 6 steps | 5m 37s
============================================================
```

### 구현 요구사항

```python
def _print_phase_summary(self, index: dict):
    # index: _read_json(self._index_file) 결과
    # completed 상태인 step만 표시
    # elapsed: completed_at - started_at (초, 둘 다 없으면 "-")
    # summary: s.get("summary", "(no summary)")
    # 전체 소요시간: index.get("created_at") ~ 현재 _stamp()
```

타임스탬프 파싱은 `datetime.fromisoformat()` 사용. 파싱 실패 시 elapsed를 `"-"` 로 표시한다 (예외로 실행을 중단하지 않는다).

### `_finalize()` 수정

```python
def _finalize(self):
    index = self._read_json(self._index_file)
    index["completed_at"] = self._stamp()
    self._write_json(self._index_file, index)
    self._update_top_index("completed")

    self._run_git("add", "-A")
    if self._run_git("diff", "--cached", "--quiet").returncode != 0:
        msg = f"chore({self._phase_name}): mark phase completed"
        r = self._run_git("commit", "-m", msg)
        if r.returncode == 0:
            print(f"  ✓ {msg}")

    self._print_phase_summary(index)   # ← 여기에 추가

    if self._auto_push:
        # ... 기존 push 로직 ...
```

## Acceptance Criteria

```bash
cd /path/to/harness_framework

python3 -m py_compile scripts/execute.py
# 문법 오류 없음

pytest scripts/test_execute.py -k "TestPhaseSummary" -v
# 해당 테스트 통과

pytest scripts/test_execute.py -v
# 전체 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. `_print_phase_summary()`를 직접 호출하는 단위 테스트를 작성해 출력 형식을 확인한다.
3. 결과에 따라 `phases/improve-harness-dx/index.json`의 step 6을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "_print_phase_summary() 추가, _finalize()에서 호출, TestPhaseSummary 추가"`
   - 실패 3회 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- 타임스탬프 파싱 실패 시 예외를 발생시키지 마라. 이유: summary 출력 실패가 전체 phase 완료를 막으면 안 된다.
- `scripts/execute.py` 이외의 파일을 수정하지 마라 (test_execute.py에 TestPhaseSummary 추가는 예외).
- 완료되지 않은(pending/error/blocked) step을 summary에 포함하지 마라. 이유: 실제로 산출물을 만들지 않은 step의 summary는 의미가 없다.
