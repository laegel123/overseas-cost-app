/**
 * sg_lta.mjs 테스트.
 * TESTING.md §9-A.8 인벤토리.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshSgLta, {
  checkLtaFarePage,
  getTransportFares,
  CITY_CONFIGS,
  STATIC_TRANSPORT,
  SOURCE,
} from '../sg_lta.mjs';
import type { RefreshChange, RefreshError } from './_test-types';

let originalDataDir: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-sg-lta-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = path.join(testDir, 'cities');
});

afterEach(() => {
  if (testDir && testDir.includes('test-sg-lta-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  jest.restoreAllMocks();
});

describe('getTransportFares', () => {
  it('정적 요금 반환', () => {
    const result = getTransportFares();

    expect(result.monthlyPass).toBe(STATIC_TRANSPORT.monthlyPass);
    expect(result.singleRide).toBe(STATIC_TRANSPORT.singleRide);
    expect(result.taxiBase).toBe(STATIC_TRANSPORT.taxiBase);
  });
});

describe('constants', () => {
  it('CITY_CONFIGS: 싱가포르 포함', () => {
    expect(Object.keys(CITY_CONFIGS)).toHaveLength(1);
    expect(CITY_CONFIGS.singapore).toBeDefined();
  });

  it('싱가포르 설정에 필수 필드 포함', () => {
    const sg = CITY_CONFIGS.singapore;
    expect(sg.id).toBe('singapore');
    expect(sg.name.ko).toBe('싱가포르');
    expect(sg.name.en).toBe('Singapore');
    expect(sg.country).toBe('SG');
    expect(sg.currency).toBe('SGD');
    expect(sg.region).toBe('asia');
    expect(sg.transitOperator).toBe('LTA');
    expect(sg.fareUrl).toContain('lta.gov.sg');
  });

  it('STATIC_TRANSPORT: SGD 단위 요금', () => {
    expect(STATIC_TRANSPORT.monthlyPass).toBeGreaterThan(0);
    expect(STATIC_TRANSPORT.singleRide).toBeGreaterThan(0);
    expect(STATIC_TRANSPORT.taxiBase).toBeGreaterThan(0);
    expect(STATIC_TRANSPORT.monthlyPass).toBeGreaterThan(STATIC_TRANSPORT.singleRide * 30);
  });

  it('SOURCE 정의', () => {
    expect(SOURCE.category).toBe('transport');
    expect(SOURCE.name).toContain('LTA');
    expect(SOURCE.url).toContain('lta.gov.sg');
  });
});

describe('refresh (integration)', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useRealTimers();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.useFakeTimers();
  });

  it('useStatic=true: fetch 호출 없이 정상 동작', async () => {
    const result = await refreshSgLta({ dryRun: true, useStatic: true });

    expect(result.source).toBe('sg_lta');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    await refreshSgLta({ dryRun: true, useStatic: true });

    const sgPath = path.join(testDir, 'cities', 'singapore.json');
    expect(fs.existsSync(sgPath)).toBe(false);
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    const result = await refreshSgLta({ dryRun: true, useStatic: true });

    expect(result).toHaveProperty('source');
    expect(result).toHaveProperty('cities');
    expect(result).toHaveProperty('fields');
    expect(result).toHaveProperty('changes');
    expect(result).toHaveProperty('errors');
    expect(Array.isArray(result.cities)).toBe(true);
    expect(Array.isArray(result.fields)).toBe(true);
    expect(Array.isArray(result.changes)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
  }, 30000);

  it('싱가포르 처리', async () => {
    const result = await refreshSgLta({ dryRun: true, useStatic: true });

    const sgChanges = result.changes.filter((c: RefreshChange) => c.cityId === 'singapore');
    expect(sgChanges.length).toBeGreaterThan(0);
  }, 30000);

  it('기존 데이터 대비 changes 계산', async () => {
    const existingData = {
      id: 'singapore',
      name: { ko: '싱가포르', en: 'Singapore' },
      country: 'SG',
      currency: 'SGD',
      region: 'asia',
      lastUpdated: '2026-04-01',
      rent: { share: 1000, studio: 2000, oneBed: 2500, twoBed: 3500 },
      food: { restaurantMeal: 12, cafe: 5, groceries: { milk1L: 3.5, eggs12: 4.0, rice1kg: 3.0, chicken1kg: 8.5, bread: 2.5 } },
      transport: { monthlyPass: 100, singleRide: 1.0, taxiBase: 3.0 },
      sources: [{ category: 'transport', name: 'LTA', url: 'https://lta.gov.sg/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'singapore.json'),
      JSON.stringify(existingData),
    );

    const result = await refreshSgLta({ dryRun: true, useStatic: true, cities: ['singapore'] });

    expect(result.changes.length).toBeGreaterThan(0);
    const transportChange = result.changes.find((c: RefreshChange) => c.field.startsWith('transport.'));
    expect(transportChange).toBeDefined();
    expect(typeof transportChange?.pctChange).toBe('number');
  }, 30000);

  it('알 수 없는 도시: errors에 추가', async () => {
    const result = await refreshSgLta({ dryRun: true, useStatic: true, cities: ['unknown-city'] });

    expect(result.errors.some((e: RefreshError) => e.cityId === 'unknown-city')).toBe(true);
  }, 30000);

  it('페이지 불가 시 static fallback + errors에 추가', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await refreshSgLta({ dryRun: true, useStatic: false });

    expect(result.errors.some((e: RefreshError) => e.reason.includes('unavailable'))).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);
});
