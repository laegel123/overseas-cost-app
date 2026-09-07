# Step 2: source-registry

## 배경

이 phase(`in-app-policy-pages`)는 데이터 출처·개인정보 처리방침을 외부 브라우저 링크에서 **앱 내부 화면**으로 옮긴다. 이 step 은 새 화면 두 개(`app/sources/index.tsx`, `app/sources/[cityId].tsx`)가 쓸 **집계 lib** 을 만든다. 화면 자체는 step 3·4 에서 만든다.

### 데이터 형태

도시 데이터는 `src/lib/data.ts` 가 메모리에 들고 있다:

```ts
getAllCities(): CitiesMap                  // Record<string, CityCostData>, 미로드 시 빈 객체
getCity(id: string): CityCostData | undefined
```

각 도시의 `sources` 는 `CitySource[]` 다 (`src/types/city.ts`):

```ts
type CitySource = {
  category: SourceCategory;   // 'rent' | 'food' | 'transport' | 'tuition' | 'tax' | 'visa'
  name: string;               // 예: '국토교통부 실거래가 공개시스템'
  url: string;
  accessedAt: string;         // 'YYYY-MM-DD'
};
```

실측 (2026-09 기준, 21개 도시 전량 로드 시):

- 전체 `sources[]` 엔트리 **104개**
- `(name, url)` 조합 기준 unique **46개**
- 서울은 4개(rent 1 / food 2 / transport 1), 해외 20개 도시는 각 5개(rent/food/transport/tuition/visa 각 1)
- **`tax` 카테고리 출처는 21개 도시 모두 0개** — tax 데이터 자체가 v1.0 에 없다 (`docs/UI_GUIDE.md` v1.0 편차표에 기록됨). 빈 그룹 처리가 반드시 필요하다.
- 같은 출처가 여러 도시에 공유된다 (예: `HUD Fair Market Rents …` 는 미국 5개 도시). 그래서 104 ≠ 46.
- 번들 시드(`data/seed/all.json`)만 있는 첫 실행 시에는 서울·밴쿠버 2개 도시뿐이라 unique 는 **10개**다. 이는 "지금 앱이 가진 데이터"를 정확히 반영한 의도된 동작이다 (ADR-071 결정 2).

### 표시 순서 (결정됨)

`/sources` 의 도시 목록은 **서울을 맨 위에 고정**하고, 나머지를 권역 순서 `na → eu → asia → oceania → me` 로 정렬한다. **권역 그룹 헤더는 두지 않는다** — 평평한 목록이며 정렬 순서만 권역을 따른다. 권역 내에서는 도시 한국어 이름(`name.ko`) 가나다순.

권역 순서의 근거는 홈 화면(`app/(tabs)/index.tsx`)의 `REGIONS` 배열 순서다. **홈 화면은 이 phase 에서 수정하지 않는다** (권역 라벨 문자열은 이 화면에 필요 없으므로 공용화 대상이 아니다).

`Region` 타입은 `src/types/city.ts` 에 있다: `'na' | 'eu' | 'asia' | 'oceania' | 'me'`.

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래 목록을 반드시 직접 Read 할 것:

- `docs/ARCHITECTURE.md` — §디렉터리 구조, §data.ts 공개 API, §에러 핸들링 전략·에러 타입 카탈로그
- `docs/ADR.md` (인덱스) — `docs/adr/071-in-app-policy-pages.md` (이 phase 의 결정, step 0 이 작성), `docs/adr/065-source-count-privacy.md` (이 phase 가 부분 supersede 하는 결정)
- `docs/DATA.md` — §2 스키마, §3.3 출처 표기
- `docs/TESTING.md` — §5.4 도시 데이터 모킹 규약, §7 fixture 와 빌더, §9 인벤토리 형식
- `src/types/city.ts` — `CitySource`, `SourceCategory`, `Region`, `CityCostData`, `CitiesMap`
- `src/lib/data.ts` — `getAllCities`, `getCity` (370~380줄 부근)
- `src/lib/categoryMeta.ts` — **step 1 산출물**. `CATEGORY_LABEL`, `CATEGORY_ICON`, `CATEGORY_ORDER`
- `src/lib/index.ts` — 배럴 export 규약
- `src/lib/errors.ts` — 에러 클래스 카탈로그 (`CityNotFoundError` 등)
- `src/lib/__tests__/homeTotals.test.ts` 또는 `src/lib/__tests__/format.test.ts` — lib 테스트 작성 관례
- `src/__fixtures__/cities/seoul-valid.ts`, `vancouver-valid.ts` — `sources[]` 를 포함한 fixture 형태
- `data/cities/seoul.json`, `data/cities/tokyo.json` — 실제 데이터 형태

## 작업

### 1. `src/lib/sources.ts` 신규

```ts
import type { CitySource, SourceCategory } from '@/types/city';

/** 한 도시의 출처 묶음 — `/sources` 목록 화면용. */
export type CitySourceGroup = {
  cityId: string;
  /** 표시용 한국어 도시명 (`city.name.ko`). */
  cityNameKo: string;
  /** 이 도시의 출처 수 (중복 제거 없음 — 도시 안에서는 중복이 없다). */
  count: number;
};

/** 한 카테고리의 출처 묶음 — `/sources/[cityId]` 상세 화면용. */
export type CategorySourceGroup = {
  category: SourceCategory;
  sources: CitySource[];
};

/**
 * 로드된 모든 도시를 표시 순서로 반환.
 * 순서: 서울 고정 → 권역(na, eu, asia, oceania, me) → 권역 내 name.ko 가나다순.
 * 출처가 0개인 도시는 제외한다.
 * 데이터 미로드 시 빈 배열.
 */
export function getCitySourceGroups(): CitySourceGroup[];

/**
 * 로드된 모든 도시에서 `(name, url)` 조합 기준 unique 출처 수.
 * 데이터 미로드 시 0.
 */
export function countUniqueSources(): number;

/**
 * 한 도시의 출처를 카테고리별로 묶어 `CATEGORY_ORDER` 순서로 반환.
 * 출처가 0개인 카테고리 그룹은 결과에 포함하지 않는다 (예: tax 는 항상 제외됨).
 * 카테고리 안에서는 원본 `sources[]` 등장 순서를 유지한다.
 */
export function getCitySourcesByCategory(cityId: string): CategorySourceGroup[];
```

핵심 규칙 (설계 의도에서 벗어나면 안 되는 부분):

- **unique 판정 키는 `(name, url)` 쌍**이다. `url` 만으로 세지 마라 — 서로 다른 기관이 같은 포털 URL 을 쓰는 경우가 있다 (실측: unique url 42 vs unique (name,url) 46).
- **`getCitySourcesByCategory` 는 존재하지 않는 `cityId` 에 대해 `CityNotFoundError` 를 throw** 한다. 빈 배열을 반환하지 마라 — "출처가 없는 도시" 와 "존재하지 않는 도시" 는 화면에서 다르게 처리되어야 한다 (CLAUDE.md CRITICAL: 에러를 삼키지 않는다). 에러 클래스는 `src/lib/errors.ts` 의 기존 것을 쓰고, 없으면 그 파일에 추가한다.
- **데이터 미로드(빈 맵)는 에러가 아니다.** `getCitySourceGroups()` 는 빈 배열, `countUniqueSources()` 는 `0` 을 반환한다. 부팅 중/시드 fallback 상태에서 정상적으로 일어나는 일이다.
- 정렬은 **순수 함수**여야 한다 — 같은 입력에 항상 같은 순서. 가나다순 비교는 `localeCompare('ko')` 를 쓴다.
- 서울의 `cityId` 는 `'seoul'` 이다. 하드코딩 상수로 두되 파일 상단에 의미를 주석으로 남긴다 (서울 = 비교 기준 도시).
- `src/lib/index.ts` 배럴에 세 함수와 두 타입을 export 한다.

### 2. 테스트 — `src/lib/__tests__/sources.test.ts` 신규

`docs/TESTING.md` §5.4 의 도시 데이터 모킹 규약을 따를 것 (`@/lib/data` 를 mock 하거나 fixture 를 로드하는 기존 방식 중 저장소 관례를 그대로 사용).

최소 케이스:

- `getCitySourceGroups`
  - 서울이 항상 첫 번째
  - 권역 순서 `na → eu → asia → oceania → me` 준수 (권역이 섞인 fixture 로 검증)
  - 같은 권역 안에서 `name.ko` 가나다순
  - 출처 0개 도시는 제외
  - 데이터 미로드 → 빈 배열
- `countUniqueSources`
  - 서로 다른 도시가 **같은 `(name, url)`** 을 쓰면 1개로 센다 (실데이터에 20회 반복되는 출처가 있으므로 중요)
  - 이름이 같고 url 이 다르면 2개로 센다
  - 데이터 미로드 → 0
- `getCitySourcesByCategory`
  - `CATEGORY_ORDER` 순서로 그룹이 나온다
  - 출처 0개 카테고리(예: `tax`)는 그룹 자체가 없다
  - 한 카테고리에 출처가 2개인 경우(서울 food) 둘 다 원본 순서로 들어간다
  - 존재하지 않는 cityId → throw (에러 타입까지 단언)

`docs/TESTING.md` §9 인벤토리에 `src/lib/sources.ts` 절을 신규 추가한다 (번호는 기존 최대값 다음). **인벤토리 누락 = step 미완** (CLAUDE.md).

**커버리지 요구 (중요):** `jest.config.js` 의 `coverageThreshold` 는 `src/lib/**` 에 대해 **statements 100 / branches 95 / lines 100 / functions 100** 을 강제한다. 이 step 이 `src/lib/` 에 추가하는 코드는 모든 분기가 테스트로 덮여야 한다. 확인:

```bash
npm run test:coverage
```

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 실데이터 기준 집계가 맞는지 눈으로 확인한다:

```bash
python3 -c "
import json
a=json.load(open('data/all.json'))
u=set(); n=0
for c in a['cities'].values():
    for s in c['sources']:
        u.add((s['name'],s['url'])); n+=1
print('entries',n,'unique',len(u))
"
# entries 104 / unique 46 이어야 하며, countUniqueSources() 가 같은 값을 내야 한다
```

3. 아키텍처 체크리스트:
   - `src/lib/` 디렉터리 규약을 따랐는가? (ARCHITECTURE.md)
   - 컴포넌트가 아니라 lib 에서 데이터를 집계하는가? (화면은 계산하지 않는다)
   - 존재하지 않는 도시에 대해 명시적 에러를 throw 하는가? (CLAUDE.md CRITICAL: silent fail 금지)
   - `any` 를 쓰지 않았는가? (TypeScript strict)
   - `docs/TESTING.md` 인벤토리에 새 모듈을 기재했는가?
4. 결과에 따라 `phases/in-app-policy-pages/index.json` 의 step 2 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `src/lib/dataSources.ts` (`DATA_SOURCES_COUNT`) 를 지우거나 수정하지 마라. 이유: `app/(tabs)/settings.tsx` 가 아직 그것을 import 하고 있어 지금 지우면 step 7 까지 빌드가 깨진 채로 남는다. 제거는 step 7 담당이다.
- `docs/DATA_SOURCES.md` 의 `<!-- DATA_SOURCES_COUNT: 12 -->` 마커 블록을 건드리지 마라. 이유: 같은 이유로 step 7 담당이다.
- 화면 파일(`app/sources/*`)을 만들지 마라. 이유: step 3·4 의 범위다.
- `app/(tabs)/index.tsx` 의 `REGIONS` 를 lib 으로 옮기지 마라. 이유: 이 화면은 권역 라벨 문자열이 필요 없고(헤더 없는 평평한 목록), 홈을 건드리면 스냅샷까지 범위가 번진다 (CLAUDE.md §3 정밀 수정).
- 출처 데이터를 화면 표시용으로 가공(이름 축약, URL 도메인 추출 등)하지 마라. 이유: 표시 형식은 화면의 책임이며, lib 은 원본 `CitySource` 를 그대로 넘긴다.
- 기존 테스트를 깨뜨리지 마라.
