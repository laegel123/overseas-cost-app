/**
 * scripts/refresh/_cities.mjs
 *
 * 21개 도시 (서울 + 해외 20개) 공통 메타 — id / name / country / currency / region.
 *
 * **존재 이유**:
 *   `visas.mjs` / `universities.mjs` 가 각자 동일한 20도시 CITY_CONFIGS 를 선언해 도시명·통화
 *   변경 시 두 곳 동시 수정이 필요했음. 본 모듈로 단일화. 20도시 fetcher (visas / universities) 는
 *   본 OVERSEAS_CITY_CONFIGS 를 import 해서 재사용한다.
 *
 * **단독 실행 금지** — `_run.mjs` 의 path traversal 정규식이 `_` 시작 모듈을 차단하므로
 *   `node scripts/refresh/_run.mjs _cities` 는 fail-fast.
 *
 * **다른 fetcher (us_bls, us_hud, jp_estat 등) 는 자체 CITY_CONFIGS 유지** — 도시별 추가 메타
 * (blsRegion, adjustmentFactor, cbsaCode, estatArea 등) 가 fetcher 에 종속이라 격리가 의도.
 * 본 모듈은 "fetcher 별 추가 메타가 없는 20도시 공통" 만 담당.
 */

/**
 * @typedef {{
 *   id: string,
 *   name: { ko: string, en: string },
 *   country: string,
 *   currency: string,
 *   region: 'na' | 'eu' | 'asia' | 'oceania' | 'me',
 * }} CityConfig
 */

/** @type {Record<string, CityConfig>} */
export const OVERSEAS_CITY_CONFIGS = {
  vancouver: { id: 'vancouver', name: { ko: '밴쿠버', en: 'Vancouver' }, country: 'CA', currency: 'CAD', region: 'na' },
  toronto: { id: 'toronto', name: { ko: '토론토', en: 'Toronto' }, country: 'CA', currency: 'CAD', region: 'na' },
  montreal: { id: 'montreal', name: { ko: '몬트리올', en: 'Montreal' }, country: 'CA', currency: 'CAD', region: 'na' },
  nyc: { id: 'nyc', name: { ko: '뉴욕', en: 'New York' }, country: 'US', currency: 'USD', region: 'na' },
  la: { id: 'la', name: { ko: '로스앤젤레스', en: 'Los Angeles' }, country: 'US', currency: 'USD', region: 'na' },
  sf: { id: 'sf', name: { ko: '샌프란시스코', en: 'San Francisco' }, country: 'US', currency: 'USD', region: 'na' },
  seattle: { id: 'seattle', name: { ko: '시애틀', en: 'Seattle' }, country: 'US', currency: 'USD', region: 'na' },
  boston: { id: 'boston', name: { ko: '보스턴', en: 'Boston' }, country: 'US', currency: 'USD', region: 'na' },
  london: { id: 'london', name: { ko: '런던', en: 'London' }, country: 'GB', currency: 'GBP', region: 'eu' },
  berlin: { id: 'berlin', name: { ko: '베를린', en: 'Berlin' }, country: 'DE', currency: 'EUR', region: 'eu' },
  munich: { id: 'munich', name: { ko: '뮌헨', en: 'Munich' }, country: 'DE', currency: 'EUR', region: 'eu' },
  paris: { id: 'paris', name: { ko: '파리', en: 'Paris' }, country: 'FR', currency: 'EUR', region: 'eu' },
  amsterdam: { id: 'amsterdam', name: { ko: '암스테르담', en: 'Amsterdam' }, country: 'NL', currency: 'EUR', region: 'eu' },
  sydney: { id: 'sydney', name: { ko: '시드니', en: 'Sydney' }, country: 'AU', currency: 'AUD', region: 'oceania' },
  melbourne: { id: 'melbourne', name: { ko: '멜버른', en: 'Melbourne' }, country: 'AU', currency: 'AUD', region: 'oceania' },
  tokyo: { id: 'tokyo', name: { ko: '도쿄', en: 'Tokyo' }, country: 'JP', currency: 'JPY', region: 'asia' },
  osaka: { id: 'osaka', name: { ko: '오사카', en: 'Osaka' }, country: 'JP', currency: 'JPY', region: 'asia' },
  singapore: { id: 'singapore', name: { ko: '싱가포르', en: 'Singapore' }, country: 'SG', currency: 'SGD', region: 'asia' },
  hochiminh: { id: 'hochiminh', name: { ko: '호치민', en: 'Ho Chi Minh City' }, country: 'VN', currency: 'VND', region: 'asia' },
  dubai: { id: 'dubai', name: { ko: '두바이', en: 'Dubai' }, country: 'AE', currency: 'AED', region: 'me' },
};
