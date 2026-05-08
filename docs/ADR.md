# Architecture Decision Records

해외 생활비 비교 앱의 비가역적 결정·트레이드오프를 시간순으로 기록한다. 새 결정이 생기면 ADR-N 형식으로 추가하고, 기존 ADR 을 뒤집을 때는 새 ADR 에 "Supersedes ADR-X" 를 명시한다.

## 철학

- **MVP 속도 > 완성도.** v1.0 은 "핵심 결정에 답을 주는 도구" 면 충분. 부가 기능은 v1.x 이후.
- **무료 인프라 우선.** 사이드 프로젝트라 운영비를 0 에 가깝게 유지한다. 출시 결정 후에만 결제(Apple/Google 개발자 계정).
- **외부 의존성 최소화.** 추가는 ADR 로 정당화. 제거는 가볍게.
- **데이터 정직성.** 추정치는 추정치라 명시하고, 출처를 숨기지 않는다.
- **단일 출처(Single Source of Truth)**: PRD → 기능, design/README → 시각, ADR → 비가역적 기술 결정.

---

### ADR-001: 모바일 앱 우선 (PWA·웹 보류)

**결정**: iOS·Android 네이티브 앱으로 출시. 웹/PWA 는 v2 이후 검토.
**이유**: 한국 시장은 모바일 비중이 압도적이고, 사용자가 이주 결정처럼 "고민하는 시간 동안 반복 진입" 하는 패턴은 앱 스토어 검색 + 홈 화면 아이콘에서 더 강하다. 즐겨찾기·최근 본 도시 같은 재방문 장치도 앱 컨텍스트에서 자연스럽다.
**트레이드오프**: 출시 시 Apple Developer Program $99/년, Google Play Console $25(1회) 비용. 심사 거절 가능성. 무료 PWA 대비 진입 마찰 큼. 다만 결제는 M6 직전까지 보류 가능.

---

### ADR-002: React Native + Expo (Managed Workflow) 채택

**결정**: 프레임워크는 React Native 의 **Expo Managed Workflow**, 라우팅은 **Expo Router** (파일 기반).
**이유**:

- 단일 코드베이스로 iOS·Android 동시 지원 → 1인 사이드 프로젝트에 적합.
- 사용자가 JavaScript/TypeScript 친숙도 1순위.
- Expo Go 로 Mac 없이 iOS 미리보기 가능 → 개발 단계 0원 유지.
- Expo Router 의 파일 기반 라우팅은 Next.js 와 멘탈 모델이 같아 학습 곡선 작음.
- EAS Build / EAS Update 로 OTA 코드 배포 → 스토어 재심사 회피 빈도 ↑.
  **트레이드오프**: Native (Swift / Kotlin) 대비 일부 플랫폼 API 접근 제한. Bare workflow 로 전환할 일이 생기면 마이그레이션 필요. 현재 v1.0 범위에는 Bare 가 필요한 기능 없음.

---

### ADR-003: NativeWind v4 로 스타일링

**결정**: 모든 컴포넌트 스타일은 **Tailwind 클래스 + NativeWind v4** 로 작성. 동적 값·gradient·shadow 같이 NativeWind 로 표현 어려운 토큰만 `src/theme/tokens.ts` 에 보관.
**이유**:

- 디자인 토큰을 `tailwind.config.js` 단일 출처로 모을 수 있어 일관성 강제.
- StyleSheet.create 보일러플레이트 제거.
- 웹 디자인 hifi(JSX with className) 와 멘탈 모델 유사 → 포팅이 쉬움.
  **트레이드오프**: NativeWind v4 는 비교적 신생. Babel/Metro 설정 한 번 정착 필요. 일부 RN 전용 prop(예: `pointerEvents`) 은 `style` 으로 보완.

---

### ADR-004: Zustand + AsyncStorage (도메인별 스토어)

**결정**: 상태 관리는 **Zustand**, 영속화는 **`zustand/middleware/persist` + AsyncStorage**. 도메인별 스토어 분리 — `usePersonaStore`, `useFavoritesStore`, `useRecentStore`, `useSettingsStore`.
**이유**:

- 5화면 규모에 Redux 는 과함.
- AsyncStorage 어댑터가 표준화돼 있어 영속화·hydration 보일러플레이트 작음.
- 도메인 분리는 리렌더 범위를 좁히고 테스트 단위를 명확히 함.
  **트레이드오프**: 여러 스토어에 걸친 액션 조합 시 코드가 분산. v1.0 에서는 그런 케이스 없음 (페르소나 변경 → favorites 정리 같은 cross-store 흐름이 없음).

---

### ADR-005: 데이터 소스 — 수동 큐레이션 + 공공 데이터 (Numbeo·Expatistan 직접 복제 금지)

**결정**: 도시 비교 데이터는 **수동 큐레이션**. 출처는 통계청·각국 정부 통계·대학 공식 페이지·공공 부동산 플랫폼. **Numbeo / Expatistan 데이터를 우리 DB 로 직접 옮기지 않는다**(약관상 재배포 금지).
**이유**:

- 유료 API 사용 안 함 (사이드 프로젝트 비용 정책).
- 크라우드소싱은 콜드 스타트 문제로 v1.0 비현실적.
- 출시 도시 20개 × 항목 15~20개 = 300~400 데이터 포인트 → 1인 분기 큐레이션 가능 범위.
  **트레이드오프**: 데이터 신선도·정확도 한계. 분기 1회 갱신. v1.1 에서 사용자 신고 기능 도입(PRD §13).

---

### ADR-006: 환율 API — open.er-api.com (무료, 키 불필요)

**결정**: 환율은 `https://open.er-api.com/v6/latest/USD` 같은 무료 엔드포인트 사용. 일 1회 fetch 후 AsyncStorage 캐시.
**이유**: 무료 정책, API 키 발급 절차 없음, 사이드 프로젝트 영구 유지에 적합. 정확도는 일별 평균이라 생활비 비교에 충분.
**트레이드오프**: 운영자 변경 시 fallback 필요. 환율 변동성 큰 통화는 지연 반영 가능. 거래용이 아닌 정보 표시용이라 허용 범위.

---

### ADR-007: v1.0 타겟 사용자는 한국인 1국적 한정

**결정**: 본국 = 서울 단일, 사용자 국적 = 한국인. 다국적 지원·다른 출발지는 v2 이후.
**이유**:

- 본국 도시 다양화는 데이터·환율·UI 부담 모두 증가.
- 한국어 UI·한국식 단위(만/천) 가 1차 사용자 경험을 압도적으로 결정.
- 출시자 본인이 1차 사용자(밴쿠버 유학 경험) → 검증 빠름.
  **트레이드오프**: 영어권 한국 유학생도 동일 앱 가능하나 마케팅 채널이 달라짐. 다국적 확장은 v2 이후 별도 ADR.

---

### ADR-008: 비교 모드 = 단일 (서울 vs 도시) — 예산 시뮬레이터 보류

**결정**: v1.0 은 "내 본국(서울) vs 대상 도시" 단일 비교만. **예산 시뮬레이터 모드 (월 200만으로 어디 살 수 있나?) 는 도입하지 않는다**.
**이유**:

- 두 모드는 입력값·UI·데이터 가공이 완전히 다른 화면이 됨 → MVP 범위 초과.
- 단일 모드의 핵심 (배수 + 차액 + 페르소나 분기) 검증이 우선.
  **트레이드오프**: 예산 기반 사용자 페르소나(직업 미정 학생) 흡수력 떨어짐. v1.2~v2.0 에서 검토.

---

### ADR-009: 사용자 계정·로그인 없음 (로컬 저장만)

**결정**: v1.0 은 계정·로그인·기기간 동기화 없음. 모든 사용자 데이터는 AsyncStorage 로컬.
**이유**:

- 백엔드·인증 도입 시 운영 부담 ↑(보안·개인정보·서버 비용).
- v1.0 사용자 시나리오에 기기간 동기화 요구가 약함(이주 결정은 한 기기에서 충분히 끝남).
  **트레이드오프**: 기기 분실·교체 시 즐겨찾기 유실. v2.0 에서 도입 검토.

---

### ADR-010: 항목별 신고 기능은 v1.1 로 미룸

**결정**: "이 가격 부정확해요" 항목별 신고 버튼은 v1.0 제외. v1.0 은 설정의 일반 피드백 이메일만 운영.
**이유**: 출시 일정 단축 우선. v1.0 은 단일 피드백 채널로 충분히 데이터 신뢰성 의견 수집 가능.
**트레이드오프**: 출시 직후 항목별 정정 채널이 약함. v1.1 에서 카드별 🚩 버튼 + mailto 또는 인앱 폼으로 도입 (PRD §13).

---

### ADR-011: 분석·추적 도구 v1.0 도입 안 함

**결정**: GA·Amplitude·Sentry 등 어떠한 분석/오류 추적 SDK 도 v1.0 에 도입하지 않는다.
**이유**:

- 개인정보 처리방침 단순화.
- 사용자 0명 → 1,000명 단계에서는 정성 피드백이 정량 지표보다 가치 있음.
- 추후 도입 시 별도 ADR 로 결정 (Sentry 같은 오류 추적은 v1.x 우선 후보).
  **트레이드오프**: 크래시·사용 패턴 데이터 부재. 베타 단계는 직접 사용 + 지인 피드백으로 보완.

---

### ADR-012: 디자인 hifi 는 웹 React 레퍼런스 — RN 으로 1:1 포팅

**결정**: `docs/design/hifi/*.jsx` 는 div/className 기반 웹 React 코드다. RN 으로 옮길 때 div→View, span→Text, className→NativeWind 로 1:1 포팅하고, 디자인 토큰·간격·레이아웃은 그대로 보존한다.
**이유**: 디자이너의 의도가 픽셀 수준으로 명세돼 있어 시각 일관성 유지가 쉬움. 새로 디자인을 다시 그리지 않는다.
**트레이드오프**: 일부 웹 전용 속성(`overflowX`, CSS gradient text 등)은 RN 호환 형태로 변환 필요. NativeWind 클래스가 매칭되지 않는 토큰은 `src/theme/tokens.ts` 와 inline `style` 로 처리.

---

### ADR-013: 테스트 정책 — Jest + RNTL, 모듈별 인벤토리 강제

**결정**: 테스트 러너 Jest, 컴포넌트는 `@testing-library/react-native`, AsyncStorage·fetch·시간·SVG·라우터·Linking 은 표준 모킹 패턴 사용. 모든 신규 모듈은 `docs/TESTING.md` §7 인벤토리에 항목을 추가해야 step 완료로 간주.
**이유**: 하네스의 step AC 는 실행 가능한 명령이어야 하므로 곧 테스트 명령. 인벤토리 강제로 누락 방지. lib 100% / store 100% / 컴포넌트 80%+ 커버리지.
**트레이드오프**: Detox 같은 e2e 자동화 도입은 보류 (수동 체크리스트로 대체). 도입 시 별도 ADR.

---

### ADR-014: 에러 핸들링 — 결정적 에러 타입 + silent fail 금지

**결정**: 모든 lib 함수는 명시적 에러 타입을 throw 한다 (`UnknownCurrencyError`, `FxFetchError`, `CityParseError`, `CitySchemaError`, `CityNotFoundError` 등). 화면은 try/catch 로 받아 ErrorView/inline 배지/토스트 중 하나로 사용자에게 노출. silent fail 금지(catch 후 무시 금지).
**이유**: 사이드 프로젝트라도 데이터 신뢰성·운영 가시성이 핵심. 에러를 침묵하면 분기 갱신 시 잘못된 데이터가 누락 없이 반영되어 재현 어려움. 예외 타입을 두면 화면 단의 처리도 결정적.
**트레이드오프**: 보일러플레이트 약간 증가. 에러 타입 카탈로그 유지 필요(ARCHITECTURE.md §에러 핸들링 전략).

---

### ADR-015: 접근성 최소 기준 — WCAG AA + VoiceOver 라벨 100%

**결정**: WCAG AA 색 대비 기준 통과(본문 navy on white 등 검증 완료), 다이나믹 타입 지원, 모든 카드·행에 `accessibilityLabel` 작성("도시 X, 항목 Y, 서울 대비 N배" 형식), 색상에만 의존하지 않는 정보 표기(배수 화살표 + 숫자 + 색).
**이유**: 한국어 사용자 다양성 + 시각 보조 사용자 포용. 비교 앱은 숫자가 핵심이라 색맹·색약 사용자에게도 동일 정보 전달 필요.
**트레이드오프**: 라벨 작성 작업량 증가. 자동화 어려움(텍스트 컨텐츠가 동적). 테스트는 RNTL `getByA11yLabel` + 수동 VoiceOver 체크리스트로 보완.

---

### ADR-016: 다크 모드·다국어·푸시 알림·딥링크 v1.0 미지원

**결정**: 다크 모드, 다국어(i18n), 푸시 알림, 딥링크 처리 모두 v1.0 에서 미지원. `app.json` 의 `userInterfaceStyle: "light"` 강제. 푸시 권한 요청 화면 없음. `scheme` 은 예약(`overseascost://`)만 하고 실 처리는 v1.x.
**이유**: MVP 범위 통제. 각각 시각·문구·인프라가 추가로 필요해 출시를 늦춤.
**트레이드오프**: 출시 후 다크모드 사용자 불만 가능 → v1.x 우선순위 후보. 외부 채널에서 도시 페이지 직접 열기 불가 → 마케팅 도달 약화.

---

### ADR-017: 성능 예산 — 콜드스타트 ≤3s, 번들 ≤5MB

**결정**: iPhone 12 / Pixel 6 기준 콜드스타트 ≤3s, 화면 전환 ≤300ms, 메인 번들 gzipped ≤5MB. 측정은 EAS Build 결과 + 시뮬레이터 수동.
**이유**: 사이드 프로젝트라도 첫 인상은 핵심. 비교 앱은 "빨리 본다" 가 가치 — 부팅이 느리면 사용 빈도 감소.
**트레이드오프**: 자동 측정 인프라 부재 → 분기마다 1회 수동 측정. 회귀 발견이 늦을 수 있음.

---

### ADR-018: 데이터 라이선스 결정 보류 (v1.0 출시 직전 확정)

**결정**: 큐레이션 JSON 의 라이선스(MIT vs CC-BY-4.0)는 v1.0 출시 직전 (M6 단계) 확정. 그 전까지는 "license: TBD" 로 명시.
**이유**: 데이터 일부가 공공 통계 기반이라 출처 라이선스 검토 시간 필요. 결정 전 외부 재배포 안 됨.
**트레이드오프**: 외부 기여(PR) 받기 늦어짐. v1.0 단일 큐레이터 모델에서는 영향 작음.

---

### ADR-019: 버전 전략 — Semantic Versioning + runtimeVersion 분리

**결정**: 사용자 노출 버전은 SemVer (`v1.0.0`, `v1.0.1`, `v1.1.0`, `v2.0.0`). EAS Update 호환 키인 `runtimeVersion` 은 별도 정책으로 관리하되, 데이터 스키마·네이티브 의존성 변경 시 무조건 올린다.
**이유**: SemVer 가 사용자·운영자 모두에게 익숙. `runtimeVersion` 분리는 EAS Update 가 구 바이너리에 신 데이터를 보내는 사고를 방지.
**트레이드오프**: 두 버전 동시 관리 부담. 매 릴리스 체크리스트(RELEASE.md §1)로 보완.

---

### ADR-020: 브랜치 전략 — main + 하네스가 만드는 feat-<phase>

**결정**: `main` 만 배포 가능 상태. 작업은 하네스가 자동 생성하는 `feat-<phase>` 브랜치에서. 1인 운영이라 PR 리뷰는 self-review.
**이유**: 하네스의 자동 커밋 흐름과 정합. main 보호로 stale 코드가 사용자에게 가지 않음.
**트레이드오프**: 머지 전 회귀 발견 어려움 → 매 step AC + 매 phase 종료 시 수동 검증으로 보완. 향후 협업자 합류 시 PR 리뷰 도입.

---

### ADR-021: 고객 지원 채널 — v1.0 이메일 단일 (인앱 신고는 v1.1)

**결정**: v1.0 출시 시 피드백 채널은 이메일 1개. 항목별 인앱 신고는 v1.1 (ADR-010과 일치).
**이유**: 1인 운영 SLA 가 1주 best-effort 라 채널 다중화는 부담. 이메일이 가장 일반적·검색 가능.
**트레이드오프**: 항목별 정정 마찰 ↑. v1.1 의 인앱 mailto/폼 도입으로 해소.

---

### ADR-022: 스키마 마이그레이션 — AsyncStorage 키에 v 버전 suffix 강제

**결정**: 모든 영속화 키는 `<domain>:v<N>` 형식. 스키마 변경 시 새 키 생성 + 구 키 정리 + `runtimeVersion` bump.
**이유**: 기존 캐시가 신 코드와 호환 안 될 때 정의된 마이그레이션 경로가 필요. 키 이름 자체로 호환성을 표현.
**트레이드오프**: 마이그레이션 함수 작성 비용. 단, 스키마는 분기 단위로 안정 유지 가능 → 실제 마이그레이션은 드물게 발생.

---

### ADR-023: 앱 업데이트 메커니즘 — EAS Update 우선, 네이티브 변경만 새 바이너리

**결정**: UI·문구·데이터 fetch URL 등 JS-only 변경은 EAS Update 로 OTA. 네이티브 의존성·권한·`runtimeVersion` 변경은 새 바이너리 + 스토어 심사.
**이유**: 사이드 프로젝트는 출시 빈도가 낮을수록 좋음. EAS Update 로 패치 사이클 단축. 한편 OTA 가 네이티브 영역까지 변경하면 사고 가능 → 명확히 분리.
**트레이드오프**: 사용자가 강제 업데이트 받지 않음 (v1.0). 호환성 깨짐 시 startup gate 필요 → v1.1 검토.

---

### ADR-024: 로깅 정책 — 프로덕션 console.log 제거, warn/error 보존

**결정**: 개발 시 `console.log` 자유 사용. 프로덕션 빌드에서 ESLint `no-console` (`log`/`debug` 만 차단, `warn`/`error` 허용) + Babel `transform-remove-console` 로 자동 제거.
**이유**: 사용자 디바이스에 디버깅 로그 노출 방지. 그러나 warn/error 는 향후 crash reporting 도입 시 출처가 되므로 보존.
**트레이드오프**: 정책 위반 시 즉시 발견 어려움 → ESLint 가 PR/step 단계에서 catch.

---

### ADR-025: 데이터 책임 한계 고지를 앱·스토어에 명시

**결정**: "정보 참고용 · 실제 비용과 다를 수 있음" 문구를 (a) 비교 화면 푸터, (b) 설정 → 앱 정보, (c) 스토어 설명, (d) 이용약관에 모두 명시.
**이유**: 수동 큐레이션 데이터의 부정확성에 대한 법적·신뢰적 보호. 사용자가 단일 근거로 삼지 않게 유도.
**트레이드오프**: UI 에 고지 문구가 추가되어 약간 어수선. 디자인 토큰의 가장 작은 단위(11px tiny gray-2)로 충돌 최소화.

---

### ADR-026: 환율 fallback chain — open.er-api.com → ECB → 한국은행(수동)

**결정**: 환율 fetch 는 3단계 fallback. 1차 open.er-api.com (자동), 2차 ECB (자동, EUR base 환산), 3차 한국은행 분기별 하드코딩 값 (수동 갱신).
**이유**: 단일 출처 의존 시 운영 리스크 큼. open.er-api.com 운영자 변경·정책 변경 시 사용자에게 환율 표시 실패 → 비교 앱의 핵심 기능 마비. 3중 안전망으로 대비.
**트레이드오프**: 코드 복잡도·테스트 케이스 증가. 단, 각 단계는 독립적으로 동작 → 단위 테스트로 검증 가능 (TESTING.md §9.2).

---

### ADR-027: 데이터 정의 표준 — 메디안·시내·일반 슈퍼·국제학생 기준

**결정**: 모든 도시에 동일 정의 표준 적용 (DATA.md §11). 월세=메디안·시내 5km·1년 lease·가구미포함, 식재료=일반 슈퍼·정상가·일반 브랜드, 학비=국제학생 메인학과 등록금, 세금=단신 기준 단순화 추정.
**이유**: 표준 부재 시 도시 간 비교가 무의미해짐 (서울 평균 vs 밴쿠버 메디안 비교 불가). 큐레이터가 바뀌어도 일관성 유지.
**트레이드오프**: 표준에 안 맞는 도시 특수성 일부 손실 (예: 호치민은 그랩 오토바이가 일상이지만 표준상 시내버스 표기). 도시별 sources 코멘트로 보완.

---

### ADR-028: 데이터 수집 v1.0 = 100% 수동 큐레이션 (~~deprecated~~ Superseded by ADR-032)

**상태**: **Superseded by ADR-032**. 본 결정은 v1.0 출시 전 폐기됨. 이력 보존을 위해 본 ADR 은 남기되 실제 정책은 ADR-032 (공공 출처 100% 자동화) 적용.

**원래 결정 (참고용)**: v1.0 데이터 수집은 자동 스크래핑 0건, 100% 수동 (1인 분기 ~17시간 작업).

**폐기 사유**: 사용자 요구 — 자동 갱신을 통한 신선도 향상 + 운영 부담 감소. 약관 회색지대 출처(Zillow·Kijiji·Yelp 등) 대신 **공공 출처(정부 통계 API·공식 정부 페이지)** 만 사용하면 약관 위반 없이 자동화 가능함이 확인됨 (입자도 trade-off 수용).

---

### ADR-029: 데이터 호스팅 fallback — GitHub Raw + jsDelivr 미러

**결정**: 도시 JSON primary 호스팅은 GitHub Raw, backup 은 jsDelivr CDN (자동 미러). data.ts 의 fetch 가 primary 실패 시 자동으로 backup 시도.
**이유**: GitHub Raw 도 다운될 수 있고, repo 정책 변경 가능성도 있음. jsDelivr 는 GitHub 자동 미러링이라 우리가 별도 운영 부담 없이 backup 확보.
**트레이드오프**: jsDelivr 변경 가능성도 있음 (그 시점에 새 backup ADR). 둘 다 다운 시 시드 데이터 사용.

---

### ADR-030: 도시별 데이터 출처 매핑 단일 문서 (DATA_SOURCES.md)

**결정**: 21개 도시 × 카테고리별 출처 URL·필터·추출 방법을 단일 문서 `docs/DATA_SOURCES.md` 에 모음. 분기 갱신 시 그 문서가 actionable 가이드.
**이유**: 출처가 코드·이슈·노트에 흩어지면 신규 큐레이터가 진입 불가. 단일 문서로 "이 문서만 들고 한 도시를 1~2시간에 갱신할 수 있게" 한다.
**트레이드오프**: 문서 길이 증가 (~700행). 도시 추가 시 문서 부담. 단, 검색·교체가 쉽고 PR 리뷰가 직관적.

---

### ADR-032: 데이터 수집 = 공공 출처 100% 자동화 (Supersedes ADR-028)

**결정**: v1.0 부터 21개 도시 데이터를 **공공 출처에서 자동으로 갱신**. GitHub Actions cron + 출처별 `scripts/refresh/<source>.mjs` 스크립트. 수동 큐레이션 **금지**.

**자동화 대상 (모든 카테고리):**

- 임차료: 한국 국토부 / Statistics Canada / HUD·Census (US) / ONS (UK) / Destatis (DE) / INSEE (FR) / CBS (NL) / ABS (AU) / e-Stat (JP) / SingStat (SG) / GSO (VN) / DSC·FCSC (UAE)
- 식재료·외식: 한국소비자원 참가격 + 각국 통계청 CPI
- 교통: 각 교통공사 공식 페이지·API (TfL·MTA·TransLink·BVG·RATP·도쿄메트로·LTA·RTA 등)
- 학비: 각 대학 공식 international tuition 페이지
- 비자: 각국 정부 공식 페이지
- 환율: open.er-api.com (클라이언트 자동) + GitHub Actions backup

**핵심 정책 (CRITICAL):**

- 상업 플랫폼 (Zillow·Kijiji·Yelp·Numbeo·Expatistan 등) **사용 금지** (약관 또는 회색지대)
- 자동화 한계 항목은 sources 에 "static" / "estimated" / "manual-fallback" 마커로 투명하게 표기

**이유**:

- 사용자가 자동화 + 신선도 향상 요구
- 공공 출처는 약관상 자동 fetch 허용 (대부분 무료 API + Open Data 라이선스)
- 데이터 신선도 분기 → 주·월 단위로 향상
- 운영자 부담 70시간/년 → 30~40시간/년 (절반)

**트레이드오프**:

- 데이터 입자도 거침 (도시 평균 vs 동네별·매물별)
- 일부 도시 (호치민·두바이) 정부 데이터 입자도 한계 → "estimated" 마커
- 외식 1끼 가격은 CPI 평균 + 정적 보정계수 (실측 X)
- 자동화 인프라 초기 셋업이 별도 phase 로 추가됨 (Phase 6 data-automation, ~30~50시간)

**상세**: `docs/AUTOMATION.md` (인프라·workflow·script), `docs/DATA_SOURCES.md` (도시별 출처 매핑)

---

### ADR-034: i18n 준비 — 사용자 노출 한국어 단일 출처

**결정**: v1.0 한국어 강제이지만, 사용자 노출 한국어 문구를 가능한 한 `src/i18n/strings.ko.ts` + `src/i18n/errors.ko.ts` 두 파일에 모음. 컴포넌트의 인라인 한국어 사용 가능 (마이크로카피 분산은 비용 큼).
**이유**: v3+ 다국어 도입 시 마찰 감소. 에러 메시지·시트 본문·CTA 같은 핵심 텍스트는 분리 ROI 가 가장 큼. 컴포넌트 inline 까지 강제하면 v1.0 개발 비용 증가.
**트레이드오프**: 인라인 한국어가 있는 한 완전한 i18n 은 v3+ 작업 필요. 현재 수준은 핵심 텍스트만 분리.

---

### ADR-035: 시각 회귀 — 스냅샷 1차 방어, 스크린샷 회귀 v2 이후

**결정**: 시각 회귀 1차 방어는 RNTL snapshot (TESTING.md §6.5). 디자인 변경 PR 에서만 갱신. Percy·Chromatic 같은 스크린샷 비교 도구는 v2 이후 도입 검토.
**이유**: 사이드 프로젝트 비용 (Percy 유료) + 셋업 부담 큼. 스냅샷 + 수동 e2e 로 v1.0 충분.
**트레이드오프**: 시각 회귀 검출이 트리 구조 단위로 한정 (실제 픽셀 깨짐 일부 놓침). 수동 e2e 로 보완.

---

### ADR-037: 공유 기능 — v1.0 미지원, v1.x 텍스트 share, v2.0 이미지 share

**결정**: v1.0 공유 기능 0건. v1.x 에서 표준 OS share intent (`Share.share`) 로 텍스트 공유 도입 ("서울 vs 밴쿠버: 한 달 175만 vs 340만 (1.9배). 자세히: <앱 링크>"). v2.0 이미지 캡쳐 공유 검토.
**이유**: v1.0 단순함 우선. share intent 도입은 deep link scheme 처리·앱 링크 생성 등 추가 작업 필요. 사용자 요구가 v1.0 후 검증되면 v1.1~v1.2 우선순위로 이동.
**트레이드오프**: 입소문(viral) 마찰 ↑. 사용자가 친구에게 결과 공유하려면 스크린샷 직접 찍어야 함.

---

### ADR-038: 도시 picker — Compare 상단 quick-switch 미도입 (v1.0)

**결정**: Compare 화면에서 다른 도시로 빠른 전환 picker 미도입. 사용자는 back → 홈 → 다른 도시 검색·즐겨찾기 탭으로 이동.
**이유**: 즐겨찾기 가로 스크롤로 빠른 재진입 가능 (1탭) → picker 의 추가 가치 작음. UI 복잡도 증가.
**트레이드오프**: "토론토 본 후 바로 시드니 비교" 같은 시나리오에 마찰. v1.x 사용 패턴 보고 검토.

---

### ADR-039: 운영자 부재 시 절차 — 자동화 의존 + 휴면 모드

**결정**: 운영자 휴가·병가·이탈 시 자동화 인프라가 데이터 갱신을 계속 수행. outlier PR 처리 정체 시 데이터 stale 화면 알림. 1개월+ 부재 시 README 에 "운영 일시 중단" 공지.
**이유**: 1인 사이드 프로젝트라 SLA 약속 어려움. 자동화로 핵심 운영은 무인 가능.
**트레이드오프**: outlier 발견 시 정정 지연. v2 협업자 합류 시 백업 운영자 교차 검토.

---

### ADR-041: 하단 탭 동작 — v1.0 즐겨찾기·비교 탭은 라우팅 단축

**결정**: 디자인 BottomTabs 의 4개 탭 (홈/비교/즐겨찾기/설정) 중 별도 화면이 있는 것은 홈·설정 둘 뿐. 비교·즐겨찾기 탭은 v1.0 에서 라우팅 단축으로 동작 — 비교 탭 = 최근 본 도시 첫 번째로, 즐겨찾기 탭 = 즐겨찾기 첫 번째로. 도시 0개일 때는 홈으로 이동 + 토스트 안내. 별도 즐겨찾기 화면(목록 편집·정렬)은 v2 검토.
**이유**: 디자인은 4탭 시각 일관성, 별도 화면 디자인 없음. v1.0 단순함 우선. 즐겨찾기·최근 본 도시는 홈에서 충분히 접근 가능.
**트레이드오프**: 즐겨찾기 탭이 약간 비직관적 (별도 화면 기대). v2 별도 화면 도입 시 마찰 작음 (라우팅만 변경).

---

### ADR-042: 사과·양파 단위 — 1kg 통일 (디자인 mock 수정)

**결정**: 데이터 정의 (DATA.md §11.3) 의 `apple1kg` (사과 1kg) 표준 유지. 디자인 mock (`detail.jsx:80`) "사과 1개" 는 디자인 mock 수정 또는 표시 시 strings.ko 의 라벨 ("사과 1kg") 사용. 양파는 `onion1kg`, 디자인 mock 에 항목 추가 (현재 누락).
**이유**: 데이터 단위 일관성 (CPI·통계청은 모두 kg 기준). UI 표시는 strings.ko 분리로 향후 도시별 단위 변경 가능.
**트레이드오프**: 디자인 mock 과 미세한 시각 차이. 디자인 파일은 reference 이지 production 코드가 아니므로 (ADR-012) 허용.

---

### ADR-040: 사용자 1M+ 확장 시 인프라 전환 (v2 검토)

**결정**: v1.0 GitHub Raw + jsDelivr 무료 호스팅. 사용자 1M+ 도달 시 Cloudflare R2 또는 자체 CDN 전환 검토 (별도 ADR).
**이유**: 현재는 무료. 트래픽 폭증 시 jsDelivr 의존성 위험 + GitHub raw 대역폭 한계. 단, 1M+ 은 v2 시점 가정.
**트레이드오프**: 전환 시 비용 발생 (월 ~$5~20 추정). 그 시점에 광고 또는 freemium 검토 필요.

---

### ADR-036: 에러 메시지 한국어 표준

**결정**: 사용자에게 보이는 모든 에러 메시지를 `src/i18n/errors.ko.ts` 단일 출처에 카탈로그화. 모든 메시지: 존댓말·60자 이내·기술 용어 금지·사용자 다음 액션 명시.
**이유**: 메시지 일관성 + 다국어 도입 시 분리 가장 쉬움. 기술 용어 노출은 사용자 신뢰 저하.
**트레이드오프**: 에러 추가 시 두 곳 (errors.ts + UI_GUIDE.md 카탈로그) 동시 갱신 필요.

---

### ADR-033: 자동 변경 검증 — 변동 폭 기반 PR/commit 분기

**결정**: 자동 데이터 갱신 시 변동 폭에 따라 처리 분기. <5% = 자동 commit, 5~30% = 자동 PR + auto-update 라벨, ≥30% = 자동 PR + outlier 🚨 라벨 + 운영자 검토 필수.
**이유**: 자동화로 잘못된 값이 들어와도 outlier 검증으로 차단 가능. 작은 변동(인플레)은 운영자 부담 없이 즉시 반영, 큰 변동은 검토.
**트레이드오프**: 임계값 (5%·30%) 은 경험적 — 운영 후 조정 가능. 임계 변경 시 본 ADR 갱신.

---

### ADR-031: 도시 데이터 fetch — 단일 batch 파일 (`all.json`)

**결정**: 21개 도시(서울 + 20)를 **단일 `data/all.json`** 파일로 호스팅. 앱은 1회 fetch 로 모든 도시 데이터를 확보. 도시별 lazy fetch 채택 안 함.

큐레이터는 여전히 `data/cities/<id>.json` 도시별 파일에 편집(PR diff 가독성). build script (`scripts/build_data.mjs`) 가 분기 갱신 시 `cities/*.json` → `all.json` + `seed/all.json` 자동 합성.

**이유:**

- 모바일 사용자가 여러 도시를 빠르게 비교 → 한 번에 받는 것이 UX 우월
- 21개 합본 gzip 약 30~40KB (사진 1장 미만) → 데이터·시간 부담 무의미
- 24h 캐시 → 일 1회 fetch → GitHub raw rate limit 안전
- 캐시 정합성 (모든 도시 같은 시점 데이터, FX 와 별개로 도시 간 일관)
- 홈 화면 즐겨찾기 mult preview, 검색 기능 모두 즉시 동작 (메타 별도 fetch 불필요)
- 시드도 동일 형식 (`data/seed/all.json`) → 오프라인에서 모든 도시 표시 가능

**트레이드오프:**

- 한 도시만 갱신해도 사용자는 전체 파일 download (단, gzip 40KB 라 무의미)
- 메모리에 21개 도시 상시 로딩 (~150KB raw) — 모바일 부담 미미
- 도시 50개+ 으로 확장 시 (v2~v3) 재검토 필요 (그때 hybrid 또는 lazy 전환 가능)

---

### ADR-043: `react-native-worklets` 빈 plugin stub (Expo SDK 52 한정 우회책) — Superseded by ADR-044

**상태**: **Superseded by ADR-044**. SDK 52→54 업그레이드와 함께 폐기됨. `scripts/postinstall.js` 삭제, `react-native-worklets@0.5.1` 정식 dependency 로 들어옴 (reanimated 4 의 peerDependency 충족). 본 ADR 은 이력 보존을 위해 남긴다.

**원래 결정 (참고용)**: `scripts/postinstall.js` 가 `node_modules/react-native-worklets/plugin.js` 와 `package.json` 을 빈 stub 으로 자동 생성한다. stub plugin 은 `module.exports = function() { return {}; };` — Babel 이 require 만 통과시키면 되는 형태.

**이유**:

- Expo SDK 52 의 `babel-preset-expo` 는 `reanimated` 옵션이 켜진 상태에서 `react-native-worklets/plugin` 을 require 한다.
- 그러나 `react-native-worklets` 패키지는 SDK 52 의 명시적 의존성에 포함되어 있지 않아, 일반 `npm install` 후 `expo start` 가 `Cannot find module 'react-native-worklets/plugin'` 으로 실패한다.
- 우리는 reanimated worklets 기반 기능 (UI thread shared values 등) 을 사용하지 않으므로 실제 plugin 동작은 필요 없다. require 만 성공하면 충분.
- `package.json` 에 `react-native-worklets` 를 정식 dependency 로 추가하지 않는 이유: 본 패키지는 reanimated 의 native 코드와 lockstep 으로 묶이는데, SDK 가 해당 버전을 명시하지 않은 상태에서 우리가 임의 버전을 박으면 차후 SDK 업그레이드에서 충돌 가능. stub 이 더 안전.

**트레이드오프**:

- `node_modules` 를 직접 수정 — 일반적으로 안티패턴. `postinstall` 자동 실행으로 항상 멱등하게 유지.
- 향후 reanimated worklets 기능을 실제로 사용하게 되면 본 우회책 제거 + 정식 의존성 추가 필요.

**폐기 조건**: Expo SDK 53+ 에서 `react-native-worklets` 가 정식 의존성으로 들어오는 시점 (SDK 53 부터 reanimated 4 가 worklets 를 별도 패키지로 명시 dependency 처리). SDK 업그레이드 PR 에서 본 파일·ADR 동시 제거 예정.

---

### ADR-044: Expo SDK 52 → 54 업그레이드 (React 19 / RN 0.81 / Expo Router 6 / Reanimated 4)

**결정**: 프로젝트 SDK 라인을 **Expo SDK 52 → 54** 로 업그레이드. 핵심 의존성 동시 갱신:

| 패키지                     | SDK 52        | SDK 54        |
| -------------------------- | ------------- | ------------- |
| expo                       | ~52.0.0       | ^54           |
| react                      | 18.3.1        | 19.1.0        |
| react-native               | 0.76.9        | 0.81.5        |
| expo-router                | ~4.0.0        | ~6.0.23       |
| react-native-reanimated    | ~3.16.1       | ~4.1.1        |
| react-native-worklets      | (stub 0.0.0)  | 0.5.1 (정식)  |
| react-native-gesture-handler | ~2.20.2     | ~2.28.0       |
| react-native-screens       | ~4.4.0        | ~4.16.0       |
| react-native-safe-area-context | 4.12.0    | ~5.6.0        |
| @react-native-async-storage/async-storage | ^1.23.1 | 2.2.0  |
| typescript                 | ~5.3.0        | ~5.9.2        |
| jest-expo                  | ~52.0.3       | ~54.0.17      |
| eslint-config-expo         | ~8.0.1        | ~10.0.0       |
| @types/react               | ~18.3.0       | ~19.1.0       |
| react-test-renderer        | ^18.3.1       | 19.1.0        |

**이유**:

- 사용자 디바이스의 Expo Go 가 SDK 54 클라이언트로 업데이트됨 — SDK 52 프로젝트를 더 이상 Expo Go 에서 실행할 수 없음 (Expo Go 는 단일 SDK 만 지원).
- SDK 52 가 React 18.3 / RN 0.76 lifecycle 의 마지막 — React 19 (server components, use(), Suspense 개선) + RN 0.81 (new architecture default 강화) 의 안정 도입 적기.
- Expo Router v6 는 typed routes, async routes 등 v4 에서 제공 안 되는 기능. 우리 프로젝트가 화면 5개 규모라 마이그레이션 비용 작음.
- Reanimated 4 는 worklets 를 `react-native-worklets` 별도 패키지로 분리 → SDK 52 에서 우리가 stub 으로 우회하던 의존성 누락 문제 (ADR-043) 가 자연 해소.

**핵심 변경 사항 (이번 PR 에서 함께 처리)**:

1. **`scripts/postinstall.js` 삭제 + `package.json scripts.postinstall` 제거** — ADR-043 우회책 폐기. 진짜 `react-native-worklets@0.5.1` 이 npm 으로 설치됨.
2. **`react-native-worklets-core@^1.6.3` devDependency 제거** — 코드에서 import 한 적 없는 미사용 패키지였고, reanimated 4 가 요구하는 것은 `react-native-worklets` (별개 패키지) 임을 확인.
3. **`tsconfig.json` 상속**: `expo/tsconfig.base` 가 `module: "preserve"` 를 사용 → TypeScript 5.9+ 필요.
4. **`eslint-config-expo` v8 → v10**: SDK 54 권장 버전. 기존 legacy `extends: ['expo']` 형태와 호환됨 (peer `eslint: >=8.10` 충족).
5. **npm install 시 `--legacy-peer-deps` 필요**: expo-router 6 의 `react-server-dom-webpack` peerOptional 이 19.0.4 || 19.1.5 || 19.2.4 만 허용하나 transitive 로 19.2.5 가 잡힘. peerOptional 이라 무시 가능. 향후 expo-router 패치 버전에서 peer 범위 완화되면 제거.

**트레이드오프**:

- Reanimated 4 는 worklets API 가 v3 와 일부 호환되지 않음 (`useSharedValue` 등은 동일하지만 일부 함수 시그니처 변화). 현재 우리는 worklets 사용 코드 0건이라 영향 없음. 향후 worklets 도입 시 v4 API 기준으로 작성.
- React 19 는 `forwardRef` deprecate 시작 (ref 가 prop 으로 들어옴). 현재 코드에 `forwardRef` 사용 0건 — 영향 없음. Phase 3+ 컴포넌트 작성 시 ref-as-prop 패턴 채택.
- `--legacy-peer-deps` 가 신규 기여자에게 약간의 마찰. README 또는 CLAUDE.md 에 명시 필요 (이번 PR 에 포함).
- Expo Go 만 지원 — dev client (네이티브 빌드) 사용 시 별도 검증 필요. v1.0 은 Expo Go 우선.

**검증**:

- `npm run typecheck`, `npm run lint`, `npm test` (3 passed) 모두 통과
- `npm run dev` → Metro 8081 LISTEN, `packager-status:running`, `expo doctor` `Incorrect dependencies: []`
- 사용자 디바이스 Expo Go 에서 실 부팅 확인은 머지 전 수동

---

### ADR-045: v1.0 시드 = schema-pass fixture (한시적)

**상태:** 채택 (2026-04-29)

**맥락:**

- v1.0 데이터 레이어는 `docs/ARCHITECTURE.md` §캐시·오프라인 전략 에 따라 네트워크 실패 시 번들 시드로 fallback 해야 한다.
- ADR-032 가 정한 데이터 정책: 모든 도시 값은 정부 통계 API · 공식 정부 페이지 등 **공공 출처에서 자동으로만** 갱신, 수동 큐레이션 금지.
- 자동화 phase (`docs/AUTOMATION.md`) 가 GitHub Actions cron + `scripts/refresh/<source>.mjs` 로 `data/all.json` 을 산출하지만, 이 phase 는 본 data-layer phase 보다 **늦게** 구현된다.
- 그 사이 시드 파일이 비어 있으면: (a) 첫 실행 + 네트워크 없음 = 빈 화면, (b) ARCHITECTURE 의 시드 fallback 명세 위반.
- data-layer phase step 2 가 WebFetch 로 직접 채집을 시도했으나, 핵심 출처 모두 자동 추출 불가 (KOSIS·한국소비자원 = `KR_DATA_API_KEY` 필수, CMHC RMR = Excel only, StatsCan CPI = CSV only, 서울교통공사 cert error / 403). schema 30 필드 중 5 필드만 추출 가능 → CLAUDE.md CRITICAL 의 추정 금지 규정에 막혀 step blocked.

**결정:**

1. v1.0 의 `data/seed/all.json` 은 step 1 에서 만든 schema-pass fixture (`src/__fixtures__/cities/{seoul,vancouver}-valid.ts`) 의 값을 **그대로** 사용한다.
2. fixture 값들은 schema 를 통과하고 차원적으로 현실적이지만 (서울 원룸 90만, 밴쿠버 oneBed 2300 CAD 등), **실제 출처 페이지로 검증되지 않은 placeholder** 다.
3. 출시 전 자동화 phase 가 1회 이상 실행되어 `data/all.json` 을 생성해야 한다. EAS 빌드 직전 게이트 (별도 phase) 가 이를 강제한다 — fixture 시드 상태로 production 빌드 금지.
4. 자동화 phase 가 산출한 실 `all.json` 이 GitHub raw 로 배포되면, 사용자 앱은 24h 내 자동 fetch 로 fixture 시드 위에 실 데이터를 덮어쓴다. 시드는 _완전 오프라인 신규 사용자_ 에게만 노출된다.

**대안 검토:**

- (A) `KR_DATA_API_KEY` (data.go.kr 공공데이터포털 키) 발급 + step 2 가 직접 채집: 본 phase 가 외부 secret 에 종속 + 자동화 phase 의 책임과 중복. 거부.
- (B) ADR-032 의 "수동 큐레이션 금지" 를 시드 한정 예외 명시 + 사용자가 PDF·Excel 리포트 손수 옮김: 분기 갱신마다 사람 시간 ~3시간, 드리프트 위험. 거부.
- (D) 시드 자체 제거, 네트워크 실패 시 ErrorView: ARCHITECTURE.md §캐시·오프라인 전략 위반 + 첫 콜드 스타트 빈 화면. 거부.

**결과 / 영향:**

- 본 phase (data-layer) 의 step 3·4 가 진행 가능 — currency.ts·data.ts 통합 smoke 가 schema-pass payload 로 동작.
- 자동화 phase 의 책임이 더 명확해진다: "출시 전 한 번은 반드시 실행되어야 한다."
- 출시 빌드 게이트 ADR (별도) 에서 _fixture seed 검출 → EAS build 거부_ 정책 명시 필요.
- `data/seed/all.json` 의 `lastUpdated` 와 `accessedAt` 는 fixture 작성일 (`2026-04-01`) 그대로 — 자동화가 덮어쓸 때 갱신.
- 사용자에게 **노출되는 데이터에는 영향이 없어야 한다** (출시 전 실 데이터로 교체).
- `src/lib/data.ts` (step 4) 가 시드 fallback 시 dev 콘솔에 명시적 warn 출력 — fixture 사용 가시성 확보.

**관련:** ADR-032 (데이터 자동화 정책), `docs/AUTOMATION.md`.

---

### ADR-046: 환율 fallback v1.0 = 1차(open.er-api) + 3차(하드코딩 baseline) — 2차 ECB 보류

**상태:** 채택 (2026-04-29)

**맥락:**

- ADR-026 이 정한 환율 fallback chain 은 3단계: (1) open.er-api.com (자동) → (2) ECB (자동, EUR base 환산) → (3) 한국은행 분기 하드코딩 값 (수동).
- data-layer phase step 3 (currency-converter) 에서 1차·3차 는 즉시 구현 가능. ECB 는 별도 작업이 필요하다:
  - ECB endpoint 는 XML 기반 (`<gesmes:Envelope>` 트리). RN 환경에 XML 파서 (`fast-xml-parser` 등) 신규 의존성 추가 필요.
  - ECB 는 EUR base 라 KRW 산출 시 두 단계 환산 (X→EUR→KRW) — 변환·테스트 코드 분리 필요.
- 1차 + 3차 만으로 가용성은 사실상 100% 확보:
  - 1차 open.er-api 는 무료·무인증, 운영 5년+ 안정 (실패율 측정 부재 — 운영 중 모니터링).
  - 3차 baseline 은 분기마다 한국은행 평균 환율로 갱신되는 코드 내 const. 1차 실패 + 캐시 stale 인 경우의 마지막 안전망.
- 사용자 영향: 1차 실패 + 캐시도 없는 cold-start 코너 케이스에서 stale 분기 평균 환율 사용. 비교용 정보로는 충분 (실시간 거래용 X).

**결정:**

1. v1.0 의 `src/lib/currency.ts` 는 fallback 2단계만 구현: `open.er-api` (1차) → 캐시 stale 또는 baseline (3차).
2. ECB (2차) 는 v1.x deferred. 도입 시 별도 ADR — 도입 조건은 1차 실패율 ≥ 5% 또는 운영자 수동 결정.
3. 우선순위: `bypassCache=false` + 캐시 신선 → 캐시 hit. 그 외 → 1차 fetch. 실패 시 (네트워크/HTTP/parse/timeout 모두) → 캐시 (있으면 stale 도) 반환. 캐시도 없으면 → `FX_BASELINE_<YYYY>Q<n>` 사본 반환.
4. fetch 가 성공한 경우에만 `meta:fxLastSync` 갱신 → 호출자가 staleness 감지 가능.
5. `fetchExchangeRates` 는 호출자에게 throw 하지 않는다 (항상 ExchangeRates 반환). 에러 카탈로그 (FxFetchError·FxParseError·FxTimeoutError) 는 내부 fetchPrimary 단계에서 정확한 분기 처리에만 사용.

**대안 검토:**

- (A) 즉시 ECB 도입: XML 파서 의존성 추가 + 환산 로직 + 테스트 매트릭스 ~4시간. 일정 영향. 도입 시점 가치 < 비용. 거부.
- (B) 1차만 + 실패 시 throws: ARCHITECTURE.md §캐시 전략 의 "stale 캐시 + 경고 배지" 패턴 위반 + cold-start 시 환율 N/A 화면. 거부.
- (C) baseline 무시, 캐시 없으면 환율 N/A: cold-start 사용자가 "?" 만 보게 됨 — 비교 앱 핵심 기능 마비. 거부.

**결과 / 영향:**

- step 3 currency.ts 가 현재 phase 안에서 완결. step 4 data.ts 와 독립.
- ECB 도입 시 `fetchExchangeRates` 내부에 1차 catch 후 ECB 시도 + 실패 시 stale/baseline 으로 fallthrough — 본 ADR 의 외부 계약 (throw 안 함, 항상 반환) 은 유지.
- 1차 출처 운영자 변경·shape 변경 시 즉시 baseline fallback 으로 동작 — 사용자 화면 깨지지 않음.
- 운영자 모니터링: 분기마다 1회 응답 shape 검증 (DATA.md §5.4) + 베타·출시 후 1차 실패율 추적.

**알려진 트레이드오프 — `inflight` 와 `bypassCache` 상호작용:**

`fetchExchangeRates({ bypassCache: true })` 가 진행 중인 다른 호출 (`bypassCache: false`, 캐시 hit 반환 예정) 을 만나면 in-flight dedup 으로 인해 **bypassCache 의도가 무시**된다 (이미 진행 중인 Promise 를 그대로 반환). 사용자가 설정 화면에서 "데이터 새로고침" 을 빠르게 두 번 누르거나, 부트로더 fetch 와 새로고침이 겹치는 race condition 에서 발생.

수용한 이유: dedup 는 정상 흐름에서 중복 fetch 를 막는 핵심 기제. bypassCache 우선 처리하려면 dedup 키를 `bypassCache` 별도 분기 또는 inflight 취소 메커니즘 필요 — 복잡도 대비 가치 낮음 (사용자 두 번째 클릭은 첫 번째 결과로 충족됨). 동일 동작이 `src/lib/data.ts` 의 `loadAllCities` 에도 적용. v2 이후 사용자 보고 시 재검토.

**관련:** ADR-026 (3단계 fallback), ADR-047 (baseline 분기 갱신), `src/lib/currency.ts`.

---

### ADR-047: `FX_BASELINE_<YYYY>Q<n>` 분기 갱신 정책

**상태:** 채택 (2026-04-29)

**맥락:**

- ADR-046 이 정한 3차 fallback 은 코드 내 const (`src/lib/currency.ts` 의 `FX_BASELINE_<YYYY>Q<n>`).
- 1차 (open.er-api) 가 일별 갱신이라 매우 신선하지만, 3차는 정의상 "최후의 안전망" — 분기 평균값으로 충분.
- 그러나 1년 이상 갱신 안 된 baseline 은 환율 변동 누적 시 비교 결과 왜곡 (예: KRW/USD 가 30% 변동한 채 1년 stale 이면 비교 앱 신뢰성 손상).
- 운영자 수동 갱신 + 자동화 워크플로우 (`refresh-fx.yml`, AUTOMATION.md §4.6) 둘 다 옵션. 자동화는 후속 phase 책임.

**결정:**

1. `FX_BASELINE_<YYYY>Q<n>` 의 const 이름 자체에 분기 정보를 박는다 (예: `FX_BASELINE_2026Q2`). 새 분기 진입 시 const 이름 + 값 동시 갱신.
2. 출처는 한국은행 ECOS 시스템 (https://ecos.bok.or.kr/) 의 통화별 분기 평균 환율. const 위 주석에 출처 URL 명시.
3. 분기 시작 후 첫 PR 시 갱신 — 분기 1일~7일 사이. 늦어도 분기 1개월 이내.
4. 자동화 phase 가 도입되는 시점에 `scripts/refresh/fx_backup.mjs` 가 본 const 를 자동 갱신하도록 통합 (AUTOMATION.md §4.6 참조). 그때까지는 운영자 수동.
5. 갱신 시 currency.test.ts 의 hardcoded 기대값 (예: `FX_BASELINE_2026Q2.USD === 1380`) 도 동시 수정 필요.

**대안 검토:**

- (A) baseline 을 정적 JSON 파일 (`data/static/fx_fallback.json`) 에서 로드: 런타임 의존성 추가 + RN 번들에 정적 자산 포함 필요. const 가 더 단순.
- (B) baseline 없이 stale 캐시만 fallback: cold-start + 캐시 없는 코너 케이스에서 환율 N/A — ADR-046 거부 사유 동일.

**결과 / 영향:**

- 분기마다 `currency.ts` 한 줄 + 테스트 한 줄 갱신. 5분 작업.
- const 이름이 분기를 명시하므로 `git blame` 로 마지막 갱신 분기 즉시 확인 가능.
- 자동화 phase 도입 시 본 ADR 갱신 (수동 → 자동 전환).
- 출시 직전 (M6) 빌드 게이트가 baseline 의 stale 정도를 검증할 수 있음 (별도 phase).

**관련:** ADR-046 (fallback v1.0 정책), ADR-026 (3단계 fallback), AUTOMATION.md §4.6.

### ADR-048: 부분 schema 실패 정책 — 한 도시 invalid → 그 도시 제외 + warn

**상태:** 채택 (2026-04-29)

**맥락:**

- `src/lib/data.ts` 가 fetch 한 `all.json` 에 21개 도시 + 메타가 들어있다. 운영자 큐레이션 실수 또는 분기 갱신 중 한 도시의 한 필드가 schema 위반 가능.
- 옵션 (a) 전체 batch 를 reject (`validateAllJson` strict) — 21개 중 1개 깨졌다고 사용자에게 ErrorView 보여주는 건 과도.
- 옵션 (b) 깨진 도시만 제외하고 나머지 20개 보여주기 — 부분 가용성, 사용자 경험상 합리.

**결정:**

1. `src/lib/data.ts` 는 자체 lenient parser (`parseLenient`) 를 사용. `validateAllJson` (strict) 은 단위 테스트·시드 round-trip 용 단일 출처 검증으로만 사용.
2. lenient parser:
   - top-level shape (schemaVersion, generatedAt, fxBaseDate, cities) 위반 → CitySchemaError throw (전체 batch 거부)
   - 개별 도시 위반 → 그 도시만 제외 + dev 콘솔 `console.warn(\`[data] city '<id>' excluded: <code> <message>\`)`
   - 0개 도시만 통과 → CitySchemaError throw (의미 있는 데이터 없음)
3. 사용자가 깨진 도시 ID 로 진입 시도 시 `getCity(id)` 가 undefined 반환 → 화면 단에서 ErrorView 또는 "이 도시 데이터를 불러올 수 없습니다" 처리 (별도 phase 책임).
4. dev 콘솔 warn 은 silent fail 회피의 가시성 보장 (CLAUDE.md CRITICAL). 프로덕션 빌드 (Release) 에서는 babel transform-remove-console 으로 자연스럽게 무음 — 운영 phase 의 sentry-like 보고는 v2 이후.

**대안 검토:**

- (A) strict — 한 도시 깨지면 전체 ErrorView: 전체 21개를 1개의 잘못된 데이터로 잃는다. 부정확한 사용자 경험.
- (B) 깨진 도시를 schema-default 값으로 채워서 보여주기: 사용자에게 거짓 정보 표시. 거부 (출처 정합성 위반).

**결과 / 영향:**

- 한 도시 데이터 결함이 다른 19개에 전염되지 않음.
- dev 빌드에서는 깨진 도시가 빈번히 가시화 → 분기 갱신 시 즉각 발견.
- `getCity(id)` 의 undefined 반환 의미가 (a) 도시 자체 미존재, (b) schema 위반으로 제외 둘 다 포함 — 사용자에게 표시할 메시지는 화면 phase 에서 결정.

**관련:** CLAUDE.md CRITICAL ("에러 삼키지 않는다"), DATA.md §2 (CityCostData 스키마), `src/lib/citySchema.ts` (strict validateAllJson).

### ADR-049: 시드 fallback 시 부분 가용성 — 서울 + 밴쿠버만, 그 외 도시는 ErrorView

**상태:** 채택 (2026-04-29)

**맥락:**

- ADR-045 가 v1.0 시드를 서울 + 밴쿠버 2개로 정함 (시드 크기 통제 + 출시자 개인 연결).
- 사용자가 첫 콜드 스타트 + 네트워크 없음 상태에서 다른 19개 도시 (예: 도쿄) 진입 시도하면, `getCity('tokyo')` 가 undefined 반환.
- v1.0 의 화면 phase 가 이 상태를 어떻게 처리할지 미리 정해둘 필요.

**결정:**

1. 시드 fallback 으로 떨어진 상태에서 사용자가 도쿄 같은 도시 진입 시: 화면 단에서 **ErrorView** 표시 + "재시도" CTA + 상단 "현재 오프라인 데이터로 동작 중" 배지.
2. 홈 화면 (`/(tabs)/index`) 의 도시 목록은 시드 도시 (서울+밴쿠버) 만 표시 — `getAllCities()` 가 메모리에 있는 것만 반환하니 자연스럽게.
3. 즐겨찾기에 도쿄 같은 도시가 들어있는데 시드 fallback 상태이면, 즐겨찾기 카드는 "오프라인" 배지 + 탭 시 ErrorView.
4. 홈 화면 상단에 (시드 fallback 활성 시) 한 줄 안내: `데이터 갱신 실패 · 다시 시도` (ARCHITECTURE.md §에러 핸들링 §2 의 inline 경고 배지 패턴).
5. 시드 fallback 감지: `getAllCities()` 의 키 집합이 `{seoul, vancouver}` 와 정확히 일치하면서 `meta:lastSync` 가 빈 값일 때. (또는 별도 플래그 — 별도 phase 에서 결정.)
6. v1.1 검토 — 시드에 더 많은 도시 추가 (예: 도쿄·뉴욕·런던 — Top-3). 단 시드 크기 ≤ 30 KB gzipped 유지.

**대안 검토:**

- (A) 시드를 21개 모두 포함: 시드 크기 ~30 KB gzipped 가 ~150 KB 로 증가. 첫 다운로드 부담 + AppStore 바이너리 증가. 거부.
- (B) 시드 fallback 시에도 19개 도시 비교 화면을 빈 데이터로 진입 허용: 사용자에게 거짓 정보 표시. 거부.

**결과 / 영향:**

- 첫 콜드 스타트 + 네트워크 없음 = 서울 vs 밴쿠버 비교는 항상 가능 (출시자 본인 페르소나 만족).
- 19개 도시는 네트워크 1회 fetch 후 사용 가능 — 사용자가 한 번이라도 온라인이면 24h 내 자동 fetch.
- ErrorView 메시지 (i18n/errors.ko 별도 phase) 는 "데이터 불러오기 실패 · 다시 시도" 정도.

**관련:** ADR-045 (시드 = fixture 2도시), ARCHITECTURE.md §캐시·오프라인 전략, DATA.md §6.5 (fallback chain).

### ADR-050: zustand v4 채택 + persist + AsyncStorage (도메인 store 표준 미들웨어)

**상태:** 채택 (2026-04-29)

**맥락:**

- ADR-004 가 상태 관리 = Zustand + persist 로 결정 (도메인별 분리). 그러나 zustand 메이저 버전은 미정이었고, 본 ADR 시점에 v5 가 stable.
- v5 는 React 18+ `useSyncExternalStore` 를 표준으로 요구하고, `create<T>()(...)` 의 currying API 만 지원 (v4 의 `create((set) => ...)` 비-curried 형태 deprecated).
- 우리 환경: React 19 + RN 0.81 (ADR-044 의 SDK 54 업그레이드). v5 가 `useSyncExternalStore` 를 동일 import 경로로 쓰므로 호환성에 큰 차이는 없으나, RN 0.81 + React 19 조합에서 v5 의 store 인스턴스 lifecycle 회귀 보고가 일부 issue 트래커에 있어 확인 시간이 필요.
- v4 는 currying API 와 비-curried API 모두 지원, persist 미들웨어가 동일 형태, AsyncStorage 어댑터 (`createJSONStorage`) 도 동일.

**결정:**

1. v1.0 의 모든 도메인 store (persona / favorites / recent / settings) 는 **zustand v4** 를 사용한다 (`^4`).
2. 표준 패턴: `create<State & Actions>()(persist((set) => ({...}), { ... }))` 의 v4 currying 형태.
3. persist 옵션 표준:
   - `name: '<domain>:v1'` — DATA.md §13.5.1 단일 출처
   - `storage: createJSONStorage(() => AsyncStorage)`
   - `version: 1` (도메인별 독립 스키마 버전)
   - `partialize`: 액션 제외, state 만 영속화
   - `onRehydrateStorage`: 손상 캐시 (잘못된 JSON / 유효하지 않은 literal) → 초기 상태 fallback. silent fail 금지 — `setState(INITIAL_STATE)` 로 명시 복구.
   - `migrate`: v1 only — stub. v2 도입 시 본 ADR 갱신 + 도메인별 마이그레이션 함수 작성.

**대안 검토:**

- (A) **zustand v5**: 장점 = 최신 API, 작은 번들. 단점 = currying-only, RN 0.81 + React 19 조합 회귀 검증 비용. v1.0 일정 영향. 거부.
- (B) **Redux Toolkit**: 5화면 규모에 과도 (ADR-004 에서 이미 거부).
- (C) **Jotai / MobX**: ADR-004 가 Zustand 채택. 본 ADR 은 버전 핀 결정만.

**결과 / 영향:**

- 4 도메인 store 가 동일 패턴으로 작성 — 신규 store 추가 시 본 ADR 의 옵션 표준만 따르면 됨.
- v5 도입 시점 (사용자 보고 회귀 0건 + 일정 여유) 에 일괄 마이그레이션 — 별도 ADR 로 결정.
- 손상 캐시 처리: `setState(INITIAL_STATE)` 호출이 persist middleware 의 자동 setItem 을 트리거 → INITIAL 직렬화로 storage 가 자연스럽게 정리됨. 별도 `removeItem` 호출은 setState 와 race 위험 있어 사용 안 함.

**알려진 트레이드오프 — `setState` 의 자동 storage write:**

zustand persist 는 모든 `setState` (액션 호출 포함) 후 storage 에 자동 setItem. 즉:

- 메모리 state 만 변경하고 storage 는 그대로 두는 패턴이 불가능 (테스트에서도 storage 직접 setItem 해야 round-trip 검증 가능).
- 손상 fallback 흐름에서 `removeItem(key)` + `setState(INITIAL_STATE)` 순서로 호출하면 setState 의 자동 setItem 이 removeItem 결과를 덮어써 race 발생. 그래서 본 ADR 은 `setState(INITIAL_STATE)` 만 호출 — 다음 부팅 시 INITIAL 직렬화가 정상 fallback.

**관련:** ADR-004 (Zustand + AsyncStorage 도메인 분리), ADR-022 (스키마 마이그레이션 v 접미사), ADR-044 (Expo SDK 54 / React 19), DATA.md §13.5.1 (AsyncStorage 키 카탈로그).

---

### ADR-051: store hydration 합성은 단일 boundary 함수 (`waitForAllStoresHydrated`)

**상태:** 채택 (2026-04-29)

**맥락:**

- 4 도메인 store (persona / favorites / recent / settings) 는 ADR-004·ADR-050 정책에 따라 분리. 각 store 는 zustand persist 의 자체 hydration cycle 을 가진다.
- 부트로더 (`app/_layout.tsx`, app-shell phase 책임) 는 useFonts + 4 store hydration 을 동시 await 후 SplashScreen.hideAsync 를 호출 (ARCHITECTURE.md §부팅·hydration 순서).
- store 끼리는 cross-import 금지 (도메인별 분리 — ADR-004). 그러나 부트로더 단계에서 4 store 모두를 동시에 기다리는 합성 점이 필요.

**결정:**

1. 4 store 의 hydration 동시 await 는 `src/store/hydration.ts` 의 단일 함수 `waitForAllStoresHydrated(): Promise<void>` 가 책임.
2. 본 함수만이 4 store 를 모두 import 하는 유일한 모듈 — 도메인 분리 위반이 아닌 명시적 boundary.
3. 새 store 추가 시 본 함수의 `Promise.all` 인자에 한 줄 추가 (선형 확장).
4. 각 store 의 `persist.hasHydrated()` 가 이미 true 면 즉시 resolve, 아니면 `onFinishHydration` 콜백으로 비동기 wait + resolve 시 unsubscribe 호출 (콜백 누수 방지).

**대안 검토:**

- (A) 부트로더가 직접 4 store 를 import + Promise.all: 부트로더가 store 추가 영향을 받음 + 패턴 노이즈. 거부.
- (B) store index 가 hydration array 를 export: 4 store 간 순서 / 의존성이 노출됨. boundary 가 분산됨. 거부.
- (C) zustand store wrapper 에 helper 통합: zustand v4 default API 와 다른 패턴 도입 → 학습 비용. 거부.

**결과 / 영향:**

- 부트로더는 `await Promise.all([useFonts(...), waitForAllStoresHydrated()])` 한 줄로 4 store hydration 합성.
- 신규 store 도입 시 변경 면적: hydration.ts 에 한 줄, MEMORY.md / TESTING.md §9.4.2 에 한 줄.

**관련:** ADR-004 (도메인 store 분리), ADR-050 (zustand v4 표준), ARCHITECTURE.md §부팅·hydration 순서.

---

### ADR-052: zustand persist 의 JSON.parse 실패 시 hydration 영구 미완 (latent edge case, v1.x defer)

**상태:** 채택 (2026-04-29)

**맥락:**

- zustand v4 persist 미들웨어의 hydrate 함수는 storage 의 deserialize (`createJSONStorage` 의 `JSON.parse`) 가 throw 하면 catch 분기로 진입해 `postRehydrationCallback(undefined, error)` 만 호출하고 `_hasHydrated` 를 true 로 전이시키지 않는다 (`finishHydrationListeners` 도 발화하지 않음).
- 우리 4 store 의 `onRehydrateStorage` 는 error 시 `setState(INITIAL_STATE)` 로 메모리 상태는 정리하나, `_hasHydrated` 는 그대로 false.
- 결과: 사용자 디바이스에서 AsyncStorage 의 한 store entry 가 깨진 JSON 으로 손상된 경우 (예: OS-level write 도중 중단), 부트로더의 `waitForAllStoresHydrated()` 가 영구 hang → splash screen 무한 대기.
- 발생 빈도: 이론상 매우 낮음 (AsyncStorage 의 atomic write 보장 + 정상 종료 흐름). 그러나 0 은 아님.

**결정:**

1. v1.0 은 본 latent edge case 를 **수용**. 부트로더의 hang 은 사용자가 앱 강제 종료 + 재실행 시 zustand persist 의 다음 부팅에서 동일 시나리오 반복 — 사실상 unrecoverable.
2. 단, 우리 store 의 `setState(INITIAL_STATE)` 가 자동 setItem 을 트리거하므로 손상 entry 가 INITIAL 직렬화로 덮어씌워진다. 다음 cold start 에서는 정상 hydration. 즉 **이 setItem write 가 디스크에 도달한 경우에만** 다음 부팅이 정상.
3. **"두 번째 부팅 정상" 의 전제조건 (중요):** `onRehydrateStorage` 의 `setState(INITIAL_STATE)` 가 microtask 로 storage write 를 trigger 하기 **이전** 에 사용자가 splash 무한 대기 → 강제 종료한다면, 손상 JSON 이 그대로 남아 다음 부팅도 동일 hang 반복. 이 경우는 unrecoverable 까지는 아니지만 "두 번째 부팅 정상" 이 보장되지 않음.
4. **app-shell phase 에 강제 요구사항 (ADR-052 의 본 ADR 이 prerequisite):** `app/_layout.tsx` 의 부트로더가 `waitForAllStoresHydrated()` 를 호출할 때 **반드시 timeout guard (3~5 초)** 를 함께 적용해야 한다. timeout 시:
   - 4 store 모두 `setState(INITIAL_STATE)` 강제 호출 → 손상 entry 덮어쓰기
   - SplashScreen.hideAsync() 후 onboarding 으로 진입 (사용자에게 정상 흐름 제공)
   - dev 빌드는 콘솔 warn, 운영 빌드는 sentry-like (v2 이후) 로 보고
5. 본격 native fix 는 v1.x 의 별도 ADR — 옵션:
   - (A) zustand persist 의 onRehydrateStorage error 분기에서 `AsyncStorage.removeItem` + `persist.rehydrate()` 재호출 (race 위험 감수)
   - (B) zustand v5 마이그레이션 시 hydration API 변경 여부 확인
6. 사용자 보고 시점에 본 ADR 갱신 + fix ADR 추가.

**대안 검토:**

- (A) v1.0 에 즉시 fix: timeout 도입은 splash 정상 흐름의 latency 검증 부담 + race 시나리오 새로 발생. v1.0 일정 영향. 거부.
- (B) helper 자체에 timeout: helper 는 단순한 합성 boundary — 도메인 정책이 helper 안에 들어가는 것은 책임 분산. 거부.
- (C) 무시: silent fail 정책 위반 + 사용자 경험 (splash 무한 대기) 명시적으로 인지하지 못한 상태로 남김. 거부.

**결과 / 영향:**

- TESTING.md §9.4.2 의 latent 항목은 v1.0 통과 기준에 포함하지 않음 (체크박스 표시).
- **app-shell phase 가 본 ADR 의 결정 4 (timeout guard) 를 강제 구현해야 함.** 본 ADR 자체로는 hang 을 막지 못하므로 phase 이름을 `app-shell-bootloader-timeout` 같은 step 으로 명시 권장.
- 사용자 부팅 hang 보고 시점에 fix ADR 추가 + native fix 옵션 (A/B) 검토.
- 본 edge case 의 구체 trigger 는 `JSON.parse` 실패 — 사용자 측 직접 storage 조작 외에는 일반 흐름에서 거의 발생 안 함.

**관련:** ADR-050 (zustand v4 + setState 자동 storage write), ADR-051 (waitForAllStoresHydrated boundary), ARCHITECTURE.md §부팅·hydration 순서.

---

### ADR-053: 개발용 web 번들링 활성화 (`react-native-web` + `@expo/metro-runtime` + `react-dom`) — 출시 정책은 ADR-001 유지

**상태:** 채택 (2026-04-30)

**맥락:**

- ADR-001 은 "iOS·Android 네이티브 앱 우선, web/PWA 는 v2 이후" 로 **출시 채널** 을 정한 결정이다. 이는 Metro 의 web 번들링 자체를 금지한 것이 아니다.
- 개발 중 NativeWind v4 기본 `darkMode: 'media'` 가 web 미리보기에서 system color scheme 을 추적하다가 `Cannot manually set color scheme` 런타임 에러를 일으키는 것을 확인.
- Expo SDK 54 기준 web preview 는 `expo install react-dom react-native-web @expo/metro-runtime` 3종 패키지가 있어야 동작.

**결정:**

1. `@expo/metro-runtime`, `react-dom@19.1.0`, `react-native-web@^0.21` 을 정식 `dependencies` 로 추가. Expo 권장 위치이며, 네이티브 EAS Build 결과물에는 Metro 의 플랫폼 분기로 제외된다.
2. `tailwind.config.js` `darkMode: 'class'` 로 전환 — `'media'` 모드의 system scheme 추적 회피. ADR-016 (light 고정) 정책상 `dark` 클래스를 토글하지 않으므로 web/native 모두 항상 light.
3. `app.json` 에 `expo.web.bundler: 'metro'` 명시 — Expo SDK 54 의 기본값이지만 명시적 선언으로 향후 SDK 업그레이드·기여자 환경 차이에 따른 webpack fallback 회피.
4. **출시 채널 정책은 변경 없음** — App Store / Play Store 만 v1.0 출시 대상. 사용자 대상 web 배포는 v2 이후 별도 ADR 로 결정.
5. web 번들의 용도: 로컬 개발·QA 미리보기·hifi 디자인 대조용. 사용자에게 노출하지 않는다.

**대안 검토:**

- (A) web 비활성 유지 + tailwind 만 `'class'` 로 전환: NativeWind 가 web 환경을 인식 못 해 결국 같은 에러를 던질 수 있음. 또 web preview 는 hifi mock 과 빠르게 대조하는 1인 개발 흐름의 가치가 크다. 거부.
- (B) `darkMode: 'media'` 유지하고 web 만 따로 회피: NativeWind 내부 동작이라 우회 비용이 크다. 거부.

**결과 / 영향:**

- 네이티브 번들 (ADR-017 번들 예산 ≤5MB) 에 web 패키지가 포함되지 않으므로 영향 없음.
- 신규 개발자/기여자는 `npm run dev` → `w` 키로 web preview 가능.
- 향후 web/PWA 출시를 검토할 때는 본 ADR 의 "출시 정책 미변경" 을 명시적으로 새 ADR 에서 supersede 해야 함.

**관련:** ADR-001 (모바일 앱 우선 — 출시 채널 정책), ADR-016 (다크 모드 미지원), ADR-017 (번들 예산 — 본 변경 영향 없음).

### ADR-054: 아이콘 라이브러리 = `lucide-react-native`

**상태:** 채택 (2026-04-30)

**맥락:**

- design/README.md §Assets 가 22~25개 line-style SVG 아이콘 카탈로그 정의 + Lucide / Heroicons / Phosphor 같은 라이브러리로 1:1 대체 가능 + **권장: lucide-react-native** (스트로크 스타일 / viewBox 24×24 일치) 라고 명시.
- components phase step 1 (Icon 컴포넌트) 에서 25 아이콘 source 결정 필요. 대안: (A) lucide-react-native 도입, (B) 25 SVG 직접 인라인.
- `react-native-svg` 는 이미 `package.json` 의존성 (peer dep 충족).

**결정:**

1. **lucide-react-native** (`^1.14.0`) 도입. 25 IconName 모두 lucide 의 named export 와 1:1 매핑.
2. 매핑은 `src/components/Icon.tsx` 의 정적 lookup table 로 관리. 이름 변경 / 추가는 본 파일 한 곳만 수정.
3. 시각 정합성은 design/README.md §Assets 와 hifi/_shared.jsx 의 SVG path 와 비교 — 어긋나는 아이콘은 후속 phase 에서 인라인 SVG 로 교체 (별도 ADR 없이 phase 진행 결정).

**대안 검토:**

- (A 선택) lucide-react-native: 일관성 + 디자인 권장 + tree-shake 친화. 채택.
- (B) 25 SVG 직접 인라인: 의존성 0 이지만 ~25 × 평균 5~15 라인 = 수백 라인 boilerplate + 시각 정합 수동 검증 부담. 1인 사이드 프로젝트 시간 비용 과다. 거부.
- (C) Heroicons / Phosphor: design/README.md 가 Lucide 권장. 추가 평가 비용. 거부.

**결과 / 영향:**

- 신규 의존성 1개 (`lucide-react-native@^1.14`). peer dep `react-native` / `react` 만족. tree-shake 로 사용한 25 아이콘만 번들에 포함 — ADR-017 번들 예산 ≤5MB 영향 ~수십 KB 미만.
- `more` 아이콘은 lucide 의 `MoreHorizontal` 사용. design/README.md §9.10 의 "fill circle 3개" 와 시각 차이 가능 — 차후 디자인 검토 시 별도 인라인 교체 가능 (시각 차이는 minor).
- 본 ADR 은 components phase 외 아이콘 직접 import 금지 패턴을 강제하지 않는다 — 사용처는 `<Icon name="..." />` 단일 API 만 노출.

**관련:** ADR-002 (Expo Managed Workflow), ADR-017 (번들 예산), ADR-003 (NativeWind 디자인 토큰), design/README.md §Assets.

---

### ADR-055: SafeAreaView 는 `react-native-safe-area-context` 만 사용 (RN core SafeAreaView 금지)

**상태:** 채택 (2026-05-01)

**맥락:**

- React Native core 의 `SafeAreaView` (`from 'react-native'`) 는 deprecated 이고, **New Architecture (Fabric / Bridgeless) 에서 0 크기로 마운트되는 회귀**가 있다. 자식 트리가 화면에 렌더링되지만 부모 크기가 0 이라 시각적으로는 빈 화면으로 보인다.
- ADR-044 의 SDK 54 업그레이드로 New Architecture 가 default 활성화. **Expo Go 는 `app.json` 의 `newArchEnabled: false` 를 강제로 무시**한다 (런타임 콘솔에 "React Native's New Architecture is always enabled in Expo Go" 명시 경고 출력). 따라서 dev 빌드에서 RN core SafeAreaView 사용 시 흰 화면 발생이 결정적.
- 실제로 5 placeholder 화면 (`onboarding`, `(tabs)/index`, `(tabs)/settings`, `compare/[cityId]`, `detail/[cityId]/[category]`) 이 RN core SafeAreaView 를 사용해 dev 빌드에서 흰 화면 회귀 발생. 단, `src/components/Screen.tsx` 는 이미 `react-native-safe-area-context` 기반이라 영향 없음.
- `react-native-safe-area-context@~5.6.0` 은 Expo Managed Workflow (ADR-002) 의 표준 의존성으로 이미 설치 — 신규 의존성 도입 아님.

**결정:**

1. **모든 `SafeAreaView` import 는 `react-native-safe-area-context` 에서만 수행.** `import { SafeAreaView } from 'react-native'` 는 금지.
2. `app/_layout.tsx` 는 `<SafeAreaProvider>` 로 트리 wrapping (safe-area-context 의 요구사항).
3. 화면 chrome 이 필요한 경우 `src/components/Screen.tsx` 사용 권장 (이미 safe-area-context 기반 + padding 토큰 캡슐화). 직접 `SafeAreaView` 사용은 chrome 이 필요 없는 단순 화면에 한함.
4. 본 결정 시점에 5 placeholder + `_layout.tsx` 수정 적용. Phase 5 실제 화면 구현 시 본 정책 준수.

**대안 검토:**

- (A 선택) safe-area-context 만 사용 + RN core 금지: dev/prod / Expo Go / standalone build 양쪽 New Arch 호환 보장. 신규 의존성 0. 채택.
- (B) RN core SafeAreaView + manual padding: deprecated API 의존 + New Arch 회귀 잠재. 거부.
- (C) `useSafeAreaInsets` + 일반 `View` 조합: safe-area-context 의 `SafeAreaView` 가 동일 동작을 더 적은 코드로 제공. 거부 (단순 케이스 한정 fallback 옵션으로만 허용).

**결과 / 영향:**

- 흰 화면 회귀 차단 (dev / prod / Expo Go / standalone build).
- 신규 의존성 0 (safe-area-context 는 이미 ADR-002 의 Expo 표준 의존성).
- 5 placeholder 의 import 교체 + `_layout.tsx` SafeAreaProvider 추가 1 회. eslint import/order 자동 정렬.
- 디자인 hifi mock (ADR-012 reference) 의 `<SafeAreaView>` 를 RN 으로 포팅할 때 본 정책에 따라 자동으로 safe-area-context 채택.
- 강제 lint 규칙 (`no-restricted-imports` 로 RN core SafeAreaView 차단) 은 본 ADR 에서 도입 안 함. 회귀 재발 시 추가 검토 — 현재 코드베이스가 모두 정책 준수 상태라 우선순위 낮음.

**관련:** ADR-002 (Expo Managed Workflow + safe-area-context 기본 의존성), ADR-044 (SDK 54 / RN 0.81 / New Arch default), ADR-012 (hifi mock RN 포팅), `src/components/Screen.tsx`, ARCHITECTURE.md §부팅·hydration 순서.

---

### ADR-056: Home 카드 배수는 단순화된 총비용 근사값 (Compare 와 의도적 분리)

**상태:** 채택 (2026-05-02)

**맥락:**

- Compare 화면 (`app/compare/[cityId].tsx`) 의 도시 vs 서울 배수는 카테고리 합산 (`rent + food + transport + tuition + tax + visa`) 으로 계산. `'신규'` 케이스 (서울에 없는 항목) 도 명시.
- Home 화면 (`app/(tabs)/index.tsx`) 의 FavCard / RecentRow 배수는 `rent.share + food (외식 20일 + 식재료 4종) + transport.monthlyPass` 만 사용. 페르소나·세금·비자비·학비 모두 제외.
- 동일 도시에 대해 Home 카드 배수와 Compare 화면 배수가 다를 수 있다 (예: 도쿄 — Home 1.4× / Compare student 1.7×). PR #18 review round 3 에서 일관성 우려 제기.

**결정:**

1. **Home 의 배수는 의도적으로 단순화된 근사값.** 페르소나 분기를 적용하지 않으며, 카테고리도 가장 보편적인 3개 (rent / food / transport) 만 사용한다.
2. 정확한 페르소나 기반 배수는 **Compare 진입 후** 확인하도록 UX 흐름 설계 (Home → 카드 탭 → Compare).
3. Home 의 `multFromTotals` 는 v1.x 에서도 단순 식을 유지. 페르소나 일치를 원하면 `compare.ts` 헬퍼 추출 후 양쪽 공유 (별도 ADR).

**대안 검토:**

- (A 선택) Home 단순화 + Compare 정밀, ADR 로 명시: Home 의 카드 배수는 "어림 비교" UX 역할. 학비·비자비처럼 페르소나 종속 항목을 카드에 노출하면 의미가 모호해짐. 단순 식이 사용자 멘탈 모델과 일치. 채택.
- (B) Home 도 페르소나 분기 적용: persona store 의존성 + Compare 와 동일 헬퍼 추출 필요. 카드 단위 정보로는 과도. 거부.
- (C) Home 배수 표기 자체 제거: design/README §2 의 카드 정보 밀도 의도 (배수 + hot 표시) 와 충돌. 거부.

**결과 / 영향:**

- Home 화면은 빠른 시각적 비교 카드, Compare 화면은 정밀 분석 — 역할 분리 명확화.
- 배수 차이는 정상이며 버그 아님. 사용자 혼동 발생 시 UI 카피 (예: "어림 비교" 라벨) 추가 검토.
- v1.x 에서 헬퍼 통합 검토 시 본 ADR 갱신 필요.

**관련:** `app/(tabs)/index.tsx` (`computeCityTotal`, `multFromTotals`), `app/compare/[cityId].tsx`, `docs/PRD.md` §Home, design/README §2.

---

### ADR-057: borderRadius 토큰 분화 — `button` (14px) / `btn` (10px)

**상태:** 채택 (2026-05-02)

**맥락:**

- screens phase step 3 에서 Settings 페르소나 카드의 "변경" 버튼 (semi-transparent capsule on navy background) 이 시각적으로 14px 모서리보다 작게 디자인됐다. design/README §5 의 Settings 카드 내 "small action chip" 패턴.
- 기존 `button: 14px` 는 검색바·아바타 박스 등 큰 인터랙티브 box 에 사용되며, "변경" 버튼처럼 inline-small chip 에는 과한 라운드.
- 두 크기가 디자인 의도상 별개 토큰 (capsule vs box) 이라 inline 매직 (`rounded-[10px]`) 으로 처리하면 CRITICAL "디자인 토큰 단일 출처" 위반.

**결정:**

1. `tailwind.config.js` borderRadius 에 `btn: '10px'` 토큰 신규 추가.
2. 기존 `button: '14px'` 는 큰 인터랙티브 box (search bar, 아바타, 검색 stub 등) 에 유지.
3. 작은 inline chip 류 (Settings "변경" 버튼, 페르소나 카드 액션) 는 `btn` (10px) 사용.
4. v1.x 디자인 시스템 정밀화 시 의미 기반 이름 (`chip`, `inline-action` 등) 으로 재네이밍 검토.

**대안 검토:**

- (A 선택) 두 토큰 분리 + 명명: 역할 차이 명확. `button` 은 "박스형", `btn` 은 "인라인 chip". CRITICAL 토큰 단일 출처 유지. 채택.
- (B) `button` 만 유지 + 시각 차이 무시: 디자인 의도와 어긋나 v1.x 에서 다시 분리 예정. 거부.
- (C) `rounded-[10px]` 인라인 매직: CRITICAL 위반. 거부.
- (D) 의미 기반 명명 (`chip-action: 10px`) 으로 즉시 분리: 디자인 시스템 정밀화 (v1.x) 까지 명명 안정 어려움. 본 ADR 단계에선 `btn` 임시 명명 유지, v1.x 재네이밍 메모.

**결과 / 영향:**

- `app/(tabs)/settings.tsx` Persona card "변경" 버튼이 토큰 사용으로 인라인 매직 회피.
- `button` / `btn` 두 이름이 혼재해 onboarding 시 학습 비용 약간 증가 — 본 ADR 이 의미 명세.
- v1.x 디자인 시스템 정밀화 단계에서 의미 기반 명명 검토 (별도 ADR).

**관련:** ADR-003 (NativeWind v4), `tailwind.config.js` (borderRadius), design/README §5 (Settings).

---

### ADR-058: PersonaCard 전용 토큰 — `persona-icon` (12px) / `borderWidth 1.5`

**상태:** 채택 (2026-05-02)

**맥락:**

- PR #18 review round 8 에서 `PersonaCard.tsx` 의 인라인 매직 (`rounded-xl` Tailwind 기본 12px, `border-[1.5px]` arbitrary value) 가 CRITICAL 디자인 토큰 단일 출처 규칙 위반으로 지적됨.
- 44×44 PersonaCard 아이콘 박스의 라운드는 `icon-sm: 10px` 와 `icon-md: 16px` 사이 중간값 (12px) — 기존 토큰으로 정확히 매핑 불가.
- primary variant 의 1.5px orange ring 은 design/README §1 Onboarding 카드 시각 강조 의도 — 표준 1px (`border`) 또는 2px (`border-2`) 로 대체 시 디자인 의도 손상.

**결정:**

1. `tailwind.config.js` borderRadius 에 `'persona-icon': '12px'` 토큰 신규 추가 (`hero-icon: 18px` 와 명명 패턴 일관 — 컴포넌트별 icon 박스 토큰).
2. `tailwind.config.js` borderWidth 에 `'1.5': '1.5px'` 토큰 신규 추가 — PersonaCard primary 강조 ring 전용.
3. PersonaCard 의 `rounded-xl` → `rounded-persona-icon`, `border-[1.5px]` → `border-1.5` 로 교체.

**대안 검토:**

- (A 선택) 두 토큰 신설: 디자인 의도 보존 + CRITICAL 토큰 단일 출처 유지. 두 토큰 모두 컴포넌트 한정 사용이라 generic 명명 회피. 채택.
- (B) `rounded-icon-md` (16px) 또는 `rounded-icon-sm` (10px) 로 강제 매핑: 시각 차이 발생. 거부.
- (C) borderWidth `border` (1px) 또는 `border-2` (2px) 로 대체: orange ring 강조 효과 약화. 거부.

**결과 / 영향:**

- PersonaCard 토큰 단일 출처 회복.
- `persona-icon` 은 PersonaCard 외 사용처 없음 — v1.x 디자인 시스템 정밀화 시 generic `icon-md-sm` 등으로 재네이밍 검토.
- `borderWidth 1.5` 는 generic 토큰이라 추후 다른 컴포넌트에서도 재사용 가능.

**관련:** ADR-003 (NativeWind v4), ADR-057 (`btn`/`button` 토큰 분화), `tailwind.config.js`, `src/components/PersonaCard.tsx`, design/README §1 (Onboarding).

---

### ADR-059: 데이터 자동화 추정·보정 결정 — `share=studio×0.65` / CPI 기준년도 / BLS 도시 보정 / static fallback

**상태:** 채택 (2026-05-03)

**맥락:**

PR #19 review (data-automation step 0–3) 에서 다음 4 가지 방법론적 결정이 ADR 없이 도입됨이 지적됨. 자동화 출처가 정확히 매핑되지 않는 영역의 추정·보정 정책이 코드에만 기록되면 v1.x 에서 변경 사유 추적 불가.

**결정:**

1. **`share = studio × 0.65` 추정** (ca_cmhc.mjs / us_hud.mjs):
   - CMHC RMS 와 HUD FMR 둘 다 "shared accommodation / room" 데이터를 직접 제공하지 않음.
   - 캐나다·미국 도시의 share rent (방 1개) 를 studio (1인 unit) 의 65% 로 추정 — Statistics Canada Survey of Household Spending 의 평균 비율 근사.
   - 한국 (kr_molit) 은 별도 매핑 사용 (자치구 평균 직접 제공).

2. **CPI → 실가격 변환 기준년도 2020 = 100** (kr_kosis.mjs / 기타 CPI 출처):
   - 모든 통계청 CPI 가 동일 기준년도 (2020 = 100) 를 사용.
   - 변환식: `current = base_2020 × (cpi / 100)`. `BASE_PRICES` 는 통계청 발표 2020 평균가 사용.
   - 출처 추적:
     - `kr_kosis.mjs` `restaurantMeal`: KOSIS "도시별 소비자물가지수" 표 (코드 `DT_1J17001`) §외식 / 일반음식점 평균가 2020
     - `kr_kosis.mjs` `cafe`: 동 표의 §커피전문점 평균가 2020
   - 기준년도 변경 시 (예: 2025 = 100 으로 전환) 모든 출처 일괄 갱신 + 본 ADR 갱신.

3. **BLS 지역 → 도시별 보정계수** (us_bls.mjs `CITY_ADJUSTMENT` — step 4 도입 예정):
   - BLS 는 4 census region (Northeast / Midwest / South / West) 까지만 분리 제공 — 도시별 데이터 부재.
   - 도시 ↔ 지역 매핑 후 NYC=1.15 / SF=1.25 / LA=1.05 / Seattle=1.00 / Boston=1.10 보정.
   - 보정값 출처 (PR #20 review round 21 보완):
     - BLS Consumer Expenditure Survey "Geographic Variation in Regional Price Differentials" (2023 chart) — `https://www.bls.gov/cex/csxgeography.htm`.
     - BEA Regional Price Parities (RPPs) "Goods and All Items" 2022 — `https://www.bea.gov/data/prices-inflation/regional-price-parities-state-and-metro-area`.
     - 두 출처 모두 metro area 단위 RPP 를 제공하며 NYC/SF/LA/Seattle/Boston 의 "All items" RPP 가 위 보정계수와 ±2pt 이내 일치 (운영자가 분기 1회 재확인, 변경 5pt 이상 시 ADR 갱신).
     - 접근 시점: 2026-04 (data-automation step 4 작성 시점). v1.x 단위 검증 phase 에서 자동 fetch 검토.
   - **현재 상태**: 본 보정계수는 us_bls.mjs `CITY_CONFIGS` 에 hardcoded — `data/cities/*.json` 에는 적용된 결과만 적재. 운영자는 분기 1회 BEA RPP 갱신 시 본 ADR + 코드 동시 갱신.

4. **`bread` 필드 단위 — BLS APU per-lb 보존, 변환 X** (us_bls.mjs `mapToGroceries`):
   - BLS APU0x00702111 = "Bread, white, pan, per lb" 응답을 lb→kg 변환 없이 그대로 사용 (milk1L 의 ½gal→L, chicken1kg 의 lb→kg 와 다름).
   - 이유: 미국 슈퍼마켓 표준 식빵 한 덩어리가 약 1lb (454g) → "bread" 필드를 "한 덩어리 (loaf) 가격" 으로 해석. 서울 3500 KRW (약 500g 식빵 한 덩어리) 와 비교 가능.
   - 대안 검토: (B) lb→kg 변환 — 1kg 빵은 미국·한국 모두 비현실적 단위라 비교 무의미. 거부.
   - v1.x 에서 필드명 명시화 (`breadPerLoaf` 등) 검토 — 현재는 schemaVersion 1 호환을 위해 `bread` 유지.

5. **`ca_statcan` 식재료 8종 중 일부 항목 static fallback** (`onion1kg`, `apple1kg`, `ramen` 등):
   - StatCan CPI 는 식재료 8종 표준 중 5종만 제공 (milk / eggs / rice / chicken / bread).
   - 나머지 3종은 출처 부재 → static 값 + `sources[].name` 에 "static" 마커.
   - **STATIC_PRICES 기준년도 / CPI 기준년도 일치 검증** (✅ 해소 — 런타임 검증 도입):
     - `cpiToPrice(cpi, basePrice) = (cpi/100) × basePrice` 변환식이 정확하려면 `basePrice` 가 CPI 기준년도의 가격이어야 함.
     - StatCan WDS Vector (Table 18-10-0004) 의 CPI 기준년도가 2002=100 인지 2020=100 인지 — `getSeriesInfoFromVector` 호출로 base period 확인.
     - 확인 방법: `curl https://www150.statcan.gc.ca/t1/wds/rest/getSeriesInfoFromVector/41691028` → `referencePeriod`.
     - 현재 `STATIC_PRICES` 는 2024~2026 시장가 기준 (provisional) — 기준년도 일치 시 `staticPrices × (cpi_now / 100)` 가 현재가에 근접해야 함. 5–10% 이상 편차 시 STATIC_PRICES 를 기준년도 평균가로 교체.
     - **해소 방법**: `ca_statcan.mjs::fetchSeriesReferencePeriod` 가 CPI 갱신 시작 시 첫 vector 의 `referencePeriod` 를 인증. `ALLOWED_REFERENCE_PERIODS = {2002=100, 2020=100}` 외 값이면 `errors[]` push + 정적 fallback 으로 자동 우회. 1차 방어선 (referencePeriod 인증) + 2차 방어선 (`isCpiBasePeriodSuspect` 값 기반 heuristic) 이중.
   - v1.x 에서 식재료 정밀 데이터 출처 (StatCan Detailed CPI 또는 KOSIS 와 같은 입자도) 발굴 시 ADR 갱신.

6. **`kr_seoul_metro` STATIC_FARES** — HTML 파싱 실패 시 fallback:
   - 출처: 서울교통공사 공식 운임 안내 (https://www.seoulmetro.co.kr/) 2024.10 기준.
   - `singleRide: 1400` (기본 운임), `monthlyPass: 65000` (정기권), `taxiBase: 4800` (서울 택시 기본요금).
   - 갱신 정책: HTML 페이지 구조 변경 등으로 파싱 실패 시 errors push (round 4 부터). 운영자가 분기 1회 검토 + 변경 시 본 ADR + 코드 동시 갱신.

7. **`data/static/fx_fallback.json` 초기 baseline 동일 값**:
   - 현재 파일 (asOf: 2026-04-01) 환율값은 `currency.ts` 의 `FX_BASELINE_2026Q2` 와 의도적으로 동일.
   - 이유: `refresh-fx.yml` 워크플로우가 한 번도 실행되지 않은 출시 직전 시드 상태. v1.0 출시 전 cron 1회 실행으로 ECB 실시간 환율 덮어쓰기.
   - 운영 가이드: 출시 PR 체크리스트에 "refresh-fx.yml 1회 수동 dispatch 후 검증" 추가.

**대안 검토:**

- (A 선택) 추정·보정 모두 채택 + ADR 명시: v1.0 출시 가능. 출처 한계 명시적 추적. 채택.
- (B) share / 외식 / 보정계수 미제공으로 표시: PRD 요구사항 불충족 — 거부.
- (C) 상업 출처 (Numbeo 등) 보충: CLAUDE.md CRITICAL 위반 — 거부.

**결과 / 영향:**

- v1.0 출시에 필요한 모든 필드가 자동화로 채워짐.
- 추정·보정 영역은 `sources[]` 마커 + 본 ADR 으로 추적 가능.
- v1.x 데이터 정밀도 향상 시 보정계수 / static fallback 우선 검토.

**관련:** ADR-032 (자동화 정책), ADR-028 (수동 큐레이션 금지), `docs/AUTOMATION.md` §8 (자동화 한계), `docs/DATA_SOURCES.md` 부록 B, `scripts/refresh/{ca_cmhc,us_hud,kr_kosis,us_bls,ca_statcan}.mjs`.

---

### ADR-060: 월세 카테고리 — 사용자 단일 선택 + 전역 영속 store (`useRentChoiceStore`)

**상태:** 채택 (2026-05-06)

**맥락:**

월세 (rent) 카테고리는 4 주거 형태 (share/studio/oneBed/twoBed) 의 **합산이 의미 없다** — 한 사람이 4 형태를 동시에 거주하지 않는다. 본 ADR 이전 구현은 두 화면이 의미 mismatch 였다:

- Compare 화면 `RENT_CONFIG.getValue` — `share ?? studio ?? oneBed` fallback 으로 단일값 사용 (사실상 share 기본).
- Detail 화면 hero — 4 형태 단가 **합산** 표시 (예: 35만원 + 65만원 + 120만원 + 180만원 = 400만원). 사용자에게 `↑3.6×` 같은 의미 없는 배수가 노출됨.

사용자 피드백 (2026-05-06): "월세 상세 비교의 경우 주거 형태 값들을 다 더해서 비교할 필요는 없을 것 같아. 셰어하우스를 기본값으로 두고, 상세 화면에서 사용자가 주거 형태를 클릭해서 바꿀 수 있게."  
후속: "상세 화면에서 월세 탭해서 바꾸고 뒤로가기 했을 때 목록에서도 그 값이 유지되어야 해. 그래야 전체적으로 비교를 할 수 있지."

→ Detail 의 선택이 Compare hero / 월세 카드에도 동일 기준으로 반영되어야 도시 간 비교가 일관된다.

**결정:**

1. **Detail 화면**: rent 섹션을 "선택된 행 1 개 기준 비교" 로 전환. 행 탭으로 다른 주거 형태 선택 가능. hero 좌·우값 / 캡션 / footer 가 선택을 따라감.
2. **전역 영속 store** `useRentChoiceStore` (5번째 도메인 store) 신설:
   - `RentChoice = 'share' | 'studio' | 'oneBed' | 'twoBed'` literal union.
   - 초기값 `'share'` — 가장 보편적인 1차 선택지 (유학생·1인 직장인 모두 잠재 사용 형태).
   - `persist key: 'rentChoice:v1'`, partialize state 만 영속, 손상 캐시 → INITIAL fallback (silent fail 금지 — ADR-014 정책 준수).
   - hydration: `waitForAllStoresHydrated` 가 동시 await (5 store).
3. **단일 fallback 정책** `resolveRentChoice(rent, choice)` (순수 함수):
   - 선택 키가 도시 데이터에서 null 이면 `RENT_CHOICE_FALLBACK_ORDER = [share, studio, oneBed, twoBed]` 순서로 첫 non-null 키 반환.
   - 모든 키 null 이면 `null` 반환 (호출자가 "데이터 없음" 분기 처리).
   - Compare 화면 `RENT_CONFIG.getValue` + Detail 화면 selectedRow fallback 이 동일 함수 사용 — 두 화면이 같은 도시 결측 케이스에 같은 결과를 보장.
4. **범위**: 도시 무관한 **전역 단일값**. 사용자 의도 ("전체적으로 비교") + "내 거주 형태" 가 사용자 프로필 속성에 가까움 (페르소나와 동일 결).
5. **영속 vs 세션**: AsyncStorage 영속. 페르소나 / 즐겨찾기 / 최근 / 세팅과 동일 결.

**대안 검토:**

- (A 선택) 전역 단일값 + 영속 store: 사용자 의도 부합, 단순. 채택.
- (B) 도시별 선택 (`Record<cityId, RentChoice>`): 사용자가 도시별로 다른 형태를 보고 싶을 수 있음. 단 이주 결정 단계에서 "내 형태" 는 보통 동일하고, "전체적으로 비교" 라는 사용자 발화와 어긋남. 거부.
- (C) 페르소나 기반 default 만 (학생→share / 직장인→studio): 자동 매핑이지만 사용자가 직접 바꿀 수 없으면 Detail 화면 인터랙션이 무의미. 페르소나 default + 사용자 override 의 결합은 v1.x 후속 (TESTING §9.25 deferred).
- (D) Compare 화면 hero 의 `centerCaption` 에 "share 기준" 명시만 추가 (인터랙션 없음): 의미 mismatch 만 patch — 사용자가 다른 형태로 비교할 수 없어 "도시 비교 도구" 본질 약화. 거부.

**결과 / 영향:**

- Detail rent 화면이 의미 있는 단일 비교 (예: 셰어하우스 35만원 vs 93.1만원 = ↑2.7×) 로 표시.
- Compare 화면 hero / 월세 카드도 동일 기준으로 동기화 → "전체 도시 비교" 의 일관성 확보.
- 사용자가 Detail 에서 oneBed 로 바꾸면 모든 도시의 Compare 카드가 oneBed 기준으로 갱신.
- 새 store 추가 — `hydration.ts`, `store/index.ts`, ADR-004 의 도메인 분리 계속 유지.
- 5 store 가 됐으므로 hydration timeout (ADR-052) `DEFAULT_HYDRATION_TIMEOUT_MS=5000` 영향 없음 (rent choice 는 단일 literal 영속이라 ms 단위).

**Deferred (v1.x):**

- 페르소나 기반 default 선택 (학생: share, 직장인: studio 등) — 페르소나 분기 후속 PR.
- 학비·세금 카테고리도 유사 패턴 (학교/연봉 단일 선택) 으로 확장 가능 — 필요 시 본 store 를 generic `usePreferencesStore` 로 승격 검토.

**관련:** ADR-004 (도메인별 store), ADR-014 (silent fail 금지), ADR-051 (store 추가 시 hydration import 추가 패턴), ADR-052 (hydration timeout), `src/store/rentChoice.ts`, `app/detail/[cityId]/[category].tsx`, `app/compare/[cityId].tsx`, TESTING.md §9.8.1 / §9.24 / §9.25.

### ADR-061: 학비·세금 카테고리 — 도시별 단일 선택 + 직접 입력 + 바텀시트 (`useTuitionChoiceStore` / `useTaxChoiceStore`)

**상태:** 채택 (2026-05-06)

**맥락:**

학비 (tuition) / 세금 (tax) 카테고리는 ADR-060 의 월세와 같은 "합산 의미 없음" 문제를 가졌고, 추가로 **두 가지 비대칭 버그**를 동시에 안고 있었다:

1. Detail vs Compare 비대칭 — Compare `TUITION_CONFIG.getValue` 는 `city.tuition[0]` 로 단일값을 만들어 카드를 렌더했지만, Detail `buildSections('tuition')` 은 인덱스 매핑 `seoulEntries[idx] ?? seoulEntries[0]` 로 city entries 를 서울 entries 에 강제 매칭했다. 서울 JSON 에 의도적으로 `tuition` 필드가 없으므로 (한국 거주 기준 — 학비/세금 0원 정책), Detail 의 모든 row 가 `flatMap` 에서 잘려 빈 섹션 + "학비 데이터가 아직 준비되지 않았어요." 가 노출됐다. 사용자 보고 (2026-05-06): "목록에서는 학비가 나와있는데 클릭해서 상세 비교 화면 들어가면 학비 데이터가 없다고 나와."
2. 단순 합산 의미 부족 — Detail hero 가 cityEntries 의 모든 학교/연봉 단가 합을 표시했고, 학교별 단가 편차가 매우 커서 (예: Sorbonne 3,800 EUR vs Sciences Po 14,500 EUR vs École Polytechnique 15,000 EUR) 합계는 이상치 (월 480만원 가까이) 가 나왔다. "한 사람이 3 학교를 동시에 다닐 수는 없다" — 월세 합산과 같은 결함.

추가로 사용자는 **등록된 학교/연봉 라인업 외 임의의 값** (예: "내가 합격 통보받은 ${X} 대학"·"내 실제 연봉 ${Y}") 을 직접 입력하고 싶어했다.

→ 단순히 ADR-060 의 단일 선택 패턴을 재사용하는 것 만으로는 부족 (도시별 라인업이 다름 + 직접 입력 필요). 화면 디자인도 4 형태 라디오 (월세) 와 달리 학교 수가 도시별로 1~10+ 으로 가변이라 인라인 행 cycle 이 비현실적.

**결정:**

1. **Detail 화면**: tuition / tax 섹션을 "행 1 개 (현재 선택)" 으로 전환. row 탭 → **바텀시트** 오픈 — 시트 안에 도시 등록 학교/연봉 목록 + "직접 입력" 행 → 입력 모드 전환. ADR-060 의 rent (인라인 cycle) 와 의도 차이: rent 는 4 형태 고정이라 인라인이 빠르고, tuition/tax 는 가변 N 개 + 임의 입력이라 시트가 압축적.
2. **두 개의 도메인 store** `useTuitionChoiceStore` + `useTaxChoiceStore`:
   - `TuitionChoice = { kind: 'preset'; school: string } | { kind: 'custom'; annual: number }` discriminated union.
   - `TaxChoice = { kind: 'preset'; annualSalary: number } | { kind: 'custom'; annualSalary: number }`.
   - **도시별 map** `Record<cityId, choice>` — ADR-060 의 rent 와 다름 (rent 는 전역 단일값). 도시별 학교 라인업이 완전히 다르고 (Sorbonne vs UBC vs NYU) 도시 전환 시 재선택 강요는 UX 손실.
   - persist key `tuitionChoice:v1` / `taxChoice:v1`. partialize state 만 영속, 손상 캐시 → INITIAL fallback (ADR-014 silent fail 금지).
   - hydration: `waitForAllStoresHydrated` 가 동시 await (이제 7 store).
3. **단일 fallback 정책** `resolveTuitionChoice` / `resolveTaxChoice` (순수 함수):
   - `preset` 매칭 실패 (학교/연봉 사라진 케이스 — 데이터 자동 갱신 후) → entries[0] fallback.
   - `custom` → entries 무시하고 사용자 입력 그대로. tax 의 경우 takeHomePctApprox 는 도시 첫 preset 의 값을 차용 (단순화 — v1.x 에서 정밀화).
   - entries 부재 + custom → tuition 은 custom 그대로 / tax 는 null (takeHomePct 차용 불가).
4. **Compare 화면 동기화** (ADR-060 follow-up): `TUITION_CONFIG.getValue` / `TAX_CONFIG.getValue` 가 동일 resolver 호출 → Detail 에서 바꾼 학교/연봉/직접 입력값이 Compare hero / 카드에도 즉시 반영. CategoryConfig signature 확장 — `getValue` 가 `(city, fx, rentChoice, tuitionChoice, taxChoice)` 모두 수신 (다른 카테고리는 무시).
5. **서울 데이터 결측 정책 명시화**: 서울 JSON 에 의도적으로 tuition/tax/visa 가 없다 (한국 거주 기준 — 외국 거주자 학비/세금 외 시점 0원). Detail 의 tuition/tax row 는 `seoulVal: 0` 직접 사용 (visa 와 동일 패턴). 인덱스 매핑 require-Seoul-entry 정책 폐기.
6. **공유 컴포넌트** `BottomSheet` (RN Modal 기반), `TuitionChoiceSheet`, `TaxChoiceSheet`: design/UI_GUIDE §시트 (top corners 22, white bg, navy text) 준수. 외부 영역 탭 dismiss + Android `onRequestClose`. 입력 시 `KeyboardAvoidingView` 로 키보드 가림 회피.
7. **새 토큰** `SHEET_BACKDROP_COLOR = 'rgba(17, 38, 60, 0.4)'` (`src/theme/tokens.ts`) — NativeWind className 으로 alpha 표현이 어려워 inline style 로 적용. 매직 컬러 금지 정책 유지.

**대안 검토:**

- (A 선택) 도메인 store 2 개 + 도시별 map + 시트 + 직접 입력: 사용자 의도 부합, 비대칭 버그 fix, 임의 입력 지원. 채택.
- (B) 단일 통합 store `useDetailChoicesStore` (tuition + tax + 미래 visa preset 등): 두 카테고리가 너무 비슷해 묶고 싶었지만 ADR-004 의 도메인별 분리 정책 + persist key 분리 + 손상 캐시 격리 가치가 더 큼. 거부 (필요 시 v1.x 에서 통합 검토).
- (C) 페르소나 기반 자동 매칭 (학생→첫 학교 / 직장인→평균 연봉): 데이터로는 가능하지만 사용자가 직접 바꿀 수 없으면 Detail 의 인터랙션이 무의미. (ADR-060 alt-C 와 동일 결론.)
- (D) 인덱스 매핑 그대로 두고 Seoul 데이터에 placeholder tuition/tax 추가: 서울에 0원 entry 를 박으면 Detail row 가 mount 되지만 데이터 의미 왜곡 (서울에서도 학비 비교가 가능한 듯한 표기). 거부.
- (E) 시트 대신 인라인 라디오 (월세와 동일 패턴): 학교가 1~10+ 가변이고 직접 입력 인라인 입력 폼은 화면을 어지럽힘. 거부.
- (F) 학비/세금 키 = 인덱스 (`{ kind: 'preset', index: number }`): 데이터 갱신으로 학교 추가/제거되면 인덱스가 silently 다른 학교를 가리킴 (resilience 부족). 학교 이름 / annualSalary 값으로 키 → 매칭 실패 시 entries[0] fallback 이 더 안전. 거부.

**결과 / 영향:**

- Detail tuition/tax 가 의미 있는 단일 비교 + 사용자 임의 값 적용 가능.
- 사용자 보고 비대칭 버그 (목록엔 학비 있고 상세는 없다) 즉시 해소.
- Compare hero / 카드도 동일 기준 — 도시 비교 일관성 확보.
- store 2개 추가 — 7 store 가 됐으나 hydration timeout (ADR-052) 영향 없음 (도시별 map 영속화도 ms 단위).
- 새 컴포넌트 3 개 (BottomSheet, TuitionChoiceSheet, TaxChoiceSheet) — 시트 패턴이 v1.x 의 다른 시트 (Sheet A 가정값 / Sheet B 페르소나 변경 / Sheet C 출처) 구현에서도 재사용 가능 (UI_GUIDE.md §시트 콘텐츠 사양 의 미구현 시트들).

**Compare 의 '신규' 배지 정책 (PR #25 review 명시):**

Compare 화면에서 학비·세금 카드는 `seoulVal=null` (서울 데이터 부재) → `mult='신규'` 로 처리한다. 이는 visa 카드와 동일한 패턴 — "서울에는 없고 도시에만 발생하는 비용" 임을 한눈에 보여주기 위함. Detail 에선 같은 카테고리도 `seoulVal=0` 으로 직접 사용해 hero 좌·우값에 "0원 vs N원" 으로 표시 — 사용자가 정확한 도시 비용을 0 기준으로 파악하기 위함. 즉 **두 화면이 의도적으로 다른 표현** (Compare = 한 줄 카드라 "신규" 시각 압축 / Detail = 본격 비교라 0 vs N 수치). v1.x 에서 사용자 피드백으로 통일 검토 가능.

**Deferred (v1.x):**

- 페르소나 기반 default 학교/연봉 (학생 → 첫 학교, 직장인 → 평균 연봉 tier).
- 학비 level 매칭 (undergrad/graduate) 으로 정밀화 — 현재 모든 학교를 동등하게 다룸.
- tax 의 takeHomePctApprox 보간 (사용자 custom annualSalary 와 가장 가까운 두 preset 사이 선형 보간) — 현재 첫 preset 값 차용.
- 시트 swipe-down dismiss (UI_GUIDE §295) — 현재 backdrop 탭 + Android 백버튼만.
- 직접 입력값의 KRW 환산 라이브 미리보기 (사용자 입력 시).
- `TaxChoice` discriminated union 의 두 variant 가 현재 동일한 필드 (`annualSalary`) 만 가지지만, custom variant 가 메모·메타 필드를 추가할 가능성을 위해 `kind` 분기 유지 (PR #25 4차 review).
- `useChoiceSheetState` 공통 훅 추출 — `TuitionChoiceSheet` / `TaxChoiceSheet` 가 `mode` / `draft` / `handleSaveCustom` / `handleClearCustom` / `isValidDraft` / `useEffect` 패턴을 거의 동일하게 공유. 현 규모 (2 시트) 에선 추상화 비용이 더 큼. 3개 이상으로 확장 시 추출.
- **persist v2 마이그레이션 시 `migrate` 함수 구현 필요** (PR #25 5차 review). 현재 `migrate: (persistedState) => persistedState as TuitionChoiceState` / `as TaxChoiceState` 는 **no-op** — v1 이 유일 버전인 동안엔 `isValidPersistedState` 가 정상 v1 캐시를 그대로 통과시키므로 무해. 그러나 v2 로 schema 가 바뀌면 (예: `annual` → `annualKRW` 환산, 새 discriminated variant 추가) `isValidPersistedState` 가 v1 캐시를 reject → INITIAL fallback 적용 → **사용자 도시별 선택값 전부 소실**. v2 도입 시 `migrate(persistedState, version)` 안에 v1→v2 변환 로직 + version 분기 처리 필수 (zustand persist 의 `version` 필드를 함께 bump).

**관련:** ADR-004 (도메인별 store), ADR-014 (silent fail 금지), ADR-051 (store 추가 시 hydration import), ADR-052 (hydration timeout), ADR-060 (rent 단일 선택 패턴 — 본 ADR 의 모태), `src/store/tuitionChoice.ts`, `src/store/taxChoice.ts`, `src/components/BottomSheet.tsx`, `src/components/TuitionChoiceSheet.tsx`, `src/components/TaxChoiceSheet.tsx`, `app/detail/[cityId]/[category].tsx`, `app/compare/[cityId].tsx`, TESTING.md §9.8.2 / §9.8.3 / §9.20.4 / §9.20.5 / §9.20.6 / §9.24 / §9.25.

### ADR-062: Compare 카테고리 항목별 포함/제외 토글 (`useCategoryInclusionStore`)

**상태:** 채택 (2026-05-07)

**맥락:**

Compare 화면은 페르소나(student/worker/unknown)에 따라 일정한 카테고리 집합을 나열한다 — 월세·식비·교통은 항상 표시되고, 학비·세금·비자/정착은 페르소나 활성 카테고리만 추가된다. 그러나 사용자가 자기 상황에 맞춰 **"이 항목은 내 케이스에 해당 없음"** (예: 회사 기숙사 입주 → 월세 제외, 워킹홀리데이라 학비 X, 영주권자라 비자 0원) 으로 일부를 제외하고 hero 의 "한 달 예상 총비용" 을 다시 계산할 방법이 없다.

특히 페르소나가 student/worker 더라도 학비/비자/정착을 항상 보고 싶진 않다 — 학비는 이미 결정된 학교가 있을 때만 의미 있고, 비자/정착은 입국 직전 한 번만 비교하면 된다. 현재는 학비·비자가 hero 합계에 강제로 포함돼 비교가 왜곡된다 (예: 오사카 hero 313.6만원 중 학비 41.3만원·비자 188만원 = 약 73% 가 일회성/조건부 비용).

→ 사용자가 카드별로 **포함 여부를 직접 토글** 하고, hero 합산은 토글 ON 카드만 누적. 도시별로 사용자 결정이 다를 수 있으므로 (예: 오사카는 유학 가지만 LA 는 영주권 친척 방문) **도시별 영속**.

**결정:**

1. **도메인 store** `useCategoryInclusionStore` (8번째 도메인 store) 신설:
   - 키 구조: `inclusions: Record<cityId, Partial<Record<SourceCategory, boolean>>>`
   - 영속화 키 `categoryInclusion:v1`. partialize state 만 영속, 손상 캐시 → INITIAL fallback (ADR-014 silent fail 금지).
   - 액션 `setInclusion(cityId, category, included)` / `resetCity(cityId)` / `reset()`.
   - hydration: `waitForAllStoresHydrated` 가 동시 await (이제 8 store).
2. **단일 default 정책** `resolveInclusion(cityId, category, persona, choices)` (순수 함수):
   - 사용자가 명시적으로 토글한 적이 있으면 그 값을 반환 (도시별 map 의 그 cityId 의 그 category entry).
   - 미설정이면 **persona-aware default**:
     - `rent`, `food`, `transport`: 항상 `true`
     - `tuition`: persona === 'student' 일 때만 `true`, 그 외 `false`
     - `tax`: persona === 'worker' 일 때만 `true`, 그 외 `false`
     - `visa`: 항상 `false`
   - 의도: 페르소나의 핵심 카테고리는 ON, 일회성/조건부 (visa/정착) 는 OFF, 페르소나 비활성 카테고리도 OFF — "내 페르소나의 한 달 평상 비용" 이 default 합계의 의미.
3. **UI — `ComparePair` 토글**:
   - 헤더 우측, 배수 텍스트 우측에 RN `Switch` (orange tint, `colors.orange`).
   - 제외 시 카드 전체 `opacity` 약화 + 라벨 옆 **"제외됨" 회색 pill 배지**.
   - 카드 자체의 `Pressable onPress` (Detail 진입) 와 토글 영역 분리 — 토글 `hitSlop` 으로 카드 탭 충돌 회피.
   - 색상에만 의존하지 않는 정보 표기 정책 (CLAUDE.md) — 토글 색 + 배지 텍스트 + opacity = 3중 인코딩.
4. **`HeroCard.centerMult` 옵션화** — `string | undefined`. undefined 일 때 가운데 mult/caption 영역 미렌더 (좌·우 값과 막대만 표시). Compare 의 서울합 = 0 (예: 학비 + 비자만 ON, 둘 다 서울 0원) 인 케이스에서 division by zero 회피 + `↑∞×` 같은 무의미한 표기 차단. centerCaption (예: "+229.3만원/월") 만으로도 차액 정보는 전달.
5. **합산 의미 정의 (페르소나 무관 변경)**:
   - `seoulTotal` / `cityTotal` 은 `included === true` 인 카테고리만 누적.
   - hero 의 "↑X.X×" 배수는 `seoulTotal > 0` 일 때만. `seoulTotal === 0` 이면 mult 영역 자체를 숨기고 (`centerMult={undefined}`) `centerCaption` 만 노출.
   - 카드 자체는 토글 OFF 여도 화면에서 **숨기지 않고** opacity·배지로 표시 — 사용자가 다시 켤 동선 확보. (단 기존 `seoulVal === 0 && cityVal === 0` early-return 정책은 유지 — 데이터 자체가 없는 카드는 계속 미표시.)

**대안 검토:**

- (A 선택) 도시별 map store + persona-aware default + 토글 + 흐림+배지: 사용자 의도 부합, 학비/세금/비자 모두 페르소나·상황 분기. 채택.
- (B) 전역 단일 inclusion (`Record<SourceCategory, boolean>`): rent 단일값 패턴 재사용. 그러나 도시 전환 시 같은 inclusion 이 강제 → "오사카 유학 학비 ON / LA 방문 학비 OFF" 같은 자연스러운 분기 불가능. 거부.
- (C) 페르소나만으로 자동 분기 (학비는 student 만, 비자는 한 번도 보지 않음 등): 자동성은 좋지만 사용자 override 가 없으면 케이스 손실 (예: worker 인데 학원 다닐 계획 → 학비 ON 필요). 거부.
- (D) inclusion 을 hero 카드와 categoryData 양쪽 매번 props 로 전달: store 없이 부모 state. 그러나 도시별 영속 요구가 있어 `Record<cityId, ...>` 를 부모 state 로 두면 결국 영속 필요 → store 가 옳은 위치.
- (E) 제외 카드를 화면에서 숨김 (`return null`): 시각적으로 깔끔하지만 사용자가 다시 켤 entry 가 사라짐. 거부.
- (F) 배수 영역에 `↑∞×` / `—` / `0/0` 같은 sentinel 표기: division 의미 표시는 가능하지만 시각적 혼란. centerMult 자체를 숨기는 (4번) 가 디자인적으로 가장 조용. 채택.

**결과 / 영향:**

- 사용자가 "내 케이스 한 달 예상 총비용" 을 정확히 산출 가능.
- 도시별로 다른 inclusion 가능 — "오사카 유학 풀세트" vs "LA 단기 출장 항목만".
- store 1개 추가 — 8 store 가 됐으나 hydration timeout (ADR-052) 영향 없음 (`Record<cityId, Partial<Record<6, boolean>>>` 영속화는 ms 단위).
- HeroCard `centerMult` 옵션화 — 기존 호출처 (Compare orange / Detail navy) 모두 `undefined` 가능성 처리 필요. Detail 은 항상 mult 표시 (서울합=0 가능성 없음 — 단일 카테고리) 라 기존 동작 변경 없음.
- 기본값(default)으로 학비·세금·비자가 OFF → 페르소나 worker 사용자의 hero 가 이전보다 작은 숫자로 표시될 수 있음 (학비 default OFF). 이는 "조건부/일회성 비용" 의도이며, 사용자가 토글하면 즉시 포함.

**Deferred (v1.x):**

- 토글 상태에 대한 사용자 onboarding hint (첫 진입 시 toast 또는 캡션) — UX 검증 후 추가 결정.
- inclusion 변경에 대한 `Recent` / 즐겨찾기 동기화 — 현재는 도시별 inclusion 만 영속.
- "전체 ON / 전체 OFF" 빠른 액션 — 카드 N 개 (≤6) 라 현 단계 불필요.
- persist v2 마이그레이션 시 `migrate` 함수 구현 (ADR-061 패턴 — 현재 v1 단독, no-op).

**관련:** ADR-004 (도메인별 store), ADR-014 (silent fail 금지), ADR-051 (hydration import 패턴), ADR-052 (hydration timeout), ADR-060 (rent 단일 선택 — 전역값 패턴), ADR-061 (도시별 map 패턴 — 본 ADR 의 모태), `src/store/categoryInclusion.ts`, `src/components/ComparePair.tsx`, `src/components/cards/HeroCard.tsx`, `app/compare/[cityId].tsx`, TESTING.md §9.8.4 / §9.20.7 / §9.24 / §9.25.

### ADR-063: EAS Build 출시 전략 — Android 단독 v1.0 + 3개 프로필

**컨텍스트:**

v1.0 출시를 앞두고 EAS Build/Submit 설정(`eas.json`)이 필요. 사이드 프로젝트 + 1차 페르소나가 한국 유학·취업자라는 점 + 출시 비용 최소화 요구가 얽혀 있다.

**결정:**

1. **Android 단독 v1.0** — Apple Developer Program $99/년 비용을 v1.x 까지 보류.
   - `app.json` 의 `ios.bundleIdentifier` 는 정의 유지 (식별자 선점), 다만 `eas.json` 에 iOS 프로필 미포함 → 실제 iOS 빌드/제출 발생 안 함.
   - iOS 프로필 정식 추가는 v1.x 에서 별도 ADR (Apple Developer 계정 + provisioning profile + TestFlight 흐름).
2. **EAS Build 3개 프로필** (RELEASE.md §3 명세 구현):
   - `development` — APK + dev client + `distribution: internal`. 시뮬레이터/실기기 dev.
   - `preview` — APK release + `distribution: internal`. 사이드로드 베타용 (Play Console 거치지 않는 빠른 배포).
   - `production` — AAB (`buildType: app-bundle`). Play Store 정식 업로드용.
3. **EAS Submit 정책**:
   - `submit.production.android.track: "internal"` — 첫 업로드는 항상 Internal testing.
   - `releaseStatus: "draft"` — 자동 공개 차단, 운영자가 콘솔에서 명시적 promote.
4. **`cli.appVersionSource: "local"`** — 버전은 `app.json` 단일 출처. EAS 클라우드 remote 버전 정책 미사용 (1인 운영에서는 명시적·예측 가능).
5. **EAS Update channel 사전 설정** — `production` 프로필에 `channel: "production"` 명시. v1.0 은 OTA 미사용이지만 v1.x OTA 도입 시 동일 빌드에 즉시 적용 (RELEASE.md §16).

**대안 검토:**

- (A 선택) Android 단독 + 3 프로필: 비용 0, 핵심 페르소나 디바이스 대응. iOS 는 v1.x.
- (B) iOS + Android 동시: $99 즉시 발생 + TestFlight/심사 추가 작업. 사이드 프로젝트 단계에서 과한 commit.
- (C) preview 도 AAB: Internal testing 도 AAB 가능하나, 사이드로드/지인 베타 단계에서는 APK 가 단순 (Play Console 거치지 않음). preview 와 production 의 분리가 명확.
- (D) Submit 자동화 미설정: 첫 빌드를 콘솔 수동 업로드. 가능하지만 service account 등록만 끝나면 자동화가 운영 부담을 줄임 → submit 섹션을 미리 박아둠.
- (E) `appVersionSource: "remote"`: EAS 가 buildNumber 자동 증가. 1인 운영에서는 local 이 명시적·예측 가능.
- (F) `channel` 미설정: v1.0 OTA 미사용이라 당장은 무관하나, 나중에 추가하려면 새 production 빌드 필요 (channel 은 빌드 시점에 박힘) → 미리 설정.

**결과 / 영향:**

- v1.0 베타·출시 전 과정이 무료 (Play Console $25 1회만).
- iOS 사용자는 v1.x 까지 대기 — 마케팅·커뮤니케이션에 명시 필요 (RELEASE.md §12 콜드스타트 채널의 한국인 유학·이주 카페에 노출 시 "Android 우선 출시" 표기).
- `eas build --profile preview --platform android` 로 베타 APK 즉시 생성, `eas build --profile production --platform android` 로 Play Store AAB 생성, `eas submit --platform android` 로 Internal track draft 자동 업로드.
- OTA 도입 시 `channel: "production"` 가 이미 있으므로 `eas update --branch production` 만 추가하면 됨.

**Deferred (v1.x):**

- iOS 프로필 추가 시 별도 ADR (Apple Developer 계정 + provisioning profile + TestFlight 흐름).
- `submit.production.android.serviceAccountKeyPath` — Play Console service account JSON 발급 후 `eas credentials` 로 EAS 클라우드에 보관.
- EAS Update 도입 시점 결정 (스키마 변경·UI 패치 빈도 가시화 후).

**관련:** RELEASE.md §3 (EAS 프로필), §4 (릴리스 절차), §16 (앱 업데이트 메커니즘), `eas.json`, `app.json`, PR #29.
