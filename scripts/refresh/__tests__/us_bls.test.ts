/**
 * us_bls.mjs 테스트.
 * TESTING.md §9-A.3 인벤토리.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshUsBls, {
  parseBlsResponse,
  validateBlsValues,
  mapToGroceries,
  CITY_CONFIGS,
  BLS_SERIES,
  BLS_VALUE_RANGES,
  STATIC_GROCERIES,
  STATIC_FOOD,
  SOURCE,
} from '../us_bls.mjs';
import type { RefreshChange, RefreshError } from './_test-types';

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

describe('validateBlsValues', () => {
  it('범위 안 값: valid Map 에 포함', () => {
    const blsData = new Map([
      ['APU0100709112', 4.5], // milk in range [1.0, 6.0]
      ['APU0100708111', 3.8], // eggs in range [1.0, 8.0]
      ['APU0100702111', 3.2], // bread in range [1.0, 6.0]
      ['APU0100706111', 1.8], // chicken in range [1.0, 5.0]
    ]);
    const { valid, invalid } = validateBlsValues(blsData, BLS_SERIES.northeast);

    expect(valid.size).toBe(4);
    expect(invalid).toHaveLength(0);
  });

  it('chicken1kg 가 5.0 USD/lb 초과: invalid 분리 + STATIC fallback (PR #20 review 회귀 차단)', () => {
    // 과거 BLS API 가 ~$10/lb 를 반환해 nyc.json 에 25.3 USD/kg 가 적재된 사례 회귀 차단.
    const blsData = new Map([
      ['APU0100706111', 10.0], // chicken out of range
    ]);
    const { valid, invalid } = validateBlsValues(blsData, BLS_SERIES.northeast);

    expect(valid.size).toBe(0);
    expect(invalid).toHaveLength(1);
    expect(invalid[0]?.field).toBe('chicken1kg');
    expect(invalid[0]?.value).toBe(10.0);
    expect(invalid[0]?.range.max).toBe(5.0);
  });

  it('범위 미만 값도 invalid (음수·0 등 비정상 값)', () => {
    const blsData = new Map([
      ['APU0100709112', 0.5], // milk below min
    ]);
    const { valid, invalid } = validateBlsValues(blsData, BLS_SERIES.northeast);

    expect(valid.size).toBe(0);
    expect(invalid).toHaveLength(1);
    expect(invalid[0]?.field).toBe('milk1L');
  });

  it('Map 에 없는 시리즈는 valid 에서 제외 (parseBlsResponse 가 이미 걸러냄)', () => {
    const blsData = new Map();
    const { valid, invalid } = validateBlsValues(blsData, BLS_SERIES.northeast);

    expect(valid.size).toBe(0);
    expect(invalid).toHaveLength(0);
  });

  it('BLS_VALUE_RANGES: 4개 필드 모두 min/max 정의', () => {
    expect(BLS_VALUE_RANGES.milk1L).toEqual({ min: 1.0, max: 6.0 });
    expect(BLS_VALUE_RANGES.eggs12).toEqual({ min: 1.0, max: 8.0 });
    expect(BLS_VALUE_RANGES.bread).toEqual({ min: 1.0, max: 6.0 });
    expect(BLS_VALUE_RANGES.chicken1kg).toEqual({ min: 1.0, max: 5.0 });
  });
});

describe('mapToGroceries', () => {
  it('BLS 데이터 + 보정계수 적용 (milk 는 ½ gallon → 1L 환산)', () => {
    const blsData = new Map([
      ['APU0100709112', 4.5],
      ['APU0100708111', 3.8],
      ['APU0100702111', 3.2],
      ['APU0100706111', 4.0],
    ]);
    const seriesIds = BLS_SERIES.northeast;
    const adjustmentFactor = 1.15;

    const result = mapToGroceries(blsData, seriesIds, adjustmentFactor);

    // BLS APU0100709112 는 ½ gallon (1.8927 L) 단위 — 1L 환산 후 보정.
    expect(result.milk1L).toBeCloseTo((4.5 / 1.8927) * 1.15, 2);
    expect(result.eggs12).toBeCloseTo(3.8 * 1.15, 1);
    expect(result.bread).toBeCloseTo(3.2 * 1.15, 1);
    expect(result.rice1kg).toBeCloseTo(STATIC_GROCERIES.rice1kg * 1.15, 1);
  });

  it('BLS 데이터 부재: static fallback 사용 (milk 는 milk static 값)', () => {
    const blsData = new Map();
    const seriesIds = BLS_SERIES.northeast;
    const adjustmentFactor = 1.0;

    const result = mapToGroceries(blsData, seriesIds, adjustmentFactor);

    expect(result.milk1L).toBe(STATIC_GROCERIES.milk1L);
    expect(result.eggs12).toBe(STATIC_GROCERIES.eggs12);
    expect(result.chicken1kg).toBe(STATIC_GROCERIES.chicken1kg);
    expect(result.bread).toBe(STATIC_GROCERIES.bread);
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

    expect(result.errors.some((e: RefreshError) => e.cityId.startsWith('region:'))).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);

  it('chicken1kg 가 sanity 범위 밖: errors 기록 + 결과는 STATIC×보정계수 (PR #20 회귀 차단)', async () => {
    // BLS API 가 의도와 다른 시리즈를 반환하는 시나리오 — chicken1kg 가 $10/lb 처럼 비정상이면
    // 원래 코드: 25.3 USD/kg 적재 (= 10 × 2.2 × 1.15). 수정 후: 11.5 USD/kg (= 10 × 1.15, STATIC 사용).
    const responseWithInvalidChicken = {
      status: 'REQUEST_SUCCEEDED',
      Results: {
        series: [
          { seriesID: 'APU0100706111', data: [{ value: '10.00' }] }, // out of [1.0, 5.0]
        ],
      },
    };
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => responseWithInvalidChicken,
    });

    const result = await refreshUsBls({ dryRun: true, cities: ['nyc'] });

    expect(
      result.errors.some(
        (e: RefreshError) =>
          e.cityId.startsWith('region:') && e.reason.includes('chicken1kg') && e.reason.includes('out of range'),
      ),
    ).toBe(true);

    const chickenChange = result.changes.find((c: RefreshChange) => c.field === 'food.groceries.chicken1kg');
    expect(chickenChange).toBeDefined();
    // STATIC_GROCERIES.chicken1kg(10.00) × adjustment(1.15) = 11.5 — 25.3 의 비정상 값 회귀 차단.
    expect(chickenChange?.newValue).toBeCloseTo(STATIC_GROCERIES.chicken1kg * 1.15, 2);
    expect(chickenChange?.newValue).toBeLessThan(20);
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
