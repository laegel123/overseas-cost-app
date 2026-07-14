[← ADR 인덱스](../ADR.md)

# ADR-057: borderRadius 토큰 분화 — `button` (14px) / `btn` (10px)

**상태:** 채택 (2026-05-02)

**맥락:**

- screens phase step 3 에서 Settings 페르소나 카드의 "변경" 버튼 (semi-transparent capsule on navy background) 이 시각적으로 14px 모서리보다 작게 디자인됐다. design/README §5 의 Settings 카드 내 "small action chip" 패턴.
- 기존 `button: 14px` 는 검색바·아바타 박스 등 큰 인터랙티브 box 에 사용되며, "변경" 버튼처럼 inline-small chip 에는 과한 라운드.
- 두 크기가 디자인 의도상 별개 토큰 (capsule vs box) 이라 inline 매직 (`rounded-[10px]`) 으로 처리하면 CRITICAL "디자인 토큰 단일 출처" 위반.

**결정:**

1. `tailwind.config.js` borderRadius 에 `btn: '10px'` 토큰 신규 추가.
2. 기존 `button: '14px'` 는 큰 인터랙티브 box (search bar, 아바타, 검색 stub 등) 에 유지.
3. 작은 inline chip 류 (Settings "변경" 버튼, 페르소나 카드 액션) 는 `btn` (10px) 사용.
4. v1.x 디자인 시스템 정밀화 시 의미 기반 이름 (`chip`, `inline-action` 등) 으로 재네이밍 검토.

**대안 검토:**

- (A 선택) 두 토큰 분리 + 명명: 역할 차이 명확. `button` 은 "박스형", `btn` 은 "인라인 chip". CRITICAL 토큰 단일 출처 유지. 채택.
- (B) `button` 만 유지 + 시각 차이 무시: 디자인 의도와 어긋나 v1.x 에서 다시 분리 예정. 거부.
- (C) `rounded-[10px]` 인라인 매직: CRITICAL 위반. 거부.
- (D) 의미 기반 명명 (`chip-action: 10px`) 으로 즉시 분리: 디자인 시스템 정밀화 (v1.x) 까지 명명 안정 어려움. 본 ADR 단계에선 `btn` 임시 명명 유지, v1.x 재네이밍 메모.

**결과 / 영향:**

- `app/(tabs)/settings.tsx` Persona card "변경" 버튼이 토큰 사용으로 인라인 매직 회피.
- `button` / `btn` 두 이름이 혼재해 onboarding 시 학습 비용 약간 증가 — 본 ADR 이 의미 명세.
- v1.x 디자인 시스템 정밀화 단계에서 의미 기반 명명 검토 (별도 ADR).

**관련:** ADR-003 (NativeWind v4), `tailwind.config.js` (borderRadius), design/README §5 (Settings).
