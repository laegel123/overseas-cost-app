/**
 * au_abs.mjs 테스트.
 * TESTING.md §9-A.8 인벤토리.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshAuAbs, {
  parseAbsValue,
  mapToRent,
  mapToGroceries,
  weeklyToMonthly,
  CITY_CONFIGS,
  STATIC_RENT,
  STATIC_GROCERIES,
  STATIC_FOOD,
  SOURCE_RENT,
  SOURCE_FOOD,
} from '../au_abs.mjs';
import type { RefreshChange, RefreshError } from './_test-types';

let originalDataDir: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-au-abs-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = path.join(testDir, 'cities');
});

afterEach(() => {
  if (testDir && testDir.includes('test-au-abs-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  jest.restoreAllMocks();
});

const VALID_ABS_RESPONSE = {
  dataSets: [
    {
      observations: {
        '0': [1500],
        '1': [1600],
        '2': [1700],
      },
    },
  ],
};

describe('parseAbsValue', () => {
  it('정상 응답 파싱: 마지막 observation 값', () => {
    const result = parseAbsValue(VALID_ABS_RESPONSE);
    expect(result).toBe(1700);
  });

  it('빈 observations: null 반환', () => {
    const result = parseAbsValue({ dataSets: [{ observations: {} }] });
    expect(result).toBeNull();
  });

  it('null/undefined: null 반환', () => {
    expect(parseAbsValue(null)).toBeNull();
    expect(parseAbsValue(undefined)).toBeNull();
  });

  it('유효하지 않은 구조: null 반환', () => {
    expect(parseAbsValue({})).toBeNull();
    expect(parseAbsValue({ dataSets: [] })).toBeNull();
  });
});

describe('weeklyToMonthly', () => {
  it('주간 임대료 → 월간 환산 (× 4.33)', () => {
    expect(weeklyToMonthly(250)).toBe(Math.round(250 * 4.33));
    expect(weeklyToMonthly(450)).toBe(Math.round(450 * 4.33));
  });

  it('정수 반올림', () => {
    const result = weeklyToMonthly(100);
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe('mapToRent', () => {
  it('시드니: 주간 → 월간 환산된 임대료', () => {
    const result = mapToRent('sydney');

    expect(result.share).toBe(weeklyToMonthly(STATIC_RENT.sydney.share));
    expect(result.studio).toBe(weeklyToMonthly(STATIC_RENT.sydney.studio));
    expect(result.oneBed).toBe(weeklyToMonthly(STATIC_RENT.sydney.oneBed));
    expect(result.twoBed).toBe(weeklyToMonthly(STATIC_RENT.sydney.twoBed));
  });

  it('멜버른: 주간 → 월간 환산된 임대료', () => {
    const result = mapToRent('melbourne');

    expect(result.share).toBe(weeklyToMonthly(STATIC_RENT.melbourne.share));
    expect(result.studio).toBe(weeklyToMonthly(STATIC_RENT.melbourne.studio));
  });

  it('알 수 없는 도시: 시드니 fallback', () => {
    const result = mapToRent('unknown');
    expect(result.share).toBe(weeklyToMonthly(STATIC_RENT.sydney.share));
  });
});

describe('mapToGroceries', () => {
  it('CPI 데이터 + static fallback', () => {
    const cpiData = new Map<string, number | null>([
      ['milk1L', 2.60],
      ['eggs12', 6.80],
    ]);

    const result = mapToGroceries(cpiData);

    expect(result.milk1L).toBe(2.60);
    expect(result.eggs12).toBe(6.80);
    expect(result.rice1kg).toBe(STATIC_GROCERIES.rice1kg);
    expect(result.onion1kg).toBe(STATIC_GROCERIES.onion1kg);
  });

  it('CPI 데이터 부재: 기본값 사용', () => {
    const cpiData = new Map<string, number | null>();

    const result = mapToGroceries(cpiData);

    expect(result.milk1L).toBe(2.50);
    expect(result.eggs12).toBe(6.50);
    expect(result.rice1kg).toBe(STATIC_GROCERIES.rice1kg);
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
    expect(melbourne.name.en).toBe('Melbourne');
  });

  it('SOURCE_RENT 정의', () => {
    expect(SOURCE_RENT.category).toBe('rent');
    expect(SOURCE_RENT.name).toContain('ABS');
    expect(SOURCE_RENT.url).toContain('abs.gov.au');
  });

  it('SOURCE_FOOD 정의', () => {
    expect(SOURCE_FOOD.category).toBe('food');
    expect(SOURCE_FOOD.name).toContain('ABS');
    expect(SOURCE_FOOD.url).toContain('abs.gov.au');
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
    const result = await refreshAuAbs({ dryRun: true, useStatic: true });

    expect(result.source).toBe('au_abs');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    await refreshAuAbs({ dryRun: true, useStatic: true });

    const sydneyPath = path.join(testDir, 'cities', 'sydney.json');
    expect(fs.existsSync(sydneyPath)).toBe(false);
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    const result = await refreshAuAbs({ dryRun: true, useStatic: true });

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
    const result = await refreshAuAbs({ dryRun: true, useStatic: true });

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
      sources: [{ category: 'rent', name: 'ABS', url: 'https://abs.gov.au/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'sydney.json'),
      JSON.stringify(existingData),
    );

    const result = await refreshAuAbs({ dryRun: true, useStatic: true, cities: ['sydney'] });

    expect(result.changes.length).toBeGreaterThan(0);
    const rentChange = result.changes.find((c: RefreshChange) => c.field.startsWith('rent.'));
    expect(rentChange).toBeDefined();
    expect(typeof rentChange?.pctChange).toBe('number');
  }, 30000);

  it('알 수 없는 도시: errors에 추가', async () => {
    const result = await refreshAuAbs({ dryRun: true, useStatic: true, cities: ['unknown-city'] });

    expect(result.errors.some((e: RefreshError) => e.cityId === 'unknown-city')).toBe(true);
  }, 30000);
});
