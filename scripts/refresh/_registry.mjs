/**
 * 출처 ↔ 도시 레지스트리.
 * DATA_SOURCES.md 부록 A 의 매핑을 코드화.
 */

/**
 * 출처별 담당 도시 목록.
 * 키: scripts/refresh/<source>.mjs 의 파일명 (확장자 제외)
 * 값: 해당 출처가 담당하는 도시 id 배열
 *
 * @type {Record<string, string[]>}
 */
export const SOURCE_TO_CITIES = {
  // --- 한국 ---
  kr_molit: ['seoul'],
  kr_kca: ['seoul'],
  kr_kosis: ['seoul'],
  kr_seoul_metro: ['seoul'],

  // --- 캐나다 ---
  ca_cmhc: ['vancouver', 'toronto', 'montreal'],
  ca_statcan: ['vancouver', 'toronto', 'montreal'],
  ca_translink: ['vancouver'],
  ca_ttc: ['toronto'],
  ca_stm: ['montreal'],

  // --- 미국 ---
  us_hud: ['nyc', 'la', 'sf', 'seattle', 'boston'],
  us_census: ['nyc', 'la', 'sf', 'seattle', 'boston'],
  us_bls: ['nyc', 'la', 'sf', 'seattle', 'boston'],
  us_mta: ['nyc'],
  us_lacmta: ['la'],
  us_bart: ['sf'],
  us_kcm: ['seattle'],
  us_mbta: ['boston'],

  // --- 영국 ---
  uk_ons: ['london', 'manchester'],
  uk_tfl: ['london'],
  uk_tfgm: ['manchester'],

  // --- 독일 ---
  de_destatis: ['berlin', 'munich'],
  de_bvg: ['berlin'],
  de_mvv: ['munich'],

  // --- 프랑스 ---
  fr_insee: ['paris'],
  fr_ratp: ['paris'],

  // --- 네덜란드 ---
  nl_cbs: ['amsterdam'],
  nl_gvb: ['amsterdam'],

  // --- 호주 ---
  au_abs: ['sydney', 'melbourne'],
  au_opal: ['sydney'],
  au_myki: ['melbourne'],

  // --- 일본 ---
  jp_estat: ['tokyo', 'osaka'],
  jp_jreast: ['tokyo'],
  jp_osakametro: ['osaka'],

  // --- 싱가포르 ---
  sg_singstat: ['singapore'],
  sg_lta: ['singapore'],

  // --- 베트남 ---
  vn_gso: ['hochiminh'],

  // --- 중동 ---
  ae_fcsc: ['dubai'],
  ae_rta: ['dubai'],

  // --- 공통 (다국가) ---
  universities: [
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
  ],
  visas: [
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
  ],
};

/**
 * 도시별 담당 출처 목록 (역인덱스).
 * @type {Record<string, string[]>}
 */
export const CITY_TO_SOURCES = Object.entries(SOURCE_TO_CITIES).reduce(
  (acc, [source, cities]) => {
    for (const city of cities) {
      if (!acc[city]) {
        acc[city] = [];
      }
      acc[city].push(source);
    }
    return acc;
  },
  /** @type {Record<string, string[]>} */ ({}),
);

/**
 * v1.0 출시 도시 21개 (서울 + 20).
 */
export const ALL_CITIES = [
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

/**
 * 출처가 담당하는 도시 목록 반환.
 * @param {string} source
 * @returns {string[]}
 */
export function getCitiesForSource(source) {
  return SOURCE_TO_CITIES[source] ?? [];
}

/**
 * 도시를 담당하는 출처 목록 반환.
 * @param {string} cityId
 * @returns {string[]}
 */
export function getSourcesForCity(cityId) {
  return CITY_TO_SOURCES[cityId] ?? [];
}
