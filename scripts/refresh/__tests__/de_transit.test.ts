/**
 * de_transit.mjs 테스트.
 * TESTING.md §9-A.7 인벤토리.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshDeTransit, {
  getTransportForCity,
  checkBvgFarePage,
  checkMvvFarePage,
  CITY_CONFIGS,
  STATIC_TRANSPORT,
  SOURCE,
} from '../de_transit.mjs';
import type { RefreshChange, RefreshError } from './_test-types';

let originalDataDir: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-de-transit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = path.join(testDir, 'cities');
});

afterEach(() => {
  if (testDir && testDir.includes('test-de-transit-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  jest.restoreAllMocks();
});

describe('getTransportForCity', () => {
  it('베를린: BVG 요금', () => {
    const result = getTransportForCity('berlin');

    expect(result.monthlyPass).toBe(STATIC_TRANSPORT.berlin.monthlyPass);
    expect(result.singleRide).toBe(STATIC_TRANSPORT.berlin.singleRide);
    expect(result.taxiBase).toBe(STATIC_TRANSPORT.berlin.taxiBase);
  });

  it('뮌헨: MVV 요금', () => {
    const result = getTransportForCity('munich');

    expect(result.monthlyPass).toBe(STATIC_TRANSPORT.munich.monthlyPass);
    expect(result.singleRide).toBe(STATIC_TRANSPORT.munich.singleRide);
    expect(result.taxiBase).toBe(STATIC_TRANSPORT.munich.taxiBase);
  });

  it('알 수 없는 도시: 베를린 기본값', () => {
    const result = getTransportForCity('unknown');

    expect(result.monthlyPass).toBe(STATIC_TRANSPORT.berlin.monthlyPass);
  });

  it('모든 필드가 양수', () => {
    for (const cityId of ['berlin', 'munich']) {
      const result = getTransportForCity(cityId);

      expect(result.monthlyPass).toBeGreaterThan(0);
      expect(result.singleRide).toBeGreaterThan(0);
      expect(result.taxiBase).toBeGreaterThan(0);
    }
  });
});

describe('checkBvgFarePage', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useRealTimers();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.useFakeTimers();
  });

  it('페이지 정상: true 반환', async () => {
    fetchSpy.mockResolvedValue({ ok: true });

    const result = await checkBvgFarePage();

    expect(result).toBe(true);
  }, 30000);

  it('페이지 오류: false 반환', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await checkBvgFarePage();

    expect(result).toBe(false);
  }, 30000);
});

describe('checkMvvFarePage', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useRealTimers();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.useFakeTimers();
  });

  it('페이지 정상: true 반환', async () => {
    fetchSpy.mockResolvedValue({ ok: true });

    const result = await checkMvvFarePage();

    expect(result).toBe(true);
  }, 30000);

  it('페이지 오류: false 반환', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await checkMvvFarePage();

    expect(result).toBe(false);
  }, 30000);
});

describe('constants', () => {
  it('CITY_CONFIGS: 베를린 + 뮌헨', () => {
    expect(Object.keys(CITY_CONFIGS)).toHaveLength(2);
    expect(CITY_CONFIGS.berlin).toBeDefined();
    expect(CITY_CONFIGS.munich).toBeDefined();
  });

  it('각 도시 설정에 필수 필드 포함', () => {
    for (const [cityId, config] of Object.entries(CITY_CONFIGS)) {
      expect(config.id).toBe(cityId);
      expect(config.name.ko).toBeDefined();
      expect(config.name.en).toBeDefined();
      expect(config.country).toBe('DE');
      expect(config.currency).toBe('EUR');
      expect(config.region).toBe('eu');
      expect(config.transitOperator).toBeDefined();
      expect(config.fareUrl).toBeDefined();
    }
  });

  it('베를린: BVG, 뮌헨: MVV', () => {
    expect(CITY_CONFIGS.berlin.transitOperator).toBe('BVG');
    expect(CITY_CONFIGS.munich.transitOperator).toBe('MVV');
  });

  it('STATIC_TRANSPORT: 베를린 + 뮌헨', () => {
    expect(STATIC_TRANSPORT.berlin).toBeDefined();
    expect(STATIC_TRANSPORT.munich).toBeDefined();
  });

  it('SOURCE 정의', () => {
    expect(SOURCE.category).toBe('transport');
    expect(SOURCE.name).toContain('BVG');
    expect(SOURCE.name).toContain('MVV');
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
    const result = await refreshDeTransit({ dryRun: true, useStatic: true });

    expect(result.source).toBe('de_transit');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    await refreshDeTransit({ dryRun: true, useStatic: true });

    const berlinPath = path.join(testDir, 'cities', 'berlin.json');
    const munichPath = path.join(testDir, 'cities', 'munich.json');
    expect(fs.existsSync(berlinPath)).toBe(false);
    expect(fs.existsSync(munichPath)).toBe(false);
  }, 30000);

  it('특정 도시만 갱신', async () => {
    const result = await refreshDeTransit({ dryRun: true, useStatic: true, cities: ['munich'] });

    const berlinChanges = result.changes.filter((c: RefreshChange) => c.cityId === 'berlin');
    const munichChanges = result.changes.filter((c: RefreshChange) => c.cityId === 'munich');

    expect(munichChanges.length).toBeGreaterThan(0);
    expect(berlinChanges.length).toBe(0);
  }, 30000);

  it('BVG/MVV 불가: errors에 추가 + static fallback', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await refreshDeTransit({ dryRun: true });

    expect(result.errors.some((e: RefreshError) => e.reason.includes('unavailable'))).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    const result = await refreshDeTransit({ dryRun: true, useStatic: true });

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

  it('기존 데이터 대비 changes 계산', async () => {
    const existingData = {
      id: 'berlin',
      name: { ko: '베를린', en: 'Berlin' },
      country: 'DE',
      currency: 'EUR',
      region: 'eu',
      lastUpdated: '2026-04-01',
      rent: { share: 500, studio: 800, oneBed: 950, twoBed: 1300 },
      food: { restaurantMeal: 11, cafe: 3.2, groceries: { milk1L: 1.0, eggs12: 2.5, rice1kg: 2.3, chicken1kg: 7.5, bread: 1.6 } },
      transport: { monthlyPass: 80, singleRide: 3.0, taxiBase: 3.8 },
      sources: [{ category: 'transport', name: 'BVG', url: 'https://bvg.de/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'berlin.json'),
      JSON.stringify(existingData),
    );

    const result = await refreshDeTransit({ dryRun: true, useStatic: true, cities: ['berlin'] });

    expect(result.changes.length).toBeGreaterThan(0);
    const transportChange = result.changes.find((c: RefreshChange) => c.field.startsWith('transport.'));
    expect(transportChange).toBeDefined();
    expect(typeof transportChange?.pctChange).toBe('number');
  }, 30000);

  it('알 수 없는 도시: errors에 추가', async () => {
    const result = await refreshDeTransit({ dryRun: true, useStatic: true, cities: ['unknown-city'] });

    expect(result.errors.some((e: RefreshError) => e.cityId === 'unknown-city')).toBe(true);
  }, 30000);
});
