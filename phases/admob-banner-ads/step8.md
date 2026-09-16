# Step 8: docs

## 배경

이 phase(`admob-banner-ads`)는 Google AdMob 하단 배너를 홈·비교·상세 3개 화면에 도입한다. step 0~7 로 구현은 끝났다 (스파이크 → lib → store → Screen footer → AdBanner → 루트 트리거·화면 배선 → 설정 메뉴 → 처리방침·스토어 문서).

**이 step 은 결정을 문서로 고정한다:** ADR-077 신규(ADR-011 supersede), CLAUDE.md CRITICAL 규칙, ARCHITECTURE·UI_GUIDE·TESTING·README·`.maestro/PLAN.md` 정합. 코드 변경은 없다. 문서는 **구현을 기준**으로 쓴다 — 설계 문서와 구현이 다르면 구현이 맞고, 그 차이를 ADR 에 기록한다.

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래를 반드시 직접 Read 할 것:

- `CLAUDE.md` **전문** — 수정 대상 (기술 스택 목록 12~15행, 아키텍처 규칙 CRITICAL 목록)
- `docs/plans/admob-banner-ads.md` — §사용자 확정 결정, §확정된 동작 변화, §L 표 (이 step 의 목록), §Maestro E2E, §운영자 수동 작업, §범위 밖
- `phases/admob-banner-ads/SPIKE_RESULT.md` — step 0 결과 (ADR-077 에 기록할 라이브러리 버전·빌드 결과·`moduleSuffixes`·`expo-build-properties` 여부)
- `phases/admob-banner-ads/index.json` — step 0~7 의 `summary` (구현 실체)
- `docs/adr/011-no-analytics-v1.md` — supersede 대상. `docs/adr/075-hero-basket-sum-wording.md` — ADR 파일 형식. `docs/adr/076-source-attribution-compliance.md` — 앞선 phase 의 관련 결정
- `docs/ADR.md` — 인덱스 (076 행이 있는지, 077 이 비어 있는지 확인. **번호가 선점됐으면 078 로 밀고 모든 참조를 맞춘다**)
- `docs/ARCHITECTURE.md` — §디렉터리 구조(5행), §상태 관리(171행), §부팅·hydration 순서(226행, step 5 가 이미 한 단계 추가했는지 확인), §에러 타입 카탈로그(261행, step 1 이 행을 추가했는지 확인), §외부 의존성 정책(482~490행 "분석/추적 → v1.0 도입 안 함")
- `docs/UI_GUIDE.md` — §v1.0 구현 현황·스펙 편차 표(11~35행), §UI 텍스트 한국어 표준(382행~, step 6 이 설정 문구를 넣었는지 확인)
- `docs/TESTING.md` — §5.1(step 1 갱신 확인), §9.42~9.46(step 1~5 가 넣었는지 확인), §18 수동 e2e, §18-A.1 정책(3937행)
- `README.md` — §기술 스택 표(13~24행), 개발 시작 절 (`grep -n "npm run dev\|Expo Go" README.md`)
- `.maestro/PLAN.md` — §0 준비(12행), §1 배치별 리스크(38행~), §2 수동 관찰 항목(82행)
- `src/lib/ads.native.ts`, `src/store/ads.ts`, `src/components/AdBanner.native.tsx`, `app/_layout.tsx` — **실제 구현** (문서의 기준)
- `.eslintrc.js` — step 1 의 `no-restricted-imports`

## 작업

### 1. `docs/adr/077-admob-banner-ads.md` (신규) + `docs/ADR.md`

형식은 075 참고 (`[← ADR 인덱스]`, 제목, 상태, 맥락, 결정, 대안, 트레이드오프, 후속). **Supersedes ADR-011** (광고 SDK 부분만 — 분석·오류 추적 SDK 미도입은 여전히 유효).

결정 항목 (구현 기준으로 서술):

1. 광고 네트워크 Google AdMob, `react-native-google-mobile-ads` 16.x (SPIKE_RESULT 의 정확한 버전). 형식은 anchored adaptive 배너 1종.
2. 노출 화면 홈·비교·상세의 **ready 상태만** (`Screen.footer`). 온보딩·설정·출처·개인정보 화면 광고 금지. loading·error 화면 금지 사유(AdMob 무효 트래픽 정책).
3. 동의: UMP `gatherConsent` → `initialize` → `getConsentInfo`. iOS ATT 사용. `bootReady && onboarded` 이후 1회, 비차단, 온보딩 화면 위 프롬프트 없음. 설정 "광고 개인정보 설정" 은 `privacyOptionsRequirementStatus === 'REQUIRED'` 만 (TCF 의무).
4. lib 경유 단일 지점 `src/lib/ads.{native,web}.ts`; ESLint `no-restricted-imports` 로 강제; 웹은 no-op.
5. 테스트/프로덕션 스위치 `EXPO_PUBLIC_ADS_TEST=1 || __DEV__` → 테스트 광고 단위. 프로덕션 placeholder → `AdsConfigError` 로 광고만 꺼짐 (빌드 실패 아님 → RELEASE_CHECKLIST 로 강제).
6. 에러 정책: ErrorView 없음. 결과 객체 `error` + store `disabled` + `__DEV__` console.error — "삼키기" 가 아니라 상태 노출.
7. 배너 높이는 SDK 계산 → 코드에 px 없음 (매직 넘버 규칙 예외 아님을 명시). 로드 전 0 높이, 1회 레이아웃 시프트 수용.
8. `useAdsStore` 비영속·hydration 미참여.
9. 버전 1.1.0 (네이티브 의존성 추가 = 새 바이너리, major 아님). `tsconfig` `moduleSuffixes` 추가 사유. `expo-build-properties` 추가 여부와 사유 (SPIKE_RESULT).
10. 대안 기각: Kakao AdFit(RN/Expo 공식 미지원), 전면 광고(정책·UX), 분석 SDK 동시 도입(범위).
11. 후속(범위 밖): 미디에이션·빈도 제어·다크모드 배너·태블릿, 출처명 ADR 번호 노출 정리.

`docs/ADR.md`: 077 행 추가, 011 행 상태를 `Superseded by ADR-077 (광고 부분)` 로.

### 2. `docs/adr/011-no-analytics-v1.md`

상태 줄을 `Superseded by ADR-077 — 광고 SDK(AdMob) 도입. 분석·오류 추적 SDK 미도입 결정은 여전히 유효` 로. 본문은 남긴다.

### 3. `CLAUDE.md`

- 기술 스택 목록에 `- 광고: **Google AdMob** (react-native-google-mobile-ads, UMP 동의 — ADR-077)` 추가.
- 아키텍처 규칙에 CRITICAL 추가 (한 항목): "광고 SDK(`react-native-google-mobile-ads`)는 `src/lib/ads.native.ts` 와 `src/components/AdBanner.native.tsx` 만 import 한다 (ESLint 강제). 광고는 홈·비교·상세 **ready 상태**의 `Screen footer` 에만 둔다. 온보딩·설정·출처·개인정보 화면과 loading·error 화면에 광고 금지. 개발·프리뷰 빌드는 `EXPO_PUBLIC_ADS_TEST=1` (테스트 광고 단위). 개인정보 처리방침 '광고' 섹션의 수집 항목이 SDK 실태와 어긋나면 안 된다 (ADR-077)."
- §명령어의 `npm run dev` 설명에 "Expo Go 불가 — 네이티브 모듈. `npx expo run:ios` dev build 필요" 를 덧붙인다.

### 4. `docs/ARCHITECTURE.md`

- §디렉터리 구조 트리에 `src/lib/ads.native.ts`·`ads.web.ts`(+`adsConfig.ts` 가 있으면), `src/store/ads.ts`, `src/components/AdBanner.{native,web}.tsx` 추가.
- §외부 의존성 정책: `분석/추적 → v1.0 도입 안 함` → `분석·오류추적 → 미도입 (ADR-011 유효 부분) / 광고 → Google AdMob, lib 경유 단일 지점 (ADR-077)`.
- §부팅·hydration 순서·§에러 타입 카탈로그·§상태 관리: step 1·2·5 가 넣은 내용이 있는지 확인하고 빠진 것만 보완.
- 플랫폼 분기 파일 규약 한 단락: `.native.ts` / `.web.ts` 쌍은 Metro·jest(iOS)·tsc(`moduleSuffixes`)가 해석하며, 웹 파일은 네이티브 모듈을 import 하지 않는다.

### 5. `docs/UI_GUIDE.md`

- §v1.0 구현 현황 편차표 행 추가: `| 광고 배너 | 디자인 원본 없음 | 홈·비교·상세 하단 anchored adaptive 배너, 로드 전 0 높이, 탭바 인접 border-t (ADR-077) | AdBanner.native.tsx, Screen.tsx footer |`.
- §UI 텍스트 한국어 표준: step 6 이 넣은 설정 문구 확인. `/sources` 푸터 문구는 앞선 phase(source-attribution)가 넣었는지 확인 — 없으면 추가.
- 접근성 절이 있으면 배너 컨테이너 `accessibilityLabel="광고"` 한 줄.

### 6. `docs/TESTING.md`

- §5 모킹 전략에 `react-native-google-mobile-ads` 항목이 §5.1 에 있는지 확인 (step 1).
- §9.42~9.46 이 전부 있는지 확인. 없는 것은 해당 step 의 구현·테스트 파일을 읽고 보완 (**인벤토리 누락 = step 미완**).
- §18-A.1 정책에 항목 추가: "**광고는 E2E 단언 대상 아님** — 테스트 광고도 네트워크 의존이라 비결정적. `ad-banner` testID 는 존재 확인용으로만. 동의 폼(ATT·GDPR)은 수동 체크."
- §18 수동 e2e 에 소절 `18.9 광고·동의 흐름 (ADR-077)` 체크리스트: (1) iOS 첫 실행 → 도시 선택 → Compare 에서 IDFA 설명 메시지 → ATT 시스템 알림 순서, 허용/거부 각각 배너 표시 (2) `AdsConsent.requestInfoUpdate({ debugGeography: 'EEA', testDeviceIdentifiers: [...] })` 를 dev 전용 경로로 켜 GDPR 폼 + 설정 "광고 개인정보 설정" 메뉴 노출 확인 (3) 비행기 모드에서 배너 슬롯 0 높이 (4) 온보딩·설정·출처·개인정보 화면에 배너 없음 (5) 로딩·에러 화면에 배너 없음.

### 7. `README.md`

- §기술 스택 표에 `| 광고 | Google AdMob (react-native-google-mobile-ads) — dev/preview 는 테스트 광고 |` 행.
- 개발 시작 절: "Expo Go 불가 (네이티브 모듈). `npx expo run:ios --device "iPhone 17 Pro"` 로 dev build 설치 후 `npm run dev`. `.env.example` 을 `.env` 로 복사 (`EXPO_PUBLIC_ADS_TEST=1`)" — `.env.example` 파일 자체는 step 9 가 만든다. 여기서는 안내만.

### 8. `.maestro/PLAN.md`

- §1 배치별 리스크의 `02-home`·`03-compare`·`05-detail`·`07-visual-a11y` 에 "하단 배너(로드 시 높이 발생)로 스크롤 거리가 달라질 수 있음. 스크린샷에 'Test Ad' 라벨은 정상(dev 빌드)" 한 줄씩.
- `01-onboarding`: step 5 summary 의 ATT 관찰 결과를 반영 — 뜬다면 `common/onboard.yaml` 의 `optional: true` 탭 설명, 안 뜬다면 "실 App ID + IDFA 메시지 게시 후 뜰 수 있음 → 그때 optional 탭 추가" 로 기록.
- §2 수동 관찰 항목에 TESTING §18.9 의 5개를 요약 링크.
- 상단에 "`maestro-debugger` 에이전트에 넘길 때 `ad-banner` 가 요소 트리에 추가됐음을 프롬프트에 명시" 한 줄.

### 9. `docs/plans/admob-banner-ads.md`

문서 상단 `> **상태**:` 줄을 `구현 완료 (phase admob-banner-ads, ADR-077)` 로 갱신. 본문은 이력이므로 수정하지 않는다.

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm test
test -f docs/adr/077-admob-banner-ads.md
grep -c '\[077\]' docs/ADR.md                                     # 1
grep -c 'Superseded by ADR-077' docs/ADR.md docs/adr/011-no-analytics-v1.md   # 각 1
grep -c 'ADR-077' CLAUDE.md docs/ARCHITECTURE.md docs/UI_GUIDE.md docs/TESTING.md .maestro/PLAN.md   # 각 ≥ 1
grep -c 'v1.0 도입 안 함' docs/ARCHITECTURE.md                    # 0
for s in 9.42 9.43 9.44 9.45 9.46; do grep -c "$s" docs/TESTING.md; done   # 각 ≥ 1
grep -c '18.9' docs/TESTING.md                                    # ≥ 1
grep -c 'AdMob' README.md                                         # ≥ 1
```

## 검증 절차

1. 위 AC 를 실행한다.
2. 아키텍처 체크리스트:
   - 문서가 **구현**과 일치하는가? (파일명·함수명·testID 를 구현 파일에서 확인)
   - ADR 번호 충돌이 없는가? (`ls docs/adr/ | grep 077`)
   - "수집 안 함"·"광고 없음" 잔재가 docs 전체에 남지 않았는가? (`grep -rn "광고 식별자·추적 SDK 도 사용하지 않습니다\|Data Not Collected\|광고·인앱 결제가 없습니다" docs/ CLAUDE.md README.md` → 0건. ADR-011 본문의 역사적 서술은 예외)
   - 페르소나를 되살리지 않았는가?
3. 결과에 따라 `phases/admob-banner-ads/index.json` 의 step 8 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` (ADR 번호, 갱신 문서 목록)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- 코드(`src/`, `app/`, 설정 파일)를 수정하지 마라. 이유: 문서 step 이다. 구현 결함을 발견하면 summary 에 적고 사용자 판단에 맡긴다.
- `docs/PRD.md` 를 수정하지 마라. 이유: 수정 금지 문서 (광고 언급이 없어 수정 불필요).
- `docs/plans/admob-banner-ads.md` 본문을 고치지 마라. 이유: 이력 문서. 상태 줄만 갱신.
- ADR-011 파일을 삭제하지 마라. 이유: ADR-068 — 번호 = 주소. supersede 는 상태 줄로만.
- `app.json`·`eas.json`·`.env.example` 을 만들거나 수정하지 마라. 이유: step 9 의 범위.
- 문서에 구현에 없는 동작을 적지 마라. 이유: 설계 문서와 구현이 다르면 구현이 기준이다.
