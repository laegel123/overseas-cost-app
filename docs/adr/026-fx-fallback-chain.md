[← ADR 인덱스](../ADR.md)

# ADR-026: 환율 fallback chain — open.er-api.com → ECB → 한국은행(수동)

> **상태**: Active

**결정**: 환율 fetch 는 3단계 fallback. 1차 open.er-api.com (자동), 2차 ECB (자동, EUR base 환산), 3차 한국은행 분기별 하드코딩 값 (수동 갱신).
**이유**: 단일 출처 의존 시 운영 리스크 큼. open.er-api.com 운영자 변경·정책 변경 시 사용자에게 환율 표시 실패 → 비교 앱의 핵심 기능 마비. 3중 안전망으로 대비.
**트레이드오프**: 코드 복잡도·테스트 케이스 증가. 단, 각 단계는 독립적으로 동작 → 단위 테스트로 검증 가능 (TESTING.md §9.2).
