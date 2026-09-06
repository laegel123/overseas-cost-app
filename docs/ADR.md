# Architecture Decision Records

해외 생활비 비교 앱의 비가역적 결정·트레이드오프를 기록한다. 각 결정은 `docs/adr/NNN-<slug>.md` 파일 1개로 관리하며, 본 문서는 전체 인덱스다.

**새 결정**: 다음 번호로 `docs/adr/NNN-<slug>.md` 새 파일을 만들고 아래 표에 1행 추가한다. 기존 ADR 을 뒤집을 때는 새 ADR 본문에 "Supersedes ADR-X" 를, 뒤집힌 ADR 상태 줄에 "Superseded by ADR-N" 을 명시한다.

## 철학

- **MVP 속도 > 완성도.** v1.0 은 "핵심 결정에 답을 주는 도구" 면 충분. 부가 기능은 v1.x 이후.
- **무료 인프라 우선.** 사이드 프로젝트라 운영비를 0 에 가깝게 유지한다. 출시 결정 후에만 결제(Apple/Google 개발자 계정).
- **외부 의존성 최소화.** 추가는 ADR 로 정당화. 제거는 가볍게.
- **데이터 정직성.** 추정치는 추정치라 명시하고, 출처를 숨기지 않는다.
- **단일 출처(Single Source of Truth)**: PRD → 기능, design/README → 시각, ADR → 비가역적 기술 결정.

## 인덱스

| ADR | 제목 | 상태 | 요약 |
|-----|------|------|------|
| [001](adr/001-mobile-first.md) | 모바일 앱 우선 (PWA·웹 보류) | Active | iOS·Android 네이티브 우선, 웹/PWA v2+ |
| [002](adr/002-react-native-expo.md) | React Native + Expo (Managed Workflow) 채택 | Active | Expo Managed + Expo Router 파일 기반 |
| [003](adr/003-nativewind-v4.md) | NativeWind v4 로 스타일링 | Active | Tailwind 클래스, 동적 토큰만 tokens.ts |
| [004](adr/004-zustand-asyncstorage.md) | Zustand + AsyncStorage (도메인별 스토어) | Active | 도메인 분리 스토어 + persist 미들웨어 |
| [005](adr/005-data-source-public.md) | 데이터 소스 — 수동 큐레이션 + 공공 데이터 | Active | Numbeo/Expatistan 직접 복제 금지 |
| [006](adr/006-fx-api-erapi.md) | 환율 API — open.er-api.com | Active | 무료 환율, 키 불필요, 일 1회 캐시 |
| [007](adr/007-target-korean-only.md) | v1.0 타겟 사용자 = 한국인 1국적 한정 | Active | 본국=서울, 다국적 v2+ |
| [008](adr/008-single-compare-mode.md) | 비교 모드 = 단일 (서울 vs 도시) | Active | 예산 시뮬레이터 보류 |
| [009](adr/009-no-accounts.md) | 사용자 계정·로그인 없음 | Active | 모든 데이터 AsyncStorage 로컬 |
| [010](adr/010-report-defer-v11.md) | 항목별 신고 기능 v1.1 로 미룸 | Active | v1.0 일반 피드백 이메일만 |
| [011](adr/011-no-analytics-v1.md) | 분석·추적 도구 v1.0 도입 안 함 | Active | GA·Amplitude·Sentry 0건 |
| [012](adr/012-hifi-web-reference.md) | 디자인 hifi = 웹 React 레퍼런스 (RN 포팅) | Active | div→View, className→NativeWind |
| [013](adr/013-test-policy-jest-rntl.md) | 테스트 정책 — Jest + RNTL | Active | 표준 모킹, 신규 모듈 인벤토리 필수 |
| [014](adr/014-error-handling-typed.md) | 에러 핸들링 — 결정적 에러 타입 + no silent fail | Active | 명시적 throw, ErrorView 노출 |
| [015](adr/015-a11y-wcag-aa.md) | 접근성 최소 기준 — WCAG AA + VoiceOver | Active | 색 대비 + 다이나믹 타입 + a11y 라벨 |
| [016](adr/016-defer-darkmode-i18n.md) | 다크모드·다국어·푸시·딥링크 v1.0 미지원 | Active | userInterfaceStyle: light 강제 |
| [017](adr/017-perf-budget.md) | 성능 예산 — 콜드스타트 ≤3s / 번들 ≤5MB | Active | iPhone 12/Pixel 6 기준 |
| [018](adr/018-data-license-defer.md) | 데이터 라이선스 결정 보류 | Active | M6 출시 직전 확정 |
| [019](adr/019-versioning-semver.md) | 버전 전략 — SemVer + runtimeVersion 분리 | Active | 데이터 스키마 변경 시 bump |
| [020](adr/020-branch-strategy.md) | 브랜치 전략 — main + feat-<phase> | Active | 1인 운영, self-review |
| [021](adr/021-support-email-only.md) | 고객 지원 채널 — v1.0 이메일 단일 | Active | 인앱 신고 v1.1 (ADR-010) |
| [022](adr/022-schema-migration-key.md) | 스키마 마이그레이션 — AsyncStorage 키 v suffix | Active | 스키마 변경 시 새 키 + 구 키 정리 |
| [023](adr/023-update-eas-first.md) | 앱 업데이트 — EAS Update 우선 | Active | JS-only OTA, 네이티브만 스토어 심사 |
| [024](adr/024-logging-policy.md) | 로깅 정책 — prod console.log 제거 | Active | ESLint + Babel 자동 제거 |
| [025](adr/025-data-disclaimer.md) | 데이터 책임 한계 고지 | Active | 푸터·설정·스토어·이용약관 명시 |
| [026](adr/026-fx-fallback-chain.md) | 환율 fallback chain | Active | open.er-api → ECB → 한국은행 하드코딩 |
| [027](adr/027-data-definition-std.md) | 데이터 정의 표준 (메디안·시내·국제학생) | Active | 모든 도시 동일 기준 (DATA.md §11) |
| [028](adr/028-manual-curation.md) | 데이터 수집 = 100% 수동 큐레이션 | Superseded by ADR-032 | (폐기) v1.0 100% 수동 |
| [029](adr/029-hosting-fallback.md) | 데이터 호스팅 fallback — GitHub Raw + jsDelivr | Active | primary 실패 시 CDN 자동 시도 |
| [030](adr/030-data-sources-doc.md) | 도시별 데이터 출처 매핑 단일 문서 | Active | DATA_SOURCES.md 단일 출처 |
| [031](adr/031-fetch-single-batch.md) | 도시 데이터 fetch — 단일 batch 파일 (all.json) | Active | 21개 도시 1회 fetch |
| [032](adr/032-data-automation-public.md) | 데이터 수집 = 공공 출처 100% 자동화 | Active | GitHub Actions cron, 수동 금지 |
| [033](adr/033-auto-change-verify.md) | 자동 변경 검증 — 변동 폭 기반 PR/commit 분기 | Active | <5% commit, ≥30% outlier PR |
| [034](adr/034-i18n-prep.md) | i18n 준비 — 노출 한국어 단일 출처 | Active | strings.ko.ts + errors.ko.ts |
| [035](adr/035-visual-regression.md) | 시각 회귀 — 스냅샷 1차 방어 | Active | RNTL snapshot, Percy v2+ |
| [036](adr/036-error-msg-korean.md) | 에러 메시지 한국어 표준 | Active | errors.ko.ts 카탈로그, 존댓말 60자 |
| [037](adr/037-share-defer.md) | 공유 기능 — v1.0 미지원 | Active | v1.x Share.share 도입 검토 |
| [038](adr/038-city-picker-defer.md) | 도시 picker — quick-switch 미도입 | Active | back→홈→다른 도시 경로 |
| [039](adr/039-operator-absence.md) | 운영자 부재 시 절차 — 자동화 + 휴면 | Active | outlier PR 정체 시 stale 알림 |
| [040](adr/040-scale-infra-v2.md) | 사용자 1M+ 확장 시 인프라 전환 | Active | v1.0 무료, 1M+ 시 CDN 전환 검토 |
| [041](adr/041-bottom-tab-routing.md) | 하단 탭 동작 — 즐겨찾기·비교 라우팅 단축 | Active | 비교=최근 도시, 즐겨찾기=첫 즐겨찾기 |
| [042](adr/042-unit-1kg.md) | 사과·양파 단위 — 1kg 통일 | Active | 디자인 "1개"→데이터 1kg 유지 |
| [043](adr/043-worklets-stub.md) | react-native-worklets 빈 plugin stub | Superseded by ADR-044 | (폐기) SDK 52 우회책 |
| [044](adr/044-expo-sdk-54-upgrade.md) | Expo SDK 52 → 54 업그레이드 | Active | React 19 / RN 0.81 / Router 6 |
| [045](adr/045-seed-fixture.md) | v1.0 시드 = schema-pass fixture | Active | 자동화 전 placeholder, 빌드 게이트 |
| [046](adr/046-fx-fallback-v1.md) | 환율 fallback v1.0 (1차+3차, 2차 ECB 보류) | Active | ECB 파싱 복잡 → v1.x 검토 |
| [047](adr/047-fx-baseline-quarterly.md) | FX_BASELINE 분기 갱신 정책 | Active | 분기 1회 한국은행 기준 갱신 |
| [048](adr/048-partial-schema-fail.md) | 부분 schema 실패 정책 (도시 제외 + warn) | Active | 개별 도시 실패 시 제외, 전체 X |
| [049](adr/049-seed-partial-availability.md) | 시드 fallback 부분 가용성 (서울+밴쿠버) | Active | 네트워크 실패 시 시드 2도시 |
| [050](adr/050-zustand-v4-persist.md) | zustand v4 채택 + persist 미들웨어 표준 | Active | v5 미채택, persist API 안정 |
| [051](adr/051-hydration-boundary.md) | hydration 합성 = 단일 boundary 함수 | Active | waitForAllStoresHydrated 패턴 |
| [052](adr/052-persist-parse-fail.md) | persist JSON.parse 실패 → hydration 미완 (defer) | Active | 타임아웃 시 부분 렌더 허용 |
| [053](adr/053-dev-web-bundling.md) | 개발용 web 번들링 활성화 | Active | Storybook·시각 검증용 web 빌드 |
| [054](adr/054-icons-lucide.md) | 아이콘 = lucide-react-native | Active | 22 아이콘, react-native-svg 의존 |
| [055](adr/055-safe-area-context.md) | SafeAreaView = safe-area-context 만 | Active | RN 표준 SafeAreaView 미사용 |
| [056](adr/056-home-mult-approx.md) | Home 카드 배수 = 단순화 총비용 근사값 | Active | Compare 정밀값과 별도, 근사 허용 |
| [057](adr/057-radius-token-split.md) | borderRadius 토큰 분화 (button/btn) | Active | 위계별 radius 토큰 분리 |
| [058](adr/058-persona-card-tokens.md) | PersonaCard 전용 토큰 | Active | (페르소나 제거로 실질 폐기) |
| [059](adr/059-automation-estimation.md) | 데이터 자동화 추정·보정 결정 | Active | CPI→실가 보정계수, 정적 관리 |
| [060](adr/060-rent-category-store.md) | 월세 카테고리 — 단일 선택 + 전역 store | Active | useRentChoiceStore 전역값 |
| [061](adr/061-tuition-tax-category.md) | 학비·세금 카테고리 — 도시별 선택 + 직접입력 | Active | 도시별 map + 직접입력 시트 |
| [062](adr/062-inclusion-toggle.md) | Compare 카테고리 포함/제외 토글 | 부분 supersede (ADR-067) | persona-aware default→고정 default |
| [063](adr/063-eas-build-android.md) | EAS Build 출시 전략 — Android 단독 v1.0 | Active | iOS v1.1+, Android 우선 출시 |
| [064](adr/064-eas-update-track.md) | EAS Update 도입 + 비공개 테스트 트랙 | Active | Closed testing 14일 게이트 |
| [065](adr/065-source-count-privacy.md) | 출처 유형 총수 단일 출처화 + 개인정보 링크 | Active | DATA_SOURCES_COUNT 상수화 |
| [066](adr/066-maestro-e2e.md) | Maestro 기반 E2E | Active | iOS 시뮬레이터 + YAML 플로우 |
| [067](adr/067-persona-removal.md) | 페르소나 개념 제거 + 온보딩 도시 선택 | Active | 통합 6카테고리 뷰, 온보딩=도시 선택 |
| [068](adr/068-adr-doc-split.md) | ADR 문서 구조 = 인덱스 + 파일당 1 ADR 분할 | Active | 번호=주소, 새 ADR=새 파일 |
| [069](adr/069-harness-doc-pull.md) | 하네스 가드레일 push → pull 전환 | Active | 색인만 주입, 본문은 step 이 Read |
| [070](adr/070-source-name-language.md) | 출처명 표기 언어 정책 + `legacyNames` 이름 이전 | Active | 서술형 출처명 한국어, 고유명 원어 |
| [073](adr/073-harness-single-step-mode.md) | 하네스 단일 step 실행 모드 `run --once` | Active | step 경계에서만 멈춤, 재시도 3회 유지 |
