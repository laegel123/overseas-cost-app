/**
 * sg_singstat.mjs 테스트.
 * TESTING.md §9-A.8 인벤토리.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshSgSingstat, {
  parseSingStatValue,
  checkSingStatStatus,
  mapToRent,
  mapToGroceries,
  CITY_CONFIGS,
  STATIC_RENT,
  STATIC_GROCERIES,
  STATIC_FOOD,
  SOURCE_RENT,
  SOURCE_FOOD,
} from '../sg_singstat.mjs';

let originalDataDir: string | undefined;
let originalSgDataGovKey: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-sg-singstat-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  originalSgDataGovKey = process.env.SG_DATA_GOV_KEY;
  process.env.DATA_DIR = path.join(testDir, 'cities');
  delete process.env.SG_DATA_GOV_KEY;
});

afterEach(() => {
  if (testDir && testDir.includes('test-sg-singstat-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  if (originalSgDataGovKey !== undefined) {
    process.env.SG_DATA_GOV_KEY = originalSgDataGovKey;
  } else {
    delete process.env.SG_DATA_GOV_KEY;
  }
  jest.restoreAllMocks();
});

const VALID_SINGSTAT_RESPONSE = {
  Data: {
    row: [
      { columns: [{ key: 'value', value: '100.5' }] },
      { columns: [{ key: 'value', value: '105.2' }] },
      { columns: [{ key: 'value', value: '110.3' }] },
    ],
  },
};

describe('parseSingStatValue', () => {
  it('정상 응답 파싱: 마지막 row 값', () => {
    const result = parseSingStatValue(VALID_SINGSTAT_RESPONSE);
    expect(result).toBe(110.3);
  });

  it('빈 row 배열: null 반환', () => {
    const data = { Data: { row: [] } };
    const result = parseSingStatValue(data);
    expect(result).toBeNull();
  });

  it('null/undefined: null 반환', () => {
    expect(parseSingStatValue(null)).toBeNull();
    expect(parseSingStatValue(undefined)).toBeNull();
  });

  it('유효하지 않은 구조: null 반환', () => {
    expect(parseSingStatValue({})).toBeNull();
    expect(parseSingStatValue({ Data: {} })).toBeNull();
  });

  it('유효하지 않은 값: null 반환', () => {
    const data = {
      Data: {
        row: [{ columns: [{ key: 'value', value: 'abc' }] }],
      },
    };
    const result = parseSingStatValue(data);
    expect(result).toBeNull();
  });
});

describe('mapToRent', () => {
  it('정적 임대료 반환', () => {
    const result = mapToRent();

    expect(result.share).toBe(STATIC_RENT.share);
    expect(result.studio).toBe(STATIC_RENT.studio);
    expect(result.oneBed).toBe(STATIC_RENT.oneBed);
    expect(result.twoBed).toBe(STATIC_RENT.twoBed);
  });
});

describe('mapToGroceries', () => {
  it('정적 식재료 가격 반환', () => {
    const result = mapToGroceries();

    expect(result.milk1L).toBe(STATIC_GROCERIES.milk1L);
    expect(result.eggs12).toBe(STATIC_GROCERIES.eggs12);
    expect(result.rice1kg).toBe(STATIC_GROCERIES.rice1kg);
    expect(result.chicken1kg).toBe(STATIC_GROCERIES.chicken1kg);
    expect(result.bread).toBe(STATIC_GROCERIES.bread);
    expect(result.onion1kg).toBe(STATIC_GROCERIES.onion1kg);
    expect(result.apple1kg).toBe(STATIC_GROCERIES.apple1kg);
    expect(result.ramen).toBe(STATIC_GROCERIES.ramen);
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
  });

  it('STATIC_RENT: 싱가포르 임대료 (SGD 단위)', () => {
    expect(STATIC_RENT.share).toBeGreaterThan(0);
    expect(STATIC_RENT.studio).toBeGreaterThan(STATIC_RENT.share);
    expect(STATIC_RENT.oneBed).toBeGreaterThan(STATIC_RENT.studio);
    expect(STATIC_RENT.twoBed).toBeGreaterThan(STATIC_RENT.oneBed);
  });

  it('STATIC_FOOD: 싱가포르 외식비 + hawker', () => {
    expect(STATIC_FOOD.restaurantMeal).toBeGreaterThan(0);
    expect(STATIC_FOOD.cafe).toBeGreaterThan(0);
    expect(STATIC_FOOD.hawkerMeal).toBeGreaterThan(0);
    expect(STATIC_FOOD.hawkerMeal).toBeLessThan(STATIC_FOOD.restaurantMeal);
  });

  it('SOURCE_RENT 정의', () => {
    expect(SOURCE_RENT.category).toBe('rent');
    expect(SOURCE_RENT.name).toContain('SingStat');
    expect(SOURCE_RENT.url).toContain('singstat.gov.sg');
  });

  it('SOURCE_FOOD 정의', () => {
    expect(SOURCE_FOOD.category).toBe('food');
    expect(SOURCE_FOOD.name).toContain('SingStat');
    expect(SOURCE_FOOD.url).toContain('singstat.gov.sg');
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
    const result = await refreshSgSingstat({ dryRun: true, useStatic: true });

    expect(result.source).toBe('sg_singstat');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    await refreshSgSingstat({ dryRun: true, useStatic: true });

    const sgPath = path.join(testDir, 'cities', 'singapore.json');
    expect(fs.existsSync(sgPath)).toBe(false);
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    const result = await refreshSgSingstat({ dryRun: true, useStatic: true });

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
    const result = await refreshSgSingstat({ dryRun: true, useStatic: true });

    const sgChanges = result.changes.filter((c: any) => c.cityId === 'singapore');
    expect(sgChanges.length).toBeGreaterThan(0);
  }, 30000);

  it('SG_DATA_GOV_KEY 미설정 시 errors에 추가 (useStatic=false)', async () => {
    const result = await refreshSgSingstat({ dryRun: true, useStatic: false });

    expect(result.errors.some((e: any) => e.reason.includes('SG_DATA_GOV_KEY'))).toBe(true);
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
      transport: { monthlyPass: 120, singleRide: 1.0, taxiBase: 3.5 },
      sources: [{ category: 'rent', name: 'SingStat', url: 'https://singstat.gov.sg/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'singapore.json'),
      JSON.stringify(existingData),
    );

    const result = await refreshSgSingstat({ dryRun: true, useStatic: true, cities: ['singapore'] });

    expect(result.changes.length).toBeGreaterThan(0);
    const rentChange = result.changes.find((c: any) => c.field.startsWith('rent.'));
    expect(rentChange).toBeDefined();
    expect(typeof rentChange?.pctChange).toBe('number');
  }, 30000);

  it('알 수 없는 도시: errors에 추가', async () => {
    const result = await refreshSgSingstat({ dryRun: true, useStatic: true, cities: ['unknown-city'] });

    expect(result.errors.some((e: any) => e.cityId === 'unknown-city')).toBe(true);
  }, 30000);
});
