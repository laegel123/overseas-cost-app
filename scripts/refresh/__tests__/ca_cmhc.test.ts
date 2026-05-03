/**
 * ca_cmhc.mjs 테스트.
 * TESTING.md §9-A.4 인벤토리.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshCaCmhc, {
  parseStatCanResponse,
  mapToRent,
  CITY_CONFIGS,
  SOURCE,
} from '../ca_cmhc.mjs';

let originalDataDir: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-ca-cmhc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = path.join(testDir, 'cities');
});

afterEach(() => {
  if (testDir && testDir.includes('test-ca-cmhc-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  jest.restoreAllMocks();
});

const VALID_STATCAN_RESPONSE = [
  {
    object: {
      vectorId: 111426660,
      vectorDataPoint: [{ value: '1850.0' }],
    },
  },
  {
    object: {
      vectorId: 111426661,
      vectorDataPoint: [{ value: '2100.0' }],
    },
  },
  {
    object: {
      vectorId: 111426662,
      vectorDataPoint: [{ value: '2800.0' }],
    },
  },
];

describe('parseStatCanResponse', () => {
  it('정상 응답 파싱: vector ID → 값 매핑', () => {
    const result = parseStatCanResponse(VALID_STATCAN_RESPONSE);
    expect(result.get('v111426660')).toBe(1850);
    expect(result.get('v111426661')).toBe(2100);
    expect(result.get('v111426662')).toBe(2800);
  });

  it('빈 배열: 빈 Map 반환', () => {
    const result = parseStatCanResponse([]);
    expect(result.size).toBe(0);
  });

  it('null/undefined: 빈 Map 반환', () => {
    expect(parseStatCanResponse(null).size).toBe(0);
    expect(parseStatCanResponse(undefined).size).toBe(0);
  });

  it('유효하지 않은 값 무시', () => {
    const data = [
      {
        object: {
          vectorId: 123,
          vectorDataPoint: [{ value: 'abc' }],
        },
      },
    ];
    const result = parseStatCanResponse(data);
    expect(result.size).toBe(0);
  });

  it('음수 값 무시', () => {
    const data = [
      {
        object: {
          vectorId: 123,
          vectorDataPoint: [{ value: '-100' }],
        },
      },
    ];
    const result = parseStatCanResponse(data);
    expect(result.size).toBe(0);
  });

  it('여러 데이터 포인트: 마지막 값 사용', () => {
    const data = [
      {
        object: {
          vectorId: 123,
          vectorDataPoint: [{ value: '100' }, { value: '200' }, { value: '300' }],
        },
      },
    ];
    const result = parseStatCanResponse(data);
    expect(result.get('v123')).toBe(300);
  });
});

describe('mapToRent', () => {
  it('정상 매핑: bachelor → studio, share = studio × 0.65', () => {
    const vectorData = new Map([
      ['v111426660', 1850],
      ['v111426661', 2100],
      ['v111426662', 2800],
    ]);
    const vectors = CITY_CONFIGS.vancouver.vectors;

    const result = mapToRent(vectorData, vectors);

    expect(result.studio).toBe(1850);
    expect(result.oneBed).toBe(2100);
    expect(result.twoBed).toBe(2800);
    expect(result.share).toBe(Math.round(1850 * 0.65));
  });

  it('데이터 부재: null 반환', () => {
    const vectorData = new Map();
    const vectors = CITY_CONFIGS.vancouver.vectors;

    const result = mapToRent(vectorData, vectors);

    expect(result.studio).toBeNull();
    expect(result.oneBed).toBeNull();
    expect(result.twoBed).toBeNull();
    expect(result.share).toBeNull();
  });

  it('일부 데이터만 있는 경우', () => {
    const vectorData = new Map([['v111426660', 1500]]);
    const vectors = CITY_CONFIGS.vancouver.vectors;

    const result = mapToRent(vectorData, vectors);

    expect(result.studio).toBe(1500);
    expect(result.share).toBe(Math.round(1500 * 0.65));
    expect(result.oneBed).toBeNull();
    expect(result.twoBed).toBeNull();
  });
});

describe('constants', () => {
  it('CITY_CONFIGS: 3개 캐나다 도시', () => {
    expect(Object.keys(CITY_CONFIGS)).toHaveLength(3);
    expect(CITY_CONFIGS.vancouver).toBeDefined();
    expect(CITY_CONFIGS.toronto).toBeDefined();
    expect(CITY_CONFIGS.montreal).toBeDefined();
  });

  it('각 도시 설정에 필수 필드 포함', () => {
    for (const [cityId, config] of Object.entries(CITY_CONFIGS)) {
      expect(config.id).toBe(cityId);
      expect(config.name.ko).toBeDefined();
      expect(config.name.en).toBeDefined();
      expect(config.country).toBe('CA');
      expect(config.currency).toBe('CAD');
      expect(config.region).toBe('na');
      expect(config.vectors.bachelor).toBeDefined();
      expect(config.vectors.oneBed).toBeDefined();
      expect(config.vectors.twoBed).toBeDefined();
    }
  });

  it('SOURCE 정의', () => {
    expect(SOURCE.category).toBe('rent');
    expect(SOURCE.name).toBe('CMHC Rental Market Survey');
    expect(SOURCE.url).toContain('cmhc');
  });
});

describe('refresh (integration)', () => {
  let fetchSpy: jest.SpyInstance;

  // fetchWithRetry 의 setTimeout backoff 가 fake timers 에서 hang 하므로 실제 타이머 사용.
  beforeEach(() => {
    jest.useRealTimers();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.useFakeTimers();
  });

  it('정상 응답: 3개 도시 rent 매핑', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => VALID_STATCAN_RESPONSE,
    });

    const result = await refreshCaCmhc({ dryRun: true });

    expect(result.source).toBe('ca_cmhc');
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => VALID_STATCAN_RESPONSE,
    });

    await refreshCaCmhc({ dryRun: true });

    const vancouverPath = path.join(testDir, 'cities', 'vancouver.json');
    expect(fs.existsSync(vancouverPath)).toBe(false);
  }, 30000);

  it('특정 도시만 갱신', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => VALID_STATCAN_RESPONSE,
    });

    const result = await refreshCaCmhc({ dryRun: true, cities: ['vancouver'] });

    const vancouverChanges = result.changes.filter((c: any) => c.cityId === 'vancouver');
    const torontoChanges = result.changes.filter((c: any) => c.cityId === 'toronto');

    expect(vancouverChanges.length).toBeGreaterThan(0);
    expect(torontoChanges.length).toBe(0);
  }, 30000);

  it('API 오류: errors에 추가', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await refreshCaCmhc({ dryRun: true });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.cities).toHaveLength(0);
  }, 30000);

  it('빈 응답: errors 추가 + 빈 cities', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });

    const result = await refreshCaCmhc({ dryRun: true });

    expect(result.errors.length).toBeGreaterThan(0);
  }, 30000);

  it('기존 데이터 대비 changes 계산', async () => {
    const existingData = {
      id: 'vancouver',
      name: { ko: '밴쿠버', en: 'Vancouver' },
      country: 'CA',
      currency: 'CAD',
      region: 'na',
      lastUpdated: '2026-04-01',
      rent: { share: 1000, studio: 1500, oneBed: 1800, twoBed: 2200 },
      food: { restaurantMeal: 2000, cafe: 500, groceries: { milk1L: 300, eggs12: 400, rice1kg: 350, chicken1kg: 1400, bread: 350 } },
      transport: { monthlyPass: 10000, singleRide: 300, taxiBase: 400 },
      sources: [{ category: 'rent', name: 'CMHC', url: 'https://cmhc.ca/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'vancouver.json'),
      JSON.stringify(existingData),
    );

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => VALID_STATCAN_RESPONSE,
    });

    const result = await refreshCaCmhc({ dryRun: true, cities: ['vancouver'] });

    expect(result.changes.length).toBeGreaterThan(0);
    const studioChange = result.changes.find((c: any) => c.field === 'rent.studio');
    expect(studioChange).toBeDefined();
    expect(typeof studioChange?.pctChange).toBe('number');
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => VALID_STATCAN_RESPONSE,
    });

    const result = await refreshCaCmhc({ dryRun: true });

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
