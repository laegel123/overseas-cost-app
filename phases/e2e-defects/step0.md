# Step 0: grocery-row-new-mult

## 배경

이 phase(`e2e-defects`)는 2026-09-04 Maestro E2E 검증 세션에서 발견된 앱 결함 4건을 수정한다.
이 step 은 **결함 1 — 학비·비자 상세의 배수 오표시** 의 컴포넌트 레이어를 다룬다.

결함 1 요약:

- 학비(tuition)·비자(visa) 는 정책상 서울 값이 0 이다. `src/lib/format.ts` 의
  `computeMultiplier(seoulVal, cityVal): number | '신규'` 는 `seoulVal === 0 && cityVal > 0` 이면 `'신규'` 를 반환한다.
- 상세 화면 `app/detail/[cityId]/[category].tsx` 는 GroceryRow 에 넘길 때
  `mult={typeof mult === 'number' ? mult : 1}` 로 `'신규'` 를 **조용히 `1` 로 강등**한다.
- 원인은 `src/components/GroceryRow.tsx` 의 prop 타입 `mult: number` 가 좁기 때문이다
  (`src/components/ComparePair.tsx` 의 `mult: number | '신규'` 와 불일치).
- 결과: 같은 화면에서 hero 는 "신규", 행은 "1.0×" 라는 모순된 값을 보여준다. 서울 값이 0 인 학비·비자 상세 전반에 영향.

이 step 은 GroceryRow 의 타입을 넓히고 `'신규'` 렌더링을 테스트로 고정한다. **호출부(상세 화면) 수정은 step 1** 에서 한다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라.
문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래 목록을 반드시 직접 Read 할 것:

- `docs/ARCHITECTURE.md`
- `docs/ADR.md` (인덱스 — 관련 ADR 은 `docs/adr/NNN-*.md` 를 골라 읽을 것)
- `docs/UI_GUIDE.md` — §ComparePair("신규" 표기 규칙) 와 §GroceryRow
- `docs/design/README.md` §4 — GroceryRow 의 배수 색상 규칙 근거
- `docs/TESTING.md` §9.20 (`src/components/GroceryRow.tsx` 인벤토리) 와 §9.1 (`format.ts`)
- `src/lib/format.ts` — `computeMultiplier`, `isHot`, `formatMultiplier`, `getMultColor` (둘 다 이미 `'신규'` 입력을 받는다: `isHot('신규') === false`, `formatMultiplier('신규') === '신규'`)
- `src/components/GroceryRow.tsx` — 현재 `mult: number` (26줄 부근), 렌더링은 `isHot(mult)` / `formatMultiplier(mult)` 사용 (59~67줄 부근). **GroceryRow 는 의도적으로 `getMultColor` 를 쓰지 않는다** (파일 내 주석 + `format.ts` 182~184줄 주석 참조).
- `src/components/ComparePair.tsx` — `mult: number | '신규'` 선언(38줄 부근)과 `'신규'` 처리 방식 참고
- `src/components/__tests__/GroceryRow.test.tsx` — 기존 테스트 구조·헬퍼
- `src/components/__tests__/ComparePair.test.tsx` 89~108줄 — `'신규'` 케이스 작성 예시

## 작업

### 1. `src/components/GroceryRow.tsx` — prop 타입 확장

```ts
/** 배수 — `computeMultiplier` 결과 그대로. `'신규'` 는 서울에 없는 항목(학비·비자 등). */
mult: number | '신규';
```

- 렌더링 로직은 그대로 둔다. `isHot(mult)` 와 `formatMultiplier(mult)` 가 이미 `'신규'` 를 처리하므로
  타입만 넓히면 `'신규'` 는 **텍스트 `신규`, hot=false, 색상은 기존 non-hot 규칙(gray; selected 시 white)** 으로 렌더된다.
- 색상 규칙을 바꾸지 마라. GroceryRow 는 ComparePair 와 달리 `getMultColor`(navy) 를 쓰지 않는 것이 설계 결정이다
  (`docs/design/README.md` §4). 이 step 의 목적은 **텍스트 값의 모순 제거** 이지 색상 변경이 아니다.
- `hot` override 의 우선순위(`hot !== undefined ? hot : isHot(mult)`)는 유지한다.

### 2. `src/components/__tests__/GroceryRow.test.tsx` — `'신규'` 케이스 추가

기존 테스트가 배수 텍스트·hot 스타일을 조회하는 방식(testID / getByText / className 단언)을 그대로 따라 다음을 추가한다:

- `mult='신규'` → 배수 텍스트가 정확히 `'신규'` 로 렌더된다 (`'1.0×'` 가 아님).
- `mult='신규'` → hot 아님 (non-hot 색상/스타일, `isHot('신규') === false` 와 일관).
- `mult='신규'` + `hot={true}` → override 가 그대로 적용된다 (hot 스타일).
- `mult='신규'` + `selected={true}` → selected 반전 규칙(white) 유지.

### 3. `docs/TESTING.md` §9.20 인벤토리 갱신

위 케이스들을 `- [x]` 항목으로 추가한다. 형식은 기존 §9.20 항목과 동일 (체크박스 불릿, 굵은 소제목 아래).

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test   # 전부 그린 (GroceryRow 신규 케이스 포함)
grep -n "mult: number | '신규'" src/components/GroceryRow.tsx   # 타입 확장 확인 (1건)
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가? (컴포넌트는 `src/components/`, 테스트는 `__tests__/`)
   - CLAUDE.md CRITICAL 규칙 — `any` 미사용, 매직 컬러값 미사용, Hot 판정은 `isHot` 단일 함수.
   - `docs/TESTING.md` §9.20 인벤토리에 신규 케이스가 추가됐는가? (누락 = step 미완)
3. 결과에 따라 `phases/e2e-defects/index.json`의 step 0 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 에 변경 파일·추가 테스트 수·"호출부 수정은 step 1" 을 기록
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `app/detail/[cityId]/[category].tsx` 를 수정하지 마라. 이유: 호출부 수정은 step 1 의 범위. 타입 확장(widening)만으로 기존 호출부는 컴파일된다.
- `src/lib/format.ts` (`computeMultiplier` / `isHot` / `formatMultiplier` / `getMultColor`) 를 수정하지 마라. 이유: 이미 `'신규'` 를 올바르게 처리한다. 결함은 GroceryRow 의 타입 폭에만 있다.
- GroceryRow 에 `getMultColor` 를 도입하거나 `'신규'` 색상을 navy 로 바꾸지 마라. 이유: GroceryRow 의 색상 규칙은 설계 결정(design/README §4) 이며, 이 step 의 목적은 텍스트 모순 제거다.
- `src/components/ComparePair.tsx` 를 수정하지 마라. 이유: 이미 올바르며, ComparePair 변경은 step 2·3 의 범위.
- 기존 테스트를 깨뜨리지 마라.
