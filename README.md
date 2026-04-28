# Overseas Cost Compare App

한국인 이주 준비자(유학생·취업자)가 **서울과 해외 도시의 생활비**를 항목별로 1:1 비교하는 모바일 앱. 출시 도시 20개 + 서울. 공공 출처 기반 자동 데이터 갱신.

자세한 기획·설계는 `docs/` 참조:
- `docs/PRD.md` — 제품 요구사항
- `docs/ARCHITECTURE.md` — 아키텍처
- `docs/UI_GUIDE.md` — 디자인 시스템
- `docs/TESTING.md` — 테스트 전략
- `docs/AUTOMATION.md` — 데이터 자동화 인프라

---

## Harness Framework

Claude Code CLI를 orchestrate하는 Python 자동화 프레임워크. 복잡한 개발 작업을 step으로 분해하고, 각 step을 독립 Claude 세션에서 실행하며 자가 교정한다.

## 전제조건

- Python 3.10+
- [Claude Code CLI](https://docs.anthropic.com/ko/docs/claude-code) (`claude` 바이너리가 PATH에 있어야 함)

## 5분 시작 가이드

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

## 워크플로우

```
init → edit step*.md → run → [completed]
                          ↓
                       [error] → reset → run (retry)
                          ↓
                      [blocked] → resolve → reset → run
```

## CLI 레퍼런스

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

## Step 파일 작성 가이드

각 `step*.md` 파일은 독립된 Claude 세션에서 실행된다. 좋은 step 파일의 핵심 원칙:

1. **자기완결성** — 세션이 이 파일만으로 맥락을 파악할 수 있어야 한다. "이전 대화에서 논의한 바와 같이" 같은 외부 참조는 금지한다.
2. **AC는 실행 가능한 커맨드** — "동작해야 한다" 대신 `npm test` 같은 실제 커맨드로 검증 기준을 명확히 한다.
3. **시그니처 수준 지시** — 함수/클래스 인터페이스만 제시하고, 구현은 에이전트 재량에 맡긴다.

```markdown
# Step 0: my-step

## 읽어야 할 파일
- `scripts/execute.py`

## 작업
TODO: 구체적인 구현 지시

## Acceptance Criteria
```bash
pytest scripts/test_execute.py -v
```

## 검증 절차
1. 위 AC 커맨드를 실행한다.
2. 결과에 따라 `phases/<phase>/index.json`의 해당 step을 업데이트한다.
```

## 에러 복구 가이드

```bash
# error 상태 확인
python3 scripts/execute.py status my-feature

# 첫 번째 error step 리셋
python3 scripts/execute.py reset my-feature

# 재실행
python3 scripts/execute.py run my-feature
```

`blocked` 상태는 API 키 발급, 외부 인증 등 수동 조치가 필요한 경우다. `blocked_reason`에 적힌 사유를 해결한 뒤 동일한 절차로 리셋하고 재실행한다.

## 테스트

```bash
pytest scripts/test_execute.py -v
```
