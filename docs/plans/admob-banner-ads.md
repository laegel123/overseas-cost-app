# 설계 문서: AdMob 배너 광고 도입 + 출처 표기 의무 보완

> **상태**: 구현 완료 (phase admob-banner-ads, ADR-077)
> **작성일**: 2026-09-16
> **실행 방식**: 다음 세션에서 하네스(`phases/`)로 phase 초기화 후 단계별 실행 예정. 본 문서는 코드를 건드리지 않았다.
> **관련 ADR**: 신규 **ADR-076** (출처 표기 의무 보완), 신규 **ADR-077** (광고 도입, ADR-011 supersede). 번호는 착수 시점에 `docs/ADR.md` 인덱스를 다시 확인한다 — 하네스 `run --once` 가 번호를 선점한 전례가 있다 (ADR-073).
> **선행 검토**: 2026-09-16 세션에서 21개 도시 데이터 출처·환율 API·광고 SDK 약관을 대조했다. 결론은 §Context.

이 문서는 다음 세션에서 하네스가 이어받을 수 있도록 저장소에 영속화한 설계 스펙이다. 실행자는 본 문서만으로 각 step 을 수행할 수 있어야 하므로, 파일 경로·문구·검증 명령을 구체적으로 적는다.

---

## Context (왜)

앱을 스토어에 배포하면서 광고를 넣어 운영비를 회수하려 한다. 데이터가 전부 공공 출처라 "광고 = 상업 이용" 이 약관에 걸리는지 검토했다.

### 검토 결론 1 — 공공 출처는 전부 상업 이용 허용

| 출처                                                                                                        | 상업 이용                    | 요구 사항                                             | 근거                                                                                                     |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| KOSIS · 공공데이터포털 (MOLIT·KCA)                                                                          | 허용                         | 출처 표시                                             | KOSIS 통계정보활용약관 제7·8조. 공공데이터법 제3조④ 는 기관이 영리 이용을 제한하지 못하게 한다           |
| open.er-api.com (환율 1차)                                                                                  | 허용. 캐시 허용, 재배포 금지 | `Rates By Exchange Rate API` 링크 **필수**            | exchangerate-api.com/docs/free                                                                           |
| TfL                                                                                                         | 허용                         | Unified API 데이터 사용 시 `Powered by TfL Open Data` | TfL Transport Data Service 약관                                                                          |
| StatCan Open Licence (CMHC 월세는 StatCan 표 34-10-0133-01 로 수신)                                         | 허용                         | `Adapted from Statistics Canada, <product>, <date>`   | statcan.gc.ca/en/reference/licence                                                                       |
| CMHC 자체 포털 약관                                                                                         | **상업 파생물 금지**         | —                                                     | 우리는 CMHC 포털이 아니라 StatCan WDS 로 받는다. 출처를 StatCan 표로 바꿔야 StatCan 라이선스 아래 놓인다 |
| e-Stat, ONS(OGL v3), Eurostat, Destatis(dl-de/by-2-0), INSEE(Licence Ouverte), CBS·ABS(CC BY 4.0), SingStat | 허용                         | 출처 표시                                             | 각 기관 오픈 라이선스                                                                                    |
| 미국 BLS·Census·HUD                                                                                         | 연방 저작물, 퍼블릭 도메인   | 없음                                                  | —                                                                                                        |
| 교통공사 운임 · 대학 학비 · 비자 수수료                                                                     | 사실 정보, 저작권 대상 아님  | 없음                                                  | —                                                                                                        |
| ECB (환율 3차 백업, GitHub Actions)                                                                         | 허용                         | 출처 표시                                             | ECB 는 재배포 허용. ER-API 값은 저장소에 쓰지 않으므로 "재배포 금지" 와 무관                             |

**광고 자체는 출처 약관과 충돌하지 않는다.** 단, 광고와 무관하게 이미 미충족인 표기 의무가 있고 (ER-API 링크 없음, TfL 출처명 부정확, CMHC 출처 URL 이 금지 약관 쪽을 가리킴), 상업 앱이 되면 이 결함의 무게가 커진다. 그래서 광고보다 **먼저** 고친다.

### 검토 결론 2 — 실제 작업은 광고 SDK 가 깨뜨리는 "개인정보 수집 0건" 전제

AdMob SDK 는 광고 식별자(IDFA/GAID)·IP 기반 대략적 위치·기기 정보·광고 상호작용·성능 진단 정보를 수집하고 Google 과 공유한다 (developers.google.com/admob/{ios,android}/data-disclosure). 현재 저장소는 다음 자리에서 "수집 안 함" 을 단언한다. 전부 갱신 대상이다.

| 위치                                                                                                                                                               | 현재 문구                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `src/lib/privacyPolicy.json` lead                                                                                                                                  | "본 앱은 사용자 개인정보를 수집하지 않습니다."                |
| `src/lib/privacyPolicy.json` 분석·추적                                                                                                                             | "어떠한 분석 도구·광고 식별자·추적 SDK 도 사용하지 않습니다." |
| `docs/adr/011-*.md`                                                                                                                                                | 분석·추적 SDK v1.0 도입 안 함 (Active)                        |
| `docs/RELEASE.md` §1 표, §5 (Privacy Label "Data Not Collected", ATT N/A, Data Safety 없음), §6 (5.1.1), §6.1 PIPA 표, §8 이용약관 1항 "광고·인앱 결제가 없습니다" |                                                               |
| `docs/RELEASE_CHECKLIST.md` 36행                                                                                                                                   | Data Safety 수집·공유 안 함                                   |
| `docs/store-metadata.md` §3 "개인정보, 수집하지 않습니다" 블록, §6 Data Safety 답안                                                                                |                                                               |
| `docs/ARCHITECTURE.md` §외부 의존성 정책                                                                                                                           | "분석/추적 → v1.0 도입 안 함"                                 |

---

## 사용자 확정 결정 (2026-09-16)

1. **광고 형식**: 배너만. 화면 하단 고정 anchored adaptive 배너 1종. 전면 광고는 범위 밖.
2. **노출 화면**: 홈·비교·상세 3개. 온보딩·설정·출처·개인정보 화면은 광고 없음.
3. **iOS ATT**: 띄운다. UMP SDK 가 AdMob 콘솔의 IDFA 설명 메시지 + 시스템 ATT 프롬프트를 처리.
4. **버전**: 1.1.0. `runtimeVersion.policy = appVersion` 이라 OTA 호환 키는 자동으로 갈린다. RELEASE.md §1 표의 "네이티브 의존성 변경 → v2.0.0" 문구는 호환성 파괴 한정으로 정정.
5. **광고 네트워크**: Google AdMob. Kakao AdFit 은 RN/Expo 공식 지원이 없어 기각.

---

## 확정된 동작 변화

- 첫 실행 흐름: 온보딩 → 도시 선택 → Compare 진입 **직후** 동의 흐름이 1회 실행된다. 한국 사용자는 iOS 에서 ATT 프롬프트(IDFA 설명 메시지 → 시스템 알림) 만 보고, EEA·영국·스위스 사용자는 GDPR 동의 폼을 추가로 본다. Android 한국 사용자는 아무 프롬프트도 보지 않는다.
- 온보딩 화면 위에서는 어떤 프롬프트도 뜨지 않는다 (동의 흐름은 `onboarded === true` 이후에만 시작).
- 홈·비교·상세의 ready 상태에서만 하단에 배너 슬롯이 있다. loading·error 상태 화면에는 없다 (AdMob 은 콘텐츠 없는 화면의 광고를 부정 트래픽 요인으로 본다).
- 배너는 광고가 실제로 로드된 뒤에만 높이를 차지한다. 로드 실패·오프라인·동의 미완료면 슬롯이 접혀 기존 레이아웃과 동일하다. 1회의 레이아웃 시프트는 수용한다.
- 설정 화면에 "광고 개인정보 설정" 메뉴가 **조건부**로 생긴다. UMP 가 `privacyOptionsRequirementStatus === REQUIRED` 를 돌려주는 사용자(EEA 등)에게만 보인다. 한국 사용자에게는 보이지 않으므로 기존 E2E 단언은 유지된다. 이 항목은 요청되지 않은 기능이 아니라 TCF 의 동의 철회 진입점 의무다.
- 출처 화면 `/sources` 하단에 환율 출처 링크 `Rates By Exchange Rate API` 가 생긴다.
- 런던 교통 출처명, 캐나다 3개 도시 월세 출처명·URL 이 바뀐다 (사용자 화면 `/sources/[cityId]` 에 노출).
- 개발·프리뷰 빌드는 Google 공식 테스트 App ID·테스트 광고 단위만 쓴다. 프로덕션 빌드는 실제 ID 가 없으면 **명시적 에러**로 광고를 끄고 로그를 남긴다 (silent fail 금지).

---

## 검증 결과 (착수 전 확인한 리스크)

- **라이브러리 호환**: `react-native-google-mobile-ads` 최신 16.5.0 (2026-08-18), peer `expo >= 47`. Expo SDK 54 / RN 0.81 에서 config plugin 이 깨진다는 이슈 #820·#835 가 있었으나 둘 다 closed (하나는 `npx expo install --fix` 로 해소, 하나는 stale close). **재현 여부를 step 0 스파이크에서 반드시 확인**한다. 실패 시 16.x 하위 버전 고정 후 ADR 에 사유 기록.
- **Expo Go 불가**: 네이티브 모듈이라 개발도 EAS development build 로만 가능. 이미 `eas.json` 에 `development` 프로필이 있다.
- **정적 프레임워크**: `expo-build-properties` 의 `ios.useFrameworks: "static"` 은 invertase 문서상 "필요 시 권장" (react-native-firebase 조합 등). 우리는 firebase 가 없으므로 기본은 **넣지 않고**, 스파이크에서 iOS 빌드가 실패할 때만 추가한다.
- **웹 번들**: `react-native-web` 이 deps 에 있고 `app.json` 에 `web.bundler` 가 있다. 광고 모듈은 웹을 지원하지 않으므로 `.native.ts` / `.web.ts` 플랫폼 분기 파일로 격리한다 (§C·§E). jest-expo 는 iOS 플랫폼으로 `.native` 를 해석한다 — 스파이크에서 확인.
- **E2E**: 28개 Maestro flow 중 광고를 단언하는 것은 없어야 한다. `03-compare`·`05-detail`·`02-home` 은 하단 배너 때문에 스크롤 거리가 달라질 수 있다 → 전체 재실행이 필요하다 (§Maestro).
- **TfL 실태**: `uk_tfl.mjs` 는 Unified API 를 **운행 상태 연결 확인**에만 쓰고 운임값은 `STATIC_TRANSPORT` 정적 상수다. 따라서 "Powered by TfL Open Data" 표기 의무는 애초에 발생하지 않으며, 현재 출처명 `TfL Unified API + static estimates` 가 **사실과 다른 것**이 문제다. 정정 방향은 "API 표기 삭제 + 정적 추정치 명시".
- **CMHC 실태**: `ca_cmhc.mjs` 는 StatCan WDS 벡터 API 로 받으면서 출처 URL 은 CMHC 포털을 가리킨다. StatCan 표 34-10-0133-01 페이지에는 별도 재사용 제한 문구가 없고 StatCan 인용 형식만 안내한다.
- **`docs/DATA.md` §3.1 표에 SUUMO 가 남아 있다.** 스크립트 어디에도 사용처가 없다 (grep 0건). ADR-032 가 금지하는 상업 플랫폼이므로 문서 잔재를 지운다.
- **PRD**: 광고·수익화 언급 없음. PRD 수정 불필요.

---

## 구현

### A. 출처 표기 의무 보완 (광고와 독립, 먼저 처리)

#### A-1. `scripts/refresh/uk_tfl.mjs` — 출처명 정정

```js
export const SOURCE = {
  category: 'transport',
  name: 'TfL 운임 안내 페이지 (정적 추정치)',
  url: 'https://tfl.gov.uk/fares/',
  legacyNames: ['TfL Unified API + static estimates'],
};
```

- ADR-070 규칙: 기관 고유명(TfL) 원어, 서술형은 한국어, 정적 추정치 마커 유지 (AUTOMATION.md §8).
- `legacyNames` 를 선언해야 `hasLegacySourceName()` 이 값 변동 없는 정적 출처에서도 1회 쓰기를 일으킨다 (`_common.mjs` 189~205행).
- `checkTflApiStatus()` 는 그대로 둔다 (연결 확인용, 데이터 출처 아님).

#### A-2. `scripts/refresh/ca_cmhc.mjs` — 출처를 StatCan 표로 전환

```js
export const SOURCE = {
  category: 'rent',
  name: 'Adapted from Statistics Canada, Table 34-10-0133-01 (CMHC 평균 월세 · share 는 studio×0.65 추정)',
  url: 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410013301',
  legacyNames: ['CMHC Rental Market Survey via StatCan WDS (share=studio×0.65 estimated, ADR-059)'],
};
```

- StatCan Open Licence 가 요구하는 `Adapted from Statistics Canada, <product>` 문구를 출처명에 그대로 담는다. reference date 는 화면의 `접속일 YYYY-MM-DD` 가 대신한다.
- 내부 ADR 번호(`ADR-059`)가 사용자 화면에서 사라진다. 나머지 3종(HUD·StatCan CPI·BLS)의 ADR 번호 노출은 별도 부채로 남긴다 (§범위 밖).

#### A-3. 데이터 재생성 (ADR-032 — JSON 직접 편집 금지)

```bash
node scripts/refresh/_run.mjs uk_tfl --useStatic
node scripts/refresh/_run.mjs ca_cmhc          # StatCan WDS 호출, API 키 불필요
node scripts/build_data.mjs                      # data/all.json + data/seed/all.json
node scripts/validate_cities.mjs
```

- `ca_cmhc` 는 네트워크가 필요하다. 실패하면 `--useStatic` 이 있는지 확인하고, 없으면 해당 step 을 `blocked` 로 두고 GitHub Actions `refresh-rent.yml` 수동 실행으로 대체한다.
- 검증: `data/cities/{london,vancouver,toronto,montreal}.json` 의 `sources` 에 구 이름이 없고 새 이름이 1개씩만 있다. `src/__fixtures__/seed-roundtrip.test.ts` 통과.

#### A-4. `app/sources/index.tsx` — 환율 출처 링크

- 도시 목록 카드 아래에 푸터 블록을 추가한다. `app/sources/[cityId].tsx` 의 `source-city-footer` 와 같은 시각 규격 (`mt-6 pt-4 border-t border-dashed border-line gap-1`).
- 내용: `Tiny` "환율은 아래 서비스의 무료 API 로 매일 갱신됩니다." + `Pressable` 링크 텍스트 **`Rates By Exchange Rate API`** (원문 그대로, 번역 금지 — 약관이 요구하는 표기). `Small color="orange" font-manrope-bold` 로 `페이지 열기 →` 와 같은 링크 스타일. `accessibilityRole="link"`, `accessibilityLabel="Exchange Rate API 페이지 열기"`, `testID="fx-attribution-link"`.
- URL: `https://www.exchangerate-api.com`.
- 외부 열기는 이 화면에 없는 `safeOpenURL` 을 `app/sources/[cityId].tsx` 54~65행과 **동일 패턴으로 복제**한다 (settings·privacy·sources/[cityId] 세 곳이 이미 각자 정의. 공용 util 추출은 무관한 리팩토링이라 하지 않는다).
- 환율 데이터가 없어도(빈 상태) 링크는 항상 표시한다. 환율 fallback(baseline) 만 쓰는 상황에도 1차 소스는 ER-API 이므로 표기가 틀리지 않는다.

#### A-5. 문서

- `docs/DATA.md` §3.1 표: `| 일본 | SUUMO, e-Stat | ...` → `| 일본 | e-Stat | 통계 |`. §3.3 표에 행 추가: `| 출처 화면 /sources 푸터 | Rates By Exchange Rate API 링크 | exchangerate-api.com — 무료 endpoint 약관의 필수 표기 |`. §9 에 "출처별 라이선스 요약" 소절 추가 (위 Context 표 요약본).
- `docs/DATA_SOURCES.md` 런던 교통 절·캐나다 3개 도시 임차료 절의 출처명·URL 을 A-1·A-2 와 일치시킨다.
- `docs/adr/076-source-attribution-compliance.md` + `docs/ADR.md` 행. 내용: ER-API 링크 의무, TfL 출처명 정정 사유(API 미사용), CMHC → StatCan 전환 사유(CMHC 포털 약관의 상업 파생물 금지 vs StatCan Open Licence), SUUMO 잔재 제거.

### B. 의존성·네이티브 설정

#### B-1. 패키지

```bash
npx expo install react-native-google-mobile-ads   # 16.x, Expo 가 호환 버전을 고른다
```

- `--legacy-peer-deps` 가 필요하면 ADR-044 와 같은 이유이므로 그대로 사용.
- `expo-build-properties` 는 스파이크에서 iOS 빌드가 실패할 때만 추가 (§검증 결과).

#### B-2. `app.json`

```jsonc
"version": "1.1.0",
"ios": { "supportsTablet": false, "bundleIdentifier": "com.laegel.overseascostapp", "buildNumber": "1" },
"android": { "package": "com.laegel.overseascostapp", "versionCode": 4, ... },
"plugins": [
  "expo-router",
  "expo-asset",
  [
    "react-native-google-mobile-ads",
    {
      "androidAppId": "ca-app-pub-3940256099942544~3347511713",
      "iosAppId": "ca-app-pub-3940256099942544~1458002511",
      "userTrackingUsageDescription": "광고 식별자를 이용해 관련성 높은 광고를 표시하고 광고 성과를 측정하기 위해 사용됩니다.",
      "skAdNetworkItems": [ "cstr6suwn9.skadnetwork", "..." ]
    }
  ]
]
```

- 위 App ID 두 개는 **Google 공식 샘플 App ID** 다. 스파이크·개발 빌드는 이 값으로 부팅한다. 운영자가 AdMob 콘솔에서 실제 App ID 를 받으면 교체한다 (§운영자 작업). App ID 는 비밀이 아니다 (바이너리에 그대로 들어간다) — 커밋해도 된다.
- `skAdNetworkItems` 는 invertase 문서의 목록(약 52개)을 그대로 복사한다. 착수 시점의 최신 목록을 문서에서 다시 가져온다.
- `userTrackingUsageDescription` 문구는 위 한국어 문장을 정본으로 한다. Apple 은 목적을 설명하는 문장을 요구한다.
- `ios.buildNumber` 는 현재 없다 (`appVersionSource: local`). 새 바이너리 제출 시 필요하므로 `"1"` 로 시작한다.

#### B-3. `eas.json` — 테스트 광고 스위치

```jsonc
"build": {
  "development": { ..., "env": { "EXPO_PUBLIC_ADS_TEST": "1" } },
  "preview":     { ..., "env": { "EXPO_PUBLIC_ADS_TEST": "1" } },
  "production":  { ... }                           // 변수 없음 → 실제 광고 단위
}
```

- `EXPO_PUBLIC_*` 는 빌드 시 인라인된다. 프리뷰 빌드를 지인에게 배포해도 테스트 광고만 나가므로 무효 트래픽 위험이 없다.
- 로컬 `npm run dev` 는 `.env` 가 없으면 변수가 비므로, `.env.example` 을 새로 만들어 `EXPO_PUBLIC_ADS_TEST=1` 을 두고 README 에 한 줄 안내한다 (현재 저장소에 `.env.example` 없음) (변수 없음 + `__DEV__` 이면 테스트 ID 로 강제 — §C-1).

### C. `src/lib/ads.native.ts` / `src/lib/ads.web.ts` — 광고 SDK 경유 단일 지점

CLAUDE.md 의 "외부 데이터는 lib 경유" 규칙을 광고 SDK 에도 적용한다. 컴포넌트·화면은 `react-native-google-mobile-ads` 를 직접 import 하지 않는다 (ESLint `no-restricted-imports` 로 강제, §J).

#### C-1. 설정

```ts
export type AdsMode = 'test' | 'production';

export const AD_UNIT_IDS = {
  ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY', // 운영자가 교체
  android: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY', // 운영자가 교체
} as const;

export function resolveAdsMode(env = process.env.EXPO_PUBLIC_ADS_TEST, dev = __DEV__): AdsMode;
// env === '1' || dev → 'test', 아니면 'production'

export function resolveBannerUnitId(mode: AdsMode, platform: 'ios' | 'android'): string;
// 'test' → TestIds.ADAPTIVE_BANNER
// 'production' → AD_UNIT_IDS[platform]; 값이 placeholder 패턴(/X{16}\/Y{10}/) 이면 AdsConfigError throw
```

- `AdsConfigError` 는 `src/lib/errors.ts` 에 추가 (기존 에러 타입 카탈로그와 같은 형식, ARCHITECTURE.md §에러 타입 카탈로그에 행 추가).

#### C-2. 초기화 (동의 → SDK)

```ts
export type AdsStatus = 'idle' | 'initializing' | 'ready' | 'disabled';

export type AdsInitResult = {
  status: 'ready' | 'disabled';
  canRequestAds: boolean;
  privacyOptionsRequired: boolean; // 설정 메뉴 노출 조건
  error: Error | null; // disabled 사유 (AdsConfigError | 동의·초기화 실패)
};

export function initializeAds(): Promise<AdsInitResult>;
```

순서 (invertase 문서 권장 순서 그대로):

1. `resolveBannerUnitId()` 로 설정 검증. `AdsConfigError` 면 SDK 를 건드리지 않고 `{ status: 'disabled', error }` 반환.
2. `AdsConsent.gatherConsent()` — 필요한 지역에서만 폼이 뜬다. iOS 는 AdMob 콘솔에 IDFA 메시지를 게시해 두면 여기서 ATT 까지 처리된다. 실패해도 **중단하지 않고** 다음 단계로 간다 (문서: 이전 세션 동의로 진행). 에러는 결과의 `error` 에 담는다.
3. `mobileAds().initialize()`.
4. `AdsConsent.getConsentInfo()` → `canRequestAds`, `privacyOptionsRequirementStatus === 'REQUIRED'`.
5. 모듈 레벨 inflight promise 로 **멱등** (`currency.ts` 의 in-flight dedup 패턴). 테스트용 `__resetForTesting()`.

- 비맞춤형 강제 플래그(`requestNonPersonalizedAdsOnly`)는 쓰지 않는다. UMP 가 저장한 TCF 동의를 SDK 가 직접 읽는다.
- `showPrivacyOptionsForm(): Promise<void>` — 설정 메뉴에서 호출 (`AdsConsent.showPrivacyOptionsForm()` 위임).
- 에러 정책: 광고는 앱 핵심 기능이 아니므로 ErrorView 를 띄우지 않는다. 대신 (a) 결과 객체에 에러를 **반드시** 담고, (b) 스토어 상태를 `disabled` 로 두고, (c) `__DEV__` 에서 `console.error('[ads] ...')` — `app/_layout.tsx` 의 `bridgeLastSyncFromMeta` 실패 처리와 동일 패턴. 삼키는 것이 아니라 상태로 노출하는 것임을 ADR-077 에 명시한다.

#### C-3. `ads.web.ts`

`initializeAds` 는 `{ status: 'disabled', canRequestAds: false, privacyOptionsRequired: false, error: null }` 을 즉시 반환. `showPrivacyOptionsForm` 은 no-op. 네이티브 모듈을 import 하지 않는다.

#### C-4. `src/lib/index.ts`

`initializeAds`, `showPrivacyOptionsForm`, `resolveAdsMode`, `resolveBannerUnitId`, 타입 export. (`ads.ts` 가 아니라 `ads` 를 import — Metro·jest 가 플랫폼 확장자를 고른다.)

### D. `src/store/ads.ts` — 비영속 상태

```ts
export type AdsState = {
  status: AdsStatus;             // 'idle' | 'initializing' | 'ready' | 'disabled'
  canRequestAds: boolean;
  privacyOptionsRequired: boolean;
};
actions: { begin(), settle(result: AdsInitResult), reset() }
```

- `persist` 없음 (동의 상태는 UMP SDK 가 자체 저장). 기존 8개 store 와 달리 hydration 대기 목록(`waitForStoresOrTimeout`)에 **넣지 않는다**.
- `src/store/index.ts` export 추가.

### E. `src/components/AdBanner.native.tsx` / `AdBanner.web.tsx`

```tsx
export type AdBannerProps = { testID?: string };
```

- 렌더 조건: `useAdsStore(s => s.status === 'ready' && s.canRequestAds)`. 아니면 `null`.
- 로컬 state `loaded: boolean`. `onAdLoaded` → true, `onAdFailedToLoad(err)` → false + `__DEV__` console.error. `loaded === false` 여도 `BannerAd` 는 마운트 유지(재시도는 SDK 가 함) 하되 컨테이너를 `h-0 overflow-hidden` 으로 접는다 → 로드 전·실패 시 레이아웃 불변.
- 로드 후 컨테이너: `bg-white border-t border-line items-center`. 높이는 SDK 가 기기 폭에 맞춰 계산한다 — 코드에 px 를 쓰지 않으므로 매직 넘버 규칙과 충돌하지 않는다 (ADR-077 에 명시).
- `size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}`, `unitId={resolveBannerUnitId(resolveAdsMode(), Platform.OS)}`. `Platform.OS` 가 ios/android 외면 `null`.
- 접근성: 컨테이너 `accessibilityLabel="광고"`, `accessibilityRole="none"` (SDK 뷰가 자체 라벨을 가짐). `testID` 기본값 `ad-banner`, 접힌 상태도 같은 testID (E2E 가 존재만 확인 가능).
- `AdBanner.web.tsx` 는 항상 `null`.
- `src/components/index.ts` export 추가.

### F. `src/components/Screen.tsx` — `footer` 슬롯

```ts
/** ScrollView 밖, SafeArea 안에 고정 렌더되는 하단 요소 (광고 배너 등). 기본 없음 */
footer?: React.ReactNode;
```

- `scroll` 여부와 무관하게 `SafeAreaView` 의 마지막 자식으로 `{footer}` 를 렌더. horizontal padding 은 적용하지 않는다 (배너는 폭 전체 사용).
- 기존 호출부는 변경 없음 (optional prop). `Screen.test.tsx` 에 footer 렌더 위치 테스트 추가.

### G. 화면 통합 — 홈·비교·상세

| 화면 | 파일                                                                                | 변경                                                                          |
| ---- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 홈   | `app/(tabs)/index.tsx` 256행 `<Screen scroll testID="home-screen">`                 | `footer={<AdBanner />}` 추가. loading(220행)·error(234행) Screen 은 변경 없음 |
| 비교 | `app/compare/[cityId].tsx` 394행 `<Screen scroll testID="compare-screen">`          | 동일. 274·288행은 변경 없음                                                   |
| 상세 | `app/detail/[cityId]/[category].tsx` 498행 `<Screen scroll testID="detail-screen">` | 동일. 409·423행은 변경 없음                                                   |

- 홈은 Tabs 안이라 배너가 `BottomTabBar` 바로 위에 온다. AdMob 은 메뉴 바 인접 배너를 "권장하지 않음" 으로 분류하므로 배너 상단 `border-t border-line` 으로 시각 구분을 두고, 탭바와의 간격은 두지 않는다 (간격을 두면 콘텐츠 영역만 줄어든다). 실측 오클릭 문제가 생기면 홈만 제외하는 것을 1차 대응으로 한다.
- 비교·상세는 루트 Stack 화면이라 탭바가 없다. 배너가 홈 인디케이터 위 SafeArea 안에 온다.

### H. `app/_layout.tsx` — 동의·초기화 트리거

```ts
const onboarded = useOnboardingStore((s) => s.onboarded); // 이미 있음
const beginAds = useAdsStore((s) => s.begin);
const settleAds = useAdsStore((s) => s.settle);

useEffect(() => {
  if (!bootReady || !onboarded) return;
  beginAds();
  initializeAds().then(settleAds); // initializeAds 는 throw 하지 않는다 (결과 객체로 실패 전달)
}, [bootReady, onboarded, beginAds, settleAds]);
```

- 온보딩 미완료면 시작하지 않는다 → 온보딩 화면 위 프롬프트 없음. 도시 선택 후 `setOnboarded(true)` 가 커밋되면 effect 가 돌고, Compare 화면 위에서 동의 폼/ATT 가 뜬다.
- `initializeAds` 가 멱등이므로 effect 재실행은 무해하다.
- `useAdsStore` 는 hydration 대기 목록에 없으므로 `waitForStoresOrTimeout` 수정 없음.

### I. 설정 화면 — 광고 개인정보 설정 (조건부)

`app/(tabs)/settings.tsx` 메뉴 그룹에서 "개인정보 처리방침" 다음, "앱 정보" 앞에:

```tsx
{
  privacyOptionsRequired && (
    <MenuRow
      icon="shield"
      label="광고 개인정보 설정"
      onPress={handleAdsPrivacy}
      testID="menu-ads-privacy"
    />
  );
}
```

- `privacyOptionsRequired = useAdsStore(s => s.privacyOptionsRequired)`. 한국 사용자는 false → 렌더 안 됨 → `06-settings/overview.yaml` 단언 무변경.
- `handleAdsPrivacy` → `showPrivacyOptionsForm()`. 실패 시 `Alert.alert('알림', '광고 설정 화면을 열지 못했어요. 잠시 후 다시 시도해 주세요.')` (탭 redirect 안내와 같은 Alert 패턴, 토스트 미구현).
- 아이콘: 기존 `ICON_NAMES` 의 `shield` 를 사용한다. 새 SVG 를 추가하지 않는다.
- "앱 정보" 행의 `isLast` 는 그대로 (조건부 행이 중간에 끼므로 마지막 행 판정에 영향 없음).

### J. 강제 규칙 — ESLint

`.eslintrc.js` 의 `no-restricted-imports` (현재 미사용 규칙, 신규 추가) 에 `react-native-google-mobile-ads` 를 추가하고 `src/lib/ads.native.ts`·`src/components/AdBanner.native.tsx`·`jest.setup.js` 만 override 로 허용. CLAUDE.md CRITICAL 규칙(아래 §문서)의 기계적 강제.

### K. 개인정보 처리방침 개정 — `src/lib/privacyPolicy.json` (정본, ADR-072)

`npm run gen:privacy` 로 `docs/privacy-policy.html`·`docs/PRIVACY.md` 를 재생성한다. 직접 편집 금지 (드리프트 테스트).

- `updatedAt`: 착수일.
- `lead`: `"본 앱은 회원가입 없이 사용하며, 광고 표시를 위해 광고 SDK 가 수집하는 정보 외에는 개인정보를 수집하지 않습니다."`
- **수집·저장 정보** 첫 항목: `"본 앱 자체는 사용자 정보를 외부 서버로 전송하거나 수집하지 않습니다. 광고 표시 과정에서 수집되는 정보는 아래 '광고' 항목을 참고하세요."` (나머지 3개 항목 유지)
- **외부 서비스** 유지 (환율·GitHub 2개 항목).
- **신규 섹션 `광고`** (외부 서비스 다음):
  - `"본 앱은 Google AdMob 을 통해 배너 광고를 표시합니다. 광고 SDK 는 광고 게재·성과 측정·부정 클릭 방지를 위해 아래 정보를 수집하여 Google 에 전송합니다."`
  - `"수집 항목: 광고 식별자(iOS IDFA·Android 광고 ID), IP 주소와 이로부터 추정한 대략적 위치, 기기·OS 정보, 광고 노출·클릭 등 상호작용 정보, 앱 성능 진단 정보"`
  - `"이전받는 자·국가: Google LLC (미국). 이전 방법·시기: 광고 요청 시 네트워크로 전송. 보유 기간: Google 개인정보처리방침(https://policies.google.com/privacy)에 따름"`
  - `"iOS 에서는 첫 사용 시 앱 추적 허용 여부를 묻습니다. 거부해도 앱은 동일하게 동작하며 비맞춤형 광고가 표시됩니다. 설정 > 개인정보 보호 및 보안 > 추적 에서 언제든 변경할 수 있습니다."`
  - `"Android 에서는 설정 > Google > 광고 에서 광고 ID 재설정 또는 맞춤 광고 삭제를 선택할 수 있습니다."`
  - `"유럽경제지역(EEA)·영국·스위스 사용자에게는 광고 개인정보 동의 화면이 표시되며, 앱 설정 > 광고 개인정보 설정 에서 선택을 변경할 수 있습니다."`
- **분석·추적**: `"본 앱은 분석 도구·오류 추적 SDK 를 사용하지 않습니다. 광고 게재를 위한 Google AdMob SDK 가 위 '광고' 항목의 정보를 수집하는 것이 유일한 예외입니다."`
- **개인정보 보호책임자**: 유지. 항목 추가 `"개인정보 처리 위탁·국외 이전: 광고 게재 목적으로 Google LLC 에 위 '광고' 항목의 정보가 이전됩니다."`
- 나머지 섹션 유지.
- `src/lib/__tests__/privacyPolicy.test.ts` 의 불변조건(섹션 수·제목 목록 등)이 있으면 함께 갱신.

### L. 문서

| 문서                                   | 변경                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `docs/adr/077-admob-banner-ads.md`     | 결정: AdMob 배너, 노출 화면 3개, UMP+ATT, lib 경유 단일 지점, 테스트/프로덕션 스위치, 에러 정책(상태 노출·ErrorView 없음), 배너 높이 SDK 계산 예외, 웹 no-op. **Supersedes ADR-011**. 대안 기각: Kakao AdFit(RN 미지원), 전면 광고(정책·UX), 분석 SDK 동시 도입(범위)                                                                                                                                                                                                                                                                                                                                                                       |
| `docs/adr/011-no-analytics.md`         | 상태 줄 `Superseded by ADR-077` (오류 추적 SDK 미도입 부분은 여전히 유효함을 한 줄로)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `docs/ADR.md`                          | 076·077 행 추가, 011 행 상태 변경                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `CLAUDE.md`                            | CRITICAL 추가: "광고 SDK 는 `src/lib/ads` 와 `AdBanner` 만 import 한다. 광고는 홈·비교·상세 ready 상태의 `Screen footer` 에만 둔다. 온보딩·설정·출처·개인정보 화면에 광고 금지. 개발·프리뷰 빌드는 `EXPO_PUBLIC_ADS_TEST=1`. 개인정보 처리방침의 '광고' 섹션과 수집 항목이 SDK 실태와 어긋나면 안 된다 (ADR-077)". 기술 스택에 "광고: Google AdMob (react-native-google-mobile-ads)"                                                                                                                                                                                                                                                        |
| `docs/ARCHITECTURE.md`                 | §외부 의존성 정책 "분석/추적 → v1.0 도입 안 함" → "분석·오류추적 → 미도입 / 광고 → AdMob, ADR-077". §부팅·hydration 순서에 "bootReady && onboarded → 동의 → SDK 초기화 (비차단)" 단계 추가. §에러 타입 카탈로그에 `AdsConfigError`                                                                                                                                                                                                                                                                                                                                                                                                          |
| `docs/RELEASE.md`                      | §1 표 3행 문구 정정 + "네이티브 의존성 추가 = 새 바이너리, 버전은 변경 성격에 따름" / §5 iOS: Privacy Label = Identifiers(Device ID)·Usage Data(Advertising Data, Product Interaction)·Diagnostics(Crash·Performance)·Location(Coarse) — 추적 용도 표시, ATT = 사용 / Android: Data Safety = 기기 ID·앱 상호작용·앱 성능·대략적 위치 수집, Google 과 공유, 광고·분석·부정방지 목적 / §6 5.1.1 항목 갱신 / §6.1 PIPA 표 — 수집 동의(ATT·UMP 로 대체), 국외이전 고지(처리방침 광고 섹션), 처리 위탁(Google) / §8 이용약관 1항 `"본 앱은 무료로 제공되며 광고가 표시됩니다. 인앱 결제는 없습니다."` / §13.5 에 AdMob 정책 위반 알림 대응 한 줄 |
| `docs/RELEASE_CHECKLIST.md`            | 36행 Data Safety 답안 교체, ATT·app-ads.txt 항목 추가                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `docs/store-metadata.md`               | §3 "개인정보, 수집하지 않습니다" 블록 → "개인정보는 광고 표시에 필요한 최소한만" 으로 재작성 (4개 불릿 수정), §6 Data Safety 답안 표 교체                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `docs/UI_GUIDE.md`                     | 편차표 행 추가: `광고 배너                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 디자인 원본 없음 | 홈·비교·상세 하단 anchored adaptive 배너, 로드 전 0 높이 (ADR-077) | AdBanner.native.tsx`. §UI 텍스트 한국어 표준에 "광고 개인정보 설정"·Alert 문구·`/sources` 푸터 문구 추가 |
| `docs/TESTING.md`                      | §5 모킹 전략에 `react-native-google-mobile-ads` mock 항목. §9.42~9.46 인벤토리 (아래 §테스트). §18-A 에 "광고는 E2E 단언 대상 아님 + 동의 폼 수동 체크" 규칙. §18 수동 e2e 에 동의 흐름 체크리스트                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `docs/DATA.md`, `docs/DATA_SOURCES.md` | §A-5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `README.md`                            | 개발 빌드 안내: Expo Go 불가 → `eas build --profile development`, `.env.example`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `.maestro/PLAN.md`                     | §1 배치별 리스크에 배너로 인한 스크롤 거리 변화 기록                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

---

## 테스트 (신규 모듈은 같은 step 에 작성 — CLAUDE.md 개발 프로세스)

### 모킹 — `jest.setup.js`

```js
jest.mock('react-native-google-mobile-ads', () => ({
  __esModule: true,
  default: () => ({ initialize: jest.fn(async () => []) }),
  AdsConsent: {
    gatherConsent: jest.fn(async () => ({ status: 'NOT_REQUIRED', canRequestAds: true })),
    getConsentInfo: jest.fn(async () => ({
      canRequestAds: true,
      privacyOptionsRequirementStatus: 'NOT_REQUIRED',
    })),
    showPrivacyOptionsForm: jest.fn(async () => undefined),
    reset: jest.fn(),
  },
  BannerAd: (props) => null, // 테스트가 props 를 검사할 수 있게 jest.fn 래핑 — NativeWind 제약으로 JSX 미사용
  BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER' },
  TestIds: { ADAPTIVE_BANNER: 'ca-app-pub-3940256099942544/2435281174' },
}));
```

- `BannerAd` mock 은 `jest.fn()` 으로 두고 테스트에서 `mock.calls[0][0].onAdLoaded()` 를 직접 호출해 로드/실패를 시뮬레이션한다.

### 인벤토리 (TESTING.md §9 에 추가)

| §      | 모듈                                                                     | 케이스                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9.42   | `src/lib/ads.native.ts`                                                  | `resolveAdsMode`: env '1' → test, `__DEV__` → test, 둘 다 아님 → production / `resolveBannerUnitId`: test → TestIds, production+placeholder → `AdsConfigError`, production+실제 형식 → 그대로 / `initializeAds`: 순서(gatherConsent → initialize → getConsentInfo), gatherConsent reject 여도 initialize 호출 + error 담김, `AdsConfigError` 면 SDK 미호출 + disabled, 동시 호출 1회만 실행(멱등), `__resetForTesting` 후 재실행 / `showPrivacyOptionsForm` 위임 / 커버리지 `src/lib/**` 100% 유지 |
| 9.42-w | `src/lib/ads.web.ts`                                                     | disabled 즉시 반환, 네이티브 모듈 미참조 (`jest.isolateModules` + `Platform.OS='web'`)                                                                                                                                                                                                                                                                                                                                                                                                             |
| 9.43   | `src/store/ads.ts`                                                       | 초기 상태, `begin` → initializing, `settle(ready)`·`settle(disabled)`, `reset`, persist 미사용(AsyncStorage mock 호출 0회)                                                                                                                                                                                                                                                                                                                                                                         |
| 9.44   | `src/components/AdBanner.native.tsx`                                     | status≠ready → null / ready+canRequestAds=false → null / ready → BannerAd 마운트 + `unitId`·`size` prop 검증 / 로드 전 컨테이너 접힘(`h-0`) → `onAdLoaded` 후 펼침 / `onAdFailedToLoad` → 접힘 + `__DEV__` console.error 1회 / a11y label "광고" / testID 기본값                                                                                                                                                                                                                                   |
| 9.45   | `src/components/Screen.tsx` (기존 §에 추가)                              | `footer` 가 ScrollView 형제로 SafeAreaView 안 마지막에 렌더, `scroll=false` 도 동일, 미지정 시 DOM 변화 없음                                                                                                                                                                                                                                                                                                                                                                                       |
| 9.46   | `app/_layout.tsx` (기존 §에 추가)                                        | `bootReady && onboarded` 일 때만 `initializeAds` 호출, onboarded=false 면 미호출, settle 로 store 갱신                                                                                                                                                                                                                                                                                                                                                                                             |
| 기존 § | `app/(tabs)/index.tsx`, `compare/[cityId]`, `detail/[cityId]/[category]` | ready 상태 Screen 에 `ad-banner` testID 존재, loading·error 상태에 부재                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 기존 § | `app/(tabs)/settings.tsx`                                                | `privacyOptionsRequired=false` → `menu-ads-privacy` 부재, true → 존재 + 탭 시 `showPrivacyOptionsForm` 호출, reject 시 Alert                                                                                                                                                                                                                                                                                                                                                                       |
| 기존 § | `app/sources/index.tsx`                                                  | `fx-attribution-link` 존재 + 탭 시 `Linking.openURL('https://www.exchangerate-api.com')`, 빈 상태에서도 존재                                                                                                                                                                                                                                                                                                                                                                                       |
| 9.40   | `src/lib/privacyPolicy.ts`                                               | 섹션 제목 목록에 `광고` 포함, `광고` 섹션에 "Google LLC" 문자열 포함(국외이전 고지 회귀 방지), lead 가 구 무수집 문구와 다르고 "광고 SDK" 포함                                                                                                                                                                                                                                                                                                                                                |
| 9-A.11 | `scripts/gen_privacy_docs.mjs` 드리프트                                  | 재생성 후 통과                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 9-A    | `scripts/refresh/__tests__/uk_tfl.test.ts`, `ca_cmhc.test.ts`            | `SOURCE.name`·`url` 고정, `legacyNames` 에 구 이름 포함, 구 이름 있는 city fixture 에서 `hasLegacySourceName` true → 1회 쓰기 후 구 이름 소멸                                                                                                                                                                                                                                                                                                                                                      |
| 기존   | `src/__fixtures__/seed-roundtrip.test.ts`                                | 재생성 데이터로 통과                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

커버리지 임계치(`src/lib/**` 100/95/100/100, `src/store/**` 100/90/100/100)는 유지한다. `.web.ts` 파일이 커버리지 수집에서 빠지면 `collectCoverageFrom` 에 명시적으로 포함시킨다.

---

## Maestro E2E

- **광고를 단언하는 flow 를 만들지 않는다.** 테스트 광고도 네트워크 의존이라 결정적이지 않다. `ad-banner` testID 는 존재 확인용으로만 남긴다.
- 배너로 인한 스크롤 거리 변화 회귀: `02-home`, `03-compare`, `05-detail`, `07-visual-a11y/screenshots` 전체 재실행. 스크린샷에 "Test Ad" 라벨이 찍히는 것은 정상 (개발 빌드).
- `06-settings/overview.yaml`, `08-sources-privacy/*` 는 변경 없이 통과해야 한다 (광고 없는 화면). `sources-drilldown` 은 `/sources` 푸터 링크 추가로 스크롤이 늘 수 있어 확인.
- 동의 흐름은 자동화하지 않는다. `.maestro/PLAN.md` §0 에 **수동 체크** 추가: (1) iOS 첫 실행 → 도시 선택 → Compare 에서 IDFA 설명 → ATT 시스템 알림 순서 확인, 거부/허용 각각 배너 표시 (2) `AdsConsent.requestInfoUpdate({ debugGeography: EEA, testDeviceIdentifiers })` 를 dev 전용 경로로 켜 GDPR 폼 + 설정 메뉴 노출 확인 (3) 오프라인에서 배너 슬롯이 0 높이인지.
- `maestro-debugger` 에이전트에 넘길 때 배너가 요소 트리에 추가된다는 점을 프롬프트에 명시.

---

## 운영자(사용자) 수동 작업 — 코드와 무관, 병렬 진행

| 순서 | 작업                                                                                                                                                     | 산출물 → 코드 반영 위치                                                                                 |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1    | AdMob 계정 생성, 결제 정보 등록                                                                                                                          | —                                                                                                       |
| 2    | 앱 2개 등록 (iOS·Android, 스토어 미출시 상태로 가능)                                                                                                     | App ID 2개 → `app.json` plugin (§B-2)                                                                   |
| 3    | 배너 광고 단위 2개 생성                                                                                                                                  | 광고 단위 ID 2개 → `AD_UNIT_IDS` (§C-1)                                                                 |
| 4    | 개인정보 보호 및 메시지: **GDPR 메시지** + **IDFA 설명 메시지** 게시                                                                                     | 없음 (UMP 가 원격으로 받음). 게시 전에는 `gatherConsent` 가 폼 없이 통과                                |
| 5    | `laegel123.github.io` 저장소 루트에 `app-ads.txt` (AdMob 콘솔이 제공하는 1줄). 스토어 등록 정보의 **개발자 웹사이트**를 `https://laegel123.github.io` 로 | 없음. 현재 Pages 가 `/overseas-cost-app/` 프로젝트 경로라 그 아래에는 둘 수 없다                        |
| 6    | App Store Connect: App Privacy 라벨 재작성 (§L RELEASE §5 값), ATT 사용 표시 / Play Console: Data safety 재작성                                          | 없음                                                                                                    |
| 7    | 스토어 출시 후 AdMob 앱 심사(스토어 연결) 완료까지 광고 게재 제한 있음                                                                                   | 없음                                                                                                    |
| 8    | 프로덕션 첫 빌드 전 §B-2·§C-1 placeholder 교체 확인                                                                                                      | 빌드 실패가 아니라 런타임 `AdsConfigError` 로 광고만 꺼지므로 **체크리스트로 강제** (RELEASE_CHECKLIST) |

---

## 실행 순서 (각 step 종료 시 typecheck · lint · test 그린 유지)

| step | 내용                                                                                                                                                                                                       | 검증                                                                                                                                                                                                           |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | **스파이크**: `npx expo install react-native-google-mobile-ads` + `app.json` plugin(샘플 App ID) + `npx expo config --type introspect` 로 plugin 적용 확인 + `eas build --profile development` iOS·Android | 두 플랫폼 dev 빌드가 부팅. 실패 시 (a) `npx expo install --fix`, (b) 16.x 하위 고정, (c) `expo-build-properties` static 순으로 시도, 결과를 ADR-077 에 기록. jest 가 `.native.ts` 를 해석하는지 빈 파일로 확인 |
| 1    | §A 출처 표기 보완 전부 (스크립트·재생성·`/sources` 링크·DATA/DATA_SOURCES·ADR-076)                                                                                                                         | 9-A 스크립트 테스트, seed-roundtrip, sources/index 테스트. 시뮬레이터에서 `/sources` 링크 탭 → 브라우저 열림                                                                                                   |
| 2    | §C `src/lib/ads.*` + §D store + `AdsConfigError` + jest mock + §J ESLint                                                                                                                                   | §9.42·9.43. `npm run lint` 가 컴포넌트의 직접 import 를 거부하는지 의도적 위반 파일로 확인 후 삭제                                                                                                             |
| 3    | §F Screen footer + §E AdBanner                                                                                                                                                                             | §9.44·9.45                                                                                                                                                                                                     |
| 4    | §G 화면 3개 + §H 루트 레이아웃 + §I 설정 메뉴                                                                                                                                                              | §9.46 + 화면 테스트. dev 빌드에서 테스트 배너가 3개 화면에 뜨고 온보딩·설정에는 없음. iOS 에서 ATT 알림이 Compare 위에서 뜸                                                                                    |
| 5    | §K 개인정보 처리방침 + `npm run gen:privacy` + store-metadata + RELEASE + RELEASE_CHECKLIST                                                                                                                | 드리프트 테스트, §9.40. `/privacy` 화면과 GitHub Pages 본문 일치                                                                                                                                               |
| 6    | §L 나머지 문서 (ADR-077, ADR.md, ADR-011 상태, CLAUDE.md, ARCHITECTURE, UI_GUIDE, TESTING 인벤토리, README, `.maestro/PLAN.md`)                                                                            | 인벤토리 누락 = step 미완                                                                                                                                                                                      |
| 7    | §B-2 버전 1.1.0 · versionCode 4 · buildNumber 1 + §B-3 eas.json env + `.env.example` + Maestro 전체 재실행 + 수동 동의 체크                                                                                | 28 flow 통과. 수동 체크 3건 기록                                                                                                                                                                               |

step 1 은 다른 step 과 독립이라 별도 PR 로 먼저 머지해도 된다. step 0 이 실패하면 step 2 이후를 `blocked` 로 두고 사용자에게 보고한다.

---

## 범위 밖 (본 phase 에서 하지 않음)

- 전면·보상형 광고, 미디에이션, 광고 빈도 제어.
- 분석·오류 추적 SDK (ADR-011 의 해당 부분은 그대로 유효).
- 출처명 전반의 ADR 번호·계산식 노출 정리 (HUD·StatCan CPI·BLS 3종) — 별도 부채. 본 phase 는 CMHC·TfL 만 건드린다.
- `docs/DATA.md` §9 의 "큐레이션 JSON 라이선스 MIT vs CC-BY 결정" — 광고와 무관한 미결 ADR.
- 다크 모드 배너 배경, 태블릿 레이아웃.
- 강제 업데이트·구버전 바이너리 처리 (RELEASE.md §16 그대로).
- GitHub raw JSON 을 CDN 으로 쓰는 문제 — GitHub 약관은 상업 이용을 금지하지 않으며 대역폭만 문제 (ADR-040 그대로).

---

## 참고 링크

- ExchangeRate-API 무료 endpoint 약관: https://www.exchangerate-api.com/docs/free
- TfL Transport Data Service 약관: https://tfl.gov.uk/corporate/terms-and-conditions/transport-data-service
- Statistics Canada Open Licence: https://www.statcan.gc.ca/en/reference/licence
- StatCan 표 34-10-0133-01: https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410013301
- KOSIS 통계정보활용약관: https://kosis.kr/openapi/introduce/introduce_02List.do
- 공공데이터의 제공 및 이용 활성화에 관한 법률 제3조: https://www.law.go.kr/lsEfInfoP.do?lsiSeq=162150
- e-Stat 이용규약: https://www.e-stat.go.jp/terms-of-use
- react-native-google-mobile-ads 문서 (Expo 설정·BannerAd·UMP): https://docs.page/invertase/react-native-google-mobile-ads
- AdMob iOS 데이터 공개: https://developers.google.com/admob/ios/data-disclosure
- AdMob Android Data safety: https://developers.google.com/admob/android/privacy/play-data-disclosure
- AdMob iOS 14+ (SKAdNetwork·ATT): https://developers.google.com/admob/ios/ios14
- AdMob 광고 배치 정책: https://support.google.com/admob/answer/6128877
- 호환 이슈: https://github.com/invertase/react-native-google-mobile-ads/issues/835
