# Step 9: docs-reconcile

남은 문서를 새 상태에 정합화한다. ADR-067 은 step 0 에서 생성됨. CLAUDE.md 는 전환기 문구로 이미 갱신돼 있으므로, 구현이 끝난 지금 **전환기 caveat 를 최종형으로 정리**한다. 그 외 TESTING §9, DATA persist 키, ARCHITECTURE store 목록/부팅 순서.

## 읽어야 할 파일

- `docs/plans/persona-removal-city-onboarding.md` "문서" 섹션
- `CLAUDE.md`(루트) — 3줄 서두, 22줄 페르소나 CRITICAL 규칙(전환기 문구)
- `docs/TESTING.md` — §7 인벤토리(각 step 인라인 갱신됨), §9 개별 섹션(persona/settings/compare/categoryInclusion/_layout/hydration/onboarding)
- `docs/DATA.md` — §13.5.1 persist 키 목록
- `docs/ARCHITECTURE.md` — store 목록 / 부팅 순서
- (여력 시) `docs/UI_GUIDE.md`, `docs/design/README.md` 의 persona 카드 언급

## 작업

### 1. `CLAUDE.md` 전환기 문구 최종 정리

- 22줄 CRITICAL 규칙: "제거하기로 **결정** … 코드에는 아직 페르소나가 남아 있을 수 있다 … 구현은 다음 세션 하네스에서 진행 예정" 같은 **전환기 caveat 를 제거**하고 완료형으로: **"페르소나 개념 제거됨(ADR-067). 모든 사용자가 통합 뷰(rent·food·transport·tuition·tax·visa 6 카테고리)를 본다. Compare 는 페르소나로 분기하지 않고, 온보딩은 도시 선택이다. hero 합산 기본 포함은 rent/food/transport=ON, tuition/tax/visa=OFF 고정."**
- 3줄 서두에 남은 페르소나/전환 관련 caveat 정리.
- **주의**: `docs/plans/...` 참조는 이력으로 남겨도 무방. 다른 CRITICAL 규칙은 건드리지 마라.

### 2. `docs/TESTING.md` §9

- §9.5(persona store) 삭제 → onboarding store 섹션(§9.x)으로 대체.
- settings/compare/categoryInclusion/_layout/hydration/onboarding 섹션을 새 동작(통합 뷰, 고정 default, 도시 선택 온보딩, `data-refresh` 카드)으로 갱신.
- homeTotals lib 섹션 확인(step 3 에서 §7 추가됨 — §9 서술 필요 시 보강).

### 3. `docs/DATA.md` §13.5.1

- persist 키 목록: `persona:v1` → `onboarding:v1`. (잔존 `persona:v1` 키가 무해하게 남는다는 주석 1줄 추가 가능.)

### 4. `docs/ARCHITECTURE.md`

- store 목록: `persona` → `onboarding`. 부팅 hydration 순서 서술에서 persona 언급 교체.

### 5. (여력 시) `docs/UI_GUIDE.md` / `docs/design/README.md`

- persona 카드 언급 → 데이터 최신화 카드 / 도시 선택 온보딩으로 갱신.

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
grep -rn 'persona' docs/TESTING.md docs/DATA.md docs/ARCHITECTURE.md   # 남은 건 이력/ADR 참조 등 의도적 언급만
```

## 검증 절차

1. AC 통과.
2. 체크:
   - CLAUDE.md 22줄이 완료형("제거됨")으로 정리됐고 전환기 caveat 가 사라졌는가?
   - TESTING §7/§9 에 persona store/lib/PersonaCard 항목이 없고 onboarding/homeTotals 가 있는가?
   - DATA persist 키가 `onboarding:v1` 인가?
   - ARCHITECTURE store 목록이 갱신됐는가?
3. `phases/persona-removal/index.json` step 9 → `completed`. (phases/index.json 의 persona-removal → completed 는 execute.py 자동.)

## 금지사항

- `docs/PRD.md` 를 수정하지 마라. 이유: 단일 출처·수정 금지(CLAUDE.md 문서 색인). PRD 의 페르소나 요구가 폐기된 사실은 ADR-067 이 기록.
- ADR-062/ADR-067 항목 본문을 다시 편집하지 마라. 이유: step 0 에서 확정.
- 코드(`src/`·`app/`)를 수정하지 마라. 이유: 문서 전용 step.
- 기존 테스트를 깨뜨리지 마라.
