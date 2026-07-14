[← ADR 인덱스](../ADR.md)

# ADR-004: Zustand + AsyncStorage (도메인별 스토어)

> **상태**: Active

**결정**: 상태 관리는 **Zustand**, 영속화는 **`zustand/middleware/persist` + AsyncStorage**. 도메인별 스토어 분리 — `usePersonaStore`, `useFavoritesStore`, `useRecentStore`, `useSettingsStore`.
**이유**:

- 5화면 규모에 Redux 는 과함.
- AsyncStorage 어댑터가 표준화돼 있어 영속화·hydration 보일러플레이트 작음.
- 도메인 분리는 리렌더 범위를 좁히고 테스트 단위를 명확히 함.
  **트레이드오프**: 여러 스토어에 걸친 액션 조합 시 코드가 분산. v1.0 에서는 그런 케이스 없음 (페르소나 변경 → favorites 정리 같은 cross-store 흐름이 없음).
