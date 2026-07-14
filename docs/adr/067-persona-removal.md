[← ADR 인덱스](../ADR.md)

# ADR-067: 페르소나 개념 제거 + 온보딩 도시 선택 전환 + 통합 카테고리 뷰

**상태:** 결정·승인됨 (2026-07-06). 구현은 다음 세션 하네스에서 진행 예정 — 본 ADR 작성 시점에는 코드에 페르소나가 아직 존재한다. 전환 스펙 단일 출처: `docs/plans/persona-removal-city-onboarding.md`.

**컨텍스트:**

최초 실행 시 페르소나(`'student' | 'worker' | 'unknown'`)를 선택받아 Compare 카테고리 집합(ADR-062 이전부터)과 히어로 합산 기본 포함(ADR-062)을 분기해 왔다. 그러나 유학생·취업자 어느 쪽을 골라도 결과 차이가 작아 선택 가치가 낮고, `'unknown'`(합집합) 동작이 이미 "모든 카테고리를 보여주는 통합 뷰"라 3분기 유지가 store·컴포넌트(`PersonaCard`)·lib(`persona.ts`)·Compare 분기(`getCategoriesForPersona`)·inclusion 기본값(`getDefaultInclusion`)에 걸친 복잡도만 만든다. 온보딩 화면(페르소나 선택)도 실질 가치가 낮아, 사용자가 실제로 원하는 "목적지 도시 선택"으로 대체하는 편이 활성화 UX 에 낫다.

**결정:**

1. **페르소나 개념 완전 제거.** `Persona` 타입(`src/types/city.ts`), `usePersonaStore`(`src/store/persona.ts`), `PersonaCard`(`src/components/`), 라벨/아이콘 맵(`src/lib/persona.ts`) 삭제. 모든 사용자는 통합 뷰(rent·food·transport·tuition·tax·visa 6 카테고리)를 본다.
2. **`onboarded` 플래그를 신규 단일 도메인 store 로 이전.** persona store 삭제로 함께 사라지는 `onboarded` 를 `src/store/onboarding.ts`(persist 키 `onboarding:v1`, ADR-004 도메인 분리 패턴)로 옮긴다. `_layout.tsx` 게이트는 그대로 `onboarded` 만 참조.
3. **Compare 는 항상 6 카테고리.** `getCategoriesForPersona` 를 모듈 상수로 대체. `getDefaultInclusion(category)` / `resolveInclusion(cityId, category, inclusions)` 에서 persona 인자 제거 후 고정 기본값(rent/food/transport ON, tuition/tax/visa OFF — 기존 `'unknown'` 동작과 동일)으로 확정. → **ADR-062 의 persona-aware default 를 고정 default 로 supersede.**
4. **온보딩 = 도시 선택.** `app/onboarding.tsx` 를 도시 리스트(재사용 `RecentRow`/`RegionPill`)로 재작성. 도시 선택 시 즐겨찾기 추가 + `setOnboarded(true)` + 서울 vs 그 도시 Compare(`/compare/{cityId}`)로 직행. 배수 계산은 Home 의 `computeCityTotal`/`multFromTotals` 를 `src/lib/homeTotals.ts` 로 추출·공유(ADR-056 단일 출처 보강).
5. **Settings 페르소나 배지 → 데이터 최신화 카드.** 네이비 히어로 슬롯을 "마지막 동기화 + 새로고침 버튼"(기존 `refreshCache`/`formatLastSync` 재사용) 카드로 교체하고 중복되던 "데이터 새로고침" 메뉴 행 제거.

**대안 검토:**

- (페르소나 내부 `'unknown'` 고정, 선택 UI 만 제거): 변경 최소지만 쓰이지 않는 죽은 개념이 store·타입·분기에 잔존 → 기각.
- (`onboarded` 를 persona store 에 잔류): 도메인 혼선(ADR-004 위반) → 기각. 신규 온보딩 store 로 분리.
- (온보딩 후 홈 착지): 즉시 payoff 약함 → 도시 선택 즉시 Compare 진입으로 결정.

**결과 / 영향:**

- **PRD 편차 기록(수정 금지 준수):** 페르소나(유학생/취업자/모름) 분기는 PRD 레벨 개념이나 `docs/PRD.md` 는 "단일 출처·수정 금지"라 미변경. ADR-066 선례(스펙-구현 격차를 ADR/UI_GUIDE 편차로 추적)와 동일하게 **본 ADR 이 PRD 대비 변경점의 단일 기록**이다.
- **CLAUDE.md 갱신(본 세션):** CRITICAL 페르소나 규칙 폐기·대체, 서두 "페르소나 분기" 문구·store 목록 갱신. 서술형 문서(ARCHITECTURE/DATA/TESTING/UI_GUIDE/design)는 코드와 동기 유지를 위해 **구현 세션에 함께 갱신**.
- **기존 사용자:** 신규 `onboarding:v1` 이 `onboarded=false` 로 출발 → 업데이트 후 도시 선택 온보딩 1회 재노출(수용). 고아 `persona:v1` 키는 무해(선택적 정리).
- **테스트·E2E 파급:** persona 결합 테스트 다수 수정/삭제, `.maestro/common/onboard.yaml`(≈28 플로우 공통 전제) 계약 변경(도시 탭 → compare) 등 스위트 전반 갱신 필요. 상세는 전환 스펙 문서 참조.

**관련:** ADR-062(inclusion·supersede 대상), ADR-056(homeTotals 단일 출처), ADR-052/ADR-004(store hydration·도메인 분리), ADR-066(E2E), `docs/plans/persona-removal-city-onboarding.md`, `docs/PRD.md`.
