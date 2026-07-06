# Step 6: settings-refresh-card

Settings 의 페르소나 카드를 **데이터 최신화 카드**로 교체한다. 마지막 동기화 시각 + 새로고침 버튼. 기존 메뉴의 "데이터 새로고침" 행은 카드로 승격하며 제거한다(메뉴 5→4). **새 로직 없음** — 기존 `handleRefresh`/`refreshState`/`formatLastSync` 를 그대로 재사용.

## 읽어야 할 파일

- `docs/plans/persona-removal-city-onboarding.md` §E
- `app/(tabs)/settings.tsx` — 27줄 `PERSONA_*` import, 29줄 `usePersonaStore` import, 46~47줄 selector, 61~64줄 `handleChangePersona`, 101~112줄 `formatLastSync`, 130~162줄 페르소나 카드, 172~181줄 `menu-refresh` MenuRow.
- `src/components/Icon.tsx`(refresh 아이콘), `src/components/typography/Text.tsx`(H3/Tiny).
- `app/(tabs)/__tests__/settings.test.tsx`.

## 작업

### 1. `app/(tabs)/settings.tsx`

- **제거**: 27줄 `PERSONA_*` import, 29줄 `usePersonaStore` import, 46~47줄 `persona`/`setOnboarded` selector, 61~64줄 `handleChangePersona`, 130~162줄 페르소나 카드.
- **신규 카드**(130~162줄 자리, testID `data-refresh-card`): 기존 네이비 히어로 시각(`bg-navy rounded-hero-lg p-hero-pad mb-4`) 재사용.
  - 좌: 오렌지 아이콘 박스(`w-14 h-14 rounded-hero-icon bg-orange items-center justify-center`) + `Icon name="refresh"`.
  - 중: `H3 color="white"` "데이터 최신화" + `Tiny color="white"` `opacity-70` 에 `formatLastSync()`(기존 함수 그대로 — loading/error/null/날짜 처리됨).
  - 우: `Pressable` testID `data-refresh-btn` → `onPress={handleRefresh}`, `disabled={refreshState === 'loading'}`, `accessibilityRole="button"`, `accessibilityLabel="데이터 새로고침"`.
- **`menu-refresh` 제거**: 172~181줄 "데이터 새로고침" `MenuRow` 삭제 → 메뉴 4개(sources/feedback/privacy/app-info). `handleRefresh`/`refreshState`/`formatLastSync`/`useSettingsStore` wiring 은 카드가 그대로 재사용(신규 로직 없음).

### 2. 테스트 `app/(tabs)/__tests__/settings.test.tsx`

- 페르소나/변경버튼 describe 삭제.
- 데이터 최신화 카드 describe 추가: `data-refresh-card` 렌더, `data-refresh-btn` 탭 → `handleRefresh`(refreshCache mock), loading 시 disabled, `formatLastSync` 표시(loading/error/null/날짜).
- 메뉴 5→4 반영(`menu-refresh` 참조 제거).
- 스냅샷 target `persona-card` → `data-refresh-card`.

### 3. 인벤토리

`docs/TESTING.md` §7/§9(settings)의 페르소나 카드 항목 → 데이터 최신화 카드로 갱신.

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
npx jest "app/(tabs)/__tests__/settings.test.tsx"
```

## 검증 절차

1. AC 통과.
2. 체크:
   - settings 에 `usePersonaStore`/`PERSONA_*` 참조 0.
   - `data-refresh-card` + `data-refresh-btn` 존재, `menu-refresh` 제거(메뉴 4행).
   - 마지막 동기화 표시가 카드 한 곳(중복 없음).
3. `phases/persona-removal/index.json` step 6 → `completed`, summary 에 "menu-refresh testID → data-refresh-btn 로 승격(E2E 재조준은 step 8)" 명시.

## 금지사항

- 마지막 동기화 시각을 카드와 메뉴 양쪽에 두지 마라. 이유: 정보 중복.
- `handleRefresh` 로직을 새로 작성하지 마라. 이유: 기존 함수 재사용(회귀 위험).
- `lib/persona.ts` 를 아직 삭제하지 마라(step 7). 단 settings 의 `PERSONA_*` import 는 제거한다.
- 기존 테스트를 깨뜨리지 마라.
