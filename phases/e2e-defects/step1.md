# Step 1: detail-mult-passthrough

## 배경

이 phase(`e2e-defects`)는 2026-09-04 Maestro E2E 검증 세션에서 발견된 앱 결함 4건을 수정한다.
이 step 은 **결함 1 — 학비·비자 상세의 배수 오표시** 의 화면 레이어(호출부)를 다룬다.

결함 1 요약:

- 학비(tuition)·비자(visa) 는 정책상 서울 값이 0 이다. `src/lib/format.ts` 의
  `computeMultiplier(seoulVal, cityVal): number | '신규'` 는 서울 0·도시 >0 이면 `'신규'` 를 반환한다.
- 상세 화면 `app/detail/[cityId]/[category].tsx` 의 행 렌더링(586줄 부근)이
  `mult={typeof mult === 'number' ? mult : 1}` 로 `'신규'` 를 `1` 로 강등해 GroceryRow 에 넘긴다.
- 결과: hero 는 "신규", 행은 "1.0×" 라는 모순된 값. 학비·비자 상세 전반에 영향.

**step 0 에서 `src/components/GroceryRow.tsx` 의 prop 이 `mult: number | '신규'` 로 확장됐다.**
이 step 은 강등 코드를 제거해 `'신규'` 를 그대로 전달하고, 화면 테스트로 고정한다.

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래 목록을 반드시 직접 Read 할 것:

- `docs/ARCHITECTURE.md` — 상세 화면 데이터 흐름
- `docs/ADR.md` — 인덱스. 특히 ADR-061(학비·세금 단일 선택 + 시트) 를 골라 읽을 것
- `docs/TESTING.md` §9.25 (`app/detail/[cityId]/[category].tsx` 인벤토리)
- `src/components/GroceryRow.tsx` — step 0 결과 (`mult: number | '신규'`)
- `src/lib/format.ts` — `computeMultiplier`
- `app/detail/[cityId]/[category].tsx` — 행 렌더링 블록(`section.rows.map(...)`, 555~590줄 부근) 과 hero 의 `'신규'` 표기 로직
- `app/detail/__tests__/[category].test.tsx` — 특히 `describe('tuition 카테고리 ...')` 의
  `'서울 학비 데이터 부재 — seoulVal=0 정책'` 테스트(352줄 부근). 현재 row 존재만 단언하고 배수 텍스트는 단언하지 않는다.
  visa 카테고리 describe 가 있는지, fixture 에 서울 visa 가 없는지도 확인할 것.

## 작업

### 1. `app/detail/[cityId]/[category].tsx` — 강등 제거

```tsx
mult={mult}   // computeMultiplier 결과(number | '신규') 를 그대로 전달
```

- 파일 전체에서 `'신규'` 를 숫자로 바꾸는 다른 분기가 없는지 grep (`typeof mult`) 으로 확인한다. hero 쪽의 `'신규'` 표기 로직은 이미 올바르므로 건드리지 않는다.
- `app/compare/[cityId].tsx` 의 `hot={typeof item.mult === 'number' ? isHot(item.mult) : false}` 는 **올바른 코드**다 (hot 판정만 분기, 값은 그대로 전달). 수정 대상이 아니다.

### 2. `app/detail/__tests__/[category].test.tsx` — 회귀 테스트

- tuition: `'서울 학비 데이터 부재 — seoulVal=0 정책'` 테스트를 확장해 해당 row(`detail-row-tuition-UBC`) 안의 배수 텍스트가
  `'신규'` 이고 `'1.0×'` 가 **아님**을 단언한다 (`within(row).getByText('신규')` 등 RNTL 방식).
- visa: fixture 에 서울 visa 값이 없으면 같은 단언을 visa describe 에 추가한다. visa describe 가 없으면 최소 1개(행 배수 = `'신규'`) 를 추가한다.
- 회귀 방지: 서울 값이 있는 카테고리(food 등) 의 행은 여전히 숫자 배수(`×` 포함) 를 표시하는지 기존 테스트가 이미 보장하는지 확인하고, 없으면 1개 추가한다.

### 3. `docs/TESTING.md` §9.25 인벤토리 갱신

추가한 케이스를 `- [x]` 항목으로 기록한다.

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
! grep -q "typeof mult === 'number' ? mult : 1" "app/detail/[cityId]/[category].tsx"   # 강등 코드 제거 확인
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트:
   - `'신규'` → `1` 강등 분기가 파일에 남아 있지 않은가?
   - hero 의 "신규" 와 행의 배수 텍스트가 같은 fixture 에서 일치하는가? (테스트로 확인)
   - `docs/TESTING.md` §9.25 인벤토리에 케이스가 추가됐는가? (누락 = step 미완)
3. 결과에 따라 `phases/e2e-defects/index.json`의 step 1 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 에 변경 파일·추가 테스트 기록
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `typecheck` 가 GroceryRow 타입 때문에 실패하면 `'신규'` 를 다시 숫자로 바꾸는 우회를 하지 마라. 이유: step 0 이 미완이라는 뜻이므로 `error` 로 기록하고 중단한다.
- `src/lib/format.ts` 의 `computeMultiplier` 를 수정하지 마라. 이유: 반환값 `'신규'` 는 설계된 동작이며 hero·ComparePair 가 의존한다.
- `src/components/GroceryRow.tsx` 를 수정하지 마라. 이유: step 0 의 범위. 타입은 이미 확장됐다.
- hero 합산·표기 로직을 변경하지 마라. 이유: 결함은 행 렌더링의 강등뿐이다.
- 기존 테스트를 깨뜨리지 마라.
