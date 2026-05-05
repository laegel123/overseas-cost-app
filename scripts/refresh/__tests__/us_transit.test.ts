/**
 * us_transit.mjs 테스트.
 * TESTING.md §9-A.3 인벤토리.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshUsTransit, {
  parseFareHtml,
  CITY_CONFIGS,
  SOURCE,
} from '../us_transit.mjs';
import type { RefreshChange } from './_test-types';

let originalDataDir: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-us-transit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = path.join(testDir, 'cities');
});

afterEach(() => {
  if (testDir && testDir.includes('test-us-transit-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  jest.restoreAllMocks();
});

const VALID_FARE_HTML = `
<html>
<body>
  <h2>Fares</h2>
  <p>Base fare: $2.90 per ride</p>
  <p>30-Day Unlimited Pass: $132.00</p>
</body>
</html>
`;

describe('parseFareHtml', () => {
  it('정상 HTML 파싱: 1회권 + 월정기권', () => {
    const fares = parseFareHtml(VALID_FARE_HTML, 'MTA');
    expect(fares.singleRide).toBe(2.9);
    expect(fares.monthlyPass).toBe(132);
  });

  it('빈 HTML: 빈 객체 반환', () => {
    const fares = parseFareHtml('', 'MTA');
    expect(fares.singleRide).toBeUndefined();
    expect(fares.monthlyPass).toBeUndefined();
  });

  it('1회권만 있는 경우', () => {
    const html = '<p>Single fare: $2.75</p>';
    const fares = parseFareHtml(html, 'Metro');
    expect(fares.singleRide).toBe(2.75);
    expect(fares.monthlyPass).toBeUndefined();
  });

  it('월정기권만 있는 경우', () => {
    const html = '<p>Monthly Unlimited: $100.00</p>';
    const fares = parseFareHtml(html, 'Metro');
    expect(fares.singleRide).toBeUndefined();
    expect(fares.monthlyPass).toBe(100);
  });

  it('비정상적인 값 무시 (1회권 > $10)', () => {
    const html = '<p>$15.00 per ride</p>';
    const fares = parseFareHtml(html, 'Metro');
    expect(fares.singleRide).toBeUndefined();
  });

  it('비정상적인 값 무시 (월정기권 > $300)', () => {
    const html = '<p>Monthly Pass: $350.00</p>';
    const fares = parseFareHtml(html, 'Metro');
    expect(fares.monthlyPass).toBeUndefined();
  });

  it('다양한 패턴 인식', () => {
    const html1 = '<p>Adult fare: $3.00</p>';
    const html2 = '<p>$2.50 subway fare</p>';
    const html3 = '<p>Unlimited ride monthly: $90.00</p>';

    expect(parseFareHtml(html1, 'MTA').singleRide).toBe(3);
    expect(parseFareHtml(html2, 'MTA').singleRide).toBe(2.5);
    expect(parseFareHtml(html3, 'MTA').monthlyPass).toBe(90);
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

  it('각 도시 설정에 fareUrl + agency + staticFares 포함', () => {
    for (const config of Object.values(CITY_CONFIGS)) {
      expect(config.fareUrl).toBeDefined();
      expect(config.fareUrl).toMatch(/^https?:\/\//);
      expect(config.agency).toBeDefined();
      expect(config.staticFares).toBeDefined();
      expect(config.staticFares.singleRide).toBeGreaterThan(0);
      expect(config.staticFares.monthlyPass).toBeGreaterThan(0);
      expect(config.staticFares.taxiBase).toBeGreaterThan(0);
    }
  });

  it('도시별 교통 기관 정의', () => {
    expect(CITY_CONFIGS.nyc.agency).toBe('MTA');
    expect(CITY_CONFIGS.la.agency).toBe('LA Metro');
    expect(CITY_CONFIGS.sf.agency).toBe('SFMTA');
    expect(CITY_CONFIGS.seattle.agency).toBe('King County Metro');
    expect(CITY_CONFIGS.boston.agency).toBe('MBTA');
  });

  it('SOURCE 정의', () => {
    expect(SOURCE.category).toBe('transport');
    expect(SOURCE.name).toContain('MTA');
    expect(SOURCE.name).toContain('LA Metro');
    expect(SOURCE.name).toContain('SFMTA');
    expect(SOURCE.name).toContain('King County Metro');
    expect(SOURCE.name).toContain('MBTA');
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

  it('useStatic=true: 정적 데이터 사용', async () => {
    const result = await refreshUsTransit({ dryRun: true, useStatic: true, cities: ['nyc'] });

    expect(result.source).toBe('us_transit');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);

  it('정상 HTML 응답: 운임 파싱', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => VALID_FARE_HTML,
    });

    const result = await refreshUsTransit({ dryRun: true, cities: ['nyc'] });

    expect(result.source).toBe('us_transit');
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    await refreshUsTransit({ dryRun: true, useStatic: true, cities: ['nyc'] });

    const nycPath = path.join(testDir, 'cities', 'nyc.json');
    expect(fs.existsSync(nycPath)).toBe(false);
  }, 30000);

  it('fetch 실패: 정적 fallback + errors', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await refreshUsTransit({ dryRun: true, cities: ['nyc'] });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.reason).toContain('static fallback');
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);

  it('빈 HTML 응답: 정적 fallback 사용', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    });

    const result = await refreshUsTransit({ dryRun: true, cities: ['nyc'] });

    const singleRideChange = result.changes.find((c: RefreshChange) => c.field === 'transport.singleRide');
    expect(singleRideChange?.newValue).toBe(CITY_CONFIGS.nyc.staticFares.singleRide);
  }, 30000);

  it('5개 도시 모두 갱신', async () => {
    const result = await refreshUsTransit({ dryRun: true, useStatic: true });

    expect(result.cities).toHaveLength(5);
    expect(result.cities).toContain('nyc');
    expect(result.cities).toContain('la');
    expect(result.cities).toContain('sf');
    expect(result.cities).toContain('seattle');
    expect(result.cities).toContain('boston');
  }, 30000);

  it('기존 데이터 대비 changes 계산', async () => {
    const existingData = {
      id: 'nyc',
      name: { ko: '뉴욕', en: 'New York' },
      country: 'US',
      currency: 'USD',
      region: 'na',
      lastUpdated: '2026-04-01',
      rent: { share: 1300, studio: 2000, oneBed: 2500, twoBed: 3200 },
      food: { restaurantMeal: 20, cafe: 6, groceries: { milk1L: 4, eggs12: 4, rice1kg: 3.5, chicken1kg: 10, bread: 3.5 } },
      transport: { monthlyPass: 120, singleRide: 2.75, taxiBase: 2.50 },
      sources: [{ category: 'transport', name: 'MTA', url: 'https://mta.info/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'nyc.json'),
      JSON.stringify(existingData),
    );

    const result = await refreshUsTransit({ dryRun: true, useStatic: true, cities: ['nyc'] });

    expect(result.changes.length).toBeGreaterThan(0);
    const monthlyChange = result.changes.find((c: RefreshChange) => c.field === 'transport.monthlyPass');
    expect(monthlyChange).toBeDefined();
    expect(typeof monthlyChange?.pctChange).toBe('number');
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    const result = await refreshUsTransit({ dryRun: true, useStatic: true, cities: ['nyc'] });

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
