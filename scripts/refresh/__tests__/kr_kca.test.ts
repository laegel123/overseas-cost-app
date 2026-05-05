/**
 * kr_kca.mjs 테스트.
 * TESTING.md §9-A.3 인벤토리.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshKrKca, {
  parsePriceData,
  normalizePrice,
  ITEM_MAPPING,
  SOURCE,
} from '../kr_kca.mjs';
import type { RefreshChange, RefreshError } from './_test-types';

let originalDataDir: string | undefined;
let originalApiKey: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-kr-kca-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  originalApiKey = process.env.KR_DATA_API_KEY;
  process.env.DATA_DIR = path.join(testDir, 'cities');
  process.env.KR_DATA_API_KEY = 'test-api-key';
});

afterEach(() => {
  if (testDir && testDir.includes('test-kr-kca-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  process.env.KR_DATA_API_KEY = originalApiKey;
  jest.restoreAllMocks();
});

const VALID_PRICE_RESPONSE = {
  response: {
    header: { resultCode: '00', resultMsg: 'NORMAL' },
    body: {
      items: {
        item: [
          { goodsName: '우유', price: '3200', unit: '1000', areaName: '서울' },
          { goodsName: '계란', price: '6500', unit: '30', areaName: '서울' },
          { goodsName: '쌀', price: '55000', unit: '20000', areaName: '서울' },
          { goodsName: '닭고기', price: '12000', unit: '1000', areaName: '서울' },
          { goodsName: '식빵', price: '3500', unit: '1', areaName: '서울' },
          { goodsName: '양파', price: '2500', unit: '1000', areaName: '서울' },
          { goodsName: '사과', price: '8000', unit: '1000', areaName: '서울' },
          { goodsName: '신라면', price: '4500', unit: '5', areaName: '서울' },
        ],
      },
    },
  },
};

describe('parsePriceData', () => {
  it('정상 응답 파싱: 서울 데이터만 추출', () => {
    const items = parsePriceData(VALID_PRICE_RESPONSE);
    expect(items).toHaveLength(8);
    expect(items[0]).toEqual({ itemName: '우유', price: 3200, unit: 1000 });
  });

  it('서울 외 지역 제외', () => {
    const response = {
      response: {
        body: {
          items: {
            item: [
              { goodsName: '우유', price: '3200', unit: '1000', areaName: '부산' },
              { goodsName: '계란', price: '6500', unit: '30', areaName: '서울' },
            ],
          },
        },
      },
    };
    const items = parsePriceData(response);
    expect(items).toHaveLength(1);
    expect(items[0]?.itemName).toBe('계란');
  });

  it('빈 응답: 빈 배열', () => {
    expect(parsePriceData(null)).toEqual([]);
    expect(parsePriceData({})).toEqual([]);
    expect(parsePriceData({ response: {} })).toEqual([]);
  });

  it('유효하지 않은 가격 무시', () => {
    const response = {
      response: {
        body: {
          items: {
            item: [
              { goodsName: '우유', price: 'abc', unit: '1000', areaName: '서울' },
              { goodsName: '계란', price: '0', unit: '30', areaName: '서울' },
              { goodsName: '쌀', price: '-100', unit: '1000', areaName: '서울' },
            ],
          },
        },
      },
    };
    const items = parsePriceData(response);
    expect(items).toHaveLength(0);
  });

  it('품목명 trim 처리', () => {
    const response = {
      response: {
        body: {
          items: {
            item: [{ goodsName: '  우유  ', price: '3200', unit: '1000', areaName: '서울' }],
          },
        },
      },
    };
    const items = parsePriceData(response);
    expect(items[0]?.itemName).toBe('우유');
  });
});

describe('normalizePrice', () => {
  it('우유 매핑', () => {
    const result = normalizePrice('우유', 3200, 1000);
    expect(result).toEqual({ field: 'milk1L', value: 3200 });
  });

  it('계란 30개 → 12개 변환', () => {
    const result = normalizePrice('계란', 6500, 30);
    expect(result?.field).toBe('eggs12');
    expect(result?.value).toBe(2600);
  });

  it('쌀 20kg → 1kg 변환', () => {
    const result = normalizePrice('쌀', 55000, 20000);
    expect(result?.field).toBe('rice1kg');
    expect(result?.value).toBe(2750);
  });

  it('신라면 5개 → 1개 변환', () => {
    const result = normalizePrice('신라면', 4500, 5);
    expect(result?.field).toBe('ramen');
    expect(result?.value).toBe(900);
  });

  it('라면(fallback) 매핑', () => {
    const result = normalizePrice('진라면', 4000, 5);
    expect(result?.field).toBe('ramen');
  });

  it('매핑 없는 품목: null', () => {
    const result = normalizePrice('감자', 5000, 1000);
    expect(result).toBeNull();
  });

  it('부분 매칭 (닭고기(생닭) → 닭고기)', () => {
    const result = normalizePrice('닭고기(생닭)', 15000, 1000);
    expect(result?.field).toBe('chicken1kg');
  });
});

describe('constants', () => {
  it('ITEM_MAPPING: 8개 품목 정의', () => {
    const keys = Object.keys(ITEM_MAPPING);
    expect(keys).toContain('우유');
    expect(keys).toContain('계란');
    expect(keys).toContain('쌀');
    expect(keys).toContain('닭고기');
    expect(keys).toContain('식빵');
    expect(keys).toContain('양파');
    expect(keys).toContain('사과');
    expect(keys).toContain('신라면');
  });

  it('SOURCE 정의', () => {
    expect(SOURCE.category).toBe('food');
    expect(SOURCE.name).toBe('한국소비자원 참가격');
    expect(SOURCE.url).toContain('price.go.kr');
  });
});

describe('refresh (integration)', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  it('API 키 부재: MissingApiKeyError throw', async () => {
    delete process.env.KR_DATA_API_KEY;

    await expect(refreshKrKca()).rejects.toThrow('KR_DATA_API_KEY');
  });

  it('정상 응답: groceries 매핑', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => VALID_PRICE_RESPONSE,
    });

    const result = await refreshKrKca({ dryRun: true });

    expect(result.source).toBe('kr_kca');
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it('dryRun=true: 파일 미갱신', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => VALID_PRICE_RESPONSE,
    });

    await refreshKrKca({ dryRun: true });

    const seoulPath = path.join(testDir, 'cities', 'seoul.json');
    expect(fs.existsSync(seoulPath)).toBe(false);
  });

  it('API 키 만료 (XML 에러 응답)', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/xml']]),
      text: async () => '<error>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</error>',
    });

    const result = await refreshKrKca({ dryRun: true });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.reason).toContain('API key');
  });

  it('빈 응답: errors 추가', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({ response: { body: { items: { item: [] } } } }),
    });

    const result = await refreshKrKca({ dryRun: true });

    expect(result.cities).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('필수 품목 누락: errors에 기록', async () => {
    const partialResponse = {
      response: {
        body: {
          items: {
            item: [{ goodsName: '우유', price: '3200', unit: '1000', areaName: '서울' }],
          },
        },
      },
    };
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => partialResponse,
    });

    const result = await refreshKrKca({ dryRun: true });

    expect(result.errors.some((e: RefreshError) => e.reason.includes('Missing required field'))).toBe(true);
  });

  it('HTTP 4xx: errors에 추가', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 400,
    });

    const result = await refreshKrKca({ dryRun: true });

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
      sources: [{ category: 'food', name: '한국소비자원', url: 'https://price.go.kr/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'seoul.json'),
      JSON.stringify(existingData),
    );

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => VALID_PRICE_RESPONSE,
    });

    const result = await refreshKrKca({ dryRun: true });

    expect(result.changes.length).toBeGreaterThan(0);
    const milkChange = result.changes.find((c: RefreshChange) => c.field === 'food.groceries.milk1L');
    expect(milkChange).toBeDefined();
    expect(typeof milkChange?.pctChange).toBe('number');
  });

  it('반환 객체 구조: RefreshResult', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => VALID_PRICE_RESPONSE,
    });

    const result = await refreshKrKca({ dryRun: true });

    expect(result).toHaveProperty('source');
    expect(result).toHaveProperty('cities');
    expect(result).toHaveProperty('fields');
    expect(result).toHaveProperty('changes');
    expect(result).toHaveProperty('errors');
  });
});
