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
  toConvertedRent,
  DEPOSIT_CONVERSION_RATE,
  MIN_SAMPLE_SIZE,
  SEOUL_DISTRICT_CODES,
  SOURCE,
} from '../kr_molit.mjs';
import { isTotalFailure } from '../_common.mjs';
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

// 공공데이터포털 RTMSDataSvcRHRent 기술문서의 응답 예제 형식 — 성공 코드 `000`/`OK`,
// deposit·monthlyRent 는 만원 단위, 페이지 정보는 body 의 items 뒤에 온다.
function rentItem(excluUseAr: string, deposit: string, monthlyRent: string): string {
  return `
      <item>
        <buildYear>2019</buildYear>
        <contractTerm/>
        <contractType> </contractType>
        <dealDay>10</dealDay>
        <dealMonth>10</dealMonth>
        <dealYear>2026</dealYear>
        <deposit>${deposit}</deposit>
        <excluUseAr>${excluUseAr}</excluUseAr>
        <floor>2</floor>
        <houseType>다세대</houseType>
        <jibun>211-11</jibun>
        <mhouseNm>테스트빌라</mhouseNm>
        <monthlyRent>${monthlyRent}</monthlyRent>
        <preDeposit/>
        <preMonthlyRent/>
        <sggCd>11110</sggCd>
        <umdNm>신영동</umdNm>
        <useRRRight> </useRRRight>
      </item>`;
}

function rentResponse(
  items: string[],
  resultCode = '000',
  resultMsg = 'OK',
  totalCount = items.length,
): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<response>
  <header>
    <resultCode>${resultCode}</resultCode>
    <resultMsg>${resultMsg}</resultMsg>
  </header>
  <body>
    <items>${items.join('')}
    </items>
    <numOfRows>1000</numOfRows>
    <pageNo>1</pageNo>
    <totalCount>${totalCount}</totalCount>
  </body>
</response>`;
}

const VALID_RENT_ITEMS = [
  rentItem('8.5', '500', '35'),
  rentItem('25.0', '1,000', '65'),
  rentItem('45.0', '3,000', '120'),
  rentItem('65.0', '5,000', '180'),
  // 전세 (월세 0) — 월세 집계에서 제외돼야 한다.
  rentItem('84.99', '70,000', '0'),
];
const VALID_RENT_XML = rentResponse(VALID_RENT_ITEMS);

// refresh 통합 테스트용 — 25개 구가 모두 이 응답을 받는다. 구마다 같은 계약을 2건씩 두어 구간별 표본이
// MIN_SAMPLE_SIZE(30) 를 넘게 한다 (25개 구 × 2 = 50건, 5개 구가 실패해도 40건). 메디안은 VALID_RENT_XML 과 같다.
const DISTRICT_RENT_XML = rentResponse([...VALID_RENT_ITEMS, ...VALID_RENT_ITEMS]);

describe('parseRentXml', () => {
  it('정상 XML 파싱: 매물 데이터 추출 — 보증금·월세 만원 → 원 환산, 전세(월세 0) 제외', () => {
    const items = parseRentXml(VALID_RENT_XML);
    expect(items).toHaveLength(4);
    expect(items[0]).toEqual({ area: 8.5, deposit: 5000000, monthlyRent: 350000 });
    expect(items[1]).toEqual({ area: 25.0, deposit: 10000000, monthlyRent: 650000 });
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

  it('콤마 포함 숫자 처리 (만원 단위)', () => {
    const xml = `<item><deposit>24,500</deposit><excluUseAr>30</excluUseAr><monthlyRent>1,050</monthlyRent></item>`;
    const items = parseRentXml(xml);
    expect(items).toHaveLength(1);
    expect(items[0]?.deposit).toBe(245000000);
    expect(items[0]?.monthlyRent).toBe(10500000);
  });

  it('보증금 0 (무보증 월세) 은 유효한 계약으로 포함', () => {
    const xml = `<item><deposit>0</deposit><excluUseAr>20</excluUseAr><monthlyRent>60</monthlyRent></item>`;
    expect(parseRentXml(xml)).toEqual([{ area: 20, deposit: 0, monthlyRent: 600000 }]);
  });

  it('보증금 누락 item 무시 — 월세만 남기면 환산 월세가 낮게 치우친다', () => {
    const xml = `<item><excluUseAr>30</excluUseAr><monthlyRent>50</monthlyRent></item>`;
    expect(parseRentXml(xml)).toEqual([]);
  });
});

describe('toConvertedRent', () => {
  it('환산 월세 = 월세 + 보증금 × 전월세전환율 ÷ 12 (원 단위 반올림)', () => {
    // 2억 4,500만 × 4.6% ÷ 12 = 939,166.67 → 350,000 + 939,167
    expect(toConvertedRent({ deposit: 245000000, monthlyRent: 350000 })).toBe(1289167);
  });

  it('보증금 0 이면 월세 그대로', () => {
    expect(toConvertedRent({ deposit: 0, monthlyRent: 600000 })).toBe(600000);
  });
});

describe('parseResultCode', () => {
  it('정상 응답 코드: 000 OK', () => {
    const result = parseResultCode(VALID_RENT_XML);
    expect(result.ok).toBe(true);
    expect(result.code).toBe('000');
    expect(result.msg).toBe('OK');
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

  it('DEPOSIT_CONVERSION_RATE: 한국부동산원 서울 연립·다세대 전월세전환율 2026년 9월 4.6% (ADR-087)', () => {
    expect(DEPOSIT_CONVERSION_RATE).toBe(0.046);
  });

  it('MIN_SAMPLE_SIZE: 구간 메디안을 갱신에 쓰는 최소 월세 계약 수 30건 (ADR-088)', () => {
    expect(MIN_SAMPLE_SIZE).toBe(30);
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

  it('정상 응답 (000 OK): 오류 없이 25개 자치구 환산 월세 메디안 → rent 원 단위 매핑', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => DISTRICT_RENT_XML,
    });

    const result = await refreshKrMolit({ dryRun: true });

    expect(result.source).toBe('kr_molit');
    expect(result.errors).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(25);
    const newValues = Object.fromEntries(
      result.changes.map((c: RefreshChange) => [c.field, c.newValue]),
    );
    // 월세 + 보증금 × 4.6% ÷ 12 — 예: share 35만 + 500만 × 0.046 / 12 = 369,167
    expect(newValues).toEqual({
      'rent.share': 369167,
      'rent.studio': 688333,
      'rent.oneBed': 1315000,
      'rent.twoBed': 1991667,
    });
  }, 30000);

  it('보증금이 큰 반전세가 섞임: 월세만의 메디안(40만)이 아니라 환산 월세 메디안', async () => {
    // 같은 31~50㎡ 구간에 보증금 1,000만 / 2억 / 2억 4,500만 계약이 섞인 경우 (2억 4,500만·35만·40.96㎡
    // 는 2026-10 실제 응답에 있던 계약). 월세만 보면 [35, 40, 90]만 → 메디안 40만으로 실제 주거비보다 낮다.
    // 환산: 90만 + 1,000만×4.6%/12 = 938,333 · 40만 + 2억×4.6%/12 = 1,166,667 · 35만 + 2.45억×4.6%/12 = 1,289,167
    const mixedXml = rentResponse([
      rentItem('45.0', '1,000', '90'),
      rentItem('40.96', '24,500', '35'),
      rentItem('42.0', '20,000', '40'),
    ]);
    fetchSpy.mockResolvedValue({ ok: true, status: 200, text: async () => mixedXml });

    const result = await refreshKrMolit({ dryRun: true });

    expect(result.errors).toEqual([]);
    const oneBed = result.changes.find((c: RefreshChange) => c.field === 'rent.oneBed');
    expect(oneBed?.newValue).not.toBe(400000);
    expect(oneBed?.newValue).toBe(1166667);
  }, 30000);

  describe('구간 표본 부족', () => {
    // 첫 구에만 계약을 두고 나머지 24개 구는 0건 — 구간별 표본 수를 정확히 맞춘다.
    function mockFirstDistrictOnly(items: string[]): void {
      fetchSpy.mockImplementation(async (url: string) => {
        const lawd = new URL(url).searchParams.get('LAWD_CD');
        const xml = rentResponse(lawd === SEOUL_DISTRICT_CODES[0] ? items : []);
        return { ok: true, status: 200, text: async () => xml };
      });
    }

    function writeExistingSeoul(rent: Record<string, number>): void {
      const existingData = {
        id: 'seoul',
        name: { ko: '서울', en: 'Seoul' },
        country: 'KR',
        currency: 'KRW',
        region: 'asia',
        lastUpdated: '2026-05-02',
        rent,
        food: { restaurantMeal: 9000, cafe: 5000, groceries: { milk1L: 3000, eggs12: 6000, rice1kg: 5000, chicken1kg: 15000, bread: 3500 } },
        transport: { monthlyPass: 65000, singleRide: 1400, taxiBase: 4800 },
        sources: [{ category: 'rent', name: '국토교통부 실거래가 공개시스템', url: 'https://rt.molit.go.kr/', accessedAt: '2026-05-02' }],
      };
      fs.writeFileSync(path.join(testDir, 'cities', 'seoul.json'), JSON.stringify(existingData));
    }

    function readSeoulRent(): Record<string, number> {
      const json = JSON.parse(fs.readFileSync(path.join(testDir, 'cities', 'seoul.json'), 'utf-8'));
      return json.rent;
    }

    const repeat = (n: number, item: string): string[] => Array.from({ length: n }, () => item);
    // 현재 앱 값 (초기 시드).
    const EXISTING_RENT = { share: 350000, studio: 650000, oneBed: 1200000, twoBed: 1800000 };

    it('share 월세 계약 3건 (2026-10 실제 응답 규모): 기존 값 유지 + warnings, 나머지 구간만 갱신', async () => {
      // 2026-10 실제 응답은 share 3건 · studio 2,966 · oneBed 2,038 · twoBed 1,129 건이었다.
      writeExistingSeoul(EXISTING_RENT);
      mockFirstDistrictOnly([
        rentItem('8.0', '1,000', '65'),
        rentItem('9.5', '500', '60'),
        rentItem('7.2', '2,000', '70'),
        ...repeat(40, rentItem('25.0', '5,000', '45')),
        ...repeat(40, rentItem('45.0', '7,500', '45')),
        ...repeat(40, rentItem('65.0', '13,000', '50')),
      ]);

      const result = await refreshKrMolit();

      expect(result.errors).toEqual([]);
      expect(result.fields).toEqual(['studio', 'oneBed', 'twoBed']);
      expect(result.changes.map((c: RefreshChange) => c.field)).not.toContain('rent.share');
      expect(readSeoulRent()).toEqual({
        share: EXISTING_RENT.share,
        // 45만 + 5,000만 × 4.6% ÷ 12 = 641,667 · 45만 + 7,500만 × 4.6% ÷ 12 = 737,500 · 50만 + 1억 3,000만 × 4.6% ÷ 12 = 998,333
        studio: 641667,
        oneBed: 737500,
        twoBed: 998333,
      });
      const shareWarnings = (result.warnings ?? []).filter((w: { reason: string }) => w.reason.includes('rent.share'));
      expect(shareWarnings).toHaveLength(1);
      expect(shareWarnings[0]?.cityId).toBe('seoul');
      expect(shareWarnings[0]?.reason).toContain('3 monthly-rent contracts');
    }, 30000);

    const BIN_AREAS = { share: '8.0', studio: '25.0', oneBed: '45.0', twoBed: '65.0' } as const;
    const BINS = Object.keys(BIN_AREAS) as Array<keyof typeof BIN_AREAS>;

    it.each(BINS)('%s 만 MIN_SAMPLE_SIZE - 1 건: 그 구간만 기존 값 유지 + warnings (네 구간 같은 기준)', async (bin) => {
      writeExistingSeoul(EXISTING_RENT);
      mockFirstDistrictOnly(
        BINS.flatMap((b) =>
          repeat(b === bin ? MIN_SAMPLE_SIZE - 1 : MIN_SAMPLE_SIZE, rentItem(BIN_AREAS[b], '0', '50')),
        ),
      );

      const result = await refreshKrMolit();

      expect(result.errors).toEqual([]);
      expect(result.fields).toEqual(BINS.filter((b) => b !== bin));
      const rent = readSeoulRent();
      for (const b of BINS) {
        expect(rent[b]).toBe(b === bin ? EXISTING_RENT[b] : 500000);
      }
      expect(result.warnings).toEqual([
        {
          cityId: 'seoul',
          reason: expect.stringContaining(`rent.${bin}: only ${MIN_SAMPLE_SIZE - 1} monthly-rent contracts`),
        },
      ]);
    }, 30000);

    it('seoul.json 이 없음 + share 3건: share 는 시드 placeholder null (값을 만들지 않음), 나머지 구간만 채움', async () => {
      mockFirstDistrictOnly([
        rentItem('8.0', '1,000', '65'),
        rentItem('9.5', '500', '60'),
        rentItem('7.2', '2,000', '70'),
        ...BINS.filter((b) => b !== 'share').flatMap((b) => repeat(MIN_SAMPLE_SIZE, rentItem(BIN_AREAS[b], '0', '50'))),
      ]);

      const result = await refreshKrMolit();

      expect(result.errors).toEqual([]);
      expect(result.fields).toEqual(['studio', 'oneBed', 'twoBed']);
      expect(readSeoulRent()).toEqual({ share: null, studio: 500000, oneBed: 500000, twoBed: 500000 });
      expect((result.warnings ?? []).map((w: { reason: string }) => w.reason.split(':')[0])).toEqual(['rent.share']);
    }, 30000);

    it('네 구간 모두 MIN_SAMPLE_SIZE 미만: 파일 미갱신 + warnings 4건, 전부 실패가 아님 (exit 0)', async () => {
      writeExistingSeoul(EXISTING_RENT);
      mockFirstDistrictOnly(BINS.flatMap((b) => repeat(MIN_SAMPLE_SIZE - 1, rentItem(BIN_AREAS[b], '0', '50'))));

      const result = await refreshKrMolit();

      expect(result.cities).toEqual([]);
      expect(result.changes).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(isTotalFailure(result)).toBe(false);
      expect(readSeoulRent()).toEqual(EXISTING_RENT);
      expect((result.warnings ?? []).map((w: { reason: string }) => w.reason.split(':')[0])).toEqual(
        BINS.map((b) => `rent.${b}`),
      );
    }, 30000);

    it('네 구간 모두 정확히 MIN_SAMPLE_SIZE 건: 전부 갱신, warnings 없음', async () => {
      writeExistingSeoul(EXISTING_RENT);
      mockFirstDistrictOnly(BINS.flatMap((b) => repeat(MIN_SAMPLE_SIZE, rentItem(BIN_AREAS[b], '0', '50'))));

      const result = await refreshKrMolit();

      expect(result.fields).toEqual(BINS);
      expect(readSeoulRent()).toEqual({ share: 500000, studio: 500000, oneBed: 500000, twoBed: 500000 });
      expect(result.warnings ?? []).toEqual([]);
    }, 30000);
  });

  it('dryRun=true: 파일 미갱신', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => DISTRICT_RENT_XML,
    });

    await refreshKrMolit({ dryRun: true });

    const seoulPath = path.join(testDir, 'cities', 'seoul.json');
    expect(fs.existsSync(seoulPath)).toBe(false);
  }, 30000);

  it('API 키 미등록 응답 (30): errors에 추가', async () => {
    const errorXml = rentResponse([], '30', 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR');
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => errorXml,
    });

    const result = await refreshKrMolit({ dryRun: true });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.reason).toContain('API key');
  }, 30000);

  it('매물 0건 (공개 지연): warnings 추가 + 빈 cities, errors 는 비어 있음', async () => {
    const emptyXml = rentResponse([]);
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => emptyXml,
    });

    const result = await refreshKrMolit({ dryRun: true });

    expect(result.cities).toHaveLength(0);
    expect((result.warnings ?? []).length).toBeGreaterThan(0);
    expect((result.warnings ?? [])[0]?.reason).toContain('No rental data');
    expect((result.warnings ?? [])[0]?.reason).not.toContain('WARN:');
    expect(result.errors).toEqual([]);
  }, 30000);

  it('totalCount 가 numOfRows(1000) 초과: 다음 페이지까지 모아 집계', async () => {
    // 송파구처럼 한 달 거래가 1000건을 넘는 자치구 — 1페이지는 studio 만, 2페이지에만 twoBed
    // (구마다 2건 → 25개 구 50건으로 MIN_SAMPLE_SIZE 이상).
    const page1 = rentResponse(
      Array.from({ length: 1000 }, () => rentItem('25.0', '1,000', '65')),
      '000',
      'OK',
      1002,
    );
    const twoBedItem = rentItem('65.0', '5,000', '180');
    const page2 = rentResponse([twoBedItem, twoBedItem], '000', 'OK', 1002);
    fetchSpy.mockImplementation(async (url: string) => {
      const pageNo = new URL(url).searchParams.get('pageNo');
      return { ok: true, status: 200, text: async () => (pageNo === '2' ? page2 : page1) };
    });

    const result = await refreshKrMolit({ dryRun: true });

    expect(result.errors).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(50);
    const twoBed = result.changes.find((c: RefreshChange) => c.field === 'rent.twoBed');
    expect(twoBed?.newValue).toBe(1991667);
  }, 30000);

  it('정상 응답에 totalCount 누락: 페이지가 잘렸는지 알 수 없으므로 errors 에 추가', async () => {
    const noTotalCount = VALID_RENT_XML.replace(/<totalCount>\d+<\/totalCount>/, '');
    fetchSpy.mockResolvedValue({ ok: true, status: 200, text: async () => noTotalCount });

    const result = await refreshKrMolit({ dryRun: true });

    expect(result.errors).toHaveLength(25);
    expect(result.errors[0]?.reason).toContain('totalCount');
    expect(result.cities).toHaveLength(0);
  }, 30000);

  it('결과 코드 03 (No Data): 오류가 아닌 매물 0건으로 처리', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => rentResponse([], '03', 'No Data'),
    });

    const result = await refreshKrMolit({ dryRun: true });

    expect(result.cities).toHaveLength(0);
    expect((result.warnings ?? [])[0]?.reason).toContain('No rental data');
    expect(result.errors).toEqual([]);
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
        text: async () => DISTRICT_RENT_XML,
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
      text: async () => DISTRICT_RENT_XML,
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
      text: async () => DISTRICT_RENT_XML,
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
