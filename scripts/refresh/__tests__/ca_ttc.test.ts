/**
 * ca_ttc.mjs 테스트.
 * TESTING.md §9-A.4 인벤토리.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshCaTtc, {
  parseFareHtml,
  STATIC_FARES,
  SOURCE,
} from '../ca_ttc.mjs';
import type { RefreshChange } from './_test-types';

let originalDataDir: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-ca-ttc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = path.join(testDir, 'cities');
});

afterEach(() => {
  if (testDir && testDir.includes('test-ca-ttc-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  jest.restoreAllMocks();
});

const VALID_FARE_HTML = `
<html>
<body>
  <h2>TTC Fares</h2>
  <p>Adult Cash Fare: $3.50</p>
  <p>Adult Monthly Pass: $156.30</p>
</body>
</html>
`;

describe('parseFareHtml', () => {
  it('정상 HTML 파싱: 1회권 + 월정기권 (CAD 단위)', () => {
    const fares = parseFareHtml(VALID_FARE_HTML);
    expect(fares.singleRide).toBe(3.5);
    expect(fares.monthlyPass).toBe(156.3);
  });

  it('빈 HTML: 빈 객체 반환', () => {
    const fares = parseFareHtml('');
    expect(fares.singleRide).toBeUndefined();
    expect(fares.monthlyPass).toBeUndefined();
  });

  it('PRESTO 요금 패턴', () => {
    const html = '<p>PRESTO: $3.35</p>';
    const fares = parseFareHtml(html);
    expect(fares.singleRide).toBe(3.35);
  });

  it('다양한 월정기권 패턴', () => {
    const html1 = '<p>Monthly Pass: $158.00</p>';
    const html2 = '<p>TTC Monthly: $160.00</p>';

    expect(parseFareHtml(html1).monthlyPass).toBe(158);
    expect(parseFareHtml(html2).monthlyPass).toBe(160);
  });

  it('비정상적인 값 무시 (1회권 > $10)', () => {
    const html = '<p>Adult Fare: $12.00</p>';
    const fares = parseFareHtml(html);
    expect(fares.singleRide).toBeUndefined();
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
    expect(SOURCE.name).toContain('TTC');
    expect(SOURCE.url).toContain('ttc');
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
    const result = await refreshCaTtc({ dryRun: true, useStatic: true });

    expect(result.source).toBe('ca_ttc');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);

  it('정상 HTML 응답: 운임 파싱', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => VALID_FARE_HTML,
    });

    const result = await refreshCaTtc({ dryRun: true });

    expect(result.source).toBe('ca_ttc');
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    await refreshCaTtc({ dryRun: true, useStatic: true });

    const torontoPath = path.join(testDir, 'cities', 'toronto.json');
    expect(fs.existsSync(torontoPath)).toBe(false);
  }, 30000);

  it('fetch 실패: 정적 fallback + errors', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await refreshCaTtc({ dryRun: true });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.reason).toContain('static fallback');
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);

  it('기존 데이터 대비 changes 계산', async () => {
    const existingData = {
      id: 'toronto',
      name: { ko: '토론토', en: 'Toronto' },
      country: 'CA',
      currency: 'CAD',
      region: 'na',
      lastUpdated: '2026-04-01',
      rent: { share: 1200, studio: 1800, oneBed: 2200, twoBed: 2800 },
      food: { restaurantMeal: 2100, cafe: 550, groceries: { milk1L: 310, eggs12: 420, rice1kg: 340, chicken1kg: 1420, bread: 340 } },
      transport: { monthlyPass: 15000, singleRide: 340, taxiBase: 450 },
      sources: [{ category: 'transport', name: 'TTC', url: 'https://ttc.ca/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'toronto.json'),
      JSON.stringify(existingData),
    );

    const result = await refreshCaTtc({ dryRun: true, useStatic: true });

    expect(result.changes.length).toBeGreaterThan(0);
    const monthlyChange = result.changes.find((c: RefreshChange) => c.field === 'transport.monthlyPass');
    expect(monthlyChange).toBeDefined();
    expect(typeof monthlyChange?.pctChange).toBe('number');
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    const result = await refreshCaTtc({ dryRun: true, useStatic: true });

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
