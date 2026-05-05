/**
 * au_transit.mjs 테스트.
 * TESTING.md §9-A.8 인벤토리.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshAuTransit, {
  getTransportFares,
  checkNswApiStatus,
  CITY_CONFIGS,
  STATIC_TRANSPORT,
  SOURCE,
} from '../au_transit.mjs';
import type { RefreshChange, RefreshError } from './_test-types';

let originalDataDir: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-au-transit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = path.join(testDir, 'cities');
});

afterEach(() => {
  if (testDir && testDir.includes('test-au-transit-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  jest.restoreAllMocks();
});

describe('getTransportFares', () => {
  it('시드니: 정적 요금 반환', () => {
    const result = getTransportFares('sydney');

    expect(result.monthlyPass).toBe(STATIC_TRANSPORT.sydney.monthlyPass);
    expect(result.singleRide).toBe(STATIC_TRANSPORT.sydney.singleRide);
    expect(result.taxiBase).toBe(STATIC_TRANSPORT.sydney.taxiBase);
  });

  it('멜버른: 정적 요금 반환', () => {
    const result = getTransportFares('melbourne');

    expect(result.monthlyPass).toBe(STATIC_TRANSPORT.melbourne.monthlyPass);
    expect(result.singleRide).toBe(STATIC_TRANSPORT.melbourne.singleRide);
    expect(result.taxiBase).toBe(STATIC_TRANSPORT.melbourne.taxiBase);
  });

  it('알 수 없는 도시: 시드니 fallback', () => {
    const result = getTransportFares('unknown');
    expect(result.monthlyPass).toBe(STATIC_TRANSPORT.sydney.monthlyPass);
  });
});

describe('constants', () => {
  it('CITY_CONFIGS: 시드니/멜버른 포함', () => {
    expect(Object.keys(CITY_CONFIGS)).toHaveLength(2);
    expect(CITY_CONFIGS.sydney).toBeDefined();
    expect(CITY_CONFIGS.melbourne).toBeDefined();
  });

  it('시드니 설정에 필수 필드 포함', () => {
    const sydney = CITY_CONFIGS.sydney;
    expect(sydney.id).toBe('sydney');
    expect(sydney.name.ko).toBe('시드니');
    expect(sydney.name.en).toBe('Sydney');
    expect(sydney.country).toBe('AU');
    expect(sydney.currency).toBe('AUD');
    expect(sydney.region).toBe('oceania');
  });

  it('멜버른 설정에 필수 필드 포함', () => {
    const melbourne = CITY_CONFIGS.melbourne;
    expect(melbourne.id).toBe('melbourne');
    expect(melbourne.name.ko).toBe('멜버른');
  });

  it('STATIC_TRANSPORT: 시드니/멜버른 요금', () => {
    expect(STATIC_TRANSPORT.sydney.monthlyPass).toBeGreaterThan(0);
    expect(STATIC_TRANSPORT.sydney.singleRide).toBeGreaterThan(0);
    expect(STATIC_TRANSPORT.sydney.taxiBase).toBeGreaterThan(0);

    expect(STATIC_TRANSPORT.melbourne.monthlyPass).toBeGreaterThan(0);
    expect(STATIC_TRANSPORT.melbourne.singleRide).toBeGreaterThan(0);
    expect(STATIC_TRANSPORT.melbourne.taxiBase).toBeGreaterThan(0);
  });

  it('SOURCE 정의', () => {
    expect(SOURCE.category).toBe('transport');
    expect(SOURCE.name).toContain('Transport NSW');
    expect(SOURCE.url).toContain('transportnsw.info');
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

  it('useStatic=true: API 호출 없이 정상 동작', async () => {
    const result = await refreshAuTransit({ dryRun: true, useStatic: true });

    expect(result.source).toBe('au_transit');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    await refreshAuTransit({ dryRun: true, useStatic: true });

    const sydneyPath = path.join(testDir, 'cities', 'sydney.json');
    expect(fs.existsSync(sydneyPath)).toBe(false);
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    const result = await refreshAuTransit({ dryRun: true, useStatic: true });

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

  it('시드니/멜버른 모두 처리', async () => {
    const result = await refreshAuTransit({ dryRun: true, useStatic: true });

    const sydneyChanges = result.changes.filter((c: RefreshChange) => c.cityId === 'sydney');
    const melbourneChanges = result.changes.filter((c: RefreshChange) => c.cityId === 'melbourne');

    expect(sydneyChanges.length).toBeGreaterThan(0);
    expect(melbourneChanges.length).toBeGreaterThan(0);
  }, 30000);

  it('기존 데이터 대비 changes 계산', async () => {
    const existingData = {
      id: 'sydney',
      name: { ko: '시드니', en: 'Sydney' },
      country: 'AU',
      currency: 'AUD',
      region: 'oceania',
      lastUpdated: '2026-04-01',
      rent: { share: 1000, studio: 1500, oneBed: 1800, twoBed: 2200 },
      food: { restaurantMeal: 20, cafe: 4.5, groceries: { milk1L: 2.0, eggs12: 5.0, rice1kg: 3.0, chicken1kg: 10.0, bread: 3.0 } },
      transport: { monthlyPass: 180, singleRide: 3.5, taxiBase: 3.2 },
      sources: [{ category: 'transport', name: 'Transport NSW', url: 'https://transportnsw.info/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'sydney.json'),
      JSON.stringify(existingData),
    );

    const result = await refreshAuTransit({ dryRun: true, useStatic: true, cities: ['sydney'] });

    expect(result.changes.length).toBeGreaterThan(0);
    const transportChange = result.changes.find((c: RefreshChange) => c.field.startsWith('transport.'));
    expect(transportChange).toBeDefined();
    expect(typeof transportChange?.pctChange).toBe('number');
  }, 30000);

  it('알 수 없는 도시: errors에 추가', async () => {
    const result = await refreshAuTransit({ dryRun: true, useStatic: true, cities: ['unknown-city'] });

    expect(result.errors.some((e: RefreshError) => e.cityId === 'unknown-city')).toBe(true);
  }, 30000);

  it('API 불가 시 static fallback + errors에 추가', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await refreshAuTransit({ dryRun: true, useStatic: false });

    expect(result.errors.some((e: RefreshError) => e.reason.includes('unavailable'))).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);
});
