# Step 0: bootloader-hydration

부트로더가 폰트 + 4 store hydration 을 동시 await 하도록 `app/_layout.tsx` 를 확장한다. timeout guard 는 step 1, 라우팅은 step 2, ErrorBoundary 는 step 3, lastSync bridge 는 step 4 — **본 step 은 합성 await 만**.

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL
- `docs/ARCHITECTURE.md` §부팅·hydration 순서 (Promise A/B/C/D/E 합성)
- `docs/ADR.md` ADR-051 (`waitForAllStoresHydrated` boundary), ADR-014 (silent fail 금지)
- `docs/TESTING.md` §3 (테스트 위치), §5 (모킹 규약 — Zustand)
- `app/_layout.tsx` (현재 fonts + splash 만 처리)
- `src/store/hydration.ts` (이미 존재 — `waitForAllStoresHydrated`)
- `src/theme/fonts.ts` (`useAppFonts` 시그니처)

## 작업

### 1. `app/_layout.tsx` 수정

현재:

```ts
const { ready, error } = useAppFonts();
useEffect(() => { if (ready || error) SplashScreen.hideAsync(); }, [ready, error]);
if (!ready && !error) return null;
```

목표 — 폰트 + 4 store hydration 모두 완료해야 자식 트리 렌더:

```ts
const { ready: fontsReady, error: fontsError } = useAppFonts();
const [storesHydrated, setStoresHydrated] = useState(false);

useEffect(() => {
  let cancelled = false;
  waitForAllStoresHydrated().then(() => {
    if (!cancelled) setStoresHydrated(true);
  });
  return () => { cancelled = true; };
}, []);

const bootReady = (fontsReady || fontsError) && storesHydrated;

useEffect(() => {
  if (bootReady) SplashScreen.hideAsync().catch(() => undefined);
}, [bootReady]);

if (!bootReady) return null;
```

핵심 규칙:

- 폰트 실패는 system font 로 fallback 하므로 부팅 진행 (현재 동작 유지). store hydration 실패는 **본 step 에서 처리하지 않음** — step 1 의 timeout guard 가 해결.
- `cancelled` 플래그로 unmount race 방지.
- 자식 트리 (Stack) 는 `bootReady` true 후에만 mount — FOUC + AsyncStorage race 방지 (ARCHITECTURE.md §233).

### 2. import 정리

```ts
import { waitForAllStoresHydrated } from '@/store';
```

`@/store` 는 step 4 of stores phase 에서 이미 hydration helper 를 re-export.

### 3. 테스트 — `app/__tests__/_layout.test.tsx`

테스트 디렉터리가 없으면 신규 생성. jest config 의 testMatch 에 `app/**/__tests__/**` 가 이미 포함돼 있는지 먼저 확인 (없으면 별도 PR 사항이라 본 step 은 통과만 검증).

- mock `@/store` 의 `waitForAllStoresHydrated` → 즉시 resolve → `bootReady` true → Stack 렌더
- mock `useAppFonts` → `{ ready: true, error: null }` 와 `{ ready: false, error: <Error> }` 두 케이스
- hydration 미완 (Promise pending) → 자식 트리 미렌더 (null 반환)
- `SplashScreen.hideAsync` 가 정확히 한 번 호출되는지 spy

mocking 전략: Jest 의 `jest.mock('@/store', () => ({ waitForAllStoresHydrated: jest.fn() }))` + `jest.mock('expo-splash-screen')`.

### 4. TESTING.md 인벤토리 갱신

§7 (또는 적절한 section) 에 본 phase 항목 추가:

```
### N.x app/_layout.tsx (RootLayout 부트로더)
- [ ] 폰트 + 4 store hydration 모두 완료해야 Stack 렌더
- [ ] 폰트 에러 시 system font fallback 으로 진행
- [ ] hydration pending 동안 null 반환 (FOUC 방지)
- [ ] SplashScreen.hideAsync 정확히 1회 호출
```

step 1~4 에서 추가 항목 (timeout, routing, error-boundary, last-sync) 을 같은 section 에 누적.

## Acceptance Criteria

```bash
npm run typecheck \
  && npm run lint \
  && npm test
```

- typecheck / lint 통과 (0 errors / 0 warnings)
- `app/__tests__/_layout.test.tsx` 통과 (4 case 이상)
- 기존 store / lib 테스트 회귀 없음
- 변경 파일: `app/_layout.tsx`, `app/__tests__/_layout.test.tsx` (신규), `docs/TESTING.md`

## 검증 절차

1. AC 명령 실행
2. 체크리스트:
   - `waitForAllStoresHydrated` import 가 `@/store` 통일된 진입점에서 오는가? (개별 파일 import 금지 — 도메인 분리)
   - `cancelled` 플래그로 unmount race 방어?
   - 폰트 에러 시 부팅이 막히지 않는가? (현재 동작 보존)
   - hydration timeout 처리 코드가 본 step 에 들어오지 않았는가? (step 1 영역)
3. `phases/app-shell/index.json` step 0 → completed + summary 한 줄

## 금지사항

- **timeout / setState(INITIAL) 로직 추가 금지.** 이유: ADR-052 강제 요구사항이지만 step 1 의 책임. 본 step 은 합성 await 까지만.
- **라우팅 redirect 추가 금지.** 이유: step 2 의 책임 (`onboarded` 판정 후 `router.replace`).
- **`<ErrorBoundary>` 래핑 금지.** 이유: step 3 의 책임.
- **`meta:lastSync` ↔ store 동기화 호출 금지.** 이유: step 4 의 책임.
- **store 직접 import 금지** (`@/store/persona` 등). 이유: ARCHITECTURE.md 의 단일 진입점 규약. 본 step 은 hydration 합성만.
- **silent fail 금지.** 이유: CLAUDE.md CRITICAL. fonts.error / hydration 실패는 모두 dev 콘솔에 로그.
- 기존 테스트 깨뜨리지 마라.
