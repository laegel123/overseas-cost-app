# Step 0: infra

`scripts/refresh/` 공통 헬퍼 + `scripts/build_data.mjs` + `scripts/validate_cities.mjs` + 테스트 환경 구성. 모든 후속 step (per-source refresh 스크립트) 의 토대.

## 읽어야 할 파일

- `CLAUDE.md`
- `docs/AUTOMATION.md` §1~3, §6 (변동 검증), §11 (테스트)
- `docs/DATA.md`
- `docs/DATA_SOURCES.md` §0 (데이터 정의 표준), 부록 A
- `docs/TESTING.md` §9-A.0, §9-A.1 (전체)
- `src/types/city.ts` — `CityCostData` 스키마
- `src/lib/citySchema.ts` — `validateCity`
- `src/lib/errors.ts` — 기존 에러 클래스 카탈로그

## 작업

### 1. 공통 헬퍼 — `scripts/refresh/_common.mjs`

```ts
// 표준 인터페이스
export interface RefreshResult {
  source: string;
  cities: string[];
  fields: string[];
  changes: Array<{ cityId: string; field: string; oldValue: number | null; newValue: number | null; pctChange: number }>;
  errors: Array<{ cityId: string; reason: string }>;
}

// fetchWithRetry — exponential backoff 1s/2s/4s, 3회 재시도
export async function fetchWithRetry(url, opts?: { maxRetries?: number; timeoutMs?: number; signal?: AbortSignal }): Promise<Response>;

// readCity / writeCity — atomic write (tmp → rename), sources[] 자동 갱신
export async function readCity(id: string): Promise<CityCostData>;
export async function writeCity(id: string, data: CityCostData, source: { category: string; name: string; url: string }): Promise<void>;

// DATA_DIR (env override) — 기본 'data/cities'. 테스트는 tmp 디렉터리.
```

### 2. 변동 검증 — `scripts/refresh/_outlier.mjs`

```ts
export function classifyChange(oldVal: number | null, newVal: number | null): 'new' | 'commit' | 'pr-update' | 'pr-outlier' | 'pr-removed';
// 정확 경계: <5% commit / [5, 30) pr-update / ≥30 pr-outlier / null 처리 (AUTOMATION.md §6)
// 음수 / NaN 입력 throws (cost 데이터 unsigned)
```

### 3. 변경 추적 — `scripts/refresh/_diff.mjs`

```ts
export function diffCities(oldData: CityCostData, newData: CityCostData): ChangeRecord[];
// 메타 필드 (lastUpdated, sources) 제외. 중첩 필드 dot-path. 배열 (tuition[]) 원소별.
```

### 4. 출처 ↔ 도시 레지스트리 — `scripts/refresh/_registry.mjs`

```ts
// DATA_SOURCES.md 부록 A 의 매핑을 코드화.
export const SOURCE_TO_CITIES: Record<string, string[]>;
// 예: 'kr_molit' → ['seoul'], 'us_bls' → ['nyc', 'la', 'sf', 'seattle', 'boston']
```

### 5. 빌드 — `scripts/build_data.mjs`

- `data/cities/*.json` 21개 → `data/all.json` (원본) + `data/seed/all.json` (앱 시드)
- 스키마 검증 fail 시 throw + 워크플로우 fail
- atomic write

### 6. 검증 — `scripts/validate_cities.mjs`

- `data/cities/*.json` 모두 `validateCity` 통과
- outlier 알림 (직전 commit 대비)
- CLI: `node scripts/validate_cities.mjs` (CI 에서 호출)

### 7. 테스트 환경 — `scripts/refresh/__tests__/_setup.ts`

`docs/TESTING.md §9-A.0` 그대로:

```ts
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-04-28T00:00:00+09:00'));
  process.env.DATA_DIR = path.join(os.tmpdir(), `test-${Date.now()}`);
  fs.cpSync('src/__fixtures__/cities', `${process.env.DATA_DIR}/cities`, { recursive: true });
});
afterEach(() => {
  fs.rmSync(process.env.DATA_DIR!, { recursive: true, force: true });
  jest.useRealTimers();
  jest.restoreAllMocks();
});
```

### 8. 에러 클래스 (필요 시) — `src/lib/errors.ts` 보강

신규: `FetchRetryExhaustedError`, `FetchTimeoutError`, `MissingApiKeyError`, `InvalidCityIdError` (path traversal 차단).

### 9. 테스트

`docs/TESTING.md §9-A.1` 의 모든 케이스 구현. 최소 60+ 케이스.

### 10. 인벤토리

`docs/TESTING.md §9-A.1` 의 `[ ]` → `[x]` 일괄 갱신.

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
node scripts/build_data.mjs   # 기존 시드만 있어도 통과해야 함
node scripts/validate_cities.mjs
```

## 검증 절차

1. AC 통과
2. 체크:
   - `data/cities/` 디렉터리는 비워두되 `scripts/build_data.mjs` 가 시드만으로도 동작
   - 모든 헬퍼는 ESM (`*.mjs`) — Node 20 native ESM
   - `_common.mjs` 의 fetch 는 Node 20 fetch (undici) 사용
3. `phases/data-automation/index.json` step 0 update

## 금지사항

- 실제 외부 API 호출 금지. 이유: 모든 fetch 는 모킹. live 호출은 step 1+ 에서.
- `data/cities/<id>.json` 신규 작성 금지. 이유: 실제 데이터 생성은 후속 step.
- 기존 `src/lib/data.ts` / `currency.ts` 변경 금지. 이유: 본 step 은 인프라만.
- `peter-evans/create-pull-request` 액션 통합 금지. 이유: workflows step 10 에서.
