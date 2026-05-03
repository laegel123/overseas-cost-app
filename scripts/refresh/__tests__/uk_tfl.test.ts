/**
 * uk_tfl.mjs 테스트.
 * TESTING.md §9-A.6 인벤토리.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshUkTfl, {
  getTransportFares,
  checkTflApiStatus,
  CITY_CONFIGS,
  STATIC_TRANSPORT,
  SOURCE,
} from '../uk_tfl.mjs';

let originalDataDir: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-uk-tfl-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = path.join(testDir, 'cities');
});

afterEach(() => {
  if (testDir && testDir.includes('test-uk-tfl-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  jest.restoreAllMocks();
});

describe('getTransportFares', () => {
  it('static 값 반환', () => {
    const result = getTransportFares();

    expect(result.monthlyPass).toBe(STATIC_TRANSPORT.monthlyPass);
    expect(result.singleRide).toBe(STATIC_TRANSPORT.singleRide);
    expect(result.taxiBase).toBe(STATIC_TRANSPORT.taxiBase);
  });

  it('모든 필드가 양수', () => {
    const result = getTransportFares();

    expect(result.monthlyPass).toBeGreaterThan(0);
    expect(result.singleRide).toBeGreaterThan(0);
    expect(result.taxiBase).toBeGreaterThan(0);
  });
});

describe('checkTflApiStatus', () => {
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

    const result = await checkTflApiStatus();

    expect(result).toBe(true);
  }, 30000);

  it('API 오류: false 반환', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await checkTflApiStatus();

    expect(result).toBe(false);
  }, 30000);

  it('API 응답 실패: false 반환', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 500 });

    const result = await checkTflApiStatus();

    expect(result).toBe(false);
  }, 30000);
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
    expect(london.country).toBe('UK');
    expect(london.currency).toBe('GBP');
    expect(london.region).toBe('eu');
  });

  it('STATIC_TRANSPORT: Zone 1-2 요금', () => {
    expect(STATIC_TRANSPORT.monthlyPass).toBeGreaterThan(100);
    expect(STATIC_TRANSPORT.singleRide).toBeGreaterThan(2);
    expect(STATIC_TRANSPORT.taxiBase).toBeGreaterThan(3);
  });

  it('SOURCE 정의', () => {
    expect(SOURCE.category).toBe('transport');
    expect(SOURCE.name).toContain('TfL');
    expect(SOURCE.url).toContain('tfl.gov.uk');
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
    const result = await refreshUkTfl({ dryRun: true, useStatic: true });

    expect(result.source).toBe('uk_tfl');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    await refreshUkTfl({ dryRun: true, useStatic: true });

    const londonPath = path.join(testDir, 'cities', 'london.json');
    expect(fs.existsSync(londonPath)).toBe(false);
  }, 30000);

  it('API 불가: errors에 추가 + static fallback', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await refreshUkTfl({ dryRun: true });

    expect(result.errors.some((e: any) => e.reason.includes('unavailable'))).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    const result = await refreshUkTfl({ dryRun: true, useStatic: true });

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
      country: 'UK',
      currency: 'GBP',
      region: 'eu',
      lastUpdated: '2026-04-01',
      rent: { share: 1000, studio: 1500, oneBed: 1800, twoBed: 2200 },
      food: { restaurantMeal: 14, cafe: 3.5, groceries: { milk1L: 1.4, eggs12: 3.2, rice1kg: 2.0, chicken1kg: 5.5, bread: 1.3 } },
      transport: { monthlyPass: 150, singleRide: 2.5, taxiBase: 3.5 },
      sources: [{ category: 'transport', name: 'TfL', url: 'https://tfl.gov.uk/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'london.json'),
      JSON.stringify(existingData),
    );

    const result = await refreshUkTfl({ dryRun: true, useStatic: true });

    expect(result.changes.length).toBeGreaterThan(0);
    const transportChange = result.changes.find((c: any) => c.field.startsWith('transport.'));
    expect(transportChange).toBeDefined();
    expect(typeof transportChange?.pctChange).toBe('number');
  }, 30000);

  it('알 수 없는 도시: errors에 추가', async () => {
    const result = await refreshUkTfl({ dryRun: true, useStatic: true, cities: ['unknown-city'] });

    expect(result.errors.some((e: any) => e.cityId === 'unknown-city')).toBe(true);
  }, 30000);
});
