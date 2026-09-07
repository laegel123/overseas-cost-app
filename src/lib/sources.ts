/**
 * 출처 집계 — `/sources`, `/sources/[cityId]` 화면용 (ADR-071).
 *
 * 화면은 계산하지 않는다. 도시 맵(`data.ts` 메모리)에서 표시 순서·카운트·
 * 카테고리 그룹을 만드는 책임이 전부 여기 있고, 화면은 결과를 그리기만 한다.
 * 출처 자체는 가공하지 않고 원본 `CitySource` 를 그대로 넘긴다 (이름 축약·
 * 도메인 추출 등 표시 형식은 화면 책임).
 *
 * 카운트는 **런타임 실측**이다 (ADR-071 결정 2). 번들 시드만 있는 첫 실행에서
 * 값이 작게 나오는 것은 "지금 앱이 가진 데이터" 를 정확히 반영한 의도된 동작.
 */

import type { CityCostData, CitySource, Region, SourceCategory } from '@/types/city';

import { CATEGORY_ORDER } from './categoryMeta';
import { getAllCities, getCity } from './data';
import { CityNotFoundError } from './errors';

/** 서울 = 비교 기준 도시. 출처 목록에서도 항상 맨 위에 고정된다. */
const SEOUL_ID = 'seoul';

/**
 * 권역 표시 순서 — 홈 화면 `REGIONS` (`app/(tabs)/index.tsx`) 의 순서와 동일.
 * 출처 목록에는 권역 그룹 헤더가 없고 정렬 순서만 권역을 따른다.
 */
const REGION_ORDER: readonly Region[] = ['na', 'eu', 'asia', 'oceania', 'me'];

/** 한 도시의 출처 묶음 — `/sources` 목록 화면용. */
export type CitySourceGroup = {
  cityId: string;
  /** 표시용 한국어 도시명 (`city.name.ko`). */
  cityNameKo: string;
  /** 이 도시의 출처 수 (중복 제거 없음 — 도시 안에서는 중복이 없다). */
  count: number;
};

/** 한 카테고리의 출처 묶음 — `/sources/[cityId]` 상세 화면용. */
export type CategorySourceGroup = {
  category: SourceCategory;
  sources: CitySource[];
};

/** 서울 고정 → 권역 순서 → 권역 내 name.ko 가나다순. */
function compareForDisplay(a: CityCostData, b: CityCostData): number {
  if (a.id === SEOUL_ID) return -1;
  if (b.id === SEOUL_ID) return 1;
  const byRegion = REGION_ORDER.indexOf(a.region) - REGION_ORDER.indexOf(b.region);
  if (byRegion !== 0) return byRegion;
  return a.name.ko.localeCompare(b.name.ko, 'ko');
}

/**
 * 로드된 모든 도시를 표시 순서로 반환.
 * 순서: 서울 고정 → 권역(na, eu, asia, oceania, me) → 권역 내 name.ko 가나다순.
 * 출처가 0개인 도시는 제외한다.
 * 데이터 미로드 시 빈 배열.
 */
export function getCitySourceGroups(): CitySourceGroup[] {
  return Object.values(getAllCities())
    .filter((city) => city.sources.length > 0)
    .sort(compareForDisplay)
    .map((city) => ({
      cityId: city.id,
      cityNameKo: city.name.ko,
      count: city.sources.length,
    }));
}

/**
 * 로드된 모든 도시에서 `(name, url)` 조합 기준 unique 출처 수.
 * 데이터 미로드 시 0.
 *
 * url 만으로 세지 않는다 — 서로 다른 기관이 같은 정부 포털 URL 을 쓰는 경우가 있다.
 */
export function countUniqueSources(): number {
  const seen = new Set<string>();
  for (const city of Object.values(getAllCities())) {
    for (const source of city.sources) {
      // JSON 배열 직렬화 = 구분자 모호성 없는 (name, url) 복합 키.
      seen.add(JSON.stringify([source.name, source.url]));
    }
  }
  return seen.size;
}

/**
 * 한 도시의 출처를 카테고리별로 묶어 `CATEGORY_ORDER` 순서로 반환.
 * 출처가 0개인 카테고리 그룹은 결과에 포함하지 않는다 (예: tax 는 v1.0 에서 항상 제외됨).
 * 카테고리 안에서는 원본 `sources[]` 등장 순서를 유지한다.
 *
 * @throws CityNotFoundError 로드된 도시 맵에 없는 `cityId`.
 *   "출처가 없는 도시" 와 "존재하지 않는 도시" 는 화면에서 다르게 처리되어야 하므로
 *   빈 배열로 삼키지 않는다.
 */
export function getCitySourcesByCategory(cityId: string): CategorySourceGroup[] {
  const city = getCity(cityId);
  if (!city) throw new CityNotFoundError(cityId);

  return CATEGORY_ORDER.map((category) => ({
    category,
    sources: city.sources.filter((source) => source.category === category),
  })).filter((group) => group.sources.length > 0);
}
