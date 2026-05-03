/**
 * fr_ratp.mjs 테스트.
 * TESTING.md §9-A.3 인벤토리 — 프랑스.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshFrRatp, {
  getTransportData,
  checkRatpFarePage,
  CITY_CONFIGS,
  STATIC_TRANSPORT,
  SOURCE,
} from '../fr_ratp.mjs';

let originalDataDir: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-fr-ratp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = path.join(testDir, 'cities');
});

afterEach(() => {
  if (testDir && testDir.includes('test-fr-ratp-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  jest.restoreAllMocks();
});

describe('getTransportData', () => {
  it('정적 transport 데이터 반환', () => {
    const result = getTransportData();

    expect(result.monthlyPass).toBe(STATIC_TRANSPORT.monthlyPass);
    expect(result.singleRide).toBe(STATIC_TRANSPORT.singleRide);
    expect(result.taxiBase).toBe(STATIC_TRANSPORT.taxiBase);
  });

  it('모든 필드가 양수', () => {
    const result = getTransportData();

    expect(result.monthlyPass).toBeGreaterThan(0);
    expect(result.singleRide).toBeGreaterThan(0);
    expect(result.taxiBase).toBeGreaterThan(0);
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
    expect(paris.transitOperator).toBe('RATP');
    expect(paris.fareUrl).toContain('ratp.fr');
  });

  it('STATIC_TRANSPORT 정의', () => {
    expect(STATIC_TRANSPORT.monthlyPass).toBeDefined();
    expect(STATIC_TRANSPORT.singleRide).toBeDefined();
    expect(STATIC_TRANSPORT.taxiBase).toBeDefined();
  });

  it('SOURCE 정의', () => {
    expect(SOURCE.category).toBe('transport');
    expect(SOURCE.name).toContain('RATP');
    expect(SOURCE.url).toContain('ratp.fr');
  });
});

describe('checkRatpFarePage', () => {
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

    const result = await checkRatpFarePage();

    expect(result).toBe(true);
  }, 30000);

  it('페이지 오류: false 반환', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await checkRatpFarePage();

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

  it('useStatic=true: fetch 호출 없이 정상 동작', async () => {
    const result = await refreshFrRatp({ dryRun: true, useStatic: true });

    expect(result.source).toBe('fr_ratp');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    await refreshFrRatp({ dryRun: true, useStatic: true });

    const parisPath = path.join(testDir, 'cities', 'paris.json');
    expect(fs.existsSync(parisPath)).toBe(false);
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    const result = await refreshFrRatp({ dryRun: true, useStatic: true });

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
      transport: { monthlyPass: 80, singleRide: 2.0, taxiBase: 4.0 },
      sources: [{ category: 'transport', name: 'RATP', url: 'https://ratp.fr/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'paris.json'),
      JSON.stringify(existingData),
    );

    const result = await refreshFrRatp({ dryRun: true, useStatic: true });

    expect(result.changes.length).toBeGreaterThan(0);
    const transportChange = result.changes.find((c: any) => c.field.startsWith('transport.'));
    expect(transportChange).toBeDefined();
    expect(typeof transportChange?.pctChange).toBe('number');
  }, 30000);

  it('알 수 없는 도시: errors에 추가', async () => {
    const result = await refreshFrRatp({ dryRun: true, useStatic: true, cities: ['unknown-city'] });

    expect(result.errors.some((e: any) => e.cityId === 'unknown-city')).toBe(true);
  }, 30000);

  it('페이지 불가: errors에 추가 + static fallback', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await refreshFrRatp({ dryRun: true });

    expect(result.errors.some((e: any) => e.reason.includes('unavailable'))).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);
});
