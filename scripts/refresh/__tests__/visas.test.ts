/**
 * visas.mjs 테스트.
 * TESTING.md §9-A.9 인벤토리.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshVisas, {
  VISA_REGISTRY,
  CITY_TO_COUNTRY,
  CITY_CONFIGS,
  SOURCE,
  getVisaForCity,
  fetchVisaFees,
} from '../visas.mjs';

let originalDataDir: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-visas-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = path.join(testDir, 'cities');
});

afterEach(() => {
  if (testDir && testDir.includes('test-visas-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  jest.restoreAllMocks();
});

type VisaRegistryEntry = {
  url: string;
  studentApplicationFee: number;
  workApplicationFee: number;
  settlementApprox: number;
};

describe('VISA_REGISTRY', () => {
  it('11개 국가 모두 포함', () => {
    expect(Object.keys(VISA_REGISTRY)).toHaveLength(11);
  });

  it('각 국가에 비자 fee 필수 필드 포함', () => {
    for (const [, registry] of Object.entries(VISA_REGISTRY) as [string, VisaRegistryEntry][]) {
      expect(registry.url).toMatch(/^https?:\/\//);
      expect(typeof registry.studentApplicationFee).toBe('number');
      expect(registry.studentApplicationFee).toBeGreaterThan(0);
      expect(typeof registry.workApplicationFee).toBe('number');
      expect(registry.workApplicationFee).toBeGreaterThan(0);
      expect(typeof registry.settlementApprox).toBe('number');
      expect(registry.settlementApprox).toBeGreaterThan(0);
    }
  });
});

describe('CITY_TO_COUNTRY', () => {
  it('20개 도시 모두 매핑', () => {
    expect(Object.keys(CITY_TO_COUNTRY)).toHaveLength(20);
  });

  it('각 도시가 유효한 국가 코드로 매핑', () => {
    for (const [, countryCode] of Object.entries(CITY_TO_COUNTRY)) {
      expect((VISA_REGISTRY as any)[countryCode]).toBeDefined();
    }
  });
});

describe('CITY_CONFIGS', () => {
  it('20개 도시 설정', () => {
    expect(Object.keys(CITY_CONFIGS)).toHaveLength(20);
  });

  it('각 도시 필수 필드 포함', () => {
    for (const [cityId, config] of Object.entries(CITY_CONFIGS)) {
      expect(config.id).toBe(cityId);
      expect(config.name.ko).toBeDefined();
      expect(config.name.en).toBeDefined();
      expect(config.country).toBeDefined();
      expect(config.currency).toBeDefined();
      expect(config.region).toBeDefined();
    }
  });
});

describe('SOURCE', () => {
  it('visa 카테고리', () => {
    expect(SOURCE.category).toBe('visa');
    expect(SOURCE.name).toContain('visa');
    expect(SOURCE.url).toBeDefined();
  });
});

describe('fetchVisaFees', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useRealTimers();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.useFakeTimers();
  });

  it('정상 응답: visa 객체 반환', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<html>visa page</html>',
    });

    const result = await fetchVisaFees('CA');

    expect(result.visa).toBeDefined();
    expect((result.visa as any).studentApplicationFee).toBe(VISA_REGISTRY.CA.studentApplicationFee);
    expect((result.visa as any).workApplicationFee).toBe(VISA_REGISTRY.CA.workApplicationFee);
    expect((result.visa as any).settlementApprox).toBe(VISA_REGISTRY.CA.settlementApprox);
    expect(result.fetchedFromPage).toBe(true);
  }, 30000);

  it('fetch 실패: static fallback 사용', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await fetchVisaFees('CA');

    expect(result.visa).toBeDefined();
    expect(result.fetchedFromPage).toBe(false);
  }, 30000);

  it('알 수 없는 국가: error 반환', async () => {
    const result = await fetchVisaFees('XX');

    expect(result.visa).toBeNull();
    expect(result.error).toContain('Unknown country');
  }, 30000);
});

describe('getVisaForCity', () => {
  it('정상 도시: visa 객체 반환', async () => {
    const result = await getVisaForCity('vancouver', { useStatic: true });

    expect(result.visa).toBeDefined();
    expect((result.visa as any).studentApplicationFee).toBe(VISA_REGISTRY.CA.studentApplicationFee);
    expect((result.visa as any).workApplicationFee).toBe(VISA_REGISTRY.CA.workApplicationFee);
    expect((result.visa as any).settlementApprox).toBe(VISA_REGISTRY.CA.settlementApprox);
  });

  it('알 수 없는 도시: null + 에러', async () => {
    const result = await getVisaForCity('unknown-city', { useStatic: true });

    expect(result.visa).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('미국 도시들: 동일한 비자 fee', async () => {
    const nycResult = await getVisaForCity('nyc', { useStatic: true });
    const laResult = await getVisaForCity('la', { useStatic: true });
    const sfResult = await getVisaForCity('sf', { useStatic: true });

    expect((nycResult.visa as any).studentApplicationFee).toBe((laResult.visa as any).studentApplicationFee);
    expect((laResult.visa as any).studentApplicationFee).toBe((sfResult.visa as any).studentApplicationFee);
  });

  it('일본 도시: JPY 단위 settlementApprox', async () => {
    const result = await getVisaForCity('tokyo', { useStatic: true });

    expect((result.visa as any).settlementApprox).toBeGreaterThan(10000);
  });

  it('호치민: VND 단위 settlementApprox', async () => {
    const result = await getVisaForCity('hochiminh', { useStatic: true });

    expect((result.visa as any).settlementApprox).toBeGreaterThan(100000);
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

  it('dryRun=true + useStatic=true: 파일 미갱신', async () => {
    const result = await refreshVisas({ dryRun: true, useStatic: true });

    expect(result.source).toBe('visas');
    expect(result.changes.length).toBeGreaterThan(0);

    const vancouverPath = path.join(testDir, 'cities', 'vancouver.json');
    expect(fs.existsSync(vancouverPath)).toBe(false);
  }, 30000);

  it('특정 도시만 갱신', async () => {
    const result = await refreshVisas({ dryRun: true, useStatic: true, cities: ['vancouver'] });

    const vancouverChanges = result.changes.filter((c: any) => c.cityId === 'vancouver');
    const torontoChanges = result.changes.filter((c: any) => c.cityId === 'toronto');

    expect(vancouverChanges.length).toBeGreaterThan(0);
    expect(torontoChanges.length).toBe(0);
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    const result = await refreshVisas({ dryRun: true, useStatic: true });

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
      transport: { monthlyPass: 10000, singleRide: 300, taxiBase: 400 },
      visa: {
        studentApplicationFee: 100,
        workApplicationFee: 200,
        settlementApprox: 2000,
      },
      sources: [{ category: 'rent', name: 'CMHC', url: 'https://cmhc.ca/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'vancouver.json'),
      JSON.stringify(existingData),
    );

    const result = await refreshVisas({ dryRun: true, useStatic: true, cities: ['vancouver'] });

    expect(result.changes.length).toBeGreaterThan(0);
    const visaChange = result.changes.find((c: any) => c.field.includes('visa'));
    expect(visaChange).toBeDefined();
    expect(typeof visaChange?.pctChange).toBe('number');
  }, 30000);

  it('알 수 없는 도시: errors에 추가', async () => {
    const result = await refreshVisas({ dryRun: true, useStatic: true, cities: ['unknown-city'] });

    expect(result.errors.length).toBeGreaterThan(0);
  }, 30000);

  it('페이지 fetch 실패: errors에 추가 + static fallback', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await refreshVisas({ dryRun: true, cities: ['vancouver'] });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.changes.length).toBeGreaterThan(0);
  }, 30000);

  it('통화별 비자 fee 확인', async () => {
    const result = await refreshVisas({ dryRun: true, useStatic: true });

    const jpChanges = result.changes.filter((c: any) => c.cityId === 'tokyo' || c.cityId === 'osaka');
    const vnChanges = result.changes.filter((c: any) => c.cityId === 'hochiminh');

    for (const change of jpChanges) {
      if (change.field === 'visa.settlementApprox') {
        expect(change.newValue).toBeGreaterThan(10000);
      }
    }

    for (const change of vnChanges) {
      if (change.field === 'visa.settlementApprox') {
        expect(change.newValue).toBeGreaterThan(100000);
      }
    }
  }, 30000);
});
