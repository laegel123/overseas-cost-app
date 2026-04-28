# 아키텍처

해외 생활비 비교 앱(`overseas-cost-app`)의 코드 구조·데이터 흐름·모듈 경계를 기록한다. PRD(`docs/PRD.md`) 의 *기능 요구사항*을 코드로 어떻게 분해할지에 대한 단일 출처.

## 디렉터리 구조

```
overseas-cost-app/
├── app/                          # Expo Router — 파일 기반 라우팅
│   ├── _layout.tsx               # 루트 레이아웃 (폰트 로딩, 페르소나 hydration, splash)
│   ├── onboarding.tsx            # 1회성 페르소나 선택
│   ├── (tabs)/                   # 하단 탭 그룹
│   │   ├── _layout.tsx           # BottomTabBar (홈/비교/즐겨찾기/설정)
│   │   ├── index.tsx             # 홈
│   │   └── settings.tsx          # 설정
│   ├── compare/[cityId].tsx      # 비교 화면 (서울 vs 도시)
│   └── detail/[cityId]/[category].tsx  # 항목 상세 (식비, 월세, ...)
│
├── src/
│   ├── components/               # 재사용 UI 컴포넌트
│   │   ├── typography/Text.tsx   # Display, H1, H2, H3, Body, Small, Tiny, MonoLabel
│   │   ├── Icon.tsx              # 22개 SVG 아이콘 단일 컴포넌트
│   │   ├── Screen.tsx            # SafeArea + 배경
│   │   ├── TopBar.tsx            # back/title/right action
│   │   ├── BottomTabBar.tsx
│   │   ├── cards/HeroCard.tsx    # variant: orange | navy
│   │   ├── MenuRow.tsx           # 설정 메뉴 행
│   │   ├── RegionPill.tsx        # 권역 필터 칩
│   │   ├── ComparePair.tsx       # Compare 화면 듀얼 바 카드
│   │   ├── FavCard.tsx           # 홈 즐겨찾기 가로 카드
│   │   ├── RecentRow.tsx         # 홈 최근 본 도시 행
│   │   ├── GroceryRow.tsx        # Detail 식재료 행
│   │   ├── Empty.tsx / ErrorView.tsx / Skeleton.tsx
│   │   └── details/{Food,Rent,Transport,Tuition,Tax,Visa}Detail.tsx
│   │
│   ├── store/                    # Zustand + AsyncStorage 영속화
│   │   ├── persona.ts
│   │   ├── favorites.ts
│   │   ├── recent.ts
│   │   └── settings.ts
│   │
│   ├── lib/                      # 도메인 로직
│   │   ├── data.ts               # 도시 JSON fetch + 24h TTL 캐시
│   │   ├── currency.ts           # 환율 fetch + KRW 변환
│   │   ├── format.ts             # 만/천 단위, 배수 포매팅, 날짜
│   │   └── compare.ts            # 카테고리 비교, 월 합계 계산 (PRD 부록 C)
│   │
│   ├── types/                    # TypeScript 타입
│   │   ├── city.ts               # Persona, City, CityCostData, CategoryComparison, ItemComparison, ExchangeRates
│   │   └── index.ts              # re-export
│   │
│   └── theme/
│       └── tokens.ts             # 코드에서 직접 참조할 토큰 (gradient, shadow 등 NativeWind 외 값)
│
├── data/
│   ├── seed/                     # 앱 번들에 포함 (오프라인 fallback)
│   │   ├── seoul.json
│   │   └── vancouver.json
│   ├── cities/                   # 나머지 19개 도시 JSON (런타임 fetch)
│   └── sources.md                # 도시별 데이터 출처 색인
│
├── assets/
│   ├── fonts/                    # Manrope, Mulish, Pretendard
│   ├── icon.png
│   └── splash.png
│
├── docs/                         # CLAUDE.md preamble 에 자동 포함
├── phases/                       # 하네스 phase
├── scripts/                      # 하네스 + 데이터 검증 스크립트
├── tailwind.config.js
├── babel.config.js
├── metro.config.js
├── global.css                    # NativeWind directives
├── jest.config.js
├── tsconfig.json
├── app.json
├── eas.json
└── package.json
```

## 라우팅 (Expo Router 파일 기반)

```
앱 콜드 스타트
  └─ app/_layout.tsx
        ├─ 폰트 로딩 (useFonts)
        ├─ 페르소나 hydration (Zustand persist)
        ├─ if (!onboarded) → router.replace('/onboarding')
        └─ else → router.replace('/(tabs)')

/onboarding                     # 1회성, persona 저장 후 (tabs) 로 이동
/(tabs)/index                   # 홈 (즐겨찾기·검색·최근)
/(tabs)/settings                # 설정
/compare/[cityId]               # 비교 (서울 vs city)
/detail/[cityId]/[category]     # 항목 상세 (food | rent | transport | tuition | tax | visa)
```

- 즐겨찾기·비교 탭은 v1.0 에서 **홈을 재사용**한다(필터 전환만). 별도 화면 추가는 v2 이후.
- Stack 기반 push/pop. 비교 → 상세 → 비교 → 홈 백 스택 보존.

## 데이터 흐름

### 도시 데이터 (단일 batch)

21개 도시(서울 + 20)는 **단일 `all.json` batch 파일** 로 한 번에 fetch (DATA.md §6.1, ADR-031). 도시별 개별 fetch 없음.

```
[도시 batch 데이터]
  GitHub raw → cdn.jsdelivr.net (fallback)
    ─(1회 fetch)→ src/lib/data.ts
                  ├─ AsyncStorage 캐시 키 'data:all:v1' (24h TTL)
                  ├─ 캐시 miss → primary fetch → 실패시 backup → 실패시 시드(assets/data/seed/all.json)
                  └─ 캐시 hit → 즉시 반환 + 백그라운드 stale 검사
                  반환: { cities: { seoul, vancouver, toronto, ... } }
```

### 환율 (별도 fetch)

```
[환율]
  open.er-api.com → ECB → 한국은행 분기 하드코딩 (3단계 fallback)
    ─(1회 fetch)→ src/lib/currency.ts
                  ├─ AsyncStorage 'fx:v1' (24h TTL)
                  └─ convertToKRW(value, currency)
```

### 비교 계산

```
[비교 계산]
  컴포넌트 (Compare 화면)
    ─(useStore)→ persona, favorites, recent
    ─(getAllCities)→ data.ts → 메모리에서 cities 맵 즉시 반환 (fetch 없음)
    ─(compute)→ src/lib/compare.ts
                ├─ computeCategoryComparison(cat, seoul, city, fx)
                └─ computeMonthlyTotal(persona, seoul, city, fx)  // PRD 부록 C
    ─(format)→ src/lib/format.ts → "↑1.9×", "175만"
    ─(render)→ <ComparePair /> 등
```

### 핵심 원칙

- **컴포넌트는 fetch 를 직접 호출하지 않는다.** 모든 외부 I/O 는 `src/lib/` 를 경유.
- **데이터 fetch 는 앱 시작 시 1회 + 24h TTL.** 화면 전환에 fetch 없음.
- **UI 가 fetch 를 기다리지 않는다.** 캐시·시드 즉시 표시 → 백그라운드 갱신 → reactive 업데이트.

### data.ts 공개 API

```ts
// 1회 fetch + 캐시 + 시드 fallback
export async function loadAllCities(opts?: { bypassCache?: boolean }): Promise<CitiesMap>;

// 메모리 즉시 조회 (loadAllCities 이후)
export function getCity(id: string): CityCostData | undefined;
export function getAllCities(): CitiesMap;

// 강제 새로고침 (설정 화면)
export async function refreshCache(): Promise<{ ok: boolean; lastSync: string }>;
```

## 상태 관리 (Zustand)

도메인별 분리 — 단일 거대 스토어 금지.

| 스토어              | 데이터                                                              | 영속화 | 사용처                            |
| ------------------- | ------------------------------------------------------------------- | ------ | --------------------------------- |
| `usePersonaStore`   | `persona: 'student' \| 'worker' \| 'unknown'`, `onboarded: boolean` | ✅     | 라우팅 가드, Compare 카드 분기    |
| `useFavoritesStore` | `cityIds: string[]`                                                 | ✅     | 홈 즐겨찾기 카드, Compare ⭐ 토글 |
| `useRecentStore`    | `cityIds: string[]` (max 5, FIFO)                                   | ✅     | 홈 최근 본 도시                   |
| `useSettingsStore`  | `lastSync: ISOString \| null`                                       | ✅     | 설정 화면, 데이터 새로고침 표시   |

모두 `zustand/middleware` 의 `persist` + AsyncStorage 어댑터 사용. 첫 렌더 전 hydration 보장 위해 `_layout.tsx` 에서 `useStore.persist.onFinishHydration` 으로 splash 유지.

## 컴포넌트 위계

```
[Theme tokens]
   tailwind.config.js  +  src/theme/tokens.ts
        ↓
[Primitives]
   typography.Text(8 variants)  +  Icon(22 names)
        ↓
[Shell]
   Screen  +  TopBar  +  BottomTabBar
        ↓
[Domain]
   HeroCard / MenuRow / RegionPill / ComparePair / FavCard / RecentRow / GroceryRow / details/*
        ↓
[Screens]
   app/onboarding | app/(tabs)/index | app/(tabs)/settings | app/compare/[cityId] | app/detail/[cityId]/[category]
```

화면은 도메인 컴포넌트를 **조립**할 뿐 새 시각 컴포넌트를 만들지 않는다. 디자인 변경은 위 단계 중 가장 낮은 층에서 시작.

## 페르소나에 따른 카드 분기 (Compare 화면)

```ts
const cards = {
  student: ['rent', 'food', 'transport', 'tuition', 'visa'],
  worker: ['rent', 'food', 'transport', 'tax', 'visa'],
  unknown: ['rent', 'food', 'transport', 'tuition', 'tax', 'visa'], // 합집합
}[persona];
```

`unknown` 은 후보를 모두 보여주어 페르소나 결정을 돕는다 — 이후 사용자가 설정에서 페르소나를 정하면 카드가 정리된다.

## 캐시·오프라인 전략

| 자원        | 전략                                                            |
| ----------- | --------------------------------------------------------------- |
| 도시 JSON   | 24h TTL, 네트워크 실패 시 시드 사용. 사용자 수동 새로고침 가능. |
| 환율        | 일 1회 fetch, 실패 시 마지막 성공값 + 경고 배지                 |
| 폰트        | Expo 자산 번들 (오프라인 항상 가용)                             |
| 사용자 상태 | AsyncStorage (로컬만, 동기화 없음 — v2 이후)                    |

## 부팅·hydration 순서

```
앱 콜드스타트
  ├─ Expo splash 표시 (system)
  ├─ app/_layout.tsx mount
  │    ├─ useFonts(Manrope, Mulish, Pretendard)        ─ Promise A
  │    ├─ usePersonaStore.persist.hasHydrated()        ─ Promise B
  │    ├─ useFavoritesStore.persist.hasHydrated()      ─ Promise C
  │    ├─ useRecentStore.persist.hasHydrated()         ─ Promise D
  │    └─ useSettingsStore.persist.hasHydrated()       ─ Promise E
  ├─ Promise.all([A,B,C,D,E])
  ├─ SplashScreen.hideAsync()
  └─ if !onboarded → router.replace('/onboarding')
     else          → router.replace('/(tabs)')
```

- 폰트·hydration 미완 상태에서는 **자식 트리를 렌더하지 않는다** (FOUC + AsyncStorage race 방지).
- splash 는 `SplashScreen.preventAutoHideAsync()` 로 수동 제어.

## 에러 핸들링 전략

3계층:

1. **lib 계층** — 결정적 에러 타입 throw. 모든 에러는 아래 카탈로그의 클래스 중 하나여야 함.
2. **screen 계층** — try/catch + 상태로 변환
   - 네트워크 실패: 시드 fallback 사용 + inline 경고 배지(`데이터 갱신 실패 · 다시 시도`)
   - 파싱/스키마 실패: ErrorView 화면 단위 표시
   - 사용자 액션 실패(즐겨찾기 add 등): 토스트(`저장 실패`)로 알리고 작업 롤백
3. **app 계층** — Error Boundary
   - `app/_layout.tsx` 에 `<ErrorBoundary>` 래퍼. 자식 트리 throw 시 `<ErrorView fatal />` 표시 + "다시 시작" CTA.
   - DEV 모드는 RN 표준 LogBox 우선.

silent fail 금지(CLAUDE.md CRITICAL). 무시할 만한 에러도 dev 콘솔에는 남긴다.

### 에러 타입 카탈로그

모든 에러 클래스는 `src/lib/errors.ts` 에 모음. 공통 베이스 `AppError` 가 `code`, `message`, `cause?` 필드 보장.

```ts
export class AppError extends Error {
  abstract readonly code: string;
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
  }
}
```

| 클래스                      | code                     | 발생 위치                                    | 화면 처리                       |
| --------------------------- | ------------------------ | -------------------------------------------- | ------------------------------- |
| `InvalidNumberError`        | `INVALID_NUMBER`         | format.ts (NaN/Infinity/null/undefined 입력) | 표시 "?", dev 로그              |
| `InvalidMultiplierError`    | `INVALID_MULTIPLIER`     | format.ts (배수 0 또는 음수)                 | 동일                            |
| `InvalidAmountError`        | `INVALID_AMOUNT`         | currency.ts (음수 금액)                      | 카드 미표시 + dev 로그          |
| `UnknownCurrencyError`      | `UNKNOWN_CURRENCY`       | currency.ts (FX 테이블 미보유 통화)          | 비교 카드 "?" + 경고 배지       |
| `FxFetchError`              | `FX_FETCH_FAILED`        | currency.ts (HTTP 4xx/5xx, 네트워크)         | stale 캐시 fallback + 경고 배지 |
| `FxParseError`              | `FX_PARSE_FAILED`        | currency.ts (응답 shape 불일치)              | 동일                            |
| `FxTimeoutError`            | `FX_TIMEOUT`             | currency.ts (10초 초과)                      | 동일                            |
| `CityParseError`            | `CITY_PARSE_FAILED`      | data.ts (JSON 파싱 실패)                     | 시드 fallback + ErrorView       |
| `CitySchemaError`           | `CITY_SCHEMA_INVALID`    | data.ts (validateCity 실패)                  | 동일                            |
| `CityNotFoundError`         | `CITY_NOT_FOUND`         | data.ts (HTTP 404)                           | 시드 fallback 시도              |
| `CityFetchError`            | `CITY_FETCH_FAILED`      | data.ts (HTTP 5xx, 네트워크)                 | 동일                            |
| `CityTimeoutError`          | `CITY_TIMEOUT`           | data.ts (10초 초과)                          | 동일                            |
| `AllCitiesUnavailableError` | `ALL_CITIES_UNAVAILABLE` | data.ts (모든 도시 fetch 실패)               | 전체 ErrorView + 다시 시도      |
| `FavoritesLimitError`       | `FAVORITES_LIMIT`        | favorites store (50개 초과 add)              | 토스트 "즐겨찾기 50개 초과"     |
| `InvariantError`            | `INVARIANT`              | 전역 (도달 불가 코드)                        | ErrorBoundary fatal             |

### 에러 처리 룰

- **모든 lib 함수는 위 카탈로그 외 에러를 throw 하지 않는다.** 외부 라이브러리 에러를 잡으면 wrap 해서 카탈로그 클래스로 다시 throw.
- 모든 catch 는 `instanceof AppError` 로 구분 + `code` 로 분기.
- 화면 레벨 catch 후 throw 다시: 정책상 금지 (한 번 잡으면 사용자에게 보일 형태로 변환).
- 테스트는 메시지 문자열보다 `instanceof <ErrorClass>` + `code` 로 검증 (TESTING.md §20 규약).

## 명명·import 규약

- 컴포넌트: `PascalCase.tsx`. 한 파일에 하나의 default export 또는 다수의 named export.
- 훅·유틸: `camelCase.ts`.
- 타입: `PascalCase`. enum 보다 union literal 선호.
- 상수: `UPPER_SNAKE_CASE`.
- 폴더: `kebab-case` 또는 `camelCase` (현재 `kebab-case`).
- import 순서:
  1. RN/Expo 표준 (`react`, `react-native`, `expo-*`)
  2. 외부 라이브러리 (`zustand`, `@react-native-async-storage/...`)
  3. 내부 alias (`@/components`, `@/lib`)
  4. 상대 경로 (`./Foo`, `../Bar`)
  - ESLint `import/order` 로 강제.

## 라우팅 디테일

- Expo Router 의 `Stack` + `Tabs` 조합. 깊이 2단계 이상 push 시 `Stack.Screen` 의 `presentation: 'modal'` 옵션 활용 (예: 출처 보기 화면).
- Deep link: v1.0 미지원. `app.json` 의 `scheme` 만 예약 (`overseascost://`). 실 처리 v1.x 결정.

### 하단 탭 동작 정책

디자인 BottomTabs (`_shared.jsx`) 에 4개 탭 — 홈·비교·즐겨찾기·설정. v1.0 에서 각 탭 동작:

| 탭           | 동작                                                                                                                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **홈**       | `/(tabs)/index` 로 이동. 항상 활성.                                                                                                                                                            |
| **비교**     | 마지막으로 본 비교 도시(`useRecentStore.cityIds[0]`)로 `/compare/<id>` 이동. 최근 본 도시 0개일 때 → 홈의 "관심 도시 골라보기" CTA 영역으로 스크롤 + 안내 토스트 ("먼저 도시를 선택해 주세요") |
| **즐겨찾기** | 즐겨찾기 1개+ 일 때: 첫 즐겨찾기 도시로 `/compare/<id>`. 즐겨찾기 0개일 때: 홈 + "즐겨찾기를 먼저 추가해 주세요" 토스트                                                                        |
| **설정**     | `/(tabs)/settings`                                                                                                                                                                             |

별도 즐겨찾기·비교 화면은 v1.0 미도입 (ADR-038). v2 에서 본격적인 즐겨찾기 화면(목록 편집·정렬) 검토.

### 화면별 백 동작

| 현재 화면                   | 시스템 back / 뒤로           | iOS swipe-back |
| --------------------------- | ---------------------------- | -------------- |
| 온보딩                      | (back 없음)                  | (없음)         |
| 홈                          | (앱 background)              | (없음)         |
| Compare                     | 홈으로 (또는 이전 도시 비교) | 활성           |
| Detail                      | Compare 로                   | 활성           |
| 설정                        | 홈으로                       | 활성           |
| 시트 (가정값/페르소나/출처) | 시트 dismiss (스택 영향 X)   | swipe-down     |

즐겨찾기 토글 후 뒤로 → 홈: 스토어 기반이라 자연스럽게 반영.

## 검색 알고리즘 (홈 검색바)

`src/lib/search.ts` 구현. 21개 도시 메타에 대해 매칭.

### 입력 정규화

1. `.trim()` — 양끝 공백 제거
2. `.toLowerCase()` — 영문 소문자
3. 한글: `NFC` 정규화 (`String.normalize('NFC')`)
4. 자모 분리 입력 (`ㅁ`, `ㅁㅔ`) → 자모 검색 비활성 (정책: **완성된 음절 단위만 매칭**)

### 매칭 단계

```
1. 정확 일치 (도시명 ko 또는 en 전체 일치) → score 100
2. prefix 매칭 (ko 또는 en startsWith) → score 80
3. 자치구·CMA 별칭 매칭 (예: "BC" → 밴쿠버) → score 60
4. substring 매칭 (ko.includes 또는 en.includes) → score 40
5. 결과 0개면 → 빈 결과
```

### 정렬

1. score 내림차순 (높은 매칭 우선)
2. 동점이면 region 순 (na > eu > oceania > asia > me)
3. 동점이면 한글 가나다순

### 별칭 사전 (고정)

```ts
const ALIASES: Record<string, string> = {
  sf: 'san-francisco-bay',
  실리콘밸리: 'san-francisco-bay',
  베이: 'san-francisco-bay',
  la: 'los-angeles',
  뉴욕시티: 'new-york',
  nyc: 'new-york',
  도꾜: 'tokyo', // 흔한 오타
  도꾜: 'tokyo',
  // ...
};
```

### Debounce

- 입력 300ms debounce 후 매칭
- 입력 < 1자: 매칭 안 함, 전체 표시
- 입력 1자: 매칭 (단, prefix 만)
- 입력 2자+: prefix → substring 순

### 한글 자모 처리 (정책)

- 자모 분리 입력 (`ㅂ`, `ㅂㅏ`, `ㅂ밴`) → **매칭 비활성** (UI 측 무시)
- 완성형 음절만 (`밴`, `밴쿠`) → prefix 매칭

### 검색 결과 0건 처리

- "'<query>'에 해당하는 도시가 없어요\n다른 이름으로 검색해 보세요"
- 검색바 클리어 버튼 (×) 노출

## 첫 실행 (Cold Start) 시나리오

v1.0 출시 직후 + 자동화 cron 이 한 번도 안 돈 상태에서 사용자 진입 가능. 또는 자동화 실패 누적으로 `data/all.json` 이 비어있을 가능성.

### Cold start 흐름

```
앱 첫 실행
  ├─ AsyncStorage 캐시 없음 (첫 사용)
  ├─ 1차 fetch 시도: data/all.json
  │   ├─ 성공 (자동화 1회+ 돈 후): all.json 사용 → 캐시 저장 → 정상 표시
  │   └─ 실패 (자동화 미작동, 빈 cities, HTTP 404):
  │       ├─ 시드 (assets/data/seed/all.json) 사용
  │       ├─ OfflineBadge 표시: "자동 데이터 갱신 대기 중 · 시드 데이터 사용"
  │       └─ 24h 후 재시도 (백그라운드)
  └─ 환율: open.er-api.com → 실패시 ECB → 실패시 fx_fallback.json (정적)
```

### 출시 직전 시드 데이터 보증

- M6 출시 전 `data/seed/all.json` 가 **가장 최신 자동화 산출물** 인지 검증
- `scripts/build_data.mjs` 가 항상 최신 `data/cities/*.json` → `seed/all.json` 갱신
- 출시 직전 1회 모든 자동화 워크플로우 수동 트리거 (`workflow_dispatch`) 후 commit
- 시드 데이터 누락 (assets 미포함) 빌드는 EAS Build 가 reject (assets 검증 step)

## 네트워크 상태 관리

`@react-native-community/netinfo` 기반 글로벌 hook.

```ts
// src/lib/network.ts
export function useNetworkStatus(): { isOnline: boolean; isSlow: boolean };

// app/_layout.tsx 에서 NetInfo subscriber 1회 등록
// 모든 화면에서 useNetworkStatus() 로 구독
```

- `isOnline`: NetInfo 의 `isConnected && isInternetReachable`
- `isSlow`: 응답 시간 추정 (3G 이하면 true) — v1.x 검토
- 변경 시 reactive: 오프라인 → 온라인 전환 시 자동으로 stale 캐시 갱신 트리거 (백그라운드 fetch)
- OfflineBadge 컴포넌트가 이 hook 구독

## 페르소나 변경 시 영향 정책

설정 화면 또는 페르소나 시트에서 페르소나 변경 시:

| 영향받는 항목           | 정책                                      |
| ----------------------- | ----------------------------------------- |
| 즐겨찾기                | **유지** (도시 자체는 페르소나와 무관)    |
| 최근 본 도시            | **유지**                                  |
| Compare 카드 구성       | 즉시 변경 (reactive)                      |
| 총비용 카드 가정        | 변경 (자취 비율·월세 카테고리 등 §부록 C) |
| 학비 카드 표시 여부     | 변경 (student → 표시, worker → 숨김)      |
| 세금 카드 표시 여부     | 변경 (worker → 표시, student → 숨김)      |
| 의료 카드 (v1.0 미사용) | N/A                                       |
| onboarded 플래그        | 유지 (true 그대로)                        |
| 사용자 토스트           | "페르소나가 (취업자)로 변경되었어요"      |

페르소나 변경은 **mid-session reactive** — 별도 새로고침 불필요.

## 성능 예산

- 콜드스타트 ≤ 3초 (디바이스 기준 iPhone 12 / Pixel 6 — i.e., 사용자 일반 디바이스)
- 화면 전환 ≤ 300ms
- 메인 번들 ≤ 5 MB (gzipped, EAS Build 결과 측정)
- 초기 fetch 후 인터랙션 차단 시간 ≤ 500ms (시드 즉시 표시 후 백그라운드 fetch)

## 테스트 경계

- **유틸 (`src/lib/*`)**: 100% 단위 테스트. 환율·포매팅·비교 계산은 결정적 로직이므로 고정.
- **스토어 (`src/store/*`)**: 영속화 round-trip(get/set/reload) 테스트.
- **컴포넌트 (`src/components/*`)**: snapshot + 핵심 prop 변형(예: hot 자동 판정) 테스트.
- **화면 (`app/*`)**: 라우팅·스토어 mock 통합 테스트. 네트워크는 모킹.
- **e2e**: Phase 7 에서 수동 체크리스트로 대체 (Detox 도입은 v2 이후).

## 외부 의존성 정책

추가 의존성은 ADR 기록 후 도입. 후보 안에서 줄이는 것을 우선:

- 아이콘 → `react-native-svg` 만, 라이브러리 X (디자인 1:1 매칭 필요)
- 차트 → 도입하지 않음 (듀얼 바는 단순 View)
- 날짜 → JS Date + `formatDate` 유틸 (date-fns 도입 보류)
- HTTP → `fetch` 표준 API
- 분석/추적 → v1.0 도입 안 함 (개인정보 정책)

## 변경 가이드

새 화면·새 카테고리 추가 시 순서:

1. `src/types/city.ts` 에 타입 추가
2. `src/lib/compare.ts` (또는 해당 lib) 에 계산 함수
3. 필요 시 `src/components/` 에 도메인 컴포넌트
4. `app/...` 에 화면 (도메인 컴포넌트 조립만)
5. 데이터 스키마 변경이면 `data/seed/*.json` 동시 갱신 + `scripts/validate_cities.mjs` 통과
6. 결정이 비가역적이면 `docs/ADR.md` 에 새 ADR 추가
