# Step 5: privacy-content

## 배경

이 phase(`in-app-policy-pages`)는 데이터 출처·개인정보 처리방침을 외부 브라우저 링크에서 **앱 내부 화면**으로 옮긴다. 이 step 은 개인정보 처리방침의 **본문 정본**과 **문서 생성 스크립트**를 만든다. 화면은 step 6 이다.

### 지금의 문제 — 같은 본문이 세 곳에 손으로 복사돼 있다

| 위치 | 성격 | 마지막 갱신 |
| --- | --- | --- |
| `docs/privacy-policy.html` | **출시 정본**. GitHub Pages 로 호스팅되며 Play Store 에 등록된 URL (`https://laegel123.github.io/overseas-cost-app/privacy-policy.html`) | 2026-05-09 |
| `docs/PRIVACY.md` | 참고 사본 (ADR-065 가 "참고 자료로 유지" 로 남겨둠) | 2026-05-02 |
| `docs/RELEASE.md` §7 | 작성 가이드용 코드블록 사본 | — |

세 사본은 이미 서로 어긋나 있고(갱신일 2026-05-09 vs 2026-05-02, 자동 갱신 주기 서술도 다름), **셋 다 사실과 다른 문장을 담고 있다**:

> 사용자가 선택한 **페르소나(유학생/취업자)**, 즐겨찾기 도시, 최근 본 도시는 사용자 기기 내부 저장소(AsyncStorage)에만 저장됩니다.

페르소나 개념은 **ADR-067 로 완전히 제거됐다.** 현재 AsyncStorage 에 저장되는 것은 `src/store/` 의 스토어들이다:

| 스토어 파일 | 저장 내용 |
| --- | --- |
| `onboarding.ts` | 온보딩 완료 여부 |
| `favorites.ts` | 즐겨찾기 도시 |
| `recent.ts` | 최근 본 도시 |
| `settings.ts` | 마지막 동기화 시각 |
| `categoryInclusion.ts` | 카테고리 합산 포함/제외 토글 |
| `rentChoice.ts` | 월세 형태 선택 |
| `tuitionChoice.ts` | 학교 선택 |
| `taxChoice.ts` | 연봉 선택 |

**실제 저장 항목은 구현을 직접 읽어 확인할 것** — 위 표를 그대로 믿지 말고 `src/store/*.ts` 의 persist 설정을 확인해 사실에 맞는 문장을 쓴다. 개인정보 처리방침은 법적 문서이므로 사실과 달라선 안 된다.

### 이 step 의 결정 (확정됨)

**정본을 TS 쪽으로 옮기고 문서 2개를 생성물로 만든다.**

```
src/lib/privacyPolicy.ts  ← 정본 (사람이 편집하는 유일한 곳)
        │
        ├── scripts/gen_privacy_docs.mjs ──▶ docs/privacy-policy.html   (스토어 등록 URL 유지)
        │                                └─▶ docs/PRIVACY.md
        └── app/privacy.tsx (step 6)
```

- `docs/RELEASE.md` §7 의 긴 코드블록은 삭제하고 "본문 정본은 `src/lib/privacyPolicy.ts`" 한 줄 + 링크로 대체한다.
- 생성물이 최신인지 **테스트가 CI 에서 강제**한다 (생성 결과 ≠ 커밋된 파일이면 실패). ADR-065 가 `DATA_SOURCES_COUNT` 에 쓴 드리프트 강제와 같은 방식이다.
- 스토어 등록 URL 은 그대로 살아 있어야 한다 — 파일 경로와 호스팅이 바뀌지 않으므로 스토어 콘솔 수정은 불필요하다.

### 기술적 제약 (조사 완료)

- `tsconfig.json` 에 `"resolveJsonModule": true` 가 켜져 있다 → TS 에서 JSON import 가능.
- `jest.config.js` 의 `transform` 이 `'^.+\\.mjs$': 'babel-jest'` 이고 `moduleFileExtensions` 에 `mjs` 가 있다 → **jest 테스트에서 `.mjs` 모듈을 import 할 수 있다.** 실제로 `scripts/refresh/__tests__/_common.test.ts` 가 `_common.mjs` 를 import 한다.
- 따라서 정본을 `.ts` 로만 두면 `.mjs` 생성 스크립트가 읽을 수 없다. **정본 데이터는 JSON 으로 두고 `.ts` 와 `.mjs` 가 각각 읽는 구조**를 택한다.
- `jest.config.js` 의 `coverageThreshold` 는 `src/lib/**` 에 **statements 100 / branches 95 / lines 100 / functions 100** 을 강제한다.
- 스크립트 파일명 관례는 snake_case 다 (`build_data.mjs`, `detect_outliers.mjs`, `validate_cities.mjs`).

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래 목록을 반드시 직접 Read 할 것:

- `docs/ARCHITECTURE.md` — §디렉터리 구조
- `docs/ADR.md` (인덱스) — `docs/adr/071-in-app-policy-pages.md` (이 phase 의 결정, step 0 작성), `docs/adr/065-source-count-privacy.md` (드리프트 테스트 강제 패턴 + 이 phase 가 supersede 하는 부분), `docs/adr/067-persona-removal.md` (페르소나 제거 — 본문 정정의 근거), `docs/adr/068-adr-doc-split.md` (ADR 형식). 새 ADR 형식은 `docs/adr/070-source-name-language.md` 를 따른다.
- `docs/RELEASE.md` — §6.1 한국 PIPA 컴플라이언스 표(처리방침이 충족해야 할 항목), §7 개인정보 처리방침 (현행 정책 문장과 코드블록 사본)
- `docs/privacy-policy.html` — **현행 출시 정본 전문**. 섹션 구성·문구·스타일을 여기서 가져온다.
- `docs/PRIVACY.md` — 참고 사본 (어긋난 부분 확인용)
- `docs/AUTOMATION.md` — 실제 자동 갱신 주기 (본문의 "데이터 정확성 고지" 문장이 사실과 맞아야 함)
- `docs/TESTING.md` — §9 인벤토리 형식, §9-A.11 빌드·검증 스크립트 인벤토리
- `src/store/onboarding.ts`, `favorites.ts`, `recent.ts`, `settings.ts`, `categoryInclusion.ts`, `rentChoice.ts`, `tuitionChoice.ts`, `taxChoice.ts` — **실제 저장 항목 확인 (필수)**
- `src/lib/index.ts` — 배럴 export 규약
- `src/lib/dataSources.ts` 와 `src/lib/__tests__/dataSources.test.ts` — 드리프트 강제 테스트의 기존 예시 (이 step 에서 **삭제하지 않는다**, 패턴 참고용)
- `scripts/build_data.mjs` — 생성 스크립트 작성 관례 (파일 쓰기, 종료 코드, 로그)
- `scripts/refresh/__tests__/_common.test.ts` — jest 에서 `.mjs` 를 import 하는 예시

## 작업

### 1. ADR-072 — 개인정보 처리방침 본문 단일 출처

`docs/adr/072-privacy-policy-source.md` 신규 + `docs/ADR.md` 인덱스 행 추가 (번호는 작성 시점 `docs/adr/` 최대 번호 + 1 인지 확인할 것 — step 0 이 071 을 썼으므로 072 예상).

결정 내용:

- 개인정보 처리방침 본문의 **단일 출처 = `src/lib/privacyPolicy.ts` (+ JSON 정본 데이터)**. `docs/privacy-policy.html` 과 `docs/PRIVACY.md` 는 생성물이며 손으로 편집하지 않는다.
- `scripts/gen_privacy_docs.mjs` 가 두 문서를 생성하고, 테스트가 "생성 결과 = 커밋된 파일" 을 CI 에서 강제한다.
- `docs/RELEASE.md` §7 의 코드블록 사본을 제거하고 정본 링크로 대체한다 (실제 문서 수정은 step 8 담당 — ADR 에는 결정만 기록).
- 스토어 등록 URL(`privacy-policy.html`)은 경로·호스팅 그대로 유지된다.
- 페르소나 서술을 실제 저장 항목으로 정정한다 (ADR-067 반영).

대안 검토 (기각 사유 포함):

- (기각) HTML 을 정본으로 두고 TS 를 사본으로: 마커 하나가 아니라 본문 전체를 비교해야 해서 드리프트 강제가 사실상 "섹션 제목만" 수준으로 약해진다.
- (기각) 생성 없이 사람이 세 곳을 맞춰 쓰기: 이미 세 사본이 어긋난 채로 배포됐다는 것이 이 방식이 실패한다는 증거다.
- (기각) `PRIVACY.md` 삭제: 저장소 내 다른 문서가 참조하고 있을 수 있고, 마크다운 사본은 생성 비용이 사실상 0 이다.

### 2. 정본 데이터

`src/lib/privacyPolicy.json` (또는 동등한 위치) 에 구조화된 본문을 둔다. 형태:

```ts
// src/lib/privacyPolicy.ts
export type PrivacyBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  /** 탭하면 mailto 로 열리는 연락처 줄. 화면·HTML 양쪽에서 링크가 된다. */
  | { kind: 'email'; label: string; email: string };

export type PrivacySection = {
  /** 예: '수집·저장 정보' — 번호는 렌더 시점에 붙인다. 본문에 하드코딩하지 말 것. */
  title: string;
  blocks: PrivacyBlock[];
};

export type PrivacyPolicy = {
  appName: string;
  /** 리드 문단 — '본 앱은 사용자 개인정보를 수집하지 않습니다.' */
  lead: string;
  operatorEmail: string;
  sections: PrivacySection[];
  /** 'YYYY-MM-DD' — 본문을 고칠 때 사람이 함께 올린다. */
  updatedAt: string;
};

export const PRIVACY_POLICY: PrivacyPolicy;
```

본문 규칙:

- 섹션 구성은 현행 `docs/privacy-policy.html` 의 7개(수집·저장 정보 / 외부 서비스 / 분석·추적 / 데이터 정확성 고지 / 개인정보 보호책임자 / 변경 / 문의)를 **유지**한다. 임의로 섹션을 추가·삭제하지 마라.
- **페르소나 문장을 실제 저장 항목으로 교체한다.** `src/store/*.ts` 를 읽고 사실에 맞게 쓸 것. 스토어 파일명을 그대로 나열하지 말고 사용자가 이해할 표현으로 (예: "즐겨찾기 도시, 최근 본 도시, 화면에서 고른 비교 옵션(월세 형태·학교·연봉), 마지막 동기화 시각").
- "데이터 정확성 고지" 의 갱신 주기는 `docs/AUTOMATION.md` 의 실제 주기와 일치해야 한다. 지어내지 마라.
- `updatedAt` 은 이 step 을 수행하는 날짜로 갱신한다.
- 번호(`1.`, `2.` …)를 title 에 넣지 마라 — 렌더 시점에 붙인다. 그래야 섹션을 추가할 때 번호가 자동으로 맞는다.
- 문구는 한국어 1차. 기존 HTML 의 어투를 유지한다.

`src/lib/index.ts` 배럴에 `PRIVACY_POLICY` 와 타입들을 export 한다.

### 3. `scripts/gen_privacy_docs.mjs` 신규

정본 JSON 을 읽어 두 파일을 생성한다.

```js
/** 정본에서 HTML 전문을 만든다. 파일 쓰기 없음 — 순수 함수 (테스트가 재사용). */
export function renderHtml(policy) { /* ... */ }

/** 정본에서 Markdown 전문을 만든다. 파일 쓰기 없음 — 순수 함수. */
export function renderMarkdown(policy) { /* ... */ }

/** 두 파일을 실제로 쓴다. `node scripts/gen_privacy_docs.mjs` 진입점. */
export default async function generate() { /* ... */ }
```

규칙:

- **`renderHtml` / `renderMarkdown` 은 파일 시스템을 건드리지 않는 순수 함수**여야 한다. 드리프트 테스트가 이 함수를 import 해 현재 커밋된 파일과 비교한다.
- HTML 은 현행 `docs/privacy-policy.html` 의 **`<style>` 블록과 레이아웃을 그대로 유지**한다 (`--bg`/`--fg`/`--accent` CSS 변수, `<main>` 720px, 헤더/푸터 구조). 스타일을 새로 디자인하지 마라 — 이미 배포된 페이지다.
- 섹션 번호는 렌더 시점에 `1.`, `2.` … 로 붙인다.
- `email` 블록은 HTML 에서 `<a href="mailto:…">`, Markdown 에서 `<이메일>` 또는 마크다운 링크로 렌더한다.
- 출력 끝에 개행 하나로 끝나게 해서 diff 안정성을 유지한다.
- 생성 파일 상단에 **"이 파일은 생성물이다. `src/lib/privacyPolicy.ts` 를 고치고 `node scripts/gen_privacy_docs.mjs` 를 실행하라"** 는 주석/코멘트를 넣는다 (HTML 은 `<!-- -->`, Markdown 은 주석 또는 인용 블록). 사람이 생성물을 직접 고치는 사고를 막는다.
- `package.json` 에 `"gen:privacy": "node scripts/gen_privacy_docs.mjs"` 스크립트를 추가한다.

### 4. 문서 재생성

```bash
npm run gen:privacy
```

`docs/privacy-policy.html` 과 `docs/PRIVACY.md` 가 정본에서 다시 만들어진다. **HTML 의 `<style>` 과 구조가 기존과 동일한지 diff 로 확인**할 것 — 바뀌어야 하는 것은 본문(페르소나 문장·갱신일)뿐이다.

### 5. 테스트

- `src/lib/__tests__/privacyPolicy.test.ts` — 정본 데이터 검증:
  - 섹션이 7개이고 각 섹션에 title 과 최소 1개 block 이 있다
  - **본문 어디에도 `페르소나` / `유학생` / `취업자` 문자열이 없다** (ADR-067 회귀 방지 — 이 단언이 이 step 의 핵심 가드다)
  - `updatedAt` 이 `YYYY-MM-DD` 형식
  - `operatorEmail` 이 본문의 email 블록과 일치
- `scripts/__tests__/gen_privacy_docs.test.ts` — 드리프트 강제:
  - `renderHtml(PRIVACY_POLICY)` 결과가 `docs/privacy-policy.html` 파일 내용과 **정확히 일치**
  - `renderMarkdown(PRIVACY_POLICY)` 결과가 `docs/PRIVACY.md` 파일 내용과 **정확히 일치**
  - 불일치 시 실패 메시지에 `npm run gen:privacy` 를 실행하라는 안내가 나오게 할 것
  - `email` 블록이 HTML 에서 `mailto:` 링크로 렌더된다
  - 섹션 번호가 1부터 순서대로 붙는다

`docs/TESTING.md` §9 인벤토리에 `src/lib/privacyPolicy.ts` 절을, §9-A(자동화 스크립트) 에 `scripts/gen_privacy_docs.mjs` 절을 신규 추가한다. **인벤토리 누락 = step 미완** (CLAUDE.md).

**커버리지 요구 (중요):** `src/lib/**` 는 statements 100 / branches 95 / lines 100 / functions 100 이 강제된다.

```bash
npm run test:coverage
```

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm test
npm run gen:privacy
git diff --exit-code docs/privacy-policy.html docs/PRIVACY.md   # 재생성해도 변화 없음 = 생성물이 최신
```

추가 검증:

```bash
# 페르소나 잔재가 생성물에도 없어야 한다
grep -n "페르소나\|유학생\|취업자" docs/privacy-policy.html docs/PRIVACY.md src/lib/privacyPolicy.* && exit 1 || true
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. `git diff docs/privacy-policy.html` 을 눈으로 확인한다. `<style>` 블록과 레이아웃이 그대로이고 본문만 바뀌었는지 검사한다. 스타일이 통째로 바뀌었다면 렌더러가 기존 HTML 을 재현하지 못한 것이므로 고쳐라.
3. `src/store/*.ts` 를 다시 확인해 처리방침의 저장 항목 서술이 **실제 구현과 일치**하는지 검증한다. 개인정보 처리방침은 법적 문서다.
4. 아키텍처 체크리스트:
   - 새 결정을 ADR 파일 + `docs/ADR.md` 인덱스 행으로 남겼는가? (CLAUDE.md CRITICAL)
   - 생성물에 "직접 편집 금지" 표시를 넣었는가?
   - `any` 없이 strict 를 통과하는가?
   - `docs/TESTING.md` 인벤토리에 새 모듈 2개를 기재했는가?
5. 결과에 따라 `phases/in-app-policy-pages/index.json` 의 step 5 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `docs/privacy-policy.html` 의 파일 경로를 바꾸거나 삭제하지 마라. 이유: Play Store 에 등록된 URL 이다. 경로가 바뀌면 스토어 심사 항목(2.3.7 링크 작동)이 깨진다.
- HTML 의 시각 스타일을 새로 디자인하지 마라. 이유: 이미 배포된 페이지이며, 이 step 의 목적은 본문 단일 출처화이지 리디자인이 아니다.
- 처리방침에 없던 조항(쿠키, 제3자 제공, 보관 기간 등)을 지어내 추가하지 마라. 이유: 사실과 다른 법적 문서가 된다. 앱은 실제로 아무것도 수집하지 않는다.
- 저장 항목을 추측으로 쓰지 마라. `src/store/*.ts` 를 읽고 확인한 사실만 쓴다.
- `app/privacy.tsx` 를 만들지 마라. 이유: step 6 의 범위다.
- `docs/RELEASE.md` 를 수정하지 마라. 이유: step 8 의 범위다 (ADR 에 결정만 기록).
- `src/lib/dataSources.ts` / `docs/DATA_SOURCES.md` 마커를 건드리지 마라. 이유: step 7 의 범위다.
- 기존 테스트를 깨뜨리지 마라.
