[← ADR 인덱스](../ADR.md)

# ADR-050: zustand v4 채택 + persist + AsyncStorage (도메인 store 표준 미들웨어)

**상태:** 채택 (2026-04-29)

**맥락:**

- ADR-004 가 상태 관리 = Zustand + persist 로 결정 (도메인별 분리). 그러나 zustand 메이저 버전은 미정이었고, 본 ADR 시점에 v5 가 stable.
- v5 는 React 18+ `useSyncExternalStore` 를 표준으로 요구하고, `create<T>()(...)` 의 currying API 만 지원 (v4 의 `create((set) => ...)` 비-curried 형태 deprecated).
- 우리 환경: React 19 + RN 0.81 (ADR-044 의 SDK 54 업그레이드). v5 가 `useSyncExternalStore` 를 동일 import 경로로 쓰므로 호환성에 큰 차이는 없으나, RN 0.81 + React 19 조합에서 v5 의 store 인스턴스 lifecycle 회귀 보고가 일부 issue 트래커에 있어 확인 시간이 필요.
- v4 는 currying API 와 비-curried API 모두 지원, persist 미들웨어가 동일 형태, AsyncStorage 어댑터 (`createJSONStorage`) 도 동일.

**결정:**

1. v1.0 의 모든 도메인 store (persona / favorites / recent / settings) 는 **zustand v4** 를 사용한다 (`^4`).
2. 표준 패턴: `create<State & Actions>()(persist((set) => ({...}), { ... }))` 의 v4 currying 형태.
3. persist 옵션 표준:
   - `name: '<domain>:v1'` — DATA.md §13.5.1 단일 출처
   - `storage: createJSONStorage(() => AsyncStorage)`
   - `version: 1` (도메인별 독립 스키마 버전)
   - `partialize`: 액션 제외, state 만 영속화
   - `onRehydrateStorage`: 손상 캐시 (잘못된 JSON / 유효하지 않은 literal) → 초기 상태 fallback. silent fail 금지 — `setState(INITIAL_STATE)` 로 명시 복구.
   - `migrate`: v1 only — stub. v2 도입 시 본 ADR 갱신 + 도메인별 마이그레이션 함수 작성.

**대안 검토:**

- (A) **zustand v5**: 장점 = 최신 API, 작은 번들. 단점 = currying-only, RN 0.81 + React 19 조합 회귀 검증 비용. v1.0 일정 영향. 거부.
- (B) **Redux Toolkit**: 5화면 규모에 과도 (ADR-004 에서 이미 거부).
- (C) **Jotai / MobX**: ADR-004 가 Zustand 채택. 본 ADR 은 버전 핀 결정만.

**결과 / 영향:**

- 4 도메인 store 가 동일 패턴으로 작성 — 신규 store 추가 시 본 ADR 의 옵션 표준만 따르면 됨.
- v5 도입 시점 (사용자 보고 회귀 0건 + 일정 여유) 에 일괄 마이그레이션 — 별도 ADR 로 결정.
- 손상 캐시 처리: `setState(INITIAL_STATE)` 호출이 persist middleware 의 자동 setItem 을 트리거 → INITIAL 직렬화로 storage 가 자연스럽게 정리됨. 별도 `removeItem` 호출은 setState 와 race 위험 있어 사용 안 함.

**알려진 트레이드오프 — `setState` 의 자동 storage write:**

zustand persist 는 모든 `setState` (액션 호출 포함) 후 storage 에 자동 setItem. 즉:

- 메모리 state 만 변경하고 storage 는 그대로 두는 패턴이 불가능 (테스트에서도 storage 직접 setItem 해야 round-trip 검증 가능).
- 손상 fallback 흐름에서 `removeItem(key)` + `setState(INITIAL_STATE)` 순서로 호출하면 setState 의 자동 setItem 이 removeItem 결과를 덮어써 race 발생. 그래서 본 ADR 은 `setState(INITIAL_STATE)` 만 호출 — 다음 부팅 시 INITIAL 직렬화가 정상 fallback.

**관련:** ADR-004 (Zustand + AsyncStorage 도메인 분리), ADR-022 (스키마 마이그레이션 v 접미사), ADR-044 (Expo SDK 54 / React 19), DATA.md §13.5.1 (AsyncStorage 키 카탈로그).
