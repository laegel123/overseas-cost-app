# Step 2: recent-store

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL (any 금지)
- `docs/ARCHITECTURE.md` §상태 관리 (`useRecentStore` 행 — "max 5, FIFO")
- `docs/PRD.md` §F2 (홈) + §F7 ("최근 본 도시는 자동 관리, 최대 5개")
- `docs/TESTING.md` §9.7 (`src/store/recent.ts` 매트릭스 — 8 케이스)
- step 0, 1 산출물

## 작업

이 step 은 **최근 본 도시 store + FIFO 정책 (max 5)** 만 만든다.

### 1. `src/store/recent.ts` 신규 작성

```ts
export type RecentState = {
  cityIds: string[];     // 최신이 [0] 위치, 최대 5개, dedupe 보장
};

export type RecentActions = {
  push: (cityId: string) => void;   // 항상 [0] 으로, 기존 위치는 제거 (dedupe + 최신화)
  clear: () => void;
};

export const useRecentStore = /* create<...>(persist(...)) */;
```

### 2. 정책

- **MAX_RECENT = 5** (모듈 const).
- **push(id) 흐름:**
  1. 기존 cityIds 에서 id 제거 (있으면)
  2. 새 배열 = `[id, ...filtered].slice(0, MAX_RECENT)`
  3. set
- **순서:** 최신이 인덱스 [0]. 컴포넌트가 `cityIds.map(...)` 로 렌더 시 자연스럽게 최신 ↑.
- **persist:** key `recent:v1`, version 1.
- **clear():** `[]`.

### 3. 테스트 — `src/store/__tests__/recent.test.ts`

TESTING §9.7 매트릭스:

- 초기 `cityIds: []`
- `push('vancouver')` → `['vancouver']`
- `push('toronto')` → `['toronto', 'vancouver']` (최신 [0])
- 같은 도시 push (`vancouver` 다시) → `['vancouver', 'toronto']` (최신 위치, 중복 제거)
- 5개 push 후 6번째 push → 마지막 evict (FIFO 끝부터 잘라냄)
- 정확히 5개 시 max 유지
- `clear()` → 빈 배열
- persist round-trip — push → 모듈 reset → 같은 배열

**보강 (선택):**
- 6번째에서 가장 오래된 (마지막) 항목이 evict 되는지 정확 검증
- 빈 문자열 push (정책: `''` 도 허용 — 별도 검증 안 함)

### 4. `src/store/index.ts` 갱신

```ts
export { useRecentStore } from './recent';
export type { RecentState, RecentActions } from './recent';
```

### 5. 문서

TESTING.md §9.7 시그니처 정합성 확인. ADR 추가 불필요 (정책이 명확).

## Acceptance Criteria

```bash
npm run typecheck \
  && npm run lint \
  && npm test -- src/store/__tests__/persona.test.ts src/store/__tests__/favorites.test.ts src/store/__tests__/recent.test.ts
```

- typecheck / lint 통과
- recent.test.ts ~8 케이스 통과 + 회귀 없음
- 새 파일: `src/store/recent.ts`, `src/store/__tests__/recent.test.ts`
- 수정 파일: `src/store/index.ts`

## 검증 절차

1. AC 명령 실행
2. **체크리스트:**
   - MAX_RECENT 가 5?
   - push 가 dedupe + 최신화 (기존 위치 제거 후 [0] 추가) 정확?
   - persist key 가 정확히 `recent:v1`?
   - 6번째 push 시 가장 오래된 항목 evict?
   - `any` 0건?
3. step 2 status update + summary

## 금지사항

- **에러 throw 금지.** 이유: recent 는 자동 관리라 사용자에게 보이는 에러 케이스 없음. 빈 입력 등은 silent.
- **다른 store, UI 수정 금지.**
- **timestamp 추가 금지.** 이유: PRD §F7 은 "최대 5개 FIFO" 만 명세. 시각 정보는 v2 이후. 본 step 은 cityIds 단일 배열만.
- 기존 테스트 깨뜨리지 마라.
