/**
 * ca_stm.mjs 테스트.
 * TESTING.md §9-A.4 인벤토리.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshCaStm, {
  parseFareHtml,
  STATIC_FARES,
  SOURCE,
} from '../ca_stm.mjs';

let originalDataDir: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-ca-stm-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = path.join(testDir, 'cities');
});

afterEach(() => {
  if (testDir && testDir.includes('test-ca-stm-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  jest.restoreAllMocks();
});

const VALID_FARE_HTML = `
<html>
<body>
  <h2>STM Fares</h2>
  <p>1 trip: $3.75</p>
  <p>Monthly pass: $94.00</p>
</body>
</html>
`;

describe('parseFareHtml', () => {
  it('정상 HTML 파싱: 1회권 + 월정기권 (CAD 단위)', () => {
    const fares = parseFareHtml(VALID_FARE_HTML);
    expect(fares.singleRide).toBe(3.75);
    expect(fares.monthlyPass).toBe(94);
  });

  it('빈 HTML: 빈 객체 반환', () => {
    const fares = parseFareHtml('');
    expect(fares.singleRide).toBeUndefined();
    expect(fares.monthlyPass).toBeUndefined();
  });

  it('다양한 1회권 패턴', () => {
    const html1 = '<p>Single trip: $3.50</p>';
    const html2 = '<p>Regular fare: $3.75</p>';
    const html3 = '<p>3.50 $ par trajet</p>';

    expect(parseFareHtml(html1).singleRide).toBe(3.5);
    expect(parseFareHtml(html2).singleRide).toBe(3.75);
    expect(parseFareHtml(html3).singleRide).toBe(3.5);
  });

  it('다양한 월정기권 패턴', () => {
    const html1 = '<p>Unlimited monthly: $95.00</p>';
    const html2 = '<p>OPUS Monthly: $97.00</p>';
    const html3 = '<p>94.00 $ mensuel</p>';

    expect(parseFareHtml(html1).monthlyPass).toBe(95);
    expect(parseFareHtml(html2).monthlyPass).toBe(97);
    expect(parseFareHtml(html3).monthlyPass).toBe(94);
  });

  it('비정상적인 값 무시 (월정기권 > $200)', () => {
    const html = '<p>Monthly pass: $250.00</p>';
    const fares = parseFareHtml(html);
    expect(fares.monthlyPass).toBeUndefined();
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
    expect(SOURCE.name).toContain('STM');
    expect(SOURCE.url).toContain('stm');
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
    const result = await refreshCaStm({ dryRun: true, useStatic: true });

    expect(result.source).toBe('ca_stm');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);

  it('정상 HTML 응답: 운임 파싱', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => VALID_FARE_HTML,
    });

    const result = await refreshCaStm({ dryRun: true });

    expect(result.source).toBe('ca_stm');
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    await refreshCaStm({ dryRun: true, useStatic: true });

    const montrealPath = path.join(testDir, 'cities', 'montreal.json');
    expect(fs.existsSync(montrealPath)).toBe(false);
  }, 30000);

  it('fetch 실패: 정적 fallback + errors', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await refreshCaStm({ dryRun: true });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.reason).toContain('static fallback');
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);

  it('기존 데이터 대비 changes 계산', async () => {
    const existingData = {
      id: 'montreal',
      name: { ko: '몬트리올', en: 'Montreal' },
      country: 'CA',
      currency: 'CAD',
      region: 'na',
      lastUpdated: '2026-04-01',
      rent: { share: 900, studio: 1400, oneBed: 1700, twoBed: 2100 },
      food: { restaurantMeal: 1900, cafe: 500, groceries: { milk1L: 300, eggs12: 400, rice1kg: 330, chicken1kg: 1380, bread: 320 } },
      transport: { monthlyPass: 9000, singleRide: 350, taxiBase: 370 },
      sources: [{ category: 'transport', name: 'STM', url: 'https://stm.info/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'montreal.json'),
      JSON.stringify(existingData),
    );

    const result = await refreshCaStm({ dryRun: true, useStatic: true });

    expect(result.changes.length).toBeGreaterThan(0);
    const monthlyChange = result.changes.find((c: any) => c.field === 'transport.monthlyPass');
    expect(monthlyChange).toBeDefined();
    expect(typeof monthlyChange?.pctChange).toBe('number');
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    const result = await refreshCaStm({ dryRun: true, useStatic: true });

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
