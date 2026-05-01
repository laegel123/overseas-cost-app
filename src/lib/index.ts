/**
 * lib 모듈의 단일 진입점. Phase 3 에서 format/data/compare 추가.
 *
 * 주의: `__resetForTesting` (data) 와 `__resetInflightForTesting` (currency) 은
 * 의도적으로 본 인덱스에서 export 하지 않는다. 테스트가 모듈 스코프 inflight /
 * 메모리 맵을 강제 리셋하기 위한 escape hatch 라 프로덕션 import 경로
 * (`@/lib`) 에서 보이면 안 된다. 테스트는 직접 모듈에서 import:
 *   `import { __resetForTesting } from '@/lib/data';`
 */
export * from './errors';
export { parseAllCitiesText, validateAllJson, validateCity } from './citySchema';
export { convertToKRW, fetchExchangeRates, FX_BASELINE_2026Q2, refreshFx } from './currency';
export { getAllCities, getCity, getLastSync, loadAllCities, refreshCache } from './data';
export { formatKRW, formatMultiplier, formatShortDate, getMultColor, isHot } from './format';
