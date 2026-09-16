# Step 0: sdk-spike

## 배경

이 phase(`admob-banner-ads`)는 **Google AdMob 하단 배너 광고**를 홈·비교·상세 3개 화면에 도입한다 (앱 버전 1.1.0, ADR-077 예정). 설계 정본은 `docs/plans/admob-banner-ads.md` 이며, 사용자 확정 결정은 다음과 같다:

1. 광고 형식: 화면 하단 고정 anchored adaptive 배너 1종. 전면 광고 범위 밖.
2. 노출 화면: 홈·비교·상세 3개의 ready 상태만. 온보딩·설정·출처·개인정보 화면 광고 없음.
3. iOS ATT 프롬프트 사용 (UMP SDK 가 처리).
4. 광고 네트워크: Google AdMob (`react-native-google-mobile-ads` 16.x).

phase 전체 계획 (이 step 은 **0번만** 수행한다):

0. **(이 step)** 스파이크 — SDK 설치 + `app.json` config plugin(샘플 App ID) + 네이티브 빌드가 실제로 성공·부팅하는지 + jest/tsc 가 `.native.ts` 플랫폼 분기를 해석하는지 검증
1. `src/lib/ads.native.ts` / `ads.web.ts` + `AdsConfigError` + jest mock + ESLint 강제
2. `src/store/ads.ts`
3. `Screen` `footer` 슬롯
4. `AdBanner` 컴포넌트
5. 루트 레이아웃 동의·초기화 트리거 + 화면 3개 footer 배선
6. 설정 화면 "광고 개인정보 설정" 조건부 메뉴
7. 개인정보 처리방침 개정 + 스토어 문서
8. 나머지 문서 (ADR-077, CLAUDE.md, ARCHITECTURE, UI_GUIDE, TESTING, README, PLAN.md)
9. 버전 1.1.0 · eas.json env · `.env.example` · Maestro 전체 재실행

**이 step 은 앱 코드를 작성하지 않는다.** 산출물은 `package.json`/`package-lock.json` 의존성, `app.json` plugin 블록, `tsconfig.json` 의 `moduleSuffixes`, 그리고 스파이크 결과 기록 `phases/admob-banner-ads/SPIKE_RESULT.md` 다. step 1~9 는 이 결과를 전제로 진행하므로 **실패를 성공으로 보고하지 마라**.

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래를 반드시 직접 Read 할 것:

- `CLAUDE.md` — 특히 "새 외부 의존성은 ADR 후 도입" (ADR-077 은 step 8 이 작성한다. 이 step 은 그 결정을 전제로 스파이크만 한다)
- `docs/plans/admob-banner-ads.md` — §검증 결과 (라이브러리 호환·Expo Go 불가·정적 프레임워크·웹 번들·E2E), §B-1, §B-2, §실행 순서의 step 0 행
- `docs/adr/044-legacy-peer-deps.md` (있으면) 또는 `docs/ADR.md` 의 044 행 — `--legacy-peer-deps` 사유
- `docs/adr/063-eas-build-android.md`, `docs/RELEASE.md` §3 (환경·EAS 프로필)
- `.maestro/README.md` — dev build 구동 방식 (`npx expo run:ios --device "iPhone 17 Pro"` + Metro + `npm run e2e:smoke`)
- `app.json`, `eas.json`, `package.json`, `tsconfig.json`, `jest.config.js`, `.gitignore` (60~61행: `ios/`, `android/` 는 무시 대상)
- `scripts/e2e/preflight.mjs` — `npm run e2e:check` 가 무엇을 전제하는지

## 작업

### 0. 사전 확인

```bash
xcodebuild -version              # Xcode 라이선스 미동의 메시지가 나오면 즉시 blocked (사용자가 `sudo xcodebuild -license accept` 필요)
xcrun simctl list devices available | grep -i "iPhone 17 Pro"
eas whoami                       # 로그인 상태 (juno1001). 미로그인이면 blocked
git status --porcelain           # 깨끗해야 함
```

### 1. 패키지 설치

```bash
npx expo install react-native-google-mobile-ads -- --legacy-peer-deps
```

- 착수 시점 npm 최신은 **16.5.0** (peer `expo >= 47`). Expo 가 고른 버전이 16.x 인지 `package.json` 에서 확인하고 SPIKE_RESULT 에 적는다. 17.x 가 잡히면 `^16.5.0` 으로 고정한다 (16.x API 를 기준으로 step 1 명세가 작성됐다).
- `--legacy-peer-deps` 가 없으면 expo-router 6 peer 충돌이 난다 (ADR-044).

### 2. `app.json` — config plugin (샘플 App ID)

`plugins` 배열에 추가한다. 아래 두 App ID 는 **Google 공식 샘플 App ID** 다 (비밀 아님, 커밋 가능). 운영자가 AdMob 콘솔에서 실제 ID 를 받으면 step 9 이후 교체한다.

```jsonc
[
  "react-native-google-mobile-ads",
  {
    "androidAppId": "ca-app-pub-3940256099942544~3347511713",
    "iosAppId": "ca-app-pub-3940256099942544~1458002511",
    "userTrackingUsageDescription": "광고 식별자를 이용해 관련성 높은 광고를 표시하고 광고 성과를 측정하기 위해 사용됩니다.",
    "skAdNetworkItems": [ /* 아래 50개 */ ]
  }
]
```

`skAdNetworkItems` 는 Google 공식 문서(https://developers.google.com/admob/ios/ios14) 의 목록을 2026-09-16 에 가져온 것이다. **50개 전부** 넣는다:

```
cstr6suwn9.skadnetwork  4fzdc2evr5.skadnetwork  2fnua5tdw4.skadnetwork  ydx93a7ass.skadnetwork
p78axxw29g.skadnetwork  v72qych5uu.skadnetwork  ludvb6z3bs.skadnetwork  cp8zw746q7.skadnetwork
3sh42y64q3.skadnetwork  c6k4g5qg8m.skadnetwork  s39g8k73mm.skadnetwork  wg4vff78zm.skadnetwork
3qy4746246.skadnetwork  f38h382jlk.skadnetwork  hs6bdukanm.skadnetwork  mlmmfzh3r3.skadnetwork
v4nxqhlyqp.skadnetwork  wzmmz9fp6w.skadnetwork  su67r6k2v3.skadnetwork  yclnxrl5pm.skadnetwork
t38b2kh725.skadnetwork  7ug5zh24hu.skadnetwork  gta9lk7p23.skadnetwork  vutu7akeur.skadnetwork
y5ghdn5j9k.skadnetwork  v9wttpbfk9.skadnetwork  n38lu8286q.skadnetwork  47vhws6wlr.skadnetwork
kbd757ywx3.skadnetwork  9t245vhmpl.skadnetwork  a2p9lx4jpn.skadnetwork  22mmun2rn5.skadnetwork
44jx6755aq.skadnetwork  k674qkevps.skadnetwork  4468km3ulz.skadnetwork  2u9pt9hc89.skadnetwork
8s468mfl3y.skadnetwork  klf5c3l5u5.skadnetwork  ppxm28t8ap.skadnetwork  kbmxgpxpgc.skadnetwork
uw77j35x4d.skadnetwork  578prtvx9j.skadnetwork  4dzt52r2t5.skadnetwork  tl55sbb4fm.skadnetwork
c3frkrj4fj.skadnetwork  e5fvkxwrpn.skadnetwork  8c4e2ghe7u.skadnetwork  3rd42ekr43.skadnetwork
97r2b46745.skadnetwork  3qcr597p9d.skadnetwork
```

- `version`, `versionCode`, `buildNumber` 는 **바꾸지 않는다** (step 9).
- `expo-build-properties` 는 지금 넣지 않는다. iOS 빌드가 실패할 때만 아래 4 의 실패 사다리에서 추가한다.

```bash
npx expo config --type introspect > /tmp/introspect.json
grep -c "GADApplicationIdentifier\|NSUserTrackingUsageDescription\|SKAdNetworkItems" /tmp/introspect.json   # ≥ 3 (ios.infoPlist 에 반영됐는지)
```

### 3. 플랫폼 분기 해석 검증 (jest + tsc)

step 1 은 `src/lib/ads.native.ts` / `ads.web.ts` 두 파일만 두고 `./ads` 로 import 한다. Metro 는 `.native` 를 고르지만 **jest 와 tsc 도 그러는지** 여기서 확인한다.

1. 임시 파일 생성: `src/lib/__spike__/probe.native.ts` (`export const PLATFORM = 'native';`), `src/lib/__spike__/probe.web.ts` (`export const PLATFORM = 'web';`), `src/lib/__spike__/probe.test.ts` (`import { PLATFORM } from './probe'; it('resolves native', () => expect(PLATFORM).toBe('native'));`).
2. `npx jest src/lib/__spike__` → 통과해야 함 (jest-expo 기본 preset 은 iOS 플랫폼). 실패하면 `jest.config.js` 에 `haste: { defaultPlatform: 'ios', platforms: ['ios', 'android', 'native'] }` 를 추가해 재시도하고 SPIKE_RESULT 에 기록.
3. `npm run typecheck` → `./probe` 를 못 찾아 **실패할 것이 예상된다** (`tsconfig.json` 에 `moduleSuffixes` 가 없음). `tsconfig.json` `compilerOptions` 에 `"moduleSuffixes": [".ios", ".android", ".native", ""]` 를 추가하고 재실행 → 통과해야 함. **이 tsconfig 변경은 유지한다** (step 1 의 전제).
4. `npm run typecheck && npm run lint && npm test` 전체 그린 확인 (moduleSuffixes 추가가 기존 코드를 깨지 않는지).
5. `src/lib/__spike__/` 를 **삭제**한다.

### 4. iOS 로컬 dev build (시뮬레이터 부팅 검증)

```bash
xcrun simctl boot "iPhone 17 Pro" 2>/dev/null || true
npx expo run:ios --device "iPhone 17 Pro"          # 네이티브 빌드 + 설치 (수 분). ios/ 는 gitignore 대상
```

빌드 성공 후 Metro 를 백그라운드로 띄우고 스모크 flow 로 부팅을 확인한다:

```bash
npm run dev &                                        # 백그라운드. 종료 시 kill
npm run e2e:check
npm run e2e:smoke                                    # 통과 = 앱이 부팅하고 온보딩 화면까지 렌더
```

**실패 사다리** (순서대로, 각 시도 결과를 SPIKE_RESULT 에 기록):

- (a) `npx expo install --fix` 후 재빌드
- (b) `react-native-google-mobile-ads` 를 16.x 하위 버전으로 고정 (`16.4.x` → `16.3.x`) 후 재빌드
- (c) iOS 한정: `npx expo install expo-build-properties` + `app.json` plugins 에 `["expo-build-properties", { "ios": { "useFrameworks": "static" } }]` 추가 후 재빌드
- 셋 다 실패 → `error` 로 마감하고 에러 로그 핵심을 `error_message` 에 적는다. step 1 이후는 사용자가 판단한다.

부팅 후 **ATT 프롬프트가 뜨는지 관찰**한다 (아직 동의 코드가 없으므로 뜨지 않는 것이 정상). Maestro 스모크 로그에 예상 밖 시스템 다이얼로그가 있으면 기록.

### 5. Android EAS 빌드 (빌드 성공까지만)

이 머신에는 Android SDK·에뮬레이터가 없다. Android 는 **EAS 클라우드 빌드가 성공하는지까지만** 확인하고 APK 부팅은 사용자가 실기기로 수동 확인한다.

```bash
eas build --platform android --profile development --non-interactive --no-wait   # 4 의 iOS 빌드와 병렬로 시작하는 것을 권장 — 이 명령을 4 보다 먼저 실행해도 된다
eas build:list --platform android --limit 1 --json --non-interactive              # status 가 FINISHED 가 될 때까지 60초 간격으로 폴링 (최대 30분)
```

- `FINISHED` → 빌드 URL 을 SPIKE_RESULT 에 적는다.
- `ERRORED` → `eas build:view <id>` 로 로그를 받아 실패 원인을 기록하고, 위 실패 사다리 (a)·(b) 를 적용해 1회 재시도. 그래도 실패면 iOS 결과와 함께 `error`.
- 30분 내 끝나지 않으면 빌드 ID 를 기록하고 "결과 미확인 — 사용자가 `eas build:view <id>` 로 확인" 으로 SPIKE_RESULT 에 남긴 뒤 iOS 결과만으로 판정한다 (`completed` 가능, summary 에 명시).

### 6. `phases/admob-banner-ads/SPIKE_RESULT.md` 작성

step 8 이 ADR-077 에 옮겨 적을 수 있도록 사실만 기록한다:

- 설치된 `react-native-google-mobile-ads` 버전, 사용한 install 명령
- `expo config --type introspect` 확인 결과 (Info.plist 키 3종, Android manifest meta-data)
- jest `.native` 해석 결과 (haste 설정 추가 여부), `moduleSuffixes` 추가 여부
- iOS 로컬 빌드: 성공 여부, 실패 사다리 적용 단계, `expo-build-properties` 추가 여부, 스모크 결과
- Android EAS: 빌드 ID·URL·status
- ATT 프롬프트 관찰 결과
- 소요 시간

### 7. 정리

- Metro 백그라운드 프로세스 종료.
- `git status` 에 남는 변경이 `package.json`, `package-lock.json`, `app.json`, `tsconfig.json`, (실패 사다리 (c) 적용 시) `expo-build-properties` 관련, `phases/admob-banner-ads/SPIKE_RESULT.md` 뿐인지 확인. `ios/` 디렉터리는 gitignore 대상이라 남지 않는다. 임시 `__spike__` 는 삭제됐어야 한다.

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm test
grep -c '"react-native-google-mobile-ads"' package.json app.json      # 각 1
grep -o 'skadnetwork' app.json | wc -l                                  # 50
grep -c 'moduleSuffixes' tsconfig.json                                  # 1
test ! -d src/lib/__spike__
test -f phases/admob-banner-ads/SPIKE_RESULT.md
npm run e2e:check                                                       # 시뮬레이터 + dev build 설치 확인 (Metro 는 종료했어도 무방하면 통과 조건에서 제외)
```

## 검증 절차

1. 위 AC 를 실행한다. iOS 스모크(`npm run e2e:smoke`) 통과 로그가 SPIKE_RESULT 에 있어야 한다.
2. 아키텍처 체크리스트:
   - 앱 코드(`src/`, `app/`)에 광고 관련 파일을 만들지 않았는가? (step 1 이후 범위)
   - `app.json` 의 버전 필드를 건드리지 않았는가?
   - 실패를 성공으로 보고하지 않았는가? (스모크 미통과 = `error`)
3. 결과에 따라 `phases/admob-banner-ads/index.json` 의 step 0 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 에 **버전·iOS 빌드 결과·Android 빌드 status·moduleSuffixes/haste 추가 여부·expo-build-properties 추가 여부** 를 담는다 (step 1·8 이 이 summary 를 전제로 한다)
   - 실패 사다리 소진 → `"status": "error"`, `"error_message"` 에 마지막 실패 로그 핵심
   - Xcode 라이선스·EAS 로그인 등 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- `src/`, `app/` 아래에 광고 코드를 작성하지 마라. 이유: 이 step 은 빌드·해석 검증만 한다. lib·store·컴포넌트는 step 1~4 다.
- `app.json` 의 `version`·`android.versionCode`·`ios.buildNumber` 를 바꾸지 마라. 이유: step 9 의 범위이며, 버전이 바뀌면 `runtimeVersion` 이 갈려 OTA 채널이 분리된다.
- `eas build --platform ios` 를 실행하지 마라. 이유: iOS 는 로컬 `expo run:ios` 로 검증하기로 결정됐고, EAS iOS 빌드는 실기기 프로비저닝이 필요하며 시뮬레이터 E2E 에 쓸 수 없다.
- `eas.json` 을 수정하지 마라. 이유: `EXPO_PUBLIC_ADS_TEST` 환경변수는 step 9 에서 추가한다.
- `ios/` 디렉터리를 커밋하지 마라. 이유: `.gitignore` 대상 (prebuild 산출물).
- `expo-build-properties` 를 예방적으로 추가하지 마라. 이유: 설계 결정 — iOS 빌드가 실제로 실패할 때만 추가한다 (`docs/plans/admob-banner-ads.md` §검증 결과).
- 스모크가 실패했는데 `completed` 로 마감하지 마라. 이유: 이후 모든 step 이 "네이티브 빌드가 부팅한다" 를 전제로 한다.
