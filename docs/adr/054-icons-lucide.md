[← ADR 인덱스](../ADR.md)

# ADR-054: 아이콘 라이브러리 = `lucide-react-native`

**상태:** 채택 (2026-04-30)

**맥락:**

- design/README.md §Assets 가 22~25개 line-style SVG 아이콘 카탈로그 정의 + Lucide / Heroicons / Phosphor 같은 라이브러리로 1:1 대체 가능 + **권장: lucide-react-native** (스트로크 스타일 / viewBox 24×24 일치) 라고 명시.
- components phase step 1 (Icon 컴포넌트) 에서 25 아이콘 source 결정 필요. 대안: (A) lucide-react-native 도입, (B) 25 SVG 직접 인라인.
- `react-native-svg` 는 이미 `package.json` 의존성 (peer dep 충족).

**결정:**

1. **lucide-react-native** (`^1.14.0`) 도입. 25 IconName 모두 lucide 의 named export 와 1:1 매핑.
2. 매핑은 `src/components/Icon.tsx` 의 정적 lookup table 로 관리. 이름 변경 / 추가는 본 파일 한 곳만 수정.
3. 시각 정합성은 design/README.md §Assets 와 hifi/_shared.jsx 의 SVG path 와 비교 — 어긋나는 아이콘은 후속 phase 에서 인라인 SVG 로 교체 (별도 ADR 없이 phase 진행 결정).

**대안 검토:**

- (A 선택) lucide-react-native: 일관성 + 디자인 권장 + tree-shake 친화. 채택.
- (B) 25 SVG 직접 인라인: 의존성 0 이지만 ~25 × 평균 5~15 라인 = 수백 라인 boilerplate + 시각 정합 수동 검증 부담. 1인 사이드 프로젝트 시간 비용 과다. 거부.
- (C) Heroicons / Phosphor: design/README.md 가 Lucide 권장. 추가 평가 비용. 거부.

**결과 / 영향:**

- 신규 의존성 1개 (`lucide-react-native@^1.14`). peer dep `react-native` / `react` 만족. tree-shake 로 사용한 25 아이콘만 번들에 포함 — ADR-017 번들 예산 ≤5MB 영향 ~수십 KB 미만.
- `more` 아이콘은 lucide 의 `MoreHorizontal` 사용. design/README.md §9.10 의 "fill circle 3개" 와 시각 차이 가능 — 차후 디자인 검토 시 별도 인라인 교체 가능 (시각 차이는 minor).
- 본 ADR 은 components phase 외 아이콘 직접 import 금지 패턴을 강제하지 않는다 — 사용처는 `<Icon name="..." />` 단일 API 만 노출.

**관련:** ADR-002 (Expo Managed Workflow), ADR-017 (번들 예산), ADR-003 (NativeWind 디자인 토큰), design/README.md §Assets.
