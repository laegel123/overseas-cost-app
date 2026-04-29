import { parseAllCitiesText, validateAllJson } from '@/lib/citySchema';

import seedJson from '../../data/seed/all.json';

import { seoulValid } from './cities/seoul-valid';
import { vancouverValid } from './cities/vancouver-valid';

describe('data/seed/all.json (fixture-based seed, ADR-045)', () => {
  it('schemaVersion === 1', () => {
    expect(seedJson.schemaVersion).toBe(1);
  });
  it('서울 + 밴쿠버 만 포함 (v1.0 시드 = 2도시)', () => {
    expect(Object.keys(seedJson.cities).sort()).toEqual(['seoul', 'vancouver']);
  });
  it('validateAllJson 통과', () => {
    expect(() => validateAllJson(seedJson)).not.toThrow();
  });
  it('parseAllCitiesText 통과 (텍스트 round-trip)', () => {
    expect(() => parseAllCitiesText(JSON.stringify(seedJson))).not.toThrow();
  });
  it('서울 모든 채집 카테고리에 대응 sources entry', () => {
    const cats = new Set(
      seedJson.cities.seoul.sources.map((s: { category: string }) => s.category),
    );
    expect(cats.has('rent') && cats.has('food') && cats.has('transport')).toBe(true);
  });
  it('밴쿠버 모든 채집 카테고리에 대응 sources entry', () => {
    const cats = new Set(
      seedJson.cities.vancouver.sources.map((s: { category: string }) => s.category),
    );
    expect(cats.has('rent') && cats.has('food') && cats.has('transport')).toBe(true);
    expect(cats.has('tuition') && cats.has('tax') && cats.has('visa')).toBe(true);
  });
  it('fixture 와 시드 값이 일치 (drift 방지)', () => {
    // step 1 fixture 와 step 2 시드는 본 step 시점에 동일 값. 향후 둘이 갈라질 수 있음 — 그게 정상
    // (fixture = 테스트 frozen, seed = 자동화가 덮어씀). 단 본 step 직후에는 동일해야 한다.
    expect(seedJson.cities.seoul).toEqual(seoulValid);
    expect(seedJson.cities.vancouver).toEqual(vancouverValid);
  });
});
