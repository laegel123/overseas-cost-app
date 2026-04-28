# Step 8: readme

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프레임워크의 전체 기능을 파악하라:

- `scripts/execute.py` — 최신 상태 전체. CLI 인터페이스, 모든 subcommand, 플래그를 파악하라.
- `.claude/commands/harness.md` — 워크플로우 정의. Step 설계 원칙과 파일 형식을 확인하라.
- `phases/improve-harness-dx/index.json` — 실제 데이터 구조를 확인하라.

## 작업

`README.md` 파일을 루트에 신규 생성한다. 이 프레임워크를 처음 보는 개발자가 15분 안에 첫 번째 phase를 실행할 수 있도록 안내하는 것이 목표다.

### README.md 구성

#### 1. 제목 및 소개 (3문장 이내)

Harness가 무엇인지, 어떤 문제를 해결하는지 설명한다.
예: "Claude Code CLI를 orchestrate하는 Python 자동화 프레임워크. 복잡한 개발 작업을 step으로 분해하고, 각 step을 독립 Claude 세션에서 실행하며 자가 교정한다."

#### 2. 전제조건

- Python 3.10+
- [Claude Code CLI](https://docs.anthropic.com/ko/docs/claude-code) (`claude` 바이너리가 PATH에 있어야 함)

#### 3. 5분 시작 가이드

아래 순서로 작성한다:

```bash
# 1. 새 phase 초기화
python3 scripts/execute.py init my-feature --steps 3 --project MyApp

# 2. step 파일 편집 (각 step에 작업 지시 작성)
# phases/my-feature/step0.md, step1.md, step2.md 편집

# 3. 실행
python3 scripts/execute.py run my-feature

# 4. 현황 확인
python3 scripts/execute.py status
```

#### 4. 워크플로우 다이어그램 (ASCII)

```
init → edit step*.md → run → [completed]
                          ↓
                       [error] → reset → run (retry)
                          ↓
                      [blocked] → resolve → reset → run
```

#### 5. CLI 레퍼런스

표 형태로 모든 subcommand와 주요 플래그를 정리한다:

| 커맨드 | 설명 |
|--------|------|
| `run <phase>` | Phase 내 step 순차 실행 |
| `run <phase> --push` | 실행 후 git push |
| `run <phase> --from-step N` | N번 step부터 시작 |
| `run <phase> --verbose` | Claude 출력 실시간 표시 |
| `run <phase> --model M` | Claude 모델 지정 |
| `run <phase> --timeout S` | 타임아웃(초) 지정 |
| `status` | 전체 phase 현황 |
| `status <phase>` | 특정 phase 상세 현황 |
| `reset <phase>` | 첫 번째 error/blocked step 리셋 |
| `reset <phase> --all` | 모든 error/blocked step 리셋 |
| `reset <phase> --step N` | 특정 step만 리셋 |
| `init <phase> --steps N` | 새 phase 스캐폴딩 생성 |

#### 6. Step 파일 작성 가이드

step*.md의 구조를 간략히 설명한다. 좋은 step 파일의 핵심 원칙 3가지:
1. **자기완결성** — 세션이 이 파일만으로 맥락을 파악할 수 있어야 함
2. **AC는 실행 가능한 커맨드** — "동작해야 한다" 대신 `npm test` 같은 실제 커맨드
3. **시그니처 수준 지시** — 함수 인터페이스만 제시, 구현은 에이전트 재량

#### 7. 에러 복구 가이드

```bash
# error 상태 확인
python3 scripts/execute.py status my-feature

# 첫 번째 error step 리셋
python3 scripts/execute.py reset my-feature

# 재실행
python3 scripts/execute.py run my-feature
```

#### 8. 테스트

```bash
pytest scripts/test_execute.py -v
```

## Acceptance Criteria

```bash
cd /path/to/harness_framework

test -f README.md && echo "README exists"
grep -q "python3 scripts/execute.py init" README.md && echo "init usage present"
grep -q "python3 scripts/execute.py run" README.md && echo "run usage present"
grep -q "python3 scripts/execute.py status" README.md && echo "status usage present"
grep -q "python3 scripts/execute.py reset" README.md && echo "reset usage present"
grep -q "전제조건\|Prerequisites\|Requirements" README.md && echo "prereqs present"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. README.md를 처음부터 읽고 흐름이 자연스러운지 확인한다.
3. 결과에 따라 `phases/improve-harness-dx/index.json`의 step 8을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "README.md 신규 작성, 5분 시작 가이드/CLI 레퍼런스/에러 복구 가이드 포함"`
   - 실패 3회 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `CLAUDE.md`를 수정하지 마라. 이유: CLAUDE.md는 이 프레임워크를 사용하는 각 프로젝트가 직접 채우는 템플릿이다.
- README에 구현 세부사항(내부 메서드명, 클래스 구조 등)을 넣지 마라. 이유: 사용자는 사용법만 알면 된다.
- 마케팅 문구나 과장된 표현을 사용하지 마라. 이유: 도구 문서는 간결하고 실용적이어야 한다.
