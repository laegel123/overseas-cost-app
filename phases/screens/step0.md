# Step 0: compare

Compare 화면 — 앱의 메인. 서울 vs 도시 X 1:1 비교. 가장 복잡한 layout 이라 가장 먼저 (design/README §구현 우선순위).

`app/compare/[cityId].tsx` placeholder 를 실제 구현으로 교체.

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL (페르소나 분기, hot 규칙, 데이터 fetch 정책)
- `docs/PRD.md` — Compare 화면 요구사항
- `docs/design/README.md` §3 (Compare) + §Interactions
- `docs/UI_GUIDE.md` §Compare
- `docs/ARCHITECTURE.md` §라우팅 / §부팅·hydration
- `docs/TESTING.md` §10 (screens 테스트 정책 — 신규 섹션 추가 필요)
- `docs/ADR.md` ADR-038 (도시 picker 미도입), ADR-041 (탭 동작), ADR-014 (에러), ADR-046 (환율)
- 데이터·스토어 산출물:
  - `src/lib/data.ts` — `getCity` / `loadAllCities`
  - `src/lib/currency.ts` — `convertToKRW`
  - `src/lib/compare.ts` — 비교 계산 (배수 / swPct / cwPct)
  - `src/lib/format.ts` — `formatKRW`, `formatMultiplier`, `isHot`, `getMultColor`, `formatShortDate`
  - `src/store/persona.ts` / `favorites.ts` / `recent.ts` / `settings.ts`
- 컴포넌트 산출물:
  - `Screen`, `TopBar`, `BottomTabBar`, `Icon`, `HeroCard` (orange variant), `ComparePair`, `ErrorView`
  - typography (`H1`, `H3`, `Small`, `Tiny`, `MonoLabel`)

## 작업

### 1. `app/compare/[cityId].tsx`

- `useLocalSearchParams<{ cityId: string }>()` 로 cityId 추출
- 라이프사이클:
  1. mount 시 `loadAllCities()` (이미 캐시됨이 일반적, dev 콜드스타트엔 fetch + seed fallback)
  2. `getCity(cityId)` + `getCity('seoul')` 두 번 호출
  3. 환율: `convertToKRW(cityCost, city.currency)` 로 KRW 정규화
  4. `recent.add(cityId)` (FIFO) — 마운트 시 1회
- 페르소나 분기 (`usePersonaStore.persona`):
  - `student` / `worker` / `unknown`
  - 카테고리 카드 매트릭스는 `unknown = student ∪ worker` (CLAUDE.md CRITICAL)
- Layout (Screen 사용):
  - **TopBar**: back / `서울 vs ${city.ko}` + `1 ${city.currency} = ${rate}원 · ${formatShortDate(lastSync)}` / star (즐겨찾기 토글)
  - **HeroCard orange**: 한 달 총비용 — `seoulTotal`, `cityTotal`, `mult`, `swPct`, `cwPct`
  - **카테고리 ComparePair × N**: 페르소나에 따라 달라짐. 각 카드 탭 시 `router.push(\`/detail/\${cityId}/\${category}\`)`
  - **Source footer**: `출처 ${count}개 · 갱신 ${lastSync}` + `출처 보기 →`
- 즐겨찾기 토글: `useFavoritesStore.toggle(cityId)` — TopBar right icon 색상이 toggle 상태 반영
- 에러 핸들링:
  - `getCity` throws (`CityNotFoundError`) → `ErrorView` (`도시 데이터를 찾을 수 없어요` + 돌아가기)
  - 환율 fetch 실패 → fallback chain (ADR-046) 후 inline 배지 (`환율 정보 없음` 등)
- v1.0 미구현 (component 단계에서 stub):
  - `❓ 자세히` info 버튼 — 추후 모달
  - 도시 picker (ADR-038) — 미도입
- 출처 보기 — v1.0: `Linking.openURL(sourceUrl)` 또는 inline expand (디자인 결정)

### 2. `(tabs)/_layout.tsx` — 4 탭 확장 + 탭 라우팅 단축

ADR-041: v1.0 즐겨찾기·비교 탭은 라우팅 단축 (별도 화면 없이 redirect).

- 현재 (홈/설정 2 탭) → 4 탭 (홈/비교/즐겨찾기/설정) 등록
- 비교 탭 탭 시 `recent[0]` 또는 `favorites[0]` 가 있으면 `/compare/{id}` 로 redirect, 없으면 홈 + 토스트
- 즐겨찾기 탭 탭 시 `favorites[0]` redirect, 없으면 홈 + 토스트
- 비교/즐겨찾기 탭은 expo-router 의 `Tabs.Screen` `listeners.tabPress` 활용 (default screen 진입 차단 + redirect)

### 3. 테스트 (`app/compare/__tests__/[cityId].test.tsx`)

- 페르소나 3 분기 × 카테고리 카드 갯수
- HeroCard / ComparePair 각각 1회 mount 검증
- TopBar back / star 인터랙션
- `recent.add` 마운트 시 호출
- ErrorView 분기 (city 없음 / 데이터 fetch 실패)
- snapshot 1 케이스 (vancouver + worker 페르소나)

### 4. `docs/TESTING.md` §10 (screens) 섹션 신설 + 본 step 인벤토리 추가

CLAUDE.md "인벤토리 누락 = step 미완".

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
```

- 신규 테스트 모두 통과 + 기존 테스트 깨지지 않음
- snapshot 새로 생성됨 (`__snapshots__/[cityId].test.tsx.snap`)
- TESTING.md §10 에 본 화면 인벤토리 항목 추가

## 검증 절차

1. AC 커맨드 통과
2. 아키텍처 체크:
   - 컴포넌트가 `fetch` 직접 호출 X (반드시 `src/lib/data.ts` 경유)
   - `isHot(mult)` 단일 함수 사용 (CLAUDE.md CRITICAL)
   - 페르소나 `unknown` = student ∪ worker (CLAUDE.md CRITICAL)
   - 매직 색상 X (모두 토큰)
   - silent fail X (에러 명시적 throw / ErrorView)
3. `phases/screens/index.json` step 0 status `completed` + summary

## 금지사항

- 컴포넌트에서 직접 `fetch` 호출 금지. 이유: ARCHITECTURE.md / ADR-029 의 데이터 캐시·재시도·fallback 일관성을 깬다.
- 페르소나 `unknown` 을 student 와 worker 의 합집합 외로 매핑 금지. 이유: CLAUDE.md CRITICAL.
- 매직 색상 hex 직접 사용 금지. 이유: 토큰 단일 출처 정책.
- silent catch 금지. 이유: ADR-014.
- 본 step 에서 Detail / Home / Settings / Onboarding 구현 금지. 이유: 후속 step 의 작업 범위.
- 도시 picker 추가 금지. 이유: ADR-038.
