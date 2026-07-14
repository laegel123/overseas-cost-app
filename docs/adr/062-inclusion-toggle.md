[← ADR 인덱스](../ADR.md)

# ADR-062: Compare 카테고리 항목별 포함/제외 토글 (`useCategoryInclusionStore`)

**상태:** 채택 (2026-05-07) · **부분 supersede (ADR-067, 2026-07-06):** 페르소나 제거로 `getDefaultInclusion`/`resolveInclusion` 의 persona-aware default 는 **고정 default**(rent/food/transport ON, tuition/tax/visa OFF)로 대체된다. 도시별 사용자 토글 메커니즘 자체는 그대로 유지.

**맥락:**

Compare 화면은 페르소나(student/worker/unknown)에 따라 일정한 카테고리 집합을 나열한다 — 월세·식비·교통은 항상 표시되고, 학비·세금·비자/정착은 페르소나 활성 카테고리만 추가된다. 그러나 사용자가 자기 상황에 맞춰 **"이 항목은 내 케이스에 해당 없음"** (예: 회사 기숙사 입주 → 월세 제외, 워킹홀리데이라 학비 X, 영주권자라 비자 0원) 으로 일부를 제외하고 hero 의 "한 달 예상 총비용" 을 다시 계산할 방법이 없다.

특히 페르소나가 student/worker 더라도 학비/비자/정착을 항상 보고 싶진 않다 — 학비는 이미 결정된 학교가 있을 때만 의미 있고, 비자/정착은 입국 직전 한 번만 비교하면 된다. 현재는 학비·비자가 hero 합계에 강제로 포함돼 비교가 왜곡된다 (예: 오사카 hero 313.6만원 중 학비 41.3만원·비자 188만원 = 약 73% 가 일회성/조건부 비용).

→ 사용자가 카드별로 **포함 여부를 직접 토글** 하고, hero 합산은 토글 ON 카드만 누적. 도시별로 사용자 결정이 다를 수 있으므로 (예: 오사카는 유학 가지만 LA 는 영주권 친척 방문) **도시별 영속**.

**결정:**

1. **도메인 store** `useCategoryInclusionStore` (8번째 도메인 store) 신설:
   - 키 구조: `inclusions: Record<cityId, Partial<Record<SourceCategory, boolean>>>`
   - 영속화 키 `categoryInclusion:v1`. partialize state 만 영속, 손상 캐시 → INITIAL fallback (ADR-014 silent fail 금지).
   - 액션 `setInclusion(cityId, category, included)` / `resetCity(cityId)` / `reset()`.
   - hydration: `waitForAllStoresHydrated` 가 동시 await (이제 8 store).
2. **단일 default 정책** `resolveInclusion(cityId, category, persona, choices)` (순수 함수):
   - 사용자가 명시적으로 토글한 적이 있으면 그 값을 반환 (도시별 map 의 그 cityId 의 그 category entry).
   - 미설정이면 **persona-aware default**:
     - `rent`, `food`, `transport`: 항상 `true`
     - `tuition`: persona === 'student' 일 때만 `true`, 그 외 `false`
     - `tax`: persona === 'worker' 일 때만 `true`, 그 외 `false`
     - `visa`: 항상 `false`
   - 의도: 페르소나의 핵심 카테고리는 ON, 일회성/조건부 (visa/정착) 는 OFF, 페르소나 비활성 카테고리도 OFF — "내 페르소나의 한 달 평상 비용" 이 default 합계의 의미.
3. **UI — `ComparePair` 토글**:
   - 헤더 우측, 배수 텍스트 우측에 RN `Switch` (orange tint, `colors.orange`).
   - 제외 시 카드 전체 `opacity` 약화 + 라벨 옆 **"제외됨" 회색 pill 배지**.
   - 카드 자체의 `Pressable onPress` (Detail 진입) 와 토글 영역 분리 — 토글 `hitSlop` 으로 카드 탭 충돌 회피.
   - 색상에만 의존하지 않는 정보 표기 정책 (CLAUDE.md) — 토글 색 + 배지 텍스트 + opacity = 3중 인코딩.
4. **`HeroCard.centerMult` 옵션화** — `string | undefined`. undefined 일 때 가운데 mult/caption 영역 미렌더 (좌·우 값과 막대만 표시). Compare 의 서울합 = 0 (예: 학비 + 비자만 ON, 둘 다 서울 0원) 인 케이스에서 division by zero 회피 + `↑∞×` 같은 무의미한 표기 차단. centerCaption (예: "+229.3만원/월") 만으로도 차액 정보는 전달.
5. **합산 의미 정의 (페르소나 무관 변경)**:
   - `seoulTotal` / `cityTotal` 은 `included === true` 인 카테고리만 누적.
   - hero 의 "↑X.X×" 배수는 `seoulTotal > 0` 일 때만. `seoulTotal === 0` 이면 mult 영역 자체를 숨기고 (`centerMult={undefined}`) `centerCaption` 만 노출.
   - 카드 자체는 토글 OFF 여도 화면에서 **숨기지 않고** opacity·배지로 표시 — 사용자가 다시 켤 동선 확보. (단 기존 `seoulVal === 0 && cityVal === 0` early-return 정책은 유지 — 데이터 자체가 없는 카드는 계속 미표시.)

**대안 검토:**

- (A 선택) 도시별 map store + persona-aware default + 토글 + 흐림+배지: 사용자 의도 부합, 학비/세금/비자 모두 페르소나·상황 분기. 채택.
- (B) 전역 단일 inclusion (`Record<SourceCategory, boolean>`): rent 단일값 패턴 재사용. 그러나 도시 전환 시 같은 inclusion 이 강제 → "오사카 유학 학비 ON / LA 방문 학비 OFF" 같은 자연스러운 분기 불가능. 거부.
- (C) 페르소나만으로 자동 분기 (학비는 student 만, 비자는 한 번도 보지 않음 등): 자동성은 좋지만 사용자 override 가 없으면 케이스 손실 (예: worker 인데 학원 다닐 계획 → 학비 ON 필요). 거부.
- (D) inclusion 을 hero 카드와 categoryData 양쪽 매번 props 로 전달: store 없이 부모 state. 그러나 도시별 영속 요구가 있어 `Record<cityId, ...>` 를 부모 state 로 두면 결국 영속 필요 → store 가 옳은 위치.
- (E) 제외 카드를 화면에서 숨김 (`return null`): 시각적으로 깔끔하지만 사용자가 다시 켤 entry 가 사라짐. 거부.
- (F) 배수 영역에 `↑∞×` / `—` / `0/0` 같은 sentinel 표기: division 의미 표시는 가능하지만 시각적 혼란. centerMult 자체를 숨기는 (4번) 가 디자인적으로 가장 조용. 채택.

**결과 / 영향:**

- 사용자가 "내 케이스 한 달 예상 총비용" 을 정확히 산출 가능.
- 도시별로 다른 inclusion 가능 — "오사카 유학 풀세트" vs "LA 단기 출장 항목만".
- store 1개 추가 — 8 store 가 됐으나 hydration timeout (ADR-052) 영향 없음 (`Record<cityId, Partial<Record<6, boolean>>>` 영속화는 ms 단위).
- HeroCard `centerMult` 옵션화 — 기존 호출처 (Compare orange / Detail navy) 모두 `undefined` 가능성 처리 필요. Detail 은 항상 mult 표시 (서울합=0 가능성 없음 — 단일 카테고리) 라 기존 동작 변경 없음.
- 기본값(default)으로 학비·세금·비자가 OFF → 페르소나 worker 사용자의 hero 가 이전보다 작은 숫자로 표시될 수 있음 (학비 default OFF). 이는 "조건부/일회성 비용" 의도이며, 사용자가 토글하면 즉시 포함.

**Deferred (v1.x):**

- 토글 상태에 대한 사용자 onboarding hint (첫 진입 시 toast 또는 캡션) — UX 검증 후 추가 결정.
- inclusion 변경에 대한 `Recent` / 즐겨찾기 동기화 — 현재는 도시별 inclusion 만 영속.
- "전체 ON / 전체 OFF" 빠른 액션 — 카드 N 개 (≤6) 라 현 단계 불필요.
- persist v2 마이그레이션 시 `migrate` 함수 구현 (ADR-061 패턴 — 현재 v1 단독, no-op).

**관련:** ADR-004 (도메인별 store), ADR-014 (silent fail 금지), ADR-051 (hydration import 패턴), ADR-052 (hydration timeout), ADR-060 (rent 단일 선택 — 전역값 패턴), ADR-061 (도시별 map 패턴 — 본 ADR 의 모태), `src/store/categoryInclusion.ts`, `src/components/ComparePair.tsx`, `src/components/cards/HeroCard.tsx`, `app/compare/[cityId].tsx`, TESTING.md §9.8.4 / §9.20.7 / §9.24 / §9.25.
