# Step 0: pair-store

## 배경

하단 탭 "비교"를 **도시 두 곳을 골라 직접 맞붙이는 화면**으로 바꾸는 phase 의 첫 step 이다. 지금 비교 탭은 자체 화면 없이 `recent[0] ?? favorites[0]` 의 `서울 vs 도시` 로 넘겨주는 지름길이라(ADR-041) 홈·즐겨찾기 탭과 중복이다.

이 step 은 **사용자가 마지막으로 고른 두 도시를 기억하는 store 하나**만 만든다. 화면은 step 1, 비교 화면은 step 2, 상세 화면은 step 3, E2E·문서는 step 4.

전체 설계: `docs/plans/city-vs-city-compare.md` (반드시 읽을 것 — 이 phase 의 단일 기준).

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로, 아래를 반드시 직접 Read 할 것:

- `CLAUDE.md` — CRITICAL 규칙 (strict TS, `any` 금지, 에러 삼킴 금지, 테스트 동시 작성, TESTING 인벤토리)
- `docs/plans/city-vs-city-compare.md` — 설계 전체. 특히 "저장 (신규 store)" 절
- `docs/ARCHITECTURE.md` — 상태 관리·hydration 절
- `src/store/recent.ts`, `src/store/favorites.ts` — 영속화·검증 패턴의 기준
- `src/store/hydration.ts`, `src/store/index.ts` — store 등록 방식
- `src/store/__tests__/recent.test.ts`, `src/store/__tests__/hydration.test.ts` — 테스트 패턴
- `docs/TESTING.md` — store 인벤토리 절 (`recent` / `favorites` 항목이 있는 곳을 찾아 같은 형식으로 추가)

## 작업

### 1. `src/store/comparePair.ts` (신규)

```ts
export type ComparePairState = {
  /** 왼쪽(기준) 칸. 미선택 = null */
  baseId: string | null;
  /** 오른쪽(대상) 칸. 미선택 = null */
  cityId: string | null;
};
export type ComparePairActions = {
  setBase: (id: string) => void;
  setCity: (id: string) => void;
};
export const useComparePairStore: /* zustand persist store */;
```

핵심 규칙:

- AsyncStorage 영속화. storage 키·버전 표기·`merge`/검증 방식은 `recent.ts` 의 기존 패턴을 그대로 따른다.
- 저장값 형식이 깨져 있으면(객체 아님, 필드가 string|null 이 아님) **초기 상태로 되돌린다.** 부분 복구하지 마라 — 이유: 한 칸만 살아남은 반쯤 깨진 상태는 화면에서 구분할 수 없다.
- store 는 도시 id 가 실제 존재하는지 검증하지 않는다. 이유: store 는 도시 데이터(`src/lib/data.ts`)에 의존하지 않는다 — 존재 여부는 step 1 의 화면이 판단한다.
- `baseId === cityId` 를 store 에서 막지 않는다. 이유: 같은 도시 방지는 화면 규칙(반대편 칸에 든 도시는 고를 수 없음)이며, store 는 값만 보관한다.

### 2. 등록

- `src/store/index.ts` 에 store 와 타입 export 추가 (기존 export 형식 그대로).
- `src/store/hydration.ts` 의 대기 목록에 추가. 현재 8개를 대기 중이므로 9개가 된다.
- 두 파일 헤더 주석의 store 개수 표기는 **이미 실제와 다르다** (`hydration.ts` "5 store", `index.ts` "7 도메인 store"). 신규 store 를 언급하는 줄만 추가하고, 기존의 틀린 숫자는 고치지 말고 step summary 에 "기존 주석 개수 불일치"로 보고하라. 이유: 이 phase 범위 밖의 기존 부채다.

### 3. 테스트

- `src/store/__tests__/comparePair.test.ts` (신규): 초기 상태 / `setBase`·`setCity` / 영속화 후 복원 / 깨진 저장값 → 초기 상태 (객체 아님, 필드 타입 오류 각각).
- `src/store/__tests__/hydration.test.ts`: 신규 store 가 대기 목록에 포함됨을 기존 케이스와 같은 형식으로 추가.

### 4. 문서

- `docs/TESTING.md` store 인벤토리에 `comparePair` 항목 추가 (**인벤토리 누락 = step 미완**).
- `docs/ARCHITECTURE.md` 의 store 목록에 한 줄 추가.

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npx jest src/store
npm test
grep -n "comparePair" src/store/index.ts src/store/hydration.ts docs/TESTING.md docs/ARCHITECTURE.md
git diff --stat -- app/ src/components/ data/     # 비어 있음
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트: CLAUDE.md CRITICAL (strict, `any` 금지), 기존 store 패턴과 일관, TESTING 인벤토리 갱신.
3. `phases/city-pair-compare/index.json` 의 step 0 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "store 이름·storage 키·export 이름·hydration 대기 개수·기존 주석 불일치 보고"`
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message": "…"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "…"` 후 즉시 중단

## 금지사항

- `app/` 과 `src/components/` 를 수정하지 마라. 이유: step 1~3 범위, 한 step 한 레이어.
- 좌우 바꾸기(swap) 액션이나 "최근 비교한 쌍" 목록을 추가하지 마라. 이유: 설계 문서의 비목표다.
- store 에서 `src/lib/data.ts` 를 import 하지 마라. 이유: store → lib 데이터 의존이 생기면 hydration 순서가 얽힌다.
- 새 의존성을 추가하지 마라.
- 기존 테스트를 깨뜨리지 마라.
