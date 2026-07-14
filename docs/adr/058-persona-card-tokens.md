[← ADR 인덱스](../ADR.md)

# ADR-058: PersonaCard 전용 토큰 — `persona-icon` (12px) / `borderWidth 1.5`

**상태:** 채택 (2026-05-02)

**맥락:**

- PR #18 review round 8 에서 `PersonaCard.tsx` 의 인라인 매직 (`rounded-xl` Tailwind 기본 12px, `border-[1.5px]` arbitrary value) 가 CRITICAL 디자인 토큰 단일 출처 규칙 위반으로 지적됨.
- 44×44 PersonaCard 아이콘 박스의 라운드는 `icon-sm: 10px` 와 `icon-md: 16px` 사이 중간값 (12px) — 기존 토큰으로 정확히 매핑 불가.
- primary variant 의 1.5px orange ring 은 design/README §1 Onboarding 카드 시각 강조 의도 — 표준 1px (`border`) 또는 2px (`border-2`) 로 대체 시 디자인 의도 손상.

**결정:**

1. `tailwind.config.js` borderRadius 에 `'persona-icon': '12px'` 토큰 신규 추가 (`hero-icon: 18px` 와 명명 패턴 일관 — 컴포넌트별 icon 박스 토큰).
2. `tailwind.config.js` borderWidth 에 `'1.5': '1.5px'` 토큰 신규 추가 — PersonaCard primary 강조 ring 전용.
3. PersonaCard 의 `rounded-xl` → `rounded-persona-icon`, `border-[1.5px]` → `border-1.5` 로 교체.

**대안 검토:**

- (A 선택) 두 토큰 신설: 디자인 의도 보존 + CRITICAL 토큰 단일 출처 유지. 두 토큰 모두 컴포넌트 한정 사용이라 generic 명명 회피. 채택.
- (B) `rounded-icon-md` (16px) 또는 `rounded-icon-sm` (10px) 로 강제 매핑: 시각 차이 발생. 거부.
- (C) borderWidth `border` (1px) 또는 `border-2` (2px) 로 대체: orange ring 강조 효과 약화. 거부.

**결과 / 영향:**

- PersonaCard 토큰 단일 출처 회복.
- `persona-icon` 은 PersonaCard 외 사용처 없음 — v1.x 디자인 시스템 정밀화 시 generic `icon-md-sm` 등으로 재네이밍 검토.
- `borderWidth 1.5` 는 generic 토큰이라 추후 다른 컴포넌트에서도 재사용 가능.

**관련:** ADR-003 (NativeWind v4), ADR-057 (`btn`/`button` 토큰 분화), `tailwind.config.js`, `src/components/PersonaCard.tsx`, design/README §1 (Onboarding).
