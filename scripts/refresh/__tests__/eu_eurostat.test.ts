/**
 * eu_eurostat.mjs 테스트.
 * TESTING.md §9-A.8 인벤토리.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import refreshEuEurostat, {
  checkEurostatStatus,
  parseEurostatResponse,
  EU_COUNTRIES,
  EU_CITIES,
  EUROSTAT_DATASETS,
  SOURCE,
} from '../eu_eurostat.mjs';

describe('parseEurostatResponse', () => {
  it('정상 JSON-stat 응답 파싱', () => {
    const data = {
      value: { '0': 100.5, '1': 105.2, '2': 98.7 },
      dimension: {
        geo: {
          category: {
            index: { DE: 0, FR: 1, NL: 2 },
            label: { DE: 'Germany', FR: 'France', NL: 'Netherlands' },
          },
        },
      },
    };

    const result = parseEurostatResponse(data);

    expect(result.get('DE')).toBe(100.5);
    expect(result.get('FR')).toBe(105.2);
    expect(result.get('NL')).toBe(98.7);
  });

  it('빈 value: 빈 Map 반환', () => {
    const data = {
      value: {},
      dimension: { geo: { category: { index: {}, label: {} } } },
    };
    const result = parseEurostatResponse(data);
    expect(result.size).toBe(0);
  });

  it('null/undefined: 빈 Map 반환', () => {
    expect(parseEurostatResponse(null).size).toBe(0);
    expect(parseEurostatResponse(undefined).size).toBe(0);
  });

  it('유효하지 않은 구조: 빈 Map 반환', () => {
    expect(parseEurostatResponse({}).size).toBe(0);
    expect(parseEurostatResponse({ value: null }).size).toBe(0);
  });
});

describe('constants', () => {
  it('EU_COUNTRIES: DE/FR/NL 포함', () => {
    expect(EU_COUNTRIES).toContain('DE');
    expect(EU_COUNTRIES).toContain('FR');
    expect(EU_COUNTRIES).toContain('NL');
    expect(EU_COUNTRIES).toHaveLength(3);
  });

  it('EU_CITIES: 국가별 도시 매핑', () => {
    expect(EU_CITIES.DE).toContain('berlin');
    expect(EU_CITIES.DE).toContain('munich');
    expect(EU_CITIES.FR).toContain('paris');
    expect(EU_CITIES.NL).toContain('amsterdam');
  });

  it('EUROSTAT_DATASETS: HICP + HPI 정의', () => {
    expect(EUROSTAT_DATASETS.hicp).toBeDefined();
    expect(EUROSTAT_DATASETS.rent).toBeDefined();
  });

  it('SOURCE: Eurostat 명시', () => {
    expect(SOURCE.category).toBe('fallback');
    expect(SOURCE.name).toContain('Eurostat');
    expect(SOURCE.url).toContain('ec.europa.eu');
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
    jest.restoreAllMocks();
  });

  it('반환 객체 구조: RefreshResult', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        value: { '0': 100.0, '1': 102.0, '2': 98.0 },
        dimension: {
          geo: {
            category: {
              index: { DE: 0, FR: 1, NL: 2 },
              label: { DE: 'Germany', FR: 'France', NL: 'Netherlands' },
            },
          },
        },
      }),
    });

    const result = await refreshEuEurostat({});

    expect(result).toHaveProperty('source');
    expect(result).toHaveProperty('cities');
    expect(result).toHaveProperty('fields');
    expect(result).toHaveProperty('changes');
    expect(result).toHaveProperty('errors');
    expect(result.source).toBe('eu_eurostat');
    expect(Array.isArray(result.cities)).toBe(true);
  }, 30000);

  it('Eurostat 불가 시 errors에 추가', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await refreshEuEurostat({});

    expect(result.errors.some((e: any) => e.reason.includes('unavailable'))).toBe(true);
    expect(result.cities).toHaveLength(0);
    expect(result.changes).toHaveLength(0);
  }, 30000);

  it('정상 응답 시 EU 도시들 포함', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        value: { '0': 100.0, '1': 102.0, '2': 98.0 },
        dimension: {
          geo: {
            category: {
              index: { DE: 0, FR: 1, NL: 2 },
              label: { DE: 'Germany', FR: 'France', NL: 'Netherlands' },
            },
          },
        },
      }),
    });

    const result = await refreshEuEurostat({});

    expect(result.cities).toContain('berlin');
    expect(result.cities).toContain('munich');
    expect(result.cities).toContain('paris');
    expect(result.cities).toContain('amsterdam');
  }, 30000);

  it('일부 국가 데이터 부재 시 해당 국가만 errors에 추가', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        value: { '0': 100.0 },
        dimension: {
          geo: {
            category: {
              index: { DE: 0 },
              label: { DE: 'Germany' },
            },
          },
        },
      }),
    });

    const result = await refreshEuEurostat({});

    expect(result.cities).toContain('berlin');
    expect(result.errors.some((e: any) => e.cityId === 'FR')).toBe(true);
    expect(result.errors.some((e: any) => e.cityId === 'NL')).toBe(true);
  }, 30000);
});
