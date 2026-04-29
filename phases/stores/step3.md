# Step 3: settings-store

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL
- `docs/ARCHITECTURE.md` §상태 관리 (`useSettingsStore` 행 — `lastSync: ISOString | null`)
- `docs/PRD.md` §F5 설정 + §F6 데이터 갱신 ("마지막 업데이트 일자 + 수동 새로고침")
- `docs/DATA.md` §6.6 캐시 키 (`meta:lastSync` AsyncStorage 메타키)
- `docs/TESTING.md` §9.8 (`src/store/settings.ts` 매트릭스 — 5 케이스)
- `src/lib/data.ts` — `refreshCache()` 가 `meta:lastSync` 메타키를 어떻게 갱신하는지 참조
- step 0, 1, 2 산출물

## 작업

이 step 은 **설정 store + 데이터 새로고침 메타** 만 만든다. 설정 화면 UI 는 후속 phase 책임.

### 1. `src/store/settings.ts` 신규 작성

```ts
export type SettingsState = {
  lastSync: string | null;     // ISO datetime, data.ts 의 meta:lastSync 와 동일 정보
};

export type SettingsActions = {
  updateLastSync: (date: Date | string | null) => void;
  reset: () => void;
};

export const useSettingsStore = /* create<...>(persist(...)) */;
```

### 2. 정책

- **초기:** `{ lastSync: null }`
- **`updateLastSync(date)`:**
  - `Date` 입력 → `date.toISOString()` 저장
  - `string` 입력 → ISO 형식 검증 (간단 regex `/^\d{4}-\d{2}-\d{2}T/`) 후 그대로 저장. 위반 시 silent (TESTING §9.8 없는 케이스, 정책: 들어오는 string 은 호출자 책임으로 trust). 또는 `Date(string).toISOString()` 으로 정규화 — **본 step 은 Date(string).toISOString() 정규화 채택** (drift 방지).
  - `null` 입력 → `lastSync: null` (clear)
- **persist:** key `settings:v1`.
- **reset():** `lastSync: null`.

### 3. data.ts 의 `meta:lastSync` 와의 관계

`src/lib/data.ts` 의 `saveCacheEntry` 가 AsyncStorage 메타키 `meta:lastSync` 를 직접 갱신함. `useSettingsStore` 의 `lastSync` 와 정보 중복.

**정책:**
- `useSettingsStore.lastSync` 는 **React 컴포넌트의 reactive 표시용** (설정 화면 등).
- `meta:lastSync` AsyncStorage 키는 **lib 레벨의 진실 원천** — 부트로더 / refreshCache 가 직접 씀.
- 본 step 은 두 값을 동기화하는 hook 또는 effect 를 만들지 **않는다** — app-shell phase 가 부트 시 `meta:lastSync` 를 읽어 `updateLastSync` 호출하는 패턴으로 통합.
- 현 phase 에서는 store 만 만들고, 화면이 직접 `updateLastSync(new Date())` 호출하는 패턴.

### 4. 테스트 — `src/store/__tests__/settings.test.ts`

TESTING §9.8 매트릭스:

- 초기 `lastSync: null`
- `updateLastSync(new Date('2026-04-29T00:00:00Z'))` → ISO 문자열로 저장 (`'2026-04-29T00:00:00.000Z'`)
- `updateLastSync(null)`: 정책 — clear (`lastSync: null`)
- persist round-trip — updateLastSync → reload → 같은 값
- hydration 후 null 이 아닌 값 (저장돼 있던 값 그대로 복원)

**보강:**
- `updateLastSync('2026-04-29T00:00:00.000Z')` 문자열 입력 → `Date(...).toISOString()` 정규화 결과 저장
- `reset()` → null

### 5. `src/store/index.ts` 갱신

```ts
export { useSettingsStore } from './settings';
export type { SettingsState, SettingsActions } from './settings';
```

### 6. 문서

- TESTING.md §9.8 시그니처 정합성 — `updateLastSync` 의 입력 타입 (`Date | string | null`) 이 추가됐으면 §9.8 보강.
- DATA.md §6.6 의 메타키 행에 "settings store 의 lastSync 와 동기화는 app-shell phase 책임" 한 줄 추가.

## Acceptance Criteria

```bash
npm run typecheck \
  && npm run lint \
  && npm test -- src/store/__tests__/persona.test.ts src/store/__tests__/favorites.test.ts src/store/__tests__/recent.test.ts src/store/__tests__/settings.test.ts
```

- typecheck / lint 통과
- settings.test.ts ~7 케이스 통과 + 회귀 없음
- 새 파일: `src/store/settings.ts`, `src/store/__tests__/settings.test.ts`
- 수정 파일: `src/store/index.ts`, `docs/DATA.md` (한 줄 한정)

## 검증 절차

1. AC 명령 실행
2. **체크리스트:**
   - persist key 가 정확히 `settings:v1`?
   - `updateLastSync` 가 Date / string / null 모두 올바르게 처리?
   - ISO 정규화 정확 (Date.toISOString)?
   - `any` 0건?
3. step 3 status update + summary

## 금지사항

- **`useSettingsStore.lastSync` 와 `meta:lastSync` 를 자동 동기화 하지 마라.** 이유: app-shell phase 의 부트로더 책임. 본 store 는 store 만.
- **다른 설정 필드 추가 금지** (예: theme, language). 이유: ARCHITECTURE 가 lastSync 만 명시. v1.x 이후 추가는 별도 ADR.
- **`refreshCache()` import 금지.** 이유: store 는 lib 의존 없음 (theme/types 외). 호출은 화면 단에서 lib 를 직접 import.
- **잘못된 ISO 입력 시 throw 금지.** 이유: 호출자 (UI) 책임. silent normalize 또는 무시.
- 기존 테스트 깨뜨리지 마라.
