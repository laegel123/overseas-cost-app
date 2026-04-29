# Step 4: store-index-hydration-helper

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL
- `docs/ARCHITECTURE.md` §부팅·hydration 순서 (4 store 동시 await 패턴)
- `docs/TESTING.md` §3 (파일 위치 — `src/__test-utils__/`), §4 (커버리지 목표 — `src/store/**` 100/90/100/100), §5.5 (Zustand 모킹)
- `jest.config.js` (현재 store threshold 비활성 상태)
- step 0~3 산출물: `src/store/{persona,favorites,recent,settings}.ts` + `index.ts`

## 작업

이 step 은 **4 store re-export 통합 + app-shell 용 hydration 헬퍼 + jest threshold 활성화** 의 phase 마무리. 신규 store 추가 없음.

### 1. `src/store/index.ts` 최종 정리

```ts
/**
 * Zustand 스토어의 단일 진입점.
 *
 * 4 도메인 store — 단일 거대 스토어 금지 (ARCHITECTURE.md §상태 관리).
 * 컴포넌트는 본 인덱스에서 import:
 *   import { usePersonaStore, useFavoritesStore } from '@/store';
 *
 * 부트로더 (app-shell phase) 는 4 store 의 hydration 을 동시 await:
 *   await waitForAllStoresHydrated();
 */
export { usePersonaStore } from './persona';
export type { PersonaState, PersonaActions } from './persona';
export { useFavoritesStore } from './favorites';
export type { FavoritesState, FavoritesActions, AddResult } from './favorites';
export { useRecentStore } from './recent';
export type { RecentState, RecentActions } from './recent';
export { useSettingsStore } from './settings';
export type { SettingsState, SettingsActions } from './settings';

export { waitForAllStoresHydrated } from './hydration';
```

### 2. `src/store/hydration.ts` 신규 작성

```ts
/**
 * 4 store 의 hasHydrated() 가 모두 true 가 될 때까지 대기.
 *
 * ARCHITECTURE.md §부팅·hydration 순서 의 Promise B/C/D/E 동시 await 패턴.
 * app-shell phase 의 _layout.tsx 가 useFonts 와 함께 Promise.all 로 합성.
 *
 * 이미 hydrated 면 즉시 resolve. 미완이면 onFinishHydration 등록.
 */
export function waitForAllStoresHydrated(): Promise<void>;
```

**구현:**

```ts
import { usePersonaStore } from './persona';
import { useFavoritesStore } from './favorites';
import { useRecentStore } from './recent';
import { useSettingsStore } from './settings';

function waitOne(store: { persist: { hasHydrated(): boolean; onFinishHydration(cb: () => void): () => void } }): Promise<void> {
  if (store.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = store.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

export function waitForAllStoresHydrated(): Promise<void> {
  return Promise.all([
    waitOne(usePersonaStore),
    waitOne(useFavoritesStore),
    waitOne(useRecentStore),
    waitOne(useSettingsStore),
  ]).then(() => undefined);
}
```

### 3. 테스트 — `src/store/__tests__/hydration.test.ts`

- 모든 store 가 이미 hydrated 상태 → 즉시 resolve (timer 없이도 통과)
- 한 store 만 미완 → 그 store 의 `onFinishHydration` 콜백 호출 시 resolve
- 4 store 모두 미완 → 모든 콜백 호출 후에야 resolve (jest.useFakeTimers + manual trigger)
- 손상된 캐시 (한 store 가 손상) → 해당 store 도 결국 hydrated 상태로 전이 → resolve

테스트 구현 팁:
- `jest.spyOn(usePersonaStore.persist, 'hasHydrated').mockReturnValue(false)` 후 `onFinishHydration` 의 콜백을 manually 발화
- 또는 모듈 mock 으로 store 의 persist 객체를 controlled subject 로 교체

### 4. `jest.config.js` threshold 활성화

```js
coverageThreshold: {
  'src/lib/**': { statements: 100, branches: 95, lines: 100, functions: 100 },
  'src/store/**': { statements: 100, branches: 90, lines: 100, functions: 100 },
  // 후속 phase: components 85/75/85/85, app 75/65/75/75
},
```

`src/store/**` 가 100/90/100/100 통과해야 phase 완료.

### 5. TESTING.md inventory 갱신

- §9.5~9.8 의 각 store 에 본 phase 에서 추가된 항목 (`addMany` atomic, `toggle`, `reset`, hydration helper) 반영.
- 새 §9.x (예: 9.8.1 또는 9.4.2) 로 `waitForAllStoresHydrated` 인벤토리 추가:
  ```
  ### 9.x src/store/hydration.ts (waitForAllStoresHydrated)
  - [ ] 모든 store hydrated → 즉시 resolve
  - [ ] 한 store 만 미완 → 콜백 후 resolve
  - [ ] 4 store 모두 미완 → 모두 완료 후 resolve
  - [ ] 손상 캐시 → fallback 후 resolve
  ```

### 6. ADR (선택)

zustand persist hydration helper 패턴이 본 phase 에서 처음 정의됐으니 짧게 ADR 추가:
- "ADR-N: hydration 헬퍼는 단일 함수 `waitForAllStoresHydrated()` — store 추가 시 본 함수에 한 줄 추가하는 패턴 (Promise.all 인자 확장)."

## Acceptance Criteria

```bash
npm run typecheck \
  && npm run lint \
  && npm test -- --coverage src/store/__tests__
```

- typecheck / lint 통과
- 모든 store 테스트 통과 (persona ~17 + favorites ~16 + recent ~8 + settings ~7 + hydration ~4 = ~52 케이스)
- coverage `src/store/**` 100/90/100/100 통과
- 새 파일: `src/store/hydration.ts`, `src/store/__tests__/hydration.test.ts`
- 수정 파일: `src/store/index.ts`, `jest.config.js`, `docs/TESTING.md`, (선택) `docs/ADR.md`

## 검증 절차

1. AC 명령 실행
2. **체크리스트:**
   - 4 store 모두 export 되는가?
   - `waitForAllStoresHydrated` 가 4 store 의 `onFinishHydration` 모두 처리?
   - jest.config 의 `src/store/**` threshold 100/90/100/100 활성?
   - lib threshold (data-layer phase 에서 설정) 가 깨지지 않았는가?
3. step 4 status update + phase 전체 completed 처리:
   - phases/stores/index.json step 4 → completed
   - phases/index.json 의 stores → completed

## 금지사항

- **`app/_layout.tsx` 수정 금지.** 이유: app-shell phase 책임. 본 step 은 hydration helper export 까지만.
- **새로운 store 추가 금지.** 이유: 4 도메인 store 가 ARCHITECTURE.md 단일 출처. 5번째 store 도입은 별도 ADR.
- **lib threshold 변경 금지.** 이유: data-layer phase 의 결정.
- **store 간 cross-import 금지** (예: persona 가 favorites 를 import). 이유: 도메인별 분리 (ARCHITECTURE.md). hydration helper 만 4 store 를 import 하는 유일한 모듈.
- 기존 테스트 깨뜨리지 마라.
