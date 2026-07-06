# Step 0: decision-of-record

페르소나 제거 결정 기록(ADR-067)과 CLAUDE.md 가드레일 갱신은 **이 phase 의 계획 커밋에 이미 포함돼 있다** — `docs/ADR.md` 의 ADR-067(전문) + ADR-062 부분 supersede 주석, 그리고 CLAUDE.md 3·10·22줄의 전환기 문구. 본 step 은 그 결정 기록이 실재·정합함을 **확인하는 게이트**다. 정상이면 파일 변경 없음. (하네스가 매 step 프롬프트에 CLAUDE.md 를 가드레일로 주입하므로, 구현 step 들이 CLAUDE.md 규칙과 충돌하지 않도록 이 결정 기록이 먼저 자리잡아 있어야 한다.)

## 읽어야 할 파일

- `docs/plans/persona-removal-city-onboarding.md` — 이 phase 전체의 설계 스펙(단일 출처).
- `docs/ADR.md` — **ADR-067 항목이 이미 존재**함을 확인. ADR-062 "상태" 줄에 ADR-067 부분 supersede 주석이 있는지 확인.
- `CLAUDE.md`(루트) — 22줄 페르소나 CRITICAL 규칙이 전환기 문구(ADR-067 참조, 온보딩=도시 선택, "새 코드는 페르소나를 되살리지 말 것")로 돼 있는지 확인. 3·10줄도 반영됨.

## 작업

### 1. 결정 기록 존재·정합 확인 (기본: 변경 없음)

- ADR-067 이 `docs/ADR.md` 에 있고 Decision(페르소나 제거 / onboarding store 이전 / Compare 항상 6 카테고리 + 고정 default / 온보딩=도시 선택 / Settings 데이터 최신화 카드)과 ADR-062 supersede 를 담고 있는지 확인.
- CLAUDE.md 전환기 문구가 위 결정과 일치하는지 확인.
- **정상이면 아무 파일도 수정하지 마라.** 만약 위 중 하나라도 누락/불일치면, `docs/plans/...` 스펙에 맞춰 그 항목만 보완한다.

### 2. CLAUDE.md 는 재편집하지 않는다

전환기 문구의 최종 정리("코드에 아직 남아 있을 수 있다" 같은 caveat 제거 → 완료형)는 구현이 끝난 뒤 **step 9(docs-reconcile)** 에서 한다. 본 step 에서 CLAUDE.md 를 손대지 마라.

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test   # 코드 무변경 → 기존 그린 유지
grep -n "ADR-067" docs/ADR.md                    # ADR-067 실재 확인
```

## 검증 절차

1. AC 커맨드 통과 (코드 변경 0 → 기존 테스트 그대로 그린).
2. 체크리스트:
   - ADR-067 이 `docs/ADR.md` 에 존재하고 ADR-062 supersede 를 명시하는가?
   - CLAUDE.md 페르소나 규칙이 ADR-067 을 참조하는 전환기 문구인가?
3. `phases/persona-removal/index.json` step 0 → `completed`, summary 에 "결정 기록(ADR-067 + CLAUDE.md 전환기) 확인 완료, 변경 없음" 기록.

## 금지사항

- ADR-067 을 **새로 작성하거나 중복 추가하지 마라.** 이유: 계획 커밋에 이미 존재. 누락이 확인된 경우에만 보완.
- CLAUDE.md 를 편집하지 마라. 이유: 이미 전환기 형태로 갱신됨. 최종 정리는 step 9.
- 코드(`src/`·`app/`)를 변경하지 마라. 이유: 본 step 은 결정 기록 확인 전용. 구현은 step 1~9.
- ADR-062 항목 본문(Decision/맥락)을 편집하지 마라. 이미 있는 supersede 주석 외 추가 변경 금지.
- 기존 테스트를 깨뜨리지 마라.
