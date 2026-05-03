/**
 * vn_gso.mjs 테스트.
 * TESTING.md §9-A.8 인벤토리.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshVnGso, {
  checkGsoStatus,
  mapToRent,
  mapToGroceries,
  getTransportFares,
  CITY_CONFIGS,
  STATIC_RENT,
  STATIC_GROCERIES,
  STATIC_FOOD,
  STATIC_TRANSPORT,
  SOURCE_RENT,
  SOURCE_FOOD,
  SOURCE_TRANSPORT,
} from '../vn_gso.mjs';

let originalDataDir: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-vn-gso-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = path.join(testDir, 'cities');
});

afterEach(() => {
  if (testDir && testDir.includes('test-vn-gso-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  jest.restoreAllMocks();
});

describe('mapToRent', () => {
  it('정적 임대료 반환 (VND 단위)', () => {
    const result = mapToRent();

    expect(result.share).toBe(STATIC_RENT.share);
    expect(result.studio).toBe(STATIC_RENT.studio);
    expect(result.oneBed).toBe(STATIC_RENT.oneBed);
    expect(result.twoBed).toBe(STATIC_RENT.twoBed);
    expect(result.share).toBeGreaterThan(1000000);
  });
});

describe('mapToGroceries', () => {
  it('정적 식재료 가격 반환 (VND 단위)', () => {
    const result = mapToGroceries();

    expect(result.milk1L).toBe(STATIC_GROCERIES.milk1L);
    expect(result.eggs12).toBe(STATIC_GROCERIES.eggs12);
    expect(result.rice1kg).toBe(STATIC_GROCERIES.rice1kg);
    expect(result.chicken1kg).toBe(STATIC_GROCERIES.chicken1kg);
    expect(result.bread).toBe(STATIC_GROCERIES.bread);
    expect(result.milk1L).toBeGreaterThan(10000);
  });
});

describe('getTransportFares', () => {
  it('정적 요금 반환 (VND 단위)', () => {
    const result = getTransportFares();

    expect(result.monthlyPass).toBe(STATIC_TRANSPORT.monthlyPass);
    expect(result.singleRide).toBe(STATIC_TRANSPORT.singleRide);
    expect(result.taxiBase).toBe(STATIC_TRANSPORT.taxiBase);
    expect(result.monthlyPass).toBeGreaterThan(100000);
  });
});

describe('constants', () => {
  it('CITY_CONFIGS: 호치민 포함', () => {
    expect(Object.keys(CITY_CONFIGS)).toHaveLength(1);
    expect(CITY_CONFIGS.hochiminh).toBeDefined();
  });

  it('호치민 설정에 필수 필드 포함', () => {
    const hcm = CITY_CONFIGS.hochiminh;
    expect(hcm.id).toBe('hochiminh');
    expect(hcm.name.ko).toBe('호치민');
    expect(hcm.name.en).toBe('Ho Chi Minh City');
    expect(hcm.country).toBe('VN');
    expect(hcm.currency).toBe('VND');
    expect(hcm.region).toBe('asia');
  });

  it('STATIC_RENT: 호치민 임대료 (VND 단위, 큰 수)', () => {
    expect(STATIC_RENT.share).toBeGreaterThan(1000000);
    expect(STATIC_RENT.studio).toBeGreaterThan(STATIC_RENT.share);
    expect(STATIC_RENT.oneBed).toBeGreaterThan(STATIC_RENT.studio);
    expect(STATIC_RENT.twoBed).toBeGreaterThan(STATIC_RENT.oneBed);
  });

  it('SOURCE_RENT: estimated 마커 포함', () => {
    expect(SOURCE_RENT.category).toBe('rent');
    expect(SOURCE_RENT.name).toContain('GSO');
    expect(SOURCE_RENT.name).toContain('estimated');
    expect(SOURCE_RENT.url).toContain('gso.gov.vn');
  });

  it('SOURCE_FOOD: estimated 마커 포함', () => {
    expect(SOURCE_FOOD.category).toBe('food');
    expect(SOURCE_FOOD.name).toContain('GSO');
    expect(SOURCE_FOOD.name).toContain('estimated');
    expect(SOURCE_FOOD.url).toContain('gso.gov.vn');
  });

  it('SOURCE_TRANSPORT: 정적 추정 명시', () => {
    expect(SOURCE_TRANSPORT.category).toBe('transport');
    expect(SOURCE_TRANSPORT.name).toContain('static');
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
    const result = await refreshVnGso({ dryRun: true, useStatic: true });

    expect(result.source).toBe('vn_gso');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    await refreshVnGso({ dryRun: true, useStatic: true });

    const hcmPath = path.join(testDir, 'cities', 'hochiminh.json');
    expect(fs.existsSync(hcmPath)).toBe(false);
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    const result = await refreshVnGso({ dryRun: true, useStatic: true });

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

  it('호치민 처리 (rent + food + transport)', async () => {
    const result = await refreshVnGso({ dryRun: true, useStatic: true });

    const hcmChanges = result.changes.filter((c: any) => c.cityId === 'hochiminh');
    expect(hcmChanges.length).toBeGreaterThan(0);

    const rentChanges = hcmChanges.filter((c: any) => c.field.startsWith('rent.'));
    const foodChanges = hcmChanges.filter((c: any) => c.field.startsWith('food.'));
    const transportChanges = hcmChanges.filter((c: any) => c.field.startsWith('transport.'));

    expect(rentChanges.length).toBeGreaterThan(0);
    expect(foodChanges.length).toBeGreaterThan(0);
    expect(transportChanges.length).toBeGreaterThan(0);
  }, 30000);

  it('GSO 도시 단위 데이터 부재 경고 errors에 포함', async () => {
    const result = await refreshVnGso({ dryRun: true, useStatic: true });

    expect(result.errors.some((e: any) => e.reason.includes('도시 단위 데이터 부재'))).toBe(true);
  }, 30000);

  it('기존 데이터 대비 changes 계산', async () => {
    const existingData = {
      id: 'hochiminh',
      name: { ko: '호치민', en: 'Ho Chi Minh City' },
      country: 'VN',
      currency: 'VND',
      region: 'asia',
      lastUpdated: '2026-04-01',
      rent: { share: 4000000, studio: 7000000, oneBed: 10000000, twoBed: 15000000 },
      food: { restaurantMeal: 70000, cafe: 40000, groceries: { milk1L: 30000, eggs12: 40000, rice1kg: 18000, chicken1kg: 75000, bread: 20000 } },
      transport: { monthlyPass: 180000, singleRide: 6000, taxiBase: 10000 },
      sources: [{ category: 'rent', name: 'GSO', url: 'https://gso.gov.vn/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'hochiminh.json'),
      JSON.stringify(existingData),
    );

    const result = await refreshVnGso({ dryRun: true, useStatic: true, cities: ['hochiminh'] });

    expect(result.changes.length).toBeGreaterThan(0);
    const rentChange = result.changes.find((c: any) => c.field.startsWith('rent.'));
    expect(rentChange).toBeDefined();
    expect(typeof rentChange?.pctChange).toBe('number');
  }, 30000);

  it('알 수 없는 도시: errors에 추가', async () => {
    const result = await refreshVnGso({ dryRun: true, useStatic: true, cities: ['unknown-city'] });

    expect(result.errors.some((e: any) => e.cityId === 'unknown-city')).toBe(true);
  }, 30000);
});
