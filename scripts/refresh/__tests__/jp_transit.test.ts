/**
 * jp_transit.mjs 테스트.
 * TESTING.md §9-A.8 인벤토리.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshJpTransit, {
  getTransportFares,
  checkTokyoMetroStatus,
  CITY_CONFIGS,
  STATIC_TRANSPORT,
  SOURCE,
} from '../jp_transit.mjs';

let originalDataDir: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-jp-transit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = path.join(testDir, 'cities');
});

afterEach(() => {
  if (testDir && testDir.includes('test-jp-transit-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  jest.restoreAllMocks();
});

describe('getTransportFares', () => {
  it('도쿄: 정적 요금 반환', () => {
    const result = getTransportFares('tokyo');

    expect(result.monthlyPass).toBe(STATIC_TRANSPORT.tokyo.monthlyPass);
    expect(result.singleRide).toBe(STATIC_TRANSPORT.tokyo.singleRide);
    expect(result.taxiBase).toBe(STATIC_TRANSPORT.tokyo.taxiBase);
  });

  it('오사카: 정적 요금 반환', () => {
    const result = getTransportFares('osaka');

    expect(result.monthlyPass).toBe(STATIC_TRANSPORT.osaka.monthlyPass);
    expect(result.singleRide).toBe(STATIC_TRANSPORT.osaka.singleRide);
    expect(result.taxiBase).toBe(STATIC_TRANSPORT.osaka.taxiBase);
  });

  it('알 수 없는 도시: 도쿄 fallback', () => {
    const result = getTransportFares('unknown');
    expect(result.monthlyPass).toBe(STATIC_TRANSPORT.tokyo.monthlyPass);
  });
});

describe('constants', () => {
  it('CITY_CONFIGS: 도쿄/오사카 포함', () => {
    expect(Object.keys(CITY_CONFIGS)).toHaveLength(2);
    expect(CITY_CONFIGS.tokyo).toBeDefined();
    expect(CITY_CONFIGS.osaka).toBeDefined();
  });

  it('도쿄 설정에 필수 필드 포함', () => {
    const tokyo = CITY_CONFIGS.tokyo;
    expect(tokyo.id).toBe('tokyo');
    expect(tokyo.name.ko).toBe('도쿄');
    expect(tokyo.name.en).toBe('Tokyo');
    expect(tokyo.country).toBe('JP');
    expect(tokyo.currency).toBe('JPY');
    expect(tokyo.region).toBe('asia');
  });

  it('오사카 설정에 필수 필드 포함', () => {
    const osaka = CITY_CONFIGS.osaka;
    expect(osaka.id).toBe('osaka');
    expect(osaka.name.ko).toBe('오사카');
  });

  it('STATIC_TRANSPORT: 도쿄/오사카 요금 (JPY 단위)', () => {
    expect(STATIC_TRANSPORT.tokyo.monthlyPass).toBeGreaterThan(5000);
    expect(STATIC_TRANSPORT.tokyo.singleRide).toBeGreaterThan(100);
    expect(STATIC_TRANSPORT.tokyo.taxiBase).toBeGreaterThan(400);

    expect(STATIC_TRANSPORT.osaka.monthlyPass).toBeGreaterThan(5000);
    expect(STATIC_TRANSPORT.osaka.singleRide).toBeGreaterThan(100);
    expect(STATIC_TRANSPORT.osaka.taxiBase).toBeGreaterThan(400);
  });

  it('SOURCE 정의', () => {
    expect(SOURCE.category).toBe('transport');
    expect(SOURCE.name).toContain('東京メトロ');
    expect(SOURCE.url).toContain('tokyometro.jp');
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
    const result = await refreshJpTransit({ dryRun: true, useStatic: true });

    expect(result.source).toBe('jp_transit');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    await refreshJpTransit({ dryRun: true, useStatic: true });

    const tokyoPath = path.join(testDir, 'cities', 'tokyo.json');
    expect(fs.existsSync(tokyoPath)).toBe(false);
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    const result = await refreshJpTransit({ dryRun: true, useStatic: true });

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

  it('도쿄/오사카 모두 처리', async () => {
    const result = await refreshJpTransit({ dryRun: true, useStatic: true });

    const tokyoChanges = result.changes.filter((c: any) => c.cityId === 'tokyo');
    const osakaChanges = result.changes.filter((c: any) => c.cityId === 'osaka');

    expect(tokyoChanges.length).toBeGreaterThan(0);
    expect(osakaChanges.length).toBeGreaterThan(0);
  }, 30000);

  it('기존 데이터 대비 changes 계산', async () => {
    const existingData = {
      id: 'tokyo',
      name: { ko: '도쿄', en: 'Tokyo' },
      country: 'JP',
      currency: 'JPY',
      region: 'asia',
      lastUpdated: '2026-04-01',
      rent: { share: 50000, studio: 70000, oneBed: 90000, twoBed: 130000 },
      food: { restaurantMeal: 1000, cafe: 400, groceries: { milk1L: 200, eggs12: 250, rice1kg: 400, chicken1kg: 800, bread: 150 } },
      transport: { monthlyPass: 10000, singleRide: 170, taxiBase: 450 },
      sources: [{ category: 'transport', name: 'Tokyo Metro', url: 'https://tokyometro.jp/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'tokyo.json'),
      JSON.stringify(existingData),
    );

    const result = await refreshJpTransit({ dryRun: true, useStatic: true, cities: ['tokyo'] });

    expect(result.changes.length).toBeGreaterThan(0);
    const transportChange = result.changes.find((c: any) => c.field.startsWith('transport.'));
    expect(transportChange).toBeDefined();
    expect(typeof transportChange?.pctChange).toBe('number');
  }, 30000);

  it('알 수 없는 도시: errors에 추가', async () => {
    const result = await refreshJpTransit({ dryRun: true, useStatic: true, cities: ['unknown-city'] });

    expect(result.errors.some((e: any) => e.cityId === 'unknown-city')).toBe(true);
  }, 30000);

  it('API 불가 시 static fallback + errors에 추가', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await refreshJpTransit({ dryRun: true, useStatic: false });

    expect(result.errors.some((e: any) => e.reason.includes('unavailable'))).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);
});
