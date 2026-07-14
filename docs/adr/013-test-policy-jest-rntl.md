[← ADR 인덱스](../ADR.md)

# ADR-013: 테스트 정책 — Jest + RNTL, 모듈별 인벤토리 강제

> **상태**: Active

**결정**: 테스트 러너 Jest, 컴포넌트는 `@testing-library/react-native`, AsyncStorage·fetch·시간·SVG·라우터·Linking 은 표준 모킹 패턴 사용. 모든 신규 모듈은 `docs/TESTING.md` §7 인벤토리에 항목을 추가해야 step 완료로 간주.
**이유**: 하네스의 step AC 는 실행 가능한 명령이어야 하므로 곧 테스트 명령. 인벤토리 강제로 누락 방지. lib 100% / store 100% / 컴포넌트 80%+ 커버리지.
**트레이드오프**: Detox 같은 e2e 자동화 도입은 보류 (수동 체크리스트로 대체). 도입 시 별도 ADR.
