# 프로젝트: 해외 생활비 비교 앱 (overseas-cost-app)

서울 거주 한국인이 유학·취업 등 해외 이주 준비 시 **서울 vs 해외 도시**의 생활비를 항목별로 1:1 비교하는 모바일 앱. v1.0 출시 도시 20개 + 서울. 페르소나(유학생 / 취업자 / 모름) 분기. 사이드 프로젝트, 무료 인프라로 시작. 자세한 요구사항은 `docs/PRD.md`.

## 기술 스택

- **React Native (Expo Managed Workflow)** + **Expo Router** (파일 기반 라우팅)
- **TypeScript** (strict mode)
- **NativeWind v4** (Tailwind for RN)
- **Zustand + AsyncStorage** (도메인별 영속화 스토어 — persona / favorites / recent / settings)
- 데이터: **GitHub raw JSON + 24h TTL 캐시 + 번들 시드 fallback**
- 환율: **open.er-api.com** (무료, API 키 불필요)
- 빌드·배포: **EAS Build + EAS Update**
- 테스트: **Jest + @testing-library/react-native**
- 폰트: Manrope, Mulish (Google Fonts) + Pretendard (한국어 fallback)

## 아키텍처 규칙

- **CRITICAL**: 모든 디자인 토큰(색·폰트·간격·라운드·shadow)은 `tailwind.config.js` + `src/theme/tokens.ts` 단일 출처에서만 정의한다. 컴포넌트에 매직 넘버 색상값을 직접 박지 않는다.
- **CRITICAL**: 외부 데이터(도시 JSON, 환율)는 반드시 `src/lib/data.ts` / `src/lib/currency.ts` 를 경유한다. 컴포넌트가 `fetch` 를 직접 호출하지 않는다.
- **CRITICAL**: 데이터는 **공공 출처에서 자동으로** 만 갱신한다 (ADR-032). 정부 통계 API·공식 정부 페이지·공식 교통공사·공식 대학 페이지 외 출처 (Numbeo·Expatistan·Zillow·Kijiji·Yelp 등 상업 플랫폼) 사용 금지. 자동 fetch 는 `scripts/refresh/<source>.mjs` + GitHub Actions cron 으로만 (수동 큐레이션 금지).
- **CRITICAL**: 페르소나는 `'student' | 'worker' | 'unknown'` 세 값만. Compare 카드 구성은 페르소나로 분기하되, `'unknown'` 은 student + worker **합집합**을 보여준다 (제외 아님).
- **CRITICAL**: Hot 규칙 — 배수 ≥ 2.0× 면 `hot=true` (아이콘 박스 orange tint, 배수 텍스트 orange). 단일 함수 `isHot(mult)` 로 일관 판정.
- **CRITICAL**: TypeScript `strict` 모드 유지. `any` 사용 금지(불가피하면 ADR 추가). 외부 라이브러리 타입은 `unknown` + 타입 가드로 처리.
- **CRITICAL**: 에러는 삼키지 않는다. 네트워크·파싱·검증 실패는 명시적 에러 타입(`UnknownCurrencyError`, `CityParseError`, `CitySchemaError` 등)으로 throw 하고 화면 단에서 ErrorView 또는 inline 배지로 노출. silent fail 금지.
- 디렉터리 분리: 화면은 `app/` (Expo Router), 컴포넌트 `src/components/`, 스토어 `src/store/`, 라이브러리 `src/lib/`, 타입 `src/types/`, 테마 `src/theme/`, 시드 데이터 `data/seed/`, 도시 JSON `data/cities/`.
- 색상에만 의존하지 않는 정보 표기 (배수 `↑1.9×` 처럼 **화살표 + 숫자 + 색상** 3중 인코딩).
- 한국어 문구를 1차로 사용한다. 영어 fallback 은 도시 영문명·통화 코드처럼 본질적으로 영어인 경우에만.

## 네이밍·코드 스타일

- 컴포넌트: `PascalCase.tsx` (1파일 1컴포넌트 원칙)
- hook·util: `camelCase.ts` (`useFoo`, `formatKRW`)
- 타입: `PascalCase` (`CityCostData`)
- 상수: `SCREAMING_SNAKE_CASE` (`MAX_RECENT = 5`)
- 폴더: `camelCase` 또는 `kebab-case` 일관 (현재 `kebab-case` 채택)
- import 순서: 1) RN/Expo 표준 → 2) 외부 라이브러리 → 3) `src/` alias → 4) 상대 경로. ESLint 가 강제.

## 개발 프로세스

- **CRITICAL**: 새 lib·컴포넌트·화면 추가 시 같은 step 안에서 **테스트를 함께 작성**한다 (TDD 지향). 신규 모듈은 반드시 `docs/TESTING.md` §7 인벤토리에 항목을 추가. 인벤토리 누락 = step 미완.
- **CRITICAL**: 커밋 메시지는 conventional commits — `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`. 하네스가 자동 생성하는 메시지 (`feat(<phase>): step N — <name>`) 도 이 규칙을 따른다.
- **CRITICAL**: 새 외부 의존성·결정 사항은 `docs/ADR.md` 에 ADR-N 추가 후 도입.
- 각 step (하네스 framework) 종료 시 `phases/<phase>/index.json` 의 해당 step status 를 `completed` / `error` / `blocked` 로 업데이트한다. 자세한 규칙은 `README.md` 와 `phases/improve-harness-dx/step{0,1}.md` 의 모범 사례 참고.
- 디자인 1차 출처는 `docs/design/README.md` 의 토큰·타이포·컴포넌트 명세. JSX hifi 파일들은 시각·구조 참고용이며 **웹 React 코드라 그대로 가져다 쓸 수 없다**(div/className → View/Text + NativeWind 포팅 필요).
- 데이터 추가/갱신은 `docs/DATA.md` 의 큐레이션 절차를 따른다. 출처 미기재 데이터 추가 금지.

## 명령어

```bash
npm install --legacy-peer-deps   # ADR-044: expo-router 6 의 react-server-dom-webpack peerOptional 충돌 회피
npm run dev         # Expo 개발 서버 (Expo Go 또는 iOS/Android 시뮬레이터)
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint
npm test            # Jest (--passWithNoTests 허용)
npm run build       # eas build — 요청 시에만 실행
```

하네스 명령:

```bash
python3 scripts/execute.py status                       # 전체 phase 현황
python3 scripts/execute.py run <phase>                  # phase 실행
python3 scripts/execute.py reset <phase> [--step N]     # 실패 step 리셋
python3 scripts/execute.py init <phase> --steps N --project overseas-cost-app
```

## 문서 색인

- `docs/PRD.md` — 제품 요구사항 (단일 출처, 수정 금지)
- `docs/ARCHITECTURE.md` — 디렉터리 구조, 데이터 흐름, 라우팅·상태·hydration·에러 핸들링
- `docs/UI_GUIDE.md` — 디자인 토큰, 타이포, 컴포넌트 사양, 인터랙션, 시트·토스트·스플래시, 안티패턴
- `docs/TESTING.md` — 테스트 정책, 모킹 규약, **모듈별 전체 테스트 인벤토리**, 엣지 케이스, 수동 e2e
- `docs/DATA.md` — 도시 JSON 스키마, 출처 정책, 자동화 정책, 환율 fallback chain
- `docs/DATA_SOURCES.md` — **21개 도시 × 카테고리별 공공 출처 매핑** (자동화 actionable 가이드)
- `docs/AUTOMATION.md` — **GitHub Actions 인프라, scripts/refresh 명세, 워크플로우, secrets, 변동 검증, 알림**
- `docs/RELEASE.md` — 버전·브랜치·EAS·스토어 제출·개인정보·고객지원·재해복구·마케팅
- `docs/ADR.md` — 아키텍처 결정 기록 (신규 결정은 새 ADR 추가)
- `docs/design/README.md` — 디자인 토큰·5개 화면 명세 (구현 시 1차 참조)
- `docs/design/hifi/*.jsx` — 화면별 hi-fi mock (참고용, RN 포팅 필요)
- `phases/` — 하네스 phase 디렉터리. 모범 예시는 `phases/improve-harness-dx/`
