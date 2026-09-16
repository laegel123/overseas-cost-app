# Step 9: release-e2e

## 배경

이 phase(`admob-banner-ads`)는 Google AdMob 하단 배너를 홈·비교·상세 3개 화면에 도입한다. step 0~8 로 구현과 문서가 끝났다.

**이 step 은 릴리스 설정을 확정하고 E2E 전체를 재실행한다:** `app.json` 버전 1.1.0 · `versionCode` 4 · `ios.buildNumber` "1", `eas.json` 의 `EXPO_PUBLIC_ADS_TEST` 스위치, `.env.example`, Maestro 26개 flow 재실행. 수동 동의 체크 3건(ATT·GDPR 폼·오프라인)은 **사용자가 수행**하며, 이 step 은 체크리스트가 문서에 있는지만 확인한다.

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래를 반드시 직접 Read 할 것:

- `CLAUDE.md`
- `docs/plans/admob-banner-ads.md` §B-2 (버전·buildNumber), §B-3 (eas.json env), §Maestro E2E, §실행 순서 step 7 행
- `docs/adr/077-admob-banner-ads.md` — step 8 이 기록한 결정
- `docs/RELEASE.md` §1 버전 전략, §3 환경·EAS 프로필, §16 업데이트 메커니즘(`runtimeVersion.policy = appVersion`)
- `docs/adr/063-eas-build-android.md`, `docs/adr/064-eas-update-track.md`
- `app.json` (현재 `version: 1.0.0`, `android.versionCode: 3`, `ios.buildNumber` 없음), `eas.json` (development / preview / production 프로필, `appVersionSource: local`), `.gitignore` (37~39행 `.env*` 무시 — `.env.example` 은 무시 대상이 아닌지 확인)
- `src/lib/ads.native.ts` — `resolveAdsMode(env = process.env.EXPO_PUBLIC_ADS_TEST, dev = __DEV__)` 계약
- `.maestro/README.md`, `.maestro/PLAN.md` (step 8 갱신본 — 배너로 인한 스크롤 리스크, ATT 기록), `.maestro/common/onboard.yaml` (step 5 가 optional 탭을 넣었는지)
- `scripts/e2e/preflight.mjs` — `npm run e2e:check`
- `docs/TESTING.md` §18-A, §18.9 (step 8 이 추가한 수동 체크리스트)
- `phases/admob-banner-ads/index.json` — step 5 summary 의 ATT 관찰 결과
- `README.md` — step 8 이 넣은 `.env.example` 안내

## 작업

### 1. `app.json`

- `"version": "1.1.0"` — 네이티브 의존성 추가 = 새 바이너리. `runtimeVersion.policy = appVersion` 이라 OTA 호환 키가 자동으로 `1.1.0` 으로 갈린다 (1.0.x 바이너리에 1.1.0 JS 가 OTA 로 가지 않는다).
- `"android": { "versionCode": 4, ... }`.
- `"ios": { ..., "buildNumber": "1" }` — 현재 없음. `appVersionSource: local` 이라 새 바이너리 제출 시 필요.
- 이외 필드(plugin 블록, App ID 샘플값) 무변경.

### 2. `eas.json` — 테스트 광고 스위치

```jsonc
"build": {
  "development": { ...기존, "env": { "EXPO_PUBLIC_ADS_TEST": "1" } },
  "preview":     { ...기존, "env": { "EXPO_PUBLIC_ADS_TEST": "1" } },
  "production":  { ...기존 }                                   // 변수 없음 → 실제 광고 단위 (placeholder 면 AdsConfigError 로 광고만 꺼짐)
}
```

`EXPO_PUBLIC_*` 는 빌드 시 인라인된다. 프리뷰 빌드를 지인에게 배포해도 테스트 광고만 나가므로 무효 트래픽 위험이 없다.

### 3. `.env.example` (신규)

```
# 로컬 개발: `cp .env.example .env`. 개발·프리뷰 빌드는 eas.json 이 같은 값을 주입한다.
# 1 = Google 테스트 광고 단위 사용 (실 광고 단위에 무효 트래픽을 만들지 않는다). __DEV__ 에서는 값이 없어도 테스트 모드.
EXPO_PUBLIC_ADS_TEST=1
```

`.gitignore` 가 `.env.example` 을 무시하지 않는지 확인 (`git check-ignore .env.example` 이 아무것도 출력하지 않아야 함). 무시된다면 `.gitignore` 에 `!.env.example` 추가.

### 4. `README.md`

step 8 이 넣은 `.env.example` 안내가 실제 파일명·변수명과 일치하는지 확인. 불일치만 수정.

### 5. Maestro 전체 재실행

```bash
xcrun simctl list devices booted | grep -q Booted || xcrun simctl boot "iPhone 17 Pro"
npm run e2e:check                    # dev build 설치 확인 (step 0 산출물). 없으면 npx expo run:ios --device "iPhone 17 Pro" 1회
npm run dev &                        # Metro
npm run e2e                          # smoke + flows/** 전체 (26 flow)
```

- **26개 flow 전부 통과**가 목표. 실패 flow 는 원인을 분류한다:
  - (a) 배너로 인한 스크롤 거리 변화 → 해당 flow 의 `scrollUntilVisible`/`swipe` 조정 (앵커·단언은 바꾸지 않는다)
  - (b) ATT/동의 다이얼로그가 flow 를 막음 → `.maestro/common/onboard.yaml` 에 `optional: true` 탭 (step 5 가 이미 넣었으면 확인만)
  - (c) 광고와 무관한 기존 결함 → 고치지 말고 summary 에 flow 이름·증상 기록
  - `maestro-debugger` 에이전트에 넘길 때 "`ad-banner` 가 요소 트리에 추가됐다" 를 프롬프트에 명시한다.
- `07-visual-a11y/screenshots.yaml` 산출물 `.maestro/.artifacts/*.png` 를 Read 로 열어 홈·비교·상세 하단 배너(또는 접힌 0 높이), 온보딩·설정·출처·개인정보의 배너 부재를 눈으로 확인한다. 스크린샷의 "Test Ad" 라벨은 정상.
- `06-settings/overview.yaml`, `08-sources-privacy/*` 는 **변경 없이** 통과해야 한다.
- 끝나면 Metro 종료.

### 6. 수동 동의 체크 — 사용자 수행 (이 step 은 확인만)

`docs/TESTING.md` §18.9 와 `.maestro/PLAN.md` §2 에 (1) iOS ATT 순서·허용/거부 배너 (2) `debugGeography: EEA` 로 GDPR 폼 + 설정 메뉴 (3) 오프라인 0 높이 체크리스트가 있는지 확인한다. 없으면 step 8 누락이므로 보완한다. **이 step 에서 수행하지 않는다.** summary 에 "수동 체크 3건은 사용자 수행 대기" 를 명시.

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm test
node -e "const a=require('./app.json').expo;if(a.version!=='1.1.0'||a.android.versionCode!==4||a.ios.buildNumber!=='1')process.exit(1)"
node -e "const e=require('./eas.json').build;if(e.development.env.EXPO_PUBLIC_ADS_TEST!=='1'||e.preview.env.EXPO_PUBLIC_ADS_TEST!=='1'||(e.production.env&&e.production.env.EXPO_PUBLIC_ADS_TEST))process.exit(1)"
test -f .env.example && grep -c 'EXPO_PUBLIC_ADS_TEST=1' .env.example    # 1
test -z "$(git check-ignore .env.example)"
npx expo config --type public > /dev/null                                # app.json 유효
npm run e2e:check
npm run e2e                                                              # 26 flow 통과 (Metro 전제)
```

## 검증 절차

1. 위 AC 를 실행한다. `npm run e2e` 결과의 통과/실패 수를 summary 에 적는다.
2. 아키텍처 체크리스트:
   - production 프로필에 `EXPO_PUBLIC_ADS_TEST` 가 **없는가**? (있으면 실 광고가 영원히 안 나간다)
   - 버전 1.1.0 이 RELEASE.md §1 의 정정된 규칙과 일치하는가?
   - 광고를 단언하는 flow 를 새로 만들지 않았는가?
   - 기존 flow 의 앵커·단언을 바꾸지 않고 스크롤만 조정했는가?
3. 결과에 따라 `phases/admob-banner-ads/index.json` 의 step 9 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 에 **flow 통과 수 / 조정한 flow / 광고 무관 기존 결함 / 수동 체크 3건 사용자 대기 / 운영자 후속(AdMob 콘솔 App ID·광고 단위 교체, app-ads.txt, 스토어 라벨)** 을 담는다
   - flow 실패가 광고 원인이고 3회 수정 후에도 실패 → `"status": "error"`, `"error_message"`
   - 시뮬레이터·dev build 부재 등 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- 광고 노출을 단언하는 Maestro flow 를 만들지 마라. 이유: 테스트 광고도 네트워크 의존이라 비결정적 (ADR-077, TESTING §18-A.1).
- production 프로필에 `EXPO_PUBLIC_ADS_TEST` 를 넣지 마라. 이유: 실 광고 단위가 영원히 쓰이지 않는다.
- `app.json` 의 샘플 App ID 나 `AD_UNIT_IDS` placeholder 를 지어낸 값으로 바꾸지 마라. 이유: 운영자가 AdMob 콘솔에서 받은 값만 유효하다 (RELEASE_CHECKLIST 로 강제).
- `.env` 를 만들거나 커밋하지 마라. 이유: `.gitignore` 대상. `.env.example` 만.
- 기존 flow 의 testID 앵커·assert 를 바꾸지 마라. 이유: 배너는 스크롤 거리만 바꾸며, 앵커 변경은 검증 대상을 바꾸는 것이다. 스크롤·swipe 조정만 허용.
- 광고와 무관한 기존 E2E 결함을 고치지 마라. 이유: 범위 밖. summary 에 기록해 사용자가 판단한다.
- 수동 동의 체크를 대신 수행했다고 보고하지 마라. 이유: 사용자 수행 결정. 시뮬레이터에서 ATT 를 관찰했다면 "관찰" 로만 기록한다.
- 버전을 2.0.0 으로 올리지 마라. 이유: 호환성 파괴가 아니며 RELEASE.md §1 이 step 7 에서 정정됐다.
