/**
 * _registry.mjs 테스트.
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  SOURCE_TO_CITIES,
  CITY_TO_SOURCES,
  ALL_CITIES,
  getCitiesForSource,
  getSourcesForCity,
} from '../_registry.mjs';

describe('SOURCE_TO_CITIES', () => {
  it('한국 출처 매핑', () => {
    expect(SOURCE_TO_CITIES.kr_molit).toEqual(['seoul']);
    expect(SOURCE_TO_CITIES.kr_kca).toEqual(['seoul']);
    expect(SOURCE_TO_CITIES.kr_kosis).toEqual(['seoul']);
    expect(SOURCE_TO_CITIES.kr_seoul_metro).toEqual(['seoul']);
  });

  it('캐나다 출처 매핑', () => {
    expect(SOURCE_TO_CITIES.ca_cmhc).toContain('vancouver');
    expect(SOURCE_TO_CITIES.ca_cmhc).toContain('toronto');
    expect(SOURCE_TO_CITIES.ca_cmhc).toContain('montreal');
  });

  it('미국 출처 매핑', () => {
    expect(SOURCE_TO_CITIES.us_hud).toContain('nyc');
    expect(SOURCE_TO_CITIES.us_hud).toContain('la');
    expect(SOURCE_TO_CITIES.us_hud).toContain('sf');
    expect(SOURCE_TO_CITIES.us_hud).toContain('seattle');
    expect(SOURCE_TO_CITIES.us_hud).toContain('boston');
  });

  it('대학 출처는 모든 해외 도시 포함', () => {
    expect(SOURCE_TO_CITIES.universities!.length).toBeGreaterThanOrEqual(20);
    expect(SOURCE_TO_CITIES.universities!).not.toContain('seoul');
  });

  it('비자 출처는 모든 해외 도시 포함', () => {
    expect(SOURCE_TO_CITIES.visas!.length).toBeGreaterThanOrEqual(20);
    expect(SOURCE_TO_CITIES.visas!).not.toContain('seoul');
  });
});

describe('CITY_TO_SOURCES', () => {
  it('서울은 한국 출처 4개', () => {
    expect(CITY_TO_SOURCES.seoul).toContain('kr_molit');
    expect(CITY_TO_SOURCES.seoul).toContain('kr_kca');
    expect(CITY_TO_SOURCES.seoul).toContain('kr_kosis');
    expect(CITY_TO_SOURCES.seoul).toContain('kr_seoul_metro');
  });

  it('밴쿠버는 캐나다 + 공통 출처', () => {
    expect(CITY_TO_SOURCES.vancouver).toContain('ca_cmhc');
    expect(CITY_TO_SOURCES.vancouver).toContain('ca_statcan');
    expect(CITY_TO_SOURCES.vancouver).toContain('ca_translink');
    expect(CITY_TO_SOURCES.vancouver).toContain('universities');
    expect(CITY_TO_SOURCES.vancouver).toContain('visas');
  });

  it('모든 도시가 최소 1개 출처 보유', () => {
    for (const city of ALL_CITIES) {
      expect(CITY_TO_SOURCES[city]).toBeDefined();
      expect(CITY_TO_SOURCES[city]!.length).toBeGreaterThan(0);
    }
  });
});

describe('ALL_CITIES', () => {
  it('21개 도시 (서울 + 20)', () => {
    expect(ALL_CITIES).toHaveLength(22);
  });

  it('서울 포함', () => {
    expect(ALL_CITIES).toContain('seoul');
  });

  it('중복 없음', () => {
    const unique = new Set(ALL_CITIES);
    expect(unique.size).toBe(ALL_CITIES.length);
  });

  it('v1.0 출시 도시 전체 포함', () => {
    const expected = [
      'seoul',
      'vancouver',
      'toronto',
      'montreal',
      'nyc',
      'la',
      'sf',
      'seattle',
      'boston',
      'london',
      'manchester',
      'berlin',
      'munich',
      'paris',
      'amsterdam',
      'sydney',
      'melbourne',
      'tokyo',
      'osaka',
      'singapore',
      'hochiminh',
      'dubai',
    ];
    for (const city of expected) {
      expect(ALL_CITIES).toContain(city);
    }
  });
});

describe('getCitiesForSource', () => {
  it('알려진 출처: 도시 배열 반환', () => {
    expect(getCitiesForSource('kr_molit')).toEqual(['seoul']);
  });

  it('알 수 없는 출처: 빈 배열', () => {
    expect(getCitiesForSource('unknown_source')).toEqual([]);
  });
});

describe('getSourcesForCity', () => {
  it('알려진 도시: 출처 배열 반환', () => {
    const sources = getSourcesForCity('seoul');
    expect(sources).toContain('kr_molit');
  });

  it('알 수 없는 도시: 빈 배열', () => {
    expect(getSourcesForCity('unknown_city')).toEqual([]);
  });
});
