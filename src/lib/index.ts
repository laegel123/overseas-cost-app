/**
 * lib 모듈의 단일 진입점. Phase 3 에서 format/data/compare 추가.
 */
export * from './errors';
export { parseAllCitiesText, validateAllJson, validateCity } from './citySchema';
export { convertToKRW, fetchExchangeRates, FX_BASELINE_2026Q2, refreshFx } from './currency';
