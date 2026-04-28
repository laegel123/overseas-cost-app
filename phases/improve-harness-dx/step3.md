# Step 3: reset-command

## 읽어야 할 파일

먼저 아래 파일들을 읽고 현재 상태를 파악하라:

- `scripts/execute.py` — 전체 파일. 특히 `cmd_reset` stub, `_read_json()`, `_write_json()`, `_check_blockers()` 로직을 확인하라.
- `phases/improve-harness-dx/index.json` — step 데이터 구조를 확인하라. error/blocked 상태 시 어떤 필드가 추가되는지 파악한다.

## 작업

`scripts/execute.py`의 `cmd_reset()` stub을 실제 구현으로 교체한다.

### 동작 정의

```
execute.py reset <phase-dir>
  → phase 내 첫 번째 error 또는 blocked step을 pending으로 전환

execute.py reset <phase-dir> --step N
  → step N만 리셋 (status가 error 또는 blocked인 경우에만)

execute.py reset <phase-dir> --all
  → phase 내 모든 error/blocked step을 일괄 리셋
```

### 리셋 시 처리

status를 `"pending"`으로 변경하고 아래 필드를 제거한다:
- `error_message`
- `blocked_reason`
- `failed_at`
- `blocked_at`

`started_at`, `completed_at`은 건드리지 않는다.

### 출력 형식

```
  ✓ Step 2 (api-layer): error → pending
  ✓ Step 3 (auth-flow): blocked → pending

  Reset 2 step(s). Run: python3 scripts/execute.py run <phase-dir>
```

에러 케이스:
- phase 디렉터리 없음 → `"ERROR: phases/<dir> not found"` 후 exit 1
- `--step N` 지정 시 해당 step이 error/blocked 아님 → `"WARN: Step N is '<status>', not error/blocked. Skipping."` 출력 후 exit 0
- 리셋할 step이 없음 → `"No error or blocked steps found in <phase-dir>."` 출력 후 exit 0

### 구현 시그니처

```python
def cmd_reset(args):
    # args.phase_dir: str
    # args.step: Optional[int]
    # args.all: bool
```

## Acceptance Criteria

```bash
cd /path/to/harness_framework

# 테스트용 임시 index.json 생성 후 검증:
python3 -c "
import json
from pathlib import Path
idx = {
  'project': 'test', 'phase': 'improve-harness-dx',
  'steps': [
    {'step': 0, 'name': 'a', 'status': 'completed', 'summary': 'ok'},
    {'step': 1, 'name': 'b', 'status': 'error', 'error_message': 'fail', 'failed_at': '2026-01-01T00:00:00+0900'},
    {'step': 2, 'name': 'c', 'status': 'blocked', 'blocked_reason': 'need key', 'blocked_at': '2026-01-01T00:00:00+0900'},
    {'step': 3, 'name': 'd', 'status': 'pending'},
  ]
}
Path('phases/improve-harness-dx/index.json').write_text(json.dumps(idx, indent=2))
"

python3 scripts/execute.py reset improve-harness-dx
# step 1이 pending으로 전환되고 error_message, failed_at 삭제 확인

python3 scripts/execute.py reset improve-harness-dx --all
# step 1, 2 모두 pending 전환 확인

python3 scripts/execute.py reset improve-harness-dx --step 3
# "WARN: Step 3 is 'pending', not error/blocked." 출력 확인

python3 scripts/execute.py reset nonexistent
# "ERROR: phases/nonexistent not found" 후 exit 1

pytest scripts/test_execute.py -k "TestResetCmd" -v
```

## 검증 절차

1. 위 AC 커맨드를 실행한다 (테스트 후 index.json을 원래대로 복구할 것).
2. pytest 통과를 확인한다.
3. 결과에 따라 `phases/improve-harness-dx/index.json`의 step 3을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "cmd_reset() 구현 완료, --step/--all 지원, TestResetCmd 추가"`
   - 실패 3회 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `completed` 상태인 step을 리셋하지 마라. 이유: 완료된 작업의 히스토리를 보존해야 한다.
- `phases/index.json` (top-level)의 phase status를 이 명령어에서 변경하지 마라. 이유: phase status는 execute.py run이 실행될 때 자동으로 업데이트된다.
- `scripts/execute.py` 이외의 파일을 수정하지 마라 (test_execute.py에 TestResetCmd 추가는 예외).
