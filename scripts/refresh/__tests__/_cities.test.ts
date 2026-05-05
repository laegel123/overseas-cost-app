/**
 * _cities.mjs 테스트.
 * TESTING.md §9-A.1 인벤토리 (PR #20 review round 10 — visas/universities CITY_CONFIGS 단일 출처).
 */

import { OVERSEAS_CITY_CONFIGS } from '../_cities.mjs';
import { CITY_CONFIGS as VISA_CITY_CONFIGS } from '../visas.mjs';
import { CITY_CONFIGS as UNI_CITY_CONFIGS } from '../universities.mjs';

describe('OVERSEAS_CITY_CONFIGS', () => {
  it('20개 도시 (서울 제외, v1.0 출시 도시 전체) 포함', () => {
    expect(Object.keys(OVERSEAS_CITY_CONFIGS)).toHaveLength(20);
  });

  it('각 도시에 id / name / country / currency / region 필수 필드', () => {
    for (const [cityId, config] of Object.entries(OVERSEAS_CITY_CONFIGS)) {
      expect(config.id).toBe(cityId);
      expect(config.name.ko).toBeTruthy();
      expect(config.name.en).toBeTruthy();
      expect(config.country).toBeTruthy();
      expect(config.currency).toBeTruthy();
      expect(['na', 'eu', 'asia', 'oceania', 'me']).toContain(config.region);
    }
  });

  it('서울(seoul) 은 포함되지 않음 — 본 모듈은 해외 20도시 전용 (서울은 비교 baseline)', () => {
    expect(OVERSEAS_CITY_CONFIGS).not.toHaveProperty('seoul');
  });

  // 회귀 차단 — visas / universities 가 본 모듈을 재사용함을 보장. 하나만 직접 정의하고
  // 다른 한쪽이 동기화 누락하는 과거 패턴 (PR #20 review round 10) 회귀 차단.
  it('visas.mjs 의 CITY_CONFIGS 와 동일 reference (단일 출처)', () => {
    expect(VISA_CITY_CONFIGS).toBe(OVERSEAS_CITY_CONFIGS);
  });

  it('universities.mjs 의 CITY_CONFIGS 와 동일 reference (단일 출처)', () => {
    expect(UNI_CITY_CONFIGS).toBe(OVERSEAS_CITY_CONFIGS);
  });
});
