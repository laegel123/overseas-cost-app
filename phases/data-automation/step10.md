# Step 10: workflows-and-data

GitHub Actions 6개 워크플로우 (`.github/workflows/refresh-*.yml`) + concurrency / API key 부재 처리 / outlier PR 자동 생성. **21개 도시 데이터 최종 검증 + 통합 테스트** + 배포 준비.

## 읽어야 할 파일

- `docs/AUTOMATION.md` §4 (워크플로우 명세 전체), §4.5b (concurrency), §4.5c (API 키 부재), §4.6 (fx)
- `docs/TESTING.md` §9-A 전체
- `.github/workflows/claude-review.yml` — 기존 워크플로우 (스타일 참조)
- step 1~9 산출물 — 모든 refresh 스크립트 + 도시 JSON

## 작업

### 1. 워크플로우 6개

`.github/workflows/`:

- `refresh-fx.yml` — 일 1회 (cron `0 0 * * *`)
- `refresh-prices.yml` — 주 1회 (cron `0 18 * * 1`)
- `refresh-rent.yml` — 월 1회 (cron `0 18 1 * *`)
- `refresh-transit.yml` — 분기 1회 (cron `0 18 1 1,4,7,10 *`)
- `refresh-tuition.yml` — 분기 1회 (cron `0 18 15 1,4,7,10 *`)
- `refresh-visa.yml` — 분기 1회 (cron `0 18 20 1,4,7,10 *`)

각 워크플로우 공통:

- `concurrency: { group: data-refresh-${{ github.ref }}, cancel-in-progress: false }`
- `permissions: { contents: write, pull-requests: write }`
- API 키 부재 처리 (§4.5c): `if: ${{ env.X_API_KEY == '' }}` skip + warning
- 변동 폭 분류 후:
  - <5%: 자동 commit + push
  - 5~30%: `peter-evans/create-pull-request@v6` + label `auto-update`
  - ≥30%: 동일 액션 + label `outlier`
- 마지막에 `node scripts/build_data.mjs` + `node scripts/validate_cities.mjs`

### 2. 통합 테스트

- `scripts/refresh/__tests__/integration.test.ts` — 6 워크플로우의 npm run 시나리오 가짜 실행 (각 source mock fetch → build_data → validate)
- 21개 도시 모든 필드가 schema 통과
- `data/all.json` / `data/seed/all.json` 정합성

### 3. README / docs 보강

- `README.md` — 자동화 운영 가이드 (워크플로우 trigger / API key 등록 / PR 리뷰)
- `docs/AUTOMATION.md` §10 운영 부담 표 갱신

### 4. 인벤토리 최종

`docs/TESTING.md §9-A` 전체 `[x]` 상태 검증.

### 5. data 빌드 commit

- `data/cities/*.json` 21개 final 검증 + commit
- `data/all.json` + `data/seed/all.json` 빌드 결과 commit

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
node scripts/build_data.mjs
node scripts/validate_cities.mjs
ls data/cities/*.json | wc -l   # 21
```

## 검증 절차

1. AC 통과 + `data/cities/*.json` 정확히 21개
2. 체크:
   - 모든 워크플로우 yaml schema 통과 (`act` 또는 GitHub Actions UI 기반 lint)
   - concurrency group 동일 — race condition 차단
   - API 키 부재 시 skip + warning (워크플로우 fail 안 함)
   - outlier 분류 정확 (≥30% → label outlier)
3. **수동 dispatch 테스트**: `gh workflow run refresh-fx.yml` (사용자 권한 — Actions 탭에서 수동 실행 후 결과 확인)
4. `phases/data-automation/index.json` step 10 + phase status update

## 금지사항

- 워크플로우에서 secret 직접 echo 금지. 이유: log leak.
- `force push` 또는 `--no-verify` 금지. 이유: 데이터 무결성.
- 21개 도시 외 추가 fetch 금지. 이유: PRD 명시 도시만.
- 수동 commit 시 데이터 변경 금지. 이유: 자동 fetch 만 허용 (ADR-032). 수동 commit 은 코드 / 워크플로우 / 인벤토리 변경만.
