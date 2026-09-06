# Step 4: source-name-korean

## 배경

이 phase(`e2e-defects`)는 2026-09-04 Maestro E2E 검증 세션에서 발견된 앱 결함 4건을 수정한다.
이 step 은 **결함 4 — 학비 상세의 출처명이 영문** 을 다룬다.

관찰(E2E): 학비 상세 화면의 출처 영역에 "Official university international tuition pages (static estimates)" 가 표시된다.
CLAUDE.md "한국어 문구 1차" 규칙 위반이다 (도시 영문명·통화 코드 같은 본질적 영어 예외에 해당하지 않는 **서술형 문구**).

사실 관계 (조사 완료):

- 이 문자열은 `scripts/refresh/universities.mjs` 의 `export const SOURCE = { category: 'tuition', name: '…', url: '…' }` 가 유일한 작성자다.
  `writeCity()` 가 `sources[]` 에 기록해 `data/cities/*.json` 20개(해외 도시) 와 `data/all.json` 에 들어 있다. `src/`·`docs/`·`data/seed/` 에는 없다.
- 상세 화면 `app/detail/[cityId]/[category].tsx`(630줄 부근, `testID="detail-source-{idx}"`) 는 `sources[].name` 을 그대로 렌더한다. 컴포넌트에 하드코딩된 문자열은 없다.
- 같은 부류의 결함이 `scripts/refresh/visas.mjs` 에 있다: `'Government visa fee pages (static estimates)'`. 같은 정책·같은 기전이므로 이 step 에서 함께 고친다.
- 저장소의 출처명 관례: **기관·데이터셋 고유명은 원어 유지** (`Statistics Canada`, `東京メトロ`, `서울교통공사`, `TransLink`). 이는 위반이 아니다.
  위반은 **우리 스크립트가 지은 서술형 문구** 가 영문인 경우뿐이다. 다른 스크립트의 `'… + static estimates'` 접미사는 이 step 범위 밖(ADR 에 후속으로 기록).
- `docs/AUTOMATION.md` §8 은 정적 추정치 예외를 `sources[].name` 에 "추정" 또는 "static" 마커로 표기하도록 요구한다 → 한국어 이름에도 **"추정" 마커를 유지**해야 한다.
- `scripts/refresh/_common.mjs` 의 `updateSources()` 는 `category + name` 이 같을 때만 `accessedAt` 을 갱신하고, **이름이 다르면 새 항목을 append** 한다.
  따라서 이름만 바꾸고 refresh 를 돌리면 도시마다 영문 항목 + 한국어 항목이 **중복**된다. 레거시 이름 제거 처리가 필요하다.
- 데이터는 자동화 경로로만 갱신한다 (ADR-032, CLAUDE.md CRITICAL). JSON 을 손으로 고치지 않는다.
  실제 cron 은 `node scripts/refresh/_run.mjs universities --useStatic` / `visas --useStatic` 을 돌린 뒤 `node scripts/build_data.mjs` 로 `data/all.json` 을 만든다 (`.github/workflows/refresh-tuition.yml`, `refresh-visa.yml`).
  `--useStatic` 은 네트워크 fetch 없이 `UNIVERSITY_REGISTRY` 의 `staticAnnual` 을 쓰므로 **숫자 값은 바뀌지 않아야** 한다.
- `data/seed/all.json` 은 fixture 기반이라 `build_data.mjs` 가 덮어쓰지 않는다 (ADR-045). 건드리지 않는다.
- `src/lib/dataSources.ts` 의 `DATA_SOURCES_COUNT`(출처 **유형** 총수) 는 이름 변경과 무관하다. 변경 금지.

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래 목록을 반드시 직접 Read 할 것:

- `docs/ARCHITECTURE.md`
- `docs/ADR.md` (인덱스) — ADR-032(자동 갱신 정책), ADR-045(seed fixture), ADR-068(ADR 파일 분할 형식) 을 골라 읽을 것. 새 ADR 의 형식은 최근 파일(`docs/adr/069-*.md`) 을 따른다.
- `docs/DATA.md` — `sources[]` 스키마(60~80줄 부근) 와 출처 정책 절
- `docs/DATA_SOURCES.md` — §학비·§비자 (출처 URL 목록; 영문 라벨 자체는 여기 없음)
- `docs/AUTOMATION.md` — §3 스크립트 표준 인터페이스(`writeCity`), §4.4·§4.5 tuition/visa 워크플로우, §8 자동화 한계·예외("추정"/"static" 마커)
- `docs/TESTING.md` — §9-A.1(`_common.mjs`), `universities.mjs`·`visas.mjs` 인벤토리(2954·2967줄 부근)
- `scripts/refresh/_common.mjs` — `writeCity`, `updateSources`, `validateCityData`
- `scripts/refresh/universities.mjs`, `scripts/refresh/visas.mjs` — `SOURCE` 상수와 `writeCity` 호출부
- `scripts/refresh/__tests__/_common.test.ts`, `universities.test.ts`, `visas.test.ts`, `integration.test.ts` — 현재 `SOURCE.name` 단언(`toContain('university')` / `toContain('visa')`)
- `scripts/refresh/_run.mjs`, `scripts/build_data.mjs`, `scripts/validate_cities.mjs`
- `data/cities/vancouver.json` — `sources[]` 실제 형태
- `app/detail/[cityId]/[category].tsx` 620~640줄 부근 — 출처 렌더링

## 작업

### 1. ADR — 출처명 표기 언어 정책

`docs/adr/NNN-source-name-language.md` 신규 (NNN = 작성 시점 `docs/adr/` 의 최대 번호 + 1; 현재 069 까지 있음) + `docs/ADR.md` 인덱스 행 추가.

Decision 요지:

- `sources[].name` 에서 **기관·데이터셋 고유명은 원어 유지**, **우리 refresh 스크립트가 짓는 서술형 출처명은 한국어**.
- 정적 추정치 caveat 는 한국어 마커 "정적 추정치" 로 표기 (AUTOMATION.md §8 의 "추정" 마커 요건 충족).
- 출처명 변경 시 데이터 중복을 막기 위해 `SOURCE.legacyNames` 로 구 이름을 선언한다 (아래 2).
- 적용 범위: 이번엔 `universities.mjs`·`visas.mjs`. 다른 스크립트의 `'… + static estimates'` 접미사는 **후속** (해당 스크립트를 다음에 손댈 때 같은 방식으로 이전) 으로 기록.

### 2. `scripts/refresh/_common.mjs` — 레거시 출처명 제거

`writeCity(id, data, source)` 의 `source` 디스크립터에 선택 필드를 추가한다:

```js
/** @typedef {{ category: string, name: string, url: string, legacyNames?: string[] }} SourceDescriptor */
```

`updateSources(sources, newSource, accessedAt)` 규칙:

1. `newSource.legacyNames` 가 있으면, `category` 가 같고 `name` 이 `legacyNames` 에 포함된 기존 항목을 **제거**한다.
2. 그 다음 기존 upsert 규칙 (같은 `category + name` 이면 `accessedAt` 갱신, 없으면 append).
3. 기록되는 항목은 지금처럼 `category / name / url / accessedAt` 4개 필드만 — `legacyNames` 를 데이터에 쓰지 않는다 (스키마 검증 대상).
4. `legacyNames` 가 없으면 동작 불변. 두 번 실행해도 결과 동일(멱등).

JSDoc 과 `docs/AUTOMATION.md` §3 의 `writeCity` 시그니처 설명에 `legacyNames` 를 반영한다.

### 3. `universities.mjs` / `visas.mjs` — `SOURCE` 변경

```js
export const SOURCE = {
  category: 'tuition',
  name: '각 대학 공식 국제학생 학비 페이지 (정적 추정치)',          // 문구는 재량, 단 한국어 + "정적 추정치" 포함
  url: '…',                                                          // 기존 값 유지
  legacyNames: ['Official university international tuition pages (static estimates)'],
};
```

visas.mjs 도 같은 형태 (예: `'각국 정부 공식 비자 수수료 페이지 (정적 추정치)'`, `legacyNames: ['Government visa fee pages (static estimates)']`).

### 4. 테스트

- `_common.test.ts`: `legacyNames` 로 구 항목 제거 + 신규 append / 다른 category·다른 이름 항목은 무변경 / 2회 실행 멱등 / `legacyNames` 없으면 기존 동작 / 기록 항목에 `legacyNames` 키 없음.
- `universities.test.ts`·`visas.test.ts`: `SOURCE.name` 단언을 한국어 기준(`'학비'`/`'비자'` 포함, `'정적 추정치'` 포함) 으로 교체, `legacyNames` 에 구 영문 문자열 포함 단언 추가. `integration.test.ts` 가 출처명을 단언하면 함께 갱신.
- `docs/TESTING.md` §9-A.1 과 universities/visas 인벤토리에 `- [x]` 추가.

### 5. 데이터 재생성 — 자동화 경로로만

```bash
node scripts/refresh/_run.mjs universities --useStatic
node scripts/refresh/_run.mjs visas --useStatic
node scripts/build_data.mjs
node scripts/validate_cities.mjs
git diff --stat -- data/
```

- 기대 diff: `data/cities/*.json` 해외 도시 20개 + `data/all.json` 에서 `sources[]` 의 tuition/visa 항목 이름 교체와 `accessedAt`/`lastUpdated` 날짜 갱신만. `data/seed/` 와 `seoul.json` 은 무변경.
- 숫자 값(tuition/visa 금액) 이 바뀌면 `--useStatic` 전제가 깨진 것이므로 **원인을 적고 `error` 로 기록**한다 (임의 커밋 금지).
- 각 도시의 `sources[]` 에 tuition·visa 항목이 각각 **정확히 1개** 인지 확인한다 (중복 = `legacyNames` 처리 실패).

### 6. 문서

- `docs/DATA.md` `sources[]` 스키마 주석에 언어 정책 1줄 + ADR 참조.
- `docs/AUTOMATION.md` §3 `writeCity` 설명에 `legacyNames`, §8 에 "정적 추정치" 한국어 마커 허용을 반영.

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
node scripts/validate_cities.mjs
! grep -rq "Official university international tuition pages\|Government visa fee pages" data/   # 구 영문 출처명이 데이터에 없음
grep -c "정적 추정치" data/all.json   # 40 (20개 도시 × tuition·visa) — 문구에 "정적 추정치" 를 포함했을 때
git diff --stat -- data/seed/ | wc -l   # 0 (seed 무변경)
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트:
   - 데이터 JSON 을 손으로 편집하지 않고 스크립트로만 재생성했는가? (ADR-032)
   - 숫자 값 무변경, 도시당 tuition/visa 출처 항목 1개씩인가?
   - 새 ADR 파일 + `docs/ADR.md` 인덱스 행, DATA.md·AUTOMATION.md·TESTING.md 갱신됐는가? (누락 = step 미완)
   - `DATA_SOURCES_COUNT` 와 `docs/DATA_SOURCES.md` 의 `<!-- DATA_SOURCES_COUNT: N -->` 마커는 무변경인가?
3. 결과에 따라 `phases/e2e-defects/index.json`의 step 4 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 에 ADR 번호·새 출처명·재생성 파일 수 기록
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `data/cities/*.json`·`data/all.json` 을 직접 편집하지 마라. 이유: ADR-032 — 데이터는 `scripts/refresh` 자동화 경로로만 갱신한다.
- `--useStatic` 없이 refresh 를 돌리지 마라. 이유: 대학·정부 페이지 60여 개를 실제 fetch 해 느리고 비결정적이며, cron 의 역할이다.
- `data/seed/all.json` 을 수정하지 마라. 이유: ADR-045 — fixture 기반 seed 는 build 가 덮어쓰지 않는다.
- 기관 고유명 출처(`Statistics Canada`, `東京メトロ` 등) 나 다른 스크립트의 `'+ static estimates'` 접미사를 이 step 에서 바꾸지 마라. 이유: 범위 밖. ADR 후속 항목으로만 기록한다.
- `src/lib/dataSources.ts` 의 `DATA_SOURCES_COUNT` 와 DATA_SOURCES.md 마커를 바꾸지 마라. 이유: 출처 유형 수는 변하지 않았다.
- `.github/workflows/*.yml` 을 수정하지 마라. 이유: 실행 커맨드는 그대로이며 변경 불필요.
- 기존 테스트를 깨뜨리지 마라.
