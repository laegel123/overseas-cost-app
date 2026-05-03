/**
 * ca_statcan.mjs 테스트.
 * TESTING.md §9-A.4 인벤토리.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import { parseStatCanResponse } from '../_common.mjs';
import refreshCaStatcan, {
  cpiToPrice,
  CITY_CONFIGS,
  CPI_VECTORS,
  STATIC_PRICES,
  SOURCE,
} from '../ca_statcan.mjs';

let originalDataDir: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-ca-statcan-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = path.join(testDir, 'cities');
});

afterEach(() => {
  if (testDir && testDir.includes('test-ca-statcan-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  jest.restoreAllMocks();
});

const VALID_CPI_RESPONSE = [
  {
    object: {
      vectorId: 41691028,
      vectorDataPoint: [{ value: '105.2' }],
    },
  },
  {
    object: {
      vectorId: 41691030,
      vectorDataPoint: [{ value: '110.0' }],
    },
  },
];

describe('parseStatCanResponse', () => {
  it('정상 응답 파싱: vector ID → 값 매핑', () => {
    const result = parseStatCanResponse(VALID_CPI_RESPONSE);
    expect(result.get('v41691028')).toBeCloseTo(105.2);
    expect(result.get('v41691030')).toBe(110);
  });

  it('빈 배열: 빈 Map 반환', () => {
    const result = parseStatCanResponse([]);
    expect(result.size).toBe(0);
  });

  it('null/undefined: 빈 Map 반환', () => {
    expect(parseStatCanResponse(null).size).toBe(0);
    expect(parseStatCanResponse(undefined).size).toBe(0);
  });
});

describe('cpiToPrice', () => {
  it('CPI 100: 기준가 그대로', () => {
    expect(cpiToPrice(100, 500)).toBe(500);
  });

  it('CPI 110: 10% 상승', () => {
    expect(cpiToPrice(110, 500)).toBe(550);
  });

  it('CPI 90: 10% 하락', () => {
    expect(cpiToPrice(90, 500)).toBe(450);
  });

  it('소수점 2자리 보존 (CAD dollars)', () => {
    // CPI 105.5 × 기준가 3.00 / 100 = 3.165 → 2자리 반올림 → 3.17 (round half up)
    expect(cpiToPrice(105.5, 3)).toBe(3.17);
    // 정수 기준가도 동일 정밀도
    expect(cpiToPrice(105.5, 300)).toBe(316.5);
  });
});

describe('constants', () => {
  it('CITY_CONFIGS: 3개 캐나다 도시', () => {
    expect(Object.keys(CITY_CONFIGS)).toHaveLength(3);
    expect(CITY_CONFIGS.vancouver).toBeDefined();
    expect(CITY_CONFIGS.toronto).toBeDefined();
    expect(CITY_CONFIGS.montreal).toBeDefined();
  });

  it('CPI_VECTORS: 각 도시별 Vector ID', () => {
    expect(Object.keys(CPI_VECTORS)).toHaveLength(3);
    for (const cityId of Object.keys(CPI_VECTORS)) {
      const vectors = CPI_VECTORS[cityId as keyof typeof CPI_VECTORS];
      expect(vectors.milk1L).toBeDefined();
      expect(vectors.eggs12).toBeDefined();
      expect(vectors.bread).toBeDefined();
      expect(vectors.chicken1kg).toBeDefined();
      expect(vectors.rice1kg).toBeDefined();
      expect(vectors.restaurantMeal).toBeDefined();
      expect(vectors.cafe).toBeDefined();
    }
  });

  it('STATIC_PRICES: 각 도시별 기준가', () => {
    expect(Object.keys(STATIC_PRICES)).toHaveLength(3);
    for (const cityId of Object.keys(STATIC_PRICES)) {
      const prices = STATIC_PRICES[cityId as keyof typeof STATIC_PRICES];
      expect(prices.milk1L).toBeGreaterThan(0);
      expect(prices.eggs12).toBeGreaterThan(0);
      expect(prices.rice1kg).toBeGreaterThan(0);
      expect(prices.chicken1kg).toBeGreaterThan(0);
      expect(prices.bread).toBeGreaterThan(0);
      expect(prices.restaurantMeal).toBeGreaterThan(0);
      expect(prices.cafe).toBeGreaterThan(0);
    }
  });

  it('SOURCE 정의', () => {
    expect(SOURCE.category).toBe('food');
    expect(SOURCE.name).toBe('Statistics Canada CPI');
    expect(SOURCE.url).toContain('statcan');
  });
});

describe('refresh (integration)', () => {
  let fetchSpy: jest.SpyInstance;

  // fetchWithRetry 의 setTimeout backoff 가 fake timers 에서 hang — real timers 사용 (ca_cmhc 동일 패턴).
  beforeEach(() => {
    jest.useRealTimers();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.useFakeTimers();
  });

  it('useStatic=true: 정적 데이터 사용', async () => {
    const result = await refreshCaStatcan({ dryRun: true, useStatic: true });

    expect(result.source).toBe('ca_statcan');
    expect(result.cities.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);

  it('정상 API 응답: CPI 적용', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => VALID_CPI_RESPONSE,
    });

    const result = await refreshCaStatcan({ dryRun: true });

    expect(result.source).toBe('ca_statcan');
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    await refreshCaStatcan({ dryRun: true, useStatic: true });

    const vancouverPath = path.join(testDir, 'cities', 'vancouver.json');
    expect(fs.existsSync(vancouverPath)).toBe(false);
  }, 30000);

  it('특정 도시만 갱신', async () => {
    const result = await refreshCaStatcan({ dryRun: true, useStatic: true, cities: ['vancouver'] });

    expect(result.cities).toContain('vancouver');
    expect(result.cities).not.toContain('toronto');
    expect(result.cities).not.toContain('montreal');
  }, 30000);

  it('API 오류: 정적 fallback', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await refreshCaStatcan({ dryRun: true });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.reason).toContain('static fallback');
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
      food: { restaurantMeal: 1000, cafe: 200, groceries: { milk1L: 100, eggs12: 100, rice1kg: 100, chicken1kg: 100, bread: 100 } },
      transport: { monthlyPass: 10000, singleRide: 300, taxiBase: 400 },
      sources: [{ category: 'food', name: 'StatCan', url: 'https://statcan.gc.ca/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'vancouver.json'),
      JSON.stringify(existingData),
    );

    const result = await refreshCaStatcan({ dryRun: true, useStatic: true, cities: ['vancouver'] });

    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    const result = await refreshCaStatcan({ dryRun: true, useStatic: true });

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
