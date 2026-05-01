# Step 3: settings

Settings 화면 — 페르소나 표시 + 사용 통계 + 메뉴.

`app/(tabs)/settings.tsx` placeholder 를 실제 구현으로 교체.

## 읽어야 할 파일

- `CLAUDE.md`
- `docs/PRD.md` — Settings 화면 요구사항
- `docs/design/README.md` §5 (Settings)
- `docs/UI_GUIDE.md` §Settings + §설정 메뉴 정확 매핑
- `docs/ARCHITECTURE.md`
- `docs/TESTING.md` §10
- `docs/ADR.md` ADR-021 (피드백 채널 — 메일 단일), ADR-025 (데이터 책임 한계)
- 데이터·스토어:
  - `src/lib/data.ts` — `getAllCities` (도시 DB count)
  - `src/lib/currency.ts` — `refreshFx` (새로고침 시 환율 같이)
  - `src/lib/format.ts` — `formatDate`, `formatRelativeDate`
  - `src/store/persona.ts` / `favorites.ts` / `recent.ts` / `settings.ts`
- 컴포넌트:
  - `Screen`, `Icon`, `MenuRow`
  - typography (`H1`, `H3`, `Body`, `Small`, `Tiny`)

## 작업

### 1. `app/(tabs)/settings.tsx`

- Layout (Screen scroll=true):
  - **Header**: `설정` (H1) + more icon (v1.0 stub)
  - **Persona card (navy gradient)**:
    - `linear-gradient` — RN 에서는 `expo-linear-gradient` 사용 (이미 deps?). 미설치 시 ADR 추가 + install. 또는 단색 fallback (`bg-navy`) — **결정: 단색 fallback** (v1.0, ADR 회피, design/README §5 의 gradient 는 시각 enhancement)
    - 좌측 아이콘 박스 56×56 orange 18px 라운드 + 페르소나 아이콘 (`student → graduation`, `worker → briefcase`, `unknown → lightbulb` 등 — IconName 매핑)
    - 가운데: `${personaLabel} 모드` (H3 white extrabold) + sub (`서울에서 출발 · 학비 중심` 등, Tiny opacity 0.7)
    - 우측 `변경` 버튼 — 탭 시 `setOnboarded(false)` + `router.replace('/onboarding')`
  - **Stat cards (3개, flex row gap 8)**:
    - `${favorites.length} 즐겨찾기` / `${recent.length} 최근 본` / `${cities.length} 도시 DB`
    - 각 카드 padding 14, border-radius 16, center align. 큰 숫자 H1 orange + 라벨 Tiny
  - **Menu list (single card group)** — `MenuRow` 5개 (UI_GUIDE.md §설정 메뉴 정확 매핑 표 따름):
    - `데이터 새로고침` (refresh, hot variant orange, 우측 lastSync 또는 `방금`) — 탭 시 `refreshCache()` + `refreshFx()` + 토스트 (또는 inline 갱신 텍스트)
    - `데이터 출처 보기` (book, default, 우측 `${sourcesCount}개`) — 탭 시 v1.0 stub (외부 링크 또는 modal 미구현 — `Linking.openURL('docs/DATA_SOURCES.md GitHub URL')`)
    - `피드백 보내기` (mail, default) — 탭 시 `Linking.openURL('mailto:laegel1@gmail.com?subject=...')` (ADR-021)
    - `개인정보 처리방침` (shield, default) — 탭 시 외부 링크 (URL 결정 — 일단 v1.0 placeholder URL OK, ADR-025 명시)
    - `앱 정보` (info, dim variant, isLast=true, 우측 `v1.0.0` from `expo-application` 또는 `expo-constants`)
  - **Footer**: `Made with ♥ in Seoul · 2026` Tiny center

### 2. 페르소나 라벨 매핑

```ts
const PERSONA_LABEL: Record<Persona, string> = {
  student: '유학생', worker: '취업자', unknown: '미선택',
};
const PERSONA_SUB: Record<Persona, string> = {
  student: '서울에서 출발 · 학비 중심',
  worker: '서울에서 출발 · 실수령 중심',
  unknown: '둘 다 보여드려요',
};
```

UI_GUIDE.md §i18n 카탈로그에 이미 명시 — 단일 출처 (`src/i18n/persona.ko.ts` 또는 `src/lib/persona.ts` 신설 결정).

### 3. 데이터 새로고침 동작

- `refreshCache()` (cities) + `refreshFx()` (환율) 병렬
- 진행 상태 표기 (옵션): MenuRow 의 우측 텍스트가 `갱신 중...` 으로 일시 변경
- 실패 시 inline 배지 (`갱신 실패 · 재시도` orange)

### 4. 테스트 (`app/(tabs)/__tests__/settings.test.tsx`)

- 페르소나 3 분기 라벨 / sub
- 통계 카드 0건 / N건
- 메뉴 5개 모두 mount + 라벨 일치
- `데이터 새로고침` 탭 → `refreshCache` + `refreshFx` 호출 (모킹)
- `변경` 버튼 → `setOnboarded(false)` + `router.replace('/onboarding')` 검증
- snapshot 1 케이스 (worker 페르소나 + 통계 비어있음)

### 5. `docs/TESTING.md` §10 인벤토리 추가

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
```

## 검증 절차

1. AC 통과
2. 체크:
   - fetch 직접 호출 X (`refreshCache` / `refreshFx` 경유)
   - 매직 색상 X
   - 페르소나 라벨 단일 출처
   - 모든 외부 링크는 `Linking.openURL`
3. `phases/screens/index.json` step 3 update

## 금지사항

- gradient 도입 위해 `expo-linear-gradient` 신규 install 금지 (본 step). 이유: 단색 fallback 결정. 추후 ADR + 별 PR 로 도입.
- `mailto` 외 다른 피드백 채널 (Slack / form) 금지. 이유: ADR-021.
- 페르소나 라벨을 컴포넌트에 하드코딩 금지. 이유: 단일 출처 정책 (UI_GUIDE i18n 카탈로그).
- 데이터 새로고침 실패 시 silent 처리 금지 (inline 배지 / 토스트). 이유: ADR-014.
