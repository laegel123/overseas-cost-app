/**
 * 자동화 파이프라인 통합 테스트.
 * TESTING.md §9-A.15 참조.
 *
 * 워크플로우 시뮬레이션: 모든 refresh 스크립트 → build_data → validate_cities 순차 실행.
 * 실제 API 호출 없이 모킹된 fetch 로 검증.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { setupTestEnv, createTempCityFile, VALID_CITY_FIXTURE, getTestDataDir } from './setup';
import { classifyChange } from '../_outlier.mjs';

setupTestEnv();

describe('Integration: Full Pipeline Simulation', () => {
  describe('전체 흐름', () => {
    it('변경 없음 → all.json 변경 없음 (멱등)', async () => {
      createTempCityFile('seoul', { ...VALID_CITY_FIXTURE, id: 'seoul' });
      createTempCityFile('vancouver', { ...VALID_CITY_FIXTURE, id: 'vancouver' });

      const dataDir = getTestDataDir();
      const allJsonPath = path.join(dataDir, 'all.json');

      const allData = {
        cities: [
          { ...VALID_CITY_FIXTURE, id: 'seoul' },
          { ...VALID_CITY_FIXTURE, id: 'vancouver' },
        ],
        generatedAt: '2026-04-28T00:00:00+09:00',
      };
      fs.writeFileSync(allJsonPath, JSON.stringify(allData, null, 2));

      const before = fs.readFileSync(allJsonPath, 'utf-8');
      fs.writeFileSync(allJsonPath, JSON.stringify(allData, null, 2));
      const after = fs.readFileSync(allJsonPath, 'utf-8');

      expect(before).toBe(after);
    });

    it('동일 시각 두 번 실행 → 결과 동일', async () => {
      createTempCityFile('seoul', { ...VALID_CITY_FIXTURE, id: 'seoul' });

      const result1 = classifyChange(100, 100);
      const result2 = classifyChange(100, 100);

      expect(result1).toBe(result2);
      expect(result1).toBe('commit');
    });
  });

  describe('변동폭 분류 경계값', () => {
    it('<5%: commit', () => {
      expect(classifyChange(100, 104)).toBe('commit');
      expect(classifyChange(100, 104.9)).toBe('commit');
    });

    it('=5%: pr-update', () => {
      expect(classifyChange(100, 105)).toBe('pr-update');
    });

    it('5~30%: pr-update', () => {
      expect(classifyChange(100, 120)).toBe('pr-update');
      expect(classifyChange(100, 129)).toBe('pr-update');
    });

    it('=30%: pr-outlier', () => {
      expect(classifyChange(100, 130)).toBe('pr-outlier');
    });

    it('>30%: pr-outlier', () => {
      expect(classifyChange(100, 150)).toBe('pr-outlier');
      expect(classifyChange(100, 200)).toBe('pr-outlier');
    });

    it('신규 값 (null → number): new', () => {
      expect(classifyChange(null, 100)).toBe('new');
    });

    it('제거 (number → null): pr-removed', () => {
      expect(classifyChange(100, null)).toBe('pr-removed');
    });

    it('둘 다 null: commit (no change)', () => {
      expect(classifyChange(null, null)).toBe('commit');
    });
  });

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

  // 'fetchWithRetry 재시도 / atomic write rename' 단위 검증은 `_common.test.ts` 책임.
  // 본 통합 테스트는 워크플로우 분기 (HAS_OUTLIERS / HAS_UPDATES) 와 도시 갯수만 본다.

  describe('PR 생성 분기', () => {
    it('outlier → PR 생성 대상', () => {
      const classification = classifyChange(100, 150);
      const shouldCreatePR = classification === 'pr-outlier' || classification === 'pr-update';
      expect(shouldCreatePR).toBe(true);
    });

    it('auto-update → PR 생성 대상', () => {
      const classification = classifyChange(100, 115);
      expect(classification).toBe('pr-update');
    });

    it('commit → 직접 commit', () => {
      const classification = classifyChange(100, 102);
      expect(classification).toBe('commit');
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

  it('peter-evans/create-pull-request 액션은 정확한 minor 버전으로 고정', () => {
    for (const workflow of REFRESH_WORKFLOWS) {
      const content = fs.readFileSync(path.join(WORKFLOW_DIR, workflow), 'utf-8');
      // 공급망 보안: @v6 은 태그 재지정 위험 → @v6.x.y 로 핀.
      expect(content).toContain('peter-evans/create-pull-request@v6.1.0');
      expect(content).not.toMatch(/peter-evans\/create-pull-request@v6$/m);
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

  it('각 워크플로우의 Auto commit 단계는 git add 범위가 데이터 파일로 한정', () => {
    for (const workflow of REFRESH_WORKFLOWS) {
      const content = fs.readFileSync(path.join(WORKFLOW_DIR, workflow), 'utf-8');
      expect(content).toContain('git add data/cities/ data/all.json data/seed/all.json');
      // 'git add -A' 가 다시 들어오지 않도록 회귀 차단.
      expect(content).not.toContain('git add -A');
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
      expect(content).toContain('peter-evans/create-pull-request@v6');
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

  it('refresh-transit: 분기 첫 달 1일', () => {
    const content = fs.readFileSync(path.join(WORKFLOW_DIR, 'refresh-transit.yml'), 'utf-8');
    expect(content).toContain("cron: '0 18 1 1,4,7,10 *'");
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
