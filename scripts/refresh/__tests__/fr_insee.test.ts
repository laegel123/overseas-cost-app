/**
 * fr_insee.mjs 테스트.
 * TESTING.md §9-A.3 인벤토리 — 프랑스.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshFrInsee, {
  parseInseeValue,
  getRentData,
  getGroceriesData,
  checkInseeApiStatus,
  CITY_CONFIGS,
  STATIC_RENT,
  STATIC_GROCERIES,
  STATIC_FOOD,
  SOURCE_RENT,
  SOURCE_FOOD,
} from '../fr_insee.mjs';
import type { RefreshChange, RefreshError } from './_test-types';

let originalDataDir: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-fr-insee-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = path.join(testDir, 'cities');
});

afterEach(() => {
  if (testDir && testDir.includes('test-fr-insee-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  jest.restoreAllMocks();
});

describe('parseInseeValue', () => {
  it('정상 응답 파싱: observations 배열', () => {
    const data = {
      observations: [{ value: '1200' }, { value: '1300' }, { value: '1400' }],
    };
    const result = parseInseeValue(data);
    expect(result).toBe(1400);
  });

  it('대문자 Observations 키 지원', () => {
    const data = {
      Observations: [{ value: '500' }],
    };
    const result = parseInseeValue(data);
    expect(result).toBe(500);
  });

  it('중첩 series.observations 지원', () => {
    const data = {
      series: { observations: [{ value: '750' }] },
    };
    const result = parseInseeValue(data);
    expect(result).toBe(750);
  });

  it('OBS_VALUE 키 지원', () => {
    const data = {
      observations: [{ OBS_VALUE: '900' }],
    };
    const result = parseInseeValue(data);
    expect(result).toBe(900);
  });

  it('빈 observations: null 반환', () => {
    expect(parseInseeValue({ observations: [] })).toBeNull();
  });

  it('null/undefined: null 반환', () => {
    expect(parseInseeValue(null)).toBeNull();
    expect(parseInseeValue(undefined)).toBeNull();
  });

  it('유효하지 않은 값: null 반환', () => {
    const data = { observations: [{ value: 'abc' }] };
    expect(parseInseeValue(data)).toBeNull();
  });

  it('음수 값: null 반환', () => {
    const data = { observations: [{ value: '-100' }] };
    expect(parseInseeValue(data)).toBeNull();
  });
});

describe('getRentData', () => {
  it('정적 rent 데이터 반환', () => {
    const result = getRentData();

    expect(result.share).toBe(STATIC_RENT.share);
    expect(result.studio).toBe(STATIC_RENT.studio);
    expect(result.oneBed).toBe(STATIC_RENT.oneBed);
    expect(result.twoBed).toBe(STATIC_RENT.twoBed);
  });

  it('모든 필드가 양수', () => {
    const result = getRentData();

    expect(result.share).toBeGreaterThan(0);
    expect(result.studio).toBeGreaterThan(0);
    expect(result.oneBed).toBeGreaterThan(0);
    expect(result.twoBed).toBeGreaterThan(0);
  });
});

describe('getGroceriesData', () => {
  it('정적 groceries 데이터 반환', () => {
    const result = getGroceriesData();

    expect(result.milk1L).toBe(STATIC_GROCERIES.milk1L);
    expect(result.eggs12).toBe(STATIC_GROCERIES.eggs12);
    expect(result.rice1kg).toBe(STATIC_GROCERIES.rice1kg);
  });

  it('모든 필드가 양수', () => {
    const result = getGroceriesData();

    expect(result.milk1L).toBeGreaterThan(0);
    expect(result.eggs12).toBeGreaterThan(0);
    expect(result.rice1kg).toBeGreaterThan(0);
    expect(result.chicken1kg).toBeGreaterThan(0);
    expect(result.bread).toBeGreaterThan(0);
    expect(result.onion1kg).toBeGreaterThan(0);
    expect(result.apple1kg).toBeGreaterThan(0);
    expect(result.ramen).toBeGreaterThan(0);
  });
});

describe('constants', () => {
  it('CITY_CONFIGS: 파리만 포함', () => {
    expect(Object.keys(CITY_CONFIGS)).toHaveLength(1);
    expect(CITY_CONFIGS.paris).toBeDefined();
  });

  it('파리 설정에 필수 필드 포함', () => {
    const paris = CITY_CONFIGS.paris;
    expect(paris.id).toBe('paris');
    expect(paris.name.ko).toBe('파리');
    expect(paris.name.en).toBe('Paris');
    expect(paris.country).toBe('FR');
    expect(paris.currency).toBe('EUR');
    expect(paris.region).toBe('eu');
  });

  it('STATIC_RENT 정의', () => {
    expect(STATIC_RENT.share).toBeDefined();
    expect(STATIC_RENT.studio).toBeDefined();
    expect(STATIC_RENT.oneBed).toBeDefined();
    expect(STATIC_RENT.twoBed).toBeDefined();
  });

  it('STATIC_GROCERIES 정의', () => {
    expect(STATIC_GROCERIES.milk1L).toBeDefined();
    expect(STATIC_GROCERIES.eggs12).toBeDefined();
    expect(STATIC_GROCERIES.bread).toBeDefined();
    expect(STATIC_GROCERIES.chicken1kg).toBeDefined();
  });

  it('SOURCE_RENT 정의', () => {
    expect(SOURCE_RENT.category).toBe('rent');
    expect(SOURCE_RENT.name).toContain('INSEE');
    expect(SOURCE_RENT.url).toContain('insee.fr');
  });

  it('SOURCE_FOOD 정의', () => {
    expect(SOURCE_FOOD.category).toBe('food');
    expect(SOURCE_FOOD.name).toContain('INSEE');
    expect(SOURCE_FOOD.url).toContain('insee.fr');
  });
});

describe('checkInseeApiStatus', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useRealTimers();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.useFakeTimers();
  });

  it('API 정상: true 반환', async () => {
    fetchSpy.mockResolvedValue({ ok: true });

    const result = await checkInseeApiStatus();

    expect(result).toBe(true);
  }, 30000);

  it('API 오류: false 반환', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await checkInseeApiStatus();

    expect(result).toBe(false);
  }, 30000);
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
    const result = await refreshFrInsee({ dryRun: true, useStatic: true });

    expect(result.source).toBe('fr_insee');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    await refreshFrInsee({ dryRun: true, useStatic: true });

    const parisPath = path.join(testDir, 'cities', 'paris.json');
    expect(fs.existsSync(parisPath)).toBe(false);
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    const result = await refreshFrInsee({ dryRun: true, useStatic: true });

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
      id: 'paris',
      name: { ko: '파리', en: 'Paris' },
      country: 'FR',
      currency: 'EUR',
      region: 'eu',
      lastUpdated: '2026-04-01',
      rent: { share: 600, studio: 1000, oneBed: 1200, twoBed: 1700 },
      food: { restaurantMeal: 14, cafe: 3.5, groceries: { milk1L: 1.1, eggs12: 3.2, rice1kg: 2.0, chicken1kg: 9.5, bread: 1.4 } },
      transport: { monthlyPass: 85, singleRide: 2.0, taxiBase: 4.0 },
      sources: [{ category: 'rent', name: 'INSEE', url: 'https://insee.fr/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'paris.json'),
      JSON.stringify(existingData),
    );

    const result = await refreshFrInsee({ dryRun: true, useStatic: true });

    expect(result.changes.length).toBeGreaterThan(0);
    const rentChange = result.changes.find((c: RefreshChange) => c.field.startsWith('rent.'));
    expect(rentChange).toBeDefined();
    expect(typeof rentChange?.pctChange).toBe('number');
  }, 30000);

  it('알 수 없는 도시: errors에 추가', async () => {
    const result = await refreshFrInsee({ dryRun: true, useStatic: true, cities: ['unknown-city'] });

    expect(result.errors.some((e: RefreshError) => e.cityId === 'unknown-city')).toBe(true);
  }, 30000);

  it('API 불가: errors에 추가 + static fallback', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await refreshFrInsee({ dryRun: true });

    expect(result.errors.some((e: RefreshError) => e.reason.includes('unavailable'))).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);
});
