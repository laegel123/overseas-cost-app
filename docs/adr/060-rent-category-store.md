[← ADR 인덱스](../ADR.md)

# ADR-060: 월세 카테고리 — 사용자 단일 선택 + 전역 영속 store (`useRentChoiceStore`)

**상태:** 채택 (2026-05-06)

**맥락:**

월세 (rent) 카테고리는 4 주거 형태 (share/studio/oneBed/twoBed) 의 **합산이 의미 없다** — 한 사람이 4 형태를 동시에 거주하지 않는다. 본 ADR 이전 구현은 두 화면이 의미 mismatch 였다:

- Compare 화면 `RENT_CONFIG.getValue` — `share ?? studio ?? oneBed` fallback 으로 단일값 사용 (사실상 share 기본).
- Detail 화면 hero — 4 형태 단가 **합산** 표시 (예: 35만원 + 65만원 + 120만원 + 180만원 = 400만원). 사용자에게 `↑3.6×` 같은 의미 없는 배수가 노출됨.

사용자 피드백 (2026-05-06): "월세 상세 비교의 경우 주거 형태 값들을 다 더해서 비교할 필요는 없을 것 같아. 셰어하우스를 기본값으로 두고, 상세 화면에서 사용자가 주거 형태를 클릭해서 바꿀 수 있게."  
후속: "상세 화면에서 월세 탭해서 바꾸고 뒤로가기 했을 때 목록에서도 그 값이 유지되어야 해. 그래야 전체적으로 비교를 할 수 있지."

→ Detail 의 선택이 Compare hero / 월세 카드에도 동일 기준으로 반영되어야 도시 간 비교가 일관된다.

**결정:**

1. **Detail 화면**: rent 섹션을 "선택된 행 1 개 기준 비교" 로 전환. 행 탭으로 다른 주거 형태 선택 가능. hero 좌·우값 / 캡션 / footer 가 선택을 따라감.
2. **전역 영속 store** `useRentChoiceStore` (5번째 도메인 store) 신설:
   - `RentChoice = 'share' | 'studio' | 'oneBed' | 'twoBed'` literal union.
   - 초기값 `'share'` — 가장 보편적인 1차 선택지 (유학생·1인 직장인 모두 잠재 사용 형태).
   - `persist key: 'rentChoice:v1'`, partialize state 만 영속, 손상 캐시 → INITIAL fallback (silent fail 금지 — ADR-014 정책 준수).
   - hydration: `waitForAllStoresHydrated` 가 동시 await (5 store).
3. **단일 fallback 정책** `resolveRentChoice(rent, choice)` (순수 함수):
   - 선택 키가 도시 데이터에서 null 이면 `RENT_CHOICE_FALLBACK_ORDER = [share, studio, oneBed, twoBed]` 순서로 첫 non-null 키 반환.
   - 모든 키 null 이면 `null` 반환 (호출자가 "데이터 없음" 분기 처리).
   - Compare 화면 `RENT_CONFIG.getValue` + Detail 화면 selectedRow fallback 이 동일 함수 사용 — 두 화면이 같은 도시 결측 케이스에 같은 결과를 보장.
4. **범위**: 도시 무관한 **전역 단일값**. 사용자 의도 ("전체적으로 비교") + "내 거주 형태" 가 사용자 프로필 속성에 가까움 (페르소나와 동일 결).
5. **영속 vs 세션**: AsyncStorage 영속. 페르소나 / 즐겨찾기 / 최근 / 세팅과 동일 결.

**대안 검토:**

- (A 선택) 전역 단일값 + 영속 store: 사용자 의도 부합, 단순. 채택.
- (B) 도시별 선택 (`Record<cityId, RentChoice>`): 사용자가 도시별로 다른 형태를 보고 싶을 수 있음. 단 이주 결정 단계에서 "내 형태" 는 보통 동일하고, "전체적으로 비교" 라는 사용자 발화와 어긋남. 거부.
- (C) 페르소나 기반 default 만 (학생→share / 직장인→studio): 자동 매핑이지만 사용자가 직접 바꿀 수 없으면 Detail 화면 인터랙션이 무의미. 페르소나 default + 사용자 override 의 결합은 v1.x 후속 (TESTING §9.25 deferred).
- (D) Compare 화면 hero 의 `centerCaption` 에 "share 기준" 명시만 추가 (인터랙션 없음): 의미 mismatch 만 patch — 사용자가 다른 형태로 비교할 수 없어 "도시 비교 도구" 본질 약화. 거부.

**결과 / 영향:**

- Detail rent 화면이 의미 있는 단일 비교 (예: 셰어하우스 35만원 vs 93.1만원 = ↑2.7×) 로 표시.
- Compare 화면 hero / 월세 카드도 동일 기준으로 동기화 → "전체 도시 비교" 의 일관성 확보.
- 사용자가 Detail 에서 oneBed 로 바꾸면 모든 도시의 Compare 카드가 oneBed 기준으로 갱신.
- 새 store 추가 — `hydration.ts`, `store/index.ts`, ADR-004 의 도메인 분리 계속 유지.
- 5 store 가 됐으므로 hydration timeout (ADR-052) `DEFAULT_HYDRATION_TIMEOUT_MS=5000` 영향 없음 (rent choice 는 단일 literal 영속이라 ms 단위).

**Deferred (v1.x):**

- 페르소나 기반 default 선택 (학생: share, 직장인: studio 등) — 페르소나 분기 후속 PR.
- 학비·세금 카테고리도 유사 패턴 (학교/연봉 단일 선택) 으로 확장 가능 — 필요 시 본 store 를 generic `usePreferencesStore` 로 승격 검토.

**관련:** ADR-004 (도메인별 store), ADR-014 (silent fail 금지), ADR-051 (store 추가 시 hydration import 추가 패턴), ADR-052 (hydration timeout), `src/store/rentChoice.ts`, `app/detail/[cityId]/[category].tsx`, `app/compare/[cityId].tsx`, TESTING.md §9.8.1 / §9.24 / §9.25.
