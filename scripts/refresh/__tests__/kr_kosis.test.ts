/**
 * kr_kosis.mjs 테스트.
 * TESTING.md §9-A.3 인벤토리.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshKrKosis, {
  parseCpiData,
  cpiToPrice,
  ITEM_CODES,
  BASE_PRICES,
  SOURCE,
} from '../kr_kosis.mjs';

let originalDataDir: string | undefined;
let originalApiKey: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-kr-kosis-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  originalApiKey = process.env.KR_DATA_API_KEY;
  process.env.DATA_DIR = path.join(testDir, 'cities');
  process.env.KR_DATA_API_KEY = 'test-api-key';
});

afterEach(() => {
  if (testDir && testDir.includes('test-kr-kosis-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  process.env.KR_DATA_API_KEY = originalApiKey;
  jest.restoreAllMocks();
});

const VALID_CPI_RESPONSE = [
  { ITM_ID: 'G1201', DT: '115.5', PRD_DE: '202604' },
  { ITM_ID: 'G1201', DT: '114.0', PRD_DE: '202603' },
  { ITM_ID: 'G1301', DT: '108.2', PRD_DE: '202604' },
  { ITM_ID: 'G1301', DT: '107.5', PRD_DE: '202603' },
];

describe('parseCpiData', () => {
  it('정상 응답 파싱', () => {
    const items = parseCpiData(VALID_CPI_RESPONSE);
    expect(items).toHaveLength(4);
    expect(items[0]).toEqual({ itemCode: 'G1201', cpi: 115.5, period: '202604' });
  });

  it('빈 응답: 빈 배열', () => {
    expect(parseCpiData(null)).toEqual([]);
    expect(parseCpiData([])).toEqual([]);
    expect(parseCpiData({})).toEqual([]);
  });

  it('유효하지 않은 CPI 무시', () => {
    const data = [
      { ITM_ID: 'G1201', DT: 'abc', PRD_DE: '202604' },
      { ITM_ID: 'G1301', DT: '0', PRD_DE: '202604' },
      { ITM_ID: 'G1401', DT: '-10', PRD_DE: '202604' },
    ];
    const items = parseCpiData(data);
    expect(items).toHaveLength(0);
  });

  it('기간 없는 데이터도 파싱', () => {
    const data = [{ ITM_ID: 'G1201', DT: '110.0' }];
    const items = parseCpiData(data);
    expect(items[0]).toEqual({ itemCode: 'G1201', cpi: 110.0, period: '' });
  });
});

describe('cpiToPrice', () => {
  it('restaurantMeal: 기준가 9000원 기준 변환', () => {
    const price = cpiToPrice('restaurantMeal', 100);
    expect(price).toBe(9000);
  });

  it('restaurantMeal: CPI 115 → 10400원 (반올림)', () => {
    const price = cpiToPrice('restaurantMeal', 115);
    expect(price).toBe(10400);
  });

  it('cafe: 기준가 5500원 기준 변환', () => {
    const price = cpiToPrice('cafe', 100);
    expect(price).toBe(5500);
  });

  it('cafe: CPI 108 → 5900원', () => {
    const price = cpiToPrice('cafe', 108);
    expect(price).toBe(5900);
  });

  it('100원 단위 반올림', () => {
    const price = cpiToPrice('restaurantMeal', 112.3);
    expect(price % 100).toBe(0);
  });
});

describe('constants', () => {
  it('ITEM_CODES: restaurantMeal, cafe 정의', () => {
    expect(ITEM_CODES.restaurantMeal).toBe('G1201');
    expect(ITEM_CODES.cafe).toBe('G1301');
  });

  it('BASE_PRICES: 기준 가격 정의', () => {
    expect(BASE_PRICES.restaurantMeal).toBe(9000);
    expect(BASE_PRICES.cafe).toBe(5500);
  });

  it('SOURCE 정의', () => {
    expect(SOURCE.category).toBe('food');
    expect(SOURCE.name).toContain('KOSIS');
    expect(SOURCE.url).toContain('kosis');
  });
});

describe('refresh (integration)', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  it('API 키 부재: MissingApiKeyError throw', async () => {
    delete process.env.KR_DATA_API_KEY;

    await expect(refreshKrKosis()).rejects.toThrow('KR_DATA_API_KEY');
  });

  it('정상 응답: restaurantMeal, cafe 매핑', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => VALID_CPI_RESPONSE,
    });

    const result = await refreshKrKosis({ dryRun: true });

    expect(result.source).toBe('kr_kosis');
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it('dryRun=true: 파일 미갱신', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => VALID_CPI_RESPONSE,
    });

    await refreshKrKosis({ dryRun: true });

    const seoulPath = path.join(testDir, 'cities', 'seoul.json');
    expect(fs.existsSync(seoulPath)).toBe(false);
  });

  it('최신 기간 데이터 사용', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => VALID_CPI_RESPONSE,
    });

    const result = await refreshKrKosis({ dryRun: true });

    const mealChange = result.changes.find((c: any) => c.field === 'food.restaurantMeal');
    expect(mealChange?.newValue).toBe(cpiToPrice('restaurantMeal', 115.5));
  });

  it('빈 응답: errors 추가', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => [],
    });

    const result = await refreshKrKosis({ dryRun: true });

    expect(result.cities).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('CPI 항목 누락: errors에 기록', async () => {
    const partialResponse = [{ ITM_ID: 'G1201', DT: '115.5', PRD_DE: '202604' }];
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => partialResponse,
    });

    const result = await refreshKrKosis({ dryRun: true });

    expect(result.errors.some((e: any) => e.reason.includes('Missing CPI for cafe'))).toBe(true);
  });

  it('비-JSON 응답: errors 추가', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'text/html']]),
      text: async () => '<html>Error</html>',
    });

    const result = await refreshKrKosis({ dryRun: true });

    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('HTTP 4xx: errors에 추가', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 400,
    });

    const result = await refreshKrKosis({ dryRun: true });

    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('기존 데이터 대비 changes 계산', async () => {
    const existingData = {
      id: 'seoul',
      name: { ko: '서울', en: 'Seoul' },
      country: 'KR',
      currency: 'KRW',
      region: 'asia',
      lastUpdated: '2026-04-01',
      rent: { share: 300000, studio: 600000, oneBed: 1000000, twoBed: 1500000 },
      food: {
        restaurantMeal: 9000,
        cafe: 5000,
        groceries: { milk1L: 3000, eggs12: 6000, rice1kg: 5000, chicken1kg: 15000, bread: 3500 },
      },
      transport: { monthlyPass: 65000, singleRide: 1400, taxiBase: 4800 },
      sources: [{ category: 'food', name: 'KOSIS', url: 'https://kosis.kr/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'seoul.json'),
      JSON.stringify(existingData),
    );

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => VALID_CPI_RESPONSE,
    });

    const result = await refreshKrKosis({ dryRun: true });

    expect(result.changes.length).toBeGreaterThan(0);
    const mealChange = result.changes.find((c: any) => c.field === 'food.restaurantMeal');
    expect(mealChange).toBeDefined();
    expect(typeof mealChange?.pctChange).toBe('number');
  });

  it('반환 객체 구조: RefreshResult', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => VALID_CPI_RESPONSE,
    });

    const result = await refreshKrKosis({ dryRun: true });

    expect(result).toHaveProperty('source');
    expect(result).toHaveProperty('cities');
    expect(result).toHaveProperty('fields');
    expect(result).toHaveProperty('changes');
    expect(result).toHaveProperty('errors');
  });
});
