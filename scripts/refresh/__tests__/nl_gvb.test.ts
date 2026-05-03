/**
 * nl_gvb.mjs 테스트.
 * TESTING.md §9-A.3 인벤토리 — 네덜란드.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshNlGvb, {
  getTransportData,
  checkGvbFarePage,
  CITY_CONFIGS,
  STATIC_TRANSPORT,
  SOURCE,
} from '../nl_gvb.mjs';

let originalDataDir: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-nl-gvb-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = path.join(testDir, 'cities');
});

afterEach(() => {
  if (testDir && testDir.includes('test-nl-gvb-')) {
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
    expect(amsterdam.transitOperator).toBe('GVB');
    expect(amsterdam.fareUrl).toContain('gvb.nl');
  });

  it('STATIC_TRANSPORT 정의', () => {
    expect(STATIC_TRANSPORT.monthlyPass).toBeDefined();
    expect(STATIC_TRANSPORT.singleRide).toBeDefined();
    expect(STATIC_TRANSPORT.taxiBase).toBeDefined();
  });

  it('SOURCE 정의', () => {
    expect(SOURCE.category).toBe('transport');
    expect(SOURCE.name).toContain('GVB');
    expect(SOURCE.url).toContain('gvb.nl');
  });
});

describe('checkGvbFarePage', () => {
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

    const result = await checkGvbFarePage();

    expect(result).toBe(true);
  }, 30000);

  it('페이지 오류: false 반환', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await checkGvbFarePage();

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
    const result = await refreshNlGvb({ dryRun: true, useStatic: true });

    expect(result.source).toBe('nl_gvb');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    await refreshNlGvb({ dryRun: true, useStatic: true });

    const amsterdamPath = path.join(testDir, 'cities', 'amsterdam.json');
    expect(fs.existsSync(amsterdamPath)).toBe(false);
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    const result = await refreshNlGvb({ dryRun: true, useStatic: true });

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
      sources: [{ category: 'transport', name: 'GVB', url: 'https://gvb.nl/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'amsterdam.json'),
      JSON.stringify(existingData),
    );

    const result = await refreshNlGvb({ dryRun: true, useStatic: true });

    expect(result.changes.length).toBeGreaterThan(0);
    const transportChange = result.changes.find((c: any) => c.field.startsWith('transport.'));
    expect(transportChange).toBeDefined();
    expect(typeof transportChange?.pctChange).toBe('number');
  }, 30000);

  it('알 수 없는 도시: errors에 추가', async () => {
    const result = await refreshNlGvb({ dryRun: true, useStatic: true, cities: ['unknown-city'] });

    expect(result.errors.some((e: any) => e.cityId === 'unknown-city')).toBe(true);
  }, 30000);

  it('페이지 불가: errors에 추가 + static fallback', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await refreshNlGvb({ dryRun: true });

    expect(result.errors.some((e: any) => e.reason.includes('unavailable'))).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);
});
