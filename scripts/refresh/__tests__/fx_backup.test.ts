/**
 * fx_backup.mjs 테스트.
 * TESTING.md §9-A.10 환율 백업 인벤토리.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import refreshFxBackup, {
  parseEcbXml,
  convertToKrwBase,
  ECB_DAILY_URL,
  TARGET_CURRENCIES,
} from '../fx_backup.mjs';
import type { RefreshChange } from './_test-types';

let originalFxFallbackPath: string | undefined;
let testFxFallbackPath: string;
let testDir: string;

beforeEach(() => {
  testDir = path.join(
    os.tmpdir(),
    `test-fx-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(testDir, { recursive: true });
  testFxFallbackPath = path.join(testDir, 'fx_fallback.json');

  originalFxFallbackPath = process.env.FX_FALLBACK_PATH;
  process.env.FX_FALLBACK_PATH = testFxFallbackPath;
});

afterEach(() => {
  if (testDir && testDir.includes('test-fx-')) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  process.env.FX_FALLBACK_PATH = originalFxFallbackPath;
  jest.restoreAllMocks();
});

const VALID_ECB_XML = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
  <gesmes:subject>Reference rates</gesmes:subject>
  <gesmes:Sender>
    <gesmes:name>European Central Bank</gesmes:name>
  </gesmes:Sender>
  <Cube>
    <Cube time="2026-04-27">
      <Cube currency="USD" rate="1.0847"/>
      <Cube currency="JPY" rate="165.49"/>
      <Cube currency="GBP" rate="0.85628"/>
      <Cube currency="CAD" rate="1.4792"/>
      <Cube currency="AUD" rate="1.6358"/>
      <Cube currency="SGD" rate="1.4389"/>
      <Cube currency="KRW" rate="1500.00"/>
    </Cube>
  </Cube>
</gesmes:Envelope>`;

describe('parseEcbXml', () => {
  it('정상 XML 파싱: EUR base rates 추출', () => {
    const rates = parseEcbXml(VALID_ECB_XML);
    expect(rates.EUR).toBe(1);
    expect(rates.USD).toBeCloseTo(1.0847, 4);
    expect(rates.JPY).toBeCloseTo(165.49, 2);
    expect(rates.GBP).toBeCloseTo(0.85628, 5);
    expect(rates.KRW).toBeCloseTo(1500.0, 2);
  });

  it('빈 XML: EUR 만 포함', () => {
    const rates = parseEcbXml('');
    expect(rates).toEqual({ EUR: 1 });
  });

  it('유효하지 않은 rate 무시', () => {
    const xml = `<Cube currency="USD" rate="abc"/><Cube currency="JPY" rate="100"/>`;
    const rates = parseEcbXml(xml);
    expect(rates.USD).toBeUndefined();
    expect(rates.JPY).toBe(100);
  });

  it('rate=0 무시', () => {
    const xml = `<Cube currency="USD" rate="0"/><Cube currency="JPY" rate="100"/>`;
    const rates = parseEcbXml(xml);
    expect(rates.USD).toBeUndefined();
    expect(rates.JPY).toBe(100);
  });

  it('음수 rate 무시', () => {
    const xml = `<Cube currency="USD" rate="-1.5"/><Cube currency="JPY" rate="100"/>`;
    const rates = parseEcbXml(xml);
    expect(rates.USD).toBeUndefined();
    expect(rates.JPY).toBe(100);
  });
});

describe('convertToKrwBase', () => {
  it('EUR base → KRW base 변환', () => {
    const eurRates = {
      EUR: 1,
      USD: 1.1,
      KRW: 1500,
    };
    const krwRates = convertToKrwBase(eurRates);
    expect(krwRates.USD).toBeCloseTo(1500 / 1.1, 2);
    expect(krwRates.KRW).toBeUndefined();
  });

  it('KRW 누락 시 throws', () => {
    const eurRates = {
      EUR: 1,
      USD: 1.1,
    };
    expect(() => convertToKrwBase(eurRates)).toThrow('missing KRW rate');
  });

  it('KRW=0 시 throws', () => {
    const eurRates = {
      EUR: 1,
      USD: 1.1,
      KRW: 0,
    };
    expect(() => convertToKrwBase(eurRates)).toThrow('missing KRW rate');
  });

  it('여러 통화 변환', () => {
    const eurRates = {
      EUR: 1,
      USD: 1.0847,
      JPY: 165.49,
      KRW: 1500.0,
    };
    const krwRates = convertToKrwBase(eurRates);
    expect(krwRates.USD).toBeCloseTo(1500 / 1.0847, 2);
    expect(krwRates.JPY).toBeCloseTo(1500 / 165.49, 4);
    expect(krwRates.EUR).toBeCloseTo(1500 / 1, 2);
  });

  it('비정상 rate 필터링', () => {
    const eurRates: Record<string, number> = {
      EUR: 1,
      USD: 1.1,
      JPY: NaN,
      GBP: -1,
      KRW: 1500,
    };
    const krwRates = convertToKrwBase(eurRates);
    expect(krwRates.USD).toBeCloseTo(1500 / 1.1, 2);
    expect(krwRates.JPY).toBeUndefined();
    expect(krwRates.GBP).toBeUndefined();
  });
});

describe('refresh (integration)', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  it('ECB fetch 성공 → fx_fallback.json 갱신', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => VALID_ECB_XML,
    });

    const result = await refreshFxBackup();

    expect(result.source).toBe('fx_backup');
    expect(result.errors).toHaveLength(0);
    expect(result.cities).toContain('fx');

    const written = JSON.parse(fs.readFileSync(testFxFallbackPath, 'utf-8'));
    expect(written.schemaVersion).toBe(1);
    expect(written.baseCurrency).toBe('KRW');
    expect(written.rates.USD).toBeCloseTo(1500 / 1.0847, 1);
  }, 15000);

  it('dryRun=true: 파일 미갱신', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => VALID_ECB_XML,
    });

    const result = await refreshFxBackup({ dryRun: true });

    expect(result.source).toBe('fx_backup');
    expect(result.errors).toHaveLength(0);
    expect(fs.existsSync(testFxFallbackPath)).toBe(false);
  });

  it.skip('ECB fetch 실패 → 에러 반환 (retries exhausted)', async () => {
    // TODO: fetchWithRetry 가 exponential backoff 7초(1+2+4) 걸림 - 실제 retry 테스트는 _common.test.ts 에서 커버
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await refreshFxBackup();

    expect(result.source).toBe('fx_backup');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.reason).toContain('ECB fetch failed');
    expect(result.cities).toHaveLength(0);
  }, 60000);

  it('ECB 빈 응답 → 에러 반환', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    });

    const result = await refreshFxBackup();

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.reason).toContain('empty response');
  });

  it('ECB 응답에 KRW 누락 → 에러 반환', async () => {
    const xmlWithoutKrw = `<Cube currency="USD" rate="1.0847"/><Cube currency="JPY" rate="165.49"/>`;
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => xmlWithoutKrw,
    });

    const result = await refreshFxBackup();

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.reason).toContain('KRW');
  });

  it('기존 fx_fallback.json 대비 changes 계산', async () => {
    const existingData = {
      schemaVersion: 1,
      baseCurrency: 'KRW',
      asOf: '2026-04-01',
      rates: { USD: 1380.0, JPY: 9.5, EUR: 1450.0 },
    };
    fs.writeFileSync(testFxFallbackPath, JSON.stringify(existingData));

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => VALID_ECB_XML,
    });

    const result = await refreshFxBackup();

    expect(result.changes.length).toBeGreaterThan(0);
    const usdChange = result.changes.find((c: RefreshChange) => c.field === 'USD');
    expect(usdChange).toBeDefined();
    expect(typeof usdChange?.oldValue).toBe('number');
    expect(typeof usdChange?.pctChange).toBe('number');
  }, 15000);

  it('TARGET_CURRENCIES 외 통화 필터링', async () => {
    const xmlWithExtraCurrency = `
      <Cube currency="USD" rate="1.0847"/>
      <Cube currency="KRW" rate="1500"/>
      <Cube currency="XYZ" rate="2.5"/>
    `;
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => xmlWithExtraCurrency,
    });

    const result = await refreshFxBackup();

    expect(result.errors).toHaveLength(0);
    const written = JSON.parse(fs.readFileSync(testFxFallbackPath, 'utf-8'));
    expect(written.rates.USD).toBeDefined();
    expect(written.rates.XYZ).toBeUndefined();
  }, 15000);
});

describe('constants', () => {
  it('ECB_DAILY_URL 정의', () => {
    expect(ECB_DAILY_URL).toBe('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml');
  });

  it('TARGET_CURRENCIES 10개 통화 (KRW 제외 9개)', () => {
    expect(TARGET_CURRENCIES).toContain('USD');
    expect(TARGET_CURRENCIES).toContain('CAD');
    expect(TARGET_CURRENCIES).toContain('EUR');
    expect(TARGET_CURRENCIES).toContain('GBP');
    expect(TARGET_CURRENCIES).toContain('AUD');
    expect(TARGET_CURRENCIES).toContain('JPY');
    expect(TARGET_CURRENCIES).toContain('SGD');
    expect(TARGET_CURRENCIES).toContain('VND');
    expect(TARGET_CURRENCIES).toContain('AED');
  });
});
