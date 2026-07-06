# 설계 문서: 페르소나 제거 → 온보딩 도시 선택 전환 + Settings 데이터 최신화 카드

> **상태**: 승인됨 (설계 확정, 미착수)
> **작성일**: 2026-07-06
> **실행 방식**: 다음 세션에서 하네스(`phases/`)로 phase 초기화 후 단계별 실행 예정
> **관련 ADR**: 신규 **ADR-067** 추가 예정 (ADR-062 supersede), ADR-056/ADR-052/ADR-004/ADR-066 참조
> **원본 계획 파일**: `~/.claude/plans/declarative-singing-parnas.md` (세션 스크래치)

이 문서는 다음 세션에서 하네스가 이어받을 수 있도록 저장소에 영속화한 설계 스펙이다. 코드 변경은 아직 수행하지 않았다.

---

## Context (왜)

현재 앱은 최초 실행 시 페르소나(유학생/취업자/아직 모름)를 고르게 하고, 그 값으로 Compare 카테고리 구성과 히어로 합산 기본값을 분기한다. 그러나 **유학생·취업자 어느 쪽을 골라도 결과가 크게 다르지 않아** 선택 자체의 가치가 낮다. 실제로 `'unknown'`(합집합) 동작이 이미 "모든 카테고리를 보여주는 통합 뷰"이므로, 3분기를 유지하는 것은 store·컴포넌트·lib·Compare 분기·inclusion 기본값에 걸친 복잡도만 유발한다.

이 작업의 목표:
1. **페르소나 개념 완전 제거** → 모든 사용자가 통합 뷰(rent·food·transport·tuition·tax·visa 6개 카테고리)를 본다. 이는 기존 `'unknown'` 동작과 정확히 동일하다.
2. **온보딩 화면을 페르소나 선택 → 도시 선택으로 교체**. 도시를 고르면 즐겨찾기에 담고 서울 vs 그 도시 Compare 화면으로 바로 이동한다.
3. **Settings 화면의 "유학생 모드" 배지 → 데이터 최신화 카드**(마지막 동기화 시각 + 새로고침 버튼)로 교체.

사용자 확정 결정: (1) 개념 완전 제거, (2) 도시 선택 → 바로 비교 화면, (3) Settings 배지 → 데이터 최신화 카드.

## 확정된 동작 변화 (명시 필요)

- Compare는 페르소나 무관하게 **항상 6개 카테고리 카드**를 렌더한다.
- 히어로 합산 기본 포함: rent/food/transport = ON, **tuition/tax/visa = OFF**(카드는 표시되고 사용자가 토글로 켤 수 있음). 이는 기존 `'unknown'` 기본값과 동일 — 단, 기존에 유학생은 tuition, 취업자는 tax가 기본 ON이던 것과 달라진다.
- 기존에 온보딩을 마친 사용자는 업데이트 후 새 도시 선택 온보딩을 **1회 다시** 보게 된다(새 `onboarding:v1` store가 `onboarded=false`로 시작). 앱이 아직 실사용자 배포 전이므로 수용 가능.

## 검증 결과 (2차 확인) — 정확성 블로커 없음, 스코프 주의

grep 대조 결과 **로직/타입 상의 블로커는 없다**. `Persona` 타입은 다른 타입 정의에 쓰이지 않아 제거가 안전하고, 온보딩→compare 직행도 `_layout` 게이트와 충돌하지 않는다(`setOnboarded(true)` 동기 실행 후 `replace`, 세그먼트가 `compare`라 게이트 no-op). 다만 다음 **스코프가 첫 계획보다 크다**:

- **Maestro `common/onboard.yaml`이 ~28개 플로우의 공통 전제조건**이며 그 계약("persona-card 탭 → home-screen")이 바뀐다(도시 탭 → **compare-screen**). 스위트 전반 파급 → 아래 Maestro 섹션 참조.
- **테스트 볼륨**: `compare/[cityId].test.tsx` persona 셋업 **~30곳**, `hydration.test.ts` **~20곳**(persona가 대표 store), `categoryInclusion.test.ts` **~15곳**. 대부분 기계적 치환이지만 양이 많다.
- **`menu-refresh` 제거 파급**: settings.test 5곳 + E2E `data-refresh.yaml`/`overview.yaml` → §E 결정 참조.
- **tailwind 페르소나 전용 토큰**(`rounded-persona-icon`, `border-1.5`)은 PersonaCard 삭제로 새로 데드가 된다 → §F 참조.

---

## 구현

### A. `onboarded` 플래그를 새 온보딩 store로 이전
페르소나 store를 통째로 삭제하므로, 거기 묶여 있던 `onboarded` 플래그를 옮긴다.

- **생성** `src/store/onboarding.ts` — `src/store/settings.ts`(가장 단순한 단일 필드 store)를 형틀로 미러링.
  - `OnboardingState = { onboarded: boolean }`, actions `{ setOnboarded, reset }`
  - `export const INITIAL_STATE = { onboarded: false }` (hydration timeout guard가 참조하므로 named export)
  - persist key `'onboarding:v1'`, `isValidPersistedState`(boolean 검증), `migrate` v1 stub, `onRehydrateStorage` 손상 시 INITIAL fallback (silent fail 금지 — CLAUDE.md CRITICAL 준수)
- **수정** `src/store/index.ts` — 13~14줄 `usePersonaStore`/`PersonaActions`/`PersonaState` export를 `useOnboardingStore`/`OnboardingActions`/`OnboardingState`로 교체. docstring의 store 목록 문구 `persona`→`onboarding`.
- **수정** `src/store/hydration.ts` — 29줄 import, 67줄 `waitOne(...)`, 124~126줄 forceInitial 블록을 persona→onboarding store로 교체. **배열 첫 번째 위치 유지**(hydration.test가 `setStateSpies[0]`를 대표 store로 인덱싱).
- **수정** `app/_layout.tsx` — 12줄 import, 25줄 `const onboarded = useOnboardingStore((s) => s.onboarded)`. 60~69줄 게이트 로직은 그대로(onboarded만 사용, persona 값 무관).
- **잔존 `persona:v1` 키**: 무해하므로 기본은 그대로 둔다(문서화). *선택*: 부팅 effect에서 `AsyncStorage.removeItem('persona:v1')` best-effort 정리 — 범위 최소화를 위해 필수 아님.

### B. 온보딩 화면 재작성 — `app/onboarding.tsx` (전면 재작성)
Home(`app/(tabs)/index.tsx`)의 도시 리스트 패턴을 이식하되 온보딩용으로 슬림화.

- **Hero 유지**: 기존 globe 아이콘 히어로 + "안녕하세요 / 어디로 떠나시나요?" 문구 유지. 설명 문구에서 "본인 페르소나에 맞게"(62줄) 제거 → "서울 기준으로 해외 도시 생활비를 비교해 드려요". 하단 "설정에서 언제든 변경..." 문구 제거.
- **도시 리스트**: `RecentRow`(재사용) 세로 리스트로 `Object.values(getAllCities()).filter(c => c.id !== 'seoul')` 렌더, 한글명 가나다 정렬.
- **권역 필터**: `RegionPill` + `REGIONS` 상수(Home 44~51줄) 이식(저비용 재사용).
- **검색바**: 도시가 20개라 필수 아님. 범위 최소화를 위해 **v1에서는 생략**(리스트 + 권역 필터만). 필요 시 Home 패턴 이식 가능.
- **데이터 로드/상태**: Home과 동일한 loading/error/ready 상태 머신 + `Promise.all([loadAllCities(), fetchExchangeRates()])`. fx는 배수 계산에 필요.
- **선택 흐름** (`handleSelect`, 기존 연타 가드 `isNavigatingRef` 패턴 유지):
  ```
  add(cityId);                     // useFavoritesStore
  setOnboarded(true);              // useOnboardingStore
  router.replace(`/compare/${cityId}`);
  ```
  `pushRecent`는 호출 안 함 — Compare 화면이 마운트 시 자체 실행(compare/[cityId].tsx 259~263)하므로 중복 방지.

**도시 배수(mult) 표시**: `RecentRow`는 `mult: number | '신규'` prop이 필수다. 홈·즐겨찾기·최근과 시각 일관을 위해 실제 "서울 대비 배수"를 표시한다. 이를 위해 홈의 계산 함수를 공유한다:
- **추출** `app/(tabs)/index.tsx`의 `computeCityTotal`(58~76줄) + `multFromTotals`(78~85줄) + 관련 상수(`FOOD_*`)를 **신규 `src/lib/homeTotals.ts`** 로 옮기고 `src/lib/index.ts` 배럴에 export. Home과 Onboarding이 함께 import → 중복 제거(ADR-056 단일 출처 보강). 신규 lib이므로 같은 step에 테스트 작성.
- *대안(범위 트림 시)*: 배수 없이 도시명만 보이는 경량 행을 쓰거나 `'신규'` 고정 — 다만 일관성·정보성이 떨어져 비권장.

### C. Compare 페르소나 분기 제거 — `app/compare/[cityId].tsx`
- import 제거: 44줄 `usePersonaStore`, `Persona` 타입.
- `getCategoriesForPersona`(165~175줄) 삭제 → 모듈 상수로 대체:
  ```ts
  const COMPARE_CATEGORIES: CategoryConfig[] =
    [RENT_CONFIG, FOOD_CONFIG, TRANSPORT_CONFIG, TUITION_CONFIG, TAX_CONFIG, VISA_CONFIG];
  ```
- 193줄 persona selector 삭제. 281줄 `useMemo(getCategoriesForPersona…)` → `const categories = COMPARE_CATEGORIES;`(정적이라 memo 불필요).
- 352~357줄 `resolveInclusion(cityId ?? '', cfg.category, persona, inclusions)` → persona 인자 제거(§D 시그니처와 일치).

### D. `src/store/categoryInclusion.ts` — persona 인자 제거 + 고정 기본값
- 36줄 `Persona` import 제거.
- `getDefaultInclusion(category)` — rent/food/transport→`true`, tuition/tax/visa→`false`. `never` exhaustiveness 가드 유지.
- `resolveInclusion(cityId, category, inclusions)` — persona 인자 제거, `getDefaultInclusion(category)` 호출.
- docstring의 "persona-aware default" 문구 → "고정 기본값(통합 뷰)"으로 갱신 + ADR-067 참조. export명은 동일하므로 `store/index.ts` 배럴은 무변경.

### E. Settings 데이터 최신화 카드 — `app/(tabs)/settings.tsx`
- **제거**: 27줄 `PERSONA_*` import, 29줄 `usePersonaStore` import, 46~47줄 `persona`/`setOnboarded` selector, 61~64줄 `handleChangePersona`, 130~162줄 네이비 페르소나 카드.
- **신규 카드**(130~162줄 자리, testID `data-refresh-card`): 기존 네이비 히어로 시각 패턴(`bg-navy rounded-hero-lg p-hero-pad mb-4`) 재사용.
  - 좌: 오렌지 아이콘 박스 + `Icon name="refresh"`
  - 중: `H3 color="white"` "데이터 최신화" + `Tiny opacity-70`에 **기존 `formatLastSync()`(101~112줄) 재사용**(loading/error/null/날짜 모두 처리됨)
  - 우: `Pressable`(testID `data-refresh-btn`) → `onPress={handleRefresh}`, `disabled={refreshState==='loading'}`
- **중복 제거 (확정)**: 새로고침을 카드(`data-refresh-btn`)로 승격하고 172~181줄 "데이터 새로고침" `MenuRow`를 **제거** → 메뉴 5→4. (`handleRefresh`/`refreshState`/`formatLastSync`/`useSettingsStore` wiring은 전부 그대로 재사용, 신규 로직 없음.) 마지막 동기화 표시 중복 없음.
- **`menu-refresh` 참조 재조준 (필수)**: 이 testID는 **settings.test.tsx 5곳**(175/210/224/244/265줄) + **전용 E2E `flows/06-settings/data-refresh.yaml`**(3회 탭) + **`overview.yaml`**(24줄)에서 참조된다. 모두 `data-refresh-btn`으로 재조준한다.

### F. 페르소나 파일 삭제 / 타입 정리
- **삭제**: `src/components/PersonaCard.tsx`, `src/store/persona.ts`, `src/lib/persona.ts`.
- **수정**: `src/types/city.ts`(6줄 `Persona` 삭제), `src/types/index.ts`(re-export 삭제).
- **디자인 토큰 정리**:
  - `src/theme/tokens.ts`의 `navyPersonaCard`(28줄)는 grep 결과 **이미 사용처 0**인 기존 데드 코드 → 전역 가이드라인(기존 데드는 요청 없이 삭제 금지)에 따라 **보고만** 하고 남겨둔다.
  - `tailwind.config.js`의 `rounded-persona-icon`(borderRadius, 주석 "PersonaCard 전용")과 `border-1.5`(borderWidth, 주석 "PersonaCard primary variant 전용")는 PersonaCard 삭제로 **새로 데드**가 된다(내 변경이 유발). 구현 시 사용처가 PersonaCard 단독임을 재확인한 뒤 정리한다. 공유 사용이 하나라도 있으면 남긴다(정밀한 수정 원칙).

---

## 테스트 (신규 모듈은 같은 step에 작성 — CLAUDE.md 개발 프로세스)

- **삭제**: `PersonaCard.test.tsx`, `store/__tests__/persona.test.ts`, `lib/__tests__/persona.test.ts`, 옛 `onboarding.test.tsx.snap`.
- **신규**:
  - `src/store/__tests__/onboarding.test.ts` — 초기값·set·reset·persist key·round-trip·손상 캐시 fallback·hydration race (persona/settings 테스트 구조 미러).
  - `src/lib/__tests__/homeTotals.test.ts` — `computeCityTotal`/`multFromTotals` 순수 함수 검증.
- **수정**:
  - `app/__tests__/onboarding.test.tsx` — 도시 리스트 렌더(seoul 제외), 권역 필터, 도시 탭→`add`+`setOnboarded(true)`+`router.replace('/compare/{id}')`, 연타 가드, loading/error.
  - `app/__tests__/_layout.test.tsx` — persona mock→onboarding store로 스왑(게이트 로직 동일).
  - `src/store/__tests__/hydration.test.ts` — persona→onboarding store 스왑(**~20곳**; 첫 배열 위치 유지 시 `setStateSpies[0]` 인덱싱 그대로 유효).
  - `app/compare/__tests__/[cityId].test.tsx` — 페르소나 분기 3케이스 삭제 → "항상 6 카테고리" 1케이스. **persona 셋업 ~30곳**(`setState({persona})`/`setPersona`)은 이제 불필요 → 제거하되, tuition/tax 카드 가시성에 의존하던 assertion은 "항상 표시"로 유지. inclusion 기대값을 tuition/tax **default OFF**로 수정.
  - `src/store/__tests__/categoryInclusion.test.ts` — persona 인자 제거 시그니처로 매트릭스 재작성.
  - `app/(tabs)/__tests__/settings.test.tsx` — 페르소나/변경버튼 describe 삭제, 데이터 최신화 카드 describe 추가, 메뉴 5→4, 스냅샷 target `persona-card`→`data-refresh-card`.
  - `app/(tabs)/__tests__/index.test.tsx` — homeTotals 추출에 따른 import 반영(있으면).
- **`docs/TESTING.md` §7/§9 인벤토리 갱신**: persona store/lib/PersonaCard 항목 삭제, onboarding store·homeTotals lib 신규 항목 추가, settings·onboarding·compare·_layout·categoryInclusion 섹션 갱신. 인벤토리 누락 = step 미완.

## Maestro E2E — `.maestro/*` 갱신 (ADR-066, 필수) — **스위트 전반 파급**
검증 결과 persona 결합이 넓다. 핵심은 공통 서브플로우 계약 변경이다.

- **`common/onboard.yaml` (최우선, ~28개 플로우가 include)**: 현재 `launchApp(clearState)` → `onboarding-screen` → `tapOn persona-card-${PERSONA}` → `assertVisible home-screen`. 새 온보딩은 도시 탭 후 **compare 화면**으로 가므로 이 계약이 깨진다. 재작성안: `tapOn`(도시 행, 예 고정 `CITY=tokyo` 또는 첫 도시 앵커) → `assertVisible compare-screen` → 뒤로가기(`compare-back` 등) → `assertVisible home-screen`. `PERSONA` env 제거(필요 시 `CITY` env 도입). 이렇게 하면 downstream ~28개 플로우의 "home-screen 전제"를 보존한다.
- **`flows/01-onboarding/` (5개)**: `persona-student.yaml`/`persona-worker.yaml`/`persona-unknown.yaml`/`persona-change.yaml` → **삭제**(페르소나·변경 버튼 소멸). `onboarding-once.yaml` → 도시 선택 1회 게이트로 **재작성**. 신규 "도시 선택 → compare 진입 + 즐겨찾기 반영" 플로우 추가 권장.
- **`flows/03-compare/persona-card-diff.yaml`**: **삭제**(페르소나 차이 소멸). 필요 시 "통합 6 카테고리 표시" 검증 플로우로 대체.
- **`flows/06-settings/`**: `overview.yaml`(9줄 PERSONA env, 24줄 `menu-refresh` 참조) → onboard 계약 변경 반영 + `persona-card`/`menu-refresh` → `data-refresh-card`/`data-refresh-btn`. `data-refresh.yaml`(`menu-refresh` 3회 탭) → `data-refresh-btn`으로 재조준.
- **`smoke.yaml`**: persona 앵커 → 도시 선택 앵커.
- **문서**: `.maestro/README.md`, `PLAN.md`, `GOTCHAS.md`의 persona 앵커/PERSONA env 설명 갱신.
- 참고: 02-home/04-favorites/05-detail 플로우들은 persona를 직접 쓰지 않고 `onboard.yaml` include로만 결합 → `onboard.yaml` 재작성이 정상 동작시키면 대부분 무수정. E2E는 시뮬레이터 수동 실행이라 CI 차단 없음(로컬 검증 권장).

## 문서 — ADR + CLAUDE.md
- **`docs/ADR.md` 신규 ADR-067**(현 최고 ADR-066): "페르소나 제거 + 온보딩 도시 선택 + 통합 카테고리 뷰". 컨텍스트/결정/대안/영향 기술. **ADR-062의 persona-aware default를 고정 default로 supersede** 표기.
- **`CLAUDE.md`**: 22줄 CRITICAL 페르소나 규칙 삭제/대체("페르소나 개념 제거(ADR-067), 모든 사용자 통합 뷰, Compare는 분기 안 함"), 3줄 서두 "페르소나 분기" 문구 삭제, 10줄 store 목록 `persona`→`onboarding`.
- **정합성 갱신**(persona 참조): `docs/DATA.md`(persist 키 목록), `docs/ARCHITECTURE.md`(store 목록/부팅 순서). UI_GUIDE/design README의 persona 카드 언급은 여력 시.

---

## 실행 순서 (각 단계 typecheck/test 그린 유지)

1. `src/store/onboarding.ts` + 테스트 → `npm run typecheck`, 해당 테스트.
2. 부트 wiring 이전(`store/index.ts`, `hydration.ts`, `_layout.tsx`) + `_layout.test`/`hydration.test` 갱신.
3. `src/lib/homeTotals.ts` 추출 + 테스트 + `index.tsx` import 교체.
4~5. `categoryInclusion.ts` + `compare/[cityId].tsx` **한 커밋**(시그니처 상호 의존) + 두 테스트 갱신.
6. `app/onboarding.tsx` 재작성 + 테스트 재작성 + 옛 스냅샷 삭제.
7. `app/(tabs)/settings.tsx` 카드 교체 + 테스트/스냅샷 갱신.
8. 페르소나 파일 삭제 + 타입 정리. `grep -rn 'usePersonaStore\|PersonaCard\|getCategoriesForPersona\|type Persona' src app` → 0건.
9. `.maestro/*` 갱신.
10. 문서: ADR-067, CLAUDE.md, TESTING.md, DATA/ARCHITECTURE.

## 검증 (end-to-end)

- **게이트**: `npm run typecheck` + `npm run lint` + `npm test` 전체 그린. `grep -rn 'usePersonaStore\|PersonaCard\|getCategoriesForPersona\|type Persona' src app` → 0건.
- **수동 e2e**(시뮬레이터, `npm run dev`):
  1. 신규 설치 → 도시 선택 온보딩 노출 → 도시 탭 → 서울 vs 도시 Compare 진입 + 즐겨찾기에 반영 확인.
  2. Compare에서 6개 카테고리 표시 + tuition/tax 카드가 기본 OFF(토글로 ON 가능) 확인.
  3. Settings 데이터 최신화 카드에서 새로고침 동작 + 마지막 동기화 시각 표시 확인, 메뉴 4행 확인.
  4. 기존 사용자 업그레이드 경로(온보딩 1회 재노출) 확인.
- **선택**: `.maestro` 스모크 플로우 로컬 실행.
