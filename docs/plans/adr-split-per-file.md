# 설계 문서: ADR 단일 파일 → 인덱스 + ADR 1개당 1파일 분할

> **상태**: 승인됨 (전략 확정, 미착수)
> **작성일**: 2026-07-07
> **실행 방식**: 다음 세션에서 하네스(`phases/`)로 phase 초기화 후 단계별 실행 예정 (`python3 scripts/execute.py init adr-split --steps 6 --project overseas-cost-app`)
> **관련 ADR**: 신규 **ADR-068** "ADR 문서 구조 = 인덱스 + 파일당 1 ADR 로 분할" 추가 (본 분할 결정 자체를 새 구조 안에 `docs/adr/068-adr-doc-split.md` 로 기록 — self-consistent). 분할 후 총 68개.
> **사용자 확정 결정**: (1) 분할 전략 = **A. 1 ADR = 1 파일 + 인덱스**, (2) 실행 = 본 계획 문서화 후 다음 세션 하네스

이 문서는 다음 세션에서 하네스가 이어받을 수 있도록 저장소에 영속화한 설계 스펙이다. **코드/문서 변경은 아직 수행하지 않았다.**

---

## Context (왜)

`docs/ADR.md` 가 **1,431줄 / 122KB / ADR 67개**로 커졌다. 단일 파일이라 (1) 특정 ADR 로의 이동이 스크롤·검색에 의존하고, (2) 새 ADR 추가 시 diff·머지 충돌 표면이 파일 전체이며, (3) 앞으로도 무한히 커진다.

**핵심 사실 — 분할해도 깨지는 링크가 없다.** 저장소 전역에서 `docs/ADR.md#adr-032` 같은 **앵커 링크 참조가 0건**이다. 모든 참조는 `ADR-044`, `Superseded by ADR-032`, `docs/ADR.md ADR-066` 같은 **순수 텍스트(번호) 참조**뿐이다. 따라서 번호→파일 매핑만 결정론적이면 이동은 오히려 쉬워지고, 기존 참조는 전부 유효하게 유지된다.

## 확정된 목표 구조

```
docs/
  ADR.md                     ← 헤더 + 철학 + 워크플로우 안내 + 전체 인덱스 표(67행)만 남김
  adr/
    001-mobile-first.md
    002-react-native-expo.md
    ...
    044-expo-sdk-54-upgrade.md
    067-persona-removal.md
```

- **번호가 곧 주소**: `ADR-044` → `docs/adr/044-*.md`. 파일명 `NNN-` 접두는 3자리 zero-pad 라 사전순 = 번호순.
- **새 ADR = 새 파일**: 기존 파일 무변경 → 머지 충돌·거대 diff 소멸 (전역 지침 "정밀한 수정" 부합).
- **`docs/ADR.md` 는 인덱스로 존치**: CLAUDE.md·README·ARCHITECTURE 등의 기존 `docs/ADR.md` 참조가 그대로 인덱스로 착지. "전체 결정 훑어보기" 는 인덱스 표로 보존 (단일 스크롤 경험 유지).
- **단일 출처 보존**: 각 ADR 본문은 정확히 한 파일에만 존재. 인덱스는 링크·제목·상태·1줄 요약만 (본문 중복 금지).

## 검증 결과 — 정확성 블로커 없음

- ADR 번호는 **001~067 연속, 결번 없음, 총 67개**. (파일 내 물리 순서는 뒤섞여 있으나 — 040/036/033/031/042 등이 뒤에 삽입됨 — 번호 기준 분할이 이를 자동 정규화한다.)
- 앵커 링크 참조 0건 → 이동은 순수 콘텐츠 이동(무손실 transform). 코드는 전혀 건드리지 않음 (docs-only).
- supersede 관계는 번호 교차참조라 파일 분리와 무관하게 유지.

---

## 파일 규약 (구현 기준)

### 1) 파일명 — `NNN-<slug>.md`

- `NNN` = 3자리 zero-pad 번호 (`001`, `044`, `067`).
- `<slug>` = 제목에서 뽑은 **짧은 영문 kebab-case (≤4단어)**. **순전히 장식용**이다 — 모든 참조가 번호 기준이므로 슬러그 오타·개명은 무엇도 깨뜨리지 않고 검증도 번호 접두(`NNN-*`)로만 한다. 제안 슬러그는 부록 표 참조(실행 세션에서 미세 조정 가능).
- *대안(기각)*: 번호만(`044.md`) — 100% 기계적이지만 `ls docs/adr/` 브라우징성이 떨어짐. 슬러그가 값싸고 인덱스 링크 가독성을 높이므로 채택.

### 2) 개별 파일 본문 템플릿

원본 `### ADR-NNN: <제목>` 블록을 **본문 그대로** 옮기되 헤딩만 h1 로 승격하고, 상단에 인덱스 백링크 + 상태 줄을 추가한다:

```markdown
[← ADR 인덱스](../ADR.md)

# ADR-044: Expo SDK 52 → 54 업그레이드 (React 19 / RN 0.81 / Expo Router 6 / Reanimated 4)

> **상태**: Active

<원본 본문 그대로 — 결정/이유/트레이드오프/… 한 글자도 바꾸지 않음>
```

- **상태 줄**: 원본 ADR 본문에 이미 `**상태**:` 줄이 있으면 그 값을 그대로 사용, 없으면 `Active`. **여기서 상태를 새로 판정하지 않는다** (supersede 관계를 임의로 만들지 않음 — 마커가 있는 것만 반영). 알려진 non-Active: 부록 표 참조.
- 원본에 이미 `**상태**:` 줄이 본문에 있는 경우(028/043/062) 중복 표기하지 말고 그 줄을 그대로 둔다.

### 3) `docs/ADR.md` (인덱스) 새 구성

```markdown
# Architecture Decision Records

해외 생활비 비교 앱의 비가역적 결정·트레이드오프를 기록한다. 각 결정은 `docs/adr/NNN-<slug>.md` 파일 1개로 관리하며, 본 문서는 전체 인덱스다.
**새 결정**: 다음 번호로 `docs/adr/NNN-<slug>.md` 새 파일을 만들고 아래 표에 1행 추가한다. 기존 ADR 을 뒤집을 때는 새 ADR 본문에 "Supersedes ADR-X" 를, 뒤집힌 ADR 상태 줄에 "Superseded by ADR-N" 을 명시한다.

## 철학
<기존 철학 5줄 그대로>

## 인덱스

| ADR | 제목 | 상태 | 요약 |
|-----|------|------|------|
| [001](adr/001-mobile-first.md) | 모바일 앱 우선 (PWA·웹 보류) | Active | iOS·Android 네이티브 우선, 웹/PWA v2+ |
| … | … | … | … |
| [067](adr/067-persona-removal.md) | 페르소나 개념 제거 + 온보딩 도시 선택 | Active | 통합 6카테고리 뷰, 온보딩=도시 선택 |
```

- **요약 열**: 각 ADR **결정** 줄을 1줄로 압축(≤40자 목표). 실행 세션이 본문에서 도출.
- **상태 열**: §2 규칙과 동일 (028→`Superseded by ADR-032`, 043→`Superseded by ADR-044`, 062→`부분 supersede (ADR-067)`, 그 외 `Active`).
- 인덱스 표 = **수동 유지**(ADR 이 한 번에 하나씩 추가되는 기존 흐름과 동일). 자동 생성 스크립트는 §향후 참조(범위 밖).

---

## 참조 갱신 (필수 — 문구만, 링크 대상 아님)

`docs/ADR.md` 를 가리키는 곳은 전부 유효하게 남지만(인덱스로 착지), **워크플로우 문구**는 "단일 파일에 ADR-N 추가" → "새 파일 + 인덱스 행 추가"로 바꿔야 정합적이다:

- **`CLAUDE.md:43`** (`CRITICAL: 새 외부 의존성·결정 사항은 docs/ADR.md 에 ADR-N 추가 후 도입`) → "…`docs/adr/NNN-*.md` 새 파일 추가 + `docs/ADR.md` 인덱스 행 추가 후 도입".
- **`CLAUDE.md:78`** (문서 색인) → "`docs/ADR.md` — ADR 인덱스 (개별 결정은 `docs/adr/NNN-*.md`)".
- **`docs/UI_GUIDE.md:684`**, **`docs/ARCHITECTURE.md:488`**, **`docs/RELEASE.md:437`** — "새 ADR 추가" 문구를 새 파일 워크플로우로 미세 조정.
- **`.maestro/PLAN.md:8`**, **`.maestro/README.md:48`** (`docs/ADR.md ADR-066`) → `docs/adr/066-maestro-e2e.md` 로 재조준(선택 — 텍스트 참조라 그대로 둬도 무해하나 정밀성 위해 권장).
- `docs/plans/persona-removal-city-onboarding.md` 내 `docs/ADR.md` 언급은 **이력 문서이므로 무변경**.

---

## 실행 순서 (하네스 step; docs-only, 각 step 후 `npm test`·`npm run typecheck` 그린 유지 — 회귀 없음 확인용)

1. **`docs/adr/` 생성 + 67개 파일 추출** — 원본 각 `### ADR-NNN` 블록을 `docs/adr/NNN-<slug>.md` 로 이동(§2 템플릿). 무손실 검증: 추출 본문들을 번호순 concat 하면 원본 ADR 본문 집합과 바이트 동등(헤딩 승격·백링크·상태 줄 제외).
2. **ADR-068 신규 작성** — `docs/adr/068-adr-doc-split.md`. 본 분할 결정을 §2 템플릿으로 기록: 컨텍스트(단일 파일 비대화 + 앵커 링크 0건), 결정(인덱스+파일당 1ADR), 대안(테마별/번호구간 기각 사유), 영향(참조 무손실, 새 ADR=새 파일). 새 구조 안에 스스로를 담아 self-consistent.
3. **`docs/ADR.md` 인덱스로 재작성** — 헤더 + 철학 + 워크플로우 안내 + **68행** 인덱스 표(§3, 068 행 포함). 본문은 전부 제거(파일로 이동됨).
4. **워크플로우 문구 갱신** — CLAUDE.md 43/78, UI_GUIDE 684, ARCHITECTURE 488, RELEASE 437 (§참조 갱신).
5. **`.maestro` 재조준(선택)** — PLAN.md 8, README.md 48 의 `docs/ADR.md ADR-066` → `docs/adr/066-*.md`.
6. **검증 게이트**(아래 §검증) 전부 통과 확인 후 phase 완료 마킹.

## 검증 (end-to-end)

- **완전성(bijection)**: 001~068 각 번호마다 `docs/adr/NNN-*.md` 정확히 1개 존재. `for n in $(seq -w 1 68); do ls docs/adr/${n}-* ; done` 모두 1건. 역방향: `docs/adr/` 의 모든 파일이 인덱스 표에 1행. (001~067 은 원본 이동, 068 은 신규 작성.)
- **무손실**: 이동 전 원본 ADR 본문(001~067)과 이동 후 파일 본문 diff = 0 (헤딩 레벨·백링크·상태 줄만 차이). 실행 세션에서 `git show HEAD:docs/ADR.md` vs 추출 결과 대조. 068 은 신규라 대조 대상 아님.
- **링크 해석**: 인덱스 표의 모든 `adr/NNN-*.md` 링크가 실재 파일로 해석. 각 파일 상단 `../ADR.md` 백링크 유효.
- **잔존 참조 유효**: `grep -rn 'docs/ADR.md' --include='*.md' .` 결과가 전부 인덱스(존치 파일)로 착지. `ADR-NNN` 텍스트 참조는 번호 불변이라 전부 유효.
- **게이트**: `npm run typecheck` + `npm run lint` + `npm test` 그린(코드 무변경이라 회귀 없어야 정상 — 안전망).
- **`docs/TESTING.md`**: 코드/모듈 변경 없음 → 테스트 인벤토리 변경 없음. (문서 구조 변경은 §7 인벤토리 대상 아님.)

## 향후 (범위 밖, 옵션)

- `scripts/gen-adr-index.mjs` — `docs/adr/*.md` 프런트매터/헤딩을 읽어 인덱스 표를 생성, 드리프트 방지. 신규 스크립트라 테스트 동반 필요(개발 프로세스 규칙) → 별도 phase 로 분리 권장. 67행 수동 유지가 부담되면 그때 도입.

---

## 부록 — ADR 번호 → 제목 → 상태 → 제안 슬러그 (68행, 실행 세션 기준표)

상태: 원본 본문 마커 기준. 슬러그: 장식용 제안(개명 무해).

| ADR | 제목 | 상태 | 제안 슬러그 |
|-----|------|------|------------|
| 001 | 모바일 앱 우선 (PWA·웹 보류) | Active | mobile-first |
| 002 | React Native + Expo (Managed Workflow) 채택 | Active | react-native-expo |
| 003 | NativeWind v4 로 스타일링 | Active | nativewind-v4 |
| 004 | Zustand + AsyncStorage (도메인별 스토어) | Active | zustand-asyncstorage |
| 005 | 데이터 소스 — 수동 큐레이션 + 공공 데이터 | Active | data-source-public |
| 006 | 환율 API — open.er-api.com | Active | fx-api-erapi |
| 007 | v1.0 타겟 사용자 = 한국인 1국적 한정 | Active | target-korean-only |
| 008 | 비교 모드 = 단일 (서울 vs 도시) | Active | single-compare-mode |
| 009 | 사용자 계정·로그인 없음 | Active | no-accounts |
| 010 | 항목별 신고 기능 v1.1 로 미룸 | Active | report-defer-v11 |
| 011 | 분석·추적 도구 v1.0 도입 안 함 | Active | no-analytics-v1 |
| 012 | 디자인 hifi = 웹 React 레퍼런스 (RN 포팅) | Active | hifi-web-reference |
| 013 | 테스트 정책 — Jest + RNTL | Active | test-policy-jest-rntl |
| 014 | 에러 핸들링 — 결정적 에러 타입 + no silent fail | Active | error-handling-typed |
| 015 | 접근성 최소 기준 — WCAG AA + VoiceOver | Active | a11y-wcag-aa |
| 016 | 다크모드·다국어·푸시·딥링크 v1.0 미지원 | Active | defer-darkmode-i18n |
| 017 | 성능 예산 — 콜드스타트 ≤3s / 번들 ≤5MB | Active | perf-budget |
| 018 | 데이터 라이선스 결정 보류 | Active | data-license-defer |
| 019 | 버전 전략 — SemVer + runtimeVersion 분리 | Active | versioning-semver |
| 020 | 브랜치 전략 — main + feat-<phase> | Active | branch-strategy |
| 021 | 고객 지원 채널 — v1.0 이메일 단일 | Active | support-email-only |
| 022 | 스키마 마이그레이션 — AsyncStorage 키 v suffix | Active | schema-migration-key |
| 023 | 앱 업데이트 — EAS Update 우선 | Active | update-eas-first |
| 024 | 로깅 정책 — prod console.log 제거 | Active | logging-policy |
| 025 | 데이터 책임 한계 고지 | Active | data-disclaimer |
| 026 | 환율 fallback chain | Active | fx-fallback-chain |
| 027 | 데이터 정의 표준 (메디안·시내·국제학생) | Active | data-definition-std |
| 028 | 데이터 수집 = 100% 수동 큐레이션 | **Superseded by ADR-032** | manual-curation |
| 029 | 데이터 호스팅 fallback — GitHub Raw + jsDelivr | Active | hosting-fallback |
| 030 | 도시별 데이터 출처 매핑 단일 문서 | Active | data-sources-doc |
| 031 | 도시 데이터 fetch — 단일 batch 파일 (all.json) | Active | fetch-single-batch |
| 032 | 데이터 수집 = 공공 출처 100% 자동화 | Active (Supersedes ADR-028) | data-automation-public |
| 033 | 자동 변경 검증 — 변동 폭 기반 PR/commit 분기 | Active | auto-change-verify |
| 034 | i18n 준비 — 노출 한국어 단일 출처 | Active | i18n-prep |
| 035 | 시각 회귀 — 스냅샷 1차 방어 | Active | visual-regression |
| 036 | 에러 메시지 한국어 표준 | Active | error-msg-korean |
| 037 | 공유 기능 — v1.0 미지원 | Active | share-defer |
| 038 | 도시 picker — quick-switch 미도입 | Active | city-picker-defer |
| 039 | 운영자 부재 시 절차 — 자동화 + 휴면 | Active | operator-absence |
| 040 | 사용자 1M+ 확장 시 인프라 전환 | Active | scale-infra-v2 |
| 041 | 하단 탭 동작 — 즐겨찾기·비교 라우팅 단축 | Active | bottom-tab-routing |
| 042 | 사과·양파 단위 — 1kg 통일 | Active | unit-1kg |
| 043 | react-native-worklets 빈 plugin stub | **Superseded by ADR-044** | worklets-stub |
| 044 | Expo SDK 52 → 54 업그레이드 | Active (Supersedes ADR-043) | expo-sdk-54-upgrade |
| 045 | v1.0 시드 = schema-pass fixture | Active | seed-fixture |
| 046 | 환율 fallback v1.0 (1차+3차, 2차 ECB 보류) | Active | fx-fallback-v1 |
| 047 | FX_BASELINE 분기 갱신 정책 | Active | fx-baseline-quarterly |
| 048 | 부분 schema 실패 정책 (도시 제외 + warn) | Active | partial-schema-fail |
| 049 | 시드 fallback 부분 가용성 (서울+밴쿠버) | Active | seed-partial-availability |
| 050 | zustand v4 채택 + persist 미들웨어 표준 | Active | zustand-v4-persist |
| 051 | hydration 합성 = 단일 boundary 함수 | Active | hydration-boundary |
| 052 | persist JSON.parse 실패 → hydration 미완 (defer) | Active | persist-parse-fail |
| 053 | 개발용 web 번들링 활성화 | Active | dev-web-bundling |
| 054 | 아이콘 = lucide-react-native | Active | icons-lucide |
| 055 | SafeAreaView = safe-area-context 만 | Active | safe-area-context |
| 056 | Home 카드 배수 = 단순화 총비용 근사값 | Active | home-mult-approx |
| 057 | borderRadius 토큰 분화 (button/btn) | Active | radius-token-split |
| 058 | PersonaCard 전용 토큰 | Active (페르소나 제거로 실질 폐기 — 마커 없음, 실행 세션 판단) | persona-card-tokens |
| 059 | 데이터 자동화 추정·보정 결정 | Active | automation-estimation |
| 060 | 월세 카테고리 — 단일 선택 + 전역 store | Active | rent-category-store |
| 061 | 학비·세금 카테고리 — 도시별 선택 + 직접입력 | Active | tuition-tax-category |
| 062 | Compare 카테고리 포함/제외 토글 | **부분 supersede (ADR-067)** | inclusion-toggle |
| 063 | EAS Build 출시 전략 — Android 단독 v1.0 | Active | eas-build-android |
| 064 | EAS Update 도입 + 비공개 테스트 트랙 | Active | eas-update-track |
| 065 | 출처 유형 총수 단일 출처화 + 개인정보 링크 | Active | source-count-privacy |
| 066 | Maestro 기반 E2E | Active | maestro-e2e |
| 067 | 페르소나 개념 제거 + 온보딩 도시 선택 | Active (Supersedes ADR-062 부분) | persona-removal |
| 068 | ADR 문서 구조 = 인덱스 + 파일당 1 ADR 분할 | Active (신규) | adr-doc-split |

> ADR-058 주의: 본문에 supersede 마커가 **없다**. 기계적 분할에서는 `Active` 로 이동하되, 페르소나 제거(ADR-067)로 실질 폐기 상태이므로 실행 세션에서 "부분/deprecated 표기 추가" 여부를 별도 판단(범위 확대 지양 시 그대로 이동 + 별도 보고).
