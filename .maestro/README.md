# E2E 테스트 (Maestro)

iOS 시뮬레이터에서 앱을 실제로 구동해 UI 플로우를 검증한다.

## 사전 요구

- **Maestro** — `curl -fsSL "https://get.maestro.mobile.dev" | bash` (검증: `maestro --version`)
- **Java 17+** — Maestro 런타임
- **Xcode + iOS 시뮬레이터** — 부팅된 시뮬레이터 1대 (`xcrun simctl list devices booted`)

## 앱 구동 방식: Dev build (`expo run:ios`)

Maestro 는 앱을 **번들 ID(`com.laegel.overseascostapp`)** 로 직접 launch 한다.
따라서 시뮬레이터에 앱이 설치돼 있어야 한다.

```bash
# 1) 네이티브 dev client 빌드 + 시뮬레이터 설치 (최초 1회, 수 분 소요 — ios/ 생성)
npx expo run:ios --device "iPhone 17 Pro"

# 2) Metro 번들러 실행 (debug 빌드는 JS 를 Metro 에서 로드)
npm run dev            # 별도 터미널에서 유지

# 3) 플로우 실행
npm run e2e            # .maestro 전체
npm run e2e:smoke      # 스모크만
```

> debug 빌드는 Metro 가 떠 있어야 JS 가 로드된다. Metro 없이 독립 실행하려면
> `npx expo run:ios --configuration Release` 로 JS 번들이 포함된 빌드를 만든다.

## 구성

```
.maestro/
├── config.yaml       # 워크스페이스 (smoke + flows/** 만 실행 대상)
├── smoke.yaml        # 파이프라인 sanity
├── common/           # runFlow 전용 재사용 서브플로우 (단독 실행 X)
│   ├── onboard.yaml              # clearState → 도시 선택 온보딩 → compare → 뒤로 → 홈
│   └── open-vancouver-compare.yaml
└── flows/            # 유스케이스 배치
    ├── 01-onboarding/   02-home/         03-compare/
    ├── 04-favorites-recent/  05-detail/  06-settings/
    └── 07-visual-a11y/
```

- **배치별 실행 런북 + 리스크 + 문서-구현 격차:** `.maestro/PLAN.md`
- **정식 인벤토리(체크리스트):** `docs/TESTING.md §18-A`
- **도입 근거:** `docs/adr/066-maestro-e2e.md`

```bash
maestro test .maestro/flows/01-onboarding        # 배치 하나
maestro test --include-tags compare              # 태그로 선택
maestro test .maestro/flows/05-detail/tuition-sheet.yaml  # 단일 flow
```

## 앵커 규약

플로우는 텍스트가 아닌 **`testID`(iOS accessibilityIdentifier)** 를 우선 사용한다.
주요 앵커: `onboarding-screen`, `onboarding-city-{cityId}`, `compare-screen`, `home-screen`,
`home-search-input`, `home-search-result-{cityId}`.

> ADR-067: 온보딩은 페르소나 선택이 아니라 **도시 선택**이다. 도시를 고르면 서울 vs 그 도시
> Compare 로 직행하고, 그 도시가 즐겨찾기에 담긴다. 옛 `persona-card-*` 앵커는 더 이상 없다.
