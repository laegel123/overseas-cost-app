/**
 * ca_translink.mjs 테스트.
 * TESTING.md §9-A.4 인벤토리.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshCaTranslink, {
  parseFareHtml,
  STATIC_FARES,
  SOURCE,
} from '../ca_translink.mjs';
import type { RefreshChange } from './_test-types';

let originalDataDir: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-ca-translink-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = path.join(testDir, 'cities');
});

afterEach(() => {
  if (testDir && testDir.includes('test-ca-translink-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  jest.restoreAllMocks();
});

const VALID_FARE_HTML = `
<html>
<body>
  <h2>Transit Fares</h2>
  <p>Adult Fare: $3.35</p>
  <p>1-Zone Monthly Pass: $104.00</p>
</body>
</html>
`;

describe('parseFareHtml', () => {
  it('정상 HTML 파싱: 1회권 + 월정기권 (CAD 단위)', () => {
    const fares = parseFareHtml(VALID_FARE_HTML);
    expect(fares.singleRide).toBe(3.35);
    expect(fares.monthlyPass).toBe(104);
  });

  it('빈 HTML: 빈 객체 반환', () => {
    const fares = parseFareHtml('');
    expect(fares.singleRide).toBeUndefined();
    expect(fares.monthlyPass).toBeUndefined();
  });

  it('1회권만 있는 경우', () => {
    const html = '<p>Adult Fare: $3.50</p>';
    const fares = parseFareHtml(html);
    expect(fares.singleRide).toBe(3.5);
    expect(fares.monthlyPass).toBeUndefined();
  });

  it('월정기권만 있는 경우', () => {
    const html = '<p>Monthly Pass: $110.00</p>';
    const fares = parseFareHtml(html);
    expect(fares.singleRide).toBeUndefined();
    expect(fares.monthlyPass).toBe(110);
  });

  it('비정상적인 값 무시 (1회권 > $10)', () => {
    const html = '<p>Adult Fare: $15.00</p>';
    const fares = parseFareHtml(html);
    expect(fares.singleRide).toBeUndefined();
  });

  it('비정상적인 값 무시 (월정기권 > $300)', () => {
    const html = '<p>Monthly Pass: $350.00</p>';
    const fares = parseFareHtml(html);
    expect(fares.monthlyPass).toBeUndefined();
  });

  it('다양한 패턴 인식', () => {
    const html1 = '<p>Zone 1: $3.25</p>';
    const html2 = '<p>$3.40 per ride</p>';
    const html3 = '<p>Compass Card Monthly: $105.00</p>';

    expect(parseFareHtml(html1).singleRide).toBe(3.25);
    expect(parseFareHtml(html2).singleRide).toBe(3.4);
    expect(parseFareHtml(html3).monthlyPass).toBe(105);
  });
});

describe('constants', () => {
  it('STATIC_FARES 정의', () => {
    expect(STATIC_FARES.singleRide).toBeGreaterThan(0);
    expect(STATIC_FARES.monthlyPass).toBeGreaterThan(0);
    expect(STATIC_FARES.taxiBase).toBeGreaterThan(0);
  });

  it('SOURCE 정의', () => {
    expect(SOURCE.category).toBe('transport');
    expect(SOURCE.name).toBe('TransLink');
    expect(SOURCE.url).toContain('translink');
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
    const result = await refreshCaTranslink({ dryRun: true, useStatic: true });

    expect(result.source).toBe('ca_translink');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);

  it('정상 HTML 응답: 운임 파싱', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => VALID_FARE_HTML,
    });

    const result = await refreshCaTranslink({ dryRun: true });

    expect(result.source).toBe('ca_translink');
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    await refreshCaTranslink({ dryRun: true, useStatic: true });

    const vancouverPath = path.join(testDir, 'cities', 'vancouver.json');
    expect(fs.existsSync(vancouverPath)).toBe(false);
  }, 30000);

  it('fetch 실패: 정적 fallback + errors', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await refreshCaTranslink({ dryRun: true });

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

    const result = await refreshCaTranslink({ dryRun: true });

    const singleRideChange = result.changes.find((c: RefreshChange) => c.field === 'transport.singleRide');
    expect(singleRideChange?.newValue).toBe(STATIC_FARES.singleRide);
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
      transport: { monthlyPass: 9500, singleRide: 300, taxiBase: 380 },
      sources: [{ category: 'transport', name: 'TransLink', url: 'https://translink.ca/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'vancouver.json'),
      JSON.stringify(existingData),
    );

    const result = await refreshCaTranslink({ dryRun: true, useStatic: true });

    expect(result.changes.length).toBeGreaterThan(0);
    const monthlyChange = result.changes.find((c: RefreshChange) => c.field === 'transport.monthlyPass');
    expect(monthlyChange).toBeDefined();
    expect(typeof monthlyChange?.pctChange).toBe('number');
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    const result = await refreshCaTranslink({ dryRun: true, useStatic: true });

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
