[← ADR 인덱스](../ADR.md)

# ADR-052: zustand persist 의 JSON.parse 실패 시 hydration 영구 미완 (latent edge case, v1.x defer)

**상태:** 채택 (2026-04-29)

**맥락:**

- zustand v4 persist 미들웨어의 hydrate 함수는 storage 의 deserialize (`createJSONStorage` 의 `JSON.parse`) 가 throw 하면 catch 분기로 진입해 `postRehydrationCallback(undefined, error)` 만 호출하고 `_hasHydrated` 를 true 로 전이시키지 않는다 (`finishHydrationListeners` 도 발화하지 않음).
- 우리 4 store 의 `onRehydrateStorage` 는 error 시 `setState(INITIAL_STATE)` 로 메모리 상태는 정리하나, `_hasHydrated` 는 그대로 false.
- 결과: 사용자 디바이스에서 AsyncStorage 의 한 store entry 가 깨진 JSON 으로 손상된 경우 (예: OS-level write 도중 중단), 부트로더의 `waitForAllStoresHydrated()` 가 영구 hang → splash screen 무한 대기.
- 발생 빈도: 이론상 매우 낮음 (AsyncStorage 의 atomic write 보장 + 정상 종료 흐름). 그러나 0 은 아님.

**결정:**

1. v1.0 은 본 latent edge case 를 **수용**. 부트로더의 hang 은 사용자가 앱 강제 종료 + 재실행 시 zustand persist 의 다음 부팅에서 동일 시나리오 반복 — 사실상 unrecoverable.
2. 단, 우리 store 의 `setState(INITIAL_STATE)` 가 자동 setItem 을 트리거하므로 손상 entry 가 INITIAL 직렬화로 덮어씌워진다. 다음 cold start 에서는 정상 hydration. 즉 **이 setItem write 가 디스크에 도달한 경우에만** 다음 부팅이 정상.
3. **"두 번째 부팅 정상" 의 전제조건 (중요):** `onRehydrateStorage` 의 `setState(INITIAL_STATE)` 가 microtask 로 storage write 를 trigger 하기 **이전** 에 사용자가 splash 무한 대기 → 강제 종료한다면, 손상 JSON 이 그대로 남아 다음 부팅도 동일 hang 반복. 이 경우는 unrecoverable 까지는 아니지만 "두 번째 부팅 정상" 이 보장되지 않음.
4. **app-shell phase 에 강제 요구사항 (ADR-052 의 본 ADR 이 prerequisite):** `app/_layout.tsx` 의 부트로더가 `waitForAllStoresHydrated()` 를 호출할 때 **반드시 timeout guard (3~5 초)** 를 함께 적용해야 한다. timeout 시:
   - 4 store 모두 `setState(INITIAL_STATE)` 강제 호출 → 손상 entry 덮어쓰기
   - SplashScreen.hideAsync() 후 onboarding 으로 진입 (사용자에게 정상 흐름 제공)
   - dev 빌드는 콘솔 warn, 운영 빌드는 sentry-like (v2 이후) 로 보고
5. 본격 native fix 는 v1.x 의 별도 ADR — 옵션:
   - (A) zustand persist 의 onRehydrateStorage error 분기에서 `AsyncStorage.removeItem` + `persist.rehydrate()` 재호출 (race 위험 감수)
   - (B) zustand v5 마이그레이션 시 hydration API 변경 여부 확인
6. 사용자 보고 시점에 본 ADR 갱신 + fix ADR 추가.

**대안 검토:**

- (A) v1.0 에 즉시 fix: timeout 도입은 splash 정상 흐름의 latency 검증 부담 + race 시나리오 새로 발생. v1.0 일정 영향. 거부.
- (B) helper 자체에 timeout: helper 는 단순한 합성 boundary — 도메인 정책이 helper 안에 들어가는 것은 책임 분산. 거부.
- (C) 무시: silent fail 정책 위반 + 사용자 경험 (splash 무한 대기) 명시적으로 인지하지 못한 상태로 남김. 거부.

**결과 / 영향:**

- TESTING.md §9.4.2 의 latent 항목은 v1.0 통과 기준에 포함하지 않음 (체크박스 표시).
- **app-shell phase 가 본 ADR 의 결정 4 (timeout guard) 를 강제 구현해야 함.** 본 ADR 자체로는 hang 을 막지 못하므로 phase 이름을 `app-shell-bootloader-timeout` 같은 step 으로 명시 권장.
- 사용자 부팅 hang 보고 시점에 fix ADR 추가 + native fix 옵션 (A/B) 검토.
- 본 edge case 의 구체 trigger 는 `JSON.parse` 실패 — 사용자 측 직접 storage 조작 외에는 일반 흐름에서 거의 발생 안 함.

**관련:** ADR-050 (zustand v4 + setState 자동 storage write), ADR-051 (waitForAllStoresHydrated boundary), ARCHITECTURE.md §부팅·hydration 순서.
