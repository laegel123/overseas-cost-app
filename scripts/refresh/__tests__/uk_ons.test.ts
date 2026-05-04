/**
 * uk_ons.mjs 테스트.
 * TESTING.md §9-A.6 인벤토리.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshUkOns, {
  parseOnsValue,
  mapToRent,
  mapToGroceries,
  CITY_CONFIGS,
  ONS_RENT_SERIES,
  ONS_CPI_SERIES,
  STATIC_GROCERIES,
  STATIC_FOOD,
  SOURCE_RENT,
  SOURCE_FOOD,
} from '../uk_ons.mjs';

let originalDataDir: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-uk-ons-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = path.join(testDir, 'cities');
});

afterEach(() => {
  if (testDir && testDir.includes('test-uk-ons-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  jest.restoreAllMocks();
});

const VALID_ONS_RESPONSE = {
  observations: [
    { observation: '1500' },
    { observation: '1600' },
    { observation: '1700' },
  ],
};

describe('parseOnsValue', () => {
  it('정상 응답 파싱: 마지막 observation 값', () => {
    const result = parseOnsValue(VALID_ONS_RESPONSE);
    expect(result).toBe(1700);
  });

  it('빈 observations: null 반환', () => {
    const result = parseOnsValue({ observations: [] });
    expect(result).toBeNull();
  });

  it('null/undefined: null 반환', () => {
    expect(parseOnsValue(null)).toBeNull();
    expect(parseOnsValue(undefined)).toBeNull();
  });

  it('유효하지 않은 값: null 반환', () => {
    const data = { observations: [{ observation: 'abc' }] };
    const result = parseOnsValue(data);
    expect(result).toBeNull();
  });

  it('음수 값: null 반환', () => {
    const data = { observations: [{ observation: '-100' }] };
    const result = parseOnsValue(data);
    expect(result).toBeNull();
  });
});

describe('mapToRent', () => {
  it('정상 매핑: share = studio × 0.65', () => {
    const onsData = new Map<string, number | null>([
      ['studio', 1700],
      ['oneBed', 2100],
      ['twoBed', 2800],
    ]);

    const result = mapToRent(onsData);

    expect(result.studio).toBe(1700);
    expect(result.oneBed).toBe(2100);
    expect(result.twoBed).toBe(2800);
    expect(result.share).toBe(Math.round(1700 * 0.65));
  });

  it('데이터 부재: null 반환', () => {
    const onsData = new Map<string, number | null>();

    const result = mapToRent(onsData);

    expect(result.studio).toBeNull();
    expect(result.oneBed).toBeNull();
    expect(result.twoBed).toBeNull();
    expect(result.share).toBeNull();
  });

  it('일부 데이터만 있는 경우', () => {
    const onsData = new Map<string, number | null>([['studio', 1500]]);

    const result = mapToRent(onsData);

    expect(result.studio).toBe(1500);
    expect(result.share).toBe(Math.round(1500 * 0.65));
    expect(result.oneBed).toBeNull();
    expect(result.twoBed).toBeNull();
  });
});

describe('mapToGroceries', () => {
  it('CPI 데이터 + static fallback', () => {
    const cpiData = new Map<string, number | null>([
      ['milk1L', 1.60],
      ['eggs12', 3.80],
    ]);

    const result = mapToGroceries(cpiData);

    expect(result.milk1L).toBe(1.60);
    expect(result.eggs12).toBe(3.80);
    expect(result.rice1kg).toBe(STATIC_GROCERIES.rice1kg);
    expect(result.onion1kg).toBe(STATIC_GROCERIES.onion1kg);
  });

  it('CPI 데이터 부재: 기본값 사용', () => {
    const cpiData = new Map<string, number | null>();

    const result = mapToGroceries(cpiData);

    expect(result.milk1L).toBe(1.50);
    expect(result.eggs12).toBe(3.50);
    expect(result.rice1kg).toBe(STATIC_GROCERIES.rice1kg);
  });
});

describe('constants', () => {
  it('CITY_CONFIGS: 런던만 포함', () => {
    expect(Object.keys(CITY_CONFIGS)).toHaveLength(1);
    expect(CITY_CONFIGS.london).toBeDefined();
  });

  it('런던 설정에 필수 필드 포함', () => {
    const london = CITY_CONFIGS.london;
    expect(london.id).toBe('london');
    expect(london.name.ko).toBe('런던');
    expect(london.name.en).toBe('London');
    expect(london.country).toBe('GB');
    expect(london.currency).toBe('GBP');
    expect(london.region).toBe('eu');
  });

  it('ONS_RENT_SERIES 정의', () => {
    expect(ONS_RENT_SERIES.studio).toBeDefined();
    expect(ONS_RENT_SERIES.oneBed).toBeDefined();
    expect(ONS_RENT_SERIES.twoBed).toBeDefined();
  });

  it('ONS_CPI_SERIES 정의', () => {
    expect(ONS_CPI_SERIES.milk1L).toBeDefined();
    expect(ONS_CPI_SERIES.eggs12).toBeDefined();
    expect(ONS_CPI_SERIES.bread).toBeDefined();
    expect(ONS_CPI_SERIES.chicken1kg).toBeDefined();
  });

  it('SOURCE_RENT 정의', () => {
    expect(SOURCE_RENT.category).toBe('rent');
    expect(SOURCE_RENT.name).toContain('ONS');
    expect(SOURCE_RENT.url).toContain('ons.gov.uk');
  });

  it('SOURCE_FOOD 정의', () => {
    expect(SOURCE_FOOD.category).toBe('food');
    expect(SOURCE_FOOD.name).toContain('ONS');
    expect(SOURCE_FOOD.url).toContain('ons.gov.uk');
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
    const result = await refreshUkOns({ dryRun: true, useStatic: true });

    expect(result.source).toBe('uk_ons');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    await refreshUkOns({ dryRun: true, useStatic: true });

    const londonPath = path.join(testDir, 'cities', 'london.json');
    expect(fs.existsSync(londonPath)).toBe(false);
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    const result = await refreshUkOns({ dryRun: true, useStatic: true });

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
      id: 'london',
      name: { ko: '런던', en: 'London' },
      country: 'GB',
      currency: 'GBP',
      region: 'eu',
      lastUpdated: '2026-04-01',
      rent: { share: 1000, studio: 1500, oneBed: 1800, twoBed: 2200 },
      food: { restaurantMeal: 14, cafe: 3.5, groceries: { milk1L: 1.4, eggs12: 3.2, rice1kg: 2.0, chicken1kg: 5.5, bread: 1.3 } },
      transport: { monthlyPass: 160, singleRide: 2.7, taxiBase: 3.6 },
      sources: [{ category: 'rent', name: 'ONS', url: 'https://ons.gov.uk/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'london.json'),
      JSON.stringify(existingData),
    );

    const result = await refreshUkOns({ dryRun: true, useStatic: true });

    expect(result.changes.length).toBeGreaterThan(0);
    const rentChange = result.changes.find((c: any) => c.field.startsWith('rent.'));
    expect(rentChange).toBeDefined();
    expect(typeof rentChange?.pctChange).toBe('number');
  }, 30000);

  it('알 수 없는 도시: errors에 추가', async () => {
    const result = await refreshUkOns({ dryRun: true, useStatic: true, cities: ['unknown-city'] });

    expect(result.errors.some((e: any) => e.cityId === 'unknown-city')).toBe(true);
  }, 30000);
});
