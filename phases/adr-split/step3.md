# Step 3: verify-gate

`adr-split` phase 의 마지막 step. **검증 전용 게이트**다. 앞선 step 들이 각자 AC 로 자기 검증했지만, 여기서 전체를 end-to-end 로 재확인한다. 모두 정상이면 **파일 변경 없음(diff 0)** 이 정상이다.

## 읽어야 할 파일

- `docs/plans/adr-split-per-file.md` — §검증(end-to-end) 항목이 이 step 의 체크리스트 정본.
- `docs/ADR.md` — 인덱스(68행)로 재작성된 상태.
- `docs/adr/` — 68개 파일(001~068).

## 작업 (검증 위주 — 정상이면 파일 변경 없음)

1. **완전성(bijection)**: 001~068 각 번호마다 `docs/adr/NNN-*.md` 정확히 1개. 총 68개.
2. **인덱스 ↔ 파일 상호 1:1**: `docs/ADR.md` 인덱스 표의 모든 `adr/NNN-*.md` 링크가 실재 파일로 해석되고, `docs/adr/` 의 모든 파일이 인덱스 표에 1행 있다.
3. **백링크 유효**: 각 `docs/adr/NNN-*.md` 상단에 `[← ADR 인덱스](../ADR.md)` 백링크 존재.
4. **잔존 참조 유효**: `grep -rn 'docs/ADR.md' --include='*.md' .` 결과가 전부 존치 인덱스 파일로 착지(끊긴 참조 0). `ADR-NNN` 텍스트 참조는 번호 불변이라 전부 유효.
5. **green gate**: `npm run typecheck && npm run lint && npm test` (코드 무변경 → 회귀 없어야 정상).

**불일치 발견 시**: 원인이 명확하고 국소적이면(예: 인덱스 한 행 누락, 백링크 오타) **그 부분만 보정**한다. 광범위·구조적 문제(다수 파일 누락, 무손실 위반)면 **수정하지 말고** `index.json` 을 `error` 로 마킹하고 구체적 사유를 남긴 뒤 중단한다(해당 step 재실행 필요).

## Acceptance Criteria

```bash
ls docs/adr | wc -l                       # 68
for n in $(seq -w 1 68); do c=$(ls docs/adr/${n}-*.md 2>/dev/null | wc -l); [ "$c" -eq 1 ] || echo "BAD: $n -> $c"; done   # 출력 없음
# 인덱스 링크가 가리키는 파일이 전부 실재하는지
for f in $(grep -Eo 'adr/0[0-9][0-9]-[a-z0-9-]+\.md' docs/ADR.md | sort -u); do [ -f "docs/$f" ] || echo "MISSING LINK TARGET: $f"; done   # 출력 없음
npm run typecheck && npm run lint && npm test
```

## 검증 절차

1. 위 AC 통과(BAD/MISSING 출력 없음).
2. 잔존 `docs/ADR.md` 참조가 전부 인덱스(존치 파일)로 착지하는지 확인(끊긴 참조 0).
3. 아키텍처 체크리스트:
   - 코드·데이터 무변경(docs-only) 유지.
   - CLAUDE.md CRITICAL 규칙 위반 없음.
   - `docs/TESTING.md` §7 인벤토리: 코드/모듈 변경 없음 → **인벤토리 변경 없음**이 정상(문서 구조 변경은 인벤토리 대상 아님).
4. 전부 그린이면 `phases/adr-split/index.json` step 3 → `completed`, summary 에 "bijection 68 + 인덱스↔파일 1:1 + 잔존참조 유효 + green, 파일 변경 없음" 기록. phase 완료.

## 금지사항

- 검증 목적 step 이다. **테스트를 통과시키려 프로덕션 코드를 바꾸지 마라.** 이유: 코드 무변경이 이 phase 의 전제 — 코드 변경이 필요하다는 건 앞 step 의 회귀 신호이므로 보고 대상이다.
- 광범위·구조적 불일치를 이 step 에서 억지로 재작업하지 마라. 이유: 무손실·bijection 위반은 근본 원인이 앞 step 에 있으므로 `error` 로 되돌려 재실행하는 게 안전하다.
- `docs/plans/*.md` 를 편집하지 마라(이력·스펙 문서).
- 기존 테스트를 깨뜨리지 마라.
