/**
 * nl_cbs.mjs 테스트.
 * TESTING.md §9-A.3 인벤토리 — 네덜란드.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshNlCbs, {
  parseCbsValue,
  getRentData,
  getGroceriesData,
  checkCbsApiStatus,
  CITY_CONFIGS,
  STATIC_RENT,
  STATIC_GROCERIES,
  STATIC_FOOD,
  SOURCE_RENT,
  SOURCE_FOOD,
} from '../nl_cbs.mjs';

let originalDataDir: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-nl-cbs-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = path.join(testDir, 'cities');
});

afterEach(() => {
  if (testDir && testDir.includes('test-nl-cbs-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  jest.restoreAllMocks();
});

describe('parseCbsValue', () => {
  it('OData v4 응답 파싱: value 배열', () => {
    const data = {
      value: [{ value: '1100' }, { value: '1200' }, { value: '1300' }],
    };
    const result = parseCbsValue(data);
    expect(result).toBe(1300);
  });

  it('OData v3 응답 파싱: d.results', () => {
    const data = {
      d: { results: [{ value: '800' }] },
    };
    const result = parseCbsValue(data);
    expect(result).toBe(800);
  });

  it('Value 키 (대문자) 지원', () => {
    const data = {
      value: [{ Value: '950' }],
    };
    const result = parseCbsValue(data);
    expect(result).toBe(950);
  });

  it('Waarde 키 (네덜란드어) 지원', () => {
    const data = {
      value: [{ Waarde: '1050' }],
    };
    const result = parseCbsValue(data);
    expect(result).toBe(1050);
  });

  it('빈 value 배열: null 반환', () => {
    expect(parseCbsValue({ value: [] })).toBeNull();
  });

  it('null/undefined: null 반환', () => {
    expect(parseCbsValue(null)).toBeNull();
    expect(parseCbsValue(undefined)).toBeNull();
  });

  it('유효하지 않은 값: null 반환', () => {
    const data = { value: [{ value: 'abc' }] };
    expect(parseCbsValue(data)).toBeNull();
  });

  it('음수 값: null 반환', () => {
    const data = { value: [{ value: '-100' }] };
    expect(parseCbsValue(data)).toBeNull();
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
  it('CITY_CONFIGS: 암스테르담만 포함', () => {
    expect(Object.keys(CITY_CONFIGS)).toHaveLength(1);
    expect(CITY_CONFIGS.amsterdam).toBeDefined();
  });

  it('암스테르담 설정에 필수 필드 포함', () => {
    const amsterdam = CITY_CONFIGS.amsterdam;
    expect(amsterdam.id).toBe('amsterdam');
    expect(amsterdam.name.ko).toBe('암스테르담');
    expect(amsterdam.name.en).toBe('Amsterdam');
    expect(amsterdam.country).toBe('NL');
    expect(amsterdam.currency).toBe('EUR');
    expect(amsterdam.region).toBe('eu');
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
    expect(SOURCE_RENT.name).toContain('CBS');
    expect(SOURCE_RENT.url).toContain('cbs.nl');
  });

  it('SOURCE_FOOD 정의', () => {
    expect(SOURCE_FOOD.category).toBe('food');
    expect(SOURCE_FOOD.name).toContain('CBS');
    expect(SOURCE_FOOD.url).toContain('cbs.nl');
  });
});

describe('checkCbsApiStatus', () => {
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

    const result = await checkCbsApiStatus();

    expect(result).toBe(true);
  }, 30000);

  it('API 오류: false 반환', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await checkCbsApiStatus();

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
    const result = await refreshNlCbs({ dryRun: true, useStatic: true });

    expect(result.source).toBe('nl_cbs');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    await refreshNlCbs({ dryRun: true, useStatic: true });

    const amsterdamPath = path.join(testDir, 'cities', 'amsterdam.json');
    expect(fs.existsSync(amsterdamPath)).toBe(false);
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    const result = await refreshNlCbs({ dryRun: true, useStatic: true });

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
      id: 'amsterdam',
      name: { ko: '암스테르담', en: 'Amsterdam' },
      country: 'NL',
      currency: 'EUR',
      region: 'eu',
      lastUpdated: '2026-04-01',
      rent: { share: 650, studio: 1100, oneBed: 1400, twoBed: 2000 },
      food: { restaurantMeal: 17, cafe: 4.0, groceries: { milk1L: 1.0, eggs12: 3.0, rice1kg: 2.2, chicken1kg: 8.5, bread: 1.5 } },
      transport: { monthlyPass: 95, singleRide: 3.2, taxiBase: 3.0 },
      sources: [{ category: 'rent', name: 'CBS', url: 'https://cbs.nl/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'amsterdam.json'),
      JSON.stringify(existingData),
    );

    const result = await refreshNlCbs({ dryRun: true, useStatic: true });

    expect(result.changes.length).toBeGreaterThan(0);
    const rentChange = result.changes.find((c: any) => c.field.startsWith('rent.'));
    expect(rentChange).toBeDefined();
    expect(typeof rentChange?.pctChange).toBe('number');
  }, 30000);

  it('알 수 없는 도시: errors에 추가', async () => {
    const result = await refreshNlCbs({ dryRun: true, useStatic: true, cities: ['unknown-city'] });

    expect(result.errors.some((e: any) => e.cityId === 'unknown-city')).toBe(true);
  }, 30000);

  it('API 불가: errors에 추가 + static fallback', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await refreshNlCbs({ dryRun: true });

    expect(result.errors.some((e: any) => e.reason.includes('unavailable'))).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);
});
