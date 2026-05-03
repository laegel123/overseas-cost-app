/**
 * ae_fcsc.mjs 테스트.
 * TESTING.md §9-A.8 인벤토리.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshAeFcsc, {
  checkDscStatus,
  checkFcscStatus,
  mapToRent,
  mapToGroceries,
  CITY_CONFIGS,
  STATIC_RENT,
  STATIC_GROCERIES,
  STATIC_FOOD,
  SOURCE_RENT,
  SOURCE_FOOD,
} from '../ae_fcsc.mjs';

let originalDataDir: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-ae-fcsc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = path.join(testDir, 'cities');
});

afterEach(() => {
  if (testDir && testDir.includes('test-ae-fcsc-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  jest.restoreAllMocks();
});

describe('mapToRent', () => {
  it('정적 임대료 반환 (AED 단위)', () => {
    const result = mapToRent();

    expect(result.share).toBe(STATIC_RENT.share);
    expect(result.studio).toBe(STATIC_RENT.studio);
    expect(result.oneBed).toBe(STATIC_RENT.oneBed);
    expect(result.twoBed).toBe(STATIC_RENT.twoBed);
  });
});

describe('mapToGroceries', () => {
  it('정적 식재료 가격 반환 (AED 단위)', () => {
    const result = mapToGroceries();

    expect(result.milk1L).toBe(STATIC_GROCERIES.milk1L);
    expect(result.eggs12).toBe(STATIC_GROCERIES.eggs12);
    expect(result.rice1kg).toBe(STATIC_GROCERIES.rice1kg);
    expect(result.chicken1kg).toBe(STATIC_GROCERIES.chicken1kg);
    expect(result.bread).toBe(STATIC_GROCERIES.bread);
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
  });

  it('STATIC_RENT: 두바이 임대료 (AED 단위)', () => {
    expect(STATIC_RENT.share).toBeGreaterThan(0);
    expect(STATIC_RENT.studio).toBeGreaterThan(STATIC_RENT.share);
    expect(STATIC_RENT.oneBed).toBeGreaterThan(STATIC_RENT.studio);
    expect(STATIC_RENT.twoBed).toBeGreaterThan(STATIC_RENT.oneBed);
  });

  it('STATIC_FOOD: 두바이 외식비 (AED 단위)', () => {
    expect(STATIC_FOOD.restaurantMeal).toBeGreaterThan(0);
    expect(STATIC_FOOD.cafe).toBeGreaterThan(0);
    expect(STATIC_FOOD.restaurantMeal).toBeGreaterThan(STATIC_FOOD.cafe);
  });

  it('SOURCE_RENT: DSC + RERA 명시', () => {
    expect(SOURCE_RENT.category).toBe('rent');
    expect(SOURCE_RENT.name).toContain('DSC');
    expect(SOURCE_RENT.name).toContain('RERA');
    expect(SOURCE_RENT.url).toContain('dsc.gov.ae');
  });

  it('SOURCE_FOOD: FCSC 명시', () => {
    expect(SOURCE_FOOD.category).toBe('food');
    expect(SOURCE_FOOD.name).toContain('FCSC');
    expect(SOURCE_FOOD.url).toContain('fcsc.gov.ae');
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

  it('useStatic=true: 정상 동작', async () => {
    const result = await refreshAeFcsc({ dryRun: true, useStatic: true });

    expect(result.source).toBe('ae_fcsc');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    await refreshAeFcsc({ dryRun: true, useStatic: true });

    const dubaiPath = path.join(testDir, 'cities', 'dubai.json');
    expect(fs.existsSync(dubaiPath)).toBe(false);
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    const result = await refreshAeFcsc({ dryRun: true, useStatic: true });

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

  it('두바이 처리 (rent + food)', async () => {
    const result = await refreshAeFcsc({ dryRun: true, useStatic: true });

    const dubaiChanges = result.changes.filter((c: any) => c.cityId === 'dubai');
    expect(dubaiChanges.length).toBeGreaterThan(0);

    const rentChanges = dubaiChanges.filter((c: any) => c.field.startsWith('rent.'));
    const foodChanges = dubaiChanges.filter((c: any) => c.field.startsWith('food.'));

    expect(rentChanges.length).toBeGreaterThan(0);
    expect(foodChanges.length).toBeGreaterThan(0);
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
      sources: [{ category: 'rent', name: 'DSC', url: 'https://dsc.gov.ae/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'dubai.json'),
      JSON.stringify(existingData),
    );

    const result = await refreshAeFcsc({ dryRun: true, useStatic: true, cities: ['dubai'] });

    expect(result.changes.length).toBeGreaterThan(0);
    const rentChange = result.changes.find((c: any) => c.field.startsWith('rent.'));
    expect(rentChange).toBeDefined();
    expect(typeof rentChange?.pctChange).toBe('number');
  }, 30000);

  it('알 수 없는 도시: errors에 추가', async () => {
    const result = await refreshAeFcsc({ dryRun: true, useStatic: true, cities: ['unknown-city'] });

    expect(result.errors.some((e: any) => e.cityId === 'unknown-city')).toBe(true);
  }, 30000);

  it('DSC/FCSC 불가 시 static fallback + errors에 추가', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await refreshAeFcsc({ dryRun: true, useStatic: false });

    expect(result.errors.some((e: any) => e.reason.includes('unavailable'))).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);
});
