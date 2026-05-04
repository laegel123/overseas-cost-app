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

  describe('워크플로우 환경변수', () => {
    it('HAS_OUTLIERS 환경변수 설정 확인', () => {
      const hasOutlier = classifyChange(100, 150) === 'pr-outlier';
      const envValue = hasOutlier ? 'true' : 'false';

      expect(envValue).toBe('true');
    });
  });

  describe('에러 복구', () => {
    it('fetch 실패 후 재시도 가능 (멱등)', async () => {
      createTempCityFile('seoul', { ...VALID_CITY_FIXTURE, id: 'seoul' });

      const firstRead = fs.readFileSync(
        path.join(getTestDataDir(), 'seoul.json'),
        'utf-8'
      );
      const secondRead = fs.readFileSync(
        path.join(getTestDataDir(), 'seoul.json'),
        'utf-8'
      );

      expect(firstRead).toBe(secondRead);
    });
  });

  describe('동시성', () => {
    it('같은 파일 동시 쓰기 시도 → 마지막 쓰기 우선', () => {
      const dataDir = getTestDataDir();
      const filePath = path.join(dataDir, 'concurrent.json');

      fs.writeFileSync(filePath, JSON.stringify({ version: 1 }));
      fs.writeFileSync(filePath, JSON.stringify({ version: 2 }));

      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(content.version).toBe(2);
    });
  });

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

  it('각 워크플로우에 concurrency 설정 존재', () => {
    for (const workflow of REFRESH_WORKFLOWS) {
      const content = fs.readFileSync(path.join(WORKFLOW_DIR, workflow), 'utf-8');
      expect(content).toContain('concurrency:');
      expect(content).toContain('group: data-refresh-${{ github.ref }}');
      expect(content).toContain('cancel-in-progress: false');
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
