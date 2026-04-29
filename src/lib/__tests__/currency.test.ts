/**
 * docs/TESTING.md §9.2 매트릭스 — convertToKRW / fetchExchangeRates / refreshFx.
 *
 * 시간은 jest.setSystemTime, 네트워크는 mockFetchSequence, AsyncStorage 는
 * jest.setup.js 의 AsyncStorageMock 으로 격리. flaky 0건 정책 (TESTING §1).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { mockFetchSequence } from '@/__test-utils__/mockFetchSequence';

import {
  __resetInflightForTesting,
  convertToKRW,
  fetchExchangeRates,
  FX_BASELINE_2026Q2,
  refreshFx,
} from '../currency';
import { InvalidAmountError, UnknownCurrencyError } from '../errors';

const FX_KEY = 'fx:v1';
const META_KEY = 'meta:fxLastSync';

const fxFixture = {
  CAD: 980,
  USD: 1380,
  EUR: 1500,
  JPY: 9.0,
  VND: 0.054,
};

/**
 * 1차 endpoint 응답 형식 (open.er-api.com /v6/latest/USD):
 *   { result: 'success', rates: { KRW: <KRW per USD>, X: <X per USD>, ... } }
 *
 * 우리 ExchangeRates 는 1 X = N KRW. 변환식: out[X] = rates.KRW / rates[X].
 *
 * 테스트에서는 주로 KRW=1380, USD=1, CAD=1.3622... (= 1380/1013) 같은
 * shape 으로 응답을 만들고 결과의 KRW base 변환을 검증한다.
 */
function buildPrimaryBody(rates_USD: Record<string, number>): {
  result: 'success';
  rates: Record<string, number>;
} {
  return { result: 'success', rates: rates_USD };
}

describe('convertToKRW', () => {
  describe('정상 케이스', () => {
    it('KRW pass-through (양수)', () => {
      expect(convertToKRW(1234, 'KRW', fxFixture)).toBe(1234);
    });

    it('KRW pass-through (0)', () => {
      expect(convertToKRW(0, 'KRW', fxFixture)).toBe(0);
    });

    it('KRW pass-through 은 fxTable 비어 있어도 동작', () => {
      expect(convertToKRW(1000, 'KRW', {})).toBe(1000);
    });

    it('CAD 1800 → 1,764,000 KRW (rate 980)', () => {
      expect(convertToKRW(1800, 'CAD', fxFixture)).toBe(1_764_000);
    });

    it('EUR 1500 → 2,250,000 KRW (rate 1500)', () => {
      expect(convertToKRW(1500, 'EUR', fxFixture)).toBe(2_250_000);
    });

    it('JPY 120000 → 1,080,000 KRW (작은 환율)', () => {
      expect(convertToKRW(120_000, 'JPY', fxFixture)).toBe(1_080_000);
    });

    it('VND 2000000 → 108,000 KRW (큰 수, 작은 환율)', () => {
      expect(convertToKRW(2_000_000, 'VND', fxFixture)).toBe(108_000);
    });

    it('amount=0 (비-KRW 통화) → 0', () => {
      expect(convertToKRW(0, 'CAD', fxFixture)).toBe(0);
    });

    it('소수 amount → Math.round 정수', () => {
      // 1.5 CAD * 980 = 1470
      expect(convertToKRW(1.5, 'CAD', fxFixture)).toBe(1470);
    });

    it('Math.round 반올림 동작', () => {
      // 0.001 CAD * 980 = 0.98 → round → 1
      expect(convertToKRW(0.001, 'CAD', fxFixture)).toBe(1);
      // 0.0005 CAD * 980 = 0.49 → round → 0
      expect(convertToKRW(0.0005, 'CAD', fxFixture)).toBe(0);
    });
  });

  describe('통화 코드 정규화', () => {
    it("lowercase ('cad') → 정규화 후 매칭", () => {
      expect(convertToKRW(100, 'cad', fxFixture)).toBe(98_000);
    });

    it("trailing space ('CAD ') → 정규화 후 매칭", () => {
      expect(convertToKRW(100, 'CAD ', fxFixture)).toBe(98_000);
    });

    it("mixed case + spaces (' Cad ') → 정규화", () => {
      expect(convertToKRW(100, ' Cad ', fxFixture)).toBe(98_000);
    });

    it("'krw' lowercase 도 KRW pass-through", () => {
      expect(convertToKRW(500, 'krw', {})).toBe(500);
    });
  });

  describe('에러 — InvalidAmountError', () => {
    it('NaN → throws', () => {
      expect(() => convertToKRW(NaN, 'CAD', fxFixture)).toThrow(InvalidAmountError);
    });

    it('Infinity → throws', () => {
      expect(() => convertToKRW(Infinity, 'CAD', fxFixture)).toThrow(InvalidAmountError);
    });

    it('-Infinity → throws', () => {
      expect(() => convertToKRW(-Infinity, 'CAD', fxFixture)).toThrow(InvalidAmountError);
    });

    it('음수 → throws', () => {
      expect(() => convertToKRW(-1, 'CAD', fxFixture)).toThrow(InvalidAmountError);
    });

    it('throws 객체의 code', () => {
      try {
        convertToKRW(NaN, 'CAD', fxFixture);
        throw new Error('should not reach');
      } catch (e) {
        expect(e).toBeInstanceOf(InvalidAmountError);
        expect((e as InvalidAmountError).code).toBe('INVALID_AMOUNT');
      }
    });
  });

  describe('에러 — UnknownCurrencyError', () => {
    it('미지의 통화 (XYZ) → throws', () => {
      expect(() => convertToKRW(100, 'XYZ', fxFixture)).toThrow(UnknownCurrencyError);
    });

    it('빈 fxTable + 비-KRW → throws', () => {
      expect(() => convertToKRW(100, 'CAD', {})).toThrow(UnknownCurrencyError);
    });

    it('형식 위반 (2자리 AB) → throws', () => {
      expect(() => convertToKRW(100, 'AB', fxFixture)).toThrow(UnknownCurrencyError);
    });

    it('형식 위반 (4자리 ABCD) → throws', () => {
      expect(() => convertToKRW(100, 'ABCD', fxFixture)).toThrow(UnknownCurrencyError);
    });

    it('형식 위반 (숫자 포함) → throws', () => {
      expect(() => convertToKRW(100, 'CA1', fxFixture)).toThrow(UnknownCurrencyError);
    });

    it('빈 문자열 → throws', () => {
      expect(() => convertToKRW(100, '', fxFixture)).toThrow(UnknownCurrencyError);
    });

    it('환율 0 → throws (no rate 와 동일 처리)', () => {
      expect(() => convertToKRW(100, 'CAD', { CAD: 0 })).toThrow(UnknownCurrencyError);
    });

    it('환율 음수 → throws', () => {
      expect(() => convertToKRW(100, 'CAD', { CAD: -10 })).toThrow(UnknownCurrencyError);
    });

    it('환율 NaN → throws', () => {
      expect(() => convertToKRW(100, 'CAD', { CAD: NaN })).toThrow(UnknownCurrencyError);
    });

    it('throws 객체의 code', () => {
      try {
        convertToKRW(100, 'XYZ', fxFixture);
        throw new Error('should not reach');
      } catch (e) {
        expect(e).toBeInstanceOf(UnknownCurrencyError);
        expect((e as UnknownCurrencyError).code).toBe('UNKNOWN_CURRENCY');
      }
    });
  });
});

// ─── fetchExchangeRates ────────────────────────────────────────────────────

describe('fetchExchangeRates', () => {
  beforeEach(async () => {
    __resetInflightForTesting();
    await AsyncStorage.clear();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-28T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    __resetInflightForTesting();
  });

  describe('정상 fetch + KRW base 정규화', () => {
    it('성공 응답: USD base → KRW base 변환', async () => {
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          body: buildPrimaryBody({ KRW: 1380, USD: 1, CAD: 1.36, EUR: 0.92 }),
        },
      ]);
      const rates = await fetchExchangeRates();

      // 1 KRW = 1 KRW (pass-through)
      expect(rates.KRW).toBe(1);
      // 1 USD = 1380/1 = 1380 KRW
      expect(rates.USD).toBeCloseTo(1380, 5);
      // 1 CAD = 1380/1.36 ≈ 1014.7 KRW
      expect(rates.CAD).toBeCloseTo(1380 / 1.36, 5);
      // 1 EUR = 1380/0.92 = 1500 KRW
      expect(rates.EUR).toBeCloseTo(1500, 5);
    });

    it('성공 후 AsyncStorage 에 저장 (fx:v1 + meta:fxLastSync)', async () => {
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          body: buildPrimaryBody({ KRW: 1380, USD: 1 }),
        },
      ]);
      await fetchExchangeRates();

      const cached = await AsyncStorage.getItem(FX_KEY);
      expect(cached).not.toBeNull();
      const parsed = JSON.parse(cached!);
      expect(parsed.rates.USD).toBeCloseTo(1380, 5);
      expect(parsed.fetchedAt).toBe(new Date('2026-04-28T00:00:00.000Z').getTime());

      const lastSync = await AsyncStorage.getItem(META_KEY);
      expect(lastSync).toBe('2026-04-28T00:00:00.000Z');
    });

    it('환율에 KRW 자체가 1 로 포함', async () => {
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          body: buildPrimaryBody({ KRW: 1380, USD: 1 }),
        },
      ]);
      const rates = await fetchExchangeRates();
      expect(rates.KRW).toBe(1);
    });

    it('비-ISO 4217 통화 코드 (소문자, 숫자) 는 결과에서 제외', async () => {
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          body: buildPrimaryBody({
            KRW: 1380,
            USD: 1,
            xyz: 1.0,
            ABC1: 1.0,
            CAD: 1.36,
          }),
        },
      ]);
      const rates = await fetchExchangeRates();
      expect(rates.USD).toBeDefined();
      expect(rates.CAD).toBeDefined();
      expect(rates.xyz).toBeUndefined();
      expect(rates.ABC1).toBeUndefined();
    });

    it('rate 값이 비-number 인 항목은 무시 (0 / null / string)', async () => {
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          // JSON.stringify 시 string·null 은 그대로 보존됨
          body: { result: 'success', rates: { KRW: 1380, USD: 1, BAD: 'oops', NUL: null, ZER: 0 } },
        },
      ]);
      const rates = await fetchExchangeRates();
      expect(rates.USD).toBeCloseTo(1380, 5);
      expect(rates.BAD).toBeUndefined();
      expect(rates.NUL).toBeUndefined();
      expect(rates.ZER).toBeUndefined();
    });
  });

  describe('캐시 동작 (24h TTL)', () => {
    async function seedCache(rates: Record<string, number>, fetchedAt: number): Promise<void> {
      await AsyncStorage.setItem(FX_KEY, JSON.stringify({ rates, fetchedAt }));
      await AsyncStorage.setItem(META_KEY, new Date(fetchedAt).toISOString());
    }

    it('cache hit (24h 이내): 네트워크 호출 없음', async () => {
      const fetchedAt = new Date('2026-04-28T00:00:00.000Z').getTime();
      await seedCache({ CAD: 1000, KRW: 1 }, fetchedAt);

      // 12 시간 후 조회
      jest.setSystemTime(new Date('2026-04-28T12:00:00.000Z'));
      const fetchSpy = jest.spyOn(globalThis, 'fetch');

      const rates = await fetchExchangeRates();
      expect(rates.CAD).toBe(1000);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('23h 59m 59.999s 후 — 여전히 hit', async () => {
      const t0 = new Date('2026-04-28T00:00:00.000Z').getTime();
      await seedCache({ CAD: 1000, KRW: 1 }, t0);

      jest.setSystemTime(new Date(t0 + 24 * 60 * 60 * 1000 - 1));
      const fetchSpy = jest.spyOn(globalThis, 'fetch');

      const rates = await fetchExchangeRates();
      expect(rates.CAD).toBe(1000);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('24h 정각 — 만료 → refetch', async () => {
      const t0 = new Date('2026-04-28T00:00:00.000Z').getTime();
      await seedCache({ CAD: 1000, KRW: 1 }, t0);

      jest.setSystemTime(new Date(t0 + 24 * 60 * 60 * 1000));
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          body: buildPrimaryBody({ KRW: 1400, USD: 1, CAD: 1.4 }),
        },
      ]);

      const rates = await fetchExchangeRates();
      // 새 환율 (1400/1.4 = 1000)
      expect(rates.CAD).toBeCloseTo(1000, 5);
      // 그러나 USD 가 1400 (이전 캐시 값에 USD 가 없었던 점으로 갱신 확인)
      expect(rates.USD).toBeCloseTo(1400, 5);
    });

    it('bypassCache=true → 캐시 무시하고 fetch', async () => {
      const t0 = new Date('2026-04-28T00:00:00.000Z').getTime();
      await seedCache({ CAD: 1000, KRW: 1 }, t0);

      // 1시간 후 (캐시 fresh) 인데 강제 새로고침
      jest.setSystemTime(new Date(t0 + 60 * 60 * 1000));
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          body: buildPrimaryBody({ KRW: 1400, USD: 1, CAD: 1.4 }),
        },
      ]);

      const rates = await fetchExchangeRates({ bypassCache: true });
      expect(rates.CAD).toBeCloseTo(1000, 5); // 1400/1.4
      expect(rates.USD).toBeCloseTo(1400, 5);
    });

    it('refreshFx === bypassCache=true', async () => {
      const t0 = new Date('2026-04-28T00:00:00.000Z').getTime();
      await seedCache({ CAD: 999, KRW: 1 }, t0);

      jest.setSystemTime(new Date(t0 + 60 * 60 * 1000));
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          body: buildPrimaryBody({ KRW: 1380, USD: 1, CAD: 1.36 }),
        },
      ]);

      const rates = await refreshFx();
      expect(rates.CAD).toBeCloseTo(1380 / 1.36, 5);
    });
  });

  describe('손상된 캐시 자동 정리', () => {
    it('잘못된 JSON → 자동 삭제 + miss 처리', async () => {
      await AsyncStorage.setItem(FX_KEY, '{not valid json');
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          body: buildPrimaryBody({ KRW: 1380, USD: 1 }),
        },
      ]);

      const rates = await fetchExchangeRates();
      expect(rates.USD).toBeCloseTo(1380, 5);

      // 이후 새 캐시가 저장되어 있어야 함 (corrupted 가 갱신됨)
      const after = await AsyncStorage.getItem(FX_KEY);
      expect(after).not.toBeNull();
      expect(() => JSON.parse(after!)).not.toThrow();
    });

    it('shape 위반 (rates 누락) → 자동 삭제', async () => {
      await AsyncStorage.setItem(FX_KEY, JSON.stringify({ fetchedAt: 1, foo: 'bar' }));
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          body: buildPrimaryBody({ KRW: 1380, USD: 1 }),
        },
      ]);

      const rates = await fetchExchangeRates();
      expect(rates.USD).toBeCloseTo(1380, 5);
    });

    it('shape 위반 (fetchedAt 비-number) → 자동 삭제', async () => {
      await AsyncStorage.setItem(
        FX_KEY,
        JSON.stringify({ fetchedAt: 'abc', rates: { KRW: 1, USD: 1380 } }),
      );
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          body: buildPrimaryBody({ KRW: 1380, USD: 1 }),
        },
      ]);

      const rates = await fetchExchangeRates();
      expect(rates.USD).toBeCloseTo(1380, 5);
    });

    it('shape 위반 (rates 안에 음수 환율) → 자동 삭제', async () => {
      await AsyncStorage.setItem(
        FX_KEY,
        JSON.stringify({ fetchedAt: 1, rates: { KRW: 1, CAD: -100 } }),
      );
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          body: buildPrimaryBody({ KRW: 1380, USD: 1 }),
        },
      ]);

      await fetchExchangeRates();
      // ok — 손상된 캐시 무시
    });

    it('shape 위반 (rates 가 빈 객체) → 자동 삭제', async () => {
      await AsyncStorage.setItem(FX_KEY, JSON.stringify({ fetchedAt: 1, rates: {} }));
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          body: buildPrimaryBody({ KRW: 1380, USD: 1 }),
        },
      ]);
      const rates = await fetchExchangeRates();
      expect(rates.USD).toBeCloseTo(1380, 5);
    });

    it('cache 가 JSON-parseable 한 primitive (숫자) → 자동 삭제', async () => {
      await AsyncStorage.setItem(FX_KEY, '42');
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          body: buildPrimaryBody({ KRW: 1380, USD: 1 }),
        },
      ]);
      const rates = await fetchExchangeRates();
      expect(rates.USD).toBeCloseTo(1380, 5);
    });

    it('AsyncStorage.getItem 자체가 throw → null 처리', async () => {
      jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('storage unavailable'));
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          body: buildPrimaryBody({ KRW: 1380, USD: 1 }),
        },
      ]);

      const rates = await fetchExchangeRates();
      expect(rates.USD).toBeCloseTo(1380, 5);
    });
  });

  describe('Primary fetch 실패 — fallback chain', () => {
    it('HTTP 404 + 캐시 없음 → baseline', async () => {
      mockFetchSequence([{ ok: false, status: 404 }]);
      const rates = await fetchExchangeRates();
      expect(rates).toEqual(FX_BASELINE_2026Q2);
      // baseline 은 사본이므로 ref equality X
      expect(rates).not.toBe(FX_BASELINE_2026Q2);
    });

    it('HTTP 500 + 캐시 없음 → baseline', async () => {
      mockFetchSequence([{ ok: false, status: 500 }]);
      const rates = await fetchExchangeRates();
      expect(rates.USD).toBe(FX_BASELINE_2026Q2.USD);
    });

    it('네트워크 실패 (TypeError) + 캐시 없음 → baseline', async () => {
      mockFetchSequence([{ error: 'network' }]);
      const rates = await fetchExchangeRates();
      expect(rates.CAD).toBe(FX_BASELINE_2026Q2.CAD);
    });

    it('Timeout (AbortError) + 캐시 없음 → baseline', async () => {
      mockFetchSequence([{ error: 'timeout' }]);
      const rates = await fetchExchangeRates();
      expect(rates.JPY).toBe(FX_BASELINE_2026Q2.JPY);
    });

    it('빈 body + 캐시 없음 → baseline', async () => {
      mockFetchSequence([{ ok: true, status: 200, body: '' }]);
      const rates = await fetchExchangeRates();
      expect(rates).toEqual(FX_BASELINE_2026Q2);
    });

    it('non-JSON 응답 + 캐시 없음 → baseline', async () => {
      mockFetchSequence([{ ok: true, status: 200, body: '<html>not json</html>' }]);
      const rates = await fetchExchangeRates();
      expect(rates).toEqual(FX_BASELINE_2026Q2);
    });

    it("response.result !== 'success' → baseline", async () => {
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          body: { result: 'error', rates: { KRW: 1380, USD: 1 } },
        },
      ]);
      const rates = await fetchExchangeRates();
      expect(rates).toEqual(FX_BASELINE_2026Q2);
    });

    it('rates 누락 → baseline', async () => {
      mockFetchSequence([{ ok: true, status: 200, body: { result: 'success' } }]);
      const rates = await fetchExchangeRates();
      expect(rates).toEqual(FX_BASELINE_2026Q2);
    });

    it('rates.KRW 누락 → baseline', async () => {
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          body: { result: 'success', rates: { USD: 1, CAD: 1.36 } },
        },
      ]);
      const rates = await fetchExchangeRates();
      expect(rates).toEqual(FX_BASELINE_2026Q2);
    });

    it('rates.KRW 가 0 → baseline', async () => {
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          body: { result: 'success', rates: { KRW: 0, USD: 1 } },
        },
      ]);
      const rates = await fetchExchangeRates();
      expect(rates).toEqual(FX_BASELINE_2026Q2);
    });

    it('응답에 KRW 외 유효 통화 0개 → baseline', async () => {
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          body: { result: 'success', rates: { KRW: 1380 } },
        },
      ]);
      const rates = await fetchExchangeRates();
      expect(rates).toEqual(FX_BASELINE_2026Q2);
    });

    it('응답이 배열 (not object) → baseline', async () => {
      mockFetchSequence([{ ok: true, status: 200, body: '[1,2,3]' }]);
      const rates = await fetchExchangeRates();
      expect(rates).toEqual(FX_BASELINE_2026Q2);
    });

    it('rates 가 배열 → baseline', async () => {
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          body: { result: 'success', rates: [1, 2, 3] },
        },
      ]);
      const rates = await fetchExchangeRates();
      expect(rates).toEqual(FX_BASELINE_2026Q2);
    });

    it('실패 fallback 시 baseline 은 사본 — 호출자가 mutate 해도 다음 호출에 영향 없음', async () => {
      mockFetchSequence([{ error: 'network' }]);
      const r1 = await fetchExchangeRates();
      r1.USD = 9999;

      mockFetchSequence([{ error: 'network' }]);
      const r2 = await fetchExchangeRates();
      expect(r2.USD).toBe(FX_BASELINE_2026Q2.USD);
    });

    it('실패 fallback 시 캐시 / lastSync 갱신 안 됨', async () => {
      mockFetchSequence([{ ok: false, status: 500 }]);
      await fetchExchangeRates();

      const cached = await AsyncStorage.getItem(FX_KEY);
      const lastSync = await AsyncStorage.getItem(META_KEY);
      expect(cached).toBeNull();
      expect(lastSync).toBeNull();
    });
  });

  describe('Stale 캐시 + fetch 실패', () => {
    it('만료 캐시 + 네트워크 실패 → stale 캐시 반환', async () => {
      const t0 = new Date('2026-04-01T00:00:00.000Z').getTime();
      const staleRates = { CAD: 999, KRW: 1 };
      await AsyncStorage.setItem(
        FX_KEY,
        JSON.stringify({ rates: staleRates, fetchedAt: t0 }),
      );
      await AsyncStorage.setItem(META_KEY, new Date(t0).toISOString());

      // 27일 후 (stale)
      jest.setSystemTime(new Date('2026-04-28T00:00:00.000Z'));
      mockFetchSequence([{ ok: false, status: 500 }]);

      const rates = await fetchExchangeRates();
      expect(rates).toEqual(staleRates);

      // lastSync 는 갱신되지 않아 호출자가 staleness 감지 가능
      const lastSync = await AsyncStorage.getItem(META_KEY);
      expect(lastSync).toBe(new Date(t0).toISOString());
    });

    it('bypassCache=true + fetch 실패 + 캐시 존재 → 캐시 반환', async () => {
      const t0 = new Date('2026-04-28T00:00:00.000Z').getTime();
      await AsyncStorage.setItem(
        FX_KEY,
        JSON.stringify({ rates: { CAD: 1000, KRW: 1 }, fetchedAt: t0 }),
      );

      jest.setSystemTime(new Date(t0 + 60_000));
      mockFetchSequence([{ error: 'network' }]);

      const rates = await fetchExchangeRates({ bypassCache: true });
      expect(rates.CAD).toBe(1000);
    });
  });

  describe('In-flight dedup', () => {
    it('동일 시점 2회 호출 → 동일 Promise 반환 (ref equality)', async () => {
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          body: buildPrimaryBody({ KRW: 1380, USD: 1, CAD: 1.36 }),
        },
      ]);
      const p1 = fetchExchangeRates();
      const p2 = fetchExchangeRates();
      // 동기 시점에 inflight 변수가 같은 ref 반환 — dedup 의 1차 증거
      expect(p1).toBe(p2);
      const [r1, r2] = await Promise.all([p1, p2]);
      // 같은 Promise 가 resolve 한 결과는 같은 객체
      expect(r1).toBe(r2);
      expect(r1.USD).toBeCloseTo(1380, 5);
    });

    it('동일 시점 2회 호출 → fetch 는 1회만', async () => {
      const fetchSpy = mockFetchSequence([
        {
          ok: true,
          status: 200,
          body: buildPrimaryBody({ KRW: 1380, USD: 1 }),
        },
      ]);
      await Promise.all([fetchExchangeRates(), fetchExchangeRates()]);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('첫 호출 완료 후 inflight 가 해제 — 두 번째 호출은 cache hit', async () => {
      const fetchSpy = mockFetchSequence([
        {
          ok: true,
          status: 200,
          body: buildPrimaryBody({ KRW: 1380, USD: 1 }),
        },
      ]);
      await fetchExchangeRates();
      // inflight 가 해제됐고 캐시가 신선 → 두 번째는 캐시 hit (fetch 0회 추가)
      const r2 = await fetchExchangeRates();
      expect(r2.USD).toBeCloseTo(1380, 5);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Reject 시 inflight cleanup', () => {
    it('실패 응답 후 다음 호출이 baseline 을 정상 반환 (inflight 누수 없음)', async () => {
      mockFetchSequence([{ error: 'network' }]);
      await fetchExchangeRates();

      // baseline 은 캐시 저장 안 함 → 다음 호출도 다시 fetch 시도
      mockFetchSequence([{ error: 'network' }]);
      const r2 = await fetchExchangeRates();
      expect(r2).toEqual(FX_BASELINE_2026Q2);
    });
  });

  describe('실제 timer 발화 (AbortController)', () => {
    it('TIMEOUT_MS 경과 시 setTimeout 콜백이 abort → FxTimeoutError → baseline', async () => {
      jest.spyOn(globalThis, 'fetch').mockImplementationOnce(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = (init as RequestInit | undefined)?.signal;
            signal?.addEventListener('abort', () => {
              const err = new Error('aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }),
      );

      const promise = fetchExchangeRates();
      // TIMEOUT_MS = 10s. 가짜 시간을 그만큼 앞당겨 setTimeout 콜백 발화.
      await jest.advanceTimersByTimeAsync(10_001);

      const result = await promise;
      expect(result).toEqual(FX_BASELINE_2026Q2);
    });
  });

  describe('Response.text() 실패', () => {
    it('text() 가 throw → FxParseError → baseline', async () => {
      jest.spyOn(globalThis, 'fetch').mockImplementationOnce(
        async () =>
          ({
            ok: true,
            status: 200,
            text: async () => {
              throw new Error('cannot read body');
            },
            json: async () => ({}),
          }) as unknown as Response,
      );

      const result = await fetchExchangeRates();
      expect(result).toEqual(FX_BASELINE_2026Q2);
    });
  });

  describe('AsyncStorage.removeItem 실패 (catch arrow 커버리지)', () => {
    it('removeItem 이 reject 해도 fetch 흐름은 영향 없음', async () => {
      // 손상된 캐시 → loadCachedEntry 가 removeItem 호출 → reject
      await AsyncStorage.setItem(FX_KEY, 'corrupt');
      jest.spyOn(AsyncStorage, 'removeItem').mockRejectedValue(new Error('storage write fail'));
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          body: buildPrimaryBody({ KRW: 1380, USD: 1 }),
        },
      ]);

      const rates = await fetchExchangeRates();
      expect(rates.USD).toBeCloseTo(1380, 5);
    });
  });
});
