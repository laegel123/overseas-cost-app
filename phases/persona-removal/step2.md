# Step 2: boot-wiring

부트 경로의 페르소나 참조를 새 onboarding store 로 재배선한다. 게이트가 읽는 `onboarded` 플래그와 hydration 대기 목록을 persona→onboarding 으로 교체한다. **로직은 동일** — `onboarded` 값만 사용하고 게이트 분기는 그대로.

## 읽어야 할 파일

- `docs/plans/persona-removal-city-onboarding.md` §A
- `src/store/onboarding.ts` (step 1 산출물 — `useOnboardingStore`, `INITIAL_STATE`)
- `src/store/hydration.ts` — 29줄 import, 67줄 `waitOne(...)`, 124~126줄 forceInitial 블록.
- `app/_layout.tsx` — 12줄 배럴 import, 25줄 `onboarded` selector, 60~69줄 게이트.
- `app/__tests__/_layout.test.tsx`, `src/store/__tests__/hydration.test.ts`.

## 작업

### 1. `app/_layout.tsx`

- 12줄 배럴 import: `usePersonaStore` → `useOnboardingStore`.
- 25줄: `const onboarded = useOnboardingStore((s) => s.onboarded);`
- 60~69줄 게이트 로직은 그대로(onboarded 만 사용, persona 값 무관).

### 2. `src/store/hydration.ts`

- 29줄 import: `{ INITIAL_STATE as PERSONA_INITIAL, usePersonaStore } from './persona'` → `{ INITIAL_STATE as ONBOARDING_INITIAL, useOnboardingStore } from './onboarding'`.
- 67줄 `waitOne(usePersonaStore)` → `waitOne(useOnboardingStore)`. **배열 첫 번째 위치 유지** — `hydration.test` 가 `setStateSpies[0]` 를 대표 store 로 인덱싱한다. 순서를 바꾸지 마라.
- 124~126줄 forceInitial 블록의 `usePersonaStore` / `PERSONA_INITIAL` → onboarding 으로 교체.

### 3. 테스트 갱신

- `app/__tests__/_layout.test.tsx`: persona mock → onboarding store mock 스왑. 게이트 로직은 동일하므로 `onboarded` true/false 케이스만 유지.
- `src/store/__tests__/hydration.test.ts`: persona→onboarding 스왑(~20곳). 첫 배열 위치를 유지하면 `setStateSpies[0]` 인덱싱은 그대로 유효.

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
npx jest app/__tests__/_layout.test.tsx src/store/__tests__/hydration.test.ts
```

## 검증 절차

1. AC 통과.
2. 체크:
   - hydration `waitOne` 목록에서 onboarding store 가 **persona 가 있던 첫 위치**에 있는가?
   - `_layout` 게이트가 `useOnboardingStore.onboarded` 를 읽는가?
   - 배럴 `usePersonaStore` export 는 여전히 존재하는가? (settings/compare 가 아직 사용 — 제거 금지)
3. `phases/persona-removal/index.json` step 2 → `completed`.

## 금지사항

- hydration store 배열의 순서를 바꾸지 마라(특히 첫 위치). 이유: `hydration.test` 가 `setStateSpies[0]` 로 대표 store 를 인덱싱 → 순서 변경 시 테스트 대량 실패.
- 배럴 `usePersonaStore` export 를 제거하지 마라. 이유: settings/compare/onboarding.tsx 가 아직 사용. 제거는 step 7.
- `settings.tsx` / `compare/[cityId].tsx` / `onboarding.tsx` 를 건드리지 마라. 이유: 각 step 담당.
- 기존 테스트를 깨뜨리지 마라.
