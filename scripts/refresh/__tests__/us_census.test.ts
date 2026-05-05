/**
 * us_census.mjs 테스트.
 * TESTING.md §9-A.3 인벤토리.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshUsCensus, {
  parseCensusResponse,
  CITY_CONFIGS,
  SOURCE,
} from '../us_census.mjs';

let originalDataDir: string | undefined;
let originalApiKey: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-us-census-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  originalApiKey = process.env.US_CENSUS_API_KEY;
  process.env.DATA_DIR = path.join(testDir, 'cities');
  process.env.US_CENSUS_API_KEY = 'test-api-key';
});

afterEach(() => {
  if (testDir && testDir.includes('test-us-census-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  process.env.US_CENSUS_API_KEY = originalApiKey;
  jest.restoreAllMocks();
});

const VALID_CENSUS_RESPONSE = [
  ['B25064_001E', 'NAME'],
  ['1850', 'New York-Newark-Jersey City, NY-NJ-PA Metro Area'],
];

describe('parseCensusResponse', () => {
  it('정상 응답 파싱: 첫 번째 값 추출', () => {
    const result = parseCensusResponse(VALID_CENSUS_RESPONSE);
    expect(result).toBe(1850);
  });

  it('빈 배열: null 반환', () => {
    const result = parseCensusResponse([]);
    expect(result).toBeNull();
  });

  it('헤더만: null 반환', () => {
    const result = parseCensusResponse([['B25064_001E', 'NAME']]);
    expect(result).toBeNull();
  });

  it('null/undefined: null 반환', () => {
    expect(parseCensusResponse(null)).toBeNull();
    expect(parseCensusResponse(undefined)).toBeNull();
  });

  it('유효하지 않은 값: null 반환', () => {
    const data = [
      ['B25064_001E', 'NAME'],
      ['abc', 'Test Metro'],
    ];
    const result = parseCensusResponse(data);
    expect(result).toBeNull();
  });

  it('음수 값: null 반환', () => {
    const data = [
      ['B25064_001E', 'NAME'],
      ['-100', 'Test Metro'],
    ];
    const result = parseCensusResponse(data);
    expect(result).toBeNull();
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

  it('각 도시 설정에 cbsaCode 포함', () => {
    for (const [cityId, config] of Object.entries(CITY_CONFIGS)) {
      expect(config.id).toBe(cityId);
      expect(config.cbsaCode).toBeDefined();
      expect(config.cbsaCode).toMatch(/^\d{5}$/);
    }
  });

  it('SOURCE 정의', () => {
    expect(SOURCE.category).toBe('rent');
    expect(SOURCE.name).toContain('Census ACS');
    expect(SOURCE.url).toContain('census.gov');
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

  it('API 키 없음: throw MissingApiKeyError', async () => {
    delete process.env.US_CENSUS_API_KEY;

    await expect(refreshUsCensus({ dryRun: true })).rejects.toThrow('US_CENSUS_API_KEY');
  }, 30000);

  it('정상 응답: censusMedian 갱신', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => VALID_CENSUS_RESPONSE,
    });

    const result = await refreshUsCensus({ dryRun: true, cities: ['nyc'] });

    expect(result.source).toBe('us_census');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.changes[0]?.field).toBe('rent.censusMedian');
  }, 30000);

  // PR #20 review round 8 — Census API 연도 운영 정책 회귀 차단.
  it('Census API URL 에 ACS 연도가 포함되며 미래 연도가 아니어야 함 (운영 정책)', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => VALID_CENSUS_RESPONSE,
    });

    await refreshUsCensus({ dryRun: true, cities: ['nyc'] });

    expect(fetchSpy).toHaveBeenCalled();
    const calledUrl = String(fetchSpy.mock.calls[0]?.[0] ?? '');
    const match = calledUrl.match(/api\.census\.gov\/data\/(\d{4})\/acs\/acs5/);
    expect(match).not.toBeNull();

    const year = Number(match![1]);
    const currentYear = new Date().getFullYear();
    // ACS 5-Year 는 매년 12월 직전 연도 dataset 공개 — 운영자가 갱신 안 한 경우 currentYear-1
    // 도 허용. 미래 연도는 Census API 가 4xx 반환하므로 차단.
    expect(year).toBeGreaterThanOrEqual(2022);
    expect(year).toBeLessThanOrEqual(currentYear);
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => VALID_CENSUS_RESPONSE,
    });

    await refreshUsCensus({ dryRun: true, cities: ['nyc'] });

    const nycPath = path.join(testDir, 'cities', 'nyc.json');
    expect(fs.existsSync(nycPath)).toBe(false);
  }, 30000);

  it('API 오류: errors에 추가', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await refreshUsCensus({ dryRun: true, cities: ['nyc'] });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.cities).toHaveLength(0);
  }, 30000);

  it('빈 응답: errors 추가', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });

    const result = await refreshUsCensus({ dryRun: true, cities: ['nyc'] });

    expect(result.errors.length).toBeGreaterThan(0);
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => VALID_CENSUS_RESPONSE,
    });

    const result = await refreshUsCensus({ dryRun: true, cities: ['nyc'] });

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
