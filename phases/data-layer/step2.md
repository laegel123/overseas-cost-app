# Step 2: seed-all-json

## 읽어야 할 파일

- `CLAUDE.md` — **CRITICAL** ("데이터는 공공 출처에서 자동으로만 갱신", "Numbeo·Expatistan 등 상업 플랫폼 사용 금지", "출처 미기재 데이터 추가 금지")
- `docs/DATA.md` §2 (스키마 — step 1 의 검증 통과 필수)
- `docs/DATA.md` §3.1 (사용 가능한 출처) + §3.2 (사용 금지)
- `docs/DATA.md` §3.3 (출처 표기 의무)
- `docs/DATA.md` §6.1 (`all.json` batch 형식)
- `docs/DATA.md` §11 (데이터 정의 표준 — 월세 메디안·시내 기준, 외식 평일 정식, 식재료 일반 슈퍼)
- `docs/DATA_SOURCES.md` — **21개 도시 × 카테고리별 공공 출처 매핑** (서울 + 밴쿠버 항목 정독)
- `docs/PRD.md` 부록 C ("한 달 예상 총비용" 계산 정의 — 어느 필드가 합계에 들어가는지)
- step 0 결과: `src/types/city.ts`
- step 1 결과: `src/lib/citySchema.ts` (`parseAllCitiesText`, `validateAllJson`)

## 작업

이 step 은 **앱 번들 시드 + 출처 색인** 만 만든다. fetch / 캐시 / 환율은 손대지 않는다 (step 3, 4 의 책임).

### 1. `data/seed/all.json` 신규 작성

다음 형식으로 정확히. (DATA.md §6.1 형식 + step 1 의 `validateAllJson` 통과 필요.)

```json
{
  "schemaVersion": 1,
  "generatedAt": "<현재 ISO datetime, 예: 2026-04-29T00:00:00+09:00>",
  "fxBaseDate": "2026-04-01",
  "cities": {
    "seoul": { /* CityCostData — 아래 §2 의 서울 채집 결과 */ },
    "vancouver": { /* CityCostData — 아래 §3 의 밴쿠버 채집 결과 */ }
  }
}
```

**v1.0 시드는 서울 + 밴쿠버 2개만.** 나머지 19개 도시(`docs/DATA_SOURCES.md` 의 다른 entries)는 GitHub raw 의 live `data/all.json` 을 통해서만 제공되며, 시드에 포함시키지 않는다 (이 phase 의 범위가 아님).

### 2. 서울 채집 (필수 카테고리)

`docs/DATA_SOURCES.md` 의 서울 섹션에 적힌 출처 URL 만 사용. 그 외 임의 출처 금지 (CLAUDE.md CRITICAL).

각 데이터 포인트에 대해:

1. `WebFetch` 로 출처 페이지를 가져온다.
2. DATA.md §11 의 "정의" 와 일치하는 값을 추출한다 (월세 = 시내 메디안, 외식 = 평일 점심 정식, 식재료 = 일반 슈퍼 정상가, etc.).
3. 추출한 값과 출처 URL·접속일을 `sources[]` 에 1대1 매핑한다.

**서울 필드 채집 가이드:**

| 필드                      | 출처 (DATA_SOURCES.md 따름)                                       | 정의                                                          |
| ------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| `rent.share/studio/oneBed/twoBed` | KOSIS (한국통계청) 또는 SH공사·국토부 실거래가 공시 | 월세, KRW                                                     |
| `food.restaurantMeal`     | KOSIS 외식물가지수 (일반음식점 한식 평균)                         | 평일 점심 정식 1인, 음료 별도, KRW                            |
| `food.cafe`               | KOSIS 또는 스타벅스코리아 공식 가격표                             | 카페라떼 grande (350ml) — 없으면 동등 로컬 체인 명시          |
| `food.groceries.*`        | KOSIS 신선식품·가공식품 소비자물가지수                            | DATA.md §11.3 기준 (일반 브랜드, 정상가, 비유기농)            |
| `transport.monthlyPass`   | 서울교통공사·서울시 공식 (지하철+버스 통합권) 공시                | 정기권 1개월, KRW                                             |
| `transport.singleRide`    | 동일 출처                                                         | 1회권 KRW                                                     |
| `transport.taxiBase`      | 서울시 택시 기본요금 공시                                         | 기본거리 기본요금 KRW                                         |
| `tuition[]`               | (서울 = 본국 도시. 학비는 destination 도시에서만 의미 있음.)      | **빈 배열 `[]`** 또는 키 자체 생략. 본 step 에서는 빈 배열로. |
| `tax[]`                   | (동일.)                                                           | **빈 배열 `[]`** 또는 키 자체 생략. 본 step 에서는 빈 배열로. |
| `visa`                    | (서울 = 본국. 비자 미적용.)                                       | **키 자체 생략**.                                             |

**서울 메타:**

```json
{
  "id": "seoul",
  "name": { "ko": "서울", "en": "Seoul" },
  "country": "KR",
  "currency": "KRW",
  "region": "asia",
  "lastUpdated": "<오늘 날짜 YYYY-MM-DD>",
  "rent": { ... },
  "food": { ... },
  "transport": { ... },
  "tuition": [],
  "tax": [],
  "sources": [
    { "category": "rent", "name": "KOSIS 주택가격동향", "url": "<실URL>", "accessedAt": "<오늘>" },
    { "category": "food", "name": "KOSIS 소비자물가조사", "url": "<실URL>", "accessedAt": "<오늘>" },
    { "category": "transport", "name": "서울교통공사 운임", "url": "<실URL>", "accessedAt": "<오늘>" }
    // 카테고리당 최소 1개
  ]
}
```

### 3. 밴쿠버 채집

`docs/DATA_SOURCES.md` 의 밴쿠버 섹션 출처만 사용.

| 필드                      | 출처                                                                | 비고                                                |
| ------------------------- | ------------------------------------------------------------------- | --------------------------------------------------- |
| `rent.*`                  | CMHC (Canada Mortgage and Housing Corporation) Rental Market Survey | Vancouver CMA 평균/메디안. CAD                      |
| `food.*`                  | Statistics Canada Consumer Price Index (Vancouver)                  | CAD                                                 |
| `transport.*`             | TransLink 공식 fare 페이지                                          | Compass card 1-zone 기준 CAD                        |
| `tuition[]`               | UBC 공식 international tuition 페이지 (학사 1개)                    | undergrad annual CAD. 1개 학교만                    |
| `tax[]`                   | CRA (Canada Revenue Agency) 공식 income tax 페이지                  | annualSalary 60000 CAD 1개 (가정 단순화)            |
| `visa`                    | IRCC (Immigration, Refugees and Citizenship Canada) 공식            | studentApplicationFee 만 채움 (work/settlement 선택) |

**밴쿠버 메타:**

```json
{
  "id": "vancouver",
  "name": { "ko": "밴쿠버", "en": "Vancouver" },
  "country": "CA",
  "currency": "CAD",
  "region": "na",
  "lastUpdated": "<오늘 YYYY-MM-DD>",
  "rent": { ... },
  "food": { ... },
  "transport": { ... },
  "tuition": [{ "school": "UBC", "level": "undergrad", "annual": <실값> }],
  "tax": [{ "annualSalary": 60000, "takeHomePctApprox": <0.0~1.0> }],
  "visa": { "studentApplicationFee": <실값> },
  "sources": [
    { "category": "rent", "name": "CMHC Rental Market Survey", "url": "<실URL>", "accessedAt": "<오늘>" },
    { "category": "food", "name": "Statistics Canada CPI - Vancouver", "url": "<실URL>", "accessedAt": "<오늘>" },
    { "category": "transport", "name": "TransLink Fares", "url": "<실URL>", "accessedAt": "<오늘>" },
    { "category": "tuition", "name": "UBC International Tuition", "url": "<실URL>", "accessedAt": "<오늘>" },
    { "category": "tax", "name": "CRA Income Tax", "url": "<실URL>", "accessedAt": "<오늘>" },
    { "category": "visa", "name": "IRCC Study Permit Fees", "url": "<실URL>", "accessedAt": "<오늘>" }
  ]
}
```

### 4. 채집 시 행동 강령

- **공공 출처 외 사용 금지.** Numbeo / Expatistan / Mercer / Zillow / Kijiji / Yelp 등 상업 플랫폼은 보지도, URL 도 적지 않는다 (CLAUDE.md CRITICAL + DATA.md §3.2).
- **값 추정·짐작 금지.** WebFetch 결과로 정확한 숫자를 얻지 못하면 해당 필드를 **null** 로 두거나 (rent 필드는 nullable), `tuition`/`tax`/`visa` 는 빈 배열·키 생략으로 처리. 절대 임의 값 박지 않는다 (CLAUDE.md CRITICAL "출처 미기재 데이터 추가 금지").
- **출처 페이지 접속 실패 시:** WebFetch 가 5xx/타임아웃이면 1회 재시도. 그래도 실패하면 그 카테고리 필드를 nullable 로 두고, `sources[]` 에 해당 카테고리 entry 자체를 넣지 않는다 (출처 없는 데이터는 추가 금지). 그러면 데이터도 누락이어야 일관됨.
- **DATA_SOURCES.md 에 해당 도시·카테고리 entry 가 없거나 비어있다면 step 을 `blocked` 처리.** 이유: CLAUDE.md CRITICAL 이 정한 출처 정책의 단일 출처가 비어있는 상태에서 임의 출처를 추가하는 것은 ADR-005 위반.
- **메모리 단위 통일:** 모든 값은 **현지통화** (서울=KRW, 밴쿠버=CAD). 환율 변환은 currency.ts (step 3) 의 책임.

### 5. `data/sources.md` 신규 작성

DATA.md §1 의 "출처 색인" 역할. 본 step 에서는 서울 + 밴쿠버 entry 만 작성 (나머지 19개 도시는 후속 데이터 phase 의 책임).

형식 (markdown):

```markdown
# 출처 색인

`data/seed/all.json` 및 (장차) `data/cities/*.json` 의 모든 데이터 포인트가 어느 공공 출처에서 왔는지 색인한다. 본 색인에 등재된 출처만 사용 가능 (CLAUDE.md CRITICAL · DATA.md §3.2).

## 서울 (KR)

| 카테고리   | 출처                            | URL                | 마지막 접속 |
| ---------- | ------------------------------- | ------------------ | ----------- |
| rent       | KOSIS 주택가격동향              | <URL>              | <date>      |
| food       | KOSIS 소비자물가조사            | <URL>              | <date>      |
| transport  | 서울교통공사 운임 / 서울시 택시 | <URL>              | <date>      |

## 밴쿠버 (CA)

| 카테고리   | 출처                              | URL                | 마지막 접속 |
| ---------- | --------------------------------- | ------------------ | ----------- |
| rent       | CMHC Rental Market Survey         | <URL>              | <date>      |
| food       | Statistics Canada CPI - Vancouver | <URL>              | <date>      |
| transport  | TransLink Fares                   | <URL>              | <date>      |
| tuition    | UBC International Tuition         | <URL>              | <date>      |
| tax        | CRA Income Tax                    | <URL>              | <date>      |
| visa       | IRCC Study Permit Fees            | <URL>              | <date>      |
```

`docs/DATA_SOURCES.md` (전략 매핑) 와 별개. `data/sources.md` 는 *현재 데이터의 실제 출처 인스턴스* 색인. 분기 갱신마다 본 파일이 업데이트된다.

### 6. Schema 통과 테스트

`src/__fixtures__/seed-roundtrip.test.ts` 신규 작성:

```ts
import { parseAllCitiesText, validateAllJson } from '@/lib/citySchema';
import seedJson from '../../data/seed/all.json';

describe('data/seed/all.json', () => {
  it('schemaVersion === 1', () => {
    expect(seedJson.schemaVersion).toBe(1);
  });
  it('서울 + 밴쿠버 포함', () => {
    expect(Object.keys(seedJson.cities).sort()).toEqual(['seoul', 'vancouver']);
  });
  it('validateAllJson 통과 (모든 필드 schema 만족)', () => {
    expect(() => validateAllJson(seedJson)).not.toThrow();
  });
  it('parseAllCitiesText 통과 (텍스트 round-trip)', () => {
    const text = JSON.stringify(seedJson);
    expect(() => parseAllCitiesText(text)).not.toThrow();
  });
  it('서울 모든 카테고리에 대응 sources entry 가 존재', () => {
    const seoul = seedJson.cities.seoul;
    const cats = new Set(seoul.sources.map((s: { category: string }) => s.category));
    expect(cats.has('rent') && cats.has('food') && cats.has('transport')).toBe(true);
  });
  it('밴쿠버 모든 채집 카테고리에 대응 sources entry 가 존재', () => {
    const v = seedJson.cities.vancouver;
    const cats = new Set(v.sources.map((s: { category: string }) => s.category));
    expect(cats.has('rent') && cats.has('food') && cats.has('transport')).toBe(true);
    // tuition/tax/visa 는 채집 성공 여부에 따라 선택적
  });
});
```

`tsconfig.json` 의 `resolveJsonModule: true` 가 이미 켜져 있으므로 (bootstrap step 0 산출) `import seedJson from ...` 이 동작한다.

### 7. ADR

새 ADR 추가: **ADR-N: v1.0 시드 도시는 서울 + 밴쿠버 2개만**. 짧게:

- 결정: `data/seed/all.json` 은 서울 + 밴쿠버 2개만 포함. 나머지 19개는 런타임 fetch 만.
- 이유: (1) 본 출시자(개발자)의 개인 연결 도시(밴쿠버 유학 경험 — PRD §2 배경). (2) 시드 크기 통제 (도시 ≤2개로 ~10KB 수준). (3) 첫 사용자가 네트워크 없을 때도 최소 1:1 비교(서울 vs 밴쿠버) 동작 보장.
- 결과: 19개 도시 첫 진입은 GitHub raw fetch 필요. 실패 시 ErrorView (CitiesUnavailableError 가 아닌 partial — 시드 2개는 로드, 나머지는 ErrorView).

`docs/ADR.md` 의 마지막에 추가 (기존 ADR 번호의 다음 번호 사용 — `grep -E "^## ADR-[0-9]+" docs/ADR.md | tail -1` 으로 확인).

### 8. TESTING.md 인벤토리 항목 추가

`docs/TESTING.md` §7.3 (fixture 카탈로그) 에 다음 추가:

```
- `data/seed/all.json` — 시드 batch (서울 + 밴쿠버). step 2 의 schema 통과 테스트, 추후 통합 smoke (loadAllCities 시드 fallback) 에서 사용.
- `src/__fixtures__/seed-roundtrip.test.ts` — 시드 round-trip 검증 (schema, 카테고리 ↔ sources 매핑).
```

§9.4 의 "시드" 관련 항목이 비어있다면 동일하게 채워둔다.

## Acceptance Criteria

```bash
npm run typecheck \
  && npm run lint \
  && npm test -- src/__fixtures__/seed-roundtrip.test.ts src/lib/__tests__/citySchema.test.ts src/lib/__tests__/errors.test.ts \
  && python3 -c "import json; d=json.load(open('data/seed/all.json')); assert d['schemaVersion']==1 and set(d['cities'].keys())=={'seoul','vancouver'}"
```

- `data/seed/all.json` 존재 + schemaVersion=1 + cities = {seoul, vancouver}
- `data/sources.md` 존재 + 서울/밴쿠버 entry
- 모든 테스트 통과 (회귀 없음)
- `docs/ADR.md` 에 ADR-N 추가
- `docs/TESTING.md` §7.3 에 시드 fixture 항목 추가
- `git diff --stat` 에 위 4개 파일 + 신규 테스트 파일만 등장

## 검증 절차

1. AC 명령 실행
2. **데이터 정합성 체크리스트:**
   - 모든 데이터 포인트가 `sources[]` 에 카테고리 매핑 출처를 가지는가?
   - 출처 URL 이 모두 정부 통계청·공식 정부 페이지·공식 교통공사·공식 대학 페이지인가? (Numbeo·Zillow·Kijiji 등 상업 0건)
   - 단위가 모두 현지통화인가? (서울=KRW, 밴쿠버=CAD — KRW 변환 흔적이 있으면 위반)
   - `lastUpdated` 가 오늘 날짜인가?
   - `accessedAt` 이 오늘 날짜인가?
   - 시드의 환율 가정 흔적이 없는가? (환율은 step 3 이후 currency.ts 의 책임)
3. `phases/data-layer/index.json` step 2 업데이트:
   - 성공 → `"summary": "data/seed/all.json (서울+밴쿠버, 공공 출처 매핑) + data/sources.md + ADR-N (시드 2도시 정책). seed-roundtrip 테스트 통과."`
   - 임의 값 채집 필요 → `"status": "blocked"`, `"blocked_reason": "<도시>·<카테고리>: DATA_SOURCES.md 매핑 entry 부재 또는 출처 페이지 접속 실패. 사용자 결정 필요."`

## 금지사항

- **상업 플랫폼 (Numbeo, Expatistan, Mercer, Zillow, Kijiji, Yelp 등) URL 을 `data/seed/all.json` 또는 `data/sources.md` 에 적지 마라.** 이유: CLAUDE.md CRITICAL + DATA.md §3.2. 약관 위반 + ADR-005 위반.
- **값 추정·짐작·임의 입력 금지.** 이유: CLAUDE.md "출처 미기재 데이터 추가 금지". 출처를 못 찾으면 nullable 로 두거나 step 을 `blocked` 처리.
- **현지통화 외 단위 (KRW 환산값 등) 금지.** 이유: 환율 변환은 currency.ts 의 책임 (step 3). 시드는 raw 값만.
- **나머지 19개 도시 추가 금지.** 이유: ADR-N (이 step 에서 추가) 가 시드 = 서울 + 밴쿠버 2개로 못박는다. 19개는 런타임 fetch 만.
- **`scripts/build_data.mjs` 자동화 스크립트 만들지 마라.** 이유: DATA.md §6.2 에 명시되지만 본 phase 의 범위가 아니다. 별도 automation phase.
- **환율 fetch 코드, data.ts loader 만들지 마라.** 이유: step 3, 4 의 책임.
- 기존 테스트 깨뜨리지 마라.
