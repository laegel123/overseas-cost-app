# Step 0: persona-store

## 읽어야 할 파일

먼저 아래 파일들을 정독하고 설계 의도를 파악하라:

- `CLAUDE.md` — CRITICAL 규칙 (페르소나 union literal 3 값 고정, `any` 금지)
- `docs/ARCHITECTURE.md` §상태 관리 (4 store 표 — usePersonaStore 행) + §부팅·hydration 순서 + §캐시·오프라인 전략 ("사용자 상태: AsyncStorage 로컬만, 동기화 없음")
- `docs/PRD.md` §F1 온보딩 + §F5 설정 (페르소나 변경)
- `docs/TESTING.md` §9.5 (`src/store/persona.ts` 매트릭스 — 6 + 5 + 3 + 2 + 1 = 17 케이스)
- `src/types/city.ts` (`Persona` literal 타입)
- `src/lib/errors.ts` (필요 시 InvariantError 만 import)
- 참고 — data-layer phase 의 lib 파일 docstring 스타일 (`src/lib/currency.ts`, `src/lib/data.ts`) 을 본 store 도 동일 형식으로 따른다.

## 작업

이 step 은 **페르소나 store + 영속화 + hydration 신호** 만 만든다. 다른 store, `_layout.tsx`, splash 제어는 후속 step / phase 의 책임 — 손대지 않는다.

### 1. `src/store/persona.ts` 신규 작성

Zustand + `persist` 미들웨어 + AsyncStorage 어댑터로 작성. 공개 시그니처:

```ts
import type { Persona } from '@/types/city';

export type PersonaState = {
  persona: Persona;          // 'student' | 'worker' | 'unknown'
  onboarded: boolean;
};

export type PersonaActions = {
  setPersona: (next: Persona) => void;
  setOnboarded: (next: boolean) => void;
  reset: () => void;
};

// 실제 export 는 create<...>() 와 persist({...}) 의 합성 (zustand v4).
export const usePersonaStore = /* create<PersonaState & PersonaActions>(persist(...)) */;
```

**구현 규칙:**

- 초기값: `{ persona: 'unknown', onboarded: false }` (TESTING §9.5 첫 케이스). 모듈 스코프 const `INITIAL_STATE` 로 추출 — `reset()` 와 hydration fallback 이 같은 상수 참조.
- persist 옵션:
  - `name: 'persona:v1'` (TESTING §9.5 명시)
  - `storage: createJSONStorage(() => AsyncStorage)` — `zustand/middleware` 의 `createJSONStorage`
  - `version: 1`
  - `partialize`: 액션은 영속화 X, state 만 (`persona`, `onboarded`)
  - `onRehydrateStorage`: 손상된 캐시 (잘못된 JSON / 알 수 없는 persona literal) 감지 시 초기 상태 fallback + 캐시 정리 (`AsyncStorage.removeItem('persona:v1')`)
  - `migrate`: v1 → v2 시 사용할 자리 — 본 step 은 v1 만, migrate 함수는 stub 으로만 정의 (`(state, version) => state`). 본격 마이그레이션 패턴은 TESTING §9.5 "마이그레이션" 의 미래 케이스. 본 step 은 hook 만 마련.
- 액션 구현은 단순 set:
  - `setPersona`: `set({ persona: next })`
  - `setOnboarded`: `set({ onboarded: next })`
  - `reset`: `set(INITIAL_STATE)` — 단, persist 가 디스크에는 INITIAL_STATE 를 다시 쓴다 (수동 `clearStorage()` 가 아닌 일반 set).

**zustand v4 dependency 추가:**

`package.json` 에 `zustand` 를 `npm install --legacy-peer-deps zustand@^4` 로 추가 (`@react-native-async-storage/async-storage` 는 이미 bootstrap 에서 들어가 있음). zustand v5 는 RN 0.81 + React 19 호환성 검증 필요해 v4 우선 (TESTING §2 표가 v4 가정). v5 도입 시 별도 ADR.

### 2. 테스트 — `src/store/__tests__/persona.test.ts`

TESTING §9.5 매트릭스 그대로 cover. 카테고리:

**기본 동작 (6):**
- 초기 상태 정확히 `{ persona: 'unknown', onboarded: false }`
- `setPersona('student'|'worker'|'unknown')` 각각 state 변경
- `setOnboarded(true)` 변경
- `reset()` → 초기 상태

**영속화 (5):**
- persist round-trip — `setPersona('student')` 후 모듈 reset (jest.resetModules) → 새 import 로 'student' 읽힘
- AsyncStorage 키가 정확히 `persona:v1` 인지 (`AsyncStorage.getItem('persona:v1')` 결과 검증)
- hydration: `usePersonaStore.persist.hasHydrated()` 가 false → true 전이 (시간상 비동기)
- hydration 미완 시 read 는 초기값 반환
- 손상된 캐시 (`'{not json'`) → 초기 상태 fallback + `AsyncStorage.getItem('persona:v1')` 가 null 로 정리됨

**Hydration race (3):**
- hydration 완료 전 `usePersonaStore.getState().persona` 호출 → 초기값
- hydration 완료 후 동일 호출 → 저장된 값
- subscribe 콜백: hydration 후 1회 호출 보장 (`useStore.persist.onFinishHydration`)

**마이그레이션 (2):**
- 본 step 은 v1 only — migrate 함수 spy 가 v1 entry 에 대해 호출되지 않음 (또는 noop) 검증
- 미래 v2 도입 시를 위한 placeholder 테스트 (`it.skip` 또는 단순 noop 호출 검증)

**Selector (1):**
- `usePersonaStore(s => s.persona)` 가 같은 값에 대해 같은 ref 반환 (zustand 의 selector 는 strict equality default — `Object.is`)

**테스트 헬퍼:**
- `beforeEach` 에서 `AsyncStorage.clear()` + `usePersonaStore.persist.clearStorage()` (또는 모듈 reset).
- AsyncStorageMock 은 jest.setup.js 에서 자동 (TESTING §5.1).
- 시간 의존 테스트 (`setTimeout` 류) 가 zustand persist 내부에 있으면 jest.useFakeTimers() — 일반적으론 불필요.

### 3. `src/store/index.ts` 신규 또는 갱신

```ts
export { usePersonaStore } from './persona';
export type { PersonaState, PersonaActions } from './persona';
```

후속 step 들이 추가 export 한다.

### 4. 문서

`docs/TESTING.md` §9.5 는 이미 매트릭스를 담고 있다. 본 step 에서:

- §9.5 의 시그니처가 본 step 의 공개 API (`PersonaState`, `PersonaActions`, action 이름) 와 1:1 일치하는지 확인 — 불일치 시 §9.5 갱신.
- 새 의존성 (zustand v4) 을 `docs/ADR.md` 에 ADR-N 추가:
  - 결정: zustand v4 채택, persist + AsyncStorage 어댑터 사용. v5 보류 (RN 0.81 + React 19 호환성 별도 검증 필요).
  - 대안: Redux Toolkit, Jotai, MobX — bootstrap step 0 의 PRD 에서 zustand 가 이미 결정. 본 ADR 은 버전 핀 명시 + v5 보류 사유.

### 5. 명령

```bash
npm install --legacy-peer-deps zustand@^4
```

`package.json` `dependencies` 에 `zustand` 추가, `package-lock.json` 동기화.

## Acceptance Criteria

```bash
npm run typecheck \
  && npm run lint \
  && npm test -- src/store/__tests__/persona.test.ts
```

- typecheck / lint 통과 (warnings 0)
- persona.test.ts 의 모든 케이스 통과 (~17 케이스)
- 기존 lib 테스트 (errors / citySchema / currency / data / __integration__) 회귀 없음
- 새 파일: `src/store/persona.ts`, `src/store/__tests__/persona.test.ts`
- 수정 파일: `src/store/index.ts` (export 추가), `package.json` + `package-lock.json` (zustand v4), `docs/ADR.md` (+1 ADR)
- `src/store/index.ts` 가 존재하지 않으면 신규 생성

## 검증 절차

1. AC 명령 실행
2. **체크리스트:**
   - 초기 상태가 `{ persona: 'unknown', onboarded: false }` 와 정확히 일치?
   - persist key 가 정확히 `persona:v1` (DATA.md / TESTING §9.5 단일 출처)?
   - `Persona` 타입을 `src/types/city.ts` 에서 import (재정의 X)?
   - `any` 가 없는가? (`grep -n ": any\b" src/store/persona.ts` 0건)
   - 손상된 캐시 시나리오 테스트가 캐시 정리 (removeItem) 까지 검증?
3. `phases/stores/index.json` step 0 status 업데이트:
   - 성공 → `"summary": "usePersonaStore (persona: 'student'|'worker'|'unknown', onboarded). zustand v4 + persist + AsyncStorage. 키 persona:v1, hydration race + 손상 캐시 fallback. 17 테스트 통과."`

## 금지사항

- **다른 store (favorites/recent/settings) 추가 금지.** 이유: step 1, 2, 3 의 책임. 본 step 은 persona only.
- **`app/_layout.tsx` 수정 금지.** 이유: app-shell phase 책임. 본 step 은 store hook 만 만들고, _layout 의 hasHydrated 통합은 별도 phase.
- **`reset()` 가 AsyncStorage 까지 직접 지우는 패턴 금지.** 이유: persist 의 일반 set 흐름이 INITIAL_STATE 를 디스크에 다시 쓰므로 충분. `clearStorage()` 호출은 손상 fallback 의 책임.
- **새로운 에러 클래스 추가 금지.** 이유: data-layer phase 의 카탈로그가 단일 출처. 본 store 는 throw 하지 않는다 (persona literal 3 값으로 type-level 차단).
- **zustand v5 사용 금지** (현재 시점). 이유: RN 0.81 + React 19 호환성 검증 미완. v5 도입 시 별도 ADR.
- **i18n 메시지 / UI 문구 추가 금지.** 이유: 본 step 은 lib + state 한정.
- 기존 테스트 깨뜨리지 마라.
