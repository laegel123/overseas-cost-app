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

// 실제 HUD 응답 (FY2027, `GET /fmr/data/{entityId}`, 2026-11-27 Actions 진단 실행 45924160488).
// 일반 FMR 지역 — basicdata 가 객체. 값은 숫자, 연도는 basicdata.year.
const NYC_HUD_RESPONSE = {
  data: {
    county_name: '',
    counties_msa:
      'Bronx County, NY; Kings County, NY; New York County, NY; Putnam County, NY; Queens County, NY; Richmond County, NY; Rockland County, NY; and Westchester County, NY',
    town_name: '',
    metro_status: '1.0',
    metro_name: 'New York-Newark-Jersey City, NY-NJ',
    area_name: 'New York, NY HUD Metro FMR Area',
    basicdata: {
      Efficiency: 2593,
      'One-Bedroom': 2729,
      'Two-Bedroom': 2971,
      'Three-Bedroom': 3760,
      'Four-Bedroom': 4121,
      year: '2027',
    },
  },
};

// Small Area FMR 지역 (smallarea_status '1') — basicdata 가 우편번호별 행 배열 (LA 실제 475행 중 앞 3행).
// zip_code 'MSA level' 행이 지역 전체 FMR (statedata/CA 의 같은 지역 값과 일치). 연도는 data.year.
const LA_SAFMR_ROWS = [
  { zip_code: 'MSA level', Efficiency: 2151, 'One-Bedroom': 2402, 'Two-Bedroom': 2964, 'Three-Bedroom': 3760, 'Four-Bedroom': 4208 },
  { zip_code: '90001', Efficiency: 1690, 'One-Bedroom': 1890, 'Two-Bedroom': 2330, 'Three-Bedroom': 2960, 'Four-Bedroom': 3310 },
  { zip_code: '90002', Efficiency: 1690, 'One-Bedroom': 1890, 'Two-Bedroom': 2330, 'Three-Bedroom': 2960, 'Four-Bedroom': 3310 },
];

function laSafmrResponse(basicdata: unknown[] = LA_SAFMR_ROWS) {
  return {
    data: {
      county_name: '',
      counties_msa: 'Los Angeles County, CA; ',
      town_name: '',
      metro_status: '1.0',
      metro_name: 'Los Angeles-Long Beach-Anaheim, CA',
      area_name: 'Los Angeles-Long Beach-Glendale, CA HUD Metro FMR Area',
      smallarea_status: '1',
      year: '2027',
      basicdata,
    },
  };
}

describe('parseHudResponse', () => {
  it('일반 FMR 지역 (뉴욕): basicdata 객체 — Efficiency → studio', () => {
    const result = parseHudResponse(NYC_HUD_RESPONSE);
    expect(result.studio).toBe(2593);
    expect(result.oneBed).toBe(2729);
    expect(result.twoBed).toBe(2971);
  });

  it('Small Area FMR 지역 (LA): basicdata 배열에서 zip_code "MSA level" 행 사용', () => {
    const result = parseHudResponse(laSafmrResponse());
    expect(result).toEqual({ studio: 2151, oneBed: 2402, twoBed: 2964 });
  });

  it('SAFMR: "MSA level" 행이 첫 행이 아니어도 zip_code 로 찾음', () => {
    const [msaRow, ...zipRows] = LA_SAFMR_ROWS;
    const result = parseHudResponse(laSafmrResponse([...zipRows, msaRow]));
    expect(result).toEqual({ studio: 2151, oneBed: 2402, twoBed: 2964 });
  });

  it('SAFMR: "MSA level" 행이 없으면 null — 우편번호 행 값으로 대체 안 함', () => {
    const result = parseHudResponse(laSafmrResponse(LA_SAFMR_ROWS.slice(1)));
    expect(result).toEqual({ studio: null, oneBed: null, twoBed: null });
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

  it('entityId: HUD 하위 FMR 지역(HMFA) 코드 — listMetroAreas 확인값 (MSA 코드 METRO#####M##### 는 404)', () => {
    expect(CITY_CONFIGS.nyc.entityId).toBe('METRO35620MM5600'); // New York, NY HUD Metro FMR Area
    expect(CITY_CONFIGS.la.entityId).toBe('METRO31080MM4480'); // Los Angeles-Long Beach-Glendale, CA HUD Metro FMR Area
    expect(CITY_CONFIGS.sf.entityId).toBe('METRO41860MM7360'); // San Francisco, CA HUD Metro FMR Area
    expect(CITY_CONFIGS.seattle.entityId).toBe('METRO42660MM7600'); // Seattle-Bellevue, WA HUD Metro FMR Area
    expect(CITY_CONFIGS.boston.entityId).toBe('METRO14460MM1120'); // Boston-Cambridge-Quincy, MA-NH HUD Metro FMR Area
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
      json: async () => NYC_HUD_RESPONSE,
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
      json: async () => NYC_HUD_RESPONSE,
    });

    const result = await refreshUsHud({ dryRun: true });

    expect(result.source).toBe('us_hud');
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);

  it('SAFMR 응답 도시 (la): "MSA level" 행 값으로 rent 매핑', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => laSafmrResponse(),
    });

    const result = await refreshUsHud({ dryRun: true, cities: ['la'] });

    expect(result.errors).toHaveLength(0);
    expect(result.cities).toEqual(['la']);
    const byField = Object.fromEntries(result.changes.map((c: RefreshChange) => [c.field, c.newValue]));
    expect(byField).toEqual({
      'rent.share': Math.round(2151 * 0.65),
      'rent.studio': 2151,
      'rent.oneBed': 2402,
      'rent.twoBed': 2964,
    });
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => NYC_HUD_RESPONSE,
    });

    await refreshUsHud({ dryRun: true });

    const nycPath = path.join(testDir, 'cities', 'nyc.json');
    expect(fs.existsSync(nycPath)).toBe(false);
  }, 30000);

  it('특정 도시만 갱신', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => NYC_HUD_RESPONSE,
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
      json: async () => NYC_HUD_RESPONSE,
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
      json: async () => NYC_HUD_RESPONSE,
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
