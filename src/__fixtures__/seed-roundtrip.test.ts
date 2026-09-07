import { parseAllCitiesText, validateAllJson } from '@/lib/citySchema';

import allJson from '../../data/all.json';
import seedJson from '../../data/seed/all.json';

// v1.0 = 서울 + 해외 20 도시 (PRD). build_data.mjs 가 all.json 과 시드를 함께 쓴다.
const V1_CITY_COUNT = 21;

describe('data/seed/all.json (실데이터 시드, ADR-074)', () => {
  it('schemaVersion === 1', () => {
    expect(seedJson.schemaVersion).toBe(1);
  });

  it('v1.0 도시 21개 전부 포함 — 오프라인 fallback 이 퇴행하지 않는다', () => {
    // ADR-074 의 핵심 계약. 구 시드는 fixture 2개뿐이라 네트워크 실패 시
    // 앱이 21개 → 2개로 무너졌다.
    expect(Object.keys(seedJson.cities)).toHaveLength(V1_CITY_COUNT);
    expect(seedJson.cities.seoul).toBeDefined();
  });

  it('시드 == data/all.json — build_data.mjs 가 둘을 함께 쓴다 (drift 방지)', () => {
    expect(seedJson).toEqual(allJson);
  });

  it('validateAllJson 통과', () => {
    expect(() => validateAllJson(seedJson)).not.toThrow();
  });

  it('parseAllCitiesText 통과 (텍스트 round-trip)', () => {
    expect(() => parseAllCitiesText(JSON.stringify(seedJson))).not.toThrow();
  });

  it('모든 도시가 rent · food · transport sources entry 를 갖는다', () => {
    for (const [id, city] of Object.entries(seedJson.cities)) {
      const cats = new Set(
        (city as { sources: { category: string }[] }).sources.map((s) => s.category),
      );
      expect({ id, rent: cats.has('rent') }).toEqual({ id, rent: true });
      expect({ id, food: cats.has('food') }).toEqual({ id, food: true });
      expect({ id, transport: cats.has('transport') }).toEqual({ id, transport: true });
    }
  });
});
