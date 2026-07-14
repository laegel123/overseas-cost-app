[← ADR 인덱스](../ADR.md)

# ADR-051: store hydration 합성은 단일 boundary 함수 (`waitForAllStoresHydrated`)

**상태:** 채택 (2026-04-29)

**맥락:**

- 4 도메인 store (persona / favorites / recent / settings) 는 ADR-004·ADR-050 정책에 따라 분리. 각 store 는 zustand persist 의 자체 hydration cycle 을 가진다.
- 부트로더 (`app/_layout.tsx`, app-shell phase 책임) 는 useFonts + 4 store hydration 을 동시 await 후 SplashScreen.hideAsync 를 호출 (ARCHITECTURE.md §부팅·hydration 순서).
- store 끼리는 cross-import 금지 (도메인별 분리 — ADR-004). 그러나 부트로더 단계에서 4 store 모두를 동시에 기다리는 합성 점이 필요.

**결정:**

1. 4 store 의 hydration 동시 await 는 `src/store/hydration.ts` 의 단일 함수 `waitForAllStoresHydrated(): Promise<void>` 가 책임.
2. 본 함수만이 4 store 를 모두 import 하는 유일한 모듈 — 도메인 분리 위반이 아닌 명시적 boundary.
3. 새 store 추가 시 본 함수의 `Promise.all` 인자에 한 줄 추가 (선형 확장).
4. 각 store 의 `persist.hasHydrated()` 가 이미 true 면 즉시 resolve, 아니면 `onFinishHydration` 콜백으로 비동기 wait + resolve 시 unsubscribe 호출 (콜백 누수 방지).

**대안 검토:**

- (A) 부트로더가 직접 4 store 를 import + Promise.all: 부트로더가 store 추가 영향을 받음 + 패턴 노이즈. 거부.
- (B) store index 가 hydration array 를 export: 4 store 간 순서 / 의존성이 노출됨. boundary 가 분산됨. 거부.
- (C) zustand store wrapper 에 helper 통합: zustand v4 default API 와 다른 패턴 도입 → 학습 비용. 거부.

**결과 / 영향:**

- 부트로더는 `await Promise.all([useFonts(...), waitForAllStoresHydrated()])` 한 줄로 4 store hydration 합성.
- 신규 store 도입 시 변경 면적: hydration.ts 에 한 줄, MEMORY.md / TESTING.md §9.4.2 에 한 줄.

**관련:** ADR-004 (도메인 store 분리), ADR-050 (zustand v4 표준), ARCHITECTURE.md §부팅·hydration 순서.
