# Step 8: docs-sync

## 배경

이 phase(`in-app-policy-pages`)는 데이터 출처·개인정보 처리방침을 외부 브라우저 링크에서 **앱 내부 화면**으로 옮겼다. 코드 작업은 step 0~7 에서 끝났다. 이 step 은 **구현과 어긋나게 된 문서를 사실에 맞춘다.**

### 이 phase 가 만든 변화 (문서에 반영해야 할 사실)

| 항목 | 변경 전 | 변경 후 |
| --- | --- | --- |
| 설정 "데이터 출처 보기" | `Linking.openURL` → GitHub `DATA_SOURCES.md` | `/sources` 인앱 화면 (도시 목록 → 도시별 출처 2단계 드릴다운) |
| 설정 "개인정보 처리방침" | `Linking.openURL` → GitHub Pages HTML | `/privacy` 인앱 화면 |
| 출처 수 표기 | `DATA_SOURCES_COUNT = 12` (큐레이션 상수) | 런타임 실측 unique 출처 수 (전량 로드 시 46, 번들 시드만이면 10) |
| 처리방침 본문 정본 | `docs/privacy-policy.html` | `src/lib/privacyPolicy.ts` → html·md 를 **생성** |
| tuition/visa 출처 URL | GitHub `DATA_SOURCES.md` 40건 | 도시별 실제 공공 출처 (대학 공식 페이지 / 정부 비자 페이지) |
| 화면 제시 방식 | (미구현) | 일반 Stack push — `docs/UI_GUIDE.md` §Sheet C 의 **full-screen modal 명세와 다름** |
| Compare "출처 보기 →" | `disabled` | **여전히 `disabled`** (ADR-071 결정 3 — 진입점은 설정 메뉴로 한정) |
| Detail 인라인 출처 목록 | 링크 없는 텍스트 목록 | **변경 없음** |

관련 ADR: `docs/adr/071-in-app-policy-pages.md`, `docs/adr/072-privacy-policy-source.md` (둘 다 이 phase 가 작성). `docs/adr/065-source-count-privacy.md` 는 부분 supersede 됐다.

### 문서 우선순위 규칙 (반드시 지킬 것)

- `docs/PRD.md` 는 **수정 금지** (CLAUDE.md — 단일 출처). PRD §148 "데이터 출처 보기 (별도 화면)" 과 §187 "개인정보 처리방침 페이지 (정적 텍스트)" 는 이 phase 가 오히려 **충족**시킨 것이라 편차가 아니다.
- `docs/UI_GUIDE.md` 는 **미구현 명세를 삭제하지 않고 편차표에 기록한다** (ADR-066 의 "스펙을 구현에 맞춰 하향" 결정). 로드맵 의도 보존을 위해 원안은 남기고 `⚠ v1.0 현황` 주석을 단다.
- `docs/privacy-policy.html` 과 `docs/PRIVACY.md` 는 **생성물이므로 손으로 고치지 않는다** (ADR-072).

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래 목록을 반드시 직접 Read 할 것:

- `docs/ADR.md` (인덱스) — `docs/adr/071-in-app-policy-pages.md`, `docs/adr/072-privacy-policy-source.md` (이 phase 의 두 결정), `docs/adr/065-source-count-privacy.md` (supersede 대상), `docs/adr/066-maestro-e2e.md` (편차표 정책의 근거), `docs/adr/070-source-name-language.md`
- `docs/UI_GUIDE.md` **전문** — 특히 §v1.0 구현 현황·스펙 편차 표(9~35줄 부근), §시트 콘텐츠 사양의 ⚠ 주석(211줄 부근), §Sheet C — 출처 보기(268줄 부근), §문구 카탈로그(408·432줄 부근), §설정 메뉴 정확 매핑 표(524~532줄 부근), §시트·모달(643줄 부근), §FreshnessBadge 절(604줄 부근)
- `docs/ARCHITECTURE.md` — §디렉터리 구조의 `app/` 트리(49줄 부근), §라우팅(81줄 부근), §라우팅 디테일(306줄 부근 — "예: 출처 보기 화면" 이라는 modal 언급), §화면별 백 동작 표(324줄 부근)
- `docs/RELEASE.md` — §5 스토어 제출 체크리스트(개인정보 URL 항목), §6.1 한국 PIPA 표, §7 개인정보 처리방침(165~210줄 부근 — 정책 문장과 코드블록 사본)
- `docs/design/README.md` — §5 Settings 항목 목록(117줄 부근)
- `docs/DATA.md` — §3.3 출처 표기 ("비교 화면 푸터에 출처 N개 카운트 + '출처 보기' 링크" 서술)
- `docs/TESTING.md` — §9 인벤토리(앞선 step 들이 이미 갱신했는지 확인), §18 수동 e2e 체크리스트, §18-A 자동 E2E(Maestro) 인벤토리
- `app/(tabs)/settings.tsx`, `app/sources/index.tsx`, `app/sources/[cityId].tsx`, `app/privacy.tsx` — **실제 구현**. 문서를 구현에 맞추는 작업이므로 구현이 기준이다.
- `.maestro/` 디렉터리 — 기존 E2E 플로우가 설정 메뉴 탭 동작에 의존하는지 확인

## 작업

### 1. `docs/UI_GUIDE.md`

- **§v1.0 구현 현황 편차표**: `출처 보기 모달` 행을 갱신한다. 현재는 "전체화면 Sheet C | Compare '출처 보기 →' **비활성**. Detail 은 인라인 텍스트 목록" 이다. 새 사실:
  - 문서 명세: 전체화면 Sheet C (modal)
  - v1.0 실제 구현: **설정 → `/sources` → `/sources/[cityId]` 2단계 일반 push 화면**. Compare "출처 보기 →" 는 여전히 비활성, Detail 은 인라인 목록 유지.
  - 근거 열에 실제 파일 경로를 적는다.
- **개인정보 처리방침 행 신규**: 편차표에 없던 항목이다. §설정 메뉴 정확 매핑 표(524~532줄 부근)의 "개인정보 처리방침 … **외부 링크**" 비고를 **인앱 화면**으로 고치고, "데이터 출처 보기 … `"12개" (출처 수)`" 를 런타임 실측 표기로 고친다.
- **§Sheet C — 출처 보기** 절: 원안 ASCII 목업은 **남기고**, 절 머리에 `⚠ v1.0 현황:` 주석을 추가해 "modal 이 아니라 일반 push 2단계 화면으로 구현. 진입점은 설정 메뉴뿐(Compare 는 비활성 유지). 카테고리 그룹핑과 '페이지 열기 →' 는 원안대로 구현" 을 적는다. §시트·모달(643줄 부근)의 "출처 보기: full-screen modal (Stack.Screen presentation: 'modal')" 서술에도 같은 주석을 단다.
- **§문구 카탈로그**: 새 화면의 사용자 문구(화면 제목, 부제, "페이지 열기 →", 빈 상태 문구 등)를 실제 구현에서 가져와 반영한다. **문구를 지어내지 말고 구현 파일에서 그대로 옮길 것.**
- 새 화면 두 종(`/sources`, `/sources/[cityId]`, `/privacy`)의 시각 사양을 간단히 추가한다 — 구현된 실제 마크업 기준.

### 2. `docs/ARCHITECTURE.md`

- **§디렉터리 구조**의 `app/` 트리에 `sources/index.tsx`, `sources/[cityId].tsx`, `privacy.tsx` 를 추가한다. `src/lib/` 트리에 `categoryMeta.ts`, `sources.ts`, `privacyPolicy.ts` 를 추가하고 **`dataSources.ts` 를 제거**한다.
- **§라우팅** 트리에 세 라우트를 추가한다:
  ```
  /sources                        # 데이터 출처 — 도시 목록
  /sources/[cityId]               # 도시별 출처 (카테고리 그룹)
  /privacy                        # 개인정보 처리방침
  ```
- **§라우팅 디테일**: "깊이 2단계 이상 push 시 `presentation: 'modal'` 옵션 활용 (예: 출처 보기 화면)" 문장을 정정한다. 실제 구현은 modal 을 쓰지 않으며, 그 근거는 ADR-071 결정 3 이다.
- **§화면별 백 동작** 표에 세 화면 행을 추가한다 (모두 이전 화면으로 back, iOS swipe-back 활성).

### 3. `docs/RELEASE.md`

- **§7**: "URL 변경 가능성을 고려해 앱에서 항상 외부 링크로 노출" 문장을 정정한다. 새 사실 — **앱 내부는 자체 화면(`/privacy`)으로 표시하고, 스토어 등록용 공개 URL(`docs/privacy-policy.html` → GitHub Pages)은 그대로 유지**한다. 근거로 ADR-071·ADR-072 를 링크한다.
- **§7 의 긴 코드블록 사본을 삭제**하고 "본문 정본은 `src/lib/privacyPolicy.ts` 이며 `docs/privacy-policy.html` / `docs/PRIVACY.md` 는 `npm run gen:privacy` 생성물" 이라는 안내 + 링크로 대체한다 (ADR-072 결정).
- **§5 스토어 제출 체크리스트**의 개인정보 URL 항목은 **그대로 유지**한다 — 스토어 등록 URL 은 여전히 필요하다. 다만 "앱 내에서도 동일 본문을 표시함" 을 한 줄 덧붙인다.
- **§6.1 PIPA 표**: 처리방침 접근 경로가 앱 내부로도 생겼음을 반영한다.

### 4. `docs/design/README.md`

§5 Settings 의 항목 목록에서 "데이터 출처 보기 / 개인정보 처리방침" 의 동작이 인앱 화면임을 반영한다. 디자인 문서는 시각 사양이 1차 출처이므로 **동작 서술만 최소한으로** 고친다.

### 5. `docs/DATA.md`

§3.3 의 "사용자에게 보이는 비교 화면 푸터에 `출처 N개` 카운트 + '출처 보기' 링크" 서술을 실제 구현에 맞춘다. Compare 푸터의 "출처 보기 →" 는 여전히 비활성이고, 실제 도달 경로는 설정 메뉴다.

### 6. `docs/TESTING.md` 마무리 점검

step 1~7 이 각자 인벤토리를 갱신했어야 한다. **누락된 것이 있으면 이 step 에서 채운다.** 확인 대상:

- `src/lib/categoryMeta.ts` (step 1)
- `src/lib/sources.ts` (step 2)
- `app/sources/index.tsx` (step 3)
- `app/sources/[cityId].tsx` (step 4)
- `src/lib/privacyPolicy.ts`, `scripts/gen_privacy_docs.mjs` (step 5)
- `app/privacy.tsx` (step 6)
- §9.29 갱신 + §9.33 "(삭제됨)" 표기 (step 7)
- §9-A.9 갱신 (step 0)

§18 수동 e2e 체크리스트에 새 화면 3개의 확인 항목을 추가한다 (설정 → 출처 → 도시 → 페이지 열기, 설정 → 개인정보).

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm test
```

문서 정합 검증:

```bash
# 사라진 상수·URL 이 문서에 남아 있지 않은지
grep -rn "DATA_SOURCES_COUNT" docs/ && exit 1 || true

# 처리방침 생성물이 최신인지 (step 5 의 드리프트 테스트가 npm test 에서 이미 확인하지만 재차)
npm run gen:privacy && git diff --exit-code docs/privacy-policy.html docs/PRIVACY.md

# PRD 는 수정되지 않았는지
git diff --name-only | grep 'docs/PRD.md' && exit 1 || true
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. **문서를 구현에 맞췄는지 역방향으로 확인한다** — 문서에 적은 화면 문구·동작을 실제 구현 파일(`app/sources/*`, `app/privacy.tsx`, `app/(tabs)/settings.tsx`)에서 하나씩 대조한다. 문서가 앞서가면(구현에 없는 것을 있다고 쓰면) 잘못이다.
3. 아키텍처 체크리스트:
   - `docs/PRD.md` 를 수정하지 않았는가? (CLAUDE.md CRITICAL)
   - UI_GUIDE 의 미구현 명세를 **삭제하지 않고** 편차표 + `⚠ v1.0 현황` 주석으로 처리했는가? (ADR-066)
   - `docs/privacy-policy.html` / `docs/PRIVACY.md` 를 손으로 고치지 않았는가? (ADR-072 — 생성물)
   - 새 결정을 지어내지 않고, ADR-071·ADR-072 에 이미 기록된 결정만 문서에 반영했는가?
4. 결과에 따라 `phases/in-app-policy-pages/index.json` 의 step 8 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `docs/PRD.md` 를 수정하지 마라. 이유: CLAUDE.md 가 수정 금지 단일 출처로 지정했다.
- `docs/UI_GUIDE.md` 의 Sheet C 원안 목업이나 미구현 명세를 **삭제하지 마라**. 이유: ADR-066 이 "로드맵 의도 보존을 위해 삭제하지 않고 표기만 유지" 로 정했다. 편차표 + ⚠ 주석으로 처리한다.
- `docs/privacy-policy.html` / `docs/PRIVACY.md` 를 직접 편집하지 마라. 이유: ADR-072 의 생성물이다. 본문을 고치려면 `src/lib/privacyPolicy.ts` 를 고치고 `npm run gen:privacy` 를 돌린다.
- `docs/RELEASE.md` §5 의 스토어 등록 개인정보 URL 체크 항목을 삭제하지 마라. 이유: 스토어 심사에 여전히 필요한 요건이다 (앱 내 화면이 생겼다고 사라지지 않는다).
- 코드를 수정하지 마라. 이유: 이 step 은 문서 정합 전용이다. 문서와 구현이 어긋나면 **문서를 구현에 맞춘다** (구현 변경이 필요하다고 판단되면 그것은 별도 step/phase 의 일이므로 `blocked` 로 보고한다).
- 새 결정을 문서에 지어내지 마라. ADR-071·ADR-072 에 기록된 범위만 반영한다.
- 기존 테스트를 깨뜨리지 마라.
