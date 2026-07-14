[← ADR 인덱스](../ADR.md)

# ADR-014: 에러 핸들링 — 결정적 에러 타입 + silent fail 금지

> **상태**: Active

**결정**: 모든 lib 함수는 명시적 에러 타입을 throw 한다 (`UnknownCurrencyError`, `FxFetchError`, `CityParseError`, `CitySchemaError`, `CityNotFoundError` 등). 화면은 try/catch 로 받아 ErrorView/inline 배지/토스트 중 하나로 사용자에게 노출. silent fail 금지(catch 후 무시 금지).
**이유**: 사이드 프로젝트라도 데이터 신뢰성·운영 가시성이 핵심. 에러를 침묵하면 분기 갱신 시 잘못된 데이터가 누락 없이 반영되어 재현 어려움. 예외 타입을 두면 화면 단의 처리도 결정적.
**트레이드오프**: 보일러플레이트 약간 증가. 에러 타입 카탈로그 유지 필요(ARCHITECTURE.md §에러 핸들링 전략).
