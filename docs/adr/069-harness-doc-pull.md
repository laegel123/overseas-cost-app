[← ADR 인덱스](../ADR.md)

# ADR-069: 하네스 가드레일 push → pull 전환 (문서 색인만 주입)

> **상태**: Active

**맥락:**

`scripts/execute.py` 의 `_load_guardrails()` 가 CLAUDE.md + `docs/*.md` 전체 본문을 매 step 프롬프트에, 매 재시도마다 통째로 인라인했다. 100KB 상한(구 `GUARDRAIL_DOC_MAX_BYTES`)으로 ADR.md·TESTING.md 는 제외했지만, 나머지 문서 약 220KB(≈70K 토큰)가 step 과의 관련성과 무관하게 고정 비용으로 나갔다. 200K 컨텍스트를 문서가 잠식해 실제 작업 공간과 어텐션을 깎았고, 과거 `prompt_too_long` 400 사고의 원인이기도 했다.

**핵심 사실 두 가지:**

1. 헤드리스 `claude -p` 세션은 프로젝트 CLAUDE.md 를 **자동 로드**한다 (도구 차단 상태에서 CLAUDE.md 전용 내용 질의로 검증 완료). → CLAUDE.md 인라인은 순수 중복이었다.
2. step 파일에는 이미 "읽어야 할 파일" 규약이 있고 세션은 Read 도구를 가진다. → 문서를 밀어 넣지(push) 않아도 필요한 것만 당겨 읽을(pull) 수 있다.

**결정:**

1. `_load_guardrails()` → `_build_doc_index()`: `docs/*.md` **경로 색인만** 프롬프트에 주입하고 본문 인라인은 전면 제거. CLAUDE.md 인라인도 제거 (자동 로드로 충분).
2. 문서 본문은 step 파일의 "읽어야 할 파일" 지시에 따라 세션이 직접 Read 한다. step 작성 시 필요한 docs/ 문서를 이 목록에 반드시 명시한다 (step 템플릿에 문구 반영).
3. 위반 불가 CRITICAL 규칙은 CLAUDE.md(자동 로드)가 계속 담당 — 가드레일 역할과 참고 문서 역할을 분리한다.

**대안 검토:**

- **(A) 채택 — pull 모델 (색인만 주입)**: step 당 프롬프트 238KB → 8.7KB (−96.4%). 기존 "읽어야 할 파일" 규약 재사용, 새 기구 없음.
- **(B) 기각 — step 별 문서 allowlist (index.json `docs` 필드)**: 주입 보장은 되지만 index.json 스키마·하네스 기구가 늘어난다. step 파일 명시로 충분.
- **(C) 기각 — 크기 상한 유지·강화**: 상한 이하 문서가 관련성과 무관하게 전부 들어가는 구조적 낭비는 그대로.

**결과 / 영향:**

- step 프롬프트 고정 비용 238KB → 8.7KB (adr-split phase step0 기준 실측, −96.4%). 재시도 비용도 동일 비율로 감소.
- 검증: 스크래치패드 클론에서 일회용 phase 풀 루프 실행 — 프롬프트에 없는 docs/DATA.md·ADR.md 내용을 세션이 pull-read 하여 AC 통과, status/commit/summary 정상 (34s).
- step 작성자가 "읽어야 할 파일"을 누락하면 세션이 해당 문서를 놓칠 수 있다 — CRITICAL 규칙은 CLAUDE.md 가 커버하므로 위험은 참고 문서 누락에 한정.
- ADR-068 (ADR 분할)과 시너지: 세션이 ADR 인덱스만 읽고 관련 ADR 파일만 선택적으로 Read.

**관련:** ADR-068 (ADR 문서 분할), `scripts/execute.py`, `phases/improve-harness-dx/` (하네스 이력).
