/**
 * us_hud.mjs 테스트.
 * TESTING.md §9-A.3 인벤토리.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshUsHud, {
  parseHudResponse,
  mapToRent,
  CITY_CONFIGS,
  SOURCE,
} from '../us_hud.mjs';
import type { RefreshChange } from './_test-types';

let originalDataDir: string | undefined;
let originalApiKey: string | undefined;
let testDir: string;

const TEST_TOKEN = 'test-hud-token';

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-us-hud-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  originalApiKey = process.env.US_HUD_API_KEY;
  process.env.DATA_DIR = path.join(testDir, 'cities');
  process.env.US_HUD_API_KEY = TEST_TOKEN;
});

afterEach(() => {
  if (testDir && testDir.includes('test-us-hud-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  if (originalApiKey === undefined) delete process.env.US_HUD_API_KEY;
  else process.env.US_HUD_API_KEY = originalApiKey;
  jest.restoreAllMocks();
});

const VALID_HUD_RESPONSE = {
  data: {
    basicdata: {
      Efficiency: '1850',
      'One-Bedroom': '2100',
      'Two-Bedroom': '2800',
    },
  },
};

describe('parseHudResponse', () => {
  it('정상 응답 파싱: Efficiency → studio', () => {
    const result = parseHudResponse(VALID_HUD_RESPONSE);
    expect(result.studio).toBe(1850);
    expect(result.oneBed).toBe(2100);
    expect(result.twoBed).toBe(2800);
  });

  it('빈 객체: null 반환', () => {
    const result = parseHudResponse({});
    expect(result.studio).toBeNull();
    expect(result.oneBed).toBeNull();
    expect(result.twoBed).toBeNull();
  });

  it('null/undefined: null 반환', () => {
    expect(parseHudResponse(null).studio).toBeNull();
    expect(parseHudResponse(undefined).studio).toBeNull();
  });

  it('유효하지 않은 값 무시', () => {
    const data = {
      data: {
        basicdata: {
          Efficiency: 'abc',
          'One-Bedroom': '-100',
          'Two-Bedroom': '',
        },
      },
    };
    const result = parseHudResponse(data);
    expect(result.studio).toBeNull();
    expect(result.oneBed).toBeNull();
    expect(result.twoBed).toBeNull();
  });

  it('일부 데이터만 있는 경우', () => {
    const data = {
      data: {
        basicdata: {
          Efficiency: '1500',
        },
      },
    };
    const result = parseHudResponse(data);
    expect(result.studio).toBe(1500);
    expect(result.oneBed).toBeNull();
    expect(result.twoBed).toBeNull();
  });
});

describe('mapToRent', () => {
  it('share = studio × 0.65 (ADR-059)', () => {
    const parsed = { studio: 2000, oneBed: 2500, twoBed: 3200 };
    const result = mapToRent(parsed);

    expect(result.share).toBe(Math.round(2000 * 0.65));
    expect(result.studio).toBe(2000);
    expect(result.oneBed).toBe(2500);
    expect(result.twoBed).toBe(3200);
  });

  it('studio null: share null', () => {
    const parsed = { studio: null, oneBed: 2500, twoBed: null };
    const result = mapToRent(parsed);

    expect(result.share).toBeNull();
    expect(result.oneBed).toBe(2500);
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

  it('각 도시 설정에 필수 필드 포함', () => {
    for (const [cityId, config] of Object.entries(CITY_CONFIGS)) {
      expect(config.id).toBe(cityId);
      expect(config.name.ko).toBeDefined();
      expect(config.name.en).toBeDefined();
      expect(config.country).toBe('US');
      expect(config.currency).toBe('USD');
      expect(config.region).toBe('na');
      expect(config.entityId).toBeDefined();
    }
  });

  it('SOURCE 정의', () => {
    expect(SOURCE.category).toBe('rent');
    expect(SOURCE.name).toContain('HUD Fair Market Rents');
    expect(SOURCE.name).not.toContain('ADR-');
    expect(SOURCE.legacyNames).toContain('HUD Fair Market Rents (share=studio×0.65 estimated, ADR-059)');
    expect(SOURCE.url).toContain('hud');
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

  it('API 키 없음: throw MissingApiKeyError, fetch 호출 안 함', async () => {
    delete process.env.US_HUD_API_KEY;

    await expect(refreshUsHud({ dryRun: true })).rejects.toMatchObject({
      code: 'MISSING_API_KEY',
      message: expect.stringContaining('US_HUD_API_KEY'),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);

  it('Authorization: Bearer <US_HUD_API_KEY> 헤더 전송', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => VALID_HUD_RESPONSE,
    });

    await refreshUsHud({ dryRun: true, cities: ['nyc'] });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe(`https://www.huduser.gov/hudapi/public/fmr/data/${CITY_CONFIGS.nyc.entityId}`);
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${TEST_TOKEN}` });
  }, 30000);

  it('HTTP 401: 재시도 없이 errors 기록, 토큰은 메시지에 노출 안 함', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 401 });

    const result = await refreshUsHud({ dryRun: true, cities: ['nyc'] });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.cities).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.reason).toContain('HTTP 401');
    expect(result.errors[0]?.reason).not.toContain(TEST_TOKEN);
  }, 30000);

  it('정상 응답: 5개 도시 rent 매핑', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => VALID_HUD_RESPONSE,
    });

    const result = await refreshUsHud({ dryRun: true });

    expect(result.source).toBe('us_hud');
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => VALID_HUD_RESPONSE,
    });

    await refreshUsHud({ dryRun: true });

    const nycPath = path.join(testDir, 'cities', 'nyc.json');
    expect(fs.existsSync(nycPath)).toBe(false);
  }, 30000);

  it('특정 도시만 갱신', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => VALID_HUD_RESPONSE,
    });

    const result = await refreshUsHud({ dryRun: true, cities: ['nyc'] });

    const nycChanges = result.changes.filter((c: RefreshChange) => c.cityId === 'nyc');
    const laChanges = result.changes.filter((c: RefreshChange) => c.cityId === 'la');

    expect(nycChanges.length).toBeGreaterThan(0);
    expect(laChanges.length).toBe(0);
  }, 30000);

  it('API 오류: errors에 추가', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await refreshUsHud({ dryRun: true, cities: ['nyc'] });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.cities).toHaveLength(0);
  }, 30000);

  it('빈 응답: errors 추가', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    const result = await refreshUsHud({ dryRun: true, cities: ['nyc'] });

    expect(result.errors.length).toBeGreaterThan(0);
  }, 30000);

  it('기존 데이터 대비 changes 계산', async () => {
    const existingData = {
      id: 'nyc',
      name: { ko: '뉴욕', en: 'New York' },
      country: 'US',
      currency: 'USD',
      region: 'na',
      lastUpdated: '2026-04-01',
      rent: { share: 1000, studio: 1500, oneBed: 1800, twoBed: 2200 },
      food: { restaurantMeal: 20, cafe: 6, groceries: { milk1L: 3, eggs12: 4, rice1kg: 3.5, chicken1kg: 10, bread: 3.5 } },
      transport: { monthlyPass: 132, singleRide: 2.9, taxiBase: 3 },
      sources: [{ category: 'rent', name: 'HUD', url: 'https://hud.gov/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'nyc.json'),
      JSON.stringify(existingData),
    );

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => VALID_HUD_RESPONSE,
    });

    const result = await refreshUsHud({ dryRun: true, cities: ['nyc'] });

    expect(result.changes.length).toBeGreaterThan(0);
    const studioChange = result.changes.find((c: RefreshChange) => c.field === 'rent.studio');
    expect(studioChange).toBeDefined();
    expect(typeof studioChange?.pctChange).toBe('number');
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => VALID_HUD_RESPONSE,
    });

    const result = await refreshUsHud({ dryRun: true });

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
