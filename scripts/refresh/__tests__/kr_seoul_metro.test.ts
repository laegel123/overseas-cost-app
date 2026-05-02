/**
 * kr_seoul_metro.mjs 테스트.
 * TESTING.md §9-A.3 인벤토리.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshKrSeoulMetro, {
  parseMetroFareHtml,
  parseTaxiFareHtml,
  STATIC_FARES,
  SOURCE,
} from '../kr_seoul_metro.mjs';

let originalDataDir: string | undefined;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-kr-metro-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(path.join(testDir, 'cities'), { recursive: true });

  originalDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = path.join(testDir, 'cities');
});

afterEach(() => {
  if (testDir && testDir.includes('test-kr-metro-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.DATA_DIR = originalDataDir;
  jest.restoreAllMocks();
});

const VALID_METRO_HTML = `
<html>
<body>
  <table>
    <tr><td>기본 운임</td><td>1,400원</td></tr>
    <tr><td>정기권</td><td>65,000원</td></tr>
  </table>
</body>
</html>
`;

const VALID_TAXI_HTML = `
<html>
<body>
  <div>서울 택시 기본요금: 4,800원</div>
</body>
</html>
`;

describe('parseMetroFareHtml', () => {
  it('정상 HTML 파싱: singleRide, monthlyPass 추출', () => {
    const fares = parseMetroFareHtml(VALID_METRO_HTML);
    expect(fares.singleRide).toBe(1400);
    expect(fares.monthlyPass).toBe(65000);
  });

  it('빈 HTML: 빈 객체', () => {
    const fares = parseMetroFareHtml('');
    expect(fares).toEqual({});
  });

  it('기본운임 다양한 표현 파싱', () => {
    const html1 = '<div>일반 교통카드 1,500원</div>';
    expect(parseMetroFareHtml(html1).singleRide).toBe(1500);

    const html2 = '<span>1,450원 (기본)</span>';
    expect(parseMetroFareHtml(html2).singleRide).toBe(1450);
  });

  it('정기권 다양한 표현 파싱', () => {
    const html = '<div>월정액권 70,000원</div>';
    expect(parseMetroFareHtml(html).monthlyPass).toBe(70000);
  });

  it('비정상 가격 무시 (범위 체크)', () => {
    const html1 = '<div>기본 운임 50,000원</div>';
    expect(parseMetroFareHtml(html1).singleRide).toBeUndefined();

    const html2 = '<div>정기권 5,000원</div>';
    expect(parseMetroFareHtml(html2).monthlyPass).toBeUndefined();
  });

  it('콤마 포함 숫자 처리', () => {
    const html = '<div>정기권 100,000원</div>';
    expect(parseMetroFareHtml(html).monthlyPass).toBe(100000);
  });
});

describe('parseTaxiFareHtml', () => {
  it('정상 HTML 파싱: taxiBase 추출', () => {
    const fare = parseTaxiFareHtml(VALID_TAXI_HTML);
    expect(fare).toBe(4800);
  });

  it('빈 HTML: null', () => {
    expect(parseTaxiFareHtml('')).toBeNull();
  });

  it('기본요금 다양한 표현 파싱', () => {
    const html = '<div>기본요금 5,000원</div>';
    expect(parseTaxiFareHtml(html)).toBe(5000);
  });

  it('비정상 가격 무시', () => {
    const html1 = '<div>기본요금 500원</div>';
    expect(parseTaxiFareHtml(html1)).toBeNull();

    const html2 = '<div>기본요금 50,000원</div>';
    expect(parseTaxiFareHtml(html2)).toBeNull();
  });
});

describe('constants', () => {
  it('STATIC_FARES: 정적 fallback 값', () => {
    expect(STATIC_FARES.singleRide).toBe(1400);
    expect(STATIC_FARES.monthlyPass).toBe(65000);
    expect(STATIC_FARES.taxiBase).toBe(4800);
  });

  it('SOURCE 정의', () => {
    expect(SOURCE.category).toBe('transport');
    expect(SOURCE.name).toBe('서울교통공사');
    expect(SOURCE.url).toContain('seoulmetro');
  });
});

describe('refresh (integration)', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  it('API 키 불필요: throw 없음', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => VALID_METRO_HTML,
    });

    await expect(refreshKrSeoulMetro({ dryRun: true })).resolves.toBeDefined();
  });

  it('정상 응답: transport 매핑', async () => {
    let callCount = 0;
    fetchSpy.mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        status: 200,
        text: async () => (callCount === 1 ? VALID_METRO_HTML : VALID_TAXI_HTML),
      };
    });

    const result = await refreshKrSeoulMetro({ dryRun: true });

    expect(result.source).toBe('kr_seoul_metro');
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it('useStatic=true: fetch 없이 정적 값 사용', async () => {
    const result = await refreshKrSeoulMetro({ dryRun: true, useStatic: true });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it('dryRun=true: 파일 미갱신', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => VALID_METRO_HTML,
    });

    await refreshKrSeoulMetro({ dryRun: true });

    const seoulPath = path.join(testDir, 'cities', 'seoul.json');
    expect(fs.existsSync(seoulPath)).toBe(false);
  });

  it('fetch 실패: 정적 fallback 사용 + errors 기록', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 400,
    });

    const result = await refreshKrSeoulMetro({ dryRun: true });

    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.reason).toContain('fallback');
  }, 15000);

  it('빈 HTML 응답: 정적 fallback 사용', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    });

    const result = await refreshKrSeoulMetro({ dryRun: true });

    const singleRideChange = result.changes.find((c: any) => c.field === 'transport.singleRide');
    expect(singleRideChange?.newValue).toBe(STATIC_FARES.singleRide);
  });

  it('페이지 구조 변경 (selector 실패): 정적 fallback 사용', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<html><body>Completely different structure</body></html>',
    });

    const result = await refreshKrSeoulMetro({ dryRun: true });

    expect(result.changes.length).toBeGreaterThan(0);
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
      transport: { monthlyPass: 60000, singleRide: 1350, taxiBase: 4500 },
      sources: [{ category: 'transport', name: '서울교통공사', url: 'http://www.seoulmetro.co.kr/', accessedAt: '2026-04-01' }],
    };
    fs.writeFileSync(
      path.join(testDir, 'cities', 'seoul.json'),
      JSON.stringify(existingData),
    );

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => VALID_METRO_HTML,
    });

    const result = await refreshKrSeoulMetro({ dryRun: true });

    expect(result.changes.length).toBeGreaterThan(0);
    const passChange = result.changes.find((c: any) => c.field === 'transport.monthlyPass');
    expect(passChange).toBeDefined();
    expect(typeof passChange?.pctChange).toBe('number');
  });

  it('반환 객체 구조: RefreshResult', async () => {
    const result = await refreshKrSeoulMetro({ dryRun: true, useStatic: true });

    expect(result).toHaveProperty('source');
    expect(result).toHaveProperty('cities');
    expect(result).toHaveProperty('fields');
    expect(result).toHaveProperty('changes');
    expect(result).toHaveProperty('errors');
    expect(Array.isArray(result.cities)).toBe(true);
    expect(Array.isArray(result.fields)).toBe(true);
    expect(Array.isArray(result.changes)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it('HTTP 4xx: errors에 추가, 정적 fallback 사용', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 400,
    });

    const result = await refreshKrSeoulMetro({ dryRun: true });

    expect(result.errors.length).toBeGreaterThan(0);
  });
});
