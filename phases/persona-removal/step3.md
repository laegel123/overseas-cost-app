# Step 3: home-totals

Home 화면 안에 있는 도시 총비용/배수 계산 함수를 공유 lib 로 추출한다. 다음 step 의 새 온보딩 화면이 동일 계산으로 도시 배수를 표시할 수 있게 하려는 것(중복 제거 — ADR-056 단일 출처 보강). **순수 추출 — 로직 변경 없음.**

## 읽어야 할 파일

- `docs/plans/persona-removal-city-onboarding.md` §B("도시 배수(mult) 표시")
- `app/(tabs)/index.tsx` — 53~85줄: 상수 `FOOD_RESTAURANT_DAYS_PER_MONTH`(=20)·`FOOD_GROCERY_TRIPS_PER_MONTH`(=4), 함수 `computeCityTotal(city, fx)`·`multFromTotals(city, seoulTotal, fx)`. 26~32줄 import(`convertToKRW`, `computeMultiplier` 출처).
- `src/lib/index.ts` — 배럴.
- `src/lib/__tests__/currency.test.ts` — 순수 함수 테스트 예시 + fixture.

## 작업

### 1. `src/lib/homeTotals.ts` 신규 (그대로 이동)

`app/(tabs)/index.tsx` 의 아래 요소를 **로직 변경 없이** 이동:

- 상수 `FOOD_RESTAURANT_DAYS_PER_MONTH = 20`, `FOOD_GROCERY_TRIPS_PER_MONTH = 4`.
- `export function computeCityTotal(city: CityCostData, fx: ExchangeRates): number`.
- `export function multFromTotals(city: CityCostData, seoulTotal: number, fx: ExchangeRates): number | '신규'`.
- 의존(`convertToKRW`, `computeMultiplier`)은 `@/lib` 또는 해당 모듈 상대 경로에서 import. 기존 주석(ADR-056 근사값 설명, groceries 4종·ramen 제외)을 함께 옮긴다.

### 2. `src/lib/index.ts` — 배럴 export 추가

`export { computeCityTotal, multFromTotals } from './homeTotals'`.

### 3. `app/(tabs)/index.tsx` — 로컬 정의 제거 후 import 교체

- 53~85줄 로컬 상수/함수 삭제.
- `@/lib` import 목록에 `computeCityTotal, multFromTotals` 추가(index.tsx 가 쓰는 이름 유지). 사용처(호출)는 무변경.

### 4. 테스트

- `src/lib/__tests__/homeTotals.test.ts` 신규 — `computeCityTotal`(rent/food/transport 합산, groceries 4종·ramen 제외 확인), `multFromTotals`(seoulTotal 대비 배수, `'신규'` 케이스) 순수 함수 검증. city/fx fixture 는 기존 테스트 fixture 재사용.
- `app/(tabs)/__tests__/index.test.tsx`: 추출로 import 가 바뀌면 반영. 동작 무변경이라 대부분 그대로.

### 5. 인벤토리

`docs/TESTING.md` §7 에 homeTotals lib 항목 신규 추가.

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
npx jest src/lib/__tests__/homeTotals.test.ts
```

## 검증 절차

1. AC 통과.
2. 체크:
   - `homeTotals.ts` 의 계산이 원본과 동일한가(로직 변경 0)?
   - `index.tsx` 가 더 이상 로컬 `computeCityTotal` 을 정의하지 않고 `@/lib` 에서 import 하는가?
   - §7 인벤토리에 homeTotals 가 추가됐는가?
3. `phases/persona-removal/index.json` step 3 → `completed`, summary 에 "src/lib/homeTotals.ts export: computeCityTotal, multFromTotals (다음 step 온보딩 화면이 재사용)" 기록.

## 금지사항

- 계산 로직을 "개선" 하지 마라. 이유: 순수 추출 step. 동작 변화 = Home 배수 표시 회귀.
- Compare 화면의 정밀 계산(별도 함수)과 혼동/통합하지 마라. 이유: ADR-056 — Home 근사값과 Compare 정밀값은 의도적으로 다르다.
- 기존 테스트를 깨뜨리지 마라.
