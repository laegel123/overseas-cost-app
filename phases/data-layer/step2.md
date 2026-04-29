# Step 2: seed-fixture-adoption (revised)

## 배경 (왜 명세가 바뀌었나)

원래 step 2 는 WebFetch 로 정부 공공 출처에서 직접 채집해 `data/seed/all.json` 을 만들 계획이었으나, **모든 핵심 출처가 WebFetch 로 접근 불가** (KOSIS/한국소비자원 = `KR_DATA_API_KEY` 필수, CMHC RMR/StatsCan CPI = Excel·CSV only, 서울교통공사·BC PT·CRA = cert error/403/SAML redirect) — schema 30 필드 중 5개만 추출 가능. CLAUDE.md CRITICAL 가 추정·임의 입력을 금지하므로 step 이 의도된 `blocked` 처리.

사용자 결정: **옵션 C 채택** — step 1 에서 만든 schema-pass fixture (`src/__fixtures__/cities/{seoul,vancouver}-valid.ts`) 를 v1.0 시드로 그대로 사용한다. 실 데이터 수집은 `docs/AUTOMATION.md` 의 자동화 phase 책임 (ADR-032). 본 phase 는 **데이터 레이어 구조 검증** 이 목표.

## 읽어야 할 파일

- `CLAUDE.md` — 출처·자동화 정책 (ADR-032)
- `docs/DATA.md` §6.1 (`all.json` batch 형식)
- `docs/ARCHITECTURE.md` §캐시·오프라인 전략 (시드의 역할)
- step 0 결과: `src/types/city.ts` (`AllCitiesData`)
- step 1 결과:
  - `src/lib/citySchema.ts` (`parseAllCitiesText`, `validateAllJson`)
  - `src/__fixtures__/cities/seoul-valid.ts` — 서울 schema-pass fixture
  - `src/__fixtures__/cities/vancouver-valid.ts` — 밴쿠버 schema-pass fixture

## 작업

이 step 은 **step 1 의 fixture 를 시드로 옮기고 + ADR 로 한시성 명시 + schema 통과 테스트** 만 한다. 실 데이터 채집은 **하지 않는다** — 자동화 phase 의 책임.

### 1. `data/seed/all.json` 신규 작성

`src/__fixtures__/cities/seoul-valid.ts` 의 `seoulValid` 와 `src/__fixtures__/cities/vancouver-valid.ts` 의 `vancouverValid` 객체를 JSON 으로 직렬화하여 다음 wrapper 에 넣는다:

```json
{
  "schemaVersion": 1,
  "generatedAt": "<오늘 ISO datetime, KST timezone, 예: 2026-04-29T10:30:00+09:00>",
  "fxBaseDate": "2026-04-01",
  "cities": {
    "seoul":     { /* seoulValid 객체 그대로 */ },
    "vancouver": { /* vancouverValid 객체 그대로 */ }
  }
}
```

**규칙:**

- fixture 의 모든 필드 (모든 카테고리, sources 배열 포함) 를 1:1 그대로 옮긴다 — 값을 바꾸지도, 추가하지도, 빼지도 않는다.
- JSON 직렬화 시 인덱싱 + 들여쓰기 2-space. 마지막 newline 1개.
- fixture 의 `lastUpdated` 와 `accessedAt` (`2026-04-01`) 도 그대로. **오늘 날짜로 갱신하지 않는다** — 이 시드는 fixture 출처 (step 1 작성 시점) 라는 사실이 데이터에 인코딩돼 있어야 자동화 phase 가 "이건 fixture seed 다, 덮어써야 한다" 를 구분할 수 있다.

### 2. `data/sources.md` 신규 작성

fixture 의 `sources` 배열에서 추출한 URL 인덱스. 형식:

```markdown
# 출처 색인

`data/seed/all.json` 및 (장차) 자동화 산출 `data/all.json` 의 모든 데이터 포인트가 어느 공공 출처에서 왔는지 색인한다. 본 색인에 등재된 출처만 사용 가능 (CLAUDE.md CRITICAL · DATA.md §3.2).

> **v1.0 시드 주의:** 현재 `data/seed/all.json` 은 schema-pass fixture (실값 미검증) 다. ADR-N 참조. 실 데이터는 자동화 phase 산출물이 GitHub raw 로 호스팅되며, 분기 갱신 시 본 색인이 함께 갱신된다.

## 서울 (KR)

| 카테고리   | 출처                  | URL                              | 마지막 접속 |
| ---------- | --------------------- | -------------------------------- | ----------- |
| rent       | 국토교통부 실거래가   | https://rt.molit.go.kr/          | 2026-04-01  |
| food       | 한국소비자원 참가격   | https://www.price.go.kr/         | 2026-04-01  |
| transport  | 서울교통공사          | http://www.seoulmetro.co.kr/     | 2026-04-01  |

## 밴쿠버 (CA)

| 카테고리   | 출처                              | URL                                                       | 마지막 접속 |
| ---------- | --------------------------------- | --------------------------------------------------------- | ----------- |
| rent       | CMHC Rental Market Survey         | https://www03.cmhc-schl.gc.ca/hmip-pimh/en/               | 2026-04-01  |
| food       | Statistics Canada CPI             | https://www150.statcan.gc.ca/                             | 2026-04-01  |
| transport  | TransLink                         | https://www.translink.ca/transit-fares                    | 2026-04-01  |
| tuition    | UBC International Tuition         | https://you.ubc.ca/financial-planning/cost/               | 2026-04-01  |
| tax        | Canada Revenue Agency             | https://www.canada.ca/en/revenue-agency.html              | 2026-04-01  |
| visa       | IRCC                              | https://www.canada.ca/en/immigration-refugees-citizenship.html | 2026-04-01 |
```

URL 은 fixture (`seoul-valid.ts`, `vancouver-valid.ts`) 의 `sources` 배열에서 그대로 가져온다.

### 3. ADR 추가 (가장 중요)

`docs/ADR.md` 의 마지막에 다음 ADR 추가 (번호는 `grep -E "^## ADR-[0-9]+" docs/ADR.md | tail -1` 의 다음 번호):

```markdown
## ADR-N: v1.0 시드 = schema-pass fixture (한시적)

**상태:** 채택 (2026-04-29)

**맥락:**

- v1.0 데이터 레이어는 ARCHITECTURE.md §캐시·오프라인 전략 에 따라 네트워크 실패 시 번들 시드로 fallback 해야 한다.
- ADR-032 가 정한 데이터 정책: 모든 도시 값은 정부 통계 API · 공식 정부 페이지 등 **공공 출처에서 자동으로만** 갱신, 수동 큐레이션 금지.
- 자동화 phase (`docs/AUTOMATION.md`) 가 GitHub Actions cron + `scripts/refresh/<source>.mjs` 로 `data/all.json` 을 산출하지만, 이 phase 는 본 data-layer phase 보다 **늦게** 구현된다.
- 그 사이 시드 파일이 비어 있으면: (a) 첫 실행 + 네트워크 없음 = 빈 화면, (b) ARCHITECTURE 의 시드 fallback 명세 위반.

**결정:**

1. v1.0 의 `data/seed/all.json` 은 step 1 에서 만든 schema-pass fixture (`src/__fixtures__/cities/{seoul,vancouver}-valid.ts`) 의 값을 **그대로** 사용한다.
2. fixture 값들은 schema 를 통과하고 차원적으로 현실적이지만 (서울 원룸 90만, 밴쿠버 oneBed 2300 CAD 등), **실제 출처 페이지로 검증되지 않은 placeholder** 다.
3. 출시 전 자동화 phase 가 1회 이상 실행되어 `data/all.json` 을 생성해야 한다. EAS 빌드 직전 게이트 (별도 phase) 가 이를 강제한다 — fixture 시드 상태로 production 빌드 금지.
4. 자동화 phase 가 산출한 실 `all.json` 이 GitHub raw 로 배포되면, 사용자 앱은 24h 내 자동 fetch 로 fixture 시드 위에 실 데이터를 덮어쓴다. 시드는 *완전 오프라인 신규 사용자* 에게만 노출된다.

**대안 검토:**

- (A) `KR_DATA_API_KEY` (data.go.kr 공공데이터포털 키) 발급 + step 2 가 직접 채집: 본 phase 가 외부 secret 에 종속 + 자동화 phase 의 책임과 중복. 거부.
- (B) ADR-032 의 "수동 큐레이션 금지" 를 시드 한정 예외 명시 + 사용자가 PDF·Excel 리포트 손수 옮김: 분기 갱신마다 사람 시간 ~3시간, 드리프트 위험. 거부.
- (D) 시드 자체 제거, 네트워크 실패 시 ErrorView: ARCHITECTURE.md §캐시·오프라인 전략 위반 + 첫 콜드 스타트 빈 화면. 거부.

**결과 / 영향:**

- 본 phase (data-layer) 의 step 3·4 가 진행 가능 — currency.ts·data.ts 통합 smoke 가 schema-pass payload 로 동작.
- 자동화 phase 의 책임이 더 명확해진다: "출시 전 한 번은 반드시 실행되어야 한다."
- 출시 빌드 게이트 ADR (별도) 에서 *fixture seed 검출 → EAS build 거부* 정책 명시 필요.
- `data/seed/all.json` 의 `lastUpdated` 와 `accessedAt` 는 fixture 작성일 (`2026-04-01`) 그대로 — 자동화가 덮어쓸 때 갱신.
- 사용자에게 **노출되는 데이터에는 영향이 없어야 한다** (출시 전 실 데이터로 교체).
- `src/lib/data.ts` (step 4) 가 시드 fallback 시 dev 콘솔에 명시적 warn 출력 — fixture 사용 가시성 확보.

**관련:** ADR-032 (데이터 자동화 정책), `docs/AUTOMATION.md`.
```

### 4. Schema 통과 테스트

`src/__fixtures__/seed-roundtrip.test.ts` 신규 작성:

```ts
import { parseAllCitiesText, validateAllJson } from '@/lib/citySchema';
import seedJson from '../../data/seed/all.json';

describe('data/seed/all.json (fixture-based seed, ADR-N)', () => {
  it('schemaVersion === 1', () => {
    expect(seedJson.schemaVersion).toBe(1);
  });
  it('서울 + 밴쿠버 만 포함 (v1.0 시드 = 2도시)', () => {
    expect(Object.keys(seedJson.cities).sort()).toEqual(['seoul', 'vancouver']);
  });
  it('validateAllJson 통과', () => {
    expect(() => validateAllJson(seedJson)).not.toThrow();
  });
  it('parseAllCitiesText 통과 (텍스트 round-trip)', () => {
    expect(() => parseAllCitiesText(JSON.stringify(seedJson))).not.toThrow();
  });
  it('서울 모든 채집 카테고리에 대응 sources entry', () => {
    const cats = new Set(seedJson.cities.seoul.sources.map((s: { category: string }) => s.category));
    expect(cats.has('rent') && cats.has('food') && cats.has('transport')).toBe(true);
  });
  it('밴쿠버 모든 채집 카테고리에 대응 sources entry', () => {
    const cats = new Set(seedJson.cities.vancouver.sources.map((s: { category: string }) => s.category));
    expect(cats.has('rent') && cats.has('food') && cats.has('transport')).toBe(true);
    expect(cats.has('tuition') && cats.has('tax') && cats.has('visa')).toBe(true);
  });
  it('fixture 와 시드 값이 일치 (drift 방지)', () => {
    // step 1 fixture 와 step 2 시드는 본 step 시점에 동일 값. 향후 둘이 갈라질 수 있음 — 그게 정상 (fixture = 테스트 frozen, seed = 자동화가 덮어씀).
    // 단 본 step 직후에는 동일해야 한다.
    const { seoulValid } = require('../__fixtures__/cities/seoul-valid');
    const { vancouverValid } = require('../__fixtures__/cities/vancouver-valid');
    expect(seedJson.cities.seoul).toEqual(seoulValid);
    expect(seedJson.cities.vancouver).toEqual(vancouverValid);
  });
});
```

### 5. TESTING.md 인벤토리

`docs/TESTING.md` §7.3 (fixture 카탈로그) 에 추가:

```
- `data/seed/all.json` — v1.0 시드 (서울+밴쿠버, schema-pass fixture 기반, ADR-N). 자동화 phase 산출물이 GitHub raw 로 배포되면 24h 내 덮어써짐.
- `src/__fixtures__/seed-roundtrip.test.ts` — 시드 round-trip + fixture↔seed drift 검증.
```

### 6. README / DATA.md 갱신 (작은 한 줄)

`docs/DATA.md` §1 표의 "시드 데이터" 항목 비고에 다음 한 줄 추가:

```
| 시드 데이터 (오프라인 fallback) | `data/seed/all.json` (앱 번들) | v1.0 = fixture 기반 (ADR-N), 자동화 phase 가 덮어씀 | 동일 |
```

다른 라인은 손대지 않는다.

## Acceptance Criteria

```bash
npm run typecheck \
  && npm run lint \
  && npm test -- src/__fixtures__/seed-roundtrip.test.ts src/lib/__tests__/citySchema.test.ts src/lib/__tests__/errors.test.ts \
  && python3 -c "import json; d=json.load(open('data/seed/all.json')); assert d['schemaVersion']==1 and set(d['cities'].keys())=={'seoul','vancouver'}"
```

- `data/seed/all.json` 존재 + schema 통과 + cities = {seoul, vancouver}
- `data/sources.md` 존재 + 두 도시 entry
- `docs/ADR.md` 에 ADR-N (시드 fixture 정책) 추가
- `docs/TESTING.md` §7.3 에 두 항목 추가
- `docs/DATA.md` §1 표에 비고 한 줄 추가
- 모든 기존 테스트 회귀 없음 (totals 가 step 1 종료 시점 + 본 step 신규만큼 늘어남)
- `git diff --stat` 에 위 5개 파일 + 신규 테스트 파일만 등장

## 검증 절차

1. AC 명령 실행
2. **체크리스트:**
   - `data/seed/all.json` 의 `cities.seoul` 가 `seoulValid` fixture 와 정확히 일치하는가? (drift 검증 테스트가 강제)
   - `data/seed/all.json` 의 `cities.vancouver` 가 `vancouverValid` fixture 와 정확히 일치하는가?
   - `lastUpdated` / `accessedAt` 가 fixture 의 `2026-04-01` 그대로인가? (오늘 날짜로 임의 갱신 금지)
   - `data/sources.md` 의 URL 들이 fixture sources 와 1:1 일치하는가?
   - ADR 본문이 (a) 결정, (b) 대안 A/B/D 거부 사유, (c) 출시 빌드 게이트 권고 를 모두 포함하는가?
3. `phases/data-layer/index.json` step 2 업데이트:
   - 성공 → `"summary": "fixture (seoul-valid + vancouver-valid) 를 data/seed/all.json 으로 채택. ADR-N (시드 한시성 + 자동화 phase 덮어쓰기 책임) + data/sources.md (출처 색인) + seed-roundtrip 테스트 (drift 방지)."`

## 금지사항

- **fixture 값 변경 금지.** 이유: drift 검증 테스트가 강제. 시드 ≠ fixture 가 되면 자동화 phase 의 "fixture 인지" 판정 기준이 흔들린다.
- **WebFetch 로 다시 채집 시도 금지.** 이유: 사용자 결정 (옵션 C) 이 명시적으로 자동화 phase 책임으로 미룬다. 본 step 에서 부분 채집해 fixture 와 섞으면 출처 검증성이 깨진다.
- **`lastUpdated` / `accessedAt` 를 오늘 날짜로 갱신 금지.** 이유: 자동화 phase 가 "fixture seed → 실 데이터 교체" 임을 인식하기 위한 신호 (`2026-04-01` 고정).
- **새 도시 (도쿄·뉴욕 등) 시드 추가 금지.** 이유: ADR-N 이 v1.0 시드 = 서울+밴쿠버 2개로 못박는다. 19개는 런타임 fetch / 자동화 phase 책임.
- **`scripts/build_data.mjs` 자동화 스크립트 작성 금지.** 이유: 자동화 phase 의 책임.
- **에러 클래스 신규 추가 금지.** 이유: step 0 카탈로그 단일 출처.
- **fetch 코드, currency.ts, data.ts 수정 금지.** 이유: step 3, 4 의 책임.
- 기존 테스트 깨뜨리지 마라.
