# Step 1: onboarding-store

페르소나 store 를 통째로 삭제할 것이므로, 거기 묶여 있던 `onboarded` 플래그를 새 단일 목적 store 로 옮긴다. 본 step 은 **추가만** 한다 — persona store 는 아직 그대로 두고(step 7 에서 삭제), 배럴에도 onboarding export 를 **추가**만 한다.

## 읽어야 할 파일

- `docs/plans/persona-removal-city-onboarding.md` §A
- `src/store/settings.ts` — **형틀**. 단일 필드 store 의 가장 단순한 예. 이 구조(persist / isValidPersistedState / normalize 없음 / onRehydrateStorage / INITIAL_STATE named export)를 미러링한다.
- `src/store/persona.ts` — 이전 `onboarded` 플래그 소유 store (참조용, 삭제하지 마라).
- `src/store/index.ts` — 배럴.
- `src/store/__tests__/settings.test.ts` 와 `src/store/__tests__/persona.test.ts` — 테스트 구조 형틀.
- `docs/TESTING.md` §7, §9.8(settings) / §9.5(persona).

## 작업

### 1. `src/store/onboarding.ts` 신규 (settings.ts 미러)

- `export type OnboardingState = { onboarded: boolean }`
- `export type OnboardingActions = { setOnboarded: (next: boolean) => void; reset: () => void }`
- `export const INITIAL_STATE: OnboardingState = { onboarded: false }` — **named export 필수** (app-shell hydration timeout guard 가 참조).
- persist key `'onboarding:v1'`, version 1.
- `isValidPersistedState(v): v is OnboardingState` — `onboarded` 가 boolean 인지 검증.
- `migrate`: v1 stub (settings 패턴).
- `onRehydrateStorage`: 에러 또는 invalid 시 `setState(INITIAL_STATE)` fallback. **silent fail 금지** (CLAUDE.md CRITICAL).
- `export const useOnboardingStore = create<OnboardingState & OnboardingActions>()(persist(...))`.

### 2. `src/store/index.ts` — 배럴에 **추가**

- `export { useOnboardingStore } from './onboarding'` + `export type { OnboardingActions, OnboardingState } from './onboarding'` 추가.
- **`usePersonaStore` / `PersonaActions` / `PersonaState` export 는 남겨둔다.** 이유: `onboarding.tsx` 가 배럴로 `usePersonaStore` 를 import 중 → 지금 제거하면 typecheck 가 깨진다. 제거는 step 7.

### 3. 테스트 `src/store/__tests__/onboarding.test.ts` 신규

persona/settings 테스트 구조 미러: 초기값, `setOnboarded`, `reset`, persist key(`onboarding:v1`), round-trip, 손상 캐시 → INITIAL fallback, (해당 시) hydration race.

### 4. 인벤토리

`docs/TESTING.md` §7 에 onboarding store 항목 신규 추가.

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
npx jest src/store/__tests__/onboarding.test.ts
```

## 검증 절차

1. AC 통과.
2. 체크:
   - `onboarding.ts` 가 settings.ts 패턴을 따르는가? `INITIAL_STATE` 가 named export 인가?
   - 배럴에서 `usePersonaStore` export 가 **여전히 존재**하는가? (제거하면 안 됨)
   - §7 인벤토리에 onboarding store 가 추가됐는가?
3. `phases/persona-removal/index.json` step 1 → `completed`, summary 에 "src/store/onboarding.ts + useOnboardingStore/INITIAL_STATE, persist key onboarding:v1" 기록.

## 금지사항

- 배럴(`store/index.ts`)에서 `usePersonaStore` export 를 제거하지 마라. 이유: `onboarding.tsx`/`_layout.tsx` 가 배럴로 import → 지금 제거하면 typecheck 깨짐. 제거는 step 7.
- `persona.ts` 를 수정/삭제하지 마라. 이유: step 7 담당.
- `hydration.ts` / `_layout.tsx` 를 건드리지 마라. 이유: step 2 담당.
- 기존 테스트를 깨뜨리지 마라.
