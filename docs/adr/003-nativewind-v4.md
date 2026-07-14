[← ADR 인덱스](../ADR.md)

# ADR-003: NativeWind v4 로 스타일링

> **상태**: Active

**결정**: 모든 컴포넌트 스타일은 **Tailwind 클래스 + NativeWind v4** 로 작성. 동적 값·gradient·shadow 같이 NativeWind 로 표현 어려운 토큰만 `src/theme/tokens.ts` 에 보관.
**이유**:

- 디자인 토큰을 `tailwind.config.js` 단일 출처로 모을 수 있어 일관성 강제.
- StyleSheet.create 보일러플레이트 제거.
- 웹 디자인 hifi(JSX with className) 와 멘탈 모델 유사 → 포팅이 쉬움.
  **트레이드오프**: NativeWind v4 는 비교적 신생. Babel/Metro 설정 한 번 정착 필요. 일부 RN 전용 prop(예: `pointerEvents`) 은 `style` 으로 보완.
