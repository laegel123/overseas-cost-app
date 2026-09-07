# Step 7: settings-wiring

## 배경

이 phase(`in-app-policy-pages`)는 데이터 출처·개인정보 처리방침을 외부 브라우저 링크에서 **앱 내부 화면**으로 옮긴다. 앞선 step 들이 화면과 lib 을 모두 만들었지만 **앱에서 도달할 경로가 아직 없다.** 이 step 이 설정 화면을 새 화면에 연결하고, 쓸모없어진 외부 링크 상수와 `DATA_SOURCES_COUNT` 를 제거한다.

### 현재 상태 (`app/(tabs)/settings.tsx`)

```ts
const PRIVACY_POLICY_URL = 'https://laegel123.github.io/overseas-cost-app/privacy-policy.html';
const DATA_SOURCES_URL = 'https://github.com/laegel123/overseas-cost-app/blob/main/docs/DATA_SOURCES.md';
const FEEDBACK_EMAIL = 'laegel1@gmail.com';
```

메뉴 4개가 있다:

| testID | 라벨 | rightText | 현재 동작 | 이 step 이후 |
| --- | --- | --- | --- | --- |
| `menu-sources` | 데이터 출처 보기 | `${DATA_SOURCES_COUNT}개` (= `12개`) | `openURL(DATA_SOURCES_URL)` | **`router.push('/sources')`**, rightText = 런타임 실측 |
| `menu-feedback` | 피드백 보내기 | (없음) | `openURL('mailto:…')` | **그대로 유지** |
| `menu-privacy` | 개인정보 처리방침 | (없음) | `openURL(PRIVACY_POLICY_URL)` | **`router.push('/privacy')`** |
| `menu-app-info` | 앱 정보 | `v1.0.0` | (dim, 동작 없음) | 그대로 |

### 선행 step 산출물

- `app/sources/index.tsx` → `/sources` (step 3)
- `app/sources/[cityId].tsx` → `/sources/[cityId]` (step 4)
- `app/privacy.tsx` → `/privacy` (step 6)
- `src/lib/sources.ts` 의 `countUniqueSources(): number` (step 2) — 로드된 도시 데이터에서 `(name, url)` 기준 unique 출처 수

### 제거 대상 — `DATA_SOURCES_COUNT` 체계 전체

ADR-071 결정 2 에 따라 큐레이션 상수를 런타임 실측으로 대체한다. 지울 것:

1. `src/lib/dataSources.ts` (상수 `DATA_SOURCES_COUNT = 12` 만 들어 있는 파일)
2. `src/lib/__tests__/dataSources.test.ts` (doc 마커 ↔ 상수 동기화 드리프트 테스트)
3. `src/lib/index.ts` 의 `export { DATA_SOURCES_COUNT } from './dataSources';`
4. `docs/DATA_SOURCES.md` 상단의 `<!-- DATA_SOURCES_COUNT: 12 -->` 마커와 그것을 설명하는 **⚠ 경고 인용 블록 전체** (1~17줄 부근). 이 블록은 "상수와 마커를 함께 갱신하라" 는 지시문이라 상수가 사라지면 의미가 없다.
5. `docs/TESTING.md` §9.33 (`src/lib/dataSources.ts` 인벤토리 절) — 저장소 관례상 삭제된 모듈은 **절을 지우지 않고 "(삭제됨 — ADR-071, in-app-policy-pages step 7)" 로 표시**한다. §9.31 (`src/lib/persona.ts`) 과 §9.34 (`PersonaCard.tsx`) 가 그 선례다. 그 관례를 따를 것.

`docs/DATA_SOURCES.md` 의 나머지 본문(도시별 출처 매핑 848줄)은 그대로 둔다 — 자동화 가이드로 계속 쓰인다.

### 주의: 이 step 에서 스냅샷이 바뀐다

`app/(tabs)/__tests__/__snapshots__/settings.test.tsx.snap` 이 존재하고 rightText `12개` 를 담고 있다. 실측값으로 바뀌므로 **스냅샷 갱신이 정당하다.** 다만 갱신 전에 diff 를 읽고 rightText 외에 의도치 않은 변화가 없는지 확인할 것.

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래 목록을 반드시 직접 Read 할 것:

- `docs/ARCHITECTURE.md` — §라우팅, §화면별 백 동작
- `docs/ADR.md` (인덱스) — `docs/adr/071-in-app-policy-pages.md` (**결정 1·2 가 이 step 의 근거**), `docs/adr/065-source-count-privacy.md` (이 step 이 supersede 하는 결정 — 무엇을 왜 되돌리는지 이해할 것), `docs/adr/072-privacy-policy-source.md`
- `docs/UI_GUIDE.md` — §설정 메뉴 정확 매핑 표(행별 아이콘·rightText·비고. "외부 링크" 표기가 이 step 으로 사실이 아니게 된다 — **문서 수정은 step 8 담당**), §MenuRow
- `docs/design/README.md` §5 — Settings 화면 사양
- `docs/TESTING.md` — §9.29 (`settings.tsx` 인벤토리), §9.33 (`dataSources.ts`), §9.31·§9.34 (삭제된 모듈 표기 선례), §6 스냅샷 정책
- `app/(tabs)/settings.tsx` — 대상 파일 전체
- `app/(tabs)/__tests__/settings.test.tsx` 와 `__snapshots__/settings.test.tsx.snap` — 기존 테스트·스냅샷
- `src/lib/sources.ts` — **step 2 산출물**. `countUniqueSources`
- `src/lib/dataSources.ts`, `src/lib/__tests__/dataSources.test.ts`, `src/lib/index.ts` — 제거 대상
- `docs/DATA_SOURCES.md` 1~20줄 — 제거할 마커 블록
- `app/sources/index.tsx`, `app/privacy.tsx` — push 대상 라우트 (경로 확인용)

## 작업

### 1. `app/(tabs)/settings.tsx` — 배선 교체

- `PRIVACY_POLICY_URL`, `DATA_SOURCES_URL` 상수를 **삭제**한다.
- `DATA_SOURCES_COUNT` import 를 삭제한다.
- `handleDataSources` → `router.push('/sources')`
- `handlePrivacy` → `router.push('/privacy')`
- `handleFeedback` 은 **그대로 둔다** (mailto — `safeOpenURL` 경유). 따라서 `safeOpenURL` 과 `openURL` import 도 남는다. 피드백 하나만 쓰게 되었다고 헬퍼를 인라인하지 마라 (불필요한 리팩터링).
- `menu-sources` 의 `rightText` 를 `` `${sourceCount}개` `` 로 바꾼다. `sourceCount` 는 `countUniqueSources()` 결과다.
  - **데이터 갱신 후 값이 따라가야 한다.** 같은 파일의 `citiesCount` 가 이미 같은 문제를 `React.useMemo(() => …, [lastSync])` 로 풀고 있다 (외부 모듈 상태라 ESLint exhaustive-deps 를 의도적으로 무시하는 주석까지 달려 있음). **그 패턴을 그대로 따를 것** — 새로운 방식을 발명하지 마라.
- `expo-router` 의 `useRouter` 를 import 한다 (파일에 아직 없다면).

메뉴 라벨·아이콘·순서·testID 는 **바꾸지 않는다.**

### 2. `DATA_SOURCES_COUNT` 체계 제거

위 배경의 제거 대상 1~5 를 수행한다.

`docs/DATA_SOURCES.md` 에서 마커 블록을 지울 때 **본문 "출처 유형 총수: 12" 문장도 함께** 사라져야 한다. 이 값은 이제 어디서도 쓰이지 않는다.

### 3. 테스트

`app/(tabs)/__tests__/settings.test.tsx` 갱신:

- `menu-sources` 탭 → `router.push('/sources')` (기존 `openURL(DATA_SOURCES_URL)` 단언을 대체)
- `menu-privacy` 탭 → `router.push('/privacy')` (기존 `openURL(PRIVACY_POLICY_URL)` 단언을 대체)
- `menu-feedback` 탭 → `openURL('mailto:…')` **회귀 방지로 유지**
- `menu-sources` 의 rightText 가 `countUniqueSources()` 값과 일치 (mock 으로 값을 바꿔 화면이 따라가는지 검증 — 하드코딩 `12개` 단언 금지)
- 데이터 갱신(`lastSync` 변경) 후 rightText 가 새 값으로 바뀐다
- 스냅샷 갱신

`docs/TESTING.md`:

- §9.29 (`settings.tsx`) 의 "외부 링크" 항목 3개를 인앱 라우팅 기준으로 갱신
- §9.33 을 "(삭제됨 — ADR-071, in-app-policy-pages step 7)" 로 표시 (§9.31·§9.34 선례 방식)

**인벤토리 누락 = step 미완** (CLAUDE.md).

**커버리지 요구:** `src/lib/**` 는 statements 100 / branches 95 / lines 100 / functions 100. 파일 삭제로 커버리지가 흔들릴 수 있으니 확인할 것.

```bash
npm run test:coverage
```

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm test
```

추가 검증:

```bash
# 외부 링크 상수와 DATA_SOURCES_COUNT 가 완전히 사라졌는지
grep -rn "DATA_SOURCES_COUNT\|PRIVACY_POLICY_URL\|DATA_SOURCES_URL" src app docs && exit 1 || true
test ! -f src/lib/dataSources.ts
test ! -f src/lib/__tests__/dataSources.test.ts

# 피드백 mailto 는 남아 있어야 한다
grep -q "mailto" app/\(tabs\)/settings.tsx
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. `git diff app/\(tabs\)/__tests__/__snapshots__/settings.test.tsx.snap` 을 읽고 **rightText 값 외의 변화가 없는지** 확인한다. 다른 부분이 바뀌었다면 의도치 않은 렌더 변화이므로 원인을 고쳐라.
3. 아키텍처 체크리스트:
   - 화면이 `fetch` 를 직접 호출하지 않고 `src/lib` 을 경유하는가? (CLAUDE.md CRITICAL)
   - `citiesCount` 와 동일한 `useMemo([lastSync])` 패턴을 따랐는가? (새 방식 발명 금지)
   - 메뉴 라벨·아이콘·순서·testID 가 불변인가?
   - 삭제된 모듈을 `docs/TESTING.md` 관례대로 표시했는가?
4. 결과에 따라 `phases/in-app-policy-pages/index.json` 의 step 7 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `handleFeedback` 의 mailto 동작을 바꾸거나 `safeOpenURL` 헬퍼를 제거하지 마라. 이유: 피드백은 여전히 외부 메일 앱을 여는 것이 맞고, 헬퍼 인라인은 요청되지 않은 리팩터링이다 (CLAUDE.md §3).
- 메뉴 라벨·아이콘·순서·`testID` 를 바꾸지 마라. 이유: E2E 플로우(`.maestro/`)와 스냅샷이 이 값에 의존한다.
- `docs/DATA_SOURCES.md` 의 도시별 출처 매핑 본문(848줄)을 지우지 마라. 이유: 자동화 가이드로 계속 쓰인다. 지울 것은 상단 마커 블록뿐이다.
- `docs/TESTING.md` §9.33 절을 통째로 삭제하지 마라. 이유: 저장소 관례는 "(삭제됨 — …)" 표시 유지다 (§9.31·§9.34 선례). 이력이 사라지면 왜 없어졌는지 추적이 끊긴다.
- `docs/UI_GUIDE.md` / `docs/ARCHITECTURE.md` / `docs/RELEASE.md` 를 수정하지 마라. 이유: step 8 의 범위다.
- 스냅샷을 확인 없이 `-u` 로 갱신하지 마라. 이유: rightText 외의 변화가 섞여 들어갈 수 있다.
- 기존 테스트를 깨뜨리지 마라 (피드백 mailto 회귀 테스트 포함).
