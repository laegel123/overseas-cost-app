/**
 * de_destatis.mjs 테스트.
 * TESTING.md §9-A.7 인벤토리.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshDeDestatis, {
  parseGenesisXml,
  getRentForCity,
  getGroceriesForCity,
  checkDestatisApiStatus,
  CITY_CONFIGS,
  STATIC_RENT,
  STATIC_GROCERIES_BASE,
  STATIC_FOOD_BASE,
  SOURCE_RENT,
  SOURCE_FOOD,
} from '../de_destatis.mjs';
import type { RefreshChange, RefreshError } from './_test-types';

let originalDataDir: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-de-destatis-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = path.join(testDir, 'cities');
});

afterEach(() => {
  if (testDir && testDir.includes('test-de-destatis-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  jest.restoreAllMocks();
});

describe('parseGenesisXml', () => {
  it('정상 XML 파싱', () => {
    const xml = '<response><wert>1234.56</wert></response>';
    const result = parseGenesisXml(xml);
    expect(result).toBeCloseTo(1234.56, 2);
  });

  it('독일 소수점 형식 (콤마)', () => {
    const xml = '<response><wert>1234,56</wert></response>';
    const result = parseGenesisXml(xml);
    expect(result).toBeCloseTo(1234.56, 2);
  });

  it('빈 문자열: null 반환', () => {
    expect(parseGenesisXml('')).toBeNull();
  });

  it('null/undefined: null 반환', () => {
    expect(parseGenesisXml(null as any)).toBeNull();
    expect(parseGenesisXml(undefined as any)).toBeNull();
  });

  it('wert 태그 없음: null 반환', () => {
    const xml = '<response><value>123</value></response>';
    const result = parseGenesisXml(xml);
    expect(result).toBeNull();
  });

  it('음수 값: null 반환', () => {
    const xml = '<response><wert>-100</wert></response>';
    const result = parseGenesisXml(xml);
    expect(result).toBeNull();
  });
});

describe('getRentForCity', () => {
  it('베를린: 보정계수 1.0', () => {
    const result = getRentForCity('berlin', 1.0);

    expect(result.share).toBe(STATIC_RENT.berlin.share);
    expect(result.studio).toBe(STATIC_RENT.berlin.studio);
    expect(result.oneBed).toBe(STATIC_RENT.berlin.oneBed);
    expect(result.twoBed).toBe(STATIC_RENT.berlin.twoBed);
  });

  it('뮌헨: 보정계수 1.35', () => {
    const result = getRentForCity('munich', 1.35);

    expect(result.share).toBe(Math.round(STATIC_RENT.munich.share * 1.35));
    expect(result.studio).toBe(Math.round(STATIC_RENT.munich.studio * 1.35));
  });

  it('알 수 없는 도시: 베를린 기본값 사용', () => {
    const result = getRentForCity('unknown', 1.0);

    expect(result.share).toBe(STATIC_RENT.berlin.share);
  });
});

describe('getGroceriesForCity', () => {
  it('보정계수 1.0: 기본값', () => {
    const result = getGroceriesForCity(1.0);

    expect(result.milk1L).toBe(STATIC_GROCERIES_BASE.milk1L);
    expect(result.eggs12).toBe(STATIC_GROCERIES_BASE.eggs12);
    expect(result.rice1kg).toBe(STATIC_GROCERIES_BASE.rice1kg);
  });

  it('보정계수 1.10: 뮌헨 (10% 높음)', () => {
    const result = getGroceriesForCity(1.10);

    expect(result.milk1L).toBeCloseTo(STATIC_GROCERIES_BASE.milk1L * 1.10, 2);
    expect(result.eggs12).toBeCloseTo(STATIC_GROCERIES_BASE.eggs12 * 1.10, 2);
  });

  it('모든 필드가 양수', () => {
    const result = getGroceriesForCity(1.0);

    expect(result.milk1L).toBeGreaterThan(0);
    expect(result.eggs12).toBeGreaterThan(0);
    expect(result.rice1kg).toBeGreaterThan(0);
    expect(result.chicken1kg).toBeGreaterThan(0);
    expect(result.bread).toBeGreaterThan(0);
    expect(result.onion1kg).toBeGreaterThan(0);
    expect(result.apple1kg).toBeGreaterThan(0);
    expect(result.ramen).toBeGreaterThan(0);
  });
});

describe('constants', () => {
  it('CITY_CONFIGS: 베를린 + 뮌헨', () => {
    expect(Object.keys(CITY_CONFIGS)).toHaveLength(2);
    expect(CITY_CONFIGS.berlin).toBeDefined();
    expect(CITY_CONFIGS.munich).toBeDefined();
  });

  it('각 도시 설정에 필수 필드 포함', () => {
    for (const [cityId, config] of Object.entries(CITY_CONFIGS)) {
      expect(config.id).toBe(cityId);
      expect(config.name.ko).toBeDefined();
      expect(config.name.en).toBeDefined();
      expect(config.country).toBe('DE');
      expect(config.currency).toBe('EUR');
      expect(config.region).toBe('eu');
      expect(config.bundesland).toBeDefined();
      expect(config.rentAdjustment).toBeGreaterThan(0);
      expect(config.foodAdjustment).toBeGreaterThan(0);
    }
  });

  it('뮌헨 보정계수가 베를린보다 높음', () => {
    expect(CITY_CONFIGS.munich.rentAdjustment).toBeGreaterThan(CITY_CONFIGS.berlin.rentAdjustment);
    expect(CITY_CONFIGS.munich.foodAdjustment).toBeGreaterThan(CITY_CONFIGS.berlin.foodAdjustment);
  });

  it('SOURCE_RENT 정의', () => {
    expect(SOURCE_RENT.category).toBe('rent');
    expect(SOURCE_RENT.name).toContain('Destatis');
    expect(SOURCE_RENT.url).toContain('destatis.de');
  });

  it('SOURCE_FOOD 정의', () => {
    expect(SOURCE_FOOD.category).toBe('food');
    expect(SOURCE_FOOD.name).toContain('Destatis');
    expect(SOURCE_FOOD.url).toContain('destatis.de');
  });
});

describe('checkDestatisApiStatus', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useRealTimers();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.useFakeTimers();
  });

  it('API 정상: true 반환', async () => {
    fetchSpy.mockResolvedValue({ ok: true });

    const result = await checkDestatisApiStatus();

    expect(result).toBe(true);
  }, 30000);

  it('API 오류: false 반환', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await checkDestatisApiStatus();

    expect(result).toBe(false);
  }, 30000);
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
    const result = await refreshDeDestatis({ dryRun: true, useStatic: true });

    expect(result.source).toBe('de_destatis');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    await refreshDeDestatis({ dryRun: true, useStatic: true });

    const berlinPath = path.join(testDir, 'cities', 'berlin.json');
    const munichPath = path.join(testDir, 'cities', 'munich.json');
    expect(fs.existsSync(berlinPath)).toBe(false);
    expect(fs.existsSync(munichPath)).toBe(false);
  }, 30000);

  it('특정 도시만 갱신', async () => {
    const result = await refreshDeDestatis({ dryRun: true, useStatic: true, cities: ['berlin'] });

    const berlinChanges = result.changes.filter((c: RefreshChange) => c.cityId === 'berlin');
    const munichChanges = result.changes.filter((c: RefreshChange) => c.cityId === 'munich');

    expect(berlinChanges.length).toBeGreaterThan(0);
    expect(munichChanges.length).toBe(0);
  }, 30000);

  it('API 불가: errors에 추가 + static fallback', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await refreshDeDestatis({ dryRun: true });

    expect(result.errors.some((e: RefreshError) => e.reason.includes('unavailable'))).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    const result = await refreshDeDestatis({ dryRun: true, useStatic: true });

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

  it('알 수 없는 도시: errors에 추가', async () => {
    const result = await refreshDeDestatis({ dryRun: true, useStatic: true, cities: ['unknown-city'] });

    expect(result.errors.some((e: RefreshError) => e.cityId === 'unknown-city')).toBe(true);
  }, 30000);
});
