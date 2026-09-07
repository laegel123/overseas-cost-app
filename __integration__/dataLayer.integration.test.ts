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

// v1.0 = 서울 + 해외 20 도시. 시드도 동일 전량 (ADR-074).
const V1_CITY_COUNT = 21;

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

  it('시드 fallback 으로 21개 도시 로드 → 밴쿠버 oneBed 가 KRW 로 변환됨', async () => {
    const cities = await loadAllCities({ bypassCache: true });
    // ADR-074: 시드가 실데이터 전량이라 오프라인에서도 21개가 그대로 살아난다.
    expect(Object.keys(cities)).toHaveLength(V1_CITY_COUNT);
    expect(cities.seoul).toBeDefined();
    expect(cities.vancouver).toBeDefined();

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

  it('refreshCache: 네트워크 전멸 → ok=false + 기존 도시 맵 보존 (ADR-074)', async () => {
    // 먼저 시드로 21개를 메모리에 올린다 (= 사용자가 앱을 쓰고 있던 상태).
    await loadAllCities({ bypassCache: true });
    expect(Object.keys(getAllCities())).toHaveLength(V1_CITY_COUNT);

    const result = await refreshCache();

    // 구버전은 여기서 시드로 덮어쓰고 ok=true 를 반환해 실패를 감췄다.
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.length).toBeGreaterThan(0);
    }
    // 핵심: 실패해도 도시가 사라지지 않는다.
    expect(Object.keys(getAllCities())).toHaveLength(V1_CITY_COUNT);
  });

  it('refreshCache 실패는 캐시를 지우지 않는다 (ADR-074)', async () => {
    // 정상 캐시가 있는 상태에서 새로고침이 실패해도 캐시가 남아야
    // 다음 콜드스타트가 21개를 복원한다.
    await loadAllCities({ bypassCache: true });
    const entry = JSON.stringify({
      data: { schemaVersion: 1, generatedAt: '2026-04-29T00:00:00.000Z', fxBaseDate: '2026-04-29', cities: getAllCities() },
      fetchedAt: Date.now(),
    });
    await AsyncStorage.setItem('data:all:v1', entry);

    const result = await refreshCache();
    expect(result.ok).toBe(false);

    await expect(AsyncStorage.getItem('data:all:v1')).resolves.toBe(entry);
  });

  it('전체 도시 맵: getAllCities 가 메모리 즉시 반환', async () => {
    expect(getAllCities()).toEqual({});
    await loadAllCities({ bypassCache: true });
    expect(Object.keys(getAllCities())).toHaveLength(V1_CITY_COUNT);
  });
});
