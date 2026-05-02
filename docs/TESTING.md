# 테스트 전략

해외 생활비 비교 앱의 테스트 정책·도구·전체 인벤토리·모킹 규약·통합 시나리오·접근성·성능·엣지 케이스. 모든 step 의 Acceptance Criteria 가 본 문서의 정의를 따른다. 신규 모듈 추가 시 §9 인벤토리에 항목을 함께 추가한다(누락 = step 미완).

---

## 1. 철학

- **AC = 테스트.** 하네스의 step 별 Acceptance Criteria 는 실제 테스트 명령(`npm test -- ...`)이다. 통과하지 않으면 step 미완료.
- **TDD 지향.** 새 lib·컴포넌트 추가 시 테스트를 먼저(또는 동시에) 작성. 단순 wrapper·constants 는 예외.
- **테스트는 문서다.** 의도가 모호하면 주석 대신 표현력 있는 테스트로 남긴다.
- **빠른 피드백.** 전체 suite < 10s 목표. 느린 테스트는 분리하거나 `slow` 태그.
- **결정적.** 시간·랜덤·네트워크 의존 테스트는 모두 모킹. flaky 0건 유지.
- **회귀 방지.** 버그 fix 시 재현 테스트를 먼저 추가하고 fix 가 그 테스트를 통과시키도록 한다.
- **계약 우선.** 함수 시그니처·컴포넌트 prop 의 _의미_ 를 테스트로 고정 (구현 변경에 흔들리지 않게).
- **다층 검증.** unit (lib) → component (RNTL) → integration (screen + 스토어 + lib mocks) → 수동 e2e. 한 층이 잡지 못한 버그는 다음 층이 잡는다.

---

## 2. 도구

| 도구                                                              | 용도                                     | 비고                                                                 |
| ----------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------- |
| Jest 29+                                                          | 테스트 러너                              | `jest-expo` preset 사용                                              |
| @testing-library/react-native v12+                                | 컴포넌트 렌더 + 인터랙션                 | `getByText`, `getByTestId`, `getByA11yLabel`, `fireEvent`, `waitFor` |
| jest-expo                                                         | Expo 환경 mock + transformIgnorePatterns | preset 그대로                                                        |
| @react-native-async-storage/async-storage/jest/async-storage-mock | AsyncStorage 모킹                        | jest.setup.js 에서 자동                                              |
| react-native-svg-mock                                             | SVG 컴포넌트 모킹                        | jest.setup.js                                                        |
| react-test-renderer                                               | snapshot 백엔드                          | jest 와 동일 버전                                                    |
| `jest.useFakeTimers` + `jest.setSystemTime`                       | 시간 모킹                                | 모든 시간 의존 테스트 필수                                           |
| `jest.spyOn(global, 'fetch')`                                     | 네트워크 모킹                            | per-test mockImplementationOnce                                      |
| (선택) `fast-check`                                               | property-based 테스트                    | 포맷·계산 함수에 한정                                                |
| 자체 mock                                                         | expo-router, expo-font, Linking          | jest.setup.js                                                        |

`jest.config.js` 현재 설정 (data-layer phase 시점):

```js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/dist/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|react-native-css-interop))',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    // 다음은 후속 phase 의 책임 — 해당 phase 에서 활성화:
    //   'app/**/*.{ts,tsx}'  : app-shell phase (placeholder routes from bootstrap)
    //   'src/store/**'        : stores phase (zustand 영속화)
    //   'src/components/**'   : components phase (UI primitives)
    '!**/*.d.ts',
    '!**/index.ts',
    '!**/__fixtures__/**',
    '!**/__tests__/**',
    '!**/__test-utils__/**',
    // type-only / const-only 모듈 — 런타임 실행 0 이 정상
    '!src/types/**',
    '!src/theme/**',
  ],
  coverageThreshold: {
    'src/lib/**': { statements: 100, branches: 95, lines: 100, functions: 100 },
    // src/store/**, src/components/**, app/** threshold 는 해당 phase 에서 재활성화.
    // global threshold 는 lib 만 측정 대상이라 의미 없어 제거 (lib threshold 로 충분).
  },
};
```

> **threshold 활성화 로드맵:** 각 후속 phase 진입 시 본 표 갱신. `src/store/**` 100/90/100/100, `src/components/**` 85/75/85/85, `app/**` 75/65/75/75 가 도입 목표 (PRD 의 화면 수 기준).

---

## 3. 파일 위치·네이밍 규약

- **컴포넌트·화면**: 같은 폴더에 co-located. 예: `Icon.tsx` ↔ `Icon.test.tsx`.
- **라이브러리**: 같은 폴더의 `__tests__/`. 예: `src/lib/__tests__/format.test.ts`.
- **스토어**: `src/store/__tests__/`.
- **공용 fixture**: `src/__fixtures__/`.
- **공용 헬퍼**: `src/__test-utils__/`.
- **통합 테스트**: `__integration__/` 루트 폴더 또는 `app/__tests__/`.
- **스냅샷**: `__snapshots__/` 자동 생성, 커밋 포함.

테스트 파일명 패턴:

- 단위: `<Module>.test.ts(x)`
- 통합: `<Flow>.integration.test.tsx`
- 시각 회귀(스냅샷 위주): `<Component>.snapshot.test.tsx`

---

## 4. 커버리지 목표

| 레이어             | statements | branches | functions | 코멘트                    |
| ------------------ | ---------- | -------- | --------- | ------------------------- |
| `src/lib/*`        | **100%**   | 95%      | 100%      | 결정적 로직 — 빈틈 없음   |
| `src/store/*`      | **100%**   | 90%      | 100%      | 영속화 round-trip 필수    |
| `src/components/*` | 85%        | 75%      | 85%       | snapshot + 핵심 prop 변형 |
| `app/*` (화면)     | 75%        | 65%      | 75%       | 통합 smoke + 골든 흐름    |
| 전체               | 85%        | 80%      | 85%       | —                         |

`npm test -- --coverage` 로 임계 검증. 임계 미만이면 step 실패.

미커버 라인은 반드시 사유 코멘트:

```ts
/* istanbul ignore next: defensive — 발생 불가 */
throw new InvariantError('unreachable');
```

---

## 5. 모킹 전략

### 5.1 전역 mock (`jest.setup.js`)

```js
import 'react-native-gesture-handler/jestSetup';

// AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// expo-font (모든 폰트 즉시 로딩 완료로 처리)
jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  loadAsync: jest.fn(() => Promise.resolve()),
  isLoaded: jest.fn(() => true),
}));

// expo-router (Stack/Tabs 가 children 렌더 + Screen subcomponent 양립 형태)
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  Link: ({ children }) => children,
  Stack: Object.assign(({ children }) => children, { Screen: () => null }),
  Tabs: Object.assign(({ children }) => children, { Screen: () => null }),
  Slot: ({ children }) => children,
  Redirect: () => null,
}));

// react-native-svg
jest.mock('react-native-svg', () => require('react-native-svg-mock'));

// expo-splash-screen
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

// react-native Linking
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: jest.fn(() => Promise.resolve(true)),
  canOpenURL: jest.fn(() => Promise.resolve(true)),
}));

// silenceTimers warning
jest.useFakeTimers();
```

### 5.2 시간

```ts
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-04-28T00:00:00+09:00'));
});
afterEach(() => jest.useRealTimers());
```

24h 캐시 만료 검증:

```ts
jest.setSystemTime(new Date('2026-04-28T00:00:00+09:00'));
await fetchCity('vancouver'); // miss → fetch → cache
jest.setSystemTime(new Date('2026-04-28T23:59:59+09:00')); // 23h 59m 후
await fetchCity('vancouver'); // 여전히 hit
jest.setSystemTime(new Date('2026-04-29T00:00:01+09:00')); // 24h 1s 후
await fetchCity('vancouver'); // 만료 → refetch
```

### 5.3 네트워크 (`fetch`)

전역 mock 대신 **테스트별** `jest.spyOn(global, 'fetch')` + `mockImplementationOnce`. 응답 shape 는 fixture 로 분리.

```ts
const fxFixture = { rates: { CAD: 980, USD: 1340, EUR: 1450 }, time_last_update_unix: 1745798400 };

it('FX fetch 성공', async () => {
  const spy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => fxFixture,
  } as any);

  const rates = await fetchExchangeRates();
  expect(rates).toEqual(fxFixture.rates);
  expect(spy).toHaveBeenCalledTimes(1);
});
```

### 5.4 도시 데이터

`src/__fixtures__/` 에 **유효한 최소 City JSON** 빌더 정의 (§7 참조).

### 5.5 Zustand 스토어

각 테스트 직전 초기화:

```ts
beforeEach(async () => {
  await usePersonaStore.persist.clearStorage();
  usePersonaStore.setState({ persona: 'unknown', onboarded: false }, true);
});
```

각 store 테스트 파일 상단에 동일 패턴.

### 5.6 react-native 컴포넌트

기본은 jest-expo preset 처리. `Animated`, `Linking`, `SafeAreaView` 는 위 전역 mock 으로 보강. `Platform.OS` 는 `jest.doMock('react-native/Libraries/Utilities/Platform', () => ({ OS: 'ios', ... }))` 로 케이스별 변경.

---

## 6. 스냅샷 정책

### 6.1 사용처

- 단순 시각 컴포넌트(typography, Icon, RegionPill) — 의도되지 않은 변경 감지
- 복잡 컴포넌트(HeroCard, ComparePair) — 핵심 variant 별 1개씩
- 화면(screens) — 전체 트리 snapshot 대신 핵심 영역만 (`getByTestId('hero')` → `toMatchSnapshot()`)

### 6.2 인라인 vs 파일

- **인라인 스냅샷** (`toMatchInlineSnapshot()`): 짧은 문자열·숫자 결과. 코드와 같이 본다.
- **파일 스냅샷** (`toMatchSnapshot()`): 컴포넌트 트리. `__snapshots__/<file>.snap` 자동 생성.

### 6.3 갱신 규칙

- 스냅샷은 **의도된 디자인 변경시에만** 갱신: `npm test -- -u`.
- 갱신 시 PR 설명에 "어떤 의도로 어떤 변경인지" 명시 필수.
- 한 PR 에서 50개 이상 스냅샷 동시 갱신은 의심 — 디자인 토큰 변경 등 의도 확인.
- CI 도입 후: 스냅샷 갱신은 별도 커밋 (`chore(test): update snapshots after design tokens v2`).

### 6.4 안티패턴

- 스냅샷에 비결정적 값 포함 금지 (date, random id) → 항상 모킹
- 스냅샷이 100라인 넘으면 컴포넌트 분해 검토
- 매번 깨지는 스냅샷 (inline 객체 prop) → 컴포넌트가 prop 정규화하도록 수정

### 6.5 시각 회귀 정책

스냅샷이 시각 회귀의 1차 방어선. 정책:

- 스냅샷 갱신은 **의도된 디자인 변경 PR 에서만** 수행
- 갱신 시 PR 설명에 **"어떤 토큰/컴포넌트가 왜 변경되는지"** 명시 필수
- 한 PR 에서 50개+ 스냅샷 동시 갱신은 **의심** — 토큰 변경 등 의도 확인. 50 미만이면 그대로 PR
- 토큰 v1 → v2 변경 같은 광역 변경: 별도 PR 분리 + ADR
- CI 도입 후: 스냅샷 갱신은 별도 commit (`chore(test): update snapshots — token v2`)
- 스크린샷 기반 시각 회귀 (Percy/Chromatic 등): v1.0 미도입 (비용·복잡도). v2 검토.

### 6.6 스냅샷 가독성

- inline 스타일 객체는 NativeWind 클래스로 정규화 (스냅샷에 noisy 객체 안 보이게)
- testID 와 a11yLabel 만으로 스냅샷이 의미 있게 읽혀야 함
- 큰 트리는 핵심 영역만 (`getByTestId('hero').toMatchSnapshot()`)

---

## 7. 테스트 fixture 와 빌더

### 7.1 디렉터리 구조

```
src/__fixtures__/
├── cities/
│   ├── seoul-valid.ts         # CityCostData (정상 케이스, schema-pass)
│   ├── vancouver-valid.ts     # CityCostData (full-shape, tuition/tax/visa 채움)
│   ├── (향후 추가) tokyo-valid.ts   # JPY (소수 없는 통화)
│   ├── (향후 추가) invalid-*.ts     # 스키마 위반 — 검증 테스트용 (현재는 인라인)
│   └── (향후 추가) empty-*.ts       # 필드 결측 (graceful degradation)
├── seed-roundtrip.test.ts     # data/seed/all.json drift 방지
└── (향후 추가) fx.ts          # 환율 응답
```

> **명명 규칙:** `<id>-<flavor>.ts` (`seoul-valid`, `tokyo-invalid-currency` 등). v1.0 도입 단계에서는 valid 케이스만 파일로, invalid 케이스는 테스트 인라인.

### 7.2 빌더 패턴

```ts
// src/__fixtures__/cities/builder.ts
export const buildCity = (overrides?: DeepPartial<CityCostData>): CityCostData => ({
  id: 'vancouver',
  name: { ko: '밴쿠버', en: 'Vancouver' },
  country: 'CA',
  currency: 'CAD',
  region: 'na',
  lastUpdated: '2026-04-01',
  rent: { share: 950, studio: 1800, oneBed: 2300, twoBed: 3400 },
  food: {
    restaurantMeal: 22,
    cafe: 6,
    groceries: { milk1L: 3.4, eggs12: 7.5, rice1kg: 4.2, chicken1kg: 17.5, ramen: 2.4 },
  },
  transport: { monthlyPass: 105, singleRide: 3.15, taxiBase: 3.5 },
  sources: [
    { category: 'rent', name: 'Kijiji 평균', url: 'https://...', accessedAt: '2026-04-01' },
  ],
  ...deepMerge(overrides ?? {}),
});
```

테스트에서:

```ts
const city = buildCity({ rent: { oneBed: 999 } }); // override 만 변경
```

### 7.2.1 다른 카테고리 상세 화면 fixture

UI_GUIDE.md §카테고리별 상세 화면 사양 의 5개 카테고리에 대응하는 fixture:

- `food.fixture.ts` — 외식 + 식재료 8종
- `rent.fixture.ts` — 4 행 (셰어/원룸/1베드/2베드) + 보증금
- `transport.fixture.ts` — 정기권/1회권/택시
- `tuition.fixture.ts` — 도시별 대학 3~5개
- `tax.fixture.ts` — 연봉대 3개
- `visa.fixture.ts` — 비자 종류별

### 7.3 fixture 카탈로그

- [x] schema 통과 도시 객체 빌더 — `src/__fixtures__/cities/{seoul-valid, vancouver-valid}.ts`. citySchema 테스트 + 통합 smoke 에서 사용.
- [x] `data/seed/all.json` — v1.0 시드 (서울+밴쿠버, schema-pass fixture 기반, ADR-045). 자동화 phase 산출물이 GitHub raw 로 배포되면 24h 내 덮어써짐.
- [x] `src/__fixtures__/seed-roundtrip.test.ts` — 시드 round-trip + fixture↔seed drift 검증.
- [ ] 정상 도시 (서울, 밴쿠버, 도쿄)
- [ ] JPY 통화 (도쿄) — 소수점 없는 통화 검증
- [ ] VND 통화 (호치민) — 큰 수 검증
- [ ] 학비 있음 (밴쿠버 UBC)
- [ ] 학비 없음 (호치민 — 학비 카드 미표시)
- [ ] 세금 있음 (밴쿠버, 토론토)
- [ ] 세금 없음 (대부분)
- [ ] visa 있음
- [ ] visa 없음 (특수 케이스)
- [ ] 필드 결측 (rent.share === null) — fallback 검증
- [ ] 스키마 위반 (currency 누락) — validateCity throws
- [ ] 매우 큰 값 (월세 1억 KRW)
- [ ] 0 값 (식비 0원 — 비정상)
- [ ] 미래 lastUpdated → 정책 결정 (warn vs accept)
- [ ] 매우 오래된 lastUpdated (1년 이상) → warn

---

## 8. 테스트 헬퍼

### 8.1 `renderWithProviders`

```ts
// src/__test-utils__/render.tsx
export function renderWithProviders(
  ui: ReactElement,
  options?: { initialPersona?: Persona; initialFavorites?: string[] }
) {
  if (options?.initialPersona) {
    usePersonaStore.setState({ persona: options.initialPersona, onboarded: true });
  }
  if (options?.initialFavorites) {
    useFavoritesStore.setState({ cityIds: options.initialFavorites });
  }
  return render(<SafeAreaProvider>{ui}</SafeAreaProvider>);
}
```

### 8.2 `mockRouter`

```ts
// src/__test-utils__/router.ts
export const mockRouter = () => {
  const push = jest.fn();
  const replace = jest.fn();
  const back = jest.fn();
  jest.mocked(useRouter).mockReturnValue({ push, replace, back } as any);
  return { push, replace, back };
};
```

### 8.3 `flushPromises`

```ts
export const flushPromises = () => new Promise((r) => setImmediate(r));
```

### 8.4 `mockFetchSequence`

`src/__test-utils__/mockFetchSequence.ts` — fetch 시퀀스 큐잉 헬퍼. 각 호출은 한 번만 사용된다.

```ts
export type FetchResponseSpec =
  | { ok: true; status: number; body: object | string }
  | { ok: false; status: number; body?: object | string }
  | { error: 'timeout' | 'network' };

export function mockFetchSequence(responses: FetchResponseSpec[]): jest.SpyInstance;
```

응답 종류:

- `{ ok: true, status, body }` — 정상 응답. body 가 객체면 자동 직렬화, 문자열은 그대로.
- `{ ok: false, status }` — HTTP 에러 (status 만, body 선택).
- `{ error: 'timeout' }` — `AbortError` 시뮬레이션 (currency.ts / data.ts 의 timeout 분기 검증).
- `{ error: 'network' }` — `TypeError('Network request failed')` 시뮬레이션 (DNS·offline).

사용 예:

```ts
mockFetchSequence([
  { ok: true, status: 200, body: { result: 'success', rates: { KRW: 1380 } } },
  { error: 'timeout' },                    // 두 번째 호출은 타임아웃
  { ok: false, status: 500 },              // 세 번째는 5xx
]);
```

### 8.5 `expectCardLabel(component, label)` 등 도메인 헬퍼

```ts
// 예: 비교 카드의 핵심 4가지(서울값/도시값/배수/차액) 검증
export function expectComparePair(
  rendered,
  expected: { mult: string; sw: number; cw: number; hot?: boolean },
) {
  expect(rendered.getByTestId('mult')).toHaveTextContent(expected.mult);
  // ... (구체적 구현)
}
```

---

## 9. 전체 테스트 인벤토리 (모듈별)

각 모듈의 **모든 테스트 케이스** 를 빠짐없이 나열. 누락 발견 시 본 문서를 먼저 갱신하고 테스트를 추가한다.

### 9.0 `src/__test-utils__/` Bootstrap Sanity

#### `sanity.test.ts`

- [x] `colors.orange === '#FC6011'`
- [x] `HOT_MULTIPLIER_THRESHOLD === 2.0`

#### `rntl-import.test.ts`

- [x] RNTL `render` function importable

### 9.1 `src/lib/format.ts`

#### `formatKRW(value: number): string`

**정상 입력 (천 단위 미만, 콤마):**

- [ ] `0` → `"0원"`
- [ ] `1` → `"1원"`
- [ ] `999` → `"999원"`
- [ ] `1_000` → `"1,000원"`
- [ ] `9_999` → `"9,999원"`

**만 단위 (1자리 소수, 반올림):**

- [ ] `10_000` → `"1만원"` (정수 만)
- [ ] `12_000` → `"1.2만원"`
- [ ] `12_499` → `"1.2만원"` (반내림)
- [ ] `12_500` → `"1.3만원"` (반올림)
- [ ] `12_999` → `"1.3만원"`
- [ ] `100_000` → `"10만원"` (10만 정수)
- [ ] `123_456` → `"12.3만원"`
- [ ] `999_999` → `"100만원"` (반올림 경계)
- [ ] `1_000_000` → `"100만원"`
- [ ] `1_750_000` → `"175만원"`
- [ ] `9_999_999` → `"1000만원"` 또는 `"1,000만원"` (정책 결정)

**억 단위 (확장):**

- [ ] `100_000_000` → `"1억원"` (지원 시) 또는 `"10000만원"` (지원 안 할 시)
- [ ] `123_456_789` → `"1.2억원"` (지원 시)

**음수:**

- [ ] `-1` → `"-1원"`
- [ ] `-12_000` → `"-1.2만원"`
- [ ] `-100_000_000` → `"-1억원"`

**부동소수점·특수:**

- [ ] `1234.5` → `Math.round` 후 처리 → `"1,235원"`
- [ ] `0.5` → `"1원"` (반올림)
- [ ] `-0` → `"0원"` (negative zero 정규화)
- [ ] `NaN` → throws `InvalidNumberError`
- [ ] `Infinity` → throws
- [ ] `-Infinity` → throws
- [ ] `undefined` → throws (TypeScript 차단해도 런타임 방어)
- [ ] `null` → throws

**경계 stress:**

- [ ] `Number.MAX_SAFE_INTEGER` → 합리적 출력 또는 throws
- [ ] `Number.MIN_SAFE_INTEGER` → 동일

#### `formatCurrency(value: number, currency: string): string`

(만약 detail 화면에서 도시 통화 노출 시 필요)

- [ ] `(1800, 'CAD')` → `"$1,800"` (또는 `"CA$1,800"`)
- [ ] `(120000, 'JPY')` → `"¥120,000"` (소수 없음)
- [ ] `(1500, 'EUR')` → `"€1,500"`
- [ ] `(50, 'AUD')` → `"$50"` 또는 `"A$50"`
- [ ] `(2000000, 'VND')` → `"₫2,000,000"` (소수 없음, 큰 수)
- [ ] `(100, 'KRW')` → `"100원"` (KRW 는 소수 없음)
- [ ] 미지의 통화 `(100, 'XYZ')` → throws `UnknownCurrencyError`
- [ ] 음수 → 통화별 부호 위치 (`-$50` 또는 `($50)`)
- [ ] NaN → throws

#### `formatMultiplier(mult: number | '신규'): string`

- [x] `1.0` → `"1.0×"` (화살표 없음)
- [x] `1.04` → `"1.0×"` (반내림)
- [x] `1.05` → `"↑1.1×"` (반올림)
- [x] `1.5` → `"↑1.5×"`
- [x] `1.94` → `"↑1.9×"` (반내림 1자리)
- [x] `1.95` → `"↑2.0×"` (반올림 → hot 경계 진입)
- [x] `2.0` → `"↑2.0×"` (hot 경계)
- [x] `2.01` → `"↑2.0×"` (반내림)
- [x] `9.99` → `"↑10.0×"` (반올림)
- [x] `10.0` → `"↑10.0×"`
- [x] `0.95` → `"↓1.0×"` (반올림)
- [x] `0.94` → `"↓0.9×"` (반내림)
- [x] `0.5` → `"↓0.5×"`
- [x] `0.05` → `"↓0.1×"`
- [x] `'신규'` → `"신규"`
- [x] `0` → throws `InvalidMultiplierError` (배수 0 의미 없음)
- [x] 음수 → throws
- [x] `NaN` → throws
- [x] `Infinity` → throws

#### `formatDate(d: Date | string | number): string`

- [ ] Date 객체 (KST) → `"2026-04-28"`
- [ ] ISO 문자열 (`"2026-04-28T00:00:00+09:00"`) → `"2026-04-28"`
- [ ] ISO 문자열 (UTC) (`"2026-04-27T15:00:00Z"`) → `"2026-04-28"` (KST 변환)
- [ ] Unix epoch milliseconds → `"2026-04-28"`
- [ ] 잘못된 문자열 (`"2026/04/28"`) → throws 또는 정규화 (정책 결정)
- [ ] 미래 날짜 → 정상
- [ ] 매우 과거 (1900-01-01) → 정상
- [ ] `null`/`undefined` → throws

#### `formatShortDate(d: Date | string): string` (Compare 헤더 `04-27`)

UTC 기반 (PR #17 review 이슈 6) — `lastSync` 가 UTC ISO 라 사용자 표시도 UTC 통일.

- [x] `"2026-04-27T00:00:00Z"` → `"04-27"` (UTC 자정 직후)
- [x] `"2026-04-27T23:59:00Z"` → `"04-27"` (UTC 23:59, 로컬 TZ 영향 X)
- [x] `"2026-04-28T00:00:00Z"` → `"04-28"` (UTC 다음 일자)
- [x] `Date` 객체도 동일 (UTC 추출)
- [x] `2026-12-31T15:00:00Z` → `"12-31"` (다른 자릿수)
- [x] 잘못된 입력 → throws `InvalidNumberError`

#### `formatRelativeDate(d: Date, now: Date): string` (선택 — "3일 전")

- [ ] 오늘 → `"오늘"`
- [ ] 어제 → `"어제"`
- [ ] 7일 전 → `"7일 전"`
- [ ] 30일 전 → `"한 달 전"`
- [ ] 90일 전 → `"3개월 전"`

#### `isHot(mult: number | '신규'): boolean`

판정 기준은 표시값 (소수 첫자리 반올림). `formatMultiplier` 와 일관성 보장 (PR #16 review 이슈 1).

- [x] `1.94` → `false` (반올림 1.9, cool)
- [x] `1.95` → `true` (반올림 2.0, formatMultiplier 와 일관)
- [x] `1.99` → `true` (반올림 2.0)
- [x] `2.0` → `true` (hot 경계 정확값)
- [x] `2.04` → `true` (반올림 2.0)
- [x] `2.05` → `true` (반올림 2.1)
- [x] `5.0` → `true`
- [x] `10.0` → `true`
- [x] `1.0` → `false`
- [x] `0.5` → `false`
- [x] `0.01` → `false` (매우 작은 양수)
- [x] `'신규'` → `false` (신규는 hot 아님)
- [x] `0` → throws
- [x] 음수 → throws
- [x] `NaN` → throws
- [x] `Infinity` → throws
- [x] `-Infinity` → throws

#### `getMultColor(mult: number | '신규', hot: boolean): 'orange' | 'navy' | 'gray-2'`

`ComparePair` / `FavCard` / `RecentRow` 공통 색상 정책. `GroceryRow` 는 디자인 의도상 단순 hot/normal 분기 (gray) 라 본 헬퍼 미사용.

- [x] hot=true + mult=0.5 → `'orange'`
- [x] hot=true + mult=1.0 → `'orange'`
- [x] hot=true + mult='신규' → `'orange'` (override 우선)
- [x] hot=false + '신규' → `'navy'`
- [x] hot=false + 0.5 → `'gray-2'` (cool)
- [x] hot=false + 0.94 → `'gray-2'` (반올림 0.9)
- [x] hot=false + 0.95 → `'gray-2'` (반올림 1.0)
- [x] hot=false + 1.0 → `'gray-2'` (동일)
- [x] hot=false + 1.04 → `'gray-2'` (반올림 1.0)
- [x] hot=false + 1.05 → `'navy'` (반올림 1.1, mid)
- [x] hot=false + 1.5 → `'navy'`
- [x] hot=false + 1.94 → `'navy'` (반올림 1.9, hot 미만)

**에러 케이스 — silent fallback 금지 (PR #16 review 이슈 3):**

- [x] mult=0 → throws `InvalidMultiplierError` (hot=true / hot=false 모두)
- [x] mult=음수 → throws
- [x] mult=NaN → throws (hot=false 시 silent navy 반환 차단)
- [x] mult=Infinity → throws
- [x] mult=-Infinity → throws

#### `computeMultiplier(seoulVal: number, cityVal: number): number | '신규'`

PR #17 review 이슈 2 — 이전 compare 화면 로컬 정의가 Infinity 반환해 후속 `formatMultiplier(Infinity)` / `isHot(Infinity)` throw 로 화면 crash. lib 으로 추출 + `'신규'` 반환으로 통일 (compare / detail 공유).

- [x] 정상: `(100, 200)` → `2`, `(200, 100)` → `0.5`, `(150, 150)` → `1`
- [x] `seoulVal=0 + cityVal>0` → `'신규'` (Infinity silent 차단)
- [x] `seoulVal=0 + cityVal=0` → `1` (둘 다 0 = 동일)
- [x] `formatMultiplier` / `isHot` 와 합성 가능 (Infinity throw 회피)

#### `computeBarPcts(seoulVal: number, cityVal: number): { swPct, cwPct }`

- [x] 정상 비율 (`(40, 60)` → `{ 0.4, 0.6 }`)
- [x] 합 0 → `{ 0.5, 0.5 }`
- [x] seoul=0, city>0 → `{ 0, 1 }`
- [x] seoul>0, city=0 → `{ 1, 0 }`

#### Snapshot · Property-based

- [ ] formatKRW: `forall n: integer in [-1e9, 1e9], formatKRW(n) is non-empty string`
- [ ] formatMultiplier: `forall m: float in [0.01, 100], formatMultiplier(m) ∈ /(↑|↓)?\d+\.\d×/`
- [ ] formatDate: `forall d: Date, formatDate(d) matches /\d{4}-\d{2}-\d{2}/`

### 9.2 `src/lib/currency.ts`

#### `convertToKRW(value, currency, fxTable)`

**정상:**

- [ ] `(100, 'CAD', { CAD: 980 })` → `98_000`
- [ ] `(0, 'CAD', { CAD: 980 })` → `0`
- [ ] `(1, 'KRW', {})` → `1` (KRW pass-through)
- [ ] `(1500, 'EUR', { EUR: 1450 })` → `2_175_000`
- [ ] `(120000, 'JPY', { JPY: 9.0 })` → `1_080_000` (작은 환율)
- [ ] `(2000000, 'VND', { VND: 0.054 })` → `108_000` (큰 수, 작은 환율)

**소수 정밀도:**

- [ ] `(1.5, 'CAD', { CAD: 980 })` → `1_470` (반올림 정수)
- [ ] `(1.234, 'CAD', { CAD: 980.5 })` → 정확한 정수 반올림
- [ ] 매우 작은 환율 (`0.0001`) × 매우 큰 값 → 0 또는 정수 반올림

**에러:**

- [ ] 미지의 통화: `(100, 'XYZ', { CAD: 980 })` → throws `UnknownCurrencyError` with `code: "UNKNOWN_CURRENCY"`
- [ ] fxTable 비어 있음 + 비-KRW: throws
- [ ] 음수 금액: throws `InvalidAmountError` (음수 금액 미허용)
- [ ] `NaN` 금액: throws
- [ ] `Infinity` 금액: throws
- [ ] 통화 코드 lowercase (`'cad'`): 정규화 후 처리 또는 throws (정책)
- [ ] 통화 코드 trailing space (`'CAD '`): 정규화 또는 throws

#### `fetchExchangeRates(opts?: { bypassCache?: boolean })` — open.er-api.com

> **v1.0 fallback policy** (ADR-046): 1차 (open.er-api) → 캐시 (stale 포함) → 3차 baseline (`FX_BASELINE_<YYYY>Q<n>` 코드 내 const). 2차 ECB 는 v1.x deferred. 본 함수는 호출자에게 throw 하지 않는다 — 항상 ExchangeRates 반환. 호출자는 `meta:fxLastSync` 메타키로 staleness 별도 판단.

**캐시 hit/miss:**

- [ ] cache hit (24h 이내): 네트워크 호출 없음, 캐시 반환
- [ ] cache miss → fetch 호출, AsyncStorage 에 `fx:v1` 저장, 결과 반환
- [ ] cache 만료(24h + 1s): refetch
- [ ] 23h 59m: 여전히 hit
- [ ] 24h 정확: 만료(경계 정책: `<` strict)
- [ ] `bypassCache: true` → 캐시 무시 + fetch
- [ ] `refreshFx()` === `bypassCache: true` alias

**HTTP:**

- [ ] HTTP 200 정상 shape: 통과 (USD base → KRW base 변환)
- [ ] HTTP 200 응답 빈 body: 내부 `FxParseError` → fallback
- [ ] HTTP 200 비-JSON (HTML): 내부 `FxParseError` → fallback
- [ ] HTTP 200 shape 불일치 (rates 없음 / not object / 배열): 내부 `FxParseError` → fallback
- [ ] HTTP 200 `result !== 'success'`: 내부 `FxParseError` → fallback
- [ ] HTTP 200 `rates.KRW` 누락 또는 0 / 음수: 내부 `FxParseError` → fallback
- [ ] HTTP 200 KRW 외 유효 통화 0개: 내부 `FxParseError` → fallback
- [ ] HTTP 200 비-ISO 4217 코드 (소문자, 숫자) 또는 비-number rate: 결과에서 제외 (다른 통화는 통과)
- [ ] HTTP 301/302 redirect: fetch 가 자동 추적
- [ ] HTTP 404 / 500: 내부 `FxFetchError` → fallback
- [ ] response.text() 자체가 throw: 내부 `FxParseError` → fallback

**네트워크:**

- [ ] DNS 실패 / TypeError: 내부 `FxFetchError` → fallback (캐시 또는 baseline)
- [ ] timeout (10s, AbortController): 내부 `FxTimeoutError` → fallback
- [ ] 캐시 stale (>24h) + fetch 실패: stale 캐시 반환, `meta:fxLastSync` 갱신 X
- [ ] 캐시 없음 + fetch 실패: `FX_BASELINE_<YYYY>Q<n>` **사본** 반환 (mutate-safe), 캐시 / lastSync 갱신 X

**Baseline (3차 fallback):**

- [ ] cold-start (캐시 없음 + 1차 실패) → baseline 반환
- [ ] baseline 은 사본 — 호출자가 mutate 해도 다음 호출 영향 없음
- [ ] baseline 분기 갱신 정책 (ADR-047): const 이름 + 값 + 테스트 동시 갱신

**동시성:**

- [ ] 동일 시점 `fetchExchangeRates()` 2회 호출: fetch 1회만 (in-flight dedup), 동일 Promise 반환 (ref equality)
- [ ] 첫 호출 완료 후 inflight 해제 — 두 번째 호출은 cache hit
- [ ] 실패 fallback 후에도 inflight 정리 — 다음 호출이 정상 동작

**손상된 캐시 자동 정리 (`fx:v1`):**

- [ ] 잘못된 JSON → 자동 삭제 + miss 처리
- [ ] shape 위반 (`rates` 누락 / 비-객체 / 빈 객체 / 음수 환율): 자동 삭제
- [ ] cache 가 JSON-parseable primitive (예: `"42"`): 자동 삭제
- [ ] `AsyncStorage.getItem` 자체가 throw: null 처리 (silent)
- [ ] `AsyncStorage.removeItem` reject 도 best-effort (catch swallow) — 다음 fetch 정상 진행

### 9.3 `src/lib/compare.ts`

#### `computeCategoryComparison(category, seoul, city, fx)`

**카테고리 매트릭스 (per persona × city × category):**

각 항목은 (persona × category × city) 의 의미 있는 조합 검증.

**rent:**

- [ ] `(seoul.rent.oneBed=700_000, vancouver.rent.oneBed=2300 CAD, fx={CAD:980})` → `multiplier ≈ 3.22`, `cityValueKRW=2_254_000`
- [ ] 페르소나=student → `share` 사용
- [ ] 페르소나=worker → `oneBed` 사용
- [ ] `seoul.rent.share === null` → fallback 정책 (e.g., studio 사용 또는 throws)

**food:**

- [ ] 자취 70/외식 30 평균
- [ ] 자취 50/외식 50 평균
- [ ] groceries 결측 → 외식만으로 계산
- [ ] restaurantMeal === 0 → throws (비정상 데이터)

**transport:**

- [ ] 정기권 비교 단순
- [ ] monthlyPass 결측 → singleRide × 30 fallback (정책)

**tuition:**

- [ ] 도시별 첫 학교 학사 학비 기준
- [ ] tuition 배열 비어 있음 → `null` multiplier (서울 기준 학비 가정 없음)
- [ ] level 매칭 없음 → throws

**tax:**

- [ ] 연봉 6만 단위 takeHomePctApprox 비교
- [ ] tax 배열 비어 있음 → `null` (워커 페르소나 시 hide)

**visa (서울 미존재):**

- [ ] `seoul.visa === undefined`, `city.visa === { studentApplicationFee: 150 }` → `isNew=true`, `multiplier=null`
- [ ] city.visa 도 undefined → 카드 미표시 (return undefined)

**FX 에러 전파:**

- [ ] fx 결측: `UnknownCurrencyError` 그대로 throw
- [ ] fx 결측이지만 KRW (서울만): KRW pass-through

#### `computeMonthlyTotal(persona, seoul, city, fx)` — PRD 부록 C 정확 일치

**유학생 (`student`):**

- [ ] 월 합계 = `share rent + (자취 70% + 외식 30%) food + monthlyPass transport`
- [ ] 학비는 합계 미포함, `tuitionAnnual` 별도 필드로 반환
- [ ] 의료·세금·통신비 미포함
- [ ] 결과 단위 KRW
- [ ] seoul vs vancouver 양쪽 동일 가정 적용

**취업자 (`worker`):**

- [ ] 월 합계 = `oneBed rent + (자취 50% + 외식 50%) food + monthlyPass transport`
- [ ] 의료비 미포함 (v1.0)
- [ ] 학비 미포함
- [ ] 세금은 비용이 아니라 수입 차감 항목 → 합계 미반영

**unknown:**

- [ ] 두 페르소나 결과를 모두 반환 (객체 `{ student: ..., worker: ... }`) 또는 합집합 정책 (결정 필요)
- [ ] 화면은 `student` 가정 디폴트 표시 + 토글 제공

**엣지:**

- [ ] city.rent.share === null + persona=student → fallback 정책 (studio 사용? throw?)
- [ ] city.transport.monthlyPass 결측 → 0 또는 throw 정책
- [ ] 환율 결측 → throws
- [ ] seoul 데이터에 monthlyPass 없음 → 기본값 (5.5만) 또는 throw

#### `getCardListForPersona(persona): Category[]`

- [ ] `student` → `['rent', 'food', 'transport', 'tuition', 'visa']` (정확한 순서, 5개)
- [ ] `worker` → `['rent', 'food', 'transport', 'tax', 'visa']` (5개)
- [ ] `unknown` → `['rent', 'food', 'transport', 'tuition', 'tax', 'visa']` (합집합 6개, 순서 명시)
- [ ] 잘못된 persona → TypeScript 차단, 런타임은 throws

### 9.4 `src/lib/data.ts` (단일 batch fetch)

ADR-031 에 따라 21개 도시(서울 + 20) 는 단일 `all.json` 으로 fetch.

#### `loadAllCities(options?)`

**캐시:**

- [ ] cache hit (24h 이내): 네트워크 호출 없음, 즉시 반환
- [ ] cache miss → primary URL fetch → 저장 → 반환
- [ ] cache 만료 (>24h) → refetch
- [ ] `options.bypassCache=true`: 캐시 무시 (수동 새로고침)
- [ ] 캐시 키: `data:all:v1` 정확히
- [ ] 캐시에 timestamp 동시 저장 (TTL 검증용)
- [ ] 23h 59m: 여전히 hit
- [ ] 24h 정확: 만료 (경계 정책 명시)

**HTTP (primary GitHub Raw):**

- [ ] 200 + 정상 JSON: schemaVersion 검증 → cities 21개 모두 validateCity 통과 → 반환
- [ ] 200 + schemaVersion 미일치: throws `DataSchemaVersionError`
- [ ] 200 + cities 일부 누락 (예: 21개만): warn + 있는 도시만 반환
- [ ] 200 + 깨진 JSON: throws `DataParseError` → backup 시도
- [ ] 200 + 빈 body: throws → backup
- [ ] 200 + HTML (프록시): throws → backup
- [ ] 200 + 한 도시 스키마 위반: 해당 도시만 제외 + 나머지 반환 + warn
- [ ] 200 + 추가 필드 (스키마 외): 통과 + 무시
- [ ] 404: throws → backup
- [ ] 500: throws → backup
- [ ] 301/302: fetch 자동 추적

**Fallback chain:**

- [ ] primary 실패 → backup (jsDelivr) 시도
- [ ] backup 성공: 정상 동작, 캐시 저장
- [ ] backup 실패: 시드 (`assets/data/seed/all.json`) 사용 + 경고 플래그
- [ ] 시드 손상 (assets bundling 문제): throws `CitiesUnavailableError`

**네트워크:**

- [ ] DNS 실패 (primary) → backup 시도
- [ ] DNS 실패 (둘 다) → 시드
- [ ] timeout (10s, primary) → backup
- [ ] timeout (둘 다) → 시드

**동시성:**

- [ ] 동시 호출 2회: fetch 1회만 (in-flight dedup, 같은 Promise 반환)
- [ ] 첫 호출 진행 중 두 번째 호출: dedup
- [ ] 첫 호출 완료 후 두 번째: 캐시 hit

#### `getCity(id: string): CityCostData | undefined`

- [ ] loadAllCities 후 호출: 메모리 맵에서 즉시 반환
- [ ] 존재하는 도시 id: 데이터 반환
- [ ] 존재하지 않는 도시 id: undefined
- [ ] loadAllCities 호출 전: undefined (또는 throws — 정책 결정)
- [ ] 동기 함수 (Promise 아님)

#### `getAllCities(): CitiesMap`

- [ ] loadAllCities 후 호출: 메모리 맵 즉시 반환
- [ ] 호출 전: 빈 객체 또는 throws (정책)
- [ ] 동기 함수

#### `getLastSync(): Promise<string | null>` (app-shell phase step 4)

`meta:lastSync` 메타키 즉시 read. 캐시 새로고침 트리거 안 함. 부트로더가
`useSettingsStore.lastSync` 단방향 sync 에 사용 (DATA.md §269).

- [x] 메타키 존재 → ISO string 반환
- [x] 메타키 없음 → null 반환
- [x] saveCacheEntry 가 갱신한 메타키와 round-trip 일치

#### `validateCity(json): CityCostData` — 개별 도시 스키마 검증

(§14 에서 상세 매트릭스)

- [ ] 필수 필드 검증
- [ ] 타입 검증
- [ ] 값 sanity 검증
- [ ] 통과 시 정규화된 객체 반환
- [ ] 실패 시 throws `CitySchemaError` (어느 필드가 문제인지 메시지)

#### `validateAllJson(input: unknown): AllCitiesData` — 배치 파일 검증

- [ ] schemaVersion === 1 (다른 값 시 throws `CitySchemaError`)
- [ ] cities 가 객체
- [ ] cities 의 키 ≥ 1
- [ ] cities 의 모든 값이 validateCity 통과 (실패 시 어느 도시·어느 필드인지 메시지 포함)
- [ ] generatedAt 이 ISO datetime, fxBaseDate 가 ISO date
- [ ] 미지의 추가 필드 통과 + 무시
- [ ] 실패 시 throws `CitySchemaError` (스키마 위반) — JSON.parse 실패는 `parseAllCitiesText` 가 `CityParseError` throw

#### `parseAllCitiesText(text: string): AllCitiesData`

- [ ] 정상 JSON + 정상 schema → 통과
- [ ] 깨진 JSON / 빈 문자열 / HTML 응답 → throws `CityParseError`
- [ ] JSON.parse 성공 + schema 위반 → throws `CitySchemaError` (parse 가 아닌 schema 단계)
- [ ] `CityParseError.cause` 에 원본 SyntaxError 보존

#### `refreshCache()`

- [ ] `data:all:v1` 키 삭제 후 loadAllCities 강제 호출
- [ ] `fx:v1` 도 갱신
- [ ] `useSettingsStore.lastSync` 업데이트
- [ ] 결과 객체 반환 (`{ ok: true, lastSync: ISO }`)
- [ ] 실패 시 (`{ ok: false, reason: string }`)
- [ ] 사용자 토스트 메시지에 사용

#### `migrateCacheV1ToV2(stored): CitiesMap | null` (스키마 변경 시)

- [ ] v1 캐시를 v2 형식으로 변환
- [ ] 변환 불가 → null (캐시 무시 + 재요청)
- [ ] 새 필드 기본값 채움
- [ ] 마이그레이션 후 새 키 (`data:all:v2`) 에 저장 + 구 키 삭제

#### `validateCity(json): CityCostData` — 스키마 검증

**필수 필드 결측:**

- [ ] `id` 누락 → throws
- [ ] `name.ko` 누락 → throws
- [ ] `name.en` 누락 → throws
- [ ] `country` 누락 → throws
- [ ] `currency` 누락 → throws
- [ ] `lastUpdated` 누락 → throws
- [ ] `rent` 누락 → throws
- [ ] `food` 누락 → throws
- [ ] `transport` 누락 → throws
- [ ] `sources` 누락 → throws
- [ ] `region` 누락 → throws

**타입 위반:**

- [ ] `currency` 가 number → throws
- [ ] `rent.oneBed` 이 string → throws
- [ ] `rent.share` 이 음수 → throws
- [ ] `lastUpdated` 가 잘못된 형식 (`2026/04/01`) → throws
- [ ] `country` 가 ISO 3166-1 alpha-2 아님 (`KOR`) → throws (또는 정규화)
- [ ] `currency` 가 ISO 4217 아님 (`KRW2`) → throws

**선택 필드:**

- [ ] `tuition` 없음 → 통과
- [ ] `tax` 없음 → 통과
- [ ] `visa` 없음 → 통과
- [ ] `tuition` 있지만 빈 배열: 통과 (학비 카드 미표시)

**값 sanity:**

- [ ] `lastUpdated` 미래 날짜: warn 또는 reject (정책)
- [ ] `lastUpdated` 1년 이상 과거: warn
- [ ] `rent.oneBed` 매우 크거나 작은 값: 통과 (정책으로 분기 갱신 시 30% 변동 검증은 별도 스크립트)

#### `migrateCacheV1ToV2(stored): CityCostData | null` (스키마 변경 시)

- [ ] v1 캐시를 v2 형식으로 변환
- [ ] 변환 불가 → null (캐시 무시)
- [ ] 새 필드 기본값 채움
- [ ] 마이그레이션 후 새 키 (`city:<id>:v2`) 에 저장 + 구 키 삭제

### 9.4.1 `__integration__/dataLayer.integration.test.ts` (data-layer phase step 4)

시드 fallback 경로 + 환율 변환 round-trip 을 모듈 경계 너머 검증. 실 네트워크 의존 없음.

- [ ] 네트워크 실패 → 시드 fallback → 메모리 맵 갱신 → `getCity('vancouver')` / `getAllCities()` 즉시 반환
- [ ] 서울 KRW pass-through (`convertToKRW(amount, 'KRW', {})` === amount)
- [ ] 밴쿠버 CAD → KRW 변환 (`fetchExchangeRates({ bypassCache: true })` 가 fetch 실패 시 hardcoded baseline 반환 → `convertToKRW` 가 정수 KRW)
- [ ] `refreshCache()`: 네트워크 실패해도 시드 + FX baseline 으로 ok=true + lastSync 반환
- [ ] `getAllCities()` 가 loadAllCities 호출 전 빈 객체, 후 시드 도시 2개 반환

### 9.4.2 `src/store/hydration.ts` (waitForAllStoresHydrated, stores phase step 4)

4 store 의 `persist.hasHydrated()` 가 모두 true 가 될 때까지 대기하는 boundary
helper. app-shell phase 의 부트로더가 useFonts + 4 store hydration 을 Promise.all
로 합성한다 (ARCHITECTURE.md §부팅·hydration 순서). store 추가 시 본 함수의
`Promise.all` 인자에 한 줄 추가 (ADR-051).

- [x] 모든 store 가 이미 hydrated → 즉시 resolve
- [x] 한 store 만 미완 → 그 store 의 `onFinishHydration` 콜백 발화 후 resolve
- [x] 4 store 모두 미완 → 4개 모두 완료 후에야 resolve (3 완료 시점은 pending)
- [x] resolve 후 등록 unsubscribe 호출 (콜백 누수 방지)
- [x] 스키마 위반 캐시 → onRehydrateStorage fallback 후 hasHydrated=true → 정상 resolve
- [x] (ADR-052 mitigation) JSON.parse 실패 캐시로 hasHydrated 가 false 로 남는 latent
      hang 은 `waitForStoresOrTimeout` 의 timeout guard 로 회복 (app-shell step 1).

### 9.4.3 `src/store/hydration.ts` — `waitForStoresOrTimeout` (app-shell phase step 1)

ADR-052 강제 요구사항 — hydration race + timeout fallback. 미완 store 만
INITIAL_STATE 강제 (정상 hydrated store 는 보존). dev 빌드 콘솔 warn.

- [x] `DEFAULT_HYDRATION_TIMEOUT_MS` 상수 ADR-052 의 3~5초 범위 내
- [x] 모든 store hydrated → `'ok'` 반환, setState fallback 호출 없음
- [x] 한 store 만 미완 + timeout → `'timeout'`, 그 store 만 `setState(INITIAL)`
- [x] 4 store 모두 미완 + timeout → 4 store 모두 `setState(INITIAL)`
- [x] timeout 시 정상 hydrated store 는 보존 (조합 변경: favorites/settings 만 미완)
- [x] timeout 만료 시 dev `console.warn` 1회 + 'ADR-052' 문구 포함
- [x] 정상 완료가 timeout 보다 먼저 → `'ok'`, setState 호출 없음 + warn 없음
- [x] 인자 미제공 시 default 5000ms 적용

### 9.5 `src/store/persona.ts`

**기본 동작:**

- [x] 초기 상태: `{ persona: 'unknown', onboarded: false }`
- [x] `setPersona('student')` → state 변경
- [x] `setPersona('worker')` → state 변경
- [x] `setPersona('unknown')` → state 변경
- [x] `setOnboarded(true)` → state 변경
- [x] `reset()` → 초기 상태 복귀

**영속화:**

- [x] persist round-trip: setPersona('student') 후 새 hook 인스턴스에서 'student' 읽힘
- [x] AsyncStorage 키: `persona:v1`
- [x] hydration: `useStore.persist.hasHydrated()` 가 false → true 전이
- [x] hydration 미완 시 read: 초기값 반환
- [x] AsyncStorage 손상 (잘못된 JSON): 초기 상태 fallback + INITIAL 직렬화로 정리 (다음 부팅 시 정상 fallback)
- [x] AsyncStorage 손상 (유효하지 않은 persona literal): isValidPersistedState 검증 후 초기 상태 fallback

**Hydration race:**

- [x] hydration 완료 전 `usePersonaStore.getState().persona` 호출 → 초기값
- [x] hydration 완료 후 동일 호출 → 저장된 값
- [x] subscribe 콜백: hydration 후 1회 호출 보장

**마이그레이션:**

- [x] v1 entry: version 일치 → migrate 함수 호출 안 됨 (rehydrate 정상 동작 검증)
- [x] 미래 v0 entry (구버전) → migrate stub 이 state 통과 (v2 도입 시 본 케이스가 실 변환 검증으로 확장)
- [ ] (v2 도입 시 추가) v1 → v2: 새 필드 기본값 채움 / migrate 함수 spy

**Selector:**

- [x] `usePersonaStore(s => s.persona)` 다른 컴포넌트 동시 사용 시 같은 값 → 동일 ref (불필요한 리렌더 방지)

### 9.6 `src/store/favorites.ts`

**기본:**

- [x] 초기 상태: `cityIds: []`
- [x] `add('vancouver')` → `['vancouver']`
- [x] `add('vancouver')` 두 번: 중복 제거, 길이 1 유지
- [x] `add('toronto')` → `['vancouver', 'toronto']` (추가 순서)
- [x] `remove('vancouver')` → `['toronto']`
- [x] `remove('nonexistent')` → 에러 없이 무시
- [x] `has('toronto')` → `true`
- [x] `has('paris')` → `false`
- [x] `clear()` → `[]`

**상한·정책:**

- [x] 50개 도달: 51번째 add → 거부 + 결과 반환 (`{ ok: false, reason: 'limit' }`)
- [x] 49 + add 1 → 50, OK
- [x] 50 + remove 1 + add 1 → 50, OK

**Bulk:**

- [x] `addMany(['v', 't'])` → 순서 보존, 중복 제거
- [x] `addMany([...])` 가 limit 위반 → atomic 거부 (부분 추가 X), 기존 state 유지
- [x] `removeMany(['v'])` → 일부만 제거 가능
- [x] `toggle('v')` 두 번 → 빈 배열로 복귀

**Persist:**

- [x] add → reload → 같은 배열
- [x] remove → reload → 갱신 반영

**마이그레이션 (deferred):**

- [ ] (v2 도입 시 추가) v1 → v2: migrate 함수 spy + 새 필드 기본값 검증

### 9.7 `src/store/recent.ts`

- [x] 초기 상태: `cityIds: []`
- [x] `push('vancouver')` → `['vancouver']`
- [x] `push('toronto')` → `['toronto', 'vancouver']` (최신이 앞)
- [x] 같은 도시 push (`vancouver` 다시): `['vancouver', 'toronto']` (최신 위치, 중복 제거)
- [x] 5개 push 후 6번째: 마지막 evict
- [x] 정확히 5개일 때: max 유지
- [x] `clear()` → 빈 배열
- [x] persist round-trip

**마이그레이션 (deferred):**

- [ ] (v2 도입 시 추가) v1 → v2: migrate 함수 spy + 새 필드 기본값 검증

### 9.8 `src/store/settings.ts`

시그니처: `updateLastSync(date: Date | string | null): void` — Date 는 `toISOString()`,
string 은 `new Date(string).toISOString()` 정규화, null 은 clear. 잘못된 입력 (NaN
Date) 은 silent 무시 (lib 가 아닌 reactive 표시용 store 라 throw 안 함, ADR-014).

- [x] 초기: `lastSync: null`
- [x] `updateLastSync(Date)` → ISO 문자열로 저장
- [x] `updateLastSync(string)` → `new Date(string).toISOString()` 정규화 결과 저장
- [x] `updateLastSync(string)` 비-UTC ISO → UTC 정규화 (예: `+09:00` → `Z`)
- [x] `updateLastSync(null)` → clear (`lastSync: null`)
- [x] 잘못된 string (`'not-a-date'`) → silent 무시, 기존값 유지
- [x] 잘못된 Date (`new Date('garbage')`) → silent 무시, 기존값 유지
- [x] `reset()` → 초기 상태 복귀
- [x] persist key 정확히 `settings:v1`
- [x] partialize: 액션 미영속화, lastSync 만 저장
- [x] persist round-trip (rehydrate 후 같은 값)
- [x] hydration 후 null 이 아닌 값 (저장돼 있던 값 복원)
- [x] 손상 캐시 (잘못된 JSON) → 초기 상태 fallback + INITIAL 직렬화로 정리
- [x] 손상 캐시 (lastSync 가 number) → 초기 상태 fallback
- [x] 손상 캐시 (lastSync 가 객체) → 초기 상태 fallback

**마이그레이션 (deferred):**

- [ ] (v2 도입 시 추가) v1 → v2: migrate 함수 spy + 새 필드 기본값 검증

### 9.9 `src/components/typography/Text.tsx` (components phase step 0)

8 variant — Display / H1 / H2 / H3 / Body / Small / Tiny / MonoLabel. 단일 base
+ variant 매핑. fontFamily / fontSize / color / line-height / letter-spacing 모두
tailwind.config.js 토큰 — 매직 hex / px 금지 (CLAUDE.md CRITICAL).

- [x] children 렌더 (영어 / 한글 / 한글+이모지 / 숫자) — 8 variant × 4 = 32 case
- [x] 정확한 fontFamily class 적용 (font-manrope-extrabold 등 8 variant)
- [x] 정확한 fontSize class 적용 (text-display 등)
- [x] 정확한 color 토큰 — 5 색상 (navy / gray / gray-2 / white / orange) override
- [x] line-height / letter-spacing 은 tailwind config 의 fontSize tuple 에 통합 (text-display 가 line-height + letter-spacing 포함)
- [x] uppercase 변환 (MonoLabel) — 영문 / 한국어 / 숫자 케이스 분기
- [x] `numberOfLines={1}` / `={2}` / 미제공 (3 case) passthrough
- [x] `style` prop passthrough
- [x] `testID` passthrough
- [x] `className` prop composed (추가 클래스 결합)
- [x] `accessibilityRole` (heading 류 default 'header', body/small/tiny default 'text', override 가능)
- [x] `displayName` — 8 variant 모두 export 이름과 일치 (`Display` / `H1` / `H2` / `H3` / `Body` / `Small` / `Tiny` / `MonoLabel`) — React DevTools 가독성
- [ ] 한국어 단어 단위 wrap 동작 (RN Text 기본 — 검증 불요)
- [ ] 매우 긴 텍스트: `numberOfLines` 없을 때 wrap 됨 (RN Text 기본 — 검증 불요)
- [ ] snapshot per component (TESTING.md §6 안티패턴 — 핵심 텍스트 검증으로 대체)

### 9.10 `src/components/Icon.tsx` (components phase step 1)

design/README.md §Assets 의 25 아이콘 카탈로그 단일 진입점. lucide-react-native
(ADR-054) 정적 매핑. 사용처는 IconName 만 알면 됨 — lucide 컴포넌트 직접
import 금지.

**전체:**

- [x] 25 IconName (`home, compare, star, settings, search, back, more, house, fork, bus, passport, graduation, briefcase, globe, chev-right, chev-down, info, refresh, mail, shield, book, user, plus, filter, up`) 각각 렌더
- [x] ICON_NAMES 배열은 25개 + 중복 없음
- [ ] 잘못된 name (TypeScript 차단) — 런타임 도달 불가, 테스트 불요
- [ ] snapshot per icon (TESTING.md §6 안티패턴 — props 검증으로 대체)

**Props:**

- [x] `size` 기본 22 → wrapper width/height 22, 커스텀 32 적용 검증
- [x] `color` / `strokeWidth` prop 전달 시 crash 없음 (lucide 내부 색상 / stroke 적용은 라이브러리 책임 — 테스트 환경에서 SVG props 검증 어려움)
- [x] `color` 타입은 `tokens.colors` literal union 만 허용 (매직 hex 차단)
- [x] `testID` 전달
- [x] `accessibilityLabel` 전달 / 미제공 모두 검증
- [x] **iOS / Android 크로스플랫폼 a11y** — `accessibilityLabel` 있을 때: `accessible=true` (iOS VoiceOver 노출) + `importantForAccessibility='yes'` (Android TalkBack 노출) + `accessibilityRole='image'`
- [x] **데코레이티브 아이콘** — `accessibilityLabel` 없을 때: `accessible=false` (iOS skip) + `importantForAccessibility='no'` (Android skip) + role 미설정

**Stroke 정합성:**

- [ ] 모든 line-style 아이콘: viewBox 24×24 (lucide-react-native 라이브러리 보증)
- [ ] 모든 SVG path 가 stroke 속성 사용 (lucide 책임)
- [ ] `more` 는 lucide 의 `MoreHorizontal` (line dots) — design/README §9.10 의 "fill circle 3개" 와 시각 차이 minor. ADR-054 명시.

### 9.11 `src/components/Screen.tsx` (components phase step 2)

SafeAreaView wrap + 배경 + horizontal padding + 선택적 ScrollView. testID 는
inner View / ScrollView 에 부여 (jest 의 SafeAreaView mock 이 passthrough 라
chrome 클래스 검증은 inner 노드 기준).

- [x] 자식 렌더
- [x] SafeAreaView 적용 (default edges `['top', 'bottom']`, prop 으로 override)
- [x] 배경색 토큰 + flex-1 (SafeAreaView 의 className)
- [x] `scroll=true`: ScrollView wrap + `contentContainerStyle.flexGrow=1`
- [x] `scroll=false` (default): 일반 View
- [x] `padding` 토큰 4 case (none / screen-x / screen-x-tight / screen-x-loose)
- [x] `scroll=true + padding=none`: ScrollView className 미설정
- [x] `scroll=true + padding=screen-x`: ScrollView className 에 padding
- [x] `testID` 전달 (inner View / ScrollView)
- [ ] iOS notch / iPhone SE: SafeAreaView 라이브러리 책임 — 본 컴포넌트는 prop 위임

### 9.12 `src/components/TopBar.tsx` (components phase step 2)

**Prop 조합 매트릭스 (8개):**

- [x] title 만
- [x] title + back
- [x] title + right
- [x] title + back + right
- [x] title + subtitle
- [x] title + subtitle + back
- [x] title + subtitle + right
- [x] title + subtitle + back + right (full)

**Title variant:**

- [x] `titleVariant` 기본 'h2' (18px Manrope 800) — Home / Settings / Detail
- [x] `titleVariant='h3'` (14px Manrope 700) — Compare 화면 사양

**개별 동작:**

- [x] back 버튼 탭 → onBack 호출
- [x] back 버튼 시각: 36×36, `bg-light` (디자인 토큰)
- [x] right accent='star' → `bg-orange-soft`
- [x] right accent='default' → `bg-light`
- [x] right 버튼 탭 → onRightPress 호출
- [x] **`rightIcon` + `onRightPress` 둘 다 있어야 버튼 렌더** — 한쪽만 주면 silent no-op 회피 차원에서 버튼 미렌더 (rightIcon-only / onRightPress-only 두 케이스 모두 검증)
- [x] title 긴 문자열: `numberOfLines=1`
- [x] subtitle 11px Tiny: `numberOfLines=1`
- [x] back 버튼 a11y — `role='button'` + label `'뒤로가기'`
- [x] right 버튼 a11y — `role='button'` + label (default `'우측 메뉴'`, `rightIconAccessibilityLabel` prop 으로 override 가능)
- [x] testID 미제공 시 정상 렌더 + label 로 조회 가능

### 9.13 `src/components/BottomTabBar.tsx` (components phase step 2)

- [x] 4개 탭(홈/비교/즐겨찾기/설정) 한국어 라벨 렌더
- [x] active 탭 (4 케이스 매트릭스) — `accessibilityState.selected=true`
- [x] inactive 탭 — `accessibilityState.selected=false`
- [x] 4 탭 클릭 → onSelect(tab) 호출 (각 탭별 검증)
- [x] active 탭 라벨 → `text-orange`, inactive → `text-gray-2`
- [x] safe area bottom padding (iPhone X+ mock 14px)
- [x] iPhone SE (bottom inset 0) — paddingBottom: 0
- [x] 탭 a11y — `role='button'` + accessibilityLabel (한국어)
- [x] testID 미제공 시 정상 렌더 + label 로 조회 가능
- [ ] 탭 변경 시 햅틱 피드백 — v1.0 미스코프 (별도 ADR)
- [ ] 라벨 폰트는 design/README "Mulish 600" 이지만 Mulish-SemiBold 에셋 부재로 Mulish Regular 로 대체. v1.x 에셋 추가 시 갱신.

### 9.14 `src/components/cards/HeroCard.tsx` (components phase step 4)

Compare 화면 hero card. design/README §3. 2 variant + 정규화 progress bar +
❓ info 아이콘 hook. gradient 미도입 (단색 fallback) — step4.md 결정, 후속
phase 에서 재검토.

**Variant:**

- [x] `variant="orange"`: bg-orange + p-hero-pad (18px) + rounded-hero-lg (22px) + 6px progress (h-1.5) + mult white + `shadows.orangeHero` (rgba 0.25)
- [x] `variant="navy"`: bg-navy + p-4 (16px) + rounded-hero (20px) + 4px progress (h-1) + mult orange 강조 + `shadows.navyCard` (rgba 0.18). 단색 fallback (gradient 미도입)

**Props:**

- [x] leftLabel / leftValue / rightLabel / rightValue / centerMult 모두 렌더
- [x] 시각 계층 (design §3 / hi-fi compare.jsx) — 좌(서울) 18px Manrope Bold 700 (`H2`), 우(도시) 18px Manrope ExtraBold 800 (`H2` + `FONT_FAMILY_RAW.manropeExtraBold` inline override), 가운데(mult) 30px Manrope ExtraBold 800 (`Display`). 가운데 = 시각 1순위. 폰트 raw 이름은 `tokens.ts FONT_FAMILY_RAW` 단일 출처 (매직 스트링 회피).
- [x] centerCaption 있을 때 렌더 / 미제공 시 미렌더
- [x] footer 있을 때 렌더 + wrapper opacity = `HERO_FOOTER_OPACITY` (0.7, design §3 본문 약화)
- [x] footer 미제공 → wrapper 자체 미렌더
- [x] 상단 고정 라벨 "한 달 예상 총비용" 렌더 (한국어는 MonoLabel uppercase 변환 없음)
- [x] orange 합 = 1 → 흰 segment 0.5 / 1.0 대비 (`HERO_SEOUL_BAR_OPACITY.orange`, design §3)
- [x] navy variant — 트랙 bg-white opacity 0.15 (`HERO_SEOUL_BAR_OPACITY.navy`) + 도시 막대 bg-orange (design §4 detail navy hero)
- [x] sw=0, cw=1 → 도시 막대만 렌더 (서울 미렌더)
- [x] sw=1, cw=0 → 서울 막대만 렌더
- [x] 합 = 0 → 양쪽 막대 미렌더
- [x] 합 = 1 (0.4 / 0.6) → 비율 그대로 보존
- [x] 합 < 1 (0.3 + 0.3 = 0.6) → 정규화 후 0.5 / 0.5
- [x] 합 = 2 (1 + 1) → 정규화 후 0.5 / 0.5
- [x] 음수 / >1 입력 → clamp + dev console.warn
- [x] progress bar 두께 — orange variant `h-1.5` (6px), navy `h-1` (4px)
- [x] info 버튼 hitSlop = 13×4 → icon 18 + slop 26 = 44 (UI_GUIDE §617 최소 터치 타겟)
- [x] centerCaption `numberOfLines={1}` — `+165만/월` 같은 슬래시 줄바꿈 방지 (design §3)
- [ ] orange variant decorative circle (120×120, white opacity 0.08, 우상단 absolute) — 화면 phase 진입 시 구현 (defer)
- [x] 가운데 컬럼 `shrink-0` — design §3 의 squeeze 방지. 좌우 flex-1 grow 압력에도 mult/caption 폭 보존
- [x] center mult `numberOfLines={1}` — 좌우 value 와 일관 (squeeze 방지)
- [x] snapshot — orange / navy variant 각 1 (TESTING.md §6.1 복잡 컴포넌트 요건)
- [x] ❓ info 아이콘 — `showInfoIcon=true (default)` + onInfoPress 있음 → 렌더 + 탭 콜백
- [x] ❓ 미표시 (`showInfoIcon=false` 또는 onInfoPress 미제공) → 렌더 안 함 (silent no-op 회피)
- [x] info 버튼 a11y — role=button + label "가정값 자세히 보기"
- [x] testID 미제공 → info / bar testID 분기 false branch 정상 동작

**스트레스:**

- [x] 긴 값 ("9,999만/월" / "99,999만/월") → numberOfLines={1} squeeze 방지
- [ ] caption 슬래시 줄바꿈 방지 (`+165만/월`) — 현재 numberOfLines={1} 만 적용. RN 의 `adjustsFontSizeToFit` 은 화면 phase 진입 시 실기기 검증 후 결정 (defer).
- [ ] 이모지 포함 라벨 — RN Text 기본 이모지 렌더 라이브러리 책임 (검증 불요)

### 9.15 `src/components/MenuRow.tsx` (components phase step 3)

설정 화면 메뉴 행. 3 variant (default / hot / dim) + isLast border 제어 +
disabled + showChevron + rightText. design/README §5 (Settings).

- [x] default variant — bg-light icon box + navy label + chevron
- [x] hot variant — orange-soft icon bg + label navy 유지 (icon 만 강조)
- [x] dim variant — label gray-2
- [x] rightText 있을 때 → 우측 Tiny 렌더
- [x] rightText 없을 때 → 미렌더
- [x] rightText 긴 경우 → numberOfLines={1}
- [x] isLast=true → bottom border 미적용
- [x] isLast 미지정 (default false) → border-b border-line 적용
- [x] disabled=true → opacity-50 + accessibilityState.disabled + onPress 미호출. Pressable `disabled` prop 도 전달 (Android ripple / iOS pressed opacity 차단 — RN 내부 처리라 RNTL host node 로 surface 안 됨, 사용자 관점 동작으로만 검증)
- [x] disabled=false → onPress 호출
- [x] showChevron=true (default) → chev-right 렌더 (testID `${testID}-chevron`)
- [x] showChevron=false → chevron 미렌더 (dim 류)
- [x] a11y — accessibilityRole='button' + accessibilityLabel = label prop

### 9.16 `src/components/RegionPill.tsx` (components phase step 3)

홈 권역 필터 chip. design/README §3.

- [x] active=true → bg-navy + white label + accessibilityState.selected=true
- [x] active=false → bg-white + border-line + navy label + selected=false
- [x] count 있을 때 → `"북미 (8)"` 형식
- [x] count 없을 때 → 라벨만
- [x] count=0 → 명시적으로 `"(0)"` 표기 (정보 보존)
- [x] 긴 region 이름 → numberOfLines={1}
- [x] 탭 → onSelect 호출
- [x] hit slop 44×44 — `{ top: 8, bottom: 8, left: 8, right: 8 }` (padding + slop ≥ 44)
- [x] a11y — accessibilityRole='button' + accessibilityLabel = displayLabel (count 포함)
- [x] snapshot — active / inactive 각 1 케이스 (TESTING.md §6.1 — 단순 시각 컴포넌트)

### 9.17 `src/components/ComparePair.tsx`

**Hot 규칙 (경계값 정확) — 표시값 (rounded) 기반:**

- [x] mult=1.94 → not hot (반올림 1.9, icon navy / mult navy)
- [x] mult=1.95 → **hot** (반올림 2.0, formatMultiplier 와 일관 — PR #16 review 이슈 1)
- [x] mult=1.99 → **hot** (반올림 2.0)
- [x] mult=2.0 → **hot** (icon orange-soft + orange, mult orange)
- [x] mult=2.01 → hot
- [x] mult=10.0 → hot
- [x] mult=0.5 → not hot (cool, gray-2)

**Hot prop override:**

- [x] hot=true 강제 (mult=1.5 라도) → orange
- [x] hot=false 강제 (mult=3.0 라도) → navy
- [x] hot 미지정 → 자동 판정 (`isHot(mult)`)

**신규:**

- [x] mult='신규' → "신규" 표기, navy 색
- [x] 신규 시 막대: not hot (bg-light)

**막대 폭:**

- [x] sw=0.4, cw=1.0 → SEO 40%, CITY 100%
- [x] sw=0.0, cw=1.0 → SEO 0% (미표시)
- [x] sw=1.0, cw=0.5 → 정상
- [x] sw + cw 범위 벗어남 → clamp + warn

**Icon 매핑:**

- [x] category=rent → house icon
- [x] category=food → fork icon
- [x] category=transport → bus icon
- [x] category=tuition → graduation icon
- [x] category=tax → briefcase icon
- [x] category=visa → passport icon

**기타:**

- [x] 라벨 / 값 렌더링
- [x] mult 포매팅 (↑/↓ 화살표)
- [x] 탭 → onPress
- [x] testID 전파
- [x] onPress 정의 시 `accessibilityLabel = "${label} 비교 카드"` (PR #16 review 이슈 2)

### 9.18 `src/components/FavCard.tsx`

**accent variant:**

- [x] accent=true: bg-navy (첫 카드)
- [x] accent=false: bg-white + border-line (기본)
- [x] accent 미지정 → false

**Hot 규칙 (경계값) — 표시값 (rounded) 기반:**

- [x] mult=1.94 → not hot (반올림 1.9, navy mult)
- [x] mult=1.99 → hot (반올림 2.0, orange — PR #16 review 이슈 1)
- [x] mult=2.0 → hot (orange mult)
- [x] mult=2.3 → hot
- [x] mult=0.8 → cool (↓0.8×)
- [x] mult=1.0 → 동일 (1.0×, gray-2)

**accent + hot 조합:**

- [x] accent=true + hot=true → mult orange
- [x] accent=true + not hot → mult white

**텍스트:**

- [x] 도시명 / 영문명 / 국가코드 표시
- [x] 영문명 sub opacity `FAV_CARD_SUB_OPACITY` (0.7) — tokens 참조 (PR #16 review 이슈 2)
- [x] 국가코드 박스 렌더
- [x] star 아이콘 렌더

**인터랙션:**

- [x] onPress 정의 → cityId 전달
- [x] onPress 미정의 → 비-탭
- [x] onPress 정의 시 `accessibilityLabel = "${cityName} 즐겨찾기 카드"` (PR #16 review 이슈 4)

**기타:**

- [x] testID 전파 (미지정 시 속성 없음)

### 9.19 `src/components/RecentRow.tsx`

**Hot 규칙 (경계값) — 표시값 (rounded) 기반:**

- [x] mult=1.94 → not hot (반올림 1.9, navy)
- [x] mult=1.99 → hot (반올림 2.0, orange — PR #16 review 이슈 1)
- [x] mult=2.0 → hot (orange)
- [x] mult=2.3 → hot
- [x] mult=0.8 → cool (↓0.8×, gray-2)
- [x] mult=1.0 → 동일 (1.0×, gray-2)
- [x] mult=0.5 → cool

**isLast border:**

- [x] isLast=false → border-b 표시
- [x] isLast=true → border-b 없음
- [x] isLast 미지정 → false

**텍스트:**

- [x] 도시명 / 영문명 / 국가코드 표시
- [x] 국가코드 박스 36×36 렌더
- [x] mult 포매팅 (↑/↓ 화살표)

**chevron 색상 (PR #16 review 이슈 5):**

- [x] hot 시 chevron `colors.orange`
- [x] not hot 시 chevron `colors.gray2`

**인터랙션:**

- [x] onPress 정의 → cityId 전달
- [x] onPress 미정의 → 비-탭
- [x] onPress 정의 시 `accessibilityLabel = "${cityName} 최근 본 도시"` (PR #16 review 이슈 4)

**기타:**

- [x] testID 전파 (미지정 시 속성 없음)

### 9.20 `src/components/GroceryRow.tsx`

**Hot 규칙 (경계값) — 표시값 기반:**

- [x] mult=1.94 → not hot (반올림 1.9, bg-light)
- [x] mult=1.95 → hot (반올림 2.0, bg-orange-soft)
- [x] mult=1.99 → hot (반올림 2.0)
- [x] mult=2.0 → hot (bg-orange-soft)
- [x] mult=2.5 → hot
- [x] mult=0.5 → not hot (cool)
- [x] mult=1.0 → not hot

**색상 정책 — design/README.md §4 의도적 차이 (PR #16 review 이슈 3):**

- [x] hot=false 시 `multColor='gray'` (`#BFC8CC`, ComparePair/FavCard/RecentRow 의 `'gray-2'` 와 다름 — 디자인 spec 명시)
- [x] hot=true 시 `multColor='orange'`

**Hot prop override:**

- [x] hot=true 강제 (mult=1.5) → orange-soft
- [x] hot=false 강제 (mult=3.0) → bg-light
- [x] hot 미지정 → 자동 판정

**isLast border:**

- [x] isLast=false → border-b 표시
- [x] isLast=true → border-b 없음
- [x] isLast 미지정 → false

**텍스트:**

- [x] 품목명 표시
- [x] 이모지 표시
- [x] 가격 범위: "서울 → 도시" 형식
- [x] 다양한 이모지 렌더 (🥚 등)

**mult 포매팅:**

- [x] mult=1.8 → ↑1.8×
- [x] mult=0.7 → ↓0.7×
- [x] mult=1.0 → 1.0×

**이모지 박스:**

- [x] 36×36 (w-9 h-9) 크기
- [x] rounded-[10px] 라운드

**기타:**

- [x] testID 전파 (미지정 시 속성 없음)

### 9.20.1 `src/components/ErrorView.tsx` (app-shell phase step 3)

UI_GUIDE §빈/에러/로딩 상태 의 에러 표시. 3 variant — fatal (전체 화면) /
inline (한 줄 배지) / screen (화면 단위). 색상 + ⚠ prefix + 텍스트 3중
인코딩 (CLAUDE.md). detail 은 `__DEV__` 한정 노출.

- [x] fatal — message + ⚠ prefix + 기본 retryLabel "다시 시작"
- [x] fatal — onRetry 미제공 시 CTA 미렌더
- [x] fatal — onRetry 콜백 발화
- [x] fatal — DEV 빌드에서 detail 표시
- [x] inline — 한 줄 배지 + 기본 retryLabel "다시 시도"
- [x] inline — onRetry 미제공 시 CTA 미렌더
- [x] inline — detail 무시 (한 줄 배지에 추가 정보 X)
- [x] screen — 비-fatal 레이아웃 + 기본 retryLabel "다시 시도"
- [x] retryLabel 명시 → default 무시
- [x] onRetry / detail 모두 미제공 → 메시지만 렌더

### 9.20.2 `src/components/ErrorBoundary.tsx` (app-shell phase step 3)

ARCHITECTURE.md §에러 핸들링 §3계층 의 app 계층. RootLayout 의 자식 트리
throw → `<ErrorView fatal />` + "다시 시작" CTA. AppError vs 외부 Error
메시지 분기. component-level reset (native restart 미지원).

- [x] 자식 throw 없음 → children 렌더
- [x] 자식 throw → ErrorView fatal 표시 + 기본 메시지
- [x] AppError throw → "앱에서 오류" 분기 + DEV detail 에 code 표시
- [x] reset → 자식 다시 mount (에러 멎으면 정상 렌더)
- [x] onError 콜백 — error + componentStack 정보 전달

### 9.20.3 `src/store/lastSyncBridge.ts` (app-shell phase step 4)

`meta:lastSync` (data layer) → `useSettingsStore.lastSync` 단방향 동기화.
data layer 가 source of truth (DATA.md §269). 부트로더가 hydration 완료
후 1회 호출. 비차단 best-effort — bridge 실패는 부팅 흐름 차단 안 함.

- [x] meta = ISO string, store = null → store 갱신
- [x] meta = null, store = ISO string → store null 로 갱신 (data 가 source)
- [x] meta === store → no-op (불필요한 setState 방지)
- [x] meta != store → store 가 새 값으로 갱신

### 9.21 `app/_layout.tsx` (루트 레이아웃)

- [x] 폰트 로딩 + 모든 스토어 hydration 완료 전: SplashScreen 유지 (app-shell step 0)
- [x] 모두 완료 후: `SplashScreen.hideAsync()` 호출 1회 (app-shell step 0)
- [x] persona.onboarded=false → `/onboarding` redirect (app-shell step 2)
- [x] persona.onboarded=true + 초기 onboarding segment → `/(tabs)` redirect (app-shell step 2)
- [x] 무한 redirect 방지: 이미 대상 segment 면 no-op (app-shell step 2)
- [x] bootReady=false 동안 router.replace 호출 0회 (app-shell step 2)
- [x] timeout fallback (INITIAL onboarded=false) → /onboarding 자연 redirect (app-shell step 2)
- [x] 에러 boundary: 자식 트리 throw → ErrorView (fatal) (app-shell step 3)
- [ ] 백그라운드 → 포그라운드 복귀: stale 데이터 갱신 트리거
- [x] hydration race: 4개 store 모두 완료 보장 후 렌더 (app-shell step 0 — `waitForAllStoresHydrated` 합성)
- [x] 폰트 로드 실패: graceful fallback (시스템 폰트) (app-shell step 0)
- [x] hydration timeout (5s) → INITIAL_STATE fallback + warn (app-shell step 1, ADR-052)
- [x] unmount race: cancelled 플래그로 setState after unmount 방지 (app-shell step 0)
- [x] meta:lastSync → useSettingsStore.lastSync 단방향 sync (app-shell step 4)
- [x] bridge 실패 → 부팅 흐름 차단 안 함 + dev 콘솔 로그 (app-shell step 4)

### 9.22 `app/onboarding.tsx` — placeholder spec (deprecated)

screens phase step 4 에서 본 화면이 실제 구현됐고 테스트 인벤토리도 **§9.30** 으로 이전됐다.
본 절의 placeholder 항목은 §9.30 으로 흡수 (back 버튼·SplashScreen 은 `app/_layout.tsx` 측 책임으로 §9.21 / app-shell phase 에서 다룸).

→ **§9.30 참조.**

### 9.23 `app/(tabs)/index.tsx` (홈)

**상태별:**

- [ ] 빈 상태 (즐겨찾기 0): empty CTA + 권역 그리드만
- [ ] 즐겨찾기 있음: 가로 스크롤 카드 + 권역 그리드
- [ ] 첫 카드 accent (navy)
- [ ] 최근 본 도시 0개: 섹션 자체 미표시
- [ ] 최근 본 도시 5개: 모두 표시
- [ ] 페르소나 표시 영역

**검색:**

- [ ] 검색 `"vancouver"` (영문 lowercase) → vancouver 매칭
- [ ] 검색 `"Vancouver"` → 동일 매칭 (case-insensitive)
- [ ] 검색 `"밴쿠버"` (한글) → vancouver 매칭
- [ ] 검색 `"v"` (prefix): vancouver 등 매칭
- [ ] 검색 `"xyz"` (no match): "검색 결과 없음" 안내
- [ ] 검색 입력 debounce (300ms)
- [ ] 검색 클리어: 전체 도시 목록 복귀

**권역 필터:**

- [ ] 권역 칩 탭: 해당 권역 도시만 표시
- [ ] 권역 + 검색 동시 적용
- [ ] 권역 해제 (탭 다시): 전체

**인터랙션:**

- [ ] 즐겨찾기 카드 탭: `/compare/<id>` 이동
- [ ] 최근 행 탭: `/compare/<id>` 이동
- [ ] 권역 그리드 도시 탭: `/compare/<id>` 이동
- [ ] 즐겨찾기 ⭐ 탭 (홈 카드 위): 토글
- [ ] 사용자 아바타 탭 → 설정 (디자인 의도)

### 9.24 `app/compare/[cityId].tsx` (비교 — 메인 화면)

**라우팅:**

- [x] 정상 cityId: 데이터 로드 + 표시 (screens step 0)
- [x] 잘못된 cityId: ErrorView + 돌아가기 CTA (screens step 0)
- [x] 서울 데이터 없음: ErrorView (screens step 0)
- [ ] cityId 가 'seoul': 자기 비교 차단 (안내)

**데이터 로드:**

- [x] loadAllCities reject: ErrorView (screens step 0)
- [ ] 캐시 hit: 즉시 표시
- [ ] 캐시 miss: skeleton → fetch → 표시
- [ ] fetch 실패: 시드 fallback + inline 배지

**환율 표시:**

- [ ] `"1 CAD = 980원 · 04-27"` 헤더 표시
- [ ] FX stale (>24h): 경고 배지 추가
- [ ] FX 결측: "?" 표기

**총비용 hero:**

- [x] HeroCard orange mount 검증 (screens step 0)
- [x] 서울값 / 도시값 / 배수 표시 (screens step 0)
- [ ] persona=student: 학비 별도 라인 (참고)
- [ ] persona=worker: 학비 라인 미표시
- [ ] ❓ 탭: 가정값 시트 열림

**카드 (페르소나별):**

- [x] persona=student: 5 카드 정확한 순서 (rent/food/transport/tuition/visa) (screens step 0)
- [x] persona=worker: 5 카드 (rent/food/transport/tax/visa) (screens step 0)
- [x] persona=unknown: 6 카드 (학비 + 세금 합집합) (screens step 0)
- [ ] 페르소나 mid-session 변경: 카드 즉시 갱신 (스토어 reactive)

**Hot 카드:**

- [ ] mult ≥ 2.0× 카드: orange tint 적용 (특정 카드 검증)

**Visa 카드:**

- [ ] mult='신규' 표기
- [ ] 막대: 서울 0%, 도시 적정 폭
- [ ] VISA_CONFIG fee 페르소나 분기 — 현재 `studentApplicationFee ?? workApplicationFee` fallback 으로 학생 페르소나가 워크 비자 수수료를 보거나 그 반대 케이스 가능 (v1.x 페르소나 분기 후속 PR 에서 정밀화). PR #17 review round 3 이슈 4.

**즐겨찾기:**

- [x] ⭐ 탭: store add/remove + 시각 토글 (screens step 0)
- [ ] 즐겨찾기 후 뒤로 → 홈: 카드 표시 반영

**TopBar:**

- [x] back 버튼 클릭 시 router.back() 호출 (screens step 0)

**최근 본 도시:**

- [x] 마운트 + 데이터 로드 완료 시 recent.push(cityId) 호출 (screens step 0)

**카드 탭 → 상세:**

- [ ] food 카드 탭: `/detail/<cityId>/food` 이동
- [ ] rent 카드 탭: `/detail/<cityId>/rent` (Phase 7 이후)
- [ ] visa 카드 탭: 상세 또는 정보 표시

**푸터:**

- [x] 출처 N개 표시
- [x] 갱신일 표시 (`formatShortDate`)
- [ ] "출처 보기" 탭 동작 — v1.0 미구현 (Pressable disabled + label "출처 보기 (준비 중)"). v1.x 외부 링크 / 모달 결정 후 구현 (PR #17 review 이슈 3).

**스트레스:**

- [ ] 카드 빠른 연타: 첫 탭만 navigation
- [ ] 카드 width 일관

**스냅샷 / 시각 회귀:**

- [x] 핵심 contract (hero + 5 카드 mount + 도시명 노출) — worker 페르소나 1 케이스. 전체 트리 snapshot 은 §6.3·§6.4 위반 + ReactTestInstance fiber cyclic 직렬화 RangeError 발생 (PR #17 review 이슈 2) — 정밀 시각 회귀는 v2 스크린샷 도구 (ADR-035).

**에러 분기 (Promise.all 모두 catch):**

- [x] loadAllCities reject → ErrorView (screens step 0)
- [x] fetchExchangeRates reject → ErrorView (PR #17 review 이슈 3)
- [x] getLastSync reject → ErrorView (PR #17 review 이슈 3)

### 9.24.1 `src/lib/search.ts` (홈 검색)

ARCHITECTURE.md §검색 알고리즘 정확 검증.

#### 입력 정규화

- [ ] `'  vancouver  '` → `'vancouver'` (trim)
- [ ] `'Vancouver'` → `'vancouver'` (lowercase 영문)
- [ ] `'밴쿠버'` (NFC) → `'밴쿠버'` (NFC 그대로)
- [ ] `'밴쿠버'` (NFD) → `'밴쿠버'` (NFC 정규화)
- [ ] `''` → 빈 문자열 (전체 표시 신호)

#### 매칭 단계

- [ ] `'vancouver'` 정확 일치 → score 100
- [ ] `'Vancouver'` (case insensitive) → score 100
- [ ] `'밴쿠버'` 정확 → score 100
- [ ] `'van'` prefix → vancouver score 80
- [ ] `'밴'` prefix → vancouver score 80
- [ ] `'sf'` 별칭 → san-francisco-bay score 60
- [ ] `'베이'` 별칭 → san-francisco-bay
- [ ] `'cou'` substring → vancouver score 40
- [ ] `'쿠버'` substring → 밴쿠버
- [ ] `'xyz'` 매칭 0건 → 빈 배열

#### 정렬

- [ ] 정확 일치 + prefix + substring 동시: 정확 → prefix → substring 순
- [ ] 동점일 때 region 순 (na > eu > oceania > asia > me)
- [ ] 동점 + 같은 region: 한글 가나다순

#### 한글 자모 처리

- [ ] `'ㅂ'` (자음) → 매칭 안 함 (빈 결과)
- [ ] `'ㅂㅏ'` (자음+모음) → 매칭 안 함
- [ ] `'밴'` 완성형 → 매칭

#### 별칭 사전

- [ ] `'sf'` → san-francisco-bay
- [ ] `'la'` → los-angeles
- [ ] `'nyc'` → new-york
- [ ] `'도꾜'` (오타) → tokyo
- [ ] 정의되지 않은 별칭: alias 매칭 skip, 일반 매칭

#### Debounce·UI 통합 (§9.23 와 연계)

- [ ] 입력 후 300ms 안에 추가 입력: 매칭 1회만 실행
- [ ] 입력 0자: 전체 도시 반환
- [ ] 입력 1자 (영문): prefix 만
- [ ] 입력 2자+: prefix → substring

### 9.24.2 페르소나 변경 영향 (state effects)

ARCHITECTURE.md §페르소나 변경 시 영향 정책 검증.

- [ ] persona=student → worker 변경: 즐겨찾기 유지 (length·내용 동일)
- [ ] 동일 변경: 최근 본 도시 유지
- [ ] 동일 변경: Compare 화면 카드 즉시 갱신 (학비 → 세금)
- [ ] 동일 변경: 총비용 hero 가정 갱신 (셰어 → 1인 원룸)
- [ ] worker → unknown 변경: 학비 + 세금 모두 표시 (합집합)
- [ ] onboarded 플래그: 항상 true 유지 (변경 X)
- [ ] 변경 후 토스트: "페르소나가 (취업자)로 변경되었어요"

### 9.25 `app/detail/[cityId]/[category].tsx` (상세)

screens phase step 1 구현 — v1.0 1차 타겟 food + 다른 카테고리는 동일 골격 + 데이터 있는 항목만 렌더. 페르소나 분기는 v1.x 미루고 raw 카테고리 데이터를 균등 노출.

**food 카테고리 (v1.0 우선):**

- [x] 네이비 hero: 카테고리 합계 + 푸터 (`항목 단가 합` — Compare 의 `평균 가정 기준` 과 의도 차이 명시, PR #17 review round 3 이슈 2)
- [x] 외식 섹션: 식당, 카페 (2 항목 표시)
- [x] 식재료 섹션: 공통 8개 항목 (milk1L/eggs12/rice1kg/chicken1kg/bread/onion1kg/apple1kg/ramen)
- [ ] 신라면 hot (2.5×) 검증 (v1.x — 데이터 fixture 의존)
- [x] 외식 → 식재료 순서
- [x] 항목 수 표시 ("2 항목" / "N 항목")
- [x] 출처 표시 (primarySource.name)
- [ ] "출처 보기" 링크: 외부 브라우저 열림 (v1.x)

**rent 카테고리:**

- [x] navy hero: 합계 + 카테고리 라벨
- [ ] 페르소나=student 시 좌·우값 share 기준 (v1.x — 페르소나 분기 후속 PR)
- [ ] 페르소나=worker 시 좌·우값 oneBed 기준 (v1.x)
- [x] 섹션 "주거 형태" — 데이터 있는 행 (share/studio/oneBed/twoBed 순)
- [x] 각 행 hot 규칙 정확 (`isHot(mult)` 단일 함수)
- [ ] 섹션 2 "정착 비용" 보증금 행 (v1.x)
- [x] 보증금 데이터 부재 시 섹션 미표시

**transport 카테고리:**

- [x] navy hero: 합계 + 카테고리 라벨
- [x] "교통 수단" 섹션 — 3 행 (monthlyPass/singleRide/taxiBase)
- [ ] 페르소나=worker 시 섹션 3 "차량 운영" (v1.x)

**tuition 카테고리:**

- [x] navy hero: 합계
- [x] "학교 (월 환산)" 섹션 — cityEntries 배열 행
- [x] 학교명 + 월 환산 학비 표시
- [ ] 페르소나=worker 시 안내 또는 대체 (v1.x)
- [x] tuition 빈 배열 도시: "데이터 준비 중"

**tax 카테고리:**

- [x] navy hero: 합계
- [x] "월 세금 (대략)" 섹션 — 연봉별 행
- [x] 각 행: 연봉 + 월 세금 표시
- [ ] 페르소나=student 시 진입 차단 (v1.x)

**visa 카테고리:**

- [x] navy hero: 합계
- [x] "비자/정착" 섹션 — fee + settlementApprox (있는 것만)
- [x] 데이터 부재 도시: "데이터 준비 중"
- [ ] visa row 의 mult `'신규'` 시각 표시 — v1.x (현재 GroceryRow `mult: number` 라 1 로 fallback → "1.0×" 표기. 시각 회귀 발생 — Compare 카드는 "신규" 배지로 정확 표기. 통일하려면 GroceryRow 타입 확장 필요, components phase 산출물 변경 부담으로 후속). PR #17 review round 3 이슈 3.
- [ ] 정부 페이지 링크 (v1.x)

**잘못된 입력:**

- [x] 알 수 없는 category → ErrorView + [돌아가기]
- [x] cityId 누락 → ErrorView
- [x] 도시 데이터 없음 → ErrorView
- [ ] 페르소나 mismatch 안내 (v1.x)

**기타:**

- [x] navy HeroCard mount
- [x] TopBar mount + 카테고리 라벨 포함 (`{category} · {city.ko}`)
- [x] back 버튼 → router.back / replace('/')
- [x] 핵심 contract (hero + 섹션 mount) — food / visa 2 케이스. 전체 트리 snapshot 은 §6.3·§6.4 위반 + ReactTestInstance fiber cyclic 직렬화 RangeError 발생 (PR #17 review 이슈 2) — 정밀 시각 회귀는 v2 스크린샷 도구 (ADR-035).
- [ ] iOS swipe-back, Compare 스크롤 위치 보존 (수동 e2e — Phase 7)

### 9.26 `app/(tabs)/index.tsx` (홈)

screens phase step 2 구현 — 재방문 사용자가 빠르게 즐겨찾기 도시로 진입하거나 새 도시를 검색.

**로딩:**

- [x] 로딩 중 스피너 표시 (screens step 2)

**기본 UI:**

- [x] 인사 "안녕하세요 👋" + "어디 가시나요?" 표시 (screens step 2)
- [x] 검색바 stub 표시 (v1.0 시각만) (screens step 2)
- [x] 아바타 버튼 표시 (screens step 2)

**즐겨찾기 섹션:**

- [x] 즐겨찾기 0건: 빈 상태 메시지 표시 (screens step 2)
- [x] 즐겨찾기 N건: FavCard 가로 스크롤 (screens step 2)
- [x] 첫 FavCard accent=true (navy bg) (screens step 2)
- [x] FavCard 탭 → `/compare/{cityId}` push (screens step 2)
- [ ] 즐겨찾기 변경 시 실시간 갱신 (스토어 reactive)

**최근 본 도시 섹션:**

- [x] 최근 0건: 빈 상태 메시지 표시 (screens step 2)
- [x] 최근 N건: RecentRow 세로 리스트 (screens step 2)
- [x] 마지막 RecentRow isLast=true (border 없음) — Home integration (PR #18 review round 3)
- [x] RecentRow 탭 → `/compare/{cityId}` push (screens step 2)

**권역 필터:**

- [x] RegionPill 5개 렌더링 (전체/북미/유럽/아시아/오세아니아) (screens step 2)
- [x] 기본 active = 전체 (screens step 2)
- [x] 권역 탭 시 active 토글 (screens step 2)
- [ ] 필터링 로직 (v1.x — 검색 화면 구현 후)

**설정 진입:**

- [x] 아바타 탭 → `/settings` push (screens step 2)

**에러 상태:**

- [x] 서울 데이터 없음: 에러 메시지 표시 (screens step 2)
- [ ] 네트워크 오류: ErrorView + 재시도

**스냅샷:**

- [x] 즐겨찾기 3건 + 최근 4건 핵심 contract (screens step 2)

### 9.26b `src/lib/errors.ts` — 에러 클래스 카탈로그

ARCHITECTURE.md §에러 타입 카탈로그의 15개 클래스 각각:

- [ ] `instanceof AppError === true`
- [ ] `instanceof Error === true`
- [ ] `code` 필드가 정확한 문자열
- [ ] `message` 가 인자로 전달한 값
- [ ] `cause` 가 옵션으로 전달되며 보존
- [ ] `name` 이 클래스 이름과 일치 (예: `'UnknownCurrencyError'`)
- [ ] toString 또는 stack 에 `code` 포함 (디버깅성)
- [ ] JSON 직렬화 시 `code` + `message` 포함 (로깅 시 정보 손실 X)

테스트 매트릭스 (15개 × 위 8개 = 120 케이스 — 헬퍼 함수로 표현):

```ts
const errorCases: Array<[new (msg: string) => AppError, string]> = [
  [InvalidNumberError, 'INVALID_NUMBER'],
  [UnknownCurrencyError, 'UNKNOWN_CURRENCY'],
  [FxFetchError, 'FX_FETCH_FAILED'],
  // ... 15개
];

describe.each(errorCases)('%s', (Ctor, expectedCode) => {
  it('code 가 일치', () => {
    expect(new Ctor('test').code).toBe(expectedCode);
  });
  it('AppError 상속', () => {
    expect(new Ctor('test')).toBeInstanceOf(AppError);
  });
  it('cause 보존', () => {
    const cause = new Error('underlying');
    expect(new Ctor('test', cause).cause).toBe(cause);
  });
});
```

### 9.27 `src/theme/tokens.ts` — 디자인 토큰

- [ ] 모든 색 토큰 export 존재 (orange, navy, gray, light, line 등)
- [ ] 색 hex 형식 정확 (`#FC6011` 6자리)
- [ ] 모든 shadow 토큰 존재 (5개)
- [ ] gradient 토큰 (settings persona card)
- [ ] type scale 존재 (display, h1, h2, h3, body, small, tiny, mono-label)
- [ ] tailwind.config.js 의 colors 와 1:1 일치 (자동 검증 — `expect(tokens.orange).toBe(tailwindConfig.theme.colors.orange.DEFAULT)`)

#### WCAG AA 대비 검증

```ts
import { getContrastRatio } from '__test-utils__/wcag';

it('navy on white 대비 ≥ 4.5 (본문)', () => {
  expect(getContrastRatio(tokens.navy, tokens.white)).toBeGreaterThanOrEqual(4.5);
});
it('white on orange 대비 ≥ 4.5 (orange hero)', () => {
  expect(getContrastRatio(tokens.white, tokens.orange)).toBeGreaterThanOrEqual(4.5);
});
it('gray-2 on white 대비 ≥ 3.0 (큰 텍스트만 허용)', () => {
  expect(getContrastRatio(tokens['gray-2'], tokens.white)).toBeGreaterThanOrEqual(3.0);
});
```

대비 표 (색·배경 조합 — 모두 검증):

| 텍스트 | 배경        | 최소 대비        | 용도                       |
| ------ | ----------- | ---------------- | -------------------------- |
| navy   | white       | 4.5              | 본문                       |
| navy   | light       | 4.5              | 검색바 텍스트              |
| navy   | orange-tint | 4.5              | 페르소나 카드              |
| white  | orange      | 4.5              | hero CTA, 활성 칩          |
| white  | navy        | 4.5              | hero detail, 페르소나 카드 |
| gray   | white       | 4.5              | 보조 텍스트                |
| gray-2 | white       | 3.0 (large only) | 캡션 — 큰 글씨에만         |
| orange | white       | 3.0 (large)      | 강조 숫자 — 18px+ 만       |

### 9.27.1 `src/i18n/errors.ko.ts` — 에러 메시지 한국어 표준

UI_GUIDE.md §에러 메시지 한국어 표준 카탈로그 검증.

- [ ] 15개 에러 코드 모두 매핑 존재
- [ ] 모든 메시지 60자 이내
- [ ] 모든 메시지 존댓말 (`해요·세요`)
- [ ] 기술 용어 검출 (HTTP·JSON·timeout 같은 단어): 검출 시 fail
- [ ] 사용자가 다음 액션 명시 (`다시 시도해 주세요` 같은 패턴)
- [ ] (사용자 노출 안 함) 코드는 빈 문자열 또는 표기

### 9.27.1b Cross-cutting 컴포넌트

#### `src/components/PersonaTag.tsx`

- [ ] persona='student' → "🎓 유학생" 표시
- [ ] persona='worker' → "💼 취업자" 표시
- [ ] persona='unknown' → "🤔 모름" 표시
- [ ] 탭 → 페르소나 변경 시트 열림 (Sheet B)
- [ ] 11px tiny gray-2 스타일
- [ ] TopBar subtitle 위치

#### `src/components/OfflineBadge.tsx`

- [ ] online: 미표시
- [ ] offline: "🟡 오프라인 모드 · 시드 데이터 사용"
- [ ] 데이터 갱신 실패 (network OK 인데 fetch 실패): orange-tint + "데이터 갱신 실패 · 다시 시도"
- [ ] 환율 stale (>24h): light bg + "환율 데이터 오래됨 · 마지막 갱신 MM-DD"
- [ ] [재시도 →] 탭 → refreshCache() 호출
- [ ] safe area 바로 아래 위치 (모든 화면 공통)

#### `src/components/FreshnessBadge.tsx`

- [ ] 분기 표기: lastUpdated="2026-04-01" → "Q2 2026 데이터"
- [ ] 1주 이내: gray
- [ ] 1~4주 이내: gray-2
- [ ] 4주+: orange (갱신 권유 신호)
- [ ] 출처 카운트 동시 표시 ("출처 12개")
- [ ] "출처 보기 →" 탭 → Sheet C 열림

#### `src/lib/network.ts` (`useNetworkStatus`)

- [ ] NetInfo mocked: isConnected=true → isOnline=true
- [ ] isConnected=false → isOnline=false
- [ ] isInternetReachable=false 인데 isConnected=true → isOnline=false (둘 다 true 일 때만 online)
- [ ] subscriber 등록 후 cleanup
- [ ] 여러 컴포넌트가 동일 훅 사용: 1회 구독 (메모이제이션)

### 9.27.2 `src/i18n/strings.ko.ts` — UI 텍스트 한국어

빈 상태 CTA·시트 본문·토스트 텍스트 등 사용자 노출 한국어가 한 파일에 모임 (i18n prep, ADR-034).

- [ ] 모든 export 가 const 문자열 또는 함수
- [ ] 컴포넌트가 인라인 한국어 대신 strings.ko 의 식별자 사용 (검증: 컴포넌트 코드 grep)
- [ ] 모든 식별자 한국어 일관 (존댓말)

#### 디자인 mock vs strings.ko 자동 검증

- [ ] `docs/design/hifi/onboarding.jsx` 의 한국어 텍스트가 strings.ko 에 존재
- [ ] `home.jsx` "안녕하세요 👋", "어디 가시나요?", "도시 검색 · 한글/영어" 등 매핑
- [ ] `compare.jsx` "한 달 예상 총비용", "평균 가정 기준 · ❓ 자세히" 매핑
- [ ] `detail.jsx` "월 예상 식비 (혼합)", "자취 70% + 외식 30% 가정", 섹션 라벨 매핑
- [ ] `settings.jsx` 메뉴 5개 라벨 + "Made with ♥ in Seoul · 2026" 매핑
- [ ] 자동 검증 스크립트: `scripts/validate_strings.mjs` — 디자인 JSX 에서 한국어 추출 + strings.ko 의 값과 비교

### 9.27.3 하단 탭 동작 정책 (ARCHITECTURE.md §하단 탭)

- [ ] 홈 탭 → `/(tabs)/index`
- [ ] 비교 탭 + 최근 본 ≥1 → `/compare/<recent[0]>`
- [ ] 비교 탭 + 최근 본 0개 → 홈 + "먼저 도시를 선택해 주세요" 토스트
- [ ] 즐겨찾기 탭 + 즐겨찾기 ≥1 → `/compare/<favorites[0]>`
- [ ] 즐겨찾기 탭 + 즐겨찾기 0개 → 홈 + "즐겨찾기를 먼저 추가해 주세요" 토스트
- [ ] 설정 탭 → `/(tabs)/settings`

### 9.28 환경변수 / 설정

- [ ] `EXPO_PUBLIC_DATA_BASE_URL` 미정의 → 기본값 사용 (production GitHub raw URL)
- [ ] `EXPO_PUBLIC_DATA_BASE_URL` 정의 → 우선 사용
- [ ] 잘못된 URL → fetch 시 에러 → 시드 fallback
- [ ] app.json 의 `version` 필드 → settings 화면 "앱 정보" 에 표시
- [ ] app.json 의 `runtimeVersion` 일치 검증 (EAS Update 호환)

### 9.29 `app/(tabs)/settings.tsx` (설정 — 화면)

screens phase step 3 구현 — 페르소나 표시 + 사용 통계 + 메뉴.

**페르소나 표시:**

- [x] student: "유학생 모드" + "서울에서 출발 · 학비 중심" 라벨 (screens step 3)
- [x] worker: "취업자 모드" + "서울에서 출발 · 실수령 중심" 라벨 (screens step 3)
- [x] unknown: "미선택 모드" + "둘 다 보여드려요" 라벨 (screens step 3)

**변경 버튼:**

- [x] 탭 → setOnboarded(false) + router.replace('/onboarding') (screens step 3)

**통계 카드:**

- [x] 0건: 즐겨찾기/최근 본/도시 DB 모두 0 표시 (screens step 3)
- [x] N건: 정확한 카운트 표시 (screens step 3)

**메뉴 리스트:**

- [x] 5개 메뉴 모두 렌더링 (데이터 새로고침/출처/피드백/개인정보/앱 정보) (screens step 3)
- [x] 앱 정보 rightText = v1.0.0 (expo-constants expoConfig.version) (screens step 3)
- [x] 출처 rightText = 12개 (screens step 3)

**데이터 새로고침:**

- [x] 탭 → refreshCache 호출 (screens step 3)
- [x] 성공 → lastSync 갱신 (screens step 3)
- [x] 실패 → "갱신 실패" 텍스트 표시 (screens step 3)
- [x] 로딩 상태 — "갱신 중..." 텍스트 + 버튼 disabled (PR #18 review round 2)

**외부 링크:**

- [x] 피드백 보내기 → mailto:laegel1@gmail.com 호출 (ADR-021) (screens step 3)
- [x] 데이터 출처 보기 → GitHub DATA_SOURCES.md URL 호출 (screens step 3)
- [x] 개인정보 처리방침 → GitHub PRIVACY.md URL 호출 (screens step 3)

**Footer:**

- [x] "Made with ♥ in Seoul · 2026" 텍스트 표시 (screens step 3)

**스냅샷:**

- [x] worker 페르소나 + 통계 비어있음 핵심 contract (screens step 3)

### 9.30 `app/onboarding.tsx` (온보딩 — 페르소나 선택)

screens phase step 4 구현 — 설치 직후 1회 페르소나 선택 화면.

**기본 UI:**

- [x] 3개 페르소나 카드 표시 (student/worker/unknown) (screens step 4)
- [x] 페르소나 라벨 표시 — 단일 출처 `src/lib/persona.ts` (screens step 4)
- [x] 페르소나 sub 표시 — 단일 출처 (screens step 4)
- [x] 인사말 "안녕하세요" + "어디로 떠나시나요?" 표시 (screens step 4)
- [x] 푸터 "설정에서 언제든 변경할 수 있어요" 표시 (screens step 4)
- [x] 질문 라벨 "어떤 분이신가요?" 표시 (screens step 4)

**카드 인터랙션:**

- [x] student 탭 → setPersona('student') + setOnboarded(true) + router.replace('/(tabs)') (screens step 4)
- [x] worker 탭 → setPersona('worker') + setOnboarded(true) + router.replace('/(tabs)') (screens step 4)
- [x] unknown 탭 → setPersona('unknown') + setOnboarded(true) + router.replace('/(tabs)') (screens step 4)

**연타 방어:**

- [x] 같은 카드 빠른 연타 → 첫 탭만 실행 (isNavigatingRef 가드) (PR #18 review round 3)
- [x] 서로 다른 카드 연타 → 첫 탭만 실행 (PR #18 review round 3)

**접근성:**

- [x] student 카드 accessibilityLabel "유학생 선택" (screens step 4)
- [x] worker 카드 accessibilityLabel "취업자 선택" (screens step 4)
- [x] unknown 카드 accessibilityLabel "미선택 선택" (screens step 4)

**스냅샷:**

- [x] 3개 페르소나 카드 — 렌더링 회귀 감지 (PR #18 review round 1)

---

## 9-A. 자동화 스크립트 (scripts/refresh/_ + scripts/build/_)

ADR-032 / AUTOMATION.md 의 자동화 인프라에 대응하는 테스트 인벤토리. 모든 fetch 는 모킹 (`jest.spyOn(global, 'fetch')`), 시간은 `jest.setSystemTime`, 파일 시스템은 `tmp` 디렉터리 또는 `memfs` 모킹.

### 9-A.0 테스트 환경

```ts
// scripts/refresh/__tests__/setup.ts
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-04-28T00:00:00+09:00'));
  // tmp data dir 생성 + 시드 city 파일 복사
  process.env.DATA_DIR = path.join(os.tmpdir(), `test-${Date.now()}`);
  fs.cpSync('src/__fixtures__/cities', `${process.env.DATA_DIR}/cities`, { recursive: true });
});
afterEach(() => {
  fs.rmSync(process.env.DATA_DIR!, { recursive: true, force: true });
  jest.useRealTimers();
  jest.restoreAllMocks();
});
```

### 9-A.1 `scripts/refresh/_common.mjs` 공통 헬퍼

#### `fetchWithRetry(url, opts?)`

- [ ] 첫 시도 성공: response 반환, 재시도 없음
- [ ] 1회 실패 후 성공: 1회 재시도 후 반환
- [ ] 2회 실패 후 성공: 2회 재시도 후 반환
- [ ] 3회 실패 후 성공: 3회 재시도 후 반환
- [ ] 4회 모두 실패: throws `FetchRetryExhaustedError` with retry count
- [ ] backoff 시간: 1s, 2s, 4s (exponential)
- [ ] 5xx 응답: 재시도
- [ ] 4xx 응답: 재시도 없이 즉시 throw
- [ ] timeout 30s 초과: throws `FetchTimeoutError`
- [ ] DNS 실패: 재시도 후 throw
- [ ] 사용자 정의 retry 횟수 (`opts.maxRetries=5`) 적용
- [ ] AbortSignal 전달 시 취소 가능

#### `readCity(id): Promise<CityCostData>`

- [ ] 정상 파일: 파싱 + 반환
- [ ] 파일 부재: throws `CityNotFoundError`
- [ ] 깨진 JSON: throws `CityParseError`
- [ ] 스키마 위반: throws `CitySchemaError`
- [ ] 경로 traversal 시도 (`../../etc/passwd`): throws `InvalidCityIdError`

#### `writeCity(id, data, source): Promise<void>`

- [ ] 새 파일 작성
- [ ] 기존 파일 덮어쓰기
- [ ] `lastUpdated` 자동 갱신 (현재 시각)
- [ ] `sources[]` 에 (category, name, url, accessedAt) 추가 (기존 유지)
- [ ] 같은 source 가 이미 있으면 accessedAt 만 갱신
- [ ] 스키마 위반 데이터 입력 시 throws (write 실패)
- [ ] atomic write (임시 파일 → rename) — 부분 쓰기 방지
- [ ] 디렉터리 부재 시 자동 생성

#### `classifyChange(oldVal, newVal)` (in `_outlier.mjs`)

- [ ] `(null, null)` → `'commit'`
- [ ] `(null, 100)` → `'new'` (신규 항목)
- [ ] `(100, null)` → `'pr-removed'` (제거)
- [ ] `(100, 100)` → `'commit'` (변동 0)
- [ ] `(100, 104)` → `'commit'` (4% 변동)
- [ ] `(100, 104.99)` → `'commit'` (4.99%)
- [ ] `(100, 105)` → `'pr-update'` (정확히 5%)
- [ ] `(100, 105.01)` → `'pr-update'`
- [ ] `(100, 129.99)` → `'pr-update'` (29.99%)
- [ ] `(100, 130)` → `'pr-outlier'` (정확히 30%)
- [ ] `(100, 130.01)` → `'pr-outlier'`
- [ ] `(100, 200)` → `'pr-outlier'` (100% 변동)
- [ ] `(100, 0)` → `'pr-outlier'` (0 으로 변동, 100%)
- [ ] `(100, 96)` → `'commit'` (-4%)
- [ ] `(100, 95)` → `'pr-update'` (-5%)
- [ ] `(100, 70)` → `'pr-outlier'` (-30%)
- [ ] `(0, 100)` → `'new'` (0 도 null 처럼 처리할지 정책 명시: **0 은 정상 값, new 아님**, division by zero 회피)
- [ ] `(0, 0)` → `'commit'`
- [ ] 음수 입력 → throws (cost 데이터에 음수 미허용)
- [ ] `NaN` 입력 → throws

#### `diffCities(oldData, newData): ChangeRecord[]` (in `_diff.mjs`)

- [ ] 변경 없음: 빈 배열
- [ ] 단일 필드 변경: 1 record
- [ ] 다중 필드 변경: 다 record (각 필드별)
- [ ] 신규 필드 (oldData 에 없음): record with oldValue=null
- [ ] 제거된 필드: record with newValue=null
- [ ] 중첩 필드 (`food.groceries.milk1L`): dot-path 로 표현
- [ ] 배열 변경 (`tuition[]`): 각 원소별 record
- [ ] 메타 필드 (`lastUpdated`, `sources`): 변경 추적 제외 (값만)

#### `loadFixture(name)`, `mockFetch(spec)` 등 테스트 헬퍼

- [ ] 가용성·일관성 self-test

### 9-A.2 출처별 fetch 스크립트 — 표준 패턴

각 `scripts/refresh/<source>.mjs` 에 공통 적용. 32개 스크립트 × 아래 항목 = ~250 케이스.

#### 표준 케이스 (모든 스크립트)

- [ ] **표준 인터페이스**: `default export async function refresh(): Promise<RefreshResult>`
- [ ] **정상 fetch + transform**: API 응답 fixture → 우리 스키마로 변환 후 cities 파일 갱신
- [ ] **반환 객체**: `{ source, cities[], fields[], changes[], errors[] }` 정확
- [ ] **변동 없음** (oldVal === newVal): changes 배열 비어 있음
- [ ] **변동 있음**: changes 에 `{ cityId, field, oldValue, newValue, pctChange }` 정확
- [ ] **HTTP 4xx**: 재시도 없이 errors 에 추가, 다른 도시는 계속
- [ ] **HTTP 5xx**: retry 후 실패시 errors 에 추가
- [ ] **응답 빈 body**: errors 에 추가 + log
- [ ] **응답 비-JSON (HTML)**: errors 에 추가
- [ ] **응답 shape 변경** (필드 누락): errors 에 추가, 다른 도시 영향 없음
- [ ] **부분 도시 누락** (API 응답에서 일부 도시 결측): 결측 도시 errors, 나머지 정상
- [ ] **API 키 부재** (env 변수 미설정): throws `MissingApiKeyError` (해당 source 만 실패, 워크플로우는 계속)
- [ ] **timeout**: errors 에 추가
- [ ] **네트워크 차단**: 동일

### 9-A.3 출처별 — 한국 (4 scripts)

#### `kr_molit.mjs` (국토부 실거래가)

- [ ] 정상 응답: 서울 25개 자치구 평균 → share/studio/oneBed/twoBed 매핑
- [ ] 매물 면적 기반 카테고리 매핑 정확 (10㎡ 이하 = share, 11~30㎡ = studio 등)
- [ ] 응답에 매물 0건 (이상 케이스): errors + 기존값 유지
- [ ] 자치구별 데이터 일부 결측: 가용 자치구 평균
- [ ] XML 응답 파싱 (공공데이터포털 일부 XML)
- [ ] API 키 만료 (200 with error message in body): errors

#### `kr_kca.mjs` (한국소비자원 참가격)

- [ ] 32개 품목 중 8개 표준 매핑 (milk1L, eggs12, rice1kg, chicken1kg, bread, onion1kg, apple1kg, ramen)
- [ ] ramen 매핑: "신라면" 키워드 검색 (없으면 일반 라면 평균)
- [ ] 매핑 누락 품목: errors + 기존값 유지
- [ ] 가격 단위 처리 (개당·100g당 등)

#### `kr_kosis.mjs` (통계청 외식·교통 CPI)

- [ ] 외식 CPI 추출 → restaurantMeal 변환 (정적 보정계수 적용)
- [ ] 카페·음료 CPI → cafe 변환
- [ ] CPI 시계열 응답: 최신 월 사용
- [ ] 통계 ID 정확

#### `kr_seoul_metro.mjs` (서울교통공사)

- [ ] 정기권·1회권·택시 기본요금 fetch
- [ ] HTML 페이지 fetch + parse (table 또는 JSON-LD)
- [ ] 페이지 구조 변경 (selector 실패): errors + 기존값 유지

### 9-A.4 출처별 — 캐나다 (5 scripts)

#### `ca_cmhc.mjs`

- [ ] CMHC Rental Market Survey CSV 파싱
- [ ] Vancouver/Toronto/Montreal CMA 평균 임대료 추출
- [ ] # bedrooms 별 매핑 (Bachelor → studio, 1BR → oneBed, 2BR → twoBed, share → 별도 추정)
- [ ] CSV 인코딩 (UTF-8 BOM) 처리

#### `ca_statcan.mjs` (StatCan WDS API)

- [ ] CPI Vector ID 별 fetch
- [ ] Vancouver/Toronto/Montreal CMA 데이터
- [ ] 식재료 8개 매핑 (Vector ID 매핑 표 별도 fixture)
- [ ] 외식 CPI 매핑

#### `ca_translink.mjs`, `ca_ttc.mjs`, `ca_stm.mjs`

- [ ] 각 공식 fare page HTML fetch + parse
- [ ] 1-zone monthly pass / single ride / taxi 추출
- [ ] 페이지 구조 변경 시 graceful fail

### 9-A.5 출처별 — 미국 (4 scripts)

#### `us_hud.mjs`

- [ ] HUD FMR API 응답 파싱
- [ ] MSA 코드별 매핑 (NYC=35614, LA=31084, SF=41884, Seattle=42644, Boston=14454)
- [ ] # bedrooms 매핑

#### `us_census.mjs`

- [ ] ACS B25064 (median rent) fetch
- [ ] 5-city 처리
- [ ] year 파라미터 (최신 5-year estimate)

#### `us_bls.mjs`

- [ ] BLS API key 로 인증
- [ ] Series ID 별 fetch (식재료 8개 + 외식)
- [ ] Region 별 데이터 (Northeast, Midwest, South, West)
- [ ] 도시별 보정계수 (NY=1.0 vs LA=0.95 등 정적)

#### `us_transit.mjs`

- [ ] MTA, LA Metro, SFMTA, King County Metro, MBTA 5개 fare 페이지
- [ ] 각 도시별 추출 함수

### 9-A.6 출처별 — 영국 (2 scripts)

#### `uk_ons.mjs`

- [ ] ONS Private Rental Market Statistics API (London)
- [ ] CPI by item (COICOP 코드 매핑)

#### `uk_tfl.mjs`

- [ ] TfL Unified API (Zone 1-2 monthly/single)
- [ ] taxiBase 별도 (black cab 정적)

### 9-A.7 출처별 — 유럽 (6 scripts)

#### `de_destatis.mjs`

- [ ] GENESIS API XML 응답 파싱
- [ ] Berlin / Munich Bundesland 매핑
- [ ] 임차료 + CPI

#### `de_transit.mjs`, `fr_ratp.mjs`, `nl_gvb.mjs`

- [ ] BVG / MVV / RATP / GVB 각 fare page fetch + parse

#### `fr_insee.mjs`

- [ ] INSEE BDM API
- [ ] Paris Île-de-France region

#### `nl_cbs.mjs`

- [ ] CBS Open Data OData API
- [ ] Amsterdam 평균

### 9-A.8 출처별 — 호주·아시아·UAE (8 scripts)

#### `au_abs.mjs`, `au_transit.mjs`

- [ ] ABS Residential Property Price Index + CPI
- [ ] Sydney/Melbourne 분리
- [ ] 주 단위 → 월 환산 (× 4.33)
- [ ] Transport NSW + PTV fare

#### `jp_estat.mjs`, `jp_transit.mjs`

- [ ] e-Stat API (`JP_ESTAT_APP_ID` 필요)
- [ ] 東京都 23区 + 大阪府 분리
- [ ] 도쿄메트로 + 大阪Metro fare

#### `sg_singstat.mjs`, `sg_lta.mjs`

- [ ] SingStat TableBuilder API
- [ ] LTA DataMall fare API
- [ ] Hawker centre 가격 별도 정적 (CPI Hawker food 카테고리 매핑)

#### `vn_gso.mjs`

- [ ] GSO 데이터 (한계 큼) — best-effort fetch
- [ ] HCMC 단위 데이터 부재 시 "estimated" 마커 + 기존값 유지
- [ ] errors 에 한계 명시 메시지

#### `ae_fcsc.mjs`, `ae_rta.mjs`

- [ ] FCSC + DSC 통합 fetch
- [ ] AED 통화 처리
- [ ] RTA 공식 fare page

### 9-A.9 출처별 — 학비·비자 (2 scripts)

#### `universities.mjs`

- [ ] 도시별 대학 매핑 (registry from DATA_SOURCES.md)
- [ ] 각 대학 공식 international tuition 페이지 fetch
- [ ] HTML parse — 페이지 구조별 selector (대학별 다른 selector 정적 매핑)
- [ ] 학비 단위 (per credit vs per year vs per semester) 정규화 → annual
- [ ] 페이지 구조 변경 시 selector 실패 → errors + 기존값 유지
- [ ] 학비 페이지 redirect 처리
- [ ] 다국어 페이지 (영어 default)
- [ ] 등록비만 있는 대학 (독일·프랑스 일부): annual = 등록비 × 2

#### `visas.mjs`

- [ ] 도시별 비자 페이지 매핑
- [ ] 정부 페이지 fetch + parse
- [ ] 통화별 처리 (USD vs CAD vs EUR vs JPY 등)
- [ ] 정착 비용 추정 (정적 + 비자료)
- [ ] 페이지 변경 시 graceful fail

### 9-A.10 출처별 — 환율 백업 (1 script)

#### `fx_backup.mjs`

- [ ] ECB Exchange Rates API fetch (XML)
- [ ] EUR base → KRW 환산
- [ ] 한국은행 환율 fetch (정적 분기 fallback 갱신)
- [ ] `data/fx_fallback.json` 갱신
- [ ] 응답 shape 검증

### 9-A.11 빌드·검증 스크립트

#### `scripts/build_data.mjs`

- [ ] 21개 city JSON + seoul.json 모두 읽음
- [ ] 각각 `validateCity` 통과 검증
- [ ] `data/all.json` 생성 (schemaVersion=1, generatedAt, fxBaseDate, cities map)
- [ ] `data/seed/all.json` 동시 생성 (동일 내용)
- [ ] gzip 압축 미리 생성 (`data/all.json.gz`) — 옵션
- [ ] 도시 파일 누락 시 throws `MissingCityError`
- [ ] 스키마 위반 도시 있으면 throws + 어느 도시인지 명시
- [ ] 빈 cities 디렉터리: throws
- [ ] all.json 크기 < 200KB raw (size budget)
- [ ] 동일 입력 → 동일 출력 (deterministic, sources sort)

#### `scripts/validate_cities.mjs`

- [ ] 21개 city 모두 검증
- [ ] 각 city 의 schema 통과
- [ ] cross-field consistency (currency vs country)
- [ ] 직전 분기 대비 ±30% 이상 변동: warn (block 아님)
- [ ] sources 배열 비어 있음: throws
- [ ] lastUpdated 미래 날짜: warn
- [ ] lastUpdated 1년+ 과거: warn
- [ ] exit code 0 (성공) / 1 (오류) / 2 (warning only)

### 9-A.12 정적 데이터 파일

#### `data/static/tax_brackets.json`

- [ ] 모든 도시·국가 단신 brackets 존재
- [ ] brackets 단조 증가 (income brackets sorted)
- [ ] 세율 0~1 범위
- [ ] takeHomePctApprox 계산 함수가 정확히 작동
- [ ] schemaVersion 정확

#### `data/fx_fallback.json`

- [ ] 21개 도시 통화 모두 포함
- [ ] KRW base 환산값 양수
- [ ] generatedAt 형식
- [ ] 분기 갱신 일자 매칭

#### `data/static/correction_factors.json`

- [ ] CPI → 외식 1끼 가격 변환 보정계수
- [ ] 도시별 매핑 (예: 도쿄=1.0, 오사카=0.9)
- [ ] 모든 도시 cover

### 9-A.13 워크플로우 YAML 검증

#### `actionlint` 실행

- [ ] `.github/workflows/refresh-fx.yml` syntax valid
- [ ] `refresh-prices.yml`, `refresh-rent.yml`, `refresh-transit.yml`, `refresh-tuition.yml`, `refresh-visa.yml` 모두 valid
- [ ] cron schedule 표현 정확 (`0 18 * * 1` 등)
- [ ] secrets 참조 (`${{ secrets.KR_DATA_API_KEY }}`) 모두 존재 (deny-list 없음)
- [ ] `peter-evans/create-pull-request@v6` 액션 사용 정확

#### Workflow logic 단위 테스트

- [ ] outlier 라벨 분기 (PR 생성 vs 직접 commit)
- [ ] 환경변수 export (`HAS_OUTLIERS=true`) 정확

### 9-A.14 `_registry.mjs` (도시 ↔ 출처 매핑)

DATA_SOURCES.md 부록 A 의 코드화. registry 가 사실상 단일 출처.

- [ ] 모든 21개 도시 + 서울 cover
- [ ] 각 도시 × 6 카테고리 매핑 존재 (없으면 `null` 명시)
- [ ] 매핑된 스크립트 이름이 실제 존재 (refresh dir 의 파일과 매칭)
- [ ] DATA_SOURCES.md 부록 A 와 정합성 (테스트로 자동 검증)

### 9-A.15 통합·E2E 테스트

#### 풀 파이프라인 시뮬레이션

- [ ] 모든 fetch mock → refresh-prices 워크플로우 시뮬레이션 → cities/\*.json 갱신 → all.json 빌드 → 결과 비교
- [ ] 일부 source 실패 → 다른 source 영향 없음 + 워크플로우 partial success
- [ ] 모든 source 실패 → 워크플로우 fail (exit code 1)
- [ ] outlier 발생 → PR 생성 (mock peter-evans action) + 라벨 정확
- [ ] PR 안 만들어지는 케이스 (변동 <5%) → 직접 commit

#### 실제 API smoke test (선택, manual)

- [ ] 운영자가 분기 1회 실제 모든 API 한 번씩 호출 → 응답 shape 변경 감지
- [ ] CI 에는 포함하지 않음 (실 API 의존, flaky 위험)

### 9-A.16 시간·환경 의존 테스트

- [ ] 워크플로우 실행 시각 (KST 18:00) 가정 → fetch URL 의 날짜 파라미터 정확
- [ ] 시즌성 — 학비는 1월·8월 갱신 시 새 학년 데이터 (이전 학년 무시)
- [ ] 분기 boundary (3월 31일 vs 4월 1일) — generatedAt 이 분기 시작 후 첫 갱신 기준 정확
- [ ] timezone: KST 가정 vs UTC GitHub Actions runner 간 변환

### 9-A.17 보안·악의적 입력

- [ ] API 응답에 path traversal 시도 (`../../etc/passwd`): writeCity 가 reject
- [ ] API 응답에 XSS payload (`<script>`): JSON 인코딩 후 저장 — 사용자 노출 X
- [ ] API 응답 매우 큰 (>10MB): timeout/메모리 보호
- [ ] API 응답 무한 nested object: depth 제한
- [ ] 통화 코드 SQL injection (없음 — DB 안 씀, 정규식 검증)

### 9-A.18 멱등성·idempotency

- [ ] 동일 시각에 같은 워크플로우 두 번 실행: 결과 동일 (changes 빈 배열)
- [ ] cities/\*.json 변경 없음 → all.json 변경 없음 → git commit no-op
- [ ] PR 이미 열려 있음 (이전 outlier) → 새 PR 만들지 않고 기존 update

### 9-A.19 성능

- [ ] 한 워크플로우 실행 < 5분 (GitHub Actions 무료 분 기준)
- [ ] refresh-prices 32 source 병렬 실행 시 네트워크 처리량
- [ ] all.json 빌드 < 5초

---

- [ ] 페르소나 카드: 현재 페르소나 표시 (navy gradient)
- [ ] 변경 버튼 → 페르소나 변경 시트 (3 옵션)
- [ ] 시트에서 선택 → 페르소나 갱신 + 토스트 + 시트 닫힘
- [ ] 통계 3카드: 즐겨찾기 N · 최근 M · 도시 DB 20
- [ ] 통계 reactive: 즐겨찾기 추가 시 N 갱신
- [ ] 메뉴 5행 렌더
- [ ] "데이터 새로고침" 탭: refreshCache() 호출 + lastSync 업데이트 + 성공 토스트
- [ ] 새로고침 중 네트워크 실패: 에러 토스트
- [ ] "데이터 출처 보기" 탭: 출처 화면 또는 외부 링크
- [ ] "피드백 보내기" 탭: Linking.openURL('mailto:...') 호출
- [ ] mailto 실패 (이메일 클라이언트 없음): 클립보드 복사 fallback (옵션)
- [ ] "개인정보 처리방침" 탭: 정책 페이지 또는 외부 링크
- [ ] "앱 정보" 탭: dim 스타일, 버전 표시 (`v1.0.0`) — `app.json` 에서 읽음
- [ ] 푸터: "Made with ♥ in Seoul · 2026"

---

## 10. 통합·흐름 테스트 (Integration / Flow)

전체 화면 + 스토어 + 모킹된 lib 로 사용자 시나리오 검증.

### 10.1 첫 실행 흐름

```ts
it('첫 실행: 온보딩 → 유학생 선택 → 홈 이동', async () => {
  await renderWithProviders(<RootApp />);
  await waitFor(() => screen.getByText('어떤 분이신가요?'));
  fireEvent.press(screen.getByA11yLabel('유학생 모드 선택'));
  await waitFor(() => screen.getByText('어디 가시나요?'));
  expect(usePersonaStore.getState().persona).toBe('student');
  expect(usePersonaStore.getState().onboarded).toBe(true);
});
```

### 10.2 골든 패스

- [ ] 온보딩 → 유학생 → 홈 → "밴쿠버" 검색 → 비교 → 식비 카드 탭 → 상세 → 즐겨찾기 → 홈 복귀

### 10.3 페르소나 전환

- [ ] 처음 unknown → 홈 → 비교(밴쿠버) → 학비+세금 모두 표시 → 설정 → student 변경 → 비교 재진입 → 학비만 표시

### 10.4 오프라인 진입

- [ ] 네트워크 차단 → 앱 실행 → 시드 데이터로 동작 → "데이터 갱신 실패" 배지

### 10.5 오프라인 → 온라인 복귀

- [ ] 비행기 모드에서 시작 → 홈 → 토론토 비교 (시드 없으면 ErrorView) → 비행기 모드 해제 → 새로고침 → 데이터 표시

### 10.6 즐겨찾기 영속

- [ ] 밴쿠버 즐겨찾기 → 앱 강제 종료 → 재실행 → 즐겨찾기 유지

### 10.7 환율 stale

- [ ] FX 캐시 24h+ stale → 비교 화면 진입 → 경고 배지 표시 → 새로고침 → 배지 제거

### 10.8 데이터 새로고침

- [ ] 설정 → 새로고침 → lastSync 업데이트 → 토스트 → 비교 화면 재진입 시 새 데이터

### 10.9 에러 복구

- [ ] 비교 화면 데이터 fetch 실패 → ErrorView → 다시 시도 → 성공

### 10.10 빠른 네비게이션

- [ ] 홈 → 비교 → 상세 → 뒤로 → 비교 → 뒤로 → 홈: 백 스택 정상

### 10.11 자동화 → 클라이언트 end-to-end

- [ ] 모킹된 fetch 로 refresh 실행 → cities/\*.json 갱신 → all.json 빌드 → 앱이 새 데이터 표시
- [ ] 환율 backup 갱신 → fx_fallback.json → 앱 (FX API 실패 시) 사용
- [ ] outlier PR 생성 → merge → 다음 사용자 fetch 시 반영

---

## 11. 접근성 테스트 (Accessibility)

### 11.1 자동 테스트 (RNTL)

```ts
it('비교 화면 모든 카드에 a11y label', () => {
  renderWithProviders(<CompareScreen cityId="vancouver" />);
  const cards = screen.getAllByA11yRole('button');
  cards.forEach((card) => {
    expect(card.props.accessibilityLabel).toBeTruthy();
    expect(card.props.accessibilityLabel.length).toBeGreaterThan(5);
  });
});
```

- [ ] 모든 탭 가능 요소: `accessibilityRole` 정의
- [ ] 모든 카드: `accessibilityLabel` 한 문장으로 정보 요약
- [ ] 헤더: `accessibilityRole="header"`
- [ ] 이미지·이모지 only 요소: `accessibilityLabel` 명시
- [ ] 비활성 요소: `accessibilityState={{ disabled: true }}`

### 11.2 라벨 형식 검증

- [ ] FavCard: `"밴쿠버, 서울 대비 1.9배 비쌈"` 형식
- [ ] ComparePair: `"월세, 서울 70만원, 밴쿠버 180만원, 약 2.6배 비쌈"`
- [ ] GroceryRow: `"신라면, 서울 950원, 밴쿠버 2400원, 약 2.5배 비쌈"`
- [ ] HeroCard: `"한 달 예상 총비용, 서울 175만원, 밴쿠버 340만원, 약 1.9배"`
- [ ] MenuRow: `"데이터 새로고침, 마지막 갱신 2026-04-01"`

### 11.3 색상 독립성

- [ ] 배수 정보가 색 외에도 화살표(↑/↓) + 숫자로 인코딩되는지 (text 검사)
- [ ] hot 표시가 색뿐 아니라 아이콘 박스 모양으로 구분되는지

### 11.4 다이나믹 타입

- [ ] `Settings > Display > Text Size` 최대일 때 5화면 모두 깨지지 않음 (수동)
- [ ] `maxFontSizeMultiplier` 가 hero 카드에 1.4 로 제한 (자동 검증)

### 11.5 VoiceOver 시나리오 (수동 e2e §18 와 연동)

- [ ] 홈 → 즐겨찾기 카드 → 도시명·배수 읽힘
- [ ] 비교 → 모든 카드 순서대로 읽힘
- [ ] 카테고리 카드 활성화 (double-tap) → 상세 진입

---

## 12. 성능 테스트

자동 측정은 어렵지만 회귀 방지를 위한 기준 마련.

### 12.1 렌더 시간 (RNTL `act` + performance.now)

- [ ] HomeScreen 첫 렌더 < 100ms (시뮬레이터)
- [ ] CompareScreen 카드 5개 렌더 < 150ms
- [ ] FavCard × 20 가로 스크롤: 60fps 유지 (수동)

### 12.2 번들 크기

- [ ] `npx expo export --platform ios` → `dist/` 디렉터리 < 5MB gzipped
- [ ] 폰트 자산 합 < 1MB (subset 적용 시)

### 12.3 콜드스타트 (수동, 시뮬레이터)

- [ ] iPhone 12 sim: 앱 첫 실행 → 온보딩 표시 < 3초
- [ ] iPhone 12 sim: 앱 (온보딩 완료 후) 재실행 → 홈 표시 < 2초
- [ ] Pixel 6 emulator: 동일 기준

### 12.4 메모리

- [ ] 5화면 한 사이클 후 메모리 leak 없음 (Xcode Instruments 또는 수동)
- [ ] 21개 도시 fetch 후 메모리 < 100MB

---

## 13. 네트워크 조건 테스트

### 13.1 fetchCity / fetchExchangeRates 공통

- [ ] HTTP 200 정상
- [ ] HTTP 200 빈 body → throws Parse
- [ ] HTTP 200 비-JSON (HTML 응답): throws Parse
- [ ] HTTP 200 + 응답 너무 큼 (>1MB): 정상 처리 또는 truncate 정책
- [ ] HTTP 304 Not Modified: 캐시 사용
- [ ] HTTP 301 Redirect: fetch 자동 추적
- [ ] HTTP 401: throws (인증 필요 — 우리는 인증 없으므로 비정상)
- [ ] HTTP 403: throws
- [ ] HTTP 404: throws
- [ ] HTTP 408 Request Timeout: throws + 재시도 정책
- [ ] HTTP 429 Too Many Requests: throws + 재시도 with backoff
- [ ] HTTP 500: throws → fallback
- [ ] HTTP 502 Bad Gateway: 동일
- [ ] HTTP 503 Service Unavailable: 동일
- [ ] HTTP 504 Gateway Timeout: 동일

### 13.2 네트워크 레벨

- [ ] DNS 실패 (`getaddrinfo ENOTFOUND`): throws Fetch
- [ ] 연결 거부 (`ECONNREFUSED`): throws
- [ ] timeout (10초 초과): throws Timeout
- [ ] SSL 인증서 에러: throws
- [ ] 응답 도중 연결 끊김: throws

### 13.3 재시도 정책

- [ ] 5xx: 재시도 1회 (1초 후) → 최종 실패시 throws
- [ ] 4xx (클라이언트 에러): 재시도 안 함
- [ ] 네트워크 에러: 재시도 1회

---

## 14. 데이터 검증 매트릭스

### 14.1 도시 JSON 정합성 (validateCity)

각 필드 × 각 위반 유형 매트릭스:

| 필드                | 결측   | 잘못된 타입 | 잘못된 값                        |
| ------------------- | ------ | ----------- | -------------------------------- |
| id                  | throws | throws      | empty string → throws            |
| name.ko             | throws | throws      | empty → throws                   |
| name.en             | throws | throws      | empty → throws                   |
| country             | throws | throws      | invalid ISO → throws             |
| currency            | throws | throws      | invalid ISO 4217 → throws        |
| region              | throws | throws      | invalid enum → throws            |
| lastUpdated         | throws | throws      | bad format → throws, 미래 → warn |
| rent                | throws | throws      | 모든 필드 null → warn            |
| rent.share          | OK     | throws      | 음수 → throws                    |
| rent.studio         | OK     | throws      | 음수 → throws                    |
| rent.oneBed         | OK     | throws      | 음수 → throws                    |
| food                | throws | throws      | groceries 빈 객체 → warn         |
| food.restaurantMeal | throws | throws      | 0 → warn (이상치)                |
| transport           | throws | throws      | monthlyPass 결측 → warn          |
| tuition             | OK     | throws      | 빈 배열 OK                       |
| tax                 | OK     | throws      | 빈 배열 OK                       |
| visa                | OK     | throws      | 빈 객체 → 카드 미표시            |
| sources             | throws | throws      | 빈 배열 → throws (출처 필수)     |

### 14.2 cross-field 일관성

- [ ] currency 가 country 와 일치 (CA → CAD, US → USD 등)
- [ ] sources 의 카테고리가 실제 데이터와 매칭
- [ ] tuition 학교의 country 가 도시 country 와 일치

### 14.3 각 도시별 fixture 검증

- [ ] 21개 (서울 + 20) JSON 모두 validateCity 통과
- [ ] 분기 갱신 시 직전 분기 대비 변동 ≤ 30% (별도 스크립트)

---

## 15. Property-based / Fuzz 테스트

`fast-check` 라이브러리 사용 (선택).

### 15.1 format

- [ ] `forall n: integer in [-1e10, 1e10], formatKRW(n)` 는 0을 throw 하지 않으며 string 반환
- [ ] `forall m: float in [0.01, 100], formatMultiplier(m)` 는 `↑` 또는 `↓` 또는 `1.0` 으로 시작
- [ ] `formatKRW(formatKRWInverse(formatKRW(n)))` round-trip (역함수가 있다면)

### 15.2 currency

- [ ] `forall (v, c): convertToKRW(v, c, fx) >= 0` (음수 금액 throws 외)
- [ ] `forall (v, c1, c2): convertToKRW(convertFromKRW(v, c1), c2)` 일관 (간접 환율)

### 15.3 compare

- [ ] `forall persona, city: getCardListForPersona(persona)` 는 항상 일관된 길이 (5 또는 6)
- [ ] `computeMonthlyTotal(student, ...) ≤ computeMonthlyTotal(worker, ...) + ε` 같은 invariant (해당되면)

---

## 16. 정책 결정 (테스트로 강제)

### 16.1 즐겨찾기 상한

- 정책: **50개**, 51번째 add → 거부 + 토스트 안내
- 테스트 케이스 §9.6 필수

### 16.2 최근 본 도시

- 정책: max 5, FIFO, dedup (재진입 시 최신 위치)
- 테스트 §9.7

### 16.3 학비 계산 기준

- 정책: 도시별 첫 등록 학교 (배열 인덱스 0) 의 학사 학비
- 학사 없으면 첫 학교 첫 level
- 테스트 §9.3

### 16.4 환율 stale 임계

- 정책: 24h 초과 시 캐시 사용 + 경고 배지. 7일 초과 시 비교값 계산 보류
- 테스트 §9.2 / §10.7

### 16.5 통화 코드 정규화

- 정책: 입력 시 `.toUpperCase().trim()`. lowercase / trailing space 정상 처리
- 테스트 §9.2

### 16.6 fxPct 정규화 (HeroCard 막대)

- 정책: 합 ≠ 1 이면 자동 정규화 (각자 / 합)
- 테스트 §9.14

### 16.7 캐시 우선순위 (data.ts)

- 정책: 캐시 → 시드 → 네트워크 → 에러
- 단, 사용자 수동 새로고침 시: 네트워크 → 캐시 → 시드 → 에러 (반대 순)
- 테스트 §9.4

---

## 17. 엣지 케이스 체크리스트

각 화면·기능에서 의식적으로 검증:

### 17.1 네트워크

- [ ] 오프라인 진입 → 시드 사용
- [ ] 진입 후 오프라인 전환 → stale 캐시 + 경고
- [ ] 느린 네트워크 (3G) → skeleton 길게 표시
- [ ] 5xx 응답 → 시드 fallback
- [ ] timeout → 시드 fallback

### 17.2 데이터

- [ ] 모든 카테고리 동일 값 → 막대 폭 일관 (둘 다 100%)
- [ ] city.rent 모든 필드 null → 카드 미표시 또는 "데이터 없음"
- [ ] city.tuition 빈 배열 → 학비 카드 미표시 (페르소나=student)
- [ ] visa 데이터 없음 → visa 카드 미표시
- [ ] city 데이터 필드 누락 → 스키마 검증 fail

### 17.3 환율

- [ ] FX 결측 → "?" 표기, 앱 동작 유지
- [ ] FX 값 0 → throws InvalidFx
- [ ] FX 값 음수 → throws

### 17.4 사용자 입력

- [ ] 검색 빈 문자열 → 전체 표시
- [ ] 검색 공백만 → 전체 표시
- [ ] 검색 특수문자 → escape 처리, 결과 0
- [ ] 검색 매우 긴 입력 (1000자) → throttle / 안정 동작
- [ ] 검색 한글+영문 혼합 → 부분 매칭

### 17.5 상태

- [ ] 페르소나 mid-session 변경 → Compare 카드 즉시 갱신
- [ ] 즐겨찾기 add 직후 뒤로 → 홈 카운트 갱신
- [ ] 빠른 연타 (즐겨찾기 ⭐ × 10): debounce 또는 idempotent 결과

### 17.6 디바이스·환경

- [ ] iPhone SE (작은 화면): 5화면 모두 squeeze 없이
- [ ] iPad: 폰 레이아웃 유지 (확장 미지원 v1.0)
- [ ] iOS 15 (최저 지원): 정상
- [ ] Android API 26 (최저): 정상
- [ ] 다크 모드 시도 (시스템): 라이트 강제 (ADR-016)
- [ ] 시스템 언어 영어: 한국어 UI 유지 (한국어 강제)

### 17.7 시간

- [ ] DST 전환: 영향 없음 (KST 단일)
- [ ] 자정 경계: 캐시 TTL 정확
- [ ] 연말 → 연초: 날짜 표시 정확

### 17.8 한국어 처리

- [ ] 한국어 + 영문 혼합 ("Vancouver 밴쿠버"): 검색 매칭
- [ ] 한국어 + 이모지: 표시 정상
- [ ] 한자 (없음 정책)
- [ ] 자모 분리 (검색 시 "ㅁ" 입력): 정책 (정상 무시)

### 17.9 매우 긴/큰 값

- [ ] 도시명 매우 김 ("샌프란시스코 베이"): 줄임
- [ ] 가격 매우 큼 (월세 1억+): formatKRW 정상
- [ ] 배수 매우 큼 (10×): formatMultiplier `"↑10.0×"`
- [ ] 매우 작음 (0.05×): `"↓0.1×"` (반올림)

### 17.10 Race conditions

자동·수동 액션 동시 발생 시:

- [ ] 즐겨찾기 토글 + 페르소나 변경 동시: 두 변경 모두 반영, store 일관성 유지
- [ ] 페르소나 변경 + Compare 화면 진입 동시: 새 페르소나 카드 구성 (mid-session reactive)
- [ ] 데이터 새로고침 진행 중 사용자 다시 새로고침 탭: 첫 번째 fetch 완료까지 대기 (in-flight dedup)
- [ ] 백그라운드 fetch + 사용자 수동 새로고침 동시: 둘 다 안전, 결과 일관
- [ ] 검색 입력 중 빠르게 다른 도시 탭: navigation 안 됨 (debounce)
- [ ] 즐겨찾기 0 → 1 → 0 빠른 토글 (3회): 최종 상태 정확
- [ ] AsyncStorage 동시 쓰기 (페르소나 + 즐겨찾기 동시 store update): 둘 다 영속화
- [ ] 오프라인 → 온라인 전환 직후 사용자 새로고침: 자동 fetch + 사용자 fetch 합류

### 17.11 장기 세션 (long-running)

- [ ] 1시간 사용 시뮬레이션 (Maestro/Detox 또는 수동): 메모리 누수 < 50MB 증가
- [ ] 모든 21개 도시 한 번씩 비교 → 메모리 OK
- [ ] 페르소나 변경 100회: store 누수 없음
- [ ] 즐겨찾기 add/remove 1000회: AsyncStorage 일관성

### 17.12 기종별 매트릭스 (수동 e2e)

베타 단계에서 검증할 기종 매트릭스:

| 기종                    | OS         | 화면  | 검증 항목                                         |
| ----------------------- | ---------- | ----- | ------------------------------------------------- |
| iPhone SE (3rd)         | iOS 17     | 4.7"  | 작은 화면 squeeze 없음, hero 카드 한 줄 유지      |
| iPhone 12               | iOS 17     | 6.1"  | 표준                                              |
| iPhone 16 Pro Max       | iOS 18     | 6.9"  | dynamic island 안 가림                            |
| iPad (10th gen)         | iPadOS 17  | 10.9" | 폰 레이아웃 유지 (확장 X), safe area              |
| Pixel 6                 | Android 14 | 6.4"  | 표준 안드로이드                                   |
| Pixel 9 Pro Fold        | Android 15 | 폴드  | 폴드 시 폰 레이아웃, 펼침 시 폰 레이아웃 (확장 X) |
| Galaxy S24              | Android 14 | 6.2"  | 삼성 OneUI                                        |
| Galaxy S22 (lower spec) | Android 13 | 6.1"  | 저사양 디바이스 콜드스타트 ≤4초                   |

각 기종에서 §18 골든패스 + 음의 흐름 + 접근성 검증.

### 17.13 자동화 엣지 케이스

- [ ] API 응답 한 도시 결측: 다른 도시는 정상, 결측 도시 errors 추가
- [ ] API 응답 shape 변경: 해당 source 실패, 다른 source 영향 없음
- [ ] API 키 만료 (200 with error message in body): 인식 + errors
- [ ] 정기 갱신 시점 직전 직후 PR 생성 충돌: peter-evans action 자동 처리
- [ ] 워크플로우 실패 후 재실행: 재시도 가능, 멱등
- [ ] outlier PR 미머지 상태에서 다음 분기 갱신: 동일 PR update 또는 새 PR (정책 §9-A.18)
- [ ] HTTP 검증서 만료 (정부 사이트 일부): fetch 실패 → fallback
- [ ] 정부 페이지 일시 다운 (점검): 재시도 후 errors

### 17.14a Cold start (cities/\*.json 비어있음)

- [ ] 첫 사용자 첫 실행: AsyncStorage 비어있음 → 1차 fetch 시도 → 실패 → 시드 사용 → OfflineBadge 표시
- [ ] 자동화 1회 도는 후 진입: cities/\*.json 채워짐 → fetch 성공 → 시드 무시
- [ ] 시드도 비어있음 (빌드 사고): ErrorView fatal "데이터를 불러올 수 없어요" + [재시도] (이론 케이스, EAS Build 가 검증)
- [ ] M6 출시 전 시드 검증: assets/data/seed/all.json 21개 도시 모두 포함

### 17.14b 디자인 mock 텍스트 vs strings.ko 일치

- [ ] `scripts/validate_strings.mjs` 실행 시 mismatch 0
- [ ] 디자인 변경 시 strings.ko 도 함께 갱신 (PR 자동 검증)

### 17.14 인디케이터 표시 정확성

- [ ] 오프라인 진입: OfflineBadge 즉시 표시
- [ ] 오프라인 → 온라인 복귀: OfflineBadge 사라짐 + 자동 fetch 트리거
- [ ] 환율 stale (>24h): inline 배지 표시
- [ ] 데이터 갱신 실패 후 재시도 성공: 배지 사라짐
- [ ] 페르소나 변경: PersonaTag 즉시 갱신
- [ ] 데이터 갱신 후 FreshnessBadge 분기 표기 갱신

---

## 18. 수동 e2e 체크리스트

자동화 어려운 시나리오. Phase 7 step2 / 출시 전 베타 단계에서 시뮬레이터·실기기로 검증.

### 18.1 골든 패스

- [ ] 첫 실행: 온보딩 → 유학생 선택 → 홈
- [ ] 홈에서 "밴쿠버" 검색 → 비교 화면 진입
- [ ] Compare: 환율 표시 / 5 카드 / 출처
- [ ] 식비 카드 탭 → 상세 → 식재료 8개
- [ ] 뒤로 → Compare → ⭐ 추가
- [ ] 홈: 즐겨찾기 카드 표시
- [ ] 설정 → "취업자" 변경 → 비교 재진입 → 카드 구성 변경

### 18.2 음의 흐름

- [ ] 비행기 모드: 시드로 동작
- [ ] 비행기 모드 → 정상: 데이터 stale 갱신
- [ ] 앱 강제 종료 → 재실행: 즐겨찾기·페르소나 유지
- [ ] iPhone SE: 모든 화면 squeeze 없이
- [ ] iPad: 폰 레이아웃
- [ ] 다크 모드: 라이트 강제

### 18.3 접근성

- [ ] VoiceOver 켠 채 5화면 탐색 가능
- [ ] 모든 카드 라벨 의미 있음
- [ ] 다이나믹 타입 최대 모든 화면 가독
- [ ] 색맹 시뮬레이터: 배수 정보 손실 없음

### 18.4 한국어

- [ ] 모든 폰트가 한국어 자모 정상 렌더
- [ ] 만/천 단위 포매팅 정확
- [ ] 도시·국가명 한국어 우선

### 18.5 인터랙션

- [ ] 카드 탭 micro-interaction (scale-down 100ms)
- [ ] 가로 스크롤 감속 자연스러움
- [ ] 토스트 2.5s dismiss
- [ ] 시트 swipe-to-dismiss

### 18.6 데이터

- [ ] 5개 도시(밴쿠버·도쿄·베를린·뉴욕·호치민) 비교 시각 일관
- [ ] 각 도시 각 카테고리 hot 규칙 정확
- [ ] 출처 링크 외부 브라우저 열림

### 18.7 출시 전 (M6)

- [ ] 5명 이상 베타 테스터 24h 사용 후 크래시 0
- [ ] TestFlight / Internal Play 설치 정상
- [ ] 스토어 메타데이터 + 스크린샷 + 개인정보 처리방침 URL 동작
- [ ] 심사 거절 사유 (RELEASE.md §6) 모두 검증

---

## 19. CI 고려사항

v1.0: 로컬 `npm test` 만. 매 step 의 AC 가 검증.

v1.x 도입 시 (별도 ADR 필요):

- 매 PR: `lint + typecheck + test + coverage` 필수 통과
- 매 main push: 추가로 EAS preview build (선택)
- 커버리지 임계 미만 → PR 차단
- 스냅샷 갱신은 별도 커밋 강제

---

## 20. 테스트 네이밍·구조 규약

```ts
describe('formatKRW', () => {
  describe('정상 케이스', () => {
    it('1만원 미만은 콤마 구분으로 표시', () => {
      expect(formatKRW(1234)).toBe('1,234원');
    });
  });
  describe('만 단위', () => {
    it('정수 만: "1만원"', () => {
      expect(formatKRW(10_000)).toBe('1만원');
    });
    it('소수 만: "1.2만원" (1자리 반올림)', () => {
      expect(formatKRW(12_499)).toBe('1.2만원');
    });
  });
  describe('에러 케이스', () => {
    it('NaN 입력 시 throws', () => {
      expect(() => formatKRW(NaN)).toThrow(InvalidNumberError);
    });
  });
});
```

규칙:

- `describe` 는 한국어 허용
- 테스트명은 **입력 → 기대 결과** 형식
- 한 `it` 당 하나의 의미적 assertion 그룹
- 에러 테스트는 항상 `toThrow(<ErrorClass>)` 까지 검증 (메시지만 검증 X)
- 중첩 depth 3 이상 금지 (가독성)
- 비동기는 `async/await` 일관 (.then 금지)

---

## 21. 본 문서 갱신

새 모듈·화면·정책 추가 시 본 문서의 §9 인벤토리에 항목을 함께 추가한다. PR/step 리뷰 시 "TESTING.md 인벤토리에 추가됐는가" 를 체크리스트로 확인. 누락 = step 미완료 (CLAUDE.md CRITICAL 로 박힘).

테스트가 깨질 때:

1. 의도된 변경인지 먼저 판별
2. 의도면 인벤토리·기대값 동시 갱신
3. 의도 아니면 (회귀): 코드 수정 + 추가 테스트로 보강

테스트는 살아있는 명세다. 실제 코드보다 먼저, 그리고 더 자주 갱신된다.
