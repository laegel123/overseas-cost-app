# 데이터 자동화 인프라

해외 생활비 비교 앱의 데이터는 **공공 출처에서 자동으로 갱신**된다 (ADR-031, ADR-032). 본 문서는 GitHub Actions cron + per-source fetch 스크립트의 인프라·스케줄·시크릿·에러 처리·테스트를 명세한다.

수동 큐레이션은 **금지**(ADR-028 supersede). 모든 데이터 변경은 자동 PR 또는 자동 commit 으로만 발생.

## 1. 인프라 개요

```
GitHub Actions (cron schedule)
  ├─ refresh-fx        (일 1회)       — 환율
  ├─ refresh-prices    (주 1회)       — 식재료·외식 CPI
  ├─ refresh-rent      (월 1회)       — 임차료 통계
  ├─ refresh-transit   (분기 1회)     — 교통공사 fare
  ├─ refresh-tuition   (분기 1회)     — 대학 학비
  └─ refresh-visa      (분기 1회)     — 비자 fee

각 워크플로우:
  1. checkout repo
  2. install Node deps
  3. run scripts/refresh/<source>.mjs (각 source 별 fetch + transform)
  4. validate (schema + outlier detection)
  5. write data/cities/<id>.json (변경분만)
  6. run npm run build:data → data/all.json + data/seed/all.json
  7. 변동 폭 ≤5%: 자동 commit + push
  8. 변동 폭 5~30%: 자동 PR + auto-update 라벨
  9. 변동 폭 >30%: 자동 PR + outlier 🚨 라벨
  10. 실패: 워크플로우 fail → GitHub 기본 알림 (운영자 이메일)
```

호스팅: GitHub Actions (public repo 무료, 사실상 무제한). 외부 비용 0원.

## 2. 디렉터리 구조

```
.github/workflows/
  ├── refresh-fx.yml
  ├── refresh-prices.yml
  ├── refresh-rent.yml
  ├── refresh-transit.yml
  ├── refresh-tuition.yml
  └── refresh-visa.yml

scripts/refresh/
  ├── _common.mjs         # 공통 헬퍼 (fetch, retry, validation, commit logic)
  ├── _outlier.mjs        # 변동 폭 검증 + iterNumericFields
  ├── _diff.mjs           # 직전 분기 대비 비교
  ├── _registry.mjs       # 도시 ↔ 출처 매핑 (DATA_SOURCES.md 의 코드화)
  ├── _cities.mjs         # 20개 해외 도시 공통 메타 (visas / universities 단일 출처)
  ├── _run.mjs            # CLI wrapper — 모든 fetcher default export 를 호출 + path traversal 방어
  │
  ├── kr_molit.mjs        # 한국 국토부 실거래가 (임차료)
  ├── kr_kca.mjs          # 한국소비자원 참가격 (식재료)
  ├── kr_kosis.mjs        # 통계청 외식·교통 CPI
  ├── kr_seoul_metro.mjs  # 서울교통공사 fare
  │
  ├── ca_cmhc.mjs         # 캐나다 임차료
  ├── ca_statcan.mjs      # 캐나다 CPI (식재료·외식)
  ├── ca_translink.mjs    # TransLink fare
  ├── ca_ttc.mjs          # TTC fare
  ├── ca_stm.mjs          # STM fare
  │
  ├── us_hud.mjs          # 미국 HUD FMR (임차료)
  ├── us_census.mjs       # 미국 Census ACS (median rent)
  ├── us_bls.mjs          # 미국 BLS (식재료·외식 CPI by region)
  ├── us_transit.mjs      # MTA/LA Metro/SFMTA/King County/MBTA fare
  │
  ├── uk_ons.mjs          # 영국 ONS (임차료·CPI)
  ├── uk_tfl.mjs          # TfL fare API
  │
  ├── de_destatis.mjs     # 독일 통계청 (임차료·CPI)
  ├── de_transit.mjs      # BVG/MVV fare
  │
  ├── fr_insee.mjs        # 프랑스 INSEE
  ├── fr_ratp.mjs         # RATP fare
  │
  ├── nl_cbs.mjs          # 네덜란드 CBS
  ├── nl_gvb.mjs          # GVB fare
  │
  ├── au_abs.mjs          # 호주 ABS
  ├── au_transit.mjs      # Transport NSW + PTV fare
  │
  ├── jp_estat.mjs        # 일본 e-Stat (임차료·CPI)
  ├── jp_transit.mjs      # 도쿄메트로 + 大阪Metro fare
  │
  ├── sg_singstat.mjs     # 싱가포르 SingStat
  ├── sg_lta.mjs          # LTA fare
  │
  ├── vn_gso.mjs          # 베트남 GSO (입자도 한계)
  │
  ├── ae_fcsc.mjs         # UAE FCSC + DSC
  ├── ae_rta.mjs          # RTA Dubai fare
  │
  ├── eu_eurostat.mjs     # EU Eurostat fallback (입자도 보조)
  │
  ├── universities.mjs    # 대학 학비 (각 대학 공식 page fetch)
  └── visas.mjs           # 비자 fee (정부 page fetch)

scripts/
  ├── build_data.mjs      # data/cities/*.json → data/all.json + data/seed/all.json
  └── validate_cities.mjs # 스키마 + outlier 검증
```

## 3. 스크립트 표준 인터페이스

모든 `scripts/refresh/<source>.mjs` 는 동일 인터페이스:

```ts
// scripts/refresh/_types.d.ts
export interface RefreshResult {
  source: string; // 'kr_molit'
  cities: string[]; // 영향받은 도시 id 목록
  fields: string[]; // 영향받은 필드 (예: 'rent.oneBed')
  changes: Array<{
    cityId: string;
    field: string;
    oldValue: number | null;
    newValue: number | null;
    pctChange: number; // 변동률 (0.05 = 5%)
  }>;
  errors: Array<{ cityId: string; reason: string }>;
}

// 모든 스크립트 default export:
export default async function refresh(): Promise<RefreshResult>;
```

공통 헬퍼 (`_common.mjs` / `_outlier.mjs`):

```ts
// _common.mjs
export async function fetchWithRetry(url, opts?): Promise<Response>; // exponential backoff 3회
export async function readCity(id): Promise<CityCostData>;
export async function writeCity(id, data, source): Promise<void>; // sources 자동 갱신

// _outlier.mjs — classifyChange 는 oldVal/newVal 두 인자를 받아 분기 분류
export function classifyChange(
  oldVal: number | null,
  newVal: number | null,
): 'new' | 'commit' | 'pr-update' | 'pr-outlier' | 'pr-removed';
```

## 4. 워크플로우 명세

### 4.1 `refresh-prices.yml` — 주 1회

```yaml
name: Refresh Prices (food + dining)
on:
  schedule:
    - cron: '0 18 * * 1'  # 매주 월요일 18:00 KST (= 09:00 UTC)
  workflow_dispatch:
permissions:
  contents: write
  pull-requests: write
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: node scripts/refresh/kr_kca.mjs
        env: { KR_DATA_API_KEY: ${{ secrets.KR_DATA_API_KEY }} }
      - run: node scripts/refresh/us_bls.mjs
        env: { US_BLS_API_KEY: ${{ secrets.US_BLS_API_KEY }} }
      - run: node scripts/refresh/uk_ons.mjs
      - run: node scripts/refresh/de_destatis.mjs
      - run: node scripts/refresh/fr_insee.mjs
      - run: node scripts/refresh/nl_cbs.mjs
      - run: node scripts/refresh/au_abs.mjs
      - run: node scripts/refresh/jp_estat.mjs
        env: { JP_ESTAT_APP_ID: ${{ secrets.JP_ESTAT_APP_ID }} }
      - run: node scripts/refresh/sg_singstat.mjs
      - run: node scripts/refresh/vn_gso.mjs
      - run: node scripts/refresh/ae_fcsc.mjs
      - run: node scripts/refresh/ca_statcan.mjs
      - run: node scripts/build_data.mjs
      - run: node scripts/validate_cities.mjs
      - uses: peter-evans/create-pull-request@v6
        if: ${{ env.HAS_OUTLIERS == 'true' }}
        with:
          commit-message: 'data: weekly prices refresh (outliers)'
          branch: auto/refresh-prices-${{ github.run_id }}
          title: 'data: weekly prices refresh — review needed'
          labels: outlier
      - run: git push
        if: ${{ env.HAS_OUTLIERS != 'true' }}
```

### 4.2 `refresh-rent.yml` — 월 1회

```yaml
name: Refresh Rent
on:
  schedule:
    - cron: '0 18 1 * *' # 매월 1일 18:00 KST
  workflow_dispatch:
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - ... (위와 유사)
      - run: node scripts/refresh/kr_molit.mjs
      - run: node scripts/refresh/ca_cmhc.mjs
      - run: node scripts/refresh/us_hud.mjs
      - run: node scripts/refresh/us_census.mjs
      - run: node scripts/refresh/uk_ons.mjs # rent dataset
      - run: node scripts/refresh/de_destatis.mjs
      - run: node scripts/refresh/fr_insee.mjs
      - run: node scripts/refresh/nl_cbs.mjs
      - run: node scripts/refresh/au_abs.mjs
      - run: node scripts/refresh/jp_estat.mjs
      - run: node scripts/refresh/sg_singstat.mjs
      - ...
```

### 4.3 `refresh-transit.yml` — 분기 1회

> **호치민(VN) transit 은 본 워크플로우에서 갱신되지 않음 — 의도적**. `vn_gso.mjs` 가 rent + food + transport 통합형이라 같은 도시 파일을 1회 writeCity 로 갱신해야 하므로, 호치민 transport 는 분기 transit 이 아니라 월간 `refresh-rent.yml` 의 `vn_gso` step 에서 함께 갱신된다. 결과적으로 호치민 transport 는 다른 도시(분기)보다 자주 (월) 갱신될 수 있으나 정적 추정치 변동이 거의 없어 실질 영향은 0.

```yaml
name: Refresh Transit
on:
  schedule:
    - cron: '0 18 1 1,4,7,10 *' # 분기 첫 달 1일
  workflow_dispatch:
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - ... (위와 유사)
      - run: node scripts/refresh/kr_seoul_metro.mjs
      - run: node scripts/refresh/ca_translink.mjs
      - run: node scripts/refresh/ca_ttc.mjs
      - run: node scripts/refresh/ca_stm.mjs
      - run: node scripts/refresh/us_transit.mjs
      - run: node scripts/refresh/uk_tfl.mjs
      - run: node scripts/refresh/de_transit.mjs
      - run: node scripts/refresh/fr_ratp.mjs
      - run: node scripts/refresh/nl_gvb.mjs
      - run: node scripts/refresh/au_transit.mjs
      - run: node scripts/refresh/jp_transit.mjs
      - run: node scripts/refresh/sg_lta.mjs
      - run: node scripts/refresh/ae_rta.mjs
      - ...
```

### 4.4 `refresh-tuition.yml` — 분기 1회

> **v1.0 한계**: `universities.mjs` 는 페이지 reachability 만 확인하고 HTML 파싱은 미구현 — 모든 대학이 항상 `UNIVERSITY_REGISTRY.staticAnnual` 을 반환한다. 결과적으로 `data/cities/*.json` 의 `tuition[].annual` 변동이 발생하지 않으며, `detect_outliers` 의 `outlier`/`update` PR 분기는 본 워크플로우에서 절대 트리거되지 않고 직접 commit (변경 0) 으로 종료된다. 학교별 selector 도입은 v1.x 별도 phase.


```yaml
name: Refresh Tuition
on:
  schedule:
    - cron: '0 18 15 1,4,7,10 *' # 분기 첫 달 15일
  workflow_dispatch:
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - ... (위와 유사)
      - run: node scripts/refresh/universities.mjs
      - ... (build + commit/PR)
```

### 4.5 `refresh-visa.yml` — 분기 1회

> **v1.0 한계**: `visas.mjs` 도 동일 — 정부 비자 페이지 reachability 만 확인하고 HTML 파싱은 미구현 (`VISA_REGISTRY` 의 static 값 항상 반환). `outlier`/`update` PR 분기 트리거 0. 국가별 selector 도입은 v1.x 별도 phase.


```yaml
name: Refresh Visa
on:
  schedule:
    - cron: '0 18 20 1,4,7,10 *' # 분기 첫 달 20일
  workflow_dispatch:
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - ... (위와 유사)
      - run: node scripts/refresh/visas.mjs
      - ... (build + commit/PR)
```

### 4.5b 워크플로우 동시성 (concurrency)

각 워크플로우는 **카테고리별 고유** concurrency group 을 사용한다 — 같은 카테고리의 동시 실행은 직렬화하지만 카테고리 간에는 병렬 실행을 허용해 처리량을 올린다. 카테고리 간 git push race 는 push retry 루프 (`git rebase --abort` → `git pull --rebase` → `git push` 3회) 가 흡수한다.

```yaml
concurrency:
  # refresh-fx.yml
  group: data-refresh-fx-${{ github.ref }}
  # refresh-prices.yml
  group: data-refresh-prices-${{ github.ref }}
  # refresh-rent / refresh-transit / refresh-tuition / refresh-visa 도 카테고리별 고유 group
  cancel-in-progress: false
```

- `cancel-in-progress: false` — 같은 카테고리의 진행 중 워크플로우 완료까지 대기 (취소 X, 큐잉). 부분 실행으로 인한 데이터 불완전 갱신 차단.
- 카테고리별 고유 group: fx / prices / rent / transit / tuition / visa 가 같은 ref 에서도 병렬 실행 가능. 운영자 관점 "월요일 아침에 prices · transit 동시 실행" 같은 시나리오 정상.
- 카테고리 간 push race: 두 카테고리가 같은 push 윈도우에 들어오면 push retry 가 fast-forward 충돌을 처리. `integration.test.ts` 가 push retry 패턴을 회귀 검증.

### 4.5c API 키 부재 시 처리

PR 환경 (fork 의 PR 등) 에서 secrets 노출 안 됨:

```yaml
- name: Skip if API key absent
  if: ${{ env.KR_DATA_API_KEY == '' }}
  run: |
    echo "::warning::KR_DATA_API_KEY not set, skipping kr_molit.mjs"
    exit 0
- run: node scripts/refresh/kr_molit.mjs
  env: { KR_DATA_API_KEY: ${{ secrets.KR_DATA_API_KEY }} }
```

- 키 없는 source 는 **skip + warning** (워크플로우 fail 안 함)
- main branch 의 scheduled trigger 에서는 secrets 항상 가용

### 4.6 `refresh-fx.yml` — 일 1회 (백업)

클라이언트가 일별 fetch 하지만, GitHub Actions 도 백업으로 fallback 값 갱신:

```yaml
name: Refresh FX (backup)
on:
  schedule:
    - cron: '0 0 * * *' # 매일 00:00 UTC
  workflow_dispatch:
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - ...
      - run: node scripts/refresh/fx_backup.mjs
        # data/fx_fallback.json 갱신 — 한국은행 환율 (3차 fallback)
```

## 5. API Keys / Secrets

GitHub Actions Secrets 로 관리. 무료 키들이라 비용 0.

| Secret              | 출처                              | 발급                                                     |
| ------------------- | --------------------------------- | -------------------------------------------------------- |
| `KR_DATA_API_KEY`   | 공공데이터포털 (KOSIS·국토부·KCA) | https://www.data.go.kr — 무료, 즉시                      |
| `US_BLS_API_KEY`    | US BLS API                        | https://www.bls.gov/developers/ — 무료, 이메일 인증      |
| `US_CENSUS_API_KEY` | US Census                         | https://api.census.gov/data/key_signup.html — 무료, 즉시 |
| `JP_ESTAT_APP_ID`   | 일본 e-Stat                       | https://www.e-stat.go.jp/api/ — 무료, 가입               |
| `SG_DATA_GOV_KEY`   | data.gov.sg                       | https://data.gov.sg — 일부 dataset 키 필요               |

대부분의 EU·캐나다·호주·UK 통계 API 는 키 불필요.

Local development:

- `.env.local` 에 동일 키 (gitignore)
- `dotenv` 로 로드

## 6. 변동 검증 정책

`scripts/refresh/_outlier.mjs`:

```ts
export function classifyChange(
  oldVal: number | null,
  newVal: number | null,
): 'new' | 'commit' | 'pr-update' | 'pr-outlier' | 'pr-removed' {
  if (oldVal === null && newVal !== null) return 'new'; // 신규 항목 — PR
  if (oldVal !== null && newVal === null) return 'pr-removed'; // 제거 — PR (확인 필요)
  if (oldVal === null && newVal === null) return 'commit'; // 둘 다 null
  const pct = Math.abs((newVal! - oldVal!) / oldVal!);
  if (pct < 0.05) return 'commit'; // <5%: 자동 commit
  if (pct < 0.3) return 'pr-update'; // 5~30%: PR auto-update
  return 'pr-outlier'; // ≥30%: PR outlier 🚨
}
```

PR 자동 생성: `peter-evans/create-pull-request@v6` 액션 사용. 라벨 자동 부여:

- `auto-update`: 5~30% 변동 묶음
- `outlier`: ≥30% 변동 묶음
- `auto-commit-failed`: workflow 실패 (별도 대응)

## 7. 에러 처리·재시도·알림

### 7.1 fetch 실패

- exponential backoff (1s, 2s, 4s) 3회 재시도
- 4회 실패 시 해당 source 스킵 + 워크플로우 결과에 warning
- 다른 source 는 영향 없이 진행 (각 source 독립)

### 7.2 스키마·outlier

- validate fail: 변경 적용 안 함 + 에러 로그 + 워크플로우 fail
- outlier (≥30% 변동): 적용은 하되 PR 생성 + 운영자 검토

### 7.3 알림

- 워크플로우 성공: 알림 없음 (조용한 자동화)
- 워크플로우 fail: GitHub 기본 알림 (운영자 이메일)
- PR 생성: GitHub 기본 알림
- 옵션(v1.x): Slack webhook 또는 Discord 추가

### 7.4 Rate limiting

- 모든 정부 API 는 분당 최대 ~60회 (충분)
- 워크플로우당 source 13개, 각 1~5 호출 → 분당 ~30 호출 → 안전

## 8. 자동화 한계·예외

다음은 자동화로 정확도 보장 어려움 — sources 코멘트에 한계 명시:

| 영역                   | 한계                                                   | 대응                                                                                     |
| ---------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| **호치민 (베트남)**    | GSO 데이터 입자도 거침 (도시별 분리 약함, 영문 미지원) | 기본값 + 분기 1회 운영자 수동 검증 PR                                                    |
| **두바이 학비**        | DSC·FCSC 학비 데이터 부재                              | universities.mjs 가 AUD/Wollongong Dubai 공식 페이지 fetch                               |
| **세금 계산**          | Calculator API 없는 국가 (대부분)                      | 정적 brackets + 각 국가별 calculation 함수. 연 1회 변경 모니터링                         |
| **외식 가격**          | CPI 는 평균값만 — 실제 식당 1끼 매핑 불완전            | CPI 의 "Food away from home" 카테고리 + 도시별 보정 계수 (보정값 자체는 정적, 분기 검토) |
| **호치민·두바이 비자** | 정부 페이지 영문 정보 부족                             | visas.mjs 에 영문 페이지 + 한계 명시                                                     |

이런 예외는 모두 `data/cities/<id>.json` 의 `sources[].name` 에 "추정" 또는 "static" 마커로 표기.

### 8.1 v1.x TODO — 추적 항목

PR #20 round 11 review 에서 확인된 후속 phase 항목. 각 항목은 별도 phase 로 진행되며 ADR 및 인벤토리 갱신 동반.

| 영역 | 현재 상태 | v1.x 계획 |
| --- | --- | --- |
| `eu_eurostat.mjs` fallback wire up | 라이브러리 모듈 골조만 — `de_destatis` / `fr_insee` / `nl_cbs` 어디서도 import 안 됨 | 각 국가 fetcher 가 본 모듈 import 후 응답 실패 시 EU HICP 보정으로 fallback |
| `uk_ons.mjs` ONS 시리즈 ID 검증 | `MM23-CZMP` 등 시리즈가 ONS API 에서 실제 조회 가능한지 미검증 (코드 내 TODO) | 실 호출 검증 + 응답 단위 / scale 보정 + integration test 회귀 |
| `jp_estat.mjs` 응답 단위 wire up | API 호출 후 sample 로깅만, STATIC 보정에 미반영 | 응답 단위 (천엔 vs 엔, 도/현 vs 전국) 검증 + STATIC 대체 |
| `visas.mjs` / `universities.mjs` HTML 파싱 | reachability check 만, 항상 static | 국가별 / 학교별 selector + 단위 정규화 |
| `workflow_dispatch` 브랜치 제한 | 모든 브랜치에서 dispatch 가능 (위험도 낮음) | main 브랜치 보호 규칙 도입 시 dispatch 제한 검토 |
| Eurostat / actionlint CI | 자동화 안 됨 (수동 검증) | actionlint job 추가 |

## 9. 자동화 vs 수동 정책

| 카테고리             | 자동화                         | 빈도     | 한계                                 |
| -------------------- | ------------------------------ | -------- | ------------------------------------ |
| 환율                 | ✅ 클라이언트 자동 + 백업 cron | 일 1회   | —                                    |
| 임차료 (정부 통계)   | ✅                             | 월 1회   | 도시 평균 (동네별 X)                 |
| 식재료 (CPI)         | ✅                             | 주 1회   | 8개 표준 항목 매핑                   |
| 외식 (CPI)           | ✅                             | 주 1회   | 평균값 (식당 1끼 추정)               |
| 교통 (공식 fare)     | ✅                             | 분기 1회 | —                                    |
| 학비 (대학 공식)     | ✅                             | 분기 1회 | 페이지 구조 변경 시 fetch 실패 가능  |
| 비자 (정부 공식)     | ✅                             | 분기 1회 | 동일                                 |
| 세금 (정적 brackets) | ⚠️ 반자동                      | 연 1회   | 각국 brackets 정적 데이터, 연초 갱신 |

**완전 자동화 = 100%.** 운영자는 자동 PR 리뷰만.

## 10. 운영자 부담 (예상)

| 작업                       | 빈도      | 시간              |
| -------------------------- | --------- | ----------------- |
| 자동 PR 리뷰 (auto-update) | 주 ~5건   | ~30분/주          |
| 자동 PR 리뷰 (outlier)     | 월 ~3건   | ~1시간/월         |
| 워크플로우 실패 대응       | 분기 ~1건 | ~1시간/분기       |
| ACS_YEAR 수동 갱신         | 연 1회    | ~10분/년          |
| 신규 도시 추가 (확장)      | ad-hoc    | ~3시간/도시       |
| **연간 총 운영 시간**      | —         | **~30~40시간/년** |

> `scripts/refresh/us_census.mjs` 의 `ACS_YEAR` 상수는 매년 12월에 새 dataset 이 공개되면 직전
> 연도로 갱신해야 한다 (Census API 가 미래 연도에 4xx 반환 → 자동 fallback 위험). PR 리뷰 round 8
> 에서 추출 — 갱신 시 us_census 출력값이 1년치 변동을 반영하므로 outlier PR 발생 가능.

수동 큐레이션 70시간/년 → 자동화 후 30~40시간/년. **운영 부담 ~50% 감소**.

## 11. 테스트 (TESTING.md 와 연계)

자동화 스크립트도 테스트 인벤토리 §9-A (신설) 에 추가:

- [x] 각 `scripts/refresh/*.mjs` 가 표준 인터페이스 (`RefreshResult`) 반환
- [x] fetch 실패 → exponential backoff 3회 후 throw
- [x] 응답 shape 변경 → 명시적 에러
- [x] `classifyChange` 경계값 (0.049, 0.05, 0.299, 0.30, 신규, 제거)
- [x] `build_data.mjs` 가 21개 도시 모두 처리
- [x] outlier PR 생성 시 라벨 정확
- [x] 빈 응답·HTML 응답 처리

## 12. 변경 이력

| 일자       | 변경                           |
| ---------- | ------------------------------ |
| 2026-04-28 | v1.0 — 자동화 인프라 초기 명세 |

새 source 추가·schedule 변경·정책 변경 시 본 표 + ADR 갱신.
