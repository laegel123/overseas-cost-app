[← ADR 인덱스](../ADR.md)

# ADR-024: 로깅 정책 — 프로덕션 console.log 제거, warn/error 보존

> **상태**: Active

**결정**: 개발 시 `console.log` 자유 사용. 프로덕션 빌드에서 ESLint `no-console` (`log`/`debug` 만 차단, `warn`/`error` 허용) + Babel `transform-remove-console` 로 자동 제거.
**이유**: 사용자 디바이스에 디버깅 로그 노출 방지. 그러나 warn/error 는 향후 crash reporting 도입 시 출처가 되므로 보존.
**트레이드오프**: 정책 위반 시 즉시 발견 어려움 → ESLint 가 PR/step 단계에서 catch.
