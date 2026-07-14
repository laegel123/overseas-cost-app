# Step 2: refs-rewording

`adr-split` phase 의 세 번째 step. 분할 후에도 `docs/ADR.md` 를 가리키는 참조는 전부 유효하다(인덱스로 착지). 다만 **"단일 파일에 ADR-N 추가"** 라고 적힌 **워크플로우 문구**는 이제 부정확하므로 **"새 파일(`docs/adr/NNN-*.md`) + 인덱스 행 추가"** 로 정합화한다. **경로 자체는 바꾸지 않는다**(문구만).

## 읽어야 할 파일

- `docs/plans/adr-split-per-file.md` — §참조 갱신(필수 목록). 이 step 의 대상·범위 정본.
- `docs/ADR.md` — step 1 에서 인덱스로 재작성된 상태. 문구가 가리켜야 할 새 워크플로우 확인.
- 갱신 대상: `CLAUDE.md`(루트), `docs/UI_GUIDE.md`, `docs/ARCHITECTURE.md`, `docs/RELEASE.md`, `.maestro/PLAN.md`, `.maestro/README.md`. **줄 번호는 드리프트할 수 있으니 grep 으로 실제 문구를 먼저 찾는다.**

## 작업

### 1. `CLAUDE.md` (2곳)

- 개발 프로세스 CRITICAL: "새 외부 의존성·결정 사항은 `docs/ADR.md` 에 ADR-N 추가 후 도입" → "…`docs/adr/NNN-<slug>.md` 새 파일 추가 + `docs/ADR.md` 인덱스 행 추가 후 도입".
- 문서 색인: "`docs/ADR.md` — 아키텍처 결정 기록 (신규 결정은 새 ADR 추가)" → "`docs/ADR.md` — ADR 인덱스 (개별 결정은 `docs/adr/NNN-*.md`, 신규 결정은 새 파일 + 인덱스 행)".

### 2. `docs/UI_GUIDE.md` · `docs/ARCHITECTURE.md` · `docs/RELEASE.md`

각 파일에서 "새 ADR 추가" / "`docs/ADR.md` 에 … 추가" 류의 **워크플로우 문구**를 grep 으로 찾아 새 파일 워크플로우로 미세 조정. **해당 문구만** 손대고 인접 서술은 건드리지 않는다. (단순히 `docs/ADR.md` 를 참조 문헌으로 가리키는 문장은 그대로 둔다 — 인덱스로 여전히 유효.)

### 3. `.maestro/PLAN.md` · `.maestro/README.md`

`docs/ADR.md ADR-066` → `docs/adr/066-maestro-e2e.md` 로 재조준(설계 문서 §참조 갱신). 텍스트 참조라 그대로 둬도 무해하나 정밀성 위해 갱신.

### 4. 건드리지 않는 것

- `docs/plans/persona-removal-city-onboarding.md` · `docs/plans/adr-split-per-file.md` — **이력·스펙 문서라 무변경**.
- 코드(`src/`·`app/`)·데이터(`data/`).

## Acceptance Criteria

```bash
grep -n 'docs/adr/NNN' CLAUDE.md                                  # 새 워크플로우 문구 존재
grep -n 'docs/adr/066' .maestro/PLAN.md .maestro/README.md        # maestro 재조준 반영
grep -n 'docs/ADR.md' docs/plans/persona-removal-city-onboarding.md   # 이력 문서 무변경(여전히 존재)
npm run typecheck && npm run lint && npm test                     # 코드 무변경 → 그린 유지
```

## 검증 절차

1. 위 AC 통과: 새 문구 존재, maestro 재조준 반영, 이력 문서 무변경.
2. 갱신 대상 파일에서 낡은 "단일 파일에 ADR-N 추가" 뉘앙스가 남지 않았는지 수동 확인(표현이 파일마다 달라 grep 보조 + 눈검).
3. `git diff --stat` 로 변경 파일이 대상 6개(± 필요한 것)로 한정되고, 무관한 문구 개선이 섞이지 않았는지 확인.
4. `phases/adr-split/index.json` step 2 → `completed`, summary 에 "워크플로우 문구 갱신(CLAUDE.md 2곳·UI_GUIDE·ARCHITECTURE·RELEASE·.maestro 2곳), 이력 문서 무변경, green" 기록.

## 금지사항

- `docs/ADR.md` 참조의 **경로 자체를 바꾸지 마라**. 이유: 분할 후에도 인덱스로 착지해 유효하다. 갱신 대상은 "어떻게 새 ADR 을 추가하는가" 하는 **워크플로우 문구**뿐.
- `docs/plans/*.md`(persona-removal, adr-split)를 편집하지 마라. 이유: 이력·스펙 문서.
- 대상 파일의 **무관한 문구를 개선·재포맷하지 마라**. 이유: 정밀 수정 원칙 — 변경 라인은 전부 워크플로우 정합화와 직결돼야 한다.
- 코드(`src/`·`app/`)를 변경하지 마라. 기존 테스트를 깨뜨리지 마라.
