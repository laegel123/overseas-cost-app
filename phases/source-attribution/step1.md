# Step 1: fx-attribution-link

## 배경

이 phase(`source-attribution`)는 광고 도입 전에 데이터 출처 표기 의무 3건을 고친다. step 0 이 런던 교통·캐나다 월세 출처명을 정정하고 ADR-076 을 기록했다. **이 step 은 마지막 결함 — 환율 1차 출처 open.er-api.com 의 필수 표기 — 를 `/sources` 화면 푸터에 링크로 추가한다.**

ExchangeRate-API 무료 endpoint 약관(https://www.exchangerate-api.com/docs/free)은 앱에 `Rates By Exchange Rate API` 링크를 요구한다. 문구는 **원문 그대로, 번역 금지**.

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래를 반드시 직접 Read 할 것:

- `CLAUDE.md`
- `docs/plans/admob-banner-ads.md` §A-4 (이 step 의 설계 원문), §A-5, §Maestro E2E 의 `sources-drilldown` 언급
- `docs/adr/076-source-attribution-compliance.md` — step 0 이 작성한 결정
- `docs/UI_GUIDE.md` §UI 텍스트 한국어 표준 → "출처 화면" 절(455행 부근)
- `docs/DATA.md` §3.3 출처 표기 표(112~126행)
- `docs/TESTING.md` §9.38 (`app/sources/index.tsx` 인벤토리, 2586행 부근), §18.7
- `app/sources/index.tsx` — 수정 대상 (127행, `Screen scroll` 안에 TopBar + 목록/빈 상태)
- `app/sources/[cityId].tsx` — 54~60행 `safeOpenURL`, 122~128행 `source-city-footer` 블록 (복제할 시각 규격), 139행 이후 `SourceCard` 의 "페이지 열기 →" 링크 스타일
- `app/sources/__tests__/index.test.tsx`, `app/sources/__tests__/[cityId].test.tsx` (199~235행 — `@/lib/linking` mock 으로 openURL 호출·실패 Alert 를 검증하는 패턴)
- `src/lib/linking.ts` — `openURL` wrapper (컴포넌트는 RN `Linking` 을 직접 쓰지 않는다)
- `src/components/typography/Text.tsx` — `Tiny`, `Small`, `TextColor`

## 작업

### 1. `app/sources/index.tsx` — 푸터 블록

`Screen` 의 마지막 자식으로(도시 목록 카드와 빈 상태 **양쪽 모두의 아래에**, 즉 삼항식 바깥) 푸터를 추가한다.

- 컨테이너: `app/sources/[cityId].tsx` 의 `source-city-footer` 와 같은 시각 규격 — `className="mt-6 pt-4 border-t border-dashed border-line gap-1"`, `testID="sources-footer"`. 그 아래 `<View className="h-6" />` 로 하단 여백 (역시 `[cityId].tsx` 130행과 동일).
- 내용 1: `Tiny` — `환율은 아래 서비스의 무료 API 로 매일 갱신됩니다.`
- 내용 2: `Pressable` 링크. 텍스트는 **`Rates By Exchange Rate API`** (원문, 번역 금지). 스타일은 `SourceCard` 의 "페이지 열기 →" 와 동일 (`Small color="orange"` + `font-manrope-bold` 클래스 — 실제 클래스명은 `[cityId].tsx` 에서 그대로 옮길 것). props: `accessibilityRole="link"`, `accessibilityLabel="Exchange Rate API 페이지 열기"`, `testID="fx-attribution-link"`.
- URL 상수: `const FX_ATTRIBUTION_URL = 'https://www.exchangerate-api.com';` (모듈 레벨, `SCREAMING_SNAKE_CASE`).
- 외부 열기: `app/sources/[cityId].tsx` 54~60행의 `safeOpenURL` 을 **동일 패턴으로 이 파일에 복제**한다 (`openURL` 은 `@/lib/linking`, 실패 시 `Alert.alert('링크 열기 실패', '브라우저를 열 수 없습니다.')`). 세 화면이 각자 정의하는 현 상태를 유지하며 공용 util 로 추출하지 않는다 (무관한 리팩토링).
- **빈 상태(`groups.length === 0`)에서도 링크는 항상 표시**한다. 환율 fallback(baseline) 만 쓰는 상황에도 1차 소스는 ER-API 이므로 표기가 틀리지 않는다.
- 파일 상단 doc comment 에 푸터 목적(ER-API 약관 필수 표기, ADR-076) 한 줄 추가.

### 2. 테스트 — `app/sources/__tests__/index.test.tsx`

기존 테스트를 유지하면서 추가한다 (`@/lib/linking` 을 `jest.mock` — `[cityId].test.tsx` 21·34행 패턴):

- `fx-attribution-link` 가 렌더되고 텍스트가 정확히 `Rates By Exchange Rate API`
- 탭 → `openURL('https://www.exchangerate-api.com')` 1회
- `openURL` reject → `Alert.alert('링크 열기 실패', …)` 호출 (silent fail 아님)
- 도시 0개(빈 상태)에서도 `fx-attribution-link` 존재
- `accessibilityRole="link"` + `accessibilityLabel="Exchange Rate API 페이지 열기"`

기존 스냅샷이 있으면 갱신하되, 변경 diff 가 푸터 추가뿐인지 눈으로 확인한다.

### 3. 문서

- `docs/TESTING.md` §9.38 에 위 케이스를 항목으로 추가 (**인벤토리 누락 = step 미완**).
- `docs/DATA.md` §3.3 표에 행 추가: `| 출처 화면 /sources 푸터 | Rates By Exchange Rate API 링크 | exchangerate-api.com — 무료 endpoint 약관의 필수 표기 (ADR-076) |`
- `docs/UI_GUIDE.md` §UI 텍스트 한국어 표준 → 출처 화면 절에 푸터 문구 2줄(`환율은 아래 서비스의 무료 API 로 매일 갱신됩니다.`, `Rates By Exchange Rate API`)과 접근성 라벨을 추가. 구현 파일에서 그대로 옮길 것.
- `docs/TESTING.md` §18.7 수동 체크리스트에 "`/sources` 하단 `Rates By Exchange Rate API` 탭 → exchangerate-api.com 이 외부 브라우저로 열림" 항목 추가.

### 4. E2E 영향 확인 (조건부)

`08-sources-privacy/sources-drilldown.yaml` 은 `/sources` 에서 도시 행을 탭한다. 푸터는 목록 아래라 앵커에 영향이 없어야 하지만 확인한다:

```bash
npm run e2e:check                                   # 부팅된 시뮬레이터 + dev build + Metro 전제 확인
maestro test .maestro/flows/08-sources-privacy      # 위가 통과할 때만
```

`npm run e2e:check` 가 실패(시뮬레이터 미부팅 등)하면 Maestro 는 실행하지 않고 summary 에 "Maestro 08 배치 미실행 — 사유" 를 적는다. 시뮬레이터를 직접 띄우거나 `expo run:ios` 를 새로 돌리지 마라 (수 분 소요, 이 step 의 범위 밖).

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm test
grep -c 'Rates By Exchange Rate API' app/sources/index.tsx    # ≥ 1
grep -c 'fx-attribution-link' docs/TESTING.md                 # ≥ 1
grep -c 'Rates By Exchange Rate API' docs/DATA.md             # ≥ 1
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `fetch`/`Linking` 을 컴포넌트가 직접 호출하지 않는가? (`@/lib/linking` 경유)
   - 색·간격은 토큰 클래스만 쓰는가? (매직 넘버 금지)
   - 링크 텍스트가 원문 그대로인가? (약관 요구 표기 — 번역·변형 금지)
   - 빈 상태에서도 링크가 보이는가?
   - TESTING §9.38 인벤토리를 갱신했는가?
3. 결과에 따라 `phases/source-attribution/index.json` 의 step 1 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `safeOpenURL` 을 공용 util 로 추출하지 마라. 이유: settings·privacy·sources/[cityId] 세 곳이 각자 정의하는 현 상태를 바꾸는 것은 이 step 과 무관한 리팩토링이다.
- 링크 텍스트를 한국어로 번역하거나 "→" 등을 덧붙이지 마라. 이유: ER-API 약관이 `Rates By Exchange Rate API` 표기를 요구한다.
- `src/lib/currency.ts` 나 환율 fallback 로직을 건드리지 마라. 이유: 이 step 은 표기 의무만 다룬다.
- `app/sources/[cityId].tsx`, `app/(tabs)/settings.tsx` 를 수정하지 마라. 이유: 범위 밖.
- 기존 테스트를 깨뜨리지 마라.
