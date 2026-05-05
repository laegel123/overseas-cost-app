/**
 * kr_molit.mjs 테스트.
 * TESTING.md §9-A.3 인벤토리.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshKrMolit, {
  parseRentXml,
  parseResultCode,
  areaToCategory,
  median,
  SEOUL_DISTRICT_CODES,
  SOURCE,
} from '../kr_molit.mjs';
import type { RefreshChange } from './_test-types';

let originalDataDir: string | undefined;
let originalApiKey: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-kr-molit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  originalApiKey = process.env.KR_DATA_API_KEY;
  process.env.DATA_DIR = path.join(testDir, 'cities');
  process.env.KR_DATA_API_KEY = 'test-api-key';
});

afterEach(() => {
  if (testDir && testDir.includes('test-kr-molit-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  process.env.KR_DATA_API_KEY = originalApiKey;
  jest.restoreAllMocks();
});

const VALID_RENT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<response>
  <header>
    <resultCode>00</resultCode>
    <resultMsg>NORMAL SERVICE.</resultMsg>
  </header>
  <body>
    <items>
      <item>
        <excluUseAr>8.5</excluUseAr>
        <monthlyRent>350000</monthlyRent>
      </item>
      <item>
        <excluUseAr>25.0</excluUseAr>
        <monthlyRent>650000</monthlyRent>
      </item>
      <item>
        <excluUseAr>45.0</excluUseAr>
        <monthlyRent>1200000</monthlyRent>
      </item>
      <item>
        <excluUseAr>65.0</excluUseAr>
        <monthlyRent>1800000</monthlyRent>
      </item>
    </items>
  </body>
</response>`;

describe('parseRentXml', () => {
  it('정상 XML 파싱: 매물 데이터 추출', () => {
    const items = parseRentXml(VALID_RENT_XML);
    expect(items).toHaveLength(4);
    expect(items[0]).toEqual({ area: 8.5, monthlyRent: 350000 });
    expect(items[1]).toEqual({ area: 25.0, monthlyRent: 650000 });
  });

  it('빈 XML: 빈 배열 반환', () => {
    const items = parseRentXml('');
    expect(items).toEqual([]);
  });

  it('유효하지 않은 면적 무시', () => {
    const xml = `<item><excluUseAr>abc</excluUseAr><monthlyRent>500000</monthlyRent></item>`;
    const items = parseRentXml(xml);
    expect(items).toEqual([]);
  });

  it('유효하지 않은 임대료 무시', () => {
    const xml = `<item><excluUseAr>30</excluUseAr><monthlyRent>0</monthlyRent></item>`;
    const items = parseRentXml(xml);
    expect(items).toEqual([]);
  });

  it('음수 임대료 무시', () => {
    const xml = `<item><excluUseAr>30</excluUseAr><monthlyRent>-500000</monthlyRent></item>`;
    const items = parseRentXml(xml);
    expect(items).toEqual([]);
  });

  it('콤마 포함 숫자 처리', () => {
    const xml = `<item><excluUseAr>30</excluUseAr><monthlyRent>1,500,000</monthlyRent></item>`;
    const items = parseRentXml(xml);
    expect(items).toHaveLength(1);
    expect(items[0]?.monthlyRent).toBe(1500000);
  });
});

describe('parseResultCode', () => {
  it('정상 응답 코드', () => {
    const result = parseResultCode(VALID_RENT_XML);
    expect(result.ok).toBe(true);
    expect(result.code).toBe('00');
  });

  it('에러 응답 코드', () => {
    const xml = `<resultCode>99</resultCode><resultMsg>ERROR</resultMsg>`;
    const result = parseResultCode(xml);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('99');
    expect(result.msg).toBe('ERROR');
  });

  it('응답 코드 없음', () => {
    const result = parseResultCode('');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('UNKNOWN');
  });
});

describe('areaToCategory', () => {
  it('10㎡ 이하: share', () => {
    expect(areaToCategory(5)).toBe('share');
    expect(areaToCategory(10)).toBe('share');
  });

  it('11~30㎡: studio', () => {
    expect(areaToCategory(11)).toBe('studio');
    expect(areaToCategory(25)).toBe('studio');
    expect(areaToCategory(30)).toBe('studio');
  });

  it('31~50㎡: oneBed', () => {
    expect(areaToCategory(31)).toBe('oneBed');
    expect(areaToCategory(45)).toBe('oneBed');
    expect(areaToCategory(50)).toBe('oneBed');
  });

  it('51~80㎡: twoBed', () => {
    expect(areaToCategory(51)).toBe('twoBed');
    expect(areaToCategory(65)).toBe('twoBed');
    expect(areaToCategory(80)).toBe('twoBed');
  });

  it('80㎡ 초과: null', () => {
    expect(areaToCategory(81)).toBeNull();
    expect(areaToCategory(100)).toBeNull();
  });
});

describe('median', () => {
  it('빈 배열: null', () => {
    expect(median([])).toBeNull();
  });

  it('홀수 개: 중앙값', () => {
    expect(median([1, 2, 3])).toBe(2);
    expect(median([5, 1, 3])).toBe(3);
  });

  it('짝수 개: 평균', () => {
    expect(median([1, 2, 3, 4])).toBe(3);
    expect(median([10, 20])).toBe(15);
  });

  it('단일 원소', () => {
    expect(median([42])).toBe(42);
  });
});

describe('constants', () => {
  it('SEOUL_DISTRICT_CODES: 25개 자치구', () => {
    expect(SEOUL_DISTRICT_CODES).toHaveLength(25);
    expect(SEOUL_DISTRICT_CODES[0]).toBe('11110');
  });

  it('SOURCE 정의', () => {
    expect(SOURCE.category).toBe('rent');
    expect(SOURCE.name).toBe('국토교통부 실거래가 공개시스템');
    expect(SOURCE.url).toContain('molit');
  });
});

describe('refresh (integration)', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  it('API 키 부재: MissingApiKeyError throw', async () => {
    delete process.env.KR_DATA_API_KEY;

    await expect(refreshKrMolit()).rejects.toThrow('KR_DATA_API_KEY');
  });

  it('정상 응답: 25개 자치구 평균 → rent 매핑', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => VALID_RENT_XML,
    });

    const result = await refreshKrMolit({ dryRun: true });

    expect(result.source).toBe('kr_molit');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(fetchSpy).toHaveBeenCalledTimes(25);
  }, 30000);

  it('dryRun=true: 파일 미갱신', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => VALID_RENT_XML,
    });

    await refreshKrMolit({ dryRun: true });

    const seoulPath = path.join(testDir, 'cities', 'seoul.json');
    expect(fs.existsSync(seoulPath)).toBe(false);
  }, 30000);

  it('API 키 만료 응답: errors에 추가', async () => {
    const errorXml = `<resultCode>99</resultCode><resultMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</resultMsg>`;
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => errorXml,
    });

    const result = await refreshKrMolit({ dryRun: true });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.reason).toContain('API key');
  }, 30000);

  it('매물 0건: errors 추가 + 빈 cities', async () => {
    const emptyXml = `<resultCode>00</resultCode><body><items></items></body>`;
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => emptyXml,
    });

    const result = await refreshKrMolit({ dryRun: true });

    expect(result.cities).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.reason).toContain('No rental data');
  }, 30000);

  it('일부 자치구 실패: 나머지 정상 처리', async () => {
    let callCount = 0;
    fetchSpy.mockImplementation(async () => {
      callCount++;
      if (callCount <= 5) {
        return {
          ok: false,
          status: 400,
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => VALID_RENT_XML,
      };
    });

    const result = await refreshKrMolit({ dryRun: true });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.changes.length).toBeGreaterThan(0);
  }, 60000);

  it('HTTP 4xx: 재시도 없이 errors에 추가', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 400,
    });

    const result = await refreshKrMolit({ dryRun: true });

    expect(result.errors.length).toBeGreaterThan(0);
  }, 30000);

  it('빈 응답: errors에 추가', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    });

    const result = await refreshKrMolit({ dryRun: true });

    expect(result.cities).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  }, 30000);

  it('기존 데이터 대비 changes 계산', async () => {
    const existingData = {
      id: 'seoul',
      name: { ko: '서울', en: 'Seoul' },
      country: 'KR',
      currency: 'KRW',
      region: 'asia',
      lastUpdated: '2026-04-01',
      rent: { share: 300000, studio: 600000, oneBed: 1000000, twoBed: 1500000 },
      food: { restaurantMeal: 9000, cafe: 5000, groceries: { milk1L: 3000, eggs12: 6000, rice1kg: 5000, chicken1kg: 15000, bread: 3500 } },
      transport: { monthlyPass: 65000, singleRide: 1400, taxiBase: 4800 },
      sources: [{ category: 'rent', name: '국토교통부', url: 'https://rt.molit.go.kr/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'seoul.json'),
      JSON.stringify(existingData),
    );

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => VALID_RENT_XML,
    });

    const result = await refreshKrMolit({ dryRun: true });

    expect(result.changes.length).toBeGreaterThan(0);
    const shareChange = result.changes.find((c: RefreshChange) => c.field === 'rent.share');
    expect(shareChange).toBeDefined();
    expect(typeof shareChange?.pctChange).toBe('number');
  }, 30000);

  it('반환 객체 구조: RefreshResult', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => VALID_RENT_XML,
    });

    const result = await refreshKrMolit({ dryRun: true });

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
