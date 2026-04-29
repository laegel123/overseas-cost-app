# Step 0: types-errors

## 읽어야 할 파일

먼저 아래 파일들을 정독하고 설계 의도를 파악하라:

- `CLAUDE.md` — 기술 스택, **CRITICAL 규칙** (특히 "에러 삼키지 않는다", "any 사용 금지")
- `docs/PRD.md` §8.7 (도시 JSON 스키마 초안 — 참고)
- `docs/DATA.md` §2 (도시 비용 데이터 스키마 — **v1.0 정식 스키마, 단일 출처**)
- `docs/DATA.md` §6.1 (`all.json` batch 파일 형식)
- `docs/ARCHITECTURE.md` §데이터 흐름 — `data.ts` / `currency.ts` 공개 API
- `docs/ARCHITECTURE.md` §에러 핸들링 전략 + **§에러 타입 카탈로그** (14개 클래스)
- `docs/TESTING.md` §9.26b (`src/lib/errors.ts` 테스트 매트릭스)

## 작업

이 step 은 **데이터 레이어의 타입과 에러 카탈로그** 만 만든다. 검증·fetch·계산은 후속 step (1~4) 의 책임이므로 이 step 에서 손대지 않는다. 실제 데이터 사용처(컴포넌트·스토어)도 손대지 않는다 — 이 phase 는 lib 영역에 한정.

### 1. `src/types/city.ts` 신규 작성

DATA.md §2 의 `CityCostData` 타입을 **그대로** 정의한다. `src/types/index.ts` 에서 re-export.

추가로 다음 타입들을 같은 파일에 정의:

```ts
export type Persona = 'student' | 'worker' | 'unknown';

export type Region = 'na' | 'eu' | 'asia' | 'oceania' | 'me';

// DATA.md §2 의 CityCostData 그대로 (region 필드 포함)
export type CityCostData = { /* ... */ };

// data.ts 가 메모리에 들고 있는 도시 맵
export type CitiesMap = Record<string, CityCostData>;

// data.ts 가 fetch 하는 batch 파일 (DATA.md §6.1)
export type AllCitiesData = {
  schemaVersion: 1;
  generatedAt: string; // ISO datetime
  fxBaseDate: string;  // ISO date
  cities: CitiesMap;
};

// currency.ts 가 다루는 환율 테이블 (USD base, KRW 도 포함)
// 키: ISO 4217 alpha-3, 값: 1 단위당 KRW 환산값 (예: { CAD: 980, JPY: 9.0 })
export type ExchangeRates = Record<string, number>;
```

**규칙:**

- `noUncheckedIndexedAccess` 가 켜져 있으므로 `CitiesMap[id]` 는 `CityCostData | undefined` 가 된다. 이 사실을 전제로 후속 step 들이 `getCity(id)` 의 반환 타입을 짠다.
- `tuition / tax / visa` 는 선택. PRD §8.7 그대로.
- `groceries` 의 `[key: string]: number | undefined` 인덱스 시그니처도 DATA.md §2 그대로.
- TypeScript `any` 절대 금지. 미정 값은 `unknown` + 타입 가드.

### 2. `src/lib/errors.ts` 신규 작성

ARCHITECTURE.md §에러 타입 카탈로그의 **14개 클래스** 를 한 파일에 모두 정의한다.

```ts
export abstract class AppError extends Error {
  abstract readonly code: string;
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = this.constructor.name; // toString/stack 가독성
  }
  toJSON() {
    return { name: this.name, code: this.code, message: this.message };
  }
}
```

각 서브클래스는 `code` readonly 필드만 다르다 (한 줄). 카탈로그 (이름 → code) — ARCHITECTURE.md §에러 타입 카탈로그 표와 **1:1 일치** :

| 클래스                      | code                     |
| --------------------------- | ------------------------ |
| `InvalidNumberError`        | `INVALID_NUMBER`         |
| `InvalidMultiplierError`    | `INVALID_MULTIPLIER`     |
| `InvalidAmountError`        | `INVALID_AMOUNT`         |
| `UnknownCurrencyError`      | `UNKNOWN_CURRENCY`       |
| `FxFetchError`              | `FX_FETCH_FAILED`        |
| `FxParseError`              | `FX_PARSE_FAILED`        |
| `FxTimeoutError`            | `FX_TIMEOUT`             |
| `CityParseError`            | `CITY_PARSE_FAILED`      |
| `CitySchemaError`           | `CITY_SCHEMA_INVALID`    |
| `CityNotFoundError`         | `CITY_NOT_FOUND`         |
| `CityFetchError`            | `CITY_FETCH_FAILED`      |
| `CityTimeoutError`          | `CITY_TIMEOUT`           |
| `AllCitiesUnavailableError` | `ALL_CITIES_UNAVAILABLE` |
| `FavoritesLimitError`       | `FAVORITES_LIMIT`        |
| `InvariantError`            | `INVARIANT`              |

(15개 — ARCHITECTURE 표 그대로. `FavoritesLimitError` 는 후속 store phase 까지 throw 되지 않지만 카탈로그 단일 출처 유지를 위해 미리 정의.)

**규칙:**

- `code` 는 `readonly` literal 타입. `as const` 로 좁히거나 `readonly code: 'INVALID_NUMBER'` 식 명시.
- 각 클래스의 `name` 은 클래스 이름과 정확히 일치 (테스트가 검증).
- 외부에서 `instanceof AppError` 분기 가능해야 함.
- `cause` 는 `unknown` (RN/JS 표준 `Error.cause` 와 호환).
- 메시지·국제화 문구는 이 파일에서 정하지 않는다 (i18n/errors.ko 는 별도 step 책임).

### 3. 테스트

`src/lib/__tests__/errors.test.ts` 신규 작성. TESTING.md §9.26b 매트릭스 따라:

```ts
import { AppError, InvalidNumberError, UnknownCurrencyError /* ...15개 */ } from '../errors';

const errorCases: Array<[new (msg: string, cause?: unknown) => AppError, string]> = [
  [InvalidNumberError, 'INVALID_NUMBER'],
  [UnknownCurrencyError, 'UNKNOWN_CURRENCY'],
  // ... 15개 전부
];

describe.each(errorCases)('%s', (Ctor, expectedCode) => {
  it('AppError + Error 상속', () => {
    const e = new Ctor('test');
    expect(e).toBeInstanceOf(AppError);
    expect(e).toBeInstanceOf(Error);
  });
  it('code 가 카탈로그와 일치', () => {
    expect(new Ctor('test').code).toBe(expectedCode);
  });
  it('message 가 보존', () => {
    expect(new Ctor('hello').message).toBe('hello');
  });
  it('name 이 클래스 이름과 일치', () => {
    expect(new Ctor('test').name).toBe(Ctor.name);
  });
  it('cause 옵션 보존', () => {
    const cause = new Error('underlying');
    expect(new Ctor('test', cause).cause).toBe(cause);
  });
  it('toJSON 에 code+message 포함', () => {
    const e = new Ctor('msg');
    const json = JSON.parse(JSON.stringify(e));
    expect(json.code).toBe(expectedCode);
    expect(json.message).toBe('msg');
    expect(json.name).toBe(Ctor.name);
  });
});
```

`src/types/__tests__/city.test.ts` 는 **만들지 않는다** (타입 전용 모듈은 tsc 가 검증; 별도 런타임 테스트 불필요).

### 4. `docs/TESTING.md` §7 (모듈별 인벤토리) 보강

§9.26b 는 이미 본 step 의 errors.ts 를 담고 있어 추가 작성 불필요. 단, 본 step 에서 클래스 개수가 ARCHITECTURE 와 일치하는지 (15개) 확인 후 §9.26b 의 "ARCHITECTURE.md §에러 타입 카탈로그의 15개 클래스 각각" 문구가 맞으면 그대로 둔다. 일치하지 않으면 §9.26b 본문을 갱신한다 (단, 다른 inventory 항목은 손대지 않는다).

### 5. ADR

이 step 은 새 의존성·결정을 도입하지 않는다 (타입과 에러 클래스 정의만). ADR 추가 불필요.

## Acceptance Criteria

```bash
npm run typecheck && npm test -- src/lib/__tests__/errors.test.ts
```

- `npm run typecheck` 통과
- errors.test.ts 의 전 테스트 통과 (15 클래스 × 6 케이스 = 90 케이스)
- `src/types/city.ts`, `src/types/index.ts`, `src/lib/errors.ts` 파일이 실재
- `git diff --stat` 에 위 3개 파일 + 1개 테스트 파일만 등장 (다른 파일 수정 없음)

## 검증 절차

1. 위 AC 커맨드 실행 — 모두 통과 확인
2. **아키텍처 체크리스트:**
   - `CityCostData` 가 DATA.md §2 의 모든 필드를 포함하는가?
   - `region` 이 5개 union literal 인가?
   - `Persona` 가 정확히 `'student' | 'worker' | 'unknown'` 인가?
   - 15개 에러 클래스가 모두 `AppError` 상속이고 `code` 가 정확한가?
   - `any` 가 한 군데도 등장하지 않는가? (`grep -n ": any\b" src/types src/lib/errors.ts` 결과 0건)
3. 결과를 `phases/data-layer/index.json` step 0 에 반영:
   - 성공 → `"status": "completed"`, `"summary": "CityCostData/Persona/CitiesMap/AllCitiesData/ExchangeRates 타입 + AppError 베이스 + 15개 서브클래스 카탈로그. instanceof/code/cause/toJSON 매트릭스 테스트 통과."`
   - 실패 → `"status": "error"` + 에러 메시지

## 금지사항

- **`src/lib/citySchema.ts` 를 만들지 마라.** 이유: schema 검증은 step 1 의 책임이며, step 0 은 타입·에러만 정의한다.
- **`src/lib/data.ts` / `src/lib/currency.ts` 를 만들거나 수정하지 마라.** 이유: step 3, 4 의 책임. `src/lib/index.ts` 도 손대지 말고 후속 step 에서 export 추가.
- **시드 JSON 을 만들지 마라.** 이유: step 2 의 책임.
- **국제화(i18n) 메시지 매핑을 만들지 마라.** 이유: §9.27.1 (`src/i18n/errors.ko.ts`) 는 별도 phase. 이 step 은 영문 키만.
- **`any` 또는 `as any` 를 사용하지 마라.** 이유: CLAUDE.md CRITICAL. 외부 입력은 `unknown` + 타입 가드.
- **외부 의존성(zod, io-ts 등) 추가 금지.** 이유: ADR 없이 dep 추가 금지. 본 step 은 타입+에러만 만들고 schema 검증은 다음 step 에서 자체 구현.
- 기존 테스트를 깨뜨리지 마라.
