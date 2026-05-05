/**
 * jp_estat.mjs 테스트.
 * TESTING.md §9-A.8 인벤토리.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshJpEstat, {
  parseEstatValue,
  mapToRent,
  mapToGroceries,
  fetchEstatData,
  CITY_CONFIGS,
  STATIC_RENT,
  STATIC_GROCERIES,
  STATIC_FOOD,
  SOURCE_RENT,
  SOURCE_FOOD,
} from '../jp_estat.mjs';
import type { RefreshChange, RefreshError } from './_test-types';

let originalDataDir: string | undefined;
let originalEstatAppId: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-jp-estat-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  originalEstatAppId = process.env.JP_ESTAT_APP_ID;
  process.env.DATA_DIR = path.join(testDir, 'cities');
  delete process.env.JP_ESTAT_APP_ID;
});

afterEach(() => {
  if (testDir && testDir.includes('test-jp-estat-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  if (originalEstatAppId !== undefined) {
    process.env.JP_ESTAT_APP_ID = originalEstatAppId;
  } else {
    delete process.env.JP_ESTAT_APP_ID;
  }
  jest.restoreAllMocks();
});

const VALID_ESTAT_RESPONSE = {
  GET_STATS_DATA: {
    STATISTICAL_DATA: {
      DATA_INF: {
        VALUE: [
          { $: '65000' },
          { $: '70000' },
          { $: '75000' },
        ],
      },
    },
  },
};

describe('parseEstatValue', () => {
  it('정상 응답 파싱: 마지막 VALUE 값', () => {
    const result = parseEstatValue(VALID_ESTAT_RESPONSE);
    expect(result).toBe(75000);
  });

  it('빈 VALUE 배열: null 반환', () => {
    const data = {
      GET_STATS_DATA: {
        STATISTICAL_DATA: {
          DATA_INF: { VALUE: [] },
        },
      },
    };
    const result = parseEstatValue(data);
    expect(result).toBeNull();
  });

  it('null/undefined: null 반환', () => {
    expect(parseEstatValue(null)).toBeNull();
    expect(parseEstatValue(undefined)).toBeNull();
  });

  it('유효하지 않은 구조: null 반환', () => {
    expect(parseEstatValue({})).toBeNull();
    expect(parseEstatValue({ GET_STATS_DATA: {} })).toBeNull();
  });

  it('유효하지 않은 값: null 반환', () => {
    const data = {
      GET_STATS_DATA: {
        STATISTICAL_DATA: {
          DATA_INF: { VALUE: [{ $: 'abc' }] },
        },
      },
    };
    const result = parseEstatValue(data);
    expect(result).toBeNull();
  });
});

describe('mapToRent', () => {
  it('도쿄: 정적 임대료 반환', () => {
    const result = mapToRent('tokyo');

    expect(result.share).toBe(STATIC_RENT.tokyo.share);
    expect(result.studio).toBe(STATIC_RENT.tokyo.studio);
    expect(result.oneBed).toBe(STATIC_RENT.tokyo.oneBed);
    expect(result.twoBed).toBe(STATIC_RENT.tokyo.twoBed);
  });

  it('오사카: 정적 임대료 반환', () => {
    const result = mapToRent('osaka');

    expect(result.share).toBe(STATIC_RENT.osaka.share);
    expect(result.studio).toBe(STATIC_RENT.osaka.studio);
  });

  it('알 수 없는 도시: 도쿄 fallback', () => {
    const result = mapToRent('unknown');
    expect(result.share).toBe(STATIC_RENT.tokyo.share);
  });
});

describe('mapToGroceries', () => {
  it('정적 식재료 가격 반환', () => {
    const result = mapToGroceries();

    expect(result.milk1L).toBe(STATIC_GROCERIES.milk1L);
    expect(result.eggs12).toBe(STATIC_GROCERIES.eggs12);
    expect(result.rice1kg).toBe(STATIC_GROCERIES.rice1kg);
    expect(result.chicken1kg).toBe(STATIC_GROCERIES.chicken1kg);
    expect(result.bread).toBe(STATIC_GROCERIES.bread);
    expect(result.onion1kg).toBe(STATIC_GROCERIES.onion1kg);
    expect(result.apple1kg).toBe(STATIC_GROCERIES.apple1kg);
    expect(result.ramen).toBe(STATIC_GROCERIES.ramen);
  });
});

describe('constants', () => {
  it('CITY_CONFIGS: 도쿄/오사카 포함', () => {
    expect(Object.keys(CITY_CONFIGS)).toHaveLength(2);
    expect(CITY_CONFIGS.tokyo).toBeDefined();
    expect(CITY_CONFIGS.osaka).toBeDefined();
  });

  it('도쿄 설정에 필수 필드 포함', () => {
    const tokyo = CITY_CONFIGS.tokyo;
    expect(tokyo.id).toBe('tokyo');
    expect(tokyo.name.ko).toBe('도쿄');
    expect(tokyo.name.en).toBe('Tokyo');
    expect(tokyo.country).toBe('JP');
    expect(tokyo.currency).toBe('JPY');
    expect(tokyo.region).toBe('asia');
  });

  it('오사카 설정에 필수 필드 포함', () => {
    const osaka = CITY_CONFIGS.osaka;
    expect(osaka.id).toBe('osaka');
    expect(osaka.name.ko).toBe('오사카');
    expect(osaka.name.en).toBe('Osaka');
  });

  it('STATIC_RENT: 도쿄/오사카 임대료 (JPY 단위)', () => {
    expect(STATIC_RENT.tokyo.share).toBeGreaterThan(10000);
    expect(STATIC_RENT.tokyo.studio).toBeGreaterThan(STATIC_RENT.tokyo.share);
    expect(STATIC_RENT.osaka.share).toBeGreaterThan(10000);
    expect(STATIC_RENT.osaka.share).toBeLessThan(STATIC_RENT.tokyo.share);
  });

  it('STATIC_FOOD: 도쿄/오사카 외식비', () => {
    expect(STATIC_FOOD.tokyo.restaurantMeal).toBeGreaterThan(0);
    expect(STATIC_FOOD.osaka.restaurantMeal).toBeGreaterThan(0);
    expect(STATIC_FOOD.tokyo.restaurantMeal).toBeGreaterThan(STATIC_FOOD.osaka.restaurantMeal);
  });

  it('SOURCE_RENT 정의', () => {
    expect(SOURCE_RENT.category).toBe('rent');
    expect(SOURCE_RENT.name).toContain('e-Stat');
    expect(SOURCE_RENT.url).toContain('e-stat.go.jp');
  });

  it('SOURCE_FOOD 정의', () => {
    expect(SOURCE_FOOD.category).toBe('food');
    expect(SOURCE_FOOD.name).toContain('e-Stat');
    expect(SOURCE_FOOD.url).toContain('e-stat.go.jp');
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
    const result = await refreshJpEstat({ dryRun: true, useStatic: true });

    expect(result.source).toBe('jp_estat');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    await refreshJpEstat({ dryRun: true, useStatic: true });

    const tokyoPath = path.join(testDir, 'cities', 'tokyo.json');
    expect(fs.existsSync(tokyoPath)).toBe(false);
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    const result = await refreshJpEstat({ dryRun: true, useStatic: true });

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

  it('도쿄/오사카 모두 처리', async () => {
    const result = await refreshJpEstat({ dryRun: true, useStatic: true });

    const tokyoChanges = result.changes.filter((c: RefreshChange) => c.cityId === 'tokyo');
    const osakaChanges = result.changes.filter((c: RefreshChange) => c.cityId === 'osaka');

    expect(tokyoChanges.length).toBeGreaterThan(0);
    expect(osakaChanges.length).toBeGreaterThan(0);
  }, 30000);

  it('JP_ESTAT_APP_ID 미설정 + useStatic=false: throws MissingApiKeyError (us_bls 와 일관)', async () => {
    await expect(refreshJpEstat({ dryRun: true, useStatic: false })).rejects.toThrow('JP_ESTAT_APP_ID');
  }, 30000);

  it('JP_ESTAT_APP_ID 설정 + useStatic=false: fetchEstatData 호출 (v1.0 sample 수집)', async () => {
    process.env.JP_ESTAT_APP_ID = 'test-app-id';
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(VALID_ESTAT_RESPONSE), { status: 200 }),
    );
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    await refreshJpEstat({ dryRun: true, useStatic: false, cities: ['tokyo'] });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('api.e-stat.go.jp'),
      expect.objectContaining({ headers: expect.objectContaining({ Accept: 'application/json' }) }),
    );
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('e-Stat rent sample='));
    fetchSpy.mockRestore();
    infoSpy.mockRestore();
  }, 30000);

  it('기존 데이터 대비 changes 계산', async () => {
    const existingData = {
      id: 'tokyo',
      name: { ko: '도쿄', en: 'Tokyo' },
      country: 'JP',
      currency: 'JPY',
      region: 'asia',
      lastUpdated: '2026-04-01',
      rent: { share: 50000, studio: 70000, oneBed: 90000, twoBed: 130000 },
      food: { restaurantMeal: 1000, cafe: 400, groceries: { milk1L: 200, eggs12: 250, rice1kg: 400, chicken1kg: 800, bread: 150 } },
      transport: { monthlyPass: 10000, singleRide: 170, taxiBase: 450 },
      sources: [{ category: 'rent', name: 'e-Stat', url: 'https://e-stat.go.jp/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'tokyo.json'),
      JSON.stringify(existingData),
    );

    const result = await refreshJpEstat({ dryRun: true, useStatic: true, cities: ['tokyo'] });

    expect(result.changes.length).toBeGreaterThan(0);
    const rentChange = result.changes.find((c: RefreshChange) => c.field.startsWith('rent.'));
    expect(rentChange).toBeDefined();
    expect(typeof rentChange?.pctChange).toBe('number');
  }, 30000);

  it('알 수 없는 도시: errors에 추가', async () => {
    const result = await refreshJpEstat({ dryRun: true, useStatic: true, cities: ['unknown-city'] });

    expect(result.errors.some((e: RefreshError) => e.cityId === 'unknown-city')).toBe(true);
  }, 30000);

  // silent fail 금지 회귀 차단.
  it('fetchEstatData fetch 실패 시 console.warn 으로 예외 노출 (silent fail 금지)', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network timeout'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await fetchEstatData('0003427113', '13000', 'test-app-id');

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[jp_estat\] fetchEstatData 0003427113\/13000 failed: .*Network timeout/),
    );
    fetchSpy.mockRestore();
    warnSpy.mockRestore();
  }, 30000);

  // v1.0 계약 회귀 차단.
  // jp_estat 가 fetchEstatData 응답을 STATIC 보정에 적용하지 않음을 보장 (v1.x 단위 검증 도입 전까지).
  it('v1.0 계약: e-Stat API sample 응답이 도시 JSON 의 rent/food 값에 영향 없음', async () => {
    process.env.JP_ESTAT_APP_ID = 'test-app-id';

    // STATIC 과 큰 차이 나는 의도적 sample 값 — 만약 v1.0 에서 응답이 STATIC 보정에 wire 된다면
    // result.changes 의 rent/food 값이 sample 영향을 받아야 한다. 본 테스트는 그렇지 않음을 단언.
    const farFromStaticResponse = {
      GET_STATS_DATA: {
        STATISTICAL_DATA: { DATA_INF: { VALUE: [{ $: '999999' }] } },
      },
    };
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(farFromStaticResponse), { status: 200 }),
    );
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const withApi = await refreshJpEstat({ dryRun: true, useStatic: false, cities: ['tokyo'] });
    fetchSpy.mockRestore();
    infoSpy.mockRestore();

    const withStatic = await refreshJpEstat({ dryRun: true, useStatic: true, cities: ['tokyo'] });

    // 두 모드의 rent/food 변동 결과가 완전히 동일해야 함 — API sample 가 STATIC 에 미반영.
    const apiRentValues = withApi.changes
      .filter((c: RefreshChange) => c.cityId === 'tokyo' && c.field.startsWith('rent.'))
      .map((c: RefreshChange) => c.newValue);
    const staticRentValues = withStatic.changes
      .filter((c: RefreshChange) => c.cityId === 'tokyo' && c.field.startsWith('rent.'))
      .map((c: RefreshChange) => c.newValue);

    expect(apiRentValues).toEqual(staticRentValues);
  }, 30000);
});
