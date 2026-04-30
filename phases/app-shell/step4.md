# Step 4: last-sync-bridge

DATA.md §269 의 책임을 구현한다 — `meta:lastSync` (data layer 측 AsyncStorage 메타키) ↔ `useSettingsStore.lastSync` (store 측 영속 상태) 의 단방향 동기화. data layer 가 source of truth, store 는 UI 노출용 mirror.

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL
- `docs/DATA.md` §269 (meta:lastSync ↔ store 동기화는 app-shell 부트로더 책임)
- `docs/ADR.md` ADR-050 (zustand persist `setState` 자동 setItem)
- `src/lib/data.ts` — `META_LAST_SYNC_KEY` (현재 모듈 내부 상수, export 안 됨)
- `src/store/settings.ts` — `useSettingsStore.updateLastSync(date)` 시그니처 (Date | string | null 정규화)
- step 0~3 산출물: `app/_layout.tsx`, ErrorBoundary

## 작업

### 1. `src/lib/data.ts` — `getLastSync()` export 추가

현재 `META_LAST_SYNC_KEY` 는 모듈 사적 상수, `refreshCache()` 만 lastSync 를 반환. 부트로더가 캐시 새로고침 없이도 메타키를 읽을 수 있어야 한다.

```ts
/**
 * AsyncStorage 의 meta:lastSync 를 반환. 캐시 새로고침을 트리거하지 않는다.
 * 부트로더가 store 동기화에 사용 (app-shell phase / DATA.md §269).
 *
 * @returns ISO string 또는 null (메타키 없음 = 콜드스타트 또는 시드 fallback 상태)
 */
export async function getLastSync(): Promise<string | null>;
```

구현은 `AsyncStorage.getItem(META_LAST_SYNC_KEY)` 한 줄. 손상 / IO 에러는 catch → null 반환 (silent fail 아님 — `__DEV__` 콘솔 로그 + null 로 안전 fallback).

### 2. `src/lib/index.ts` re-export 추가

```ts
export { loadAllCities, getCity, refreshCache, getLastSync } from './data';
```

### 3. 동기화 헬퍼 — `app/_layout.tsx` 내부 또는 별도 모듈

가능하면 별도 모듈로 분리해 테스트 용이:

```ts
// src/store/lastSyncBridge.ts
import { getLastSync } from '@/lib';
import { useSettingsStore } from '@/store/settings';

/**
 * meta:lastSync (data layer 측) → useSettingsStore.lastSync (store 측) 단방향 sync.
 * data layer 가 source of truth — store 값이 다르면 store 를 갱신.
 *
 * 부트로더가 store hydration 완료 후 1회 호출.
 *
 * 양방향 sync 가 아닌 이유:
 *   - data layer 의 saveCacheEntry / refreshFx 가 메타키를 갱신 → store 가 그 결과를 반영.
 *   - store → data 방향은 모순 (사용자가 store 의 lastSync 를 직접 편집할 일 없음).
 */
export async function bridgeLastSyncFromMeta(): Promise<void>;
```

구현 윤곽:

```ts
const meta = await getLastSync();
const current = useSettingsStore.getState().lastSync;
if (meta !== current) {
  useSettingsStore.getState().updateLastSync(meta);
}
```

`updateLastSync` 가 `Date | string | null` 모두 받으므로 별도 변환 불필요 (string | null → 그대로 전달).

### 4. `app/_layout.tsx` 부트로더에 통합

step 1 의 `waitForStoresOrTimeout` 완료 후 (ok 든 timeout 이든) 1회 호출:

```ts
useEffect(() => {
  if (!storesHydrated) return;
  bridgeLastSyncFromMeta().catch((e) => {
    if (__DEV__) console.error('[app-shell] lastSync bridge failed:', e);
  });
}, [storesHydrated]);
```

라우팅 redirect (step 2) 와는 독립 — bridge 완료를 기다리지 않음 (UI 차단 회피, 새로고침 후 다음 부팅에 자연 반영).

### 5. 테스트

#### `src/lib/__tests__/data.lastSync.test.ts` (또는 기존 data 테스트 확장)

- `getLastSync()` 가 `meta:lastSync` 키를 정확히 읽음
- 메타키 없음 → null 반환
- AsyncStorage IO 에러 → null 반환 + DEV 콘솔 로그

#### `src/store/__tests__/lastSyncBridge.test.ts` (신규)

- meta = ISO string, store = null → store 갱신
- meta = null, store = ISO string → store null 로 갱신 (data layer 가 source of truth)
- meta === store → no-op (불필요한 setState 방지)
- `getLastSync` 가 throw → bridge 가 throw 를 propagate (caller 가 dev 로그 처리)

#### `app/__tests__/_layout.test.tsx` 확장

- `storesHydrated === true` 진입 후 `bridgeLastSyncFromMeta` 1회 호출
- bridge 실패는 부팅 흐름 차단하지 않음 (`router.replace` 정상 진행)

### 6. TESTING.md 인벤토리

§lib data 부분에 `getLastSync` 항목 추가, §store 부분에 `lastSyncBridge` 신규 section 추가.

### 7. ADR — 본 step 단독 결정 (선택)

bridge 의 단방향 정책이 비자명하면 짧게 ADR-N 추가:
- "ADR-N: lastSync 동기화 = data layer (meta:lastSync) → store 단방향. store 는 UI 노출용 mirror."

DATA.md §269 가 이미 이 정책을 명시하면 ADR 추가 불필요.

## Acceptance Criteria

```bash
npm run typecheck \
  && npm run lint \
  && npm test
```

- typecheck / lint 통과
- 신규 케이스 — `getLastSync` 3+, `lastSyncBridge` 4+, RootLayout bridge 통합 2+
- 기존 lib / store / step0~3 회귀 없음
- coverage threshold (lib, store) 유지
- 변경 파일:
  - 신규: `src/store/lastSyncBridge.ts`, `src/store/__tests__/lastSyncBridge.test.ts`
  - 수정: `src/lib/data.ts` (`getLastSync` export), `src/lib/index.ts`, `app/_layout.tsx`, `app/__tests__/_layout.test.tsx`, `docs/TESTING.md`
- (선택) `docs/ADR.md` 새 ADR

## 검증 절차

1. AC 명령 실행
2. 체크리스트:
   - 단방향 — data → store 만, 역방향 코드 없음?
   - meta === store 일 때 setState 호출 안 함? (불필요한 persist write 방지)
   - bridge 실패가 부팅을 막지 않음?
   - silent fail 아님 — IO 에러는 dev 콘솔 로그?
3. `phases/app-shell/index.json` step 4 → completed
4. `phases/index.json` 의 `app-shell` → completed
5. phase 전체 summary 작성

## 금지사항

- **store → data 역방향 sync 금지.** 이유: data layer 가 source of truth (DATA.md §269). 역방향은 정합성 충돌 위험.
- **부트 단계 차단 금지.** 이유: bridge 실패가 splash 무한 대기를 유발하면 ADR-052 와 동일한 hang. 비차단 best-effort 가 올바른 정책.
- **`META_LAST_SYNC_KEY` 상수 직접 export 금지.** 이유: AsyncStorage 키 카탈로그는 DATA.md §13.5.1 단일 출처. 외부 노출은 함수 (`getLastSync`) 만.
- **`updateLastSync` 외 store 액션으로 lastSync 변경 금지.** 이유: settings store 의 정규화 로직 (Date / string / null) 우회 위험.
- **silent fail 금지.** 이유: CLAUDE.md CRITICAL. catch 분기는 반드시 dev 콘솔 로그.
- 기존 테스트 깨뜨리지 마라.
