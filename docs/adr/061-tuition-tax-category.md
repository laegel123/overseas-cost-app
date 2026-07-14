[← ADR 인덱스](../ADR.md)

# ADR-061: 학비·세금 카테고리 — 도시별 단일 선택 + 직접 입력 + 바텀시트 (`useTuitionChoiceStore` / `useTaxChoiceStore`)

**상태:** 채택 (2026-05-06)

**맥락:**

학비 (tuition) / 세금 (tax) 카테고리는 ADR-060 의 월세와 같은 "합산 의미 없음" 문제를 가졌고, 추가로 **두 가지 비대칭 버그**를 동시에 안고 있었다:

1. Detail vs Compare 비대칭 — Compare `TUITION_CONFIG.getValue` 는 `city.tuition[0]` 로 단일값을 만들어 카드를 렌더했지만, Detail `buildSections('tuition')` 은 인덱스 매핑 `seoulEntries[idx] ?? seoulEntries[0]` 로 city entries 를 서울 entries 에 강제 매칭했다. 서울 JSON 에 의도적으로 `tuition` 필드가 없으므로 (한국 거주 기준 — 학비/세금 0원 정책), Detail 의 모든 row 가 `flatMap` 에서 잘려 빈 섹션 + "학비 데이터가 아직 준비되지 않았어요." 가 노출됐다. 사용자 보고 (2026-05-06): "목록에서는 학비가 나와있는데 클릭해서 상세 비교 화면 들어가면 학비 데이터가 없다고 나와."
2. 단순 합산 의미 부족 — Detail hero 가 cityEntries 의 모든 학교/연봉 단가 합을 표시했고, 학교별 단가 편차가 매우 커서 (예: Sorbonne 3,800 EUR vs Sciences Po 14,500 EUR vs École Polytechnique 15,000 EUR) 합계는 이상치 (월 480만원 가까이) 가 나왔다. "한 사람이 3 학교를 동시에 다닐 수는 없다" — 월세 합산과 같은 결함.

추가로 사용자는 **등록된 학교/연봉 라인업 외 임의의 값** (예: "내가 합격 통보받은 ${X} 대학"·"내 실제 연봉 ${Y}") 을 직접 입력하고 싶어했다.

→ 단순히 ADR-060 의 단일 선택 패턴을 재사용하는 것 만으로는 부족 (도시별 라인업이 다름 + 직접 입력 필요). 화면 디자인도 4 형태 라디오 (월세) 와 달리 학교 수가 도시별로 1~10+ 으로 가변이라 인라인 행 cycle 이 비현실적.

**결정:**

1. **Detail 화면**: tuition / tax 섹션을 "행 1 개 (현재 선택)" 으로 전환. row 탭 → **바텀시트** 오픈 — 시트 안에 도시 등록 학교/연봉 목록 + "직접 입력" 행 → 입력 모드 전환. ADR-060 의 rent (인라인 cycle) 와 의도 차이: rent 는 4 형태 고정이라 인라인이 빠르고, tuition/tax 는 가변 N 개 + 임의 입력이라 시트가 압축적.
2. **두 개의 도메인 store** `useTuitionChoiceStore` + `useTaxChoiceStore`:
   - `TuitionChoice = { kind: 'preset'; school: string } | { kind: 'custom'; annual: number }` discriminated union.
   - `TaxChoice = { kind: 'preset'; annualSalary: number } | { kind: 'custom'; annualSalary: number }`.
   - **도시별 map** `Record<cityId, choice>` — ADR-060 의 rent 와 다름 (rent 는 전역 단일값). 도시별 학교 라인업이 완전히 다르고 (Sorbonne vs UBC vs NYU) 도시 전환 시 재선택 강요는 UX 손실.
   - persist key `tuitionChoice:v1` / `taxChoice:v1`. partialize state 만 영속, 손상 캐시 → INITIAL fallback (ADR-014 silent fail 금지).
   - hydration: `waitForAllStoresHydrated` 가 동시 await (이제 7 store).
3. **단일 fallback 정책** `resolveTuitionChoice` / `resolveTaxChoice` (순수 함수):
   - `preset` 매칭 실패 (학교/연봉 사라진 케이스 — 데이터 자동 갱신 후) → entries[0] fallback.
   - `custom` → entries 무시하고 사용자 입력 그대로. tax 의 경우 takeHomePctApprox 는 도시 첫 preset 의 값을 차용 (단순화 — v1.x 에서 정밀화).
   - entries 부재 + custom → tuition 은 custom 그대로 / tax 는 null (takeHomePct 차용 불가).
4. **Compare 화면 동기화** (ADR-060 follow-up): `TUITION_CONFIG.getValue` / `TAX_CONFIG.getValue` 가 동일 resolver 호출 → Detail 에서 바꾼 학교/연봉/직접 입력값이 Compare hero / 카드에도 즉시 반영. CategoryConfig signature 확장 — `getValue` 가 `(city, fx, rentChoice, tuitionChoice, taxChoice)` 모두 수신 (다른 카테고리는 무시).
5. **서울 데이터 결측 정책 명시화**: 서울 JSON 에 의도적으로 tuition/tax/visa 가 없다 (한국 거주 기준 — 외국 거주자 학비/세금 외 시점 0원). Detail 의 tuition/tax row 는 `seoulVal: 0` 직접 사용 (visa 와 동일 패턴). 인덱스 매핑 require-Seoul-entry 정책 폐기.
6. **공유 컴포넌트** `BottomSheet` (RN Modal 기반), `TuitionChoiceSheet`, `TaxChoiceSheet`: design/UI_GUIDE §시트 (top corners 22, white bg, navy text) 준수. 외부 영역 탭 dismiss + Android `onRequestClose`. 입력 시 `KeyboardAvoidingView` 로 키보드 가림 회피.
7. **새 토큰** `SHEET_BACKDROP_COLOR = 'rgba(17, 38, 60, 0.4)'` (`src/theme/tokens.ts`) — NativeWind className 으로 alpha 표현이 어려워 inline style 로 적용. 매직 컬러 금지 정책 유지.

**대안 검토:**

- (A 선택) 도메인 store 2 개 + 도시별 map + 시트 + 직접 입력: 사용자 의도 부합, 비대칭 버그 fix, 임의 입력 지원. 채택.
- (B) 단일 통합 store `useDetailChoicesStore` (tuition + tax + 미래 visa preset 등): 두 카테고리가 너무 비슷해 묶고 싶었지만 ADR-004 의 도메인별 분리 정책 + persist key 분리 + 손상 캐시 격리 가치가 더 큼. 거부 (필요 시 v1.x 에서 통합 검토).
- (C) 페르소나 기반 자동 매칭 (학생→첫 학교 / 직장인→평균 연봉): 데이터로는 가능하지만 사용자가 직접 바꿀 수 없으면 Detail 의 인터랙션이 무의미. (ADR-060 alt-C 와 동일 결론.)
- (D) 인덱스 매핑 그대로 두고 Seoul 데이터에 placeholder tuition/tax 추가: 서울에 0원 entry 를 박으면 Detail row 가 mount 되지만 데이터 의미 왜곡 (서울에서도 학비 비교가 가능한 듯한 표기). 거부.
- (E) 시트 대신 인라인 라디오 (월세와 동일 패턴): 학교가 1~10+ 가변이고 직접 입력 인라인 입력 폼은 화면을 어지럽힘. 거부.
- (F) 학비/세금 키 = 인덱스 (`{ kind: 'preset', index: number }`): 데이터 갱신으로 학교 추가/제거되면 인덱스가 silently 다른 학교를 가리킴 (resilience 부족). 학교 이름 / annualSalary 값으로 키 → 매칭 실패 시 entries[0] fallback 이 더 안전. 거부.

**결과 / 영향:**

- Detail tuition/tax 가 의미 있는 단일 비교 + 사용자 임의 값 적용 가능.
- 사용자 보고 비대칭 버그 (목록엔 학비 있고 상세는 없다) 즉시 해소.
- Compare hero / 카드도 동일 기준 — 도시 비교 일관성 확보.
- store 2개 추가 — 7 store 가 됐으나 hydration timeout (ADR-052) 영향 없음 (도시별 map 영속화도 ms 단위).
- 새 컴포넌트 3 개 (BottomSheet, TuitionChoiceSheet, TaxChoiceSheet) — 시트 패턴이 v1.x 의 다른 시트 (Sheet A 가정값 / Sheet B 페르소나 변경 / Sheet C 출처) 구현에서도 재사용 가능 (UI_GUIDE.md §시트 콘텐츠 사양 의 미구현 시트들).

**Compare 의 '신규' 배지 정책 (PR #25 review 명시):**

Compare 화면에서 학비·세금 카드는 `seoulVal=null` (서울 데이터 부재) → `mult='신규'` 로 처리한다. 이는 visa 카드와 동일한 패턴 — "서울에는 없고 도시에만 발생하는 비용" 임을 한눈에 보여주기 위함. Detail 에선 같은 카테고리도 `seoulVal=0` 으로 직접 사용해 hero 좌·우값에 "0원 vs N원" 으로 표시 — 사용자가 정확한 도시 비용을 0 기준으로 파악하기 위함. 즉 **두 화면이 의도적으로 다른 표현** (Compare = 한 줄 카드라 "신규" 시각 압축 / Detail = 본격 비교라 0 vs N 수치). v1.x 에서 사용자 피드백으로 통일 검토 가능.

**Deferred (v1.x):**

- 페르소나 기반 default 학교/연봉 (학생 → 첫 학교, 직장인 → 평균 연봉 tier).
- 학비 level 매칭 (undergrad/graduate) 으로 정밀화 — 현재 모든 학교를 동등하게 다룸.
- tax 의 takeHomePctApprox 보간 (사용자 custom annualSalary 와 가장 가까운 두 preset 사이 선형 보간) — 현재 첫 preset 값 차용.
- 시트 swipe-down dismiss (UI_GUIDE §295) — 현재 backdrop 탭 + Android 백버튼만.
- 직접 입력값의 KRW 환산 라이브 미리보기 (사용자 입력 시).
- `TaxChoice` discriminated union 의 두 variant 가 현재 동일한 필드 (`annualSalary`) 만 가지지만, custom variant 가 메모·메타 필드를 추가할 가능성을 위해 `kind` 분기 유지 (PR #25 4차 review).
- `useChoiceSheetState` 공통 훅 추출 — `TuitionChoiceSheet` / `TaxChoiceSheet` 가 `mode` / `draft` / `handleSaveCustom` / `handleClearCustom` / `isValidDraft` / `useEffect` 패턴을 거의 동일하게 공유. 현 규모 (2 시트) 에선 추상화 비용이 더 큼. 3개 이상으로 확장 시 추출.
- **persist v2 마이그레이션 시 `migrate` 함수 구현 필요** (PR #25 5차 review). 현재 `migrate: (persistedState) => persistedState as TuitionChoiceState` / `as TaxChoiceState` 는 **no-op** — v1 이 유일 버전인 동안엔 `isValidPersistedState` 가 정상 v1 캐시를 그대로 통과시키므로 무해. 그러나 v2 로 schema 가 바뀌면 (예: `annual` → `annualKRW` 환산, 새 discriminated variant 추가) `isValidPersistedState` 가 v1 캐시를 reject → INITIAL fallback 적용 → **사용자 도시별 선택값 전부 소실**. v2 도입 시 `migrate(persistedState, version)` 안에 v1→v2 변환 로직 + version 분기 처리 필수 (zustand persist 의 `version` 필드를 함께 bump).

**관련:** ADR-004 (도메인별 store), ADR-014 (silent fail 금지), ADR-051 (store 추가 시 hydration import), ADR-052 (hydration timeout), ADR-060 (rent 단일 선택 패턴 — 본 ADR 의 모태), `src/store/tuitionChoice.ts`, `src/store/taxChoice.ts`, `src/components/BottomSheet.tsx`, `src/components/TuitionChoiceSheet.tsx`, `src/components/TaxChoiceSheet.tsx`, `app/detail/[cityId]/[category].tsx`, `app/compare/[cityId].tsx`, TESTING.md §9.8.2 / §9.8.3 / §9.20.4 / §9.20.5 / §9.20.6 / §9.24 / §9.25.
