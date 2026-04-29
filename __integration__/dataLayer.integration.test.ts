/**
 * 통합 smoke — data-layer phase step 4.
 *
 * 시드 fallback 경로 + 환율 변환 round-trip 을 모듈 경계 너머 검증.
 * 실 네트워크 의존 없음 (TESTING §1 결정성).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  __resetInflightForTesting as __resetFx,
  convertToKRW,
  fetchExchangeRates,
} from '@/lib/currency';
import {
  __resetForTesting as __resetData,
  getAllCities,
  getCity,
  loadAllCities,
  refreshCache,
} from '@/lib/data';

describe('data-layer integration (시드 + 환율 → KRW 변환)', () => {
  beforeEach(async () => {
    __resetData();
    __resetFx();
    await AsyncStorage.clear();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-29T00:00:00.000Z'));
    // primary, backup 모두 실패 → 시드 fallback / FX baseline 강제
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('Network request failed'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    __resetData();
    __resetFx();
  });

  it('시드 fallback 으로 서울 + 밴쿠버 로드 → 밴쿠버 oneBed 가 KRW 로 변환됨', async () => {
    const cities = await loadAllCities({ bypassCache: true });
    expect(Object.keys(cities).sort()).toEqual(['seoul', 'vancouver']);

    const vancouver = getCity('vancouver');
    expect(vancouver).toBeDefined();
    expect(vancouver?.currency).toBe('CAD');

    // 환율 fetch 실패 → hardcoded baseline (FX_BASELINE_2026Q2) 사용
    const rates = await fetchExchangeRates({ bypassCache: true });
    const cadRate = rates.CAD;
    expect(typeof cadRate).toBe('number');
    expect(cadRate).toBeGreaterThan(500); // sanity (BoK 분기 환율 ~1000원대)

    const oneBedCad = vancouver?.rent.oneBed;
    expect(typeof oneBedCad).toBe('number');
    if (typeof oneBedCad === 'number') {
      const oneBedKrw = convertToKRW(oneBedCad, 'CAD', rates);
      expect(oneBedKrw).toBeGreaterThan(0);
      expect(Number.isInteger(oneBedKrw)).toBe(true);
    }
  });

  it('서울 KRW 패스스루 (환율 무관)', async () => {
    await loadAllCities({ bypassCache: true });
    const seoul = getCity('seoul');
    expect(seoul).toBeDefined();
    expect(seoul?.currency).toBe('KRW');
    if (typeof seoul?.rent.oneBed === 'number') {
      const krw = convertToKRW(seoul.rent.oneBed, 'KRW', {});
      expect(krw).toBe(seoul.rent.oneBed);
    }
  });

  it('refreshCache: 캐시 갱신 + lastSync 반환', async () => {
    const result = await refreshCache();
    // 시드 fallback + FX baseline → 둘 다 가용 → ok=true
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lastSync.length).toBeGreaterThan(0);
    }
  });

  it('전체 도시 맵: getAllCities 가 메모리 즉시 반환', async () => {
    expect(getAllCities()).toEqual({});
    await loadAllCities({ bypassCache: true });
    expect(Object.keys(getAllCities()).sort()).toEqual(['seoul', 'vancouver']);
  });
});
