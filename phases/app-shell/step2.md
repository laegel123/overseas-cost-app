# Step 2: persona-routing

부트로더 hydration 완료 후 페르소나 상태에 따라 onboarding 또는 (tabs) 로 redirect 한다. ARCHITECTURE.md §부팅·hydration 순서 의 마지막 줄:

```
└─ if !onboarded → router.replace('/onboarding')
   else          → router.replace('/(tabs)')
```

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL
- `docs/ARCHITECTURE.md` §부팅·hydration 순서, §라우팅
- `docs/PRD.md` — 페르소나 분기 (`student | worker | unknown`)
- `src/store/persona.ts` — `usePersonaStore` shape (`{ persona, onboarded, ... }`)
- `app/onboarding.tsx`, `app/(tabs)/_layout.tsx` (redirect 대상 경로 검증용)
- step 0~1 산출물: `app/_layout.tsx`

## 작업

### 1. `app/_layout.tsx` 라우팅 추가

step 1 까지의 `bootReady` 진입 후:

```ts
import { useRouter, useSegments } from 'expo-router';
import { usePersonaStore } from '@/store';

const router = useRouter();
const segments = useSegments();
const onboarded = usePersonaStore((s) => s.onboarded);

useEffect(() => {
  if (!bootReady) return;
  // expo-router 가 초기 세그먼트를 결정한 후에만 redirect — race 방지
  const isOnAuthFlow = segments[0] === 'onboarding';
  if (!onboarded && !isOnAuthFlow) {
    router.replace('/onboarding');
  } else if (onboarded && isOnAuthFlow) {
    router.replace('/(tabs)');
  }
}, [bootReady, onboarded, segments, router]);
```

핵심 규칙:

- **무한 redirect 방지**: 현재 segment 가 이미 onboarding 이면 redirect 하지 않음 (그 반대도 마찬가지).
- redirect 는 **단방향** — `replace` 이지 `push` 아님. 뒤로가기로 splash 다시 보이지 않게.
- `router.replace('/(tabs)')` — Expo Router 의 group route. PRD 의 5화면 구조 (홈 / 비교 / 상세 / 설정 / 즐겨찾기) 가 (tabs) 그룹 안에 있다고 가정.
- 페르소나 단일 출처는 `usePersonaStore` — `onboarded` 만 라우팅 분기. `persona` 값은 화면 단 책임.

### 2. timeout fallback 시 라우팅

step 1 의 `hydrationTimedOut === true` 경우:

- store 가 INITIAL_STATE 로 강제됐으므로 `usePersonaStore.onboarded` 는 false → `/onboarding` 으로 자연스럽게 redirect.
- 별도 분기 코드 추가 불필요 (단, 본 step 검증 절차에서 확인).

### 3. 테스트 — `app/__tests__/_layout.test.tsx` 확장

step 0~1 의 fonts/hydration mock 에 더해 `usePersonaStore` mock 으로 페르소나 분기 검증:

- `onboarded: false` + 초기 segment `(tabs)` → `router.replace('/onboarding')` 호출
- `onboarded: true` + 초기 segment `(tabs)` → redirect 없음
- `onboarded: true` + 초기 segment `onboarding` → `router.replace('/(tabs)')` 호출
- `onboarded: false` + 초기 segment `onboarding` → redirect 없음 (무한 루프 방지)
- `bootReady === false` 동안에는 `router.replace` 호출 0회

mocking: `jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }), useSegments: () => [...], Stack: ({ children }) => children }))`.

### 4. TESTING.md 인벤토리 추가

§N.x (RootLayout) 에:

```
- [ ] !onboarded → /onboarding redirect
- [ ] onboarded → /(tabs) redirect (only if currently on onboarding)
- [ ] 무한 redirect 방지 (이미 대상 segment 면 no-op)
- [ ] timeout fallback (INITIAL state) → /onboarding 자연 redirect
```

## Acceptance Criteria

```bash
npm run typecheck \
  && npm run lint \
  && npm test
```

- typecheck / lint 통과
- 라우팅 케이스 4종 + bootReady 가드 1종 = 5 case 통과
- 기존 store / lib / step0~1 테스트 회귀 없음
- 변경 파일: `app/_layout.tsx`, `app/__tests__/_layout.test.tsx`, `docs/TESTING.md`

## 검증 절차

1. AC 명령 실행
2. 체크리스트:
   - `router.replace` 만 사용? (`push` 금지)
   - 무한 redirect 가드 작동? (segments 검사)
   - persona 값 (`student/worker/unknown`) 이 라우팅 분기에 영향 없음? (오직 `onboarded`)
   - timeout fallback 흐름이 자연스럽게 onboarding 진입?
3. `phases/app-shell/index.json` step 2 → completed

## 금지사항

- **`router.push` 사용 금지.** 이유: 뒤로가기 스택 오염. splash 직후 redirect 는 항상 replace.
- **`onboarded` 외 값으로 라우팅 분기 금지.** 이유: PRD 의 페르소나 분기는 화면 단 (Compare 카드 구성) 책임. RootLayout 은 부팅 라우팅만.
- **현재 segment 검사 없이 replace 호출 금지.** 이유: 무한 redirect 위험.
- **`usePersonaStore.persist.hasHydrated()` 직접 호출 금지.** 이유: hydration 합성은 `waitForStoresOrTimeout` (step 1) 이 이미 처리. 본 step 은 hydrated 후의 store 값만 사용.
- **새 라우트 / 화면 컴포넌트 작성 금지.** 이유: 라우트는 bootstrap phase 산출물. 본 phase 는 부트로더 로직만.
- 기존 테스트 깨뜨리지 마라.
