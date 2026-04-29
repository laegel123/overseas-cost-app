# Step 1: city-schema

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL ("외부 데이터는 src/lib/data.ts 경유", "에러 삼키지 않는다")
- `docs/DATA.md` §2 (CityCostData 필드별 의미·제약)
- `docs/DATA.md` §6.1 (`all.json` batch 형식 — `schemaVersion`, `generatedAt`, `fxBaseDate`, `cities`)
- `docs/DATA.md` §11 (데이터 정의 표준 — sanity 검증 기준)
- `docs/ARCHITECTURE.md` §에러 타입 카탈로그 (CityParseError / CitySchemaError 정확한 발생 조건)
- `docs/TESTING.md` §9.4 의 "validateCity / validateAllJson" 매트릭스 (필수 필드, 타입 위반, 선택 필드, 값 sanity)
- step 0 결과: `src/types/city.ts` (CityCostData, AllCitiesData, CitiesMap), `src/lib/errors.ts` (CityParseError, CitySchemaError)

## 작업

이 step 은 **단일 도시 + batch 파일의 런타임 schema 검증** 만 만든다. fetch·캐시·시드는 손대지 않는다 (step 3, 4 의 책임). 외부 lib (zod 등) 도 추가하지 않는다 — 본 step 도 자체 검증.

### 1. `src/lib/citySchema.ts` 신규 작성

공개 API:

```ts
import type { CityCostData, AllCitiesData } from '@/types/city';

/**
 * unknown JSON 객체를 검증하고 CityCostData 로 좁힌다.
 * 실패 시 CitySchemaError 를 throws (어느 필드가 문제인지 message 에 포함).
 */
export function validateCity(input: unknown): CityCostData;

/**
 * batch 파일(`all.json`) 전체를 검증한다.
 * - schemaVersion === 1 검증 (불일치 시 CitySchemaError)
 * - cities 객체의 각 값에 대해 validateCity 호출
 * - 한 도시 검증 실패 시 CitySchemaError throws (어느 도시 + 어느 필드 메시지에 포함)
 */
export function validateAllJson(input: unknown): AllCitiesData;

/**
 * 텍스트 → JSON.parse → validateAllJson 의 합성.
 * - JSON.parse 실패 시 CityParseError throws
 * - 검증 실패 시 validateAllJson 의 throw 가 그대로 전파
 */
export function parseAllCitiesText(text: string): AllCitiesData;
```

### 2. 검증 규칙 (필드별)

DATA.md §2 + TESTING.md §9.4 매트릭스 기반. 모두 충족 못하면 `CitySchemaError`.

**CityCostData 필수 필드 (모두 결측 시 throw):**

- `id`: 비어있지 않은 문자열 (영문 소문자 + 하이픈만, `/^[a-z][a-z0-9-]*$/`)
- `name.ko`: 비어있지 않은 문자열
- `name.en`: 비어있지 않은 문자열
- `country`: ISO 3166-1 alpha-2 (정확히 대문자 2자리, `/^[A-Z]{2}$/`)
- `currency`: ISO 4217 alpha-3 (정확히 대문자 3자리, `/^[A-Z]{3}$/`)
- `region`: `'na' | 'eu' | 'asia' | 'oceania' | 'me'` 중 하나
- `lastUpdated`: ISO date `YYYY-MM-DD` (정확히 `/^\d{4}-\d{2}-\d{2}$/`, 미래 날짜는 통과 + dev warn — TESTING §9.4 정책)
- `rent`: 객체. 필수 키 `share, studio, oneBed, twoBed` 각각 `number | null`. 음수 금지 (음수 시 throw). `deposit` 선택, 양수만.
- `food`: 객체.
  - `restaurantMeal`, `cafe`: 양수 number 필수
  - `groceries`: 객체. 표준 키 `milk1L, eggs12, rice1kg, chicken1kg, bread` 양수 number 필수. 추가 키 (`onion1kg, apple1kg, ramen` 등) 양수 number 또는 undefined 허용.
- `transport`: 객체. `monthlyPass, singleRide, taxiBase` 양수 number 필수.
- `sources`: 배열. 길이 ≥ 1. 각 원소 `{ category, name, url, accessedAt }` 모두 비어있지 않은 문자열 (`category` 는 `'rent'|'food'|'transport'|'tuition'|'tax'|'visa'`, `accessedAt` 은 ISO date).

**선택 필드 (없으면 통과, 있으면 검증):**

- `tuition`: 배열. 빈 배열 허용. 각 원소 `{ school: string, level: 'undergrad'|'graduate'|'language', annual: number > 0 }`.
- `tax`: 배열. 각 원소 `{ annualSalary: number > 0, takeHomePctApprox: number ∈ [0, 1] }`.
- `visa`: 객체. 각 필드 `studentApplicationFee?, workApplicationFee?, settlementApprox?` 가 양수 number 또는 undefined.

**AllCitiesData (batch):**

- `schemaVersion`: 정확히 number `1` (다른 값 시 throw — v2 이후 마이그레이션은 별도 step 에서 처리)
- `generatedAt`: ISO datetime (`/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/` 정도. `new Date(s).toISOString()` 와 비교 not strictly required, 패턴만)
- `fxBaseDate`: ISO date
- `cities`: 객체. 키가 ≥ 1 개. 각 값 validateCity 통과.

**메시지 포맷:**

throw 시 메시지는 사람이 읽을 수 있게:

- 단일 도시: `"city 'vancouver': field 'currency': expected ISO 4217 (3 uppercase letters), got 'KRW2'"`
- batch: `"all.json: city 'tokyo': field 'rent.oneBed': expected non-negative number, got -100"`

**구현 가이드:**

- `validateCity` 내부에서 작은 헬퍼 사용 (`assertString`, `assertPositiveNumber`, `assertEnum`, `assertIsoDate`). 헬퍼는 같은 파일 안에 비공개로 두고 export 하지 않는다 (작은 도메인 한정).
- 미지의 추가 필드는 통과 + 무시 (TESTING §9.4 "추가 필드 통과 + 무시" 정책).
- 정규화는 하지 않는다 — 입력이 제출 그대로 통과해야 한다 (예: `currency` 의 `' cad '` 같은 trailing space 는 throw, 자동 trim 안 한다). `currency.ts` 에서 입력 정규화는 별개.
- 반환 객체는 입력 객체와 **다른 참조** 일 필요는 없다 — type cast 후 같은 객체 반환 OK.

### 3. 테스트

`src/lib/__tests__/citySchema.test.ts` 신규 작성. TESTING.md §9.4 의 매트릭스 그대로 covers:

**Happy path:**

- 완전한 도시 객체 (서울 fixture, 밴쿠버 fixture) → 통과
- `tuition` / `tax` / `visa` 누락 → 통과
- `tuition` 빈 배열 → 통과
- `groceries` 추가 키 → 통과 + 무시

**필수 필드 결측:**

- `id`, `name.ko`, `name.en`, `country`, `currency`, `region`, `lastUpdated`, `rent`, `food`, `transport`, `sources` — 각각 누락 시 throws (`CitySchemaError`, code `CITY_SCHEMA_INVALID`, message 에 누락 필드명 포함)

**타입 위반:**

- `currency: 123` → throws
- `country: 'KOR'` (3자리) → throws
- `currency: 'KRW2'` → throws
- `rent.oneBed: '2300'` (문자열) → throws
- `rent.share: -100` → throws
- `lastUpdated: '2026/04/01'` (잘못된 구분자) → throws
- `region: 'antarctica'` → throws
- `food.restaurantMeal: 0` → throws (양수만)
- `tax[0].takeHomePctApprox: 1.5` → throws (범위 위반)
- `sources: []` → throws (길이 ≥ 1)

**Batch (validateAllJson):**

- 정상 batch → 통과
- `schemaVersion: 2` → throws (`CitySchemaError`, message 에 "schemaVersion" 포함)
- `cities: {}` → throws (길이 ≥ 1)
- `cities.seoul.currency` 가 위반 → throws (메시지에 `'seoul'` + `'currency'` 등장)
- 미지 추가 필드 (`extra: 'foo'`) → 통과

**parseAllCitiesText:**

- 정상 JSON → 통과
- 깨진 JSON (`'{not json'`) → throws `CityParseError` (code `CITY_PARSE_FAILED`)
- 빈 문자열 → throws `CityParseError`
- HTML 응답 (`'<!DOCTYPE html>'`) → throws `CityParseError`

**fixture 위치:**

- `src/__fixtures__/cities/seoul-valid.ts` 와 `vancouver-valid.ts` 신규 작성. 빌더 패턴 (TESTING §7.2) 또는 단순 ts 객체. **JSON 파일이 아닌 ts** — step 2 의 실제 seed JSON 과 분리 (테스트 fixture 와 시드는 책임이 다르다).
- 잘못된 입력은 인라인 또는 fixture 빌더의 변형으로 만든다 (`buildCity({ currency: 'KRW2' })` 처럼).

### 4. `src/lib/index.ts` export 확장

기존 `src/lib/index.ts` 의 빈 파일에 다음 export 추가:

```ts
export * from './errors';
export { validateCity, validateAllJson, parseAllCitiesText } from './citySchema';
```

### 5. 문서 업데이트

`docs/TESTING.md` §9.4 는 이미 validateCity / validateAllJson 매트릭스를 담고 있다. 본 step 에서 다음만 확인:

- §9.4 의 "validateAllJson(json)" 항목이 본 step 시그니처와 일치하는지 (불일치 시 §9.4 항목을 본 step 의 시그니처에 맞춰 갱신).
- 새 fixture 항목을 §7.3 (fixture 카탈로그) 에 추가: `src/__fixtures__/cities/{seoul-valid, vancouver-valid}.ts` — "schema 통과 도시 객체 빌더, citySchema 테스트 + 통합 smoke 에서 사용".

ADR 추가 불필요 (자체 검증은 ADR-005 의 정신을 따르는 구현 디테일).

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test -- src/lib/__tests__/citySchema.test.ts src/lib/__tests__/errors.test.ts
```

- typecheck / lint 통과
- citySchema.test.ts 의 모든 케이스 통과 (대략 30+ 케이스)
- errors.test.ts (step 0) 도 여전히 통과 (회귀 없음)
- 새 파일: `src/lib/citySchema.ts`, `src/lib/__tests__/citySchema.test.ts`, `src/__fixtures__/cities/seoul-valid.ts`, `src/__fixtures__/cities/vancouver-valid.ts`
- 수정 파일: `src/lib/index.ts` (export 추가만), `docs/TESTING.md` §7.3 (fixture 항목 추가) — 그 외 변경 없음

## 검증 절차

1. AC 명령 실행
2. **체크리스트:**
   - DATA.md §2 의 필수 필드가 모두 검증되는가? (id, name.ko, name.en, country, currency, region, lastUpdated, rent, food, transport, sources)
   - 모든 throw 가 `CitySchemaError` 또는 `CityParseError` 인가? (다른 종류의 Error 절대 금지)
   - 메시지에 어느 필드가 문제인지 항상 포함되는가? (디버깅성)
   - `schemaVersion: 2` 같은 미래 버전 입력에 대해 명시적으로 throw 하는가? (silent ignore 금지)
   - `any` 가 등장하지 않는가? (`grep -n ": any\b" src/lib/citySchema.ts` 0건)
3. `phases/data-layer/index.json` step 1 업데이트:
   - 성공 → `"summary": "validateCity / validateAllJson / parseAllCitiesText. DATA.md §2 필수 필드 + 타입 + 값 sanity 검증, CitySchemaError/CityParseError 명시. fixture 2종(seoul, vancouver) 신규."`

## 금지사항

- **외부 schema 라이브러리(zod, io-ts, yup 등) 추가 금지.** 이유: ADR 없이 dep 추가 금지 (CLAUDE.md). 자체 검증으로 충분 (필드 수가 한정적).
- **자동 정규화 (trim/lowercase 등) 금지.** 이유: 입력 정규화는 별 단계의 책임 (currency.ts 가 통화 코드 정규화 담당). schema 검증은 "있는 그대로 검증" 만.
- **`silent fail` 금지.** 이유: CLAUDE.md CRITICAL. "추가 필드 무시" 와 "필수 필드 결측 무시" 는 다르다 — 후자는 반드시 throw.
- **시드 JSON 파일을 만들지 마라.** 이유: step 2 의 책임. 본 step 의 fixture 는 ts 파일 (`src/__fixtures__/cities/*.ts`).
- **fetch 코드를 만들지 마라.** 이유: step 3, 4 의 책임.
- **에러 클래스를 새로 만들지 마라.** 이유: step 0 의 카탈로그가 단일 출처. 본 step 은 그것을 import 만.
- 기존 테스트 깨뜨리지 마라.
