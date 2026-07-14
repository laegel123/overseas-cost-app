[← ADR 인덱스](../ADR.md)

# ADR-012: 디자인 hifi 는 웹 React 레퍼런스 — RN 으로 1:1 포팅

> **상태**: Active

**결정**: `docs/design/hifi/*.jsx` 는 div/className 기반 웹 React 코드다. RN 으로 옮길 때 div→View, span→Text, className→NativeWind 로 1:1 포팅하고, 디자인 토큰·간격·레이아웃은 그대로 보존한다.
**이유**: 디자이너의 의도가 픽셀 수준으로 명세돼 있어 시각 일관성 유지가 쉬움. 새로 디자인을 다시 그리지 않는다.
**트레이드오프**: 일부 웹 전용 속성(`overflowX`, CSS gradient text 등)은 RN 호환 형태로 변환 필요. NativeWind 클래스가 매칭되지 않는 토큰은 `src/theme/tokens.ts` 와 inline `style` 로 처리.
