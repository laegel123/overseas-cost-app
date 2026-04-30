# Step 1: bootloader-timeout-guard

ADR-052 의 **app-shell phase 강제 요구사항** 을 구현한다. `waitForAllStoresHydrated()` 가 영구 hang 하는 latent edge case (zustand persist 의 `JSON.parse` 실패 후 `_hasHydrated` 가 true 로 전이되지 않음) 를 timeout 으로 차단.

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL
- `docs/ADR.md` **ADR-052** (latent hang + app-shell 강제 요구사항 결정 4)
- `docs/ADR.md` ADR-050 (`setState(INITIAL_STATE)` 가 자동 setItem 트리거 — 손상 entry 자동 정리 메커니즘)
- `docs/ARCHITECTURE.md` §부팅·hydration 순서
- `src/store/hydration.ts` (step 0 까지의 helper)
- `src/store/{persona,favorites,recent,settings}.ts` 각 store 의 `INITIAL_STATE` export 여부 확인
- step 0 산출물: `app/_layout.tsx`

## 작업

### 1. `src/store/hydration.ts` 확장

기존 `waitForAllStoresHydrated()` 옆에 timeout guard 헬퍼 추가:

```ts
/**
 * 4 store hydration 을 await 하되 timeout 만료 시 강제로 INITIAL fallback 을 적용한다.
 *
 * ADR-052 강제 요구사항 — zustand persist 의 JSON.parse 실패 시 hasHydrated 가
 * 영구 false 로 남는 latent edge case 를 차단. timeout 시:
 *   1. 미완 store 각각에 setState(INITIAL_STATE) 호출 → persist 가 자동 setItem 트리거,
 *      손상 entry 가 INITIAL 직렬화로 덮어씌워진다 (ADR-050).
 *   2. dev 빌드는 console.warn 으로 보고. 운영 보고는 v2 이후 별도 ADR.
 *
 * @param timeoutMs 기본 5000ms — 정상 hydration 은 콜드스타트에서도 ~수십ms.
 * @returns 항상 resolve. 정상 완료 시 'ok', timeout fallback 시 'timeout'.
 */
export async function waitForStoresOrTimeout(
  timeoutMs?: number,
): Promise<'ok' | 'timeout'>;
```

**구현 윤곽:**

```ts
const DEFAULT_TIMEOUT_MS = 5000;

export async function waitForStoresOrTimeout(
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<'ok' | 'timeout'> {
  const result = await Promise.race([
    waitForAllStoresHydrated().then(() => 'ok' as const),
    new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), timeoutMs),
    ),
  ]);
  if (result === 'timeout') {
    forceInitialOnUnhydratedStores();
    if (__DEV__) {
      console.warn(
        '[app-shell] store hydration timeout (>=' +
          timeoutMs +
          'ms). INITIAL_STATE fallback applied. ADR-052.',
      );
    }
  }
  return result;
}

function forceInitialOnUnhydratedStores(): void {
  // 각 store: hasHydrated() === false 인 경우만 setState(INITIAL_STATE) 호출.
  // store 가 이미 정상 hydrated 면 사용자 데이터를 덮지 않도록 가드.
}
```

### 2. 각 store 의 `INITIAL_STATE` export 보장

`src/store/{persona,favorites,recent,settings}.ts` 가 `INITIAL_STATE` 를 export 하는지 확인. 없으면 추가 (테스트 영향 최소 — 기존 module 구조에 한 줄 추가).

도메인별 분리 원칙 (ADR-004) 위반 아님 — `hydration.ts` 는 ADR-051 의 명시적 boundary 모듈이므로 4 store 를 import 하는 유일한 모듈로 이미 정해져 있음.

### 3. `app/_layout.tsx` 수정

step 0 의:

```ts
waitForAllStoresHydrated().then(() => setStoresHydrated(true));
```

를:

```ts
waitForStoresOrTimeout().then((result) => {
  if (cancelled) return;
  setStoresHydrated(true);
  if (result === 'timeout') setHydrationTimedOut(true);
});
```

`hydrationTimedOut` 상태는 step 2 의 라우팅과 step 3 의 ErrorView 토스트가 참조 — 본 step 은 state 만 노출.

### 4. 테스트 — `src/store/__tests__/hydration.test.ts` 확장

기존 `waitForAllStoresHydrated` 테스트 유지 + `waitForStoresOrTimeout` 케이스 추가:

- 모든 store 즉시 hydrated → `'ok'` 반환, `setState` 호출 없음
- 한 store 만 미완, timeout 만료 → `'timeout'` 반환, 그 store 만 `setState(INITIAL_STATE)` 호출
- 4 store 모두 미완, timeout 만료 → `'timeout'` 반환, 4 store 모두 `setState(INITIAL_STATE)`
- timeout 직전 hydration 완료 → `'ok'` 반환 (race 정확성)
- 정상 완료된 store 는 `forceInitial` 가드로 덮지 않음

`jest.useFakeTimers()` 로 timeout 제어. spy 로 각 store 의 `setState` 호출 검증.

### 5. `app/__tests__/_layout.test.tsx` 확장

step 0 의 테스트에:

- timeout 시나리오 — `waitForStoresOrTimeout` mock 이 `'timeout'` resolve → bootReady 진입 + `hydrationTimedOut` state 활성

### 6. TESTING.md 인벤토리

§N.x (step 0 에서 만든 section) 에 추가:

```
- [ ] hydration timeout (5s) 시 'timeout' 반환 + INITIAL fallback
- [ ] 정상 hydrated store 는 timeout fallback 에서도 보존
- [ ] dev 빌드 timeout warn 로그
```

## Acceptance Criteria

```bash
npm run typecheck \
  && npm run lint \
  && npm test -- --coverage src/store
```

- typecheck / lint 통과
- 모든 hydration 테스트 통과 (기존 + timeout 신규 ~5)
- coverage `src/store/**` threshold 100/90/100/100 유지
- 변경 파일: `src/store/hydration.ts`, `src/store/__tests__/hydration.test.ts`, `app/_layout.tsx`, `app/__tests__/_layout.test.tsx`, `docs/TESTING.md`
- (필요 시) 각 store 파일 — `INITIAL_STATE` export

## 검증 절차

1. AC 명령 실행
2. 체크리스트:
   - timeout 기본값 5000ms? (ADR-052 의 "3~5초" 범위)
   - timeout 시 모든 미완 store 가 INITIAL 로 강제됐는가?
   - 정상 hydrated store 가 fallback 에서 보존되는가?
   - dev 빌드 warn 로그가 출력되는가? (silent fail 금지)
   - production 빌드는 warn 미출력 (`__DEV__` 가드)
3. `phases/app-shell/index.json` step 1 → completed

## 금지사항

- **persist storage 의 `removeItem` 직접 호출 금지.** 이유: ADR-050 의 race trade-off — `setState(INITIAL_STATE)` 가 자동 setItem 으로 손상 entry 를 덮는 흐름이 정해진 패턴. removeItem 은 race 위험.
- **timeout 값을 hardcode 하지 마라.** 이유: 테스트 주입 가능해야 하며, `DEFAULT_TIMEOUT_MS` 상수로 관리. ADR-052 갱신 시 변경 영역 최소화.
- **이미 hydrated 인 store 를 덮지 마라.** 이유: 사용자 데이터 손실. `hasHydrated()` 가드 필수.
- **timeout 시 ErrorView 표시 금지.** 이유: step 3 의 책임. 본 step 은 state 만 노출.
- **production 에서 console.warn 호출 금지.** 이유: 운영 로그 노이즈. `__DEV__` 가드.
- 기존 테스트 깨뜨리지 마라.
