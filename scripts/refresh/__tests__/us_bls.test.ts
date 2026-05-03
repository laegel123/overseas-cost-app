/**
 * us_bls.mjs 테스트.
 * TESTING.md §9-A.3 인벤토리.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshUsBls, {
  parseBlsResponse,
  mapToGroceries,
  CITY_CONFIGS,
  BLS_SERIES,
  STATIC_GROCERIES,
  STATIC_FOOD,
  SOURCE,
} from '../us_bls.mjs';

let originalDataDir: string | undefined;
let originalApiKey: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-us-bls-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  originalApiKey = process.env.US_BLS_API_KEY;
  process.env.DATA_DIR = path.join(testDir, 'cities');
  process.env.US_BLS_API_KEY = 'test-api-key';
});

afterEach(() => {
  if (testDir && testDir.includes('test-us-bls-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  process.env.US_BLS_API_KEY = originalApiKey;
  jest.restoreAllMocks();
});

const VALID_BLS_RESPONSE = {
  status: 'REQUEST_SUCCEEDED',
  Results: {
    series: [
      {
        seriesID: 'APU0100709112',
        data: [{ value: '4.50' }],
      },
      {
        seriesID: 'APU0100708111',
        data: [{ value: '3.80' }],
      },
      {
        seriesID: 'APU0100702111',
        data: [{ value: '3.20' }],
      },
      {
        seriesID: 'APU0100706111',
        data: [{ value: '4.00' }],
      },
    ],
  },
};

describe('parseBlsResponse', () => {
  it('정상 응답 파싱: seriesID → 값 매핑', () => {
    const seriesIds = ['APU0100709112', 'APU0100708111'];
    const result = parseBlsResponse(VALID_BLS_RESPONSE, seriesIds);

    expect(result.get('APU0100709112')).toBe(4.5);
    expect(result.get('APU0100708111')).toBe(3.8);
  });

  it('REQUEST_FAILED: 빈 Map 반환', () => {
    const data = { status: 'REQUEST_FAILED' };
    const result = parseBlsResponse(data, ['APU0100709112']);
    expect(result.size).toBe(0);
  });

  it('빈 객체: 빈 Map 반환', () => {
    const result = parseBlsResponse({}, []);
    expect(result.size).toBe(0);
  });

  it('null/undefined: 빈 Map 반환', () => {
    expect(parseBlsResponse(null, []).size).toBe(0);
    expect(parseBlsResponse(undefined, []).size).toBe(0);
  });

  it('요청하지 않은 seriesID 무시', () => {
    const seriesIds = ['APU0100709112'];
    const result = parseBlsResponse(VALID_BLS_RESPONSE, seriesIds);

    expect(result.has('APU0100709112')).toBe(true);
    expect(result.has('APU0100708111')).toBe(false);
  });
});

describe('mapToGroceries', () => {
  it('BLS 데이터 + 보정계수 적용', () => {
    const blsData = new Map([
      ['APU0100709112', 4.5],
      ['APU0100708111', 3.8],
      ['APU0100702111', 3.2],
      ['APU0100706111', 4.0],
    ]);
    const seriesIds = BLS_SERIES.northeast;
    const adjustmentFactor = 1.15;

    const result = mapToGroceries(blsData, seriesIds, adjustmentFactor);

    expect(result.milk1L).toBeCloseTo(4.5 * 1.15, 1);
    expect(result.eggs12).toBeCloseTo(3.8 * 1.15, 1);
    expect(result.bread).toBeCloseTo(3.2 * 1.15, 1);
    expect(result.rice1kg).toBeCloseTo(STATIC_GROCERIES.rice1kg * 1.15, 1);
  });

  it('BLS 데이터 부재: static fallback 사용', () => {
    const blsData = new Map();
    const seriesIds = BLS_SERIES.northeast;
    const adjustmentFactor = 1.0;

    const result = mapToGroceries(blsData, seriesIds, adjustmentFactor);

    expect(result.rice1kg).toBe(STATIC_GROCERIES.rice1kg);
    expect(result.onion1kg).toBe(STATIC_GROCERIES.onion1kg);
    expect(result.apple1kg).toBe(STATIC_GROCERIES.apple1kg);
    expect(result.ramen).toBe(STATIC_GROCERIES.ramen);
  });

  it('도시별 보정계수 차이', () => {
    const blsData = new Map([['APU0100709112', 4.0]]);
    const seriesIds = BLS_SERIES.northeast;

    const nyc = mapToGroceries(blsData, seriesIds, 1.15);
    const boston = mapToGroceries(blsData, seriesIds, 1.10);

    expect(nyc.milk1L).toBeGreaterThan(boston.milk1L);
  });
});

describe('constants', () => {
  it('CITY_CONFIGS: 5개 미국 도시', () => {
    expect(Object.keys(CITY_CONFIGS)).toHaveLength(5);
    expect(CITY_CONFIGS.nyc).toBeDefined();
    expect(CITY_CONFIGS.la).toBeDefined();
    expect(CITY_CONFIGS.sf).toBeDefined();
    expect(CITY_CONFIGS.seattle).toBeDefined();
    expect(CITY_CONFIGS.boston).toBeDefined();
  });

  it('각 도시 설정에 blsRegion + adjustmentFactor 포함', () => {
    for (const config of Object.values(CITY_CONFIGS)) {
      expect(['northeast', 'west']).toContain(config.blsRegion);
      expect(config.adjustmentFactor).toBeGreaterThan(0);
    }
  });

  it('ADR-059 보정계수 확인', () => {
    expect(CITY_CONFIGS.nyc.adjustmentFactor).toBe(1.15);
    expect(CITY_CONFIGS.sf.adjustmentFactor).toBe(1.25);
    expect(CITY_CONFIGS.la.adjustmentFactor).toBe(1.05);
    expect(CITY_CONFIGS.seattle.adjustmentFactor).toBe(1.00);
    expect(CITY_CONFIGS.boston.adjustmentFactor).toBe(1.10);
  });

  it('BLS_SERIES: northeast + west 지역', () => {
    expect(BLS_SERIES.northeast).toBeDefined();
    expect(BLS_SERIES.west).toBeDefined();
    expect(BLS_SERIES.northeast.milk1L).toBeDefined();
    expect(BLS_SERIES.west.milk1L).toBeDefined();
  });

  it('SOURCE 정의', () => {
    expect(SOURCE.category).toBe('food');
    expect(SOURCE.name).toContain('BLS CPI');
    expect(SOURCE.name).toContain('ADR-059');
    expect(SOURCE.url).toContain('bls.gov');
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

  it('API 키 없음 + useStatic false: throw MissingApiKeyError', async () => {
    delete process.env.US_BLS_API_KEY;

    await expect(refreshUsBls({ dryRun: true })).rejects.toThrow('US_BLS_API_KEY');
  }, 30000);

  it('useStatic=true: API 키 없어도 정상 동작', async () => {
    delete process.env.US_BLS_API_KEY;

    const result = await refreshUsBls({ dryRun: true, useStatic: true, cities: ['nyc'] });

    expect(result.source).toBe('us_bls');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);

  it('정상 응답: food 필드 갱신', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => VALID_BLS_RESPONSE,
    });

    const result = await refreshUsBls({ dryRun: true, cities: ['nyc'] });

    expect(result.source).toBe('us_bls');
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => VALID_BLS_RESPONSE,
    });

    await refreshUsBls({ dryRun: true, cities: ['nyc'] });

    const nycPath = path.join(testDir, 'cities', 'nyc.json');
    expect(fs.existsSync(nycPath)).toBe(false);
  }, 30000);

  it('API 오류: 지역 에러 추가 + static fallback', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await refreshUsBls({ dryRun: true, cities: ['nyc'] });

    expect(result.errors.some((e: any) => e.cityId.startsWith('region:'))).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    const result = await refreshUsBls({ dryRun: true, useStatic: true, cities: ['nyc'] });

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
});
