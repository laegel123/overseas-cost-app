/**
 * 자동화 워크플로우 contract 검증.
 * TESTING.md §9-A.15 참조.
 *
 * **검증 범위 (v1.0)**:
 *  - `.github/workflows/refresh-*.yml` 의 구조적 contract (concurrency / steps / 분기 라벨 / git add 범위 등).
 *  - `classifyChange` 분류 결과가 워크플로우 분기 정책 (outlier/update/commit) 과 일치하는지 sanity 한 건.
 *  - 21개 도시 갯수.
 *
 * **검증하지 않는 것**:
 *  - 실제 fetcher → build_data → validate_cities 전 파이프라인 end-to-end (각 fetcher 의 단위
 *    테스트 + GitHub Actions 실 dispatch 가 그 책임).
 *  - fetchWithRetry 재시도 / atomic write rename 등 _common.mjs 의 단위 검증.
 *  - classifyChange 모든 경계값 — `_outlier.test.ts` 가 책임.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { setupTestEnv, createTempCityFile, VALID_CITY_FIXTURE, getTestDataDir } from './setup';
import { classifyChange } from '../_outlier.mjs';

setupTestEnv();

describe('Integration: Workflow contract', () => {
  // 'classifyChange 모든 경계값' 은 `_outlier.test.ts` 가 책임. 본 파일은 분기 매핑만 1건 sanity.

  describe('도시 파일 검증', () => {
    it('21개 도시 모두 처리 가능', () => {
      const CITIES = [
        'seoul',
        'vancouver',
        'toronto',
        'montreal',
        'nyc',
        'la',
        'sf',
        'seattle',
        'boston',
        'london',
        'berlin',
        'munich',
        'paris',
        'amsterdam',
        'sydney',
        'melbourne',
        'tokyo',
        'osaka',
        'singapore',
        'hochiminh',
        'dubai',
      ];

      for (const city of CITIES) {
        createTempCityFile(city, { ...VALID_CITY_FIXTURE, id: city });
      }

      const dataDir = getTestDataDir();
      const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'));

      expect(files).toHaveLength(21);
      for (const city of CITIES) {
        expect(files).toContain(`${city}.json`);
      }
    });
  });

  describe('워크플로우 환경변수 분기', () => {
    it('HAS_OUTLIERS — ≥30% 변동만 true (5~30% 는 HAS_UPDATES 로 별도 집계)', () => {
      // detect_outliers.mjs 가 두 변수를 분리해 출력 — outlier label PR / auto-update label PR / 직접 commit 3분기.
      expect(classifyChange(100, 150)).toBe('pr-outlier');
      expect(classifyChange(100, 115)).toBe('pr-update');
      expect(classifyChange(100, 102)).toBe('commit');
    });
  });

});

describe('Integration: Workflow YAML Validation', () => {
  const WORKFLOW_DIR = path.join(__dirname, '..', '..', '..', '.github', 'workflows');

  const REFRESH_WORKFLOWS = [
    'refresh-fx.yml',
    'refresh-prices.yml',
    'refresh-rent.yml',
    'refresh-transit.yml',
    'refresh-tuition.yml',
    'refresh-visa.yml',
  ];

  it('6개 refresh 워크플로우 파일 존재', () => {
    for (const workflow of REFRESH_WORKFLOWS) {
      const exists = fs.existsSync(path.join(WORKFLOW_DIR, workflow));
      expect(exists).toBe(true);
    }
  });

  it('각 워크플로우에 concurrency 설정 존재 (워크플로우별 고유 group)', () => {
    for (const workflow of REFRESH_WORKFLOWS) {
      const content = fs.readFileSync(path.join(WORKFLOW_DIR, workflow), 'utf-8');
      // group 은 카테고리별 고유 — fx / prices / rent / transit / tuition / visa 가 같은 ref 에서도 병렬 실행 가능.
      const category = workflow.replace('refresh-', '').replace('.yml', '');
      expect(content).toContain('concurrency:');
      expect(content).toContain(`group: data-refresh-${category}-\${{ github.ref }}`);
      expect(content).toContain('cancel-in-progress: false');
    }
  });

  it('각 워크플로우에 detect_outliers.mjs 스텝 + outlier/update/commit 3분기 존재', () => {
    for (const workflow of REFRESH_WORKFLOWS) {
      const content = fs.readFileSync(path.join(WORKFLOW_DIR, workflow), 'utf-8');
      expect(content).toContain('node scripts/detect_outliers.mjs');
      // ≥30% (outlier label PR)
      expect(content).toContain("steps.outliers.outputs.HAS_OUTLIERS == 'true'");
      // 5~30% (auto-update label PR) — AUTOMATION.md §1 누락 보정.
      expect(content).toContain("steps.outliers.outputs.HAS_UPDATES == 'true'");
      // <5% (직접 commit) — outlier 도 아니고 update 도 아닌 경우.
      expect(content).toContain("steps.outliers.outputs.HAS_OUTLIERS != 'true' && steps.outliers.outputs.HAS_UPDATES != 'true'");
      expect(content).toContain('labels: outlier');
      expect(content).toContain('labels: auto-update');
    }
  });

  it('peter-evans/create-pull-request 액션은 commit SHA 로 고정 + 버전 코멘트', () => {
    for (const workflow of REFRESH_WORKFLOWS) {
      const content = fs.readFileSync(path.join(WORKFLOW_DIR, workflow), 'utf-8');
      // 공급망 보안: 태그/브랜치 alias 는 재지정 가능 → 40자리 commit SHA 로 핀 + 버전 코멘트.
      expect(content).toMatch(/peter-evans\/create-pull-request@[a-f0-9]{40} # v\d+\.\d+\.\d+/);
      expect(content).not.toMatch(/peter-evans\/create-pull-request@v\d+(\.\d+){0,2}\s*$/m);
    }
  });

  it('rent + food 통합형 fetcher 는 refresh-rent.yml 한쪽에서만 호출 (중복 실행 차단)', () => {
    const integrated = ['uk_ons', 'de_destatis', 'fr_insee', 'nl_cbs', 'au_abs', 'jp_estat', 'sg_singstat', 'vn_gso', 'ae_fcsc'];
    const pricesYml = fs.readFileSync(path.join(WORKFLOW_DIR, 'refresh-prices.yml'), 'utf-8');
    const rentYml = fs.readFileSync(path.join(WORKFLOW_DIR, 'refresh-rent.yml'), 'utf-8');

    for (const fetcher of integrated) {
      // 워크플로우는 _run.mjs wrapper 로 fetcher 를 호출.
      const pat = `_run.mjs ${fetcher}`;
      expect(rentYml.includes(pat)).toBe(true);
      expect(pricesYml.includes(pat)).toBe(false);
    }
  });

  it('refresh 스크립트들은 _run.mjs CLI wrapper 로만 호출 (직접 실행 금지)', () => {
    // node scripts/refresh/<name>.mjs 직접 호출은 default export 호출 안 함 → 워크플로우 무효.
    // 모든 fetcher 는 _run.mjs <name> 형태로만 호출돼야 한다.
    for (const workflow of REFRESH_WORKFLOWS) {
      const content = fs.readFileSync(path.join(WORKFLOW_DIR, workflow), 'utf-8');
      // detect_outliers.mjs / build_data.mjs / validate_cities.mjs 는 _run.mjs 우회 — 별도 CLI 진입점 보유.
      const directCalls = content.match(/node scripts\/refresh\/(?!_run)\w+\.mjs/g) ?? [];
      expect(directCalls).toEqual([]);
      // _run.mjs 자체는 1회 이상 호출 (refresh-fx 처럼 fetcher 1개만 있는 워크플로우 포함).
      expect(content).toMatch(/node scripts\/refresh\/_run\.mjs \w+/);
    }
  });

  it('eu_eurostat 는 어떤 워크플로우에서도 단독 호출되지 않음 (writeCity 미호출 라이브러리)', () => {
    for (const workflow of REFRESH_WORKFLOWS) {
      const content = fs.readFileSync(path.join(WORKFLOW_DIR, workflow), 'utf-8');
      expect(content).not.toMatch(/_run\.mjs eu_eurostat/);
    }
  });

  it('v1.0 useStatic 정책: visas / universities / jp_estat 호출은 --useStatic 동반', () => {
    // 세 fetcher 는 v1.0 에서 HTML 파싱 / 응답 검증이 미구현이라 fetch 결과를 STATIC 에 적용하지 않음.
    // 매 워크플로우 실행마다 정부·대학·e-Stat 사이트에 무의미한 HTTP 요청을 보내는 것을 차단.
    // PR #20 review round 7 (회귀 차단) — v1.x 파싱 도입 시 본 단언을 갱신.
    const visaYml = fs.readFileSync(path.join(WORKFLOW_DIR, 'refresh-visa.yml'), 'utf-8');
    const tuitionYml = fs.readFileSync(path.join(WORKFLOW_DIR, 'refresh-tuition.yml'), 'utf-8');
    const rentYml = fs.readFileSync(path.join(WORKFLOW_DIR, 'refresh-rent.yml'), 'utf-8');

    expect(visaYml).toMatch(/_run\.mjs visas --useStatic/);
    expect(tuitionYml).toMatch(/_run\.mjs universities --useStatic/);
    expect(rentYml).toMatch(/_run\.mjs jp_estat --useStatic/);
  });

  it('각 워크플로우의 Auto commit 단계는 git add 범위가 데이터 파일로 한정', () => {
    for (const workflow of REFRESH_WORKFLOWS) {
      const content = fs.readFileSync(path.join(WORKFLOW_DIR, workflow), 'utf-8');
      expect(content).toContain('git add data/cities/ data/all.json data/seed/all.json');
      // 'git add -A' 가 다시 들어오지 않도록 회귀 차단.
      expect(content).not.toContain('git add -A');
    }
  });

  it('push retry 의 git pull --rebase 실패는 silent 가 아닌 ::warning 으로 노출 (PR #20 review round 8)', () => {
    // 과거 `|| true` 로 rebase 실패가 silent fail → 충돌 진단 어려움. ::warning echo 로 표면화.
    for (const workflow of REFRESH_WORKFLOWS) {
      const content = fs.readFileSync(path.join(WORKFLOW_DIR, workflow), 'utf-8');
      expect(content).toContain('git pull --rebase origin');
      expect(content).not.toMatch(/git pull --rebase origin .* \|\| true$/m);
      expect(content).toMatch(/git pull --rebase origin .* \|\| echo "::warning::rebase attempt/);
    }
  });

  it('push retry 루프 시작에 git rebase --abort 로 in-progress rebase 정리 (PR #20 review round 9)', () => {
    // rebase 충돌로 in-progress 상태가 남으면 다음 attempt 의 git pull --rebase 가 즉시 실패하므로 정리.
    for (const workflow of REFRESH_WORKFLOWS) {
      const content = fs.readFileSync(path.join(WORKFLOW_DIR, workflow), 'utf-8');
      expect(content).toContain('git rebase --abort 2>/dev/null || true');
    }
  });

  it('push retry sleep 은 jitter backoff (PR #20 review round 19)', () => {
    // 과거 sleep $((attempt * 5)) 은 너무 짧음 (5/10/15초). 매월 1일 rent + fx 동시 실행 race 시
    // 3회 모두 실패 가능. 15초 + RANDOM % 10 jitter 로 분산 (15-24/30-39/45-54초).
    for (const workflow of REFRESH_WORKFLOWS) {
      const content = fs.readFileSync(path.join(WORKFLOW_DIR, workflow), 'utf-8');
      expect(content).toContain('sleep $((attempt * 15 + RANDOM % 10))');
      expect(content).not.toMatch(/sleep \$\(\(attempt \* 5\)\)/);
    }
  });

  it('v1.0 useStatic 정책 — sg_singstat 도 --useStatic 동반 (PR #20 review round 13)', () => {
    // round 9 에서 SG_DATA_GOV_KEY env 를 wire up 했으나, round 13 에서 sg_singstat 의
    // fetchSingStatTable / apiAvailable 가 실제 보정에 적용되지 않는 것이 확인돼 jp_estat 와
    // 동일 패턴으로 --useStatic 강제. v1.x 응답 단위 검증 후 정책 전환.
    const rentYml = fs.readFileSync(path.join(WORKFLOW_DIR, 'refresh-rent.yml'), 'utf-8');
    expect(rentYml).toMatch(/_run\.mjs sg_singstat --useStatic/);
    // env 에서도 제거되어 jp_estat 와 일관 — 키가 의미 없을 때 wire 안 함.
    expect(rentYml).not.toMatch(/SG_DATA_GOV_KEY:\s*\$\{\{\s*secrets\.SG_DATA_GOV_KEY\s*\}\}/);
  });

  it('HAS_NEW 가 모든 워크플로우의 PR-update / commit 분기에 반영 (PR #20 review round 11)', () => {
    // placeholder(0) → 실제값 첫 갱신은 PR 검토 강제 — `Create PR for updates` 의 OR 조건 +
    // `Auto commit and push` 의 != 'true' 조건 양쪽에 HAS_NEW 가 들어가야 한 곳이라도 누락 시
    // 신규 항목이 검토 없이 직접 commit 되는 회귀 발생.
    for (const workflow of REFRESH_WORKFLOWS) {
      const content = fs.readFileSync(path.join(WORKFLOW_DIR, workflow), 'utf-8');
      // PR-update 분기 — HAS_UPDATES 또는 HAS_NEW 면 PR 생성.
      expect(content).toContain(
        "(steps.outliers.outputs.HAS_UPDATES == 'true' || steps.outliers.outputs.HAS_NEW == 'true')",
      );
      // commit 분기 — 세 변수 모두 false 일 때만 직접 commit.
      expect(content).toContain("steps.outliers.outputs.HAS_NEW != 'true'");
    }
  });

  it('각 워크플로우에 permissions 설정 존재', () => {
    for (const workflow of REFRESH_WORKFLOWS) {
      const content = fs.readFileSync(path.join(WORKFLOW_DIR, workflow), 'utf-8');
      expect(content).toContain('permissions:');
      expect(content).toContain('contents: write');
      expect(content).toContain('pull-requests: write');
    }
  });

  it('각 워크플로우에 workflow_dispatch 트리거 존재', () => {
    for (const workflow of REFRESH_WORKFLOWS) {
      const content = fs.readFileSync(path.join(WORKFLOW_DIR, workflow), 'utf-8');
      expect(content).toContain('workflow_dispatch:');
    }
  });

  it('각 워크플로우에 peter-evans/create-pull-request 액션 존재', () => {
    for (const workflow of REFRESH_WORKFLOWS) {
      const content = fs.readFileSync(path.join(WORKFLOW_DIR, workflow), 'utf-8');
      expect(content).toMatch(/peter-evans\/create-pull-request@[a-f0-9]{40}/);
    }
  });

  it('각 워크플로우에 build_data.mjs 스텝 존재', () => {
    for (const workflow of REFRESH_WORKFLOWS) {
      const content = fs.readFileSync(path.join(WORKFLOW_DIR, workflow), 'utf-8');
      expect(content).toContain('node scripts/build_data.mjs');
    }
  });

  it('각 워크플로우에 validate_cities.mjs 스텝 존재', () => {
    for (const workflow of REFRESH_WORKFLOWS) {
      const content = fs.readFileSync(path.join(WORKFLOW_DIR, workflow), 'utf-8');
      expect(content).toContain('node scripts/validate_cities.mjs');
    }
  });
});

describe('Integration: Schedule Validation', () => {
  const WORKFLOW_DIR = path.join(__dirname, '..', '..', '..', '.github', 'workflows');

  it('refresh-fx: 매일 00:00 UTC', () => {
    const content = fs.readFileSync(path.join(WORKFLOW_DIR, 'refresh-fx.yml'), 'utf-8');
    expect(content).toContain("cron: '0 0 * * *'");
  });

  it('refresh-prices: 매주 월요일', () => {
    const content = fs.readFileSync(path.join(WORKFLOW_DIR, 'refresh-prices.yml'), 'utf-8');
    expect(content).toContain("cron: '0 18 * * 1'");
  });

  it('refresh-rent: 매월 1일', () => {
    const content = fs.readFileSync(path.join(WORKFLOW_DIR, 'refresh-rent.yml'), 'utf-8');
    expect(content).toContain("cron: '0 18 1 * *'");
  });

  it('refresh-transit: 분기 첫 달 2일 (rent 와 동시 실행 충돌 회피)', () => {
    const content = fs.readFileSync(path.join(WORKFLOW_DIR, 'refresh-transit.yml'), 'utf-8');
    expect(content).toContain("cron: '0 18 2 1,4,7,10 *'");
  });

  it('refresh-tuition: 분기 첫 달 15일', () => {
    const content = fs.readFileSync(path.join(WORKFLOW_DIR, 'refresh-tuition.yml'), 'utf-8');
    expect(content).toContain("cron: '0 18 15 1,4,7,10 *'");
  });

  it('refresh-visa: 분기 첫 달 20일', () => {
    const content = fs.readFileSync(path.join(WORKFLOW_DIR, 'refresh-visa.yml'), 'utf-8');
    expect(content).toContain("cron: '0 18 20 1,4,7,10 *'");
  });
});
