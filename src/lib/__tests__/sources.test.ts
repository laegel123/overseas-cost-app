/**
 * docs/TESTING.md §9.37 — src/lib/sources.ts (출처 집계, ADR-071).
 *
 * `data.ts` 의 메모리 맵은 mock 한다 — 이 모듈의 책임은 fetch 가 아니라
 * 정렬·중복 제거·카테고리 그룹핑이다. 실데이터 카운트를 단언하지 않는 이유는
 * cron 이 도시 JSON 을 갱신하면 곧바로 drift 나는 테스트가 되기 때문 (ADR-071
 * 결정 2 가 걷어낸 바로 그 패턴).
 */

import { seoulValid } from '@/__fixtures__/cities/seoul-valid';
import { vancouverValid } from '@/__fixtures__/cities/vancouver-valid';
import type { CitiesMap, CityCostData, CitySource, Region } from '@/types/city';

import { getAllCities, getCity } from '../data';
import { CityNotFoundError } from '../errors';
import {
  countUniqueSources,
  getCitySourceGroups,
  getCitySourcesByCategory,
} from '../sources';

jest.mock('../data', () => ({
  getAllCities: jest.fn(),
  getCity: jest.fn(),
}));

const mockGetAllCities = getAllCities as jest.Mock;
const mockGetCity = getCity as jest.Mock;

function makeCity(
  id: string,
  nameKo: string,
  region: Region,
  sources: CitySource[] = vancouverValid.sources,
): CityCostData {
  return { ...vancouverValid, id, name: { ko: nameKo, en: id }, region, sources };
}

/** 인자 순서대로 삽입한 맵 — Object.values 순서 = 인자 순서. */
function mapOf(...cities: CityCostData[]): CitiesMap {
  return Object.fromEntries(cities.map((c) => [c.id, c]));
}

const seoul = makeCity('seoul', '서울', 'asia', seoulValid.sources);
const newyork = makeCity('newyork', '뉴욕', 'na');
const vancouver = makeCity('vancouver', '밴쿠버', 'na');
const london = makeCity('london', '런던', 'eu');
const tokyo = makeCity('tokyo', '도쿄', 'asia');
const sydney = makeCity('sydney', '시드니', 'oceania');
const dubai = makeCity('dubai', '두바이', 'me');

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAllCities.mockReturnValue({});
  mockGetCity.mockReturnValue(undefined);
});

// ─── getCitySourceGroups ────────────────────────────────────────────────────

describe('getCitySourceGroups', () => {
  it('서울이 항상 첫 번째 — 맵에 마지막으로 들어와도 고정', () => {
    mockGetAllCities.mockReturnValue(mapOf(dubai, tokyo, newyork, seoul));
    expect(getCitySourceGroups().map((g) => g.cityId)[0]).toBe('seoul');
  });

  it('서울이 맵의 첫 항목이어도 첫 번째', () => {
    mockGetAllCities.mockReturnValue(mapOf(seoul, dubai, tokyo, newyork));
    expect(getCitySourceGroups().map((g) => g.cityId)[0]).toBe('seoul');
  });

  it('권역 순서 na → eu → asia → oceania → me (서울 제외)', () => {
    mockGetAllCities.mockReturnValue(mapOf(dubai, sydney, tokyo, london, vancouver));
    expect(getCitySourceGroups().map((g) => g.cityId)).toEqual([
      'vancouver',
      'london',
      'tokyo',
      'sydney',
      'dubai',
    ]);
  });

  it('같은 권역 안에서는 name.ko 가나다순 (뉴욕 < 밴쿠버)', () => {
    mockGetAllCities.mockReturnValue(mapOf(vancouver, newyork));
    expect(getCitySourceGroups().map((g) => g.cityNameKo)).toEqual(['뉴욕', '밴쿠버']);
  });

  it('서울 고정 + 권역 + 가나다 전체 정렬', () => {
    mockGetAllCities.mockReturnValue(
      mapOf(dubai, sydney, tokyo, london, vancouver, newyork, seoul),
    );
    expect(getCitySourceGroups().map((g) => g.cityId)).toEqual([
      'seoul',
      'newyork',
      'vancouver',
      'london',
      'tokyo',
      'sydney',
      'dubai',
    ]);
  });

  it('count 는 해당 도시의 sources 길이 (서울 4 / 밴쿠버 6)', () => {
    mockGetAllCities.mockReturnValue(mapOf(seoul, vancouver));
    expect(getCitySourceGroups()).toEqual([
      { cityId: 'seoul', cityNameKo: '서울', count: 4 },
      { cityId: 'vancouver', cityNameKo: '밴쿠버', count: 6 },
    ]);
  });

  it('출처 0개 도시는 제외', () => {
    const empty = makeCity('nosource', '무출처', 'na', []);
    mockGetAllCities.mockReturnValue(mapOf(vancouver, empty));
    expect(getCitySourceGroups().map((g) => g.cityId)).toEqual(['vancouver']);
  });

  it('데이터 미로드 (빈 맵) → 빈 배열 (에러 아님)', () => {
    expect(getCitySourceGroups()).toEqual([]);
  });
});

// ─── countUniqueSources ─────────────────────────────────────────────────────

describe('countUniqueSources', () => {
  const src = (name: string, url: string): CitySource => ({
    category: 'rent',
    name,
    url,
    accessedAt: '2026-04-01',
  });

  it('서로 다른 도시가 같은 (name, url) 을 쓰면 1개로 센다', () => {
    const shared = src('HUD Fair Market Rents', 'https://huduser.gov/fmr');
    mockGetAllCities.mockReturnValue(
      mapOf(
        makeCity('a', '에이', 'na', [shared]),
        makeCity('b', '비', 'na', [{ ...shared }]),
        makeCity('c', '씨', 'na', [{ ...shared }]),
      ),
    );
    expect(countUniqueSources()).toBe(1);
  });

  it('이름이 같고 url 이 다르면 2개로 센다', () => {
    mockGetAllCities.mockReturnValue(
      mapOf(
        makeCity('a', '에이', 'na', [src('같은 기관', 'https://a.example/')]),
        makeCity('b', '비', 'na', [src('같은 기관', 'https://b.example/')]),
      ),
    );
    expect(countUniqueSources()).toBe(2);
  });

  it('url 이 같고 이름이 다르면 2개로 센다 — url 단독 키가 아니다', () => {
    mockGetAllCities.mockReturnValue(
      mapOf(
        makeCity('a', '에이', 'na', [
          src('기관 A', 'https://portal.gov/'),
          src('기관 B', 'https://portal.gov/'),
        ]),
      ),
    );
    expect(countUniqueSources()).toBe(2);
  });

  it('중복이 없으면 전체 엔트리 수와 같다 (서울 4 + 밴쿠버 6 = 10)', () => {
    mockGetAllCities.mockReturnValue(mapOf(seoul, vancouver));
    expect(countUniqueSources()).toBe(10);
  });

  it('데이터 미로드 (빈 맵) → 0 (에러 아님)', () => {
    expect(countUniqueSources()).toBe(0);
  });
});

// ─── getCitySourcesByCategory ───────────────────────────────────────────────

describe('getCitySourcesByCategory', () => {
  it('CATEGORY_ORDER 순서로 그룹이 나온다 (rent → food → transport → tuition → tax → visa)', () => {
    // 밴쿠버 fixture 의 sources 는 rent/food/transport/tuition/tax/visa 각 1개.
    mockGetCity.mockReturnValue(vancouverValid);
    expect(getCitySourcesByCategory('vancouver').map((g) => g.category)).toEqual([
      'rent',
      'food',
      'transport',
      'tuition',
      'tax',
      'visa',
    ]);
  });

  it('원본 sources[] 순서와 무관하게 CATEGORY_ORDER 를 따른다', () => {
    mockGetCity.mockReturnValue({
      ...vancouverValid,
      sources: [...vancouverValid.sources].reverse(),
    });
    expect(getCitySourcesByCategory('vancouver').map((g) => g.category)).toEqual([
      'rent',
      'food',
      'transport',
      'tuition',
      'tax',
      'visa',
    ]);
  });

  it('출처 0개 카테고리 (서울 tax/tuition/visa) 는 그룹 자체가 없다', () => {
    mockGetCity.mockReturnValue(seoulValid);
    expect(getCitySourcesByCategory('seoul').map((g) => g.category)).toEqual([
      'rent',
      'food',
      'transport',
    ]);
  });

  it('한 카테고리에 출처가 2개면 (서울 food) 둘 다 원본 순서로 들어간다', () => {
    mockGetCity.mockReturnValue(seoulValid);
    const food = getCitySourcesByCategory('seoul').find((g) => g.category === 'food');
    expect(food?.sources.map((s) => s.name)).toEqual([
      '한국소비자원 참가격',
      '통계청 KOSIS 소비자물가지수',
    ]);
  });

  it('출처는 가공하지 않고 원본 CitySource 를 그대로 넘긴다', () => {
    mockGetCity.mockReturnValue(seoulValid);
    const rent = getCitySourcesByCategory('seoul')[0];
    expect(rent?.sources[0]).toEqual(seoulValid.sources[0]);
  });

  it('존재하지 않는 cityId → CityNotFoundError throw (빈 배열 아님)', () => {
    mockGetCity.mockReturnValue(undefined);
    expect(() => getCitySourcesByCategory('atlantis')).toThrow(CityNotFoundError);
    try {
      getCitySourcesByCategory('atlantis');
    } catch (e) {
      expect((e as CityNotFoundError).code).toBe('CITY_NOT_FOUND');
    }
  });

  it('출처가 0개인 도시는 빈 배열 — 미존재와 구분된다', () => {
    mockGetCity.mockReturnValue({ ...seoulValid, sources: [] });
    expect(getCitySourcesByCategory('seoul')).toEqual([]);
  });
});
