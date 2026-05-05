/**
 * ae_rta.mjs 테스트.
 * TESTING.md §9-A.8 인벤토리.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshAeRta, {
  checkRtaFarePage,
  getTransportFares,
  CITY_CONFIGS,
  STATIC_TRANSPORT,
  SOURCE,
} from '../ae_rta.mjs';
import type { RefreshChange, RefreshError } from './_test-types';

let originalDataDir: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-ae-rta-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = path.join(testDir, 'cities');
});

afterEach(() => {
  if (testDir && testDir.includes('test-ae-rta-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  jest.restoreAllMocks();
});

describe('getTransportFares', () => {
  it('정적 요금 반환 (AED 단위)', () => {
    const result = getTransportFares();

    expect(result.monthlyPass).toBe(STATIC_TRANSPORT.monthlyPass);
    expect(result.singleRide).toBe(STATIC_TRANSPORT.singleRide);
    expect(result.taxiBase).toBe(STATIC_TRANSPORT.taxiBase);
  });
});

describe('constants', () => {
  it('CITY_CONFIGS: 두바이 포함', () => {
    expect(Object.keys(CITY_CONFIGS)).toHaveLength(1);
    expect(CITY_CONFIGS.dubai).toBeDefined();
  });

  it('두바이 설정에 필수 필드 포함', () => {
    const dubai = CITY_CONFIGS.dubai;
    expect(dubai.id).toBe('dubai');
    expect(dubai.name.ko).toBe('두바이');
    expect(dubai.name.en).toBe('Dubai');
    expect(dubai.country).toBe('AE');
    expect(dubai.currency).toBe('AED');
    expect(dubai.region).toBe('me');
    expect(dubai.transitOperator).toBe('RTA');
    expect(dubai.fareUrl).toContain('rta.ae');
  });

  it('STATIC_TRANSPORT: AED 단위 요금', () => {
    expect(STATIC_TRANSPORT.monthlyPass).toBeGreaterThan(0);
    expect(STATIC_TRANSPORT.singleRide).toBeGreaterThan(0);
    expect(STATIC_TRANSPORT.taxiBase).toBeGreaterThan(0);
  });

  it('SOURCE: RTA 명시', () => {
    expect(SOURCE.category).toBe('transport');
    expect(SOURCE.name).toContain('RTA');
    expect(SOURCE.url).toContain('rta.ae');
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
    const result = await refreshAeRta({ dryRun: true, useStatic: true });

    expect(result.source).toBe('ae_rta');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    await refreshAeRta({ dryRun: true, useStatic: true });

    const dubaiPath = path.join(testDir, 'cities', 'dubai.json');
    expect(fs.existsSync(dubaiPath)).toBe(false);
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    const result = await refreshAeRta({ dryRun: true, useStatic: true });

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

  it('두바이 처리', async () => {
    const result = await refreshAeRta({ dryRun: true, useStatic: true });

    const dubaiChanges = result.changes.filter((c: RefreshChange) => c.cityId === 'dubai');
    expect(dubaiChanges.length).toBeGreaterThan(0);

    const transportChanges = dubaiChanges.filter((c: RefreshChange) => c.field.startsWith('transport.'));
    expect(transportChanges.length).toBeGreaterThan(0);
  }, 30000);

  it('기존 데이터 대비 changes 계산', async () => {
    const existingData = {
      id: 'dubai',
      name: { ko: '두바이', en: 'Dubai' },
      country: 'AE',
      currency: 'AED',
      region: 'me',
      lastUpdated: '2026-04-01',
      rent: { share: 2500, studio: 5000, oneBed: 7000, twoBed: 10000 },
      food: { restaurantMeal: 40, cafe: 15, groceries: { milk1L: 6.0, eggs12: 13.0, rice1kg: 7.5, chicken1kg: 23.0, bread: 5.0 } },
      transport: { monthlyPass: 300, singleRide: 3.5, taxiBase: 10 },
      sources: [{ category: 'transport', name: 'RTA', url: 'https://rta.ae/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'dubai.json'),
      JSON.stringify(existingData),
    );

    const result = await refreshAeRta({ dryRun: true, useStatic: true, cities: ['dubai'] });

    expect(result.changes.length).toBeGreaterThan(0);
    const transportChange = result.changes.find((c: RefreshChange) => c.field.startsWith('transport.'));
    expect(transportChange).toBeDefined();
    expect(typeof transportChange?.pctChange).toBe('number');
  }, 30000);

  it('알 수 없는 도시: errors에 추가', async () => {
    const result = await refreshAeRta({ dryRun: true, useStatic: true, cities: ['unknown-city'] });

    expect(result.errors.some((e: RefreshError) => e.cityId === 'unknown-city')).toBe(true);
  }, 30000);

  it('페이지 불가 시 static fallback + errors에 추가', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await refreshAeRta({ dryRun: true, useStatic: false });

    expect(result.errors.some((e: RefreshError) => e.reason.includes('unavailable'))).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);
});
