/**
 * 자동화 스크립트 테스트 환경 설정.
 * TESTING.md §9-A.0 참조.
 *
 * - 시간 모킹 (jest.useFakeTimers)
 * - 임시 DATA_DIR (테스트 격리)
 * - 시드 fixture 복사
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

let originalDataDir: string | undefined;

export function setupTestEnv(): void {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-28T00:00:00+09:00'));

    originalDataDir = process.env.DATA_DIR;
    const testDir = path.join(os.tmpdir(), `test-cities-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    process.env.DATA_DIR = testDir;

    fs.mkdirSync(testDir, { recursive: true });

    const fixtureDir = path.join(__dirname, '..', '..', '..', 'src', '__fixtures__', 'cities');
    if (fs.existsSync(fixtureDir)) {
      const files = fs.readdirSync(fixtureDir);
      for (const file of files) {
        if (file.endsWith('.ts')) {
          continue;
        }
        fs.cpSync(path.join(fixtureDir, file), path.join(testDir, file), { recursive: true });
      }
    }
  });

  afterEach(() => {
    const testDir = process.env.DATA_DIR;
    if (testDir && testDir.includes('test-cities-')) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    process.env.DATA_DIR = originalDataDir;

    jest.useRealTimers();
    jest.restoreAllMocks();
  });
}

export function createTempCityFile(id: string, data: Record<string, unknown>): void {
  const dataDir = process.env.DATA_DIR;
  if (!dataDir) {
    throw new Error('DATA_DIR not set');
  }
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, `${id}.json`), JSON.stringify(data, null, 2));
}

export function readTempCityFile(id: string): Record<string, unknown> {
  const dataDir = process.env.DATA_DIR;
  if (!dataDir) {
    throw new Error('DATA_DIR not set');
  }
  const content = fs.readFileSync(path.join(dataDir, `${id}.json`), 'utf-8');
  return JSON.parse(content);
}

export function tempCityExists(id: string): boolean {
  const dataDir = process.env.DATA_DIR;
  if (!dataDir) {
    return false;
  }
  return fs.existsSync(path.join(dataDir, `${id}.json`));
}

export function getTestDataDir(): string {
  const dataDir = process.env.DATA_DIR;
  if (!dataDir) {
    throw new Error('DATA_DIR not set');
  }
  return dataDir;
}

import type { CityCostData, Region, SourceCategory } from '../../../src/types/city';

export const VALID_CITY_FIXTURE: CityCostData = {
  id: 'test-city',
  name: { ko: '테스트', en: 'Test' },
  country: 'KR',
  currency: 'KRW',
  region: 'asia' as Region,
  lastUpdated: '2026-04-01',
  rent: {
    share: 500000,
    studio: 700000,
    oneBed: 900000,
    twoBed: 1500000,
  },
  food: {
    restaurantMeal: 9000,
    cafe: 5000,
    groceries: {
      milk1L: 3000,
      eggs12: 5500,
      rice1kg: 4500,
      chicken1kg: 12000,
      bread: 4000,
    },
  },
  transport: {
    monthlyPass: 65000,
    singleRide: 1400,
    taxiBase: 4800,
  },
  sources: [
    {
      category: 'rent' as SourceCategory,
      name: 'Test Source',
      url: 'https://example.com',
      accessedAt: '2026-04-01',
    },
  ],
};
