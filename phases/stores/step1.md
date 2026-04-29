# Step 1: favorites-store

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL ("에러 삼키지 않는다" — limit 초과 시 throw 또는 명시 결과)
- `docs/ARCHITECTURE.md` §상태 관리 (`useFavoritesStore` 행)
- `docs/PRD.md` §F7 (즐겨찾기 무제한, 실용상 ≤ 20개) — 단 ARCHITECTURE 의 카탈로그는 50개 hard limit. **TESTING §9.6 의 50개 정책을 우선** (카탈로그·테스트 정합성 우선, PRD 의 "≤ 20" 은 사용 가이드).
- `docs/TESTING.md` §9.6 (`src/store/favorites.ts` 매트릭스 — 9 + 3 + 2 + 2 = 16 케이스)
- `src/lib/errors.ts` — `FavoritesLimitError` 사용 (data-layer phase 에서 카탈로그 정의됨)
- step 0 산출물: `src/store/persona.ts`, `src/store/index.ts` (export 패턴 일치)

## 작업

이 step 은 **즐겨찾기 store + 50개 limit 정책 + bulk 액션** 만 만든다. 다른 store, UI 컴포넌트, 화면은 손대지 않는다.

### 1. `src/store/favorites.ts` 신규 작성

```ts
export type FavoritesState = {
  cityIds: string[];          // 추가 순서 보존, dedupe 보장
};

export type AddResult = { ok: true } | { ok: false; reason: 'limit' };

export type FavoritesActions = {
  add: (cityId: string) => AddResult;       // 50개 도달 시 ok:false
  addMany: (ids: string[]) => AddResult;    // 일부만 추가하더라도 limit 위반 시 ok:false (atomic — 부분 추가 X)
  remove: (cityId: string) => void;          // 미존재는 silent
  removeMany: (ids: string[]) => void;
  toggle: (cityId: string) => AddResult;    // 있으면 remove, 없으면 add (limit 적용)
  has: (cityId: string) => boolean;
  clear: () => void;
};

export const useFavoritesStore = /* create<...>(persist(...)) */;
```

### 2. 정책

- **MAX_FAVORITES = 50** (모듈 const). PRD §F7 의 "≤ 20" 은 사용자 가이드 기준이고, hard cap 은 ARCHITECTURE.md §에러 카탈로그 의 `FavoritesLimitError` 가 정한 50.
- **`add(id)` 흐름:**
  1. `has(id)` true → 이미 있음, `{ ok: true }` 반환 (idempotent)
  2. `cityIds.length >= 50` → `{ ok: false, reason: 'limit' }` (TESTING §9.6 정책)
  3. 그 외 → `[...cityIds, id]` 으로 추가, `{ ok: true }`
- **`addMany(ids)` atomic 정책:**
  - 입력에서 dedupe + 기존 favorites 제외 후 신규 후보만 계산
  - 후보 적용 시 limit 초과하면 → 아무것도 추가 안 함 + `{ ok: false, reason: 'limit' }`
  - 모두 들어가면 순서 보존 추가
- **`remove(id)`:** 없으면 silent (TESTING §9.6 "에러 없이 무시")
- **`toggle(id)`:** has → remove → `{ ok: true }`, 없으면 add (limit 적용)
- **`clear()`:** `[]`
- **persist:**
  - `name: 'favorites:v1'`
  - storage / version / partialize / onRehydrateStorage / migrate 는 step 0 patrón 동일

### 3. 에러 vs 결과 객체 정책

ARCHITECTURE 카탈로그의 `FavoritesLimitError` 는 toast 메시지용 — 에러 throw 가 아니라 **결과 객체 반환** 으로 표현 (TESTING §9.6 `{ ok: false, reason: 'limit' }`). 화면 단 (별도 phase) 에서 reason 을 받아 toast 표시.

본 step 에서 `FavoritesLimitError` 를 throw 하는 액션은 없다. 다만 import 는 두지 않는다 (사용 안 함). **카탈로그 entry 는 v1.x 이후 또는 `addOrThrow` 변형 도입 시 활용** — 문서로만 명시.

### 4. 테스트 — `src/store/__tests__/favorites.test.ts`

TESTING §9.6 매트릭스:

**기본 (9):**
- 초기 `cityIds: []`
- `add('vancouver')` → `['vancouver']` + `{ ok: true }`
- `add('vancouver')` 두 번 → 중복 제거, 길이 1 + `{ ok: true }` (idempotent)
- `add('toronto')` → `['vancouver', 'toronto']` (추가 순서)
- `remove('vancouver')` → `['toronto']`
- `remove('nonexistent')` → 무시
- `has('toronto')` → true
- `has('paris')` → false
- `clear()` → `[]`

**상한·정책 (3):**
- 50개 도달 후 51번째 add → `{ ok: false, reason: 'limit' }`, state 변경 없음
- 49개 + add 1 → 50, OK
- 50개 + remove 1 + add 1 → 50, OK

**Bulk (2):**
- `addMany(['v', 't'])` → 순서 보존, 중복 제거, `{ ok: true }`
- `removeMany(['v'])` → 일부만 제거 가능

**Persist (2):**
- add → reload (모듈 reset) → 같은 배열
- remove → reload → 갱신 반영

**추가 — toggle / atomic addMany (보강):**
- `toggle('vancouver')` 두 번 → 결과 `[]`
- `addMany([...])` 가 limit 위반 → 부분 추가 안 함 (atomic), state 그대로

### 5. `src/store/index.ts` 갱신

```ts
export { usePersonaStore } from './persona';
export type { PersonaState, PersonaActions } from './persona';
export { useFavoritesStore } from './favorites';
export type { FavoritesState, FavoritesActions, AddResult } from './favorites';
```

### 6. 문서

- TESTING.md §9.6 의 시그니처와 본 step 일치 확인 (불일치 시 §9.6 갱신).
- `docs/ADR.md` 에 ADR-N 추가 (선택): "즐겨찾기 limit = 50 vs PRD 의 ≤ 20 — 50 채택, 사용자 권장은 별도 i18n 안내". 또는 step 명세에서만 다루고 ADR 은 skip.

## Acceptance Criteria

```bash
npm run typecheck \
  && npm run lint \
  && npm test -- src/store/__tests__/persona.test.ts src/store/__tests__/favorites.test.ts
```

- typecheck / lint 통과
- favorites.test.ts ~16 케이스 통과 + persona.test.ts (step 0) 회귀 없음
- 새 파일: `src/store/favorites.ts`, `src/store/__tests__/favorites.test.ts`
- 수정 파일: `src/store/index.ts` (export 추가)

## 검증 절차

1. AC 명령 실행
2. **체크리스트:**
   - persist key 가 정확히 `favorites:v1`?
   - MAX_FAVORITES 가 50?
   - `addMany` atomic 정책 (limit 위반 시 부분 추가 X) 테스트?
   - `add` / `toggle` 가 결과 객체 반환?
   - `any` 0건?
3. step 1 status update + summary

## 금지사항

- **`FavoritesLimitError` throw 하지 마라.** 이유: ARCHITECTURE 카탈로그상 화면 단 toast 용이고 store 자체는 결과 객체로 표현 (TESTING §9.6).
- **PRD §F7 의 "≤ 20" 을 hard limit 으로 해석 금지.** 이유: 50 은 카탈로그 + TESTING 의 단일 출처.
- **다른 store, _layout, 컴포넌트 수정 금지.** 이유: 별도 phase.
- **bulk 액션의 부분 추가 금지** (`addMany` 가 limit 위반 시 atomic 하게 거부). 이유: 호출자 (UI) 가 transactional 으로 알 수 있도록 — partial 가 더 복잡한 상태 만든다.
- 기존 테스트 깨뜨리지 마라.
