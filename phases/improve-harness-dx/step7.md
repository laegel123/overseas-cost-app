# Step 7: hooks

## 읽어야 할 파일

먼저 아래 파일들을 읽고 현재 상태를 파악하라:

- `.claude/settings.json` — 전체 파일. 현재 Stop 훅과 PreToolUse 훅의 구조를 정확히 파악하라.

## 작업

`.claude/settings.json`에 두 가지 훅을 추가 또는 수정한다.

### 훅 1: Pre-commit lint/test/build (PreToolUse)

기존 `PreToolUse` 훅의 command에 git commit 감지 로직을 추가한다. `git commit` 명령이 감지되면 먼저 lint/test/build를 실행하고, 실패 시 커밋을 차단한다.

프로젝트 타입을 자동 감지한다:
- `package.json` 존재 → `npm run lint && npm run build && npm run test`
- `scripts/execute.py` 존재 (Python 프로젝트) → `python3 -m py_compile scripts/execute.py && python3 -m pytest scripts/ -q`
- 둘 다 없으면 검사 생략 (통과)

```bash
# PreToolUse command 패턴 (기존 위험 명령어 차단 + 새 pre-commit 검사 통합)
if echo "$CLAUDE_TOOL_INPUT" | grep -qE 'rm\s+-rf|git\s+push\s+--force|git\s+reset\s+--hard|DROP\s+TABLE'; then
  echo 'BLOCKED: 위험한 명령어가 감지되었습니다.' >&2
  exit 1
fi
if echo "$CLAUDE_TOOL_INPUT" | grep -qE 'git\s+commit'; then
  if [ -f package.json ]; then
    npm run lint 2>&1 && npm run build 2>&1 && npm run test 2>&1 || { echo 'BLOCKED: lint/build/test 실패. 커밋을 중단합니다.' >&2; exit 1; }
  elif [ -f scripts/execute.py ]; then
    python3 -m py_compile scripts/execute.py && python3 -m pytest scripts/ -q 2>&1 || { echo 'BLOCKED: 테스트 실패. 커밋을 중단합니다.' >&2; exit 1; }
  fi
fi
```

### 훅 2: 민감 파일 보호 (PreToolUse)

Bash 명령어에서 `.env`, `.env.*`, 인증서/키 파일(`.pem`, `.key`, `.p12`, `.pfx`)이 포함된 경우 차단한다. git 명령어 여부와 관계없이 모든 Bash 호출에서 검사한다.

```bash
if echo "$CLAUDE_TOOL_INPUT" | grep -qE '\.env(\s|$|\.|/)|\.pem(\s|$)|\.key(\s|$)|\.p12(\s|$)|\.pfx(\s|$)'; then
  echo 'BLOCKED: 민감한 파일(.env, 인증서 등)은 수정/커밋할 수 없습니다.' >&2
  exit 1
fi
```

### 통합 방식

기존 PreToolUse 훅의 단일 command 문자열에 위 두 가지 로직을 순서대로 통합한다. 또는 동일한 `matcher: "Bash"` 아래 훅 배열에 항목을 추가한다. settings.json의 유효한 JSON 구조를 유지해야 한다.

### Write/Edit 도구 보호 (선택적)

`PreToolUse` 에 `matcher: "Write"` 와 `matcher: "Edit"` 훅을 추가하여 `.env` 파일 직접 쓰기도 차단한다:

```json
{
  "matcher": "Write",
  "hooks": [{
    "type": "command",
    "command": "if echo \"$CLAUDE_TOOL_INPUT\" | grep -qE '\"file_path\".*\\.env'; then echo 'BLOCKED: .env 파일은 직접 작성할 수 없습니다.' >&2; exit 1; fi"
  }]
}
```

## Acceptance Criteria

```bash
cd /path/to/harness_framework

# JSON 유효성 검증:
python3 -c "import json; json.load(open('.claude/settings.json'))" && echo "valid JSON"

# 수동 패턴 검증:
echo "git commit -m 'test'" | grep -qE 'git\s+commit' && echo "pre-commit trigger: OK"
echo "cat .env" | grep -qE '\.env(\s|$|\.|/)' && echo "env protection: OK"
echo "git add .env.local" | grep -qE '\.env(\s|$|\.|/)' && echo "env.local protection: OK"
echo "ls -la" | grep -qE '\.env(\s|$|\.|/)' || echo "normal command not blocked: OK"
```

## 검증 절차

1. 위 AC 커맨드를 모두 실행한다.
2. settings.json이 유효한 JSON인지 확인한다.
3. 결과에 따라 `phases/improve-harness-dx/index.json`의 step 7을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "pre-commit lint/test/build 훅 추가, .env/인증서 파일 보호 훅 추가"`
   - 실패 3회 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `.claude/settings.json` 이외의 파일을 수정하지 마라.
- 기존 PreToolUse 훅의 위험 명령어 차단 로직을 제거하지 마라. 이유: 기존 안전장치를 유지해야 한다.
- `ls`, `cat`, `grep` 같은 일반 읽기 명령어가 `.env` 패턴 매칭으로 차단되지 않도록 정규식을 정밀하게 작성하라. 이유: 오탐(false positive)이 정상 작업을 방해한다. `grep -qE '\.env(\s|$|\.|/)'` 패턴을 참고하라 — `.env`로 끝나거나 공백/점/슬래시가 뒤따르는 경우만 매칭.
