# Step 4: init-command

## 읽어야 할 파일

먼저 아래 파일들을 읽고 현재 상태를 파악하라:

- `scripts/execute.py` — 전체 파일. 특히 `cmd_init` stub, `_read_json()`, `_write_json()`, `ROOT` 상수를 확인하라.
- `phases/improve-harness-dx/index.json` — 생성해야 할 index.json의 정확한 구조를 파악하라.
- `phases/index.json` — top-level index 구조를 확인하라.
- `.claude/commands/harness.md` — step*.md 템플릿 형식(D-3 섹션)을 확인하라.

## 작업

`scripts/execute.py`의 `cmd_init()` stub을 실제 구현으로 교체한다.

### 동작 정의

```
execute.py init <phase-name> --steps N [--project NAME]
```

실행 시 아래 파일들을 생성한다:

1. `phases/<phase-name>/` 디렉터리
2. `phases/<phase-name>/index.json` — steps 배열 (step 0..N-1, 모두 status: "pending")
3. `phases/<phase-name>/step0.md` ~ `step{N-1}.md` — 각 step의 마크다운 템플릿
4. `phases/index.json` — 없으면 신규 생성, 있으면 `phases` 배열에 항목 추가

### index.json 형식

```json
{
  "project": "<project-name>",
  "phase": "<phase-name>",
  "steps": [
    { "step": 0, "name": "step-0", "status": "pending" },
    { "step": 1, "name": "step-1", "status": "pending" }
  ]
}
```

`--project` 미지정 시 `ROOT` 디렉터리명을 기본값으로 사용한다.

### step*.md 템플릿 형식

각 step 파일은 아래 구조의 마크다운으로 생성한다:

```markdown
# Step N: step-N

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- (이전 step에서 생성/수정된 파일 경로를 여기에 추가하라)

## 작업

TODO: 이 step에서 수행할 작업을 구체적으로 작성하라.
- 파일 경로, 함수/클래스 시그니처, 핵심 로직을 포함할 것
- 인터페이스만 제시하고 구현은 에이전트에게 맡길 것
- 설계 의도에서 벗어나면 안 되는 핵심 규칙은 명시할 것

## Acceptance Criteria

```bash
# TODO: 실제 실행 가능한 검증 커맨드를 작성하라
npm run build && npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가?
   - ADR 기술 스택을 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/<phase-name>/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- TODO: 이 step에서 하지 말아야 할 것을 "X를 하지 마라. 이유: Y" 형식으로 작성하라.
- 기존 테스트를 깨뜨리지 마라.
```

### 에러 케이스

- `phases/<phase-name>/` 이미 존재 → `"ERROR: phases/<phase-name> already exists."` 후 exit 1
- `--steps` 가 1 미만 → `"ERROR: --steps must be at least 1."` 후 exit 1

### 완료 출력

```
  ✓ Created phases/<phase-name>/
  ✓ Created phases/<phase-name>/index.json (3 steps)
  ✓ Created phases/<phase-name>/step0.md
  ✓ Created phases/<phase-name>/step1.md
  ✓ Created phases/<phase-name>/step2.md
  ✓ Updated phases/index.json

  Next steps:
    1. Edit step files: phases/<phase-name>/step*.md
    2. Run: python3 scripts/execute.py run <phase-name>
```

## Acceptance Criteria

```bash
cd /path/to/harness_framework

python3 scripts/execute.py init test-smoke --steps 3 --project TestProj
# phases/test-smoke/ 생성 확인
# phases/test-smoke/index.json 존재 및 steps 3개, status "pending" 확인
# phases/test-smoke/step0.md ~ step2.md 생성 확인
# phases/index.json에 {"dir": "test-smoke", "status": "pending"} 추가 확인

python3 scripts/execute.py init test-smoke --steps 2
# "ERROR: phases/test-smoke already exists." 후 exit 1

python3 scripts/execute.py status test-smoke
# test-smoke phase 조회 가능

# 테스트 후 정리:
# rm -rf phases/test-smoke
# (phases/index.json에서 test-smoke 항목도 수동 제거)

pytest scripts/test_execute.py -k "TestInitCmd" -v
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 생성된 파일들의 내용을 직접 확인한다 (cat으로 확인 가능).
3. 테스트 후 `phases/test-smoke/`를 삭제하고 `phases/index.json`을 원상복구한다.
4. 결과에 따라 `phases/improve-harness-dx/index.json`의 step 4를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "cmd_init() 구현 완료, index.json/step*.md 스캐폴딩 자동 생성, TestInitCmd 추가"`
   - 실패 3회 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- 기존 `phases/<phase>/` 디렉터리를 덮어쓰지 마라. 이유: 기존 작업 내용이 유실된다.
- `scripts/execute.py` 이외의 파일을 수정하지 마라 (test_execute.py에 TestInitCmd 추가는 예외).
- step 파일 내용을 비워두지 마라. 이유: 빈 파일은 에이전트가 무엇을 해야 할지 모른다. 위에 정의된 템플릿 구조로 생성한다.
