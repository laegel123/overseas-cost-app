# Step 6: privacy-screen

## 배경

이 phase(`in-app-policy-pages`)는 데이터 출처·개인정보 처리방침을 외부 브라우저 링크에서 **앱 내부 화면**으로 옮긴다.

현재 설정 화면의 "개인정보 처리방침" 메뉴는 `Linking.openURL` 로 GitHub Pages 의 `privacy-policy.html` 을 연다. 이 step 은 그것을 대체할 **앱 내 처리방침 화면**을 만든다. 설정 배선 교체는 step 7 이므로, 이 step 이 끝난 시점에는 화면이 존재하지만 앱에서 도달할 경로가 아직 없다 (테스트로만 검증).

### 이미 만들어져 있는 것 (step 5 산출물)

`src/lib/privacyPolicy.ts` 가 본문 정본을 구조화해 들고 있다:

```ts
export type PrivacyBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'email'; label: string; email: string };

export type PrivacySection = { title: string; blocks: PrivacyBlock[] };

export type PrivacyPolicy = {
  appName: string;
  lead: string;            // '본 앱은 사용자 개인정보를 수집하지 않습니다.'
  operatorEmail: string;
  sections: PrivacySection[];   // 7개
  updatedAt: string;       // 'YYYY-MM-DD'
};

export const PRIVACY_POLICY: PrivacyPolicy;
```

같은 정본에서 `docs/privacy-policy.html`(스토어 등록 URL) 과 `docs/PRIVACY.md` 가 생성되며, 드리프트는 테스트가 막는다. **이 화면은 정본을 렌더하기만 한다 — 문구를 화면에 하드코딩하지 마라.**

**섹션 번호(`1.`, `2.` …)는 `title` 에 들어 있지 않고 렌더 시점에 붙인다.** HTML 생성기도 같은 규칙을 쓴다.

### 링크 처리 (결정됨)

- **운영자 이메일만 탭 가능**하게 한다 (`kind: 'email'` 블록) — `mailto:` 로 열린다. 설정의 "피드백 보내기" 와 같은 동작이다.
- 본문에 등장하는 다른 외부 참조(환율 API `open.er-api.com` 등)는 **일반 텍스트**로 둔다. 사실 명시일 뿐 실행할 동선이 아니다.

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래 목록을 반드시 직접 Read 할 것:

- `docs/ARCHITECTURE.md` — §라우팅, §화면별 백 동작
- `docs/ADR.md` (인덱스) — `docs/adr/071-in-app-policy-pages.md` (이 phase 의 결정 — 특히 화면은 일반 push), `docs/adr/072-privacy-policy-source.md` (본문 정본 = TS, step 5 작성)
- `docs/UI_GUIDE.md` — §디자인 원칙, §AI 슬롭 안티패턴, §타이포그래피(본문 텍스트 위계), §화면별 상태
- `docs/design/README.md` — 타이포·간격 토큰 사양
- `docs/RELEASE.md` §6.1 — 한국 PIPA 컴플라이언스 표 (화면이 충족해야 할 표시 요건)
- `docs/TESTING.md` — §5 모킹 전략(Linking mock), §8.2 `mockRouter`, §9 인벤토리 형식
- `src/lib/privacyPolicy.ts` — **step 5 산출물**. 정본 데이터와 타입
- `src/lib/linking.ts` — `openURL` wrapper
- `src/components/Screen.tsx`, `TopBar.tsx`, `typography/Text.tsx` — 화면 골격과 텍스트 컴포넌트
- `app/(tabs)/settings.tsx` — `safeOpenURL` 패턴(실패 시 `Alert`) 과 화면 마크업 관례
- `app/sources/[cityId].tsx` — **step 4 산출물**. 같은 phase 의 형제 화면 — 헤더·간격·섹션 라벨 처리를 맞출 것
- `tailwind.config.js`, `src/theme/tokens.ts` — 디자인 토큰

## 작업

### 1. `app/privacy.tsx` 신규

Expo Router 파일 기반 라우팅이므로 이 파일이 곧 `/privacy` 라우트다. `app/(tabs)/` 밖이라 하단 탭 바 없이 Stack push 로 뜬다.

화면 요구:

- `Screen scroll` + `TopBar`. 루트 `testID="privacy-screen"`.
- `TopBar`: `title="개인정보 처리방침"`, `subtitle={`마지막 갱신 ${PRIVACY_POLICY.updatedAt}`}`, `onBack` → `router.back()`. `testID="privacy-topbar"`.
- 리드 문단: `PRIVACY_POLICY.lead` 를 본문보다 강조된 위계로. `testID="privacy-lead"`.
- 섹션 반복 (`testID={`privacy-section-${idx}`}`):
  - 제목: `${idx + 1}. ${section.title}`
  - 블록 렌더:
    - `paragraph` → 본문 텍스트
    - `list` → 불릿 목록 (각 항목 앞에 불릿 마커). 텍스트를 자르지 마라 — 전문이 보여야 한다.
    - `email` → `label` + 이메일. **`Pressable` + `accessibilityRole="button"`**, 탭 시 `openURL(`mailto:${email}`)`. `testID={`privacy-email-${idx}`}`.
- 하단 여백 (다른 화면과 동일한 마무리 여백 관례를 따를 것).

**모든 문구는 `PRIVACY_POLICY` 에서 온다.** 화면 파일에 처리방침 문장을 하드코딩하지 마라 — 그러면 정본이 둘이 된다 (ADR-072 위반).

**시각 규칙 (CLAUDE.md CRITICAL):** 색·radius·spacing 은 `tailwind.config.js` / `src/theme/tokens.ts` 토큰만 사용. 매직 hex·px 금지.

### 2. 이메일 링크 실패 처리

`openURL` 실패 시 `Alert.alert` 로 알린다 (`app/(tabs)/settings.tsx` 의 `safeOpenURL` 과 동일 패턴). **silent fail 금지** (CLAUDE.md CRITICAL).

`react-native` 의 `Linking` 을 직접 import 하지 말고 `@/lib/linking` 을 경유한다.

### 3. 테스트 — `app/__tests__/privacy.test.tsx` 신규

`jest.mock('@/lib/linking')` 로 `openURL` 을 mock 할 것.

최소 케이스:

- 리드 문단이 렌더된다
- 섹션 7개가 모두 렌더되고, 제목에 `1.`~`7.` 번호가 순서대로 붙는다
- `list` 블록의 항목이 전부 렌더된다 (개수 단언)
- 이메일 블록 탭 → `openURL('mailto:<operatorEmail>')` 호출
- `openURL` reject → `Alert.alert` 호출 (silent fail 아님)
- 헤더 부제에 `updatedAt` 이 표시된다
- back 탭 → `router.back()`
- **화면 파일에 처리방침 본문 문자열이 하드코딩돼 있지 않다** — 정본의 값을 바꾼 mock 으로 렌더해 화면이 그 값을 따라가는지 검증하는 방식이 가장 확실하다

`docs/TESTING.md` §9 인벤토리에 `app/privacy.tsx` 절을 신규 추가한다. **인벤토리 누락 = step 미완** (CLAUDE.md).

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm test
```

추가 검증:

```bash
# 화면 파일에 처리방침 본문이 하드코딩되지 않았는지 (정본 참조만 있어야 함)
grep -n "수집하지 않습니다\|AsyncStorage\|open.er-api" app/privacy.tsx && exit 1 || true
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 모든 문구가 `PRIVACY_POLICY` 정본에서 오는가? (ADR-072 — 화면 하드코딩 금지)
   - `@/lib/linking` 을 경유하는가? (`react-native` `Linking` 직접 사용 금지)
   - 링크 실패를 사용자에게 노출하는가? (silent fail 금지 — CLAUDE.md CRITICAL)
   - 매직 색상값·px 없이 토큰만 썼는가? (CLAUDE.md CRITICAL)
   - 본문 텍스트를 말줄임으로 자르지 않는가? (법적 문서 — 전문이 보여야 한다)
   - `docs/TESTING.md` 인벤토리에 새 화면을 기재했는가?
3. 결과에 따라 `phases/in-app-policy-pages/index.json` 의 step 6 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 처리방침 문장을 화면 파일에 하드코딩하지 마라. 이유: ADR-072 가 정한 단일 출처(`src/lib/privacyPolicy.ts`)가 깨지고, `privacy-policy.html` 과 앱 화면이 갈라진다.
- 본문을 요약하거나 "더 보기" 로 접지 마라. 이유: 법적 고지 문서이며 전문이 보여야 한다.
- 환율 API 주소 등 이메일 외의 문자열을 링크로 만들지 마라. 이유: 이메일만 탭 가능으로 결정됐다.
- `react-native` 의 `Linking` 을 직접 import 하지 마라. 이유: 테스트 mock 이 어렵다 (`docs/TESTING.md` §5 — `@/lib/linking` wrapper 가 존재하는 이유).
- `docs/privacy-policy.html` 이나 `docs/PRIVACY.md` 를 손으로 고치지 마라. 이유: step 5 가 만든 생성물이다. 본문을 고치려면 정본을 고치고 `npm run gen:privacy` 를 돌린다.
- `app/(tabs)/settings.tsx` 를 수정하지 마라. 이유: step 7 의 범위다. 이 step 이 끝난 시점에 화면이 앱에서 도달 불가한 것은 **의도된 상태**다.
- `presentation: 'modal'` 을 설정하지 마라. 이유: ADR-071 결정 3 (일반 push).
- 기존 테스트를 깨뜨리지 마라.
