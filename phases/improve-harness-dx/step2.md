# Step 2: status-command

## 읽어야 할 파일

먼저 아래 파일들을 읽고 현재 상태를 파악하라:

- `scripts/execute.py` — 전체 파일. 특히 `cmd_status` stub, `_read_json()`, `_stamp()`, 그리고 `ROOT` 상수를 확인하라.
- `phases/improve-harness-dx/index.json` — 실제 데이터 구조 예시로 참고하라.
- `phases/index.json` — top-level index 구조를 확인하라.

## 작업

`scripts/execute.py`의 `cmd_status()` stub을 실제 구현으로 교체한다. `StepExecutor` 클래스를 사용하지 않고 독립 함수로 구현한다 (읽기 전용이므로 클래스 불필요).

### 출력 형식

#### 전체 조회 (`execute.py status`)

```
============================================================
  Harness Status
============================================================
  Phase             Status      Steps
  ─────────────────────────────────────────────────────────
  0-mvp             completed   4/4
  1-auth            error       2/5
  2-refactor        pending     0/3
============================================================
```

- `phases/index.json` 없으면: `"No phases found."` 출력 후 exit 0
- status별 표시:
  - `completed` → 그대로
  - `pending` → 그대로
  - `error` → 첫 번째 error step의 `error_message` 앞 50자를 `← Step N: "..."` 형태로 함께 표시
  - `blocked` → 첫 번째 blocked step의 `blocked_reason` 앞 50자를 함께 표시

#### 특정 phase 조회 (`execute.py status <phase-dir>`)

```
============================================================
  Phase: 1-auth  [error]
  Project: MyApp
============================================================
  Step  Name              Status      Started    Elapsed  Summary
  ──────────────────────────────────────────────────────────────────
  0     project-setup     completed   10:23:01   42s      src/ 구조 생성, tsconfig.json 설정
  1     core-types        completed   10:23:43   87s      User, Post 타입 정의 완료
  2     api-layer         error       10:25:10   134s     [3회 시도 후 실패] npm install 에러
  3     auth-flow         pending     -          -        -
  4     tests             pending     -          -        -
============================================================
```

- `started_at`이 있으면 시간(HH:MM:SS)만 표시
- elapsed: `completed_at` - `started_at` (또는 `failed_at` - `started_at`) 초 단위
- summary/error_message 없으면 `-`

### 구현 요구사항

```python
def cmd_status(args):
    # args.phase_dir: Optional[str]
    phases_dir = ROOT / "phases"
    top_index = phases_dir / "index.json"

    if not top_index.exists():
        print("No phases found.")
        return

    # top_index 읽어서 phases 순회
    # args.phase_dir 있으면 해당 phase만 상세 출력
    # 없으면 전체 요약 테이블 출력
```

타임스탬프 파싱은 `datetime.fromisoformat()` 을 사용한다.
elapsed 계산 시 타임스탬프가 없는 경우를 graceful하게 처리한다.

## Acceptance Criteria

```bash
cd /path/to/harness_framework

# phases/index.json 있는 상태에서:
python3 scripts/execute.py status
# 헤더 + phases 테이블 출력, exit 0

python3 scripts/execute.py status improve-harness-dx
# 해당 phase의 step별 상세 출력, exit 0

# phases/ 없는 상태에서 (임시로 rename 후 테스트):
# python3 scripts/execute.py status
# "No phases found." 출력, exit 0

python3 -m py_compile scripts/execute.py
# 문법 오류 없음

pytest scripts/test_execute.py -k "TestStatusCmd" -v
# 해당 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. `python3 scripts/execute.py status` 로 실제 출력을 눈으로 확인한다.
3. 결과에 따라 `phases/improve-harness-dx/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "cmd_status() 구현 완료, 전체/상세 조회 지원, TestStatusCmd 추가"`
   - 실패 3회 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `StepExecutor` 클래스 내부에 status 로직을 추가하지 마라. 이유: status는 읽기 전용 작업으로 실행 엔진과 분리해야 한다.
- 테스트 없이 구현하지 마라. 이유: `TestStatusCmd` 클래스를 `test_execute.py`에 추가해야 한다.
- `phases/` 디렉터리가 없는 경우 예외를 발생시키지 마라. 이유: `"No phases found."` 메시지로 graceful하게 처리해야 한다.
