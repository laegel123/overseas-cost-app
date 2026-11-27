# 설계 문서: 도시끼리 비교 (비교 탭을 두 도시 선택 화면으로 교체)

> **상태**: **구현 완료 (phase `city-pair-compare`)** — 2026-11-27, 5 step 전부 수행 (`phases/city-pair-compare/`)
> **작성일**: 2026-11-27
> **실행 방식**: 하네스(`phases/city-pair-compare/`) step 0~4 로 실행 완료
> **관련 ADR**: **ADR-089** (`docs/adr/089-compare-tab-city-pair.md`) 로 확정. ADR-041(비교 탭 라우팅 단축) supersede. ADR-060/061/062/067/075/076/077/084 참조.

이 문서는 설계 당시의 스펙이다. 구현 결과와 어긋나는 서술이 생기면 **ADR-089 와 `docs/ARCHITECTURE.md`·`docs/UI_GUIDE.md` 가 우선**한다.

구현 시 설계와 달라진 점:

- 비교 탭의 도시 목록은 기존 `BottomSheet` 재사용, 선택 칸은 같은 파일의 로컬 `CitySlot` 서브컴포넌트 (신규 컴포넌트 없음).
- 상세의 `Section` 에 `pickerCities?: PickerCity[]` 를 추가하고 `Row.seoulVal/cityVal` → `baseVal/cityVal: number | null` 로 넓혔다. 학비·세금 시트는 `sheetCityId` 로 대상 도시를 들고 열릴 때만 마운트한다 (시트 컴포넌트·store 무수정).
- 결측 배수 숨김을 위해 `ComparePair.mult` / `GroceryRow.mult` 를 `number | '신규' | null` 로 넓혔다 (`HeroCard` 는 이미 optional 이라 무수정).
- Maestro flow: 신규 3개(`03-compare/city-pair`, `03-compare/city-pair-seoul-normalize`, `05-detail/city-pair-tuition`) + 공통 서브플로우 1개, 기존 2개는 `tabs-compare-empty` / `tabs-compare-select` 로 개명·재작성.

---

## Context (왜)

하단 탭의 "비교"는 자체 화면이 없다. 누르면 `recent[0] ?? favorites[0]` 의 `서울 vs 도시` 화면으로 넘겨주는 지름길이다 (ADR-041, `app/(tabs)/_layout.tsx`). 홈의 최근 목록과 즐겨찾기 탭(ADR-084)이 같은 곳으로 한 번에 데려다주므로 탭 한 칸이 중복이다.

한편 앱은 **서울 vs X** 만 보여준다. 유학·취업 후보지를 두세 곳으로 좁힌 사용자가 정말 궁금한 것은 "밴쿠버와 토론토 중 어디가 더 드나"인데, 지금은 두 화면을 오가며 머릿속으로 빼야 한다.

그래서 중복인 비교 탭 자리에 **도시 두 곳을 골라 직접 맞붙이는 기능**을 넣는다.

## 목표 / 비목표 / 실패 조건

**목표**
1. 비교 탭 = 두 도시를 고르는 화면. "비교하기"로 `A vs B` 비교 화면 진입.
2. 비교 화면과 상세 화면이 서울이 아닌 기준 도시(왼쪽)를 받을 수 있다.
3. 학비·세금·비자도 양쪽 도시의 실제 값으로 비교한다.

**비목표**
- 3개 이상 도시 동시 비교, 좌우 바꾸기 버튼, 최근 비교한 쌍 목록, 순위·예산 기능.
- 홈·즐겨찾기·온보딩의 기존 `서울 vs X` 진입 흐름 변경.
- 새 데이터·새 출처·새 의존성 추가.
- 도시끼리 전용 화면 신설 (기존 화면을 확장한다).

**실패 조건 (동작해도 실패로 본다)**
- 기존 `서울 vs X` 화면의 값·문구·testID 가 하나라도 달라진다. `base` 가 없거나 `seoul` 이면 **현재와 완전히 동일**해야 하며 (유일한 예외: `/compare/seoul` 처럼 기준과 대상이 같은 주소는 오류 화면이 된다 — 앱 안에 그 주소로 가는 진입 경로는 없다), 기존 Jest 테스트와 Maestro flow 는 비교 탭 리다이렉트를 검증하던 것(아래 명시)만 빼고 수정 없이 통과해야 한다.
- 서울이 아닌 도시의 데이터 결측을 0원으로 조용히 표시한다.
- 한쪽 도시의 학비·세금 선택값이 반대쪽 계산에 섞여 들어간다.

## 사용자 확정 결정

1. 비교 탭을 "도시끼리 비교"로 바꾼다 (순위·예산·탭 3개 축소안 대신).
2. 학비·세금·비자를 포함한다.
3. 상세 화면까지 같은 phase 에서 한다.
4. 비교 탭은 **두 칸 선택 화면**이다 (탭이 곧 비교 화면인 안 대신).
5. 아래 "접근 방식"의 1안과 "화면별 동작"을 승인했다.

## 접근 방식

| 안 | 내용 | 결과 |
|---|---|---|
| **1. 기준 도시를 query param 으로 (채택)** | `/compare/[cityId]?base=<id>`, `/detail/[cityId]/[category]?base=<id>`. 생략 시 `seoul`. | 기존 링크·테스트·flow 가 그대로 유효. 변경 범위 최소. |
| 2. 경로 세그먼트 변경 | `/compare/[baseId]/[cityId]` | 기존 링크·테스트 전부 수정. 얻는 것 없음. |
| 3. 전용 화면 신설 | 기존 화면 무변경 | 비교(475줄)·상세(662줄)의 계산·표시 코드 복제. 이후 수정이 두 벌. |

채택 이유: 두 화면의 계산은 이미 "두 도시를 같은 함수에 통과"시키는 구조라(`COMPARE_CATEGORIES[].getValue`, `buildSections`) 왼쪽을 `seoul` 고정에서 변수로 바꾸는 것이 가장 작은 변경이다.

## 용어

- **기준 도시 (base)**: 왼쪽. 기본값 서울.
- **대상 도시 (city)**: 오른쪽. 기존 `cityId` 경로 파라미터.
- **도시끼리 모드**: `base` 가 있고 `seoul` 이 아닌 경우. 그 외는 **서울 모드**(= 현재 동작).
- 배수는 항상 `기준 대비 대상` (`computeMultiplier(baseVal, cityVal)`), Hot 판정은 기존 `isHot` 그대로.

## 화면별 동작

### 1. 비교 탭 (`app/(tabs)/compare.tsx` — placeholder 를 실제 화면으로 교체)

```
 도시끼리 비교
 ┌───────────┐      ┌───────────┐
 │  밴쿠버   │  vs  │  토론토   │
 │  바꾸기   │      │  바꾸기   │
 └───────────┘      └───────────┘
        [ 비교하기 ]
```

- 칸을 누르면 도시 목록이 뜬다. 21개 도시 전부(서울 포함), 한글 이름 가나다순. 반대편 칸에 이미 들어간 도시는 고를 수 없게 표시한다.
- 두 칸이 모두 채워지고 서로 다를 때만 "비교하기"가 활성화된다. 누르면 `router.push('/compare/<오른쪽>?base=<왼쪽>')`.
- **서울은 항상 왼쪽(기준)으로 연다.** 어느 칸에 서울을 넣었든 `router.push('/compare/<다른 도시>')` (서울 모드, `?base` 없음)로 이동한다. 서울은 학비·세금·비자가 정책상 0원이라 오른쪽에 두면 `0 ÷ 값` 배수가 되어 `formatMultiplier`·`isHot` 이 throw 한다 (`src/lib/format.ts`). 공용 lib 을 건드리지 않고 이 조합 자체를 만들지 않는다. 칸에 보이는 순서는 사용자가 고른 그대로 둔다.
- 마지막에 고른 두 도시를 기억한다 (아래 "저장" 참조). 처음에는 두 칸 모두 비어 있다.
- 저장된 도시 id 가 현재 도시 목록에 없으면 그 칸은 빈 칸으로 취급한다.
- **광고 없음**. 광고는 홈·비교·상세 ready 화면의 footer 에만 둔다는 규칙(ADR-077)에서 "비교"는 `app/compare/[cityId].tsx` 를 뜻한다. 선택 화면은 대상이 아니다.
- 데이터 로드는 홈과 같은 방식(`loadAllCities` → `getAllCities`)이며 loading / error(ErrorView) / ready 3 상태를 갖는다. 환율은 필요 없다.
- 탭 라벨·아이콘은 그대로 "비교".

### 2. 탭 레이아웃 (`app/(tabs)/_layout.tsx`)

- `handleCompareTabPress` 와 compare 의 `tabPress` listener, 그에 딸린 `useRecentStore`/`useFavoritesStore`/`Alert`/`useRouter` 사용을 제거한다. 비교 탭은 즐겨찾기 탭처럼 일반 탭 화면이 된다.
- `renderTabBar` 의 `navigation.emit('tabPress')` 어댑터는 그대로 둔다.

### 3. 비교 화면 (`app/compare/[cityId].tsx`)

- `useLocalSearchParams` 로 `base` 를 읽는다. 없으면 `'seoul'`.
- 오류 처리 (ErrorView, 기존 패턴):
  - `base` 가 도시 목록에 없음 → "도시 데이터를 찾을 수 없습니다"
  - `base === cityId` → "같은 도시끼리는 비교할 수 없어요"
  - `cityId === 'seoul'` 이고 `base` 가 다른 도시 → 서울 모드 주소(`/compare/<base>`)로 `router.replace` (위 "서울은 항상 왼쪽" 규칙. 상세 화면도 같은 방식으로 `/detail/<base>/<category>`)
- 제목 `"{기준} vs {대상}"`. hero 와 카드의 왼쪽 라벨은 기준 도시 한글 이름.
- **카테고리 값 계산 — 선택값을 도시별로 따로 넘긴다.** 지금은 `cfg.getValue(seoul, fx, rentChoice, tuitionChoice, taxChoice)` 에 **대상 도시의** 학비·세금 선택값을 그대로 넘긴다. 서울은 데이터가 없어 null 로 떨어지니 문제가 없었지만, 도시끼리 모드에서는 왼쪽에 `choices[base]`, 오른쪽에 `choices[cityId]` 를 각각 넘겨야 한다. 이 phase 에서 가장 틀리기 쉬운 지점이다.
- 월세는 현행 유지: 대상 도시 기준으로 주거 형태 key 를 1회 결정해 양쪽에 같은 key 를 적용한다. (현재 21개 도시 모두 4개 형태가 채워져 있다.)
- **결측 표기**: 서울은 정책상 학비·세금·비자 0원(현행 유지). 서울이 아닌 도시가 한쪽만 결측이면 그쪽 값은 `—` 로 표시하고 배수는 내지 않으며, 그 카테고리는 포함 토글이 켜져 있어도 hero 합계에서 뺀다. 양쪽 모두 값이 없으면 현행대로 카드를 숨긴다. 현재 데이터에서는 서울 외 20개 도시가 모두 학비·비자를 갖고 있고 세금은 전 도시가 비어 있어(양쪽 결측 → 카드 숨김), **한쪽만 결측인 경우는 실데이터로는 발생하지 않는다.** 이후 자동 갱신으로 구멍이 생길 때를 위한 규칙이며 Jest fixture 로만 검증한다 (Maestro 대상 아님). 상세 화면의 hero·행도 같은 규칙(`—`, 배수 없음)을 따른다. 배수를 숨기기 위해 `ComparePair`·`GroceryRow`·`HeroCard` 의 `mult` 계열 prop 을 선택적으로 넓히는 최소 변경은 허용한다 (기존 호출부·스냅샷 불변).
- **포함 토글 저장 키**: 서울 모드는 현행대로 `cityId`. 도시끼리 모드는 `"<base>|<cityId>"`. `categoryInclusion` store 는 문자열 키 map 이라 store 변경 없이 된다. 도시끼리 화면에서 학비를 켜도 서울 기준 화면이 바뀌지 않게 하기 위함이다. 기본값(rent/food/transport ON, tuition/tax/visa OFF)은 그대로.
- hero 가운데 배수는 현행 규칙 유지 (기준 합계가 0 이면 배수 미표시, 차액만).
- **도시끼리 모드에서만 달라지는 것**
  - 즐겨찾기 별(TopBar 오른쪽 아이콘)을 숨긴다. 어느 도시의 별인지 모호하다.
  - `pushRecent` 를 호출하지 않는다. 홈의 최근 목록은 누르면 서울 모드로 열린다.
  - 부제(환율): 두 도시 통화를 모두 보여준다. 통화가 같으면 한 번만, KRW 는 생략. 한 줄에 들어가야 한다. 서울 모드 부제는 현행 문자열 그대로.
  - 카드 탭 시 `/detail/<cityId>/<category>?base=<base>` 로 이동.
  - 하단 출처 개수는 두 도시 출처 수의 합.
  - 세금 카드의 `(근사)` 표기는 어느 한쪽이라도 직접 입력이면 붙인다.

### 4. 상세 화면 (`app/detail/[cityId]/[category].tsx`)

- `base` 처리·오류·제목·hero 왼쪽 라벨·부제 규칙은 비교 화면과 동일. 제목은 `"{카테고리} · {기준} vs {대상}"` (서울 모드는 현행 `"{카테고리} · {대상}"` 유지).
- 식비·월세·교통: `buildSections` 의 `seoul` 인자를 기준 도시로 바꾸는 것으로 끝난다. 행 값의 왼쪽 열이 기준 도시 값이 된다.
- 비자: 양쪽 모두 실제 값. 서울 모드는 현행대로 왼쪽 0.
- **학비·세금 (도시끼리 모드)**: 선택 줄을 도시마다 하나씩 둔다.

```
 학교 (월 환산)
 밴쿠버  UBC            바꾸기 ›
 토론토  U of Toronto   바꾸기 ›
 ─────────────────────────────
 밴쿠버 310만   ↑1.2×   토론토 372만
```

  - 줄을 누르면 그 도시의 `TuitionChoiceSheet` / `TaxChoiceSheet` 가 열린다. 시트는 이미 `cityId`·통화·entries 를 props 로 받으므로 컴포넌트 수정 없이 어느 도시용인지만 바꿔 넘긴다.
  - 선택값은 기존 도시별 store 를 그대로 쓴다. 밴쿠버에서 고른 학교는 서울 모드에서도 같다.
  - hero caption 은 양쪽 이름이 달라 `"{카테고리} · 선택 항목"` 으로 한다.
  - 한쪽이 서울이면 서울 쪽은 선택 줄이 없고 0원 (현행과 동일한 모습).
- **세금**: 현재 21개 도시 모두 `tax` 데이터가 비어 있고, 이 상태에서는 직접 입력도 동작하지 않는다 (`resolveTaxChoice` 는 entries 가 없으면 custom 이어도 null — `src/store/taxChoice.ts`, 시트는 안내 문구만 표시 — `src/components/TaxChoiceSheet.tsx`). 따라서 세금은 비교 화면에서 카드가 숨겨지고, 상세에서는 현재의 빈 상태가 나온다. **이 phase 는 현행을 그대로 따른다** — `resolveTaxChoice`·`TaxChoiceSheet` 를 고치지 않는다. 도시끼리 모드의 세금 상세는 빈 상태를 한 번만 보여준다. 데이터가 생겼을 때 학비와 같은 구조(도시별 선택 줄)로 동작하도록 코드 경로는 학비와 공유하고, Jest fixture 로만 검증한다. 세금 데이터 채우기는 별도 작업이다.
- **출처**: 도시끼리 모드에서는 해당 카테고리의 출처를 도시별로 묶어 둘 다 보여준다 (ADR-076 출처 표기 의무 — 화면에 나온 값의 출처는 화면에 있어야 한다). 서울 모드는 현행 유지.
- 광고 footer 는 현행 유지 (ready 상태만).

## 저장 (신규 store)

`src/store/comparePair.ts` — 마지막으로 고른 두 도시.

- 상태 `{ baseId: string | null; cityId: string | null }`, 액션 `setBase(id)`, `setCity(id)`.
- AsyncStorage 영속화, 키·버전·검증 방식은 `recent.ts` / `favorites.ts` 의 기존 패턴을 따른다 (형식이 깨진 저장값은 초기 상태로).
- `src/store/index.ts` export, `hydration.ts` 의 대기 목록에 추가 (현재 8개를 대기 중이므로 9개가 된다. `hydration.ts`·`index.ts` 헤더 주석의 개수 표기는 이미 실제와 다르다 — 신규 store 를 언급하는 줄만 고치고 나머지는 보고만 한다).
- 값은 칸을 고를 때마다 저장한다.

## 건드리는 파일

| 파일 | 변경 |
|---|---|
| `src/store/comparePair.ts` (+ test) | 신규 |
| `src/store/index.ts`, `src/store/hydration.ts` (+ test) | 신규 store 등록 |
| `app/(tabs)/compare.tsx` (+ test 신규) | placeholder → 선택 화면 |
| `app/(tabs)/_layout.tsx` (+ test) | 비교 탭 redirect 제거. 기존 redirect 테스트는 "일반 탭으로 이동" 테스트로 교체 |
| `app/compare/[cityId].tsx` (+ test) | `base` 지원 |
| `app/detail/[cityId]/[category].tsx` (+ test) | `base` 지원, 학비·세금 도시별 선택 줄 |
| `.maestro/flows/04-favorites-recent/tabs-empty-alert.yaml`, `tabs-populated-redirect.yaml` | 비교 탭 리다이렉트를 검증하던 부분 수정 → 실제로는 `tabs-compare-empty.yaml` / `tabs-compare-select.yaml` 로 개명·재작성 |
| `.maestro/flows/03-compare/`, `05-detail/` | 도시끼리 flow 신규: 탭에서 두 도시 선택 → 비교 → 학비 상세 → 한쪽 학교 변경 |
| `docs/adr/089-*.md`, `docs/ADR.md` | 신규 ADR + 인덱스. ADR-041 에 superseded 표기 |
| `docs/ARCHITECTURE.md`, `docs/UI_GUIDE.md`, `docs/TESTING.md` §7, `.maestro/PLAN.md` | 라우팅·탭·store 서술과 테스트 인벤토리 갱신 |
| `CLAUDE.md` | 첫 문단 "서울 vs 해외 도시 1:1 비교"에 도시끼리 비교 한 줄, 비교 탭 설명 갱신 |

두 ChoiceSheet 는 수정하지 않는다. `HeroCard`, `ComparePair`, `GroceryRow` 는 라벨을 이미 props 로 받으므로 위 "결측 표기"에 필요한 최소 변경 외에는 수정하지 않는다. `docs/PRD.md` 는 수정 금지이므로 PRD 와 달라지는 점(비교 탭의 역할)은 ADR 에 적는다.

## 제안 step 구성 (하네스)

1. **store + 탭 화면** — `comparePair` store, 비교 탭 선택 화면, `_layout` redirect 제거, ADR. → 검증: 신규·수정 Jest 통과, typecheck, lint. (phase 명세에서는 한 step 한 레이어 원칙에 따라 store(step 0)와 탭 화면(step 1)으로 나눠 총 5 step 이다.)
2. **비교 화면 `base` 지원** → 검증: 기존 compare 테스트 무수정 통과 + 도시끼리 케이스 추가(양쪽 학비 선택값 분리, 결측 `—`, 포함 토글 키 분리, 별·recent 미동작).
3. **상세 화면 `base` 지원** → 검증: 기존 detail 테스트 무수정 통과 + 도시끼리 케이스(도시별 선택 줄, 시트가 올바른 도시로 열림, 출처 두 묶음).
4. **Maestro flow + 문서** — flow 수정·신규, ARCHITECTURE / UI_GUIDE / TESTING §7 / CLAUDE.md. → 검증: `/verify-e2e` 로 관련 flow 통과.

각 step 은 테스트를 같은 step 안에서 작성하고 `docs/TESTING.md` §7 인벤토리를 갱신한다.

## 구현자 재량

- 도시 목록을 띄우는 방식(기존 `BottomSheet` 재사용 또는 다른 형태), 선택 화면의 세부 배치·문구. 단 디자인 토큰만 쓰고, 터치 영역·접근성 라벨·testID 는 기존 화면 관례를 따른다.
- 도시끼리 모드 부제의 정확한 문자열.
- 상세 화면에서 도시별 선택 줄을 표현하기 위한 `Section`/`Row` 타입 변경 방식.
- 결측 `—` 표기를 위해 값 타입을 `number | null` 로 끝까지 들고 갈지 여부.
- 신규 testID 이름.

## 확인된 사실 (작성 시점)

- 21개 도시 모두 `rent` 4개 형태가 채워져 있다.
- 서울 외 20개 도시 모두 `tuition`(2~3개)과 `visa` 가 있다. 서울은 둘 다 없다.
- **21개 도시 모두 `tax` 가 비어 있다.**
- `tuitionChoice` / `taxChoice` / `categoryInclusion` store 는 문자열 키 map 이라 구조 변경이 필요 없다. `rentChoice` 는 전역 단일값이다.
