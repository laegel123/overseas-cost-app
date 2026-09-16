# Step 6: settings-privacy-menu

## 배경

이 phase(`admob-banner-ads`)는 Google AdMob 하단 배너를 홈·비교·상세 3개 화면에 도입한다. step 1 이 `showPrivacyOptionsForm()` 을, step 2 가 `useAdsStore.privacyOptionsRequired` 를 만들었고 step 5 가 동의 흐름을 켰다.

**이 step 은 설정 화면에 "광고 개인정보 설정" 메뉴를 조건부로 추가한다.** UMP 가 `privacyOptionsRequirementStatus === 'REQUIRED'` 를 돌려주는 사용자(EEA·영국·스위스)에게만 보인다. 이것은 요청되지 않은 기능이 아니라 **TCF 의 동의 철회 진입점 의무**다. 한국 사용자에게는 보이지 않으므로 기존 E2E 단언(`06-settings/overview.yaml`, 메뉴 4개)은 유지된다.

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래를 반드시 직접 Read 할 것:

- `CLAUDE.md`
- `docs/plans/admob-banner-ads.md` §I, 인벤토리 "기존 § `app/(tabs)/settings.tsx`" 행
- `docs/UI_GUIDE.md` §UI 텍스트 한국어 표준 → 설정 절(433행 부근), §에러 메시지 한국어 표준 카탈로그(507행 부근)
- `app/(tabs)/settings.tsx` — 수정 대상. 71~77행 `safeOpenURL`(Alert 패턴), 166~194행 메뉴 그룹 (`menu-sources` / `menu-feedback` / `menu-privacy` / `menu-app-info`(isLast))
- `app/(tabs)/__tests__/settings.test.tsx` — 210~220행 메뉴 4개 단언, 267~290행 탭 핸들러 테스트, Alert 검증 패턴
- `src/components/MenuRow.tsx` — props (`icon`, `label`, `onPress`, `testID`, `isLast`, `variant`, `rightText`, `showChevron`)
- `src/components/Icon.tsx` 75행·121행 — `shield` 아이콘이 `ICON_NAMES` 에 있음
- `src/lib/ads.native.ts` (`showPrivacyOptionsForm`), `src/store/ads.ts` (`privacyOptionsRequired`)
- `.maestro/flows/06-settings/overview.yaml` — 기존 E2E 가 무엇을 단언하는지
- `docs/TESTING.md` §9 의 settings 인벤토리 절 (`grep -n "settings.tsx" docs/TESTING.md`)

## 작업

### 1. `app/(tabs)/settings.tsx`

메뉴 그룹에서 "개인정보 처리방침"(`menu-privacy`) **다음**, "앱 정보"(`menu-app-info`) **앞**에 조건부 행:

```tsx
{privacyOptionsRequired && (
  <MenuRow
    icon="shield"
    label="광고 개인정보 설정"
    onPress={handleAdsPrivacy}
    testID="menu-ads-privacy"
  />
)}
```

- `const privacyOptionsRequired = useAdsStore((s) => s.privacyOptionsRequired);` (`@/store`).
- `handleAdsPrivacy = React.useCallback(async () => { try { await showPrivacyOptionsForm(); } catch { Alert.alert('알림', '광고 설정 화면을 열지 못했어요. 잠시 후 다시 시도해 주세요.'); } }, [])` — `showPrivacyOptionsForm` 은 `@/lib`. 탭 redirect 안내와 같은 네이티브 `Alert` 패턴 (토스트 미구현).
- 아이콘은 기존 `shield` 재사용. 새 SVG 를 추가하지 않는다.
- "앱 정보" 행의 `isLast` 는 그대로 (조건부 행이 중간에 끼므로 마지막 행 판정 무변경).
- 파일 상단 doc comment 의 "Menu list: MenuRow 4개" 서술을 "4개 + 조건부 1개(광고 개인정보 설정, EEA 등 `privacyOptionsRequired` 만)" 로 갱신.

### 2. 테스트 — `app/(tabs)/__tests__/settings.test.tsx`

`@/lib` mock 에 `showPrivacyOptionsForm: jest.fn()` 추가 (기존 mock 구성을 따를 것). `useAdsStore.setState` 로 주입:

- `privacyOptionsRequired=false` (기본) → `menu-ads-privacy` **부재** + 기존 "4개 메뉴" 테스트 무변경 통과
- `privacyOptionsRequired=true` → `menu-ads-privacy` 존재, 라벨 `광고 개인정보 설정`, `menu-privacy` 와 `menu-app-info` 사이 순서
- 탭 → `showPrivacyOptionsForm` 1회
- `showPrivacyOptionsForm` reject → `Alert.alert('알림', '광고 설정 화면을 열지 못했어요. 잠시 후 다시 시도해 주세요.')` 1회
- `menu-app-info` 가 여전히 마지막 행 (border 없음) — 조건부 행 유무 양쪽에서

스냅샷이 있으면 `privacyOptionsRequired=false` 기준 스냅샷은 **무변경**이어야 한다.

### 3. 문서

- `docs/TESTING.md` settings 절에 위 케이스 추가 (**누락 = step 미완**).
- `docs/UI_GUIDE.md` §UI 텍스트 한국어 표준 → 설정 절에 `광고 개인정보 설정` 라벨 + Alert 문구(`알림` / `광고 설정 화면을 열지 못했어요. 잠시 후 다시 시도해 주세요.`) 추가. §에러 메시지 카탈로그에도 같은 Alert 문구 행. 구현 파일에서 그대로 옮길 것.
- `docs/UI_GUIDE.md` 의 설정 메뉴 정확 매핑 표(`grep -n "menu-app-info\|앱 정보" docs/UI_GUIDE.md`)에 조건부 행 추가 ("EEA·영국·스위스 사용자만, TCF 동의 철회 진입점 — ADR-077").

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm test -- "app/(tabs)"
grep -c 'menu-ads-privacy' "app/(tabs)/settings.tsx" "app/(tabs)/__tests__/settings.test.tsx" docs/TESTING.md docs/UI_GUIDE.md   # 각 ≥ 1
grep -c 'react-native-google-mobile-ads' "app/(tabs)/settings.tsx"     # 0
```

## 검증 절차

1. 위 AC 를 실행한다.
2. 아키텍처 체크리스트:
   - 한국 사용자(`privacyOptionsRequired=false`) 렌더가 기존과 완전히 동일한가? (스냅샷 무변경)
   - SDK 를 lib 경유로만 호출하는가?
   - 실패가 Alert 로 노출되는가? (삼키지 않음)
   - 새 아이콘·새 색상 없음?
3. 결과에 따라 `phases/admob-banner-ads/index.json` 의 step 6 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- 메뉴를 무조건 노출하지 마라. 이유: 한국 사용자에게는 UMP 가 폼을 제공하지 않아 탭해도 아무 일이 없거나 실패한다. `06-settings/overview.yaml` 도 메뉴 4개를 전제한다.
- 설정 화면에 `AdBanner` 를 넣지 마라. 이유: 광고 없는 화면 결정.
- `.maestro/flows/06-settings/*.yaml` 을 수정하지 마라. 이유: 한국 로케일 시뮬레이터에서 메뉴는 보이지 않으므로 기존 flow 는 그대로 통과해야 한다. E2E 전체 재실행은 step 9.
- `docs/RELEASE.md`, `privacyPolicy.json` 을 수정하지 마라. 이유: step 7 의 범위.
- 기존 테스트를 깨뜨리지 마라.
