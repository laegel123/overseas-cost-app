# Step 0: source-urls

## 배경

이 phase(`in-app-policy-pages`)는 **"데이터 출처"와 "개인정보 처리방침" 두 페이지를 외부 브라우저 링크에서 앱 내부 화면으로 옮긴다.**

현재 `app/(tabs)/settings.tsx` 의 메뉴 두 개는 `Linking.openURL` 로 앱 밖을 연다:

| 메뉴 | 현재 동작 | 대상 |
| --- | --- | --- |
| 데이터 출처 보기 (`12개`) | `Linking.openURL(DATA_SOURCES_URL)` | GitHub `docs/DATA_SOURCES.md` (848줄 마크다운) |
| 개인정보 처리방침 | `Linking.openURL(PRIVACY_POLICY_URL)` | GitHub Pages `privacy-policy.html` |

phase 전체 계획 (이 step 은 그중 **1번만** 구현한다):

0. **(이 step)** tuition/visa 출처 URL 을 실제 공공 출처로 교체 + phase 전체 결정을 ADR 로 기록
1. `src/lib/categoryMeta.ts` — 카테고리 라벨·아이콘 단일 정의
2. `src/lib/sources.ts` — 출처 집계 (도시별 그룹 / unique 카운트)
3. `app/sources/index.tsx` — 도시 목록
4. `app/sources/[cityId].tsx` — 도시별 출처
5. `src/lib/privacyPolicy.ts` — 개인정보 방침 본문 정본 + 문서 생성 스크립트
6. `app/privacy.tsx` — 개인정보 화면
7. `settings.tsx` 배선 + 외부 링크 상수 제거 + `DATA_SOURCES_COUNT` 제거
8. 문서 정합

### 이 step 이 푸는 문제

앱 안에 출처 화면을 만들면 도시 JSON 의 `sources[]` 를 그대로 렌더하고, 각 출처에 "페이지 열기 →" (`Linking.openURL`) 를 붙인다. 그런데 **tuition·visa 출처 40개(해외 20개 도시 × 2)의 `url` 이 전부 `https://github.com/laegel123/overseas-cost-app/blob/main/docs/DATA_SOURCES.md` 를 가리킨다.** 방금 앱 안으로 들여온 바로 그 문서다. 사용자가 "페이지 열기 →" 를 누르면 실제 공공 출처가 아니라 우리 GitHub 저장소로 나간다.

사실 관계 (조사 완료):

- `scripts/refresh/universities.mjs` 의 `export const SOURCE` (125줄 부근) 와 `scripts/refresh/visas.mjs` 의 `export const SOURCE` (117줄 부근) 가 이 URL 의 **유일한 작성자**다. 두 상수 모두 `url` 이 위 GitHub 주소로 하드코딩돼 있다.
- 두 스크립트 모두 **실제 출처 URL 을 이미 갖고 있다**:
  - `universities.mjs` 의 `UNIVERSITY_REGISTRY[cityId]` — 도시별 대학 배열, 각 원소가 `{ school, level, url, staticAnnual }`. 도시당 2~3개.
  - `visas.mjs` 의 `VISA_REGISTRY[countryCode]` — 11개국, 각각 `{ url, studentApplicationFee, workApplicationFee, settlementApprox }`. 도시→국가 매핑은 같은 파일의 `CITY_TO_COUNTRY`.
- 즉 `SOURCE` 가 **모듈 레벨 단일 상수**라서 도시별로 다른 URL 을 쓸 수 없는 것이 원인이다. 도시별로 만들어 주는 함수로 바꾸면 된다.
- `docs/DATA_SOURCES.md` 의 도시별 §학비·§비자 절에도 같은 URL 이 문서로 적혀 있다 (예: 밴쿠버 UBC/SFU/BCIT, 도쿄 외무성). 스크립트의 registry 가 그 문서를 코드로 옮긴 것이다.
- 출처명은 **ADR-070 (직전 phase `e2e-defects` step 4) 에서 이미 한국어로 이전됐다**: tuition = `각 대학 공식 국제학생 학비 페이지 (정적 추정치)`, visa = `각국 정부 공식 비자 수수료 페이지 (정적 추정치)`. 이 step 은 그 이름을 **도시별로 더 구체화**한다 (어떤 대학·어떤 기관인지). ADR-070 이 도입한 `legacyNames` 기전을 그대로 재사용한다.
- `scripts/refresh/_common.mjs` 는 이 step 에서 **수정할 필요가 없다**. `updateSources()` 는 `legacyNames` 처리를 이미 하고, `hasLegacySourceName(sources, source)` 도 `source` 객체를 인자로 받으므로 도시별로 만든 객체를 그대로 넘기면 된다.
- 데이터는 자동화 경로로만 갱신한다 (ADR-032, CLAUDE.md CRITICAL). **JSON 을 손으로 고치지 않는다.**
- `--useStatic` 은 네트워크 fetch 없이 registry 의 정적 값을 쓰므로 **숫자 값은 바뀌지 않아야 한다**. 바뀌는 것은 `sources[].name` / `sources[].url` / `accessedAt` / `lastUpdated` / `generatedAt` 뿐이다.
- `data/seed/all.json` 은 fixture 기반이라 `build_data.mjs` 가 덮어쓰지 않는다 (ADR-045). 건드리지 않는다.
- `data/cities/seoul.json` 에는 tuition·visa 출처가 없다 (rent/food/food/transport 4개뿐). 무변경이어야 한다.

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래 목록을 반드시 직접 Read 할 것:

- `docs/ARCHITECTURE.md`
- `docs/ADR.md` (인덱스) — 이 step 과 직접 관련된 것만 골라 읽을 것: `docs/adr/070-source-name-language.md` (출처명 언어 정책 + `legacyNames` 기전 — **이 step 의 직접 선행 결정**), `docs/adr/032-*.md` (공공 출처 100% 자동화), `docs/adr/045-*.md` (seed fixture), `docs/adr/065-source-count-privacy.md` (출처 유형 총수 + 인앱 개인정보 링크 — 이 phase 가 부분 supersede 한다), `docs/adr/068-adr-doc-split.md` (ADR 파일 형식). 새 ADR 의 형식은 최근 파일 `docs/adr/070-source-name-language.md` 를 그대로 따른다.
- `docs/DATA.md` — `sources[]` 스키마와 §3.3 출처 표기
- `docs/DATA_SOURCES.md` — 도시별 §학비·§비자 절 (URL 원본이 문서로 적혀 있음)
- `docs/AUTOMATION.md` — §3 스크립트 표준 인터페이스(`writeCity`), §4.4·§4.5 tuition/visa 워크플로우, §8 자동화 한계·"정적 추정치" 마커
- `docs/TESTING.md` — §9-A.1 (`_common.mjs`), §9-A.9 (학비·비자 2 scripts) 인벤토리
- `docs/RELEASE.md` §7 — "앱에서 항상 외부 링크로 노출" 이라는 현행 정책 문장 (ADR-071 이 뒤집는 대상. **이 step 에서 RELEASE.md 를 고치지는 않는다** — step 8 담당)
- `scripts/refresh/_common.mjs` — `updateSources`, `hasLegacySourceName`, `writeCity`, `SourceDescriptor` typedef
- `scripts/refresh/universities.mjs` — `UNIVERSITY_REGISTRY`, `SOURCE`, `refresh()` 의 `writeCity` 호출부 (266~275줄 부근)
- `scripts/refresh/visas.mjs` — `VISA_REGISTRY`, `CITY_TO_COUNTRY`, `SOURCE`, `refresh()` 의 `writeCity` 호출부 (275~295줄 부근)
- `scripts/refresh/__tests__/universities.test.ts`, `visas.test.ts` — 현재 `SOURCE` 관련 단언
- `scripts/refresh/_run.mjs`, `scripts/build_data.mjs`, `scripts/validate_cities.mjs`
- `data/cities/vancouver.json`, `data/cities/tokyo.json` — `sources[]` 실제 형태
- `app/(tabs)/settings.tsx` — 이 phase 가 최종적으로 바꿀 진입점 (이 step 에서는 **수정하지 않는다**)

## 작업

### 1. ADR-071 — 이 phase 전체의 결정 기록

`docs/adr/071-in-app-policy-pages.md` 신규 + `docs/ADR.md` 인덱스 행 추가.

번호 071 을 쓴다 (070 은 `source-name-language` 가 점유 — 확인 후 최대 번호 + 1 이 071 이 맞는지 검증할 것).

ADR 에 담을 결정 (phase 전체 범위 — 이 step 은 그중 4번만 구현):

1. **정책 페이지 인앱 내재화.** 데이터 출처·개인정보 처리방침을 앱 내부 화면(`/sources`, `/sources/[cityId]`, `/privacy`)으로 제공하고, `settings.tsx` 의 외부 링크 상수 `DATA_SOURCES_URL` / `PRIVACY_POLICY_URL` 을 제거한다. 근거: 오프라인에서도 열람 가능, 앱 디자인 토큰과 일관, 848줄 개발자용 마크다운 대신 사용자용 뷰 제공. **`docs/RELEASE.md` §7 의 "URL 변경 가능성을 고려해 앱에서 항상 외부 링크로 노출" 정책을 전환한다** — 스토어 등록용 공개 URL(`privacy-policy.html`)은 그대로 유지되며(스토어 심사 요구), 앱 내부 표시만 자체 화면으로 바뀐다. ADR-065 결정 2(인앱 개인정보 링크 = GitHub Pages URL)를 supersede.
2. **출처 카운트 = 런타임 실측.** 설정 메뉴 rightText 와 출처 화면 헤더는 **현재 로드된 도시 데이터에서 계산한 unique 출처 수**를 쓴다. `src/lib/dataSources.ts` 의 `DATA_SOURCES_COUNT`(= 12, 큐레이션된 "출처 **유형**" 수) 와 `docs/DATA_SOURCES.md` 의 `<!-- DATA_SOURCES_COUNT: N -->` 마커, 그리고 둘의 동기화를 강제하던 드리프트 테스트를 제거한다. ADR-065 결정 1 을 supersede. 근거: 화면이 실제 출처 46개를 나열하는데 메뉴가 "12개" 라고 말하면 모순이다. 실측값은 정의상 drift 가 불가능하다. 번들 시드만 있는 첫 실행 시 10개로 표시되는 것은 "지금 앱이 가진 데이터"를 정확히 반영한 것이므로 의도된 동작이다 (설정의 "도시 DB" 통계 카드가 이미 같은 방식).
3. **진입점은 설정 메뉴로 한정.** Compare 화면의 `disabled` 된 "출처 보기 →" 와 Detail 화면의 인라인 출처 목록은 이 phase 에서 바꾸지 않는다. 근거: Detail 은 이미 해당 카테고리 출처를 전부 인라인으로 보여주므로 중복 진입점이 된다. 화면 구성은 일반 Stack push (`docs/UI_GUIDE.md` §Sheet C 의 full-screen modal 명세와 다름 — 기존 compare/detail 과 동일한 이동 방식으로 통일. UI_GUIDE 편차표에 기록).
4. **(이 step) tuition/visa 출처 URL 도시별 실제화.** `SOURCE` 모듈 상수를 `buildSource(cityId)` 로 바꿔 도시별 실제 공공 출처 URL 과 구체적 기관·대학명을 기록한다. ADR-070 이 "후속 (이 결정의 범위 밖)" 으로 남긴 항목의 연장이며, 같은 `legacyNames` 기전을 재사용한다.

대안 검토도 함께 기록할 것 (기각 사유 포함):

- (기각) WebView 로 원격 HTML 임베드: `react-native-webview` 신규 네이티브 의존성 + 오프라인 불가 + 앱 디자인 토큰과 이질적.
- (기각) 출처 화면에서 GitHub 문서 링크 유지: 사용자용 화면이 개발자 문서로 나가는 경험. 실제 공공 출처를 이미 갖고 있으므로 불필요.
- (기각) `DATA_SOURCES_COUNT` 를 유지하고 화면만 실측: 같은 화면에서 두 숫자가 어긋난다.

### 2. `scripts/refresh/universities.mjs` — 도시별 SOURCE

`export const SOURCE = {...}` 를 제거하고 도시별 디스크립터를 만드는 함수로 대체한다.

```js
/**
 * @param {string} cityId
 * @returns {import('./_common.mjs').SourceDescriptor}
 */
export function buildSource(cityId) { /* ... */ }
```

규칙 (반드시 지킬 것):

- `category`: `'tuition'` 고정.
- `url`: `UNIVERSITY_REGISTRY[cityId]` 의 **첫 번째 대학** `url`. registry 에 없는 도시는 이 함수가 호출되지 않지만, 방어적으로 registry 미등록 시 명시적 throw (silent fallback 금지 — CLAUDE.md "에러를 삼키지 않는다").
- `name`: `` `${schools} 공식 국제학생 학비 페이지 (정적 추정치)` `` — `schools` 는 해당 도시 대학의 `school` 값을 등장 순서대로 ` · ` (스페이스-가운뎃점-스페이스) 로 연결. 예: 밴쿠버 → `UBC · SFU · BCIT 공식 국제학생 학비 페이지 (정적 추정치)`, 도쿄 → `東京大学 · 早稲田大学 · 慶應義塾大学 공식 국제학생 학비 페이지 (정적 추정치)`.
  - 대학 고유명은 **원어 유지** (ADR-070: 기관·데이터셋 고유명은 번역하지 않는다). 서술 부분만 한국어.
  - `(정적 추정치)` 마커는 반드시 유지 — `docs/AUTOMATION.md` §8 이 요구하는 추정치 표기 요건이다.
- `legacyNames`: `['각 대학 공식 국제학생 학비 페이지 (정적 추정치)', 'Official university international tuition pages (static estimates)']` — 현재 데이터에 있는 한국어 이름과, 그 이전의 영문 이름 **둘 다** 넣는다. 하나라도 빠지면 `updateSources` 가 구 항목을 지우지 못해 도시별로 출처가 중복 append 된다.

`refresh()` 의 호출부 두 곳을 도시별 디스크립터로 교체한다:

- `const needsSourceRename = hasLegacySourceName(oldData?.sources, SOURCE);` → `buildSource(cityId)` 결과 사용
- `await writeCity(cityId, updatedData, SOURCE);` → 같은 디스크립터 사용

같은 도시 루프 안에서 `buildSource(cityId)` 를 **한 번만 호출해 변수에 담아** 두 곳에 쓴다 (두 번 호출해도 결과는 같지만 의도를 분명히).

### 3. `scripts/refresh/visas.mjs` — 도시별 SOURCE

`VISA_REGISTRY` 의 각 국가 항목에 `name` 필드를 추가한다. 아래 표를 **그대로** 사용할 것 (URL 이 실제로 가리키는 기관):

| 코드 | `name` 에 쓸 기관 표기 |
| --- | --- |
| CA | `캐나다 이민·난민·시민권부(IRCC)` |
| US | `미국 국무부 영사국` |
| GB | `영국 정부(GOV.UK)` |
| DE | `독일 연방이주난민청(BAMF)` |
| FR | `프랑스 France-Visas` |
| NL | `네덜란드 이민귀화청(IND)` |
| AU | `호주 내무부` |
| JP | `일본 외무성` |
| SG | `싱가포르 이민검문청(ICA)` |
| VN | `베트남 출입국관리국` |
| AE | `UAE 정부 포털(u.ae)` |

`export const SOURCE = {...}` 를 제거하고 함수로 대체한다.

```js
/**
 * @param {string} cityId
 * @returns {import('./_common.mjs').SourceDescriptor}
 */
export function buildSource(cityId) { /* ... */ }
```

규칙:

- `category`: `'visa'` 고정.
- `url`: `VISA_REGISTRY[CITY_TO_COUNTRY[cityId]].url`. 매핑 누락 시 명시적 throw.
- `name`: `` `${기관} 공식 비자 수수료 페이지 (정적 추정치)` `` — 예: 밴쿠버 → `캐나다 이민·난민·시민권부(IRCC) 공식 비자 수수료 페이지 (정적 추정치)`, 도쿄 → `일본 외무성 공식 비자 수수료 페이지 (정적 추정치)`.
- `legacyNames`: `['각국 정부 공식 비자 수수료 페이지 (정적 추정치)', 'Government visa fee pages (static estimates)']`

`refresh()` 의 `hasLegacySourceName` / `writeCity` 호출부를 universities.mjs 와 같은 방식으로 교체한다.

### 4. 테스트

`scripts/refresh/__tests__/universities.test.ts` / `visas.test.ts` 의 기존 `SOURCE` 단언을 `buildSource` 기준으로 갱신하고, 아래를 **각 파일에 추가**한다:

- `buildSource(cityId)` 의 `url` 이 해당 도시 registry 의 실제 URL 과 일치 (도시 2곳 이상 검증 — 서로 다른 국가/대학)
- `buildSource(cityId)` 의 `url` 이 `github.com` 을 포함하지 **않음**
- `name` 이 도시별로 다름 (예: 밴쿠버 ≠ 도쿄) + `(정적 추정치)` 마커 포함
- `legacyNames` 에 구 한국어명과 구 영문명이 **둘 다** 포함
- registry 미등록 도시 id 를 넘기면 throw
- 값 변동 0 인 상태에서 구 이름이 남아 있으면 `writeCity` 가 호출되고, 이전이 끝난 상태에서는 호출되지 않는다 (기존 `needsSourceRename` 테스트를 도시별 디스크립터 기준으로 유지)

`docs/TESTING.md` §9-A.9 인벤토리에 추가한 테스트 항목을 기재한다 (**인벤토리 누락 = step 미완** — CLAUDE.md).

### 5. 데이터 재생성 (자동화 경로로만)

```bash
node scripts/refresh/_run.mjs universities --useStatic
node scripts/refresh/_run.mjs visas --useStatic
node scripts/build_data.mjs
node scripts/validate_cities.mjs
```

재생성 후 아래를 확인할 것:

- `data/cities/*.json` + `data/all.json` 에서 `github.com` 을 포함한 `sources[].url` 이 **0개**
- 전체 `sources[]` 엔트리 수가 **104개로 유지** (도시별 중복 append 가 없었다는 뜻)
- 도시당 `tuition` 출처 1개, `visa` 출처 1개
- **숫자 값 무변경** — `git diff` 에서 바뀐 줄이 `name` / `url` / `accessedAt` / `lastUpdated` / `generatedAt` 뿐인지 확인
- `data/cities/seoul.json` 무변경, `data/seed/` 무변경

### 6. 문서

- `docs/DATA_SOURCES.md` — tuition/visa 출처 URL 이 도시별 실제 출처로 바뀐 사실을 §부록 A(자동화 스크립트 매핑) 또는 §학비/§비자 관련 절에 반영. **`<!-- DATA_SOURCES_COUNT: 12 -->` 마커 블록은 이 step 에서 건드리지 않는다** (step 7 담당).
- `docs/AUTOMATION.md` §3 또는 §4.4·§4.5 — `SOURCE` 상수 → `buildSource(cityId)` 로 바뀐 인터페이스를 반영.

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm test
node scripts/refresh/_run.mjs universities --useStatic
node scripts/refresh/_run.mjs visas --useStatic
node scripts/build_data.mjs
node scripts/validate_cities.mjs
```

추가 검증 (모두 통과해야 함):

```bash
# github.com 을 가리키는 출처 URL 이 0 개
grep -c 'github.com' data/all.json          # sources[].url 문맥에서 0 이어야 함
python3 -c "
import json,glob
n=0; gh=0
for f in glob.glob('data/cities/*.json') :
    d=json.load(open(f))
    n+=len(d['sources'])
    gh+=sum(1 for s in d['sources'] if 'github.com' in s['url'])
print('entries',n,'github',gh)
assert n==104 and gh==0
"
# seoul.json / data/seed/ 무변경
git diff --name-only | grep -E 'data/(cities/seoul|seed)' && exit 1 || true
```

## 검증 절차

1. 위 AC 커맨드를 순서대로 실행한다.
2. `git diff data/` 를 눈으로 확인해 **숫자 값이 바뀌지 않았는지** 검사한다. 값이 바뀌었다면 `--useStatic` 이 누락된 것이므로 되돌리고 다시 실행한다.
3. 아키텍처 체크리스트:
   - 데이터를 손으로 편집하지 않고 자동화 경로로만 재생성했는가? (ADR-032, CLAUDE.md CRITICAL)
   - 출처명이 "기관 고유명 원어 + 서술 한국어 + (정적 추정치) 마커" 규칙을 지키는가? (ADR-070)
   - 새 결정을 ADR 파일 + `docs/ADR.md` 인덱스 행으로 남겼는가? (CLAUDE.md CRITICAL)
   - `docs/TESTING.md` 인벤토리에 새 테스트를 기재했는가? (CLAUDE.md CRITICAL)
4. 결과에 따라 `phases/in-app-policy-pages/index.json` 의 step 0 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `data/cities/*.json` / `data/all.json` 을 **직접 편집하지 마라**. 이유: ADR-032 (공공 출처 자동 갱신) 위반이며, 다음 cron 이 스크립트 값으로 덮어써 원복된다.
- `data/seed/all.json` 을 건드리지 마라. 이유: fixture 기반이라 `build_data.mjs` 대상이 아니다 (ADR-045).
- `--useStatic` 없이 refresh 를 돌리지 마라. 이유: 실제 네트워크 fetch 가 일어나 숫자 값이 바뀌고, 이 step 의 "출처 메타만 변경" 이라는 성격이 깨진다.
- `src/lib/dataSources.ts` 나 `docs/DATA_SOURCES.md` 의 `DATA_SOURCES_COUNT` 마커를 건드리지 마라. 이유: step 7 의 작업 범위다. `settings.tsx` 가 이 상수를 쓰고 있어 지금 지우면 step 7 까지 빌드가 깨진 채로 남는다.
- `app/(tabs)/settings.tsx` 를 수정하지 마라. 이유: step 7 의 작업 범위다.
- `scripts/refresh/_common.mjs` 를 수정하지 마라. 이유: `legacyNames` / `hasLegacySourceName` 기전이 이미 ADR-070 에서 완성돼 있고, 이 step 은 호출자 쪽만 바꾸면 된다.
- 다른 refresh 스크립트(`ca_cmhc.mjs`, `us_bls.mjs` 등)의 영문 서술형 접미사(`'… (static fallback, ADR-059)'` 등)를 손대지 마라. 이유: ADR-070 이 명시적으로 후속 과제로 분리했고, 이 step 의 범위가 아니다.
- 기존 테스트를 깨뜨리지 마라.
