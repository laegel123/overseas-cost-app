# Step 3: detail-base

## 배경

상세 화면 `app/detail/[cityId]/[category].tsx` 도 왼쪽이 항상 서울이다. step 2 에서 비교 화면이 기준 도시(`base` query param)를 받게 됐고, 도시끼리 모드의 카드를 누르면 `/detail/<cityId>/<category>?base=<base>` 로 들어온다. 이 step 은 상세 화면이 그 `base` 를 처리하게 한다.

용어 (step 2 와 동일):

- **기준 도시 (base)**: 왼쪽. `base` param, 생략 시 `'seoul'`.
- **대상 도시 (city)**: 오른쪽. `cityId` 경로 param.
- **서울 모드**: `base` 없음 또는 `'seoul'`. **현재 동작과 완전히 같아야 한다.**
- **도시끼리 모드**: `base` 가 서울이 아닌 유효한 도시.

전체 설계: `docs/plans/city-vs-city-compare.md` (반드시 읽을 것 — "화면별 동작 4" 절이 이 step 의 기준).

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL: 에러 삼킴 금지, 광고 규칙, Hot 규칙, strict TS, 토큰 단일 출처
- `docs/plans/city-vs-city-compare.md`
- 이 phase ADR (`ls docs/adr | tail -3`), ADR-060 (월세 단일 선택), ADR-061 (학비·세금 시트 선택), ADR-076 (출처 표기 의무)
- `app/detail/[cityId]/[category].tsx` — 전체. 특히 `buildSections`, `selectedRow`/hero 계산, 시트 렌더부, 출처 영역
- `app/detail/__tests__/[category].test.tsx`
- `app/compare/[cityId].tsx` (step 2 산출물) — `base` 처리·오류·정규화·결측 표기·부제 형식을 **같은 방식으로** 맞춘다
- `src/components/TuitionChoiceSheet.tsx`, `src/components/TaxChoiceSheet.tsx` — props (`cityId`, `cityCurrency`, `cityTuition`/`cityTax`, `fx`)
- `src/components/GroceryRow.tsx`, `src/components/cards/HeroCard.tsx` (+ 테스트)
- `src/store/tuitionChoice.ts`, `src/store/taxChoice.ts` — `resolveTaxChoice` 가 entries 없으면 custom 이어도 null 인 점
- `src/lib/format.ts` — `formatMultiplier`·`isHot` 이 0 이하에서 throw 하는 점
- `docs/TESTING.md` — Detail 화면 인벤토리 절, fixture 절 (§7.2.1 다른 카테고리 상세 fixture)

## 작업

### 1. `base` 읽기·오류·정규화

step 2 의 비교 화면과 같은 규칙:

- `base` 없으면 `'seoul'`. 목록에 없는 `base` → `"도시 데이터를 찾을 수 없습니다"`. `base === cityId` → `"같은 도시끼리는 비교할 수 없어요"`.
- `cityId === 'seoul'` 이고 `base` 가 다른 도시 → `router.replace('/detail/<base>/<category>')`.

### 2. 식비·월세·교통·비자

- `buildSections` 의 `seoul` 인자를 기준 도시로 일반화. 왼쪽 열이 기준 도시 값이 된다.
- 비자: 도시끼리 모드에서는 양쪽 모두 실제 값. 서울 모드는 현행대로 왼쪽 0.
- hero·행의 왼쪽 라벨은 기준 도시 한글명. 서울 모드는 현재 문자열 그대로.

### 3. 학비·세금 — 도시별 선택 줄 (도시끼리 모드)

```
 학교 (월 환산)
 밴쿠버  UBC            바꾸기 ›
 토론토  U of Toronto   바꾸기 ›
 ─────────────────────────────
 밴쿠버 310만   ↑1.2×   토론토 372만
```

규칙:

- 도시마다 선택 줄 하나. 줄을 누르면 **그 도시의** `TuitionChoiceSheet` / `TaxChoiceSheet` 가 열린다 — `cityId`·통화·entries 를 그 도시 것으로 넘긴다. 어느 도시의 시트를 열지 상태로 들고 있어야 한다 (지금의 `sheetVisible: boolean` 으로는 부족하다).
- 선택값은 기존 도시별 store (`choices[<도시 id>]`) 를 그대로 쓴다. 서울 모드에서 고른 값과 공유된다. 새 store 를 만들지 마라.
- 왼쪽 값은 `choices[base]`, 오른쪽 값은 `choices[cityId]` 로 각각 resolve 한다. 섞이면 실패다.
- hero caption 은 양쪽 항목 이름이 달라 `` `${카테고리 라벨} · 선택 항목` `` 으로 한다.
- 선택 줄 testID: `detail-picker-city-<도시 id>` (step 4 Maestro 가 의존 — 이름을 바꾸지 마라).
- 두 ChoiceSheet 컴포넌트와 `resolveTuitionChoice` / `resolveTaxChoice` 는 **수정하지 마라**.
- **세금**: 현재 21개 도시 모두 `tax` 데이터가 없고, 그 상태에서는 직접 입력도 동작하지 않는다 (`resolveTaxChoice` → null, 시트는 안내 문구만). 도시끼리 모드의 세금 상세는 현재의 빈 상태("세금 데이터가 아직 준비되지 않았어요")를 **한 번만** 보여준다. 데이터가 있는 경우의 경로는 학비와 공유하고 fixture 로만 검증한다. 세금 입력을 살리려고 store·시트를 고치지 마라 — 이유: 서울 모드 불변 조건에 걸리고, 세금 데이터 채우기는 별도 작업이다.
- 서울 모드의 학비·세금 화면(선택 줄 1개, `detail-picker-change-<kind>`, `detail-picker-empty-<kind>`, hero caption·footer 문자열)은 **현재 그대로**.

### 4. 결측 (도시끼리 모드)

step 2 와 같은 규칙: 서울이 아닌 도시가 한쪽만 값이 없으면 그쪽은 `—`, 배수 미표시 (hero 가운데 배수도 미표시). 0원으로 표시하지 마라. 양쪽 다 없으면 기존 빈 상태. `GroceryRow` / `HeroCard` 의 배수 prop 을 선택적으로 넓히는 최소 변경은 허용 — step 2 에서 `ComparePair` 에 쓴 방식(step 2 summary 참조)과 같은 형태로 맞춘다. 기존 호출·스냅샷 불변. 현재 실데이터에서는 발생하지 않으므로 fixture 로 검증한다.

### 5. 제목·부제·출처

- 제목: 도시끼리 모드 `` `${카테고리} · ${기준} vs ${대상}` ``, 서울 모드 현행 `` `${카테고리} · ${대상}` ``.
- 부제: 도시끼리 모드는 step 2 비교 화면과 같은 형식 (두 통화, 중복·KRW 생략).
- **출처**: 도시끼리 모드에서는 해당 카테고리의 출처를 **도시별로 묶어 둘 다** 보여준다 (도시명 소제목 + 그 도시의 출처 목록, 개수는 합). 이유: ADR-076 — 화면에 나온 값의 출처는 화면에 있어야 하고, 이 모드에서는 왼쪽 값도 실제 통계값이다. 서울 모드는 현행 유지.
- 광고 footer 현행 유지.

### 6. 테스트 — `app/detail/__tests__/[category].test.tsx`

기존 케이스는 **수정하지 않고** 통과. 추가:

- `base` 생략과 `base=seoul` 이 같은 렌더.
- 도시끼리: food / rent / transport 행의 왼쪽 값이 기준 도시 값, 배수 방향.
- visa: 양쪽 실제 값.
- tuition: 선택 줄 2개 렌더, 각 줄 탭 → 그 도시 props 로 시트 오픈, 한쪽 choice 변경 시 반대쪽 값 불변, hero caption.
- tax: 실데이터 형태(양쪽 빈 entries) → 빈 상태 1회. entries 가 있는 fixture → 학비와 같은 구조.
- 한쪽 결측 fixture: `—`, 배수 미표시.
- 출처: 두 도시 묶음 모두 렌더.
- 오류 2종, 정규화(`cityId=seoul&base=tokyo` → `router.replace('/detail/tokyo/<category>')`).

### 7. 문서

- `docs/TESTING.md` Detail 인벤토리에 위 케이스 추가 (**누락 = step 미완**).
- `docs/ARCHITECTURE.md` 라우팅 절의 상세 주소에 `base` 반영.
- `docs/UI_GUIDE.md` 상세 화면 사양에 도시별 선택 줄 서술 추가.

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npx jest app/detail src/components
npm test
git diff -- "app/detail/__tests__/[category].test.tsx" | grep -c "^-[^-]"   # 0 (기존 테스트 줄 삭제·수정 없음)
grep -n "detail-picker-city-" "app/detail/[cityId]/[category].tsx"         # ≥ 1
git diff --stat -- src/lib/ src/store/ src/components/TuitionChoiceSheet.tsx src/components/TaxChoiceSheet.tsx "app/compare/" "app/(tabs)/" data/ .maestro/   # 비어 있음
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트: 서울 모드 무변경(기존 테스트·스냅샷 무수정 통과), 결측을 0원으로 표시하지 않음, 출처 양쪽 표기, 광고 위치 불변, 토큰 외 색상값 없음, strict TS.
3. `phases/city-pair-compare/index.json` 의 step 3 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "도시별 선택 줄 구현 방식(Section/Row 타입 변경 요약), 시트 대상 도시 상태 관리 방식, 넓힌 컴포넌트 prop, 신규 testID 목록, 출처 묶음 testID"`
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message": "…"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "…"` 후 즉시 중단

## 금지사항

- `TuitionChoiceSheet` / `TaxChoiceSheet` / `src/store/` / `src/lib/format.ts` 를 수정하지 마라. 이유: 서울 모드와 공유하는 코드라 회귀 위험이 크고, 이 step 에 필요하지 않다.
- 세금 직접 입력을 동작하게 만들지 마라. 이유: 별도 작업 범위다 (위 3번 참조).
- `app/compare/` 를 수정하지 마라. 이유: step 2 에서 끝났다. 거기서 결함을 발견하면 고치지 말고 summary 에 보고하라.
- 기존 detail 테스트 케이스와 스냅샷을 고치지 마라. 이유: "서울 모드 무변경"의 증거다.
- 상세 화면을 복제한 전용 화면을 만들지 마라 (설계에서 기각).
- 기존 testID 를 바꾸지 마라.
