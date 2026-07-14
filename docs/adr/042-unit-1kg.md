[← ADR 인덱스](../ADR.md)

# ADR-042: 사과·양파 단위 — 1kg 통일 (디자인 mock 수정)

> **상태**: Active

**결정**: 데이터 정의 (DATA.md §11.3) 의 `apple1kg` (사과 1kg) 표준 유지. 디자인 mock (`detail.jsx:80`) "사과 1개" 는 디자인 mock 수정 또는 표시 시 strings.ko 의 라벨 ("사과 1kg") 사용. 양파는 `onion1kg`, 디자인 mock 에 항목 추가 (현재 누락).
**이유**: 데이터 단위 일관성 (CPI·통계청은 모두 kg 기준). UI 표시는 strings.ko 분리로 향후 도시별 단위 변경 가능.
**트레이드오프**: 디자인 mock 과 미세한 시각 차이. 디자인 파일은 reference 이지 production 코드가 아니므로 (ADR-012) 허용.
