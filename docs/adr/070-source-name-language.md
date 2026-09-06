[← ADR 인덱스](../ADR.md)

# ADR-070: 출처명 표기 언어 정책 + `legacyNames` 로 이름 이전

> **상태**: Active

**맥락:**

2026-09-04 Maestro E2E 검증에서 학비 상세 화면의 출처 영역에 "Official university international tuition pages (static estimates)" 가 그대로 노출되는 것이 확인됐다. 비자 상세도 동일하게 "Government visa fee pages (static estimates)" 였다. CLAUDE.md 의 "한국어 문구 1차" 규칙 위반이다 — 도시 영문명·통화 코드처럼 본질적으로 영어인 값이 아니라 **우리가 지은 서술형 문구**이기 때문이다.

이 문자열의 유일한 작성자는 `scripts/refresh/universities.mjs` / `visas.mjs` 의 `SOURCE` 상수다. `writeCity()` 가 `sources[]` 에 기록해 해외 도시 20개 JSON + `data/all.json` 으로 퍼졌고, 상세 화면(`app/detail/[cityId]/[category].tsx`)은 `sources[].name` 을 그대로 렌더한다.

반면 `Statistics Canada`, `東京メトロ`, `TransLink`, `서울교통공사` 는 **기관·데이터셋 고유명**이라 원어 유지가 옳다. 번역하면 오히려 출처 추적이 어려워진다. 즉 위반은 "영어냐"가 아니라 "우리가 지은 서술형 문구가 영어냐"로 갈린다.

이름을 바꾸는 것만으로는 데이터에 반영되지 않는 문제도 함께 드러났다:

1. `_common.mjs::updateSources()` 는 `category + name` 이 같을 때만 `accessedAt` 을 갱신하고 **이름이 다르면 새 항목을 append** 한다 → 이름만 바꾸면 도시마다 영문 항목 + 한국어 항목이 중복된다.
2. `universities.mjs` / `visas.mjs` 는 **숫자 값이 바뀐 도시만** `writeCity` 로 쓴다. 두 스크립트는 v1.0 에서 항상 정적 값(`staticAnnual` / `VISA_REGISTRY`)을 반환하므로 변동이 영원히 0 → 출처명 이전이 자동화 경로로는 **한 번도 일어나지 않는다**.

**결정:**

1. `sources[].name` 언어 규칙:
   - **기관·데이터셋 고유명은 원어 유지** (`Statistics Canada`, `東京メトロ`, `TransLink`).
   - **우리 refresh 스크립트가 짓는 서술형 출처명은 한국어**.
   - 정적 추정치 caveat 는 한국어 마커 **"정적 추정치"** 로 표기 — AUTOMATION.md §8 이 요구하는 "추정"/"static" 마커 요건을 충족한다.
2. 출처명을 바꿀 때는 `SOURCE` 디스크립터에 `legacyNames: string[]` 로 구 이름을 선언한다. `updateSources()` 는 upsert 전에 **같은 category 의 구 이름 항목을 제거**한다 → 중복 방지. `legacyNames` 자체는 데이터에 기록하지 않는다 (`category / name / url / accessedAt` 4필드 유지 — 스키마 검증 대상).
3. 값 변동이 없어도 이름 이전이 남아 있으면 fetcher 가 한 번은 쓰도록 `_common.mjs::hasLegacySourceName(sources, source)` 를 도입하고, `universities.mjs` / `visas.mjs` 의 write 조건을 `hasChanges || needsSourceRename` 으로 확장한다. 이전이 끝나면 `false` 를 반환하므로 이후 실행은 다시 no-op — 멱등이며 워크플로우 YAML 변경이 필요 없다 (다음 cron 이 자동 치유).
4. 적용 범위는 이번엔 `universities.mjs` (tuition) · `visas.mjs` (visa) 두 곳.

**대안 검토:**

- **(A) 채택 — `legacyNames` + write 조건 확장**: 자동화 경로 안에서 이름 이전이 완결된다 (ADR-032 준수). 이후 어떤 스크립트가 출처명을 바꾸더라도 같은 선언 하나로 처리된다.
- **(B) 기각 — 데이터 JSON 직접 편집**: 가장 빠르지만 ADR-032 위반. 다음 cron 이 도는 순간 스크립트가 다시 영문 항목을 append 해 원복된다.
- **(C) 기각 — 화면 단에서 출처명 번역 맵**: 표시 계층에 매핑 테이블이 생겨 단일 출처가 깨지고, 새 출처가 추가될 때마다 맵을 손봐야 한다. 데이터가 이미 한국어면 화면은 손댈 게 없다.
- **(D) 기각 — `--force` / `--rewriteSources` 플래그 추가**: cron 이 쓰지 않는 플래그라 다음 이름 변경 때 또 조용히 누락된다. 워크플로우 YAML 도 함께 고쳐야 한다.

**결과 / 영향:**

- 새 출처명: tuition = `각 대학 공식 국제학생 학비 페이지 (정적 추정치)`, visa = `각국 정부 공식 비자 수수료 페이지 (정적 추정치)`.
- 재생성 범위: `data/cities/*.json` 해외 20개 + `data/all.json`. 숫자 값 무변경 — `lastUpdated` / `accessedAt` 날짜와 출처명만 바뀐다. `seoul.json` 은 tuition·visa 출처가 없어 무변경, `data/seed/` 는 fixture 기반이라 무변경 (ADR-045).
- `src/lib/dataSources.ts` 의 `DATA_SOURCES_COUNT` 는 출처 **유형** 총수라 무관 — 변경 없음 (ADR-065).
- 숫자 변동이 0 이므로 `detect_outliers` 는 직접 commit 경로로 분기한다 (AUTOMATION.md §4.4·§4.5 의 "변경 0" 서술과 일관).

**후속 (이 결정의 범위 밖):**

- 다른 refresh 스크립트의 영문 서술형 접미사 (`'… (static fallback, ADR-059)'`, `'… estimated'` 등) 는 그대로 두었다. 해당 스크립트를 다음에 손댈 때 같은 방식(`legacyNames` 선언 + 한국어 문구)으로 이전한다.

**관련:** ADR-032 (공공 출처 100% 자동화), ADR-045 (seed fixture), ADR-059 (자동화 추정·보정), ADR-065 (출처 유형 총수 단일 출처화), `docs/AUTOMATION.md` §3·§8, `docs/DATA.md` §2·§3.3.
