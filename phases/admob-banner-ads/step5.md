# Step 5: ads-bootstrap

## 배경

이 phase(`admob-banner-ads`)는 Google AdMob 하단 배너를 홈·비교·상세 3개 화면에 도입한다. 지금까지: step 1 `initializeAds()`, step 2 `useAdsStore` (`begin`/`settle`), step 3 `Screen.footer`, step 4 `AdBanner`.

**이 step 이 실제로 광고를 "켠다":** (H) 루트 레이아웃이 온보딩 완료 후 동의 흐름 + SDK 초기화를 1회 시작하고, (G) 홈·비교·상세의 **ready 상태 Screen 에만** `footer={<AdBanner />}` 를 배선한다. loading·error 상태 화면에는 배너가 없다 (AdMob 은 콘텐츠 없는 화면의 광고를 부정 트래픽 요인으로 본다).

확정된 동작: 첫 실행 흐름은 온보딩 → 도시 선택 → Compare 진입 **직후** 동의 흐름이 1회 실행된다. 온보딩 화면 위에서는 어떤 프롬프트도 뜨지 않는다 (`onboarded === true` 이후에만 시작). 한국 사용자는 iOS 에서 ATT 프롬프트만, EEA 사용자는 GDPR 폼을 추가로 본다.

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래를 반드시 직접 Read 할 것:

- `CLAUDE.md`
- `docs/plans/admob-banner-ads.md` §G, §H, §확정된 동작 변화, 인벤토리 9.46 행 + "기존 §" 화면 3개 행
- `docs/ARCHITECTURE.md` §부팅·hydration 순서 (226행 부근), §라우팅 디테일·§하단 탭 동작 정책
- `docs/adr/067-persona-removal.md` — 온보딩 = 도시 선택, 온보딩 → compare 직행 경쟁 조건 설명
- `app/_layout.tsx` — 수정 대상. 25행 `onboarded`, 52행 `bootReady`, 60~73행 온보딩 게이트 effect, 77~85행 `bridgeLastSyncFromMeta` effect (에러 처리 패턴)
- `app/__tests__/_layout.test.tsx` — 기존 16개 테스트의 mock 구성 (`@/store` mock, `waitForStoresOrTimeout`, `bridgeLastSyncFromMeta`)
- `app/(tabs)/index.tsx` 220행(loading)·234행(error)·256행(ready `<Screen scroll testID="home-screen">`)
- `app/compare/[cityId].tsx` 274행·288행·394행
- `app/detail/[cityId]/[category].tsx` 409행·423행·498행
- `app/(tabs)/__tests__/index.test.tsx`, `app/compare/__tests__/[cityId].test.tsx`, `app/detail/__tests__/[category].test.tsx` — 각 화면의 ready/loading/error 렌더 테스트 패턴
- `src/lib/ads.native.ts`, `src/store/ads.ts`, `src/components/AdBanner.native.tsx`, `src/components/Screen.tsx` — step 1~4 산출물
- `docs/TESTING.md` §9 의 `app/_layout.tsx` 인벤토리 절과 화면 3개 절 (`grep -n "_layout.tsx\|(tabs)/index.tsx\|compare/\[cityId\]\|\[category\].tsx" docs/TESTING.md`)

## 작업

### 1. `app/_layout.tsx` — 동의·초기화 트리거 (§H)

```ts
const beginAds = useAdsStore((s) => s.begin);
const settleAds = useAdsStore((s) => s.settle);

useEffect(() => {
  if (!bootReady || !onboarded) return;
  beginAds();
  initializeAds().then(settleAds);   // initializeAds 는 throw 하지 않는다 (결과 객체로 실패 전달)
}, [bootReady, onboarded, beginAds, settleAds]);
```

- `initializeAds` 는 `@/lib`, `useAdsStore` 는 `@/store` 에서 import.
- 온보딩 미완료면 시작하지 않는다 → 온보딩 화면 위 프롬프트 없음. 도시 선택 후 `setOnboarded(true)` 가 커밋되면 effect 가 돌고 Compare 화면 위에서 동의 폼/ATT 가 뜬다.
- `initializeAds` 가 멱등이므로 effect 재실행은 무해하다. `.then(settleAds)` 에 `.catch` 를 붙이지 않는다 — lib 이 reject 하지 않는 계약이며, 만약 reject 되면 unhandled rejection 으로 드러나야 한다 (삼키지 않음).
- `waitForStoresOrTimeout` 수정 없음 (ads store 는 hydration 미참여).
- 파일 상단·effect 위에 한 줄 주석: "광고 동의·초기화 — bootReady && onboarded 이후 1회, 비차단 (ADR-077)".

### 2. 화면 3개 — ready 상태 Screen 에만 footer (§G)

| 화면 | 파일·행 | 변경 |
| --- | --- | --- |
| 홈 | `app/(tabs)/index.tsx` 256행 `<Screen scroll testID="home-screen">` | `footer={<AdBanner />}` 추가. 220·234행 Screen 은 **변경 없음** |
| 비교 | `app/compare/[cityId].tsx` 394행 | 동일. 274·288행 변경 없음 |
| 상세 | `app/detail/[cityId]/[category].tsx` 498행 | 동일. 409·423행 변경 없음 |

- `AdBanner` 는 `@/components` 배럴에서 import (SDK 직접 import 금지 — ESLint 가 막는다).
- 홈은 Tabs 안이라 배너가 `BottomTabBar` 바로 위에 온다. 탭바와의 간격은 두지 않는다 (간격을 두면 콘텐츠 영역만 줄어든다). 시각 구분은 `AdBanner` 의 `border-t` 가 담당.
- 각 화면 파일 상단 doc comment 의 레이아웃 서술에 "하단 footer: AdBanner (ready 상태만, ADR-077)" 한 줄 추가.

### 3. 테스트

`app/__tests__/_layout.test.tsx` 에 추가 (§9.46). 기존 `@/store` mock 에 `useAdsStore` 를 추가하고 `@/lib` 의 `initializeAds` 를 mock:

- `bootReady && onboarded=true` → `begin` 1회 → `initializeAds` 1회 → resolve 후 `settle` 이 결과 객체로 1회 호출
- `onboarded=false` → `initializeAds` 0회 (온보딩 위 프롬프트 없음)
- `bootReady=false` 동안 0회
- `onboarded` 가 false → true 로 바뀌면 그때 1회 호출 (rerender)

화면 3개 테스트 파일에 추가 (기존 "기존 §" 절):

- ready 상태 렌더에 `ad-banner` **존재** — `useAdsStore.setState({ status: 'ready', canRequestAds: true })` 주입 후. `AdBanner` 를 mock 하지 말고 실제 컴포넌트 + 전역 SDK mock 으로 렌더한다 (접힌 상태여도 testID 는 있다).
- loading·error 상태 렌더에 `ad-banner` **부재**.
- `useAdsStore` 가 `idle` 이면 ready 화면에도 `ad-banner` 부재 (렌더 조건이 컴포넌트에 있음을 화면 레벨에서 재확인).

### 4. 문서

- `docs/TESTING.md`: `app/_layout.tsx` 절에 §9.46 항목, 화면 3개 절에 각각 배너 존재/부재 항목 (**누락 = step 미완**).
- `docs/ARCHITECTURE.md` §부팅·hydration 순서 다이어그램 끝에 한 단계 추가: `└─ bootReady && onboarded → AdsConsent.gatherConsent → mobileAds.initialize (비차단, useAdsStore — ADR-077)`.

### 5. 시뮬레이터 확인 (dev build — step 0 이 설치함)

```bash
npm run e2e:check                    # 부팅된 시뮬레이터 + dev build. 실패 시 xcrun simctl boot "iPhone 17 Pro" 후 재확인
npm run dev &                        # Metro (JS 변경은 Metro 리로드로 반영 — 네이티브 재빌드 불필요)
npm run e2e:smoke
maestro test .maestro/flows/01-onboarding
maestro test .maestro/flows/03-compare
```

- 온보딩 → 도시 선택 → Compare 에서 **ATT 시스템 다이얼로그가 뜨는지** 관찰한다. 샘플 App ID 상태에서는 AdMob 콘솔 IDFA 메시지가 없어 뜨지 않을 가능성이 크다. 뜨면 01/03 배치가 다이얼로그에 막혀 실패할 수 있다 — 그 경우 `.maestro/common/onboard.yaml` 의 `compare-screen` 단언 **직전**에 `- tapOn: { text: '허용|Allow|앱에 추적 금지 요청|Ask App Not to Track', optional: true }` 를 추가한다 (Maestro 의 `optional: true` 는 요소가 없으면 건너뛴다). 뜨지 않으면 flow 를 건드리지 않는다. 관찰 결과를 summary 에 반드시 적는다 (step 9 가 이 정보를 쓴다).
- 홈·비교·상세 하단에 "Test Ad" 배너가 보이는지, 온보딩·설정 화면에는 없는지 `.maestro/flows/07-visual-a11y/screenshots.yaml` 실행 후 `.maestro/.artifacts/*.png` 를 Read 로 열어 눈으로 확인한다. 배너가 안 보이면 **완료로 마감하지 말고** 원인을 찾는다 (store status, unitId, 네트워크). 시뮬레이터에서 테스트 광고가 `no fill` 로 실패하는 경우는 접힌 상태(0 높이)가 정상이므로 Metro 로그의 `[ads]` 에러 메시지로 판별한다.
- 끝나면 Metro 를 종료한다.

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm test
grep -c 'initializeAds' app/_layout.tsx                                          # ≥ 1
grep -c 'footer={<AdBanner />}' "app/(tabs)/index.tsx" "app/compare/[cityId].tsx" "app/detail/[cityId]/[category].tsx"   # 각 1
grep -c 'react-native-google-mobile-ads' app/_layout.tsx "app/(tabs)/index.tsx" "app/compare/[cityId].tsx" "app/detail/[cityId]/[category].tsx"   # 각 0
grep -c '9.46' docs/TESTING.md                                                   # ≥ 1
npm run e2e:smoke
```

## 검증 절차

1. 위 AC 를 실행한다 (Maestro 는 시뮬레이터·Metro 전제).
2. 아키텍처 체크리스트:
   - 온보딩 화면 위에서 동의 흐름이 시작되지 않는가? (`onboarded` 가드)
   - loading·error Screen 에 footer 가 없는가?
   - 화면·레이아웃이 SDK 를 직접 import 하지 않는가?
   - `.then(settleAds)` 에 `.catch(() => {})` 같은 삼킴이 없는가?
   - hydration 대기 목록을 건드리지 않았는가?
3. 결과에 따라 `phases/admob-banner-ads/index.json` 의 step 5 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 에 **ATT 다이얼로그 관찰 결과·onboard.yaml 수정 여부·배너 실표시 여부** 포함
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- loading·error 상태 Screen 에 footer 를 넣지 마라. 이유: AdMob 정책 — 콘텐츠 없는 화면의 광고는 무효 트래픽 요인.
- 온보딩·설정·출처·개인정보 화면에 `AdBanner` 를 넣지 마라. 이유: 사용자 확정 결정 (노출 화면 3개).
- `onboarded` 가드 없이 `initializeAds` 를 호출하지 마라. 이유: 온보딩 화면 위 프롬프트 금지 결정.
- `waitForStoresOrTimeout` / `hydration.ts` 를 수정하지 마라. 이유: ads store 는 비영속·비차단이다.
- `app/(tabs)/settings.tsx` 를 수정하지 마라. 이유: step 6 의 범위.
- `npx expo run:ios` 를 다시 돌리지 마라. 이유: 네이티브 변경이 없어 Metro 리로드로 충분하며 수 분이 낭비된다. dev build 가 없다면(`e2e:check` 실패) step 0 산출물이 사라진 것이므로 `blocked` 로 보고한다.
- ATT 다이얼로그가 실제로 관찰되지 않았는데 `onboard.yaml` 을 수정하지 마라. 이유: 추측 기반 변경 금지. 관찰 결과만 summary 에 남긴다.
- 기존 테스트를 깨뜨리지 마라.
