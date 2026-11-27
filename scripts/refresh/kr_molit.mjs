/**
 * scripts/refresh/kr_molit.mjs
 *
 * 국토교통부 실거래가 공개시스템 → seoul.rent 갱신.
 *
 * API: https://apis.data.go.kr/1613000/RTMSDataSvcRHRent (전월세)
 * 공공데이터포털 키 필요: KR_DATA_API_KEY
 *
 * 방법: 서울특별시 25개 자치구 월세 계약의 환산 월세 (월세 + 보증금 × 전월세전환율 ÷ 12) 메디안
 *       → share/studio/oneBed/twoBed 매핑. 전환율은 DEPOSIT_CONVERSION_RATE (ADR-086).
 * 면적 기준: share (<= 10㎡), studio (11~30㎡), oneBed (31~50㎡), twoBed (51~80㎡)
 * 응답 (공공데이터포털 기술문서): 정상 resultCode `000`, deposit·monthlyRent 는 만원 단위.
 */

import { fetchWithRetry, readCity, writeCity, createMissingApiKeyError, createCitySeed, redactErrorMessage} from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const API_BASE = 'https://apis.data.go.kr/1613000/RTMSDataSvcRHRent/getRTMSDataSvcRHRent';
const MANWON = 10000;

/**
 * 보증금 → 월세 환산에 쓰는 연 전월세전환율 (ADR-086).
 * 출처: 한국부동산원 전국주택가격동향조사 「지역별 전월세 전환율_연립/다세대」 서울, 2026년 9월 4.6%
 * (2026-11 공표, R-ONE 통계표 A_2024_00157). 표본(RTMSDataSvcRHRent)과 같은 서울 연립·다세대의
 * 시장 전환율이다. 갱신은 이 상수 + 테스트 + ADR-086 을 함께 고친다.
 */
export const DEPOSIT_CONVERSION_RATE = 0.046;

export const SEOUL_DISTRICT_CODES = [
  '11110', '11140', '11170', '11200', '11215', '11230', '11260', '11290',
  '11305', '11320', '11350', '11380', '11410', '11440', '11470', '11500',
  '11530', '11545', '11560', '11590', '11620', '11650', '11680', '11710', '11740',
];

export const SOURCE = {
  category: 'rent',
  name: '국토교통부 실거래가 공개시스템',
  url: 'https://rt.molit.go.kr/',
};

/**
 * 면적(㎡) → 카테고리 매핑.
 * @param {number} area
 * @returns {'share' | 'studio' | 'oneBed' | 'twoBed' | null}
 */
export function areaToCategory(area) {
  if (area <= 10) return 'share';
  if (area <= 30) return 'studio';
  if (area <= 50) return 'oneBed';
  if (area <= 80) return 'twoBed';
  return null;
}

/**
 * XML 응답에서 매물 데이터 파싱. deposit·monthlyRent 는 만원 단위로 오므로 원으로 환산해 반환한다.
 * 월세 0 (전세) 은 제외. 보증금이 없는 item 은 환산할 수 없어 제외 (월세만 남기면 낮게 치우친다).
 * @param {string} xml
 * @returns {Array<{area: number, deposit: number, monthlyRent: number}>}
 */
export function parseRentXml(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const areaMatch = /<excluUseAr>([\d.]+)<\/excluUseAr>/.exec(itemXml);
    const depositMatch = /<deposit>([\d,]+)<\/deposit>/.exec(itemXml);
    const rentMatch = /<monthlyRent>([\d,]+)<\/monthlyRent>/.exec(itemXml);

    if (areaMatch && depositMatch && rentMatch) {
      const area = parseFloat(areaMatch[1]);
      const deposit = parseInt(depositMatch[1].replace(/,/g, ''), 10) * MANWON;
      const monthlyRent = parseInt(rentMatch[1].replace(/,/g, ''), 10) * MANWON;

      if (Number.isFinite(area) && Number.isFinite(deposit) && Number.isFinite(monthlyRent) && monthlyRent > 0) {
        items.push({ area, deposit, monthlyRent });
      }
    }
  }

  return items;
}

/**
 * 환산 월세 = 월세 + 보증금 × DEPOSIT_CONVERSION_RATE ÷ 12 (원, 반올림).
 * @param {{deposit: number, monthlyRent: number}} item
 * @returns {number}
 */
export function toConvertedRent({ deposit, monthlyRent }) {
  return Math.round(monthlyRent + (deposit * DEPOSIT_CONVERSION_RATE) / 12);
}

// TEMP DIAGNOSTIC (PR 에 포함하지 않음) — 실제 응답 분포 확인용.
const DIAG = [];
function diagParse(xml) {
  const out = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const x = m[1];
    const g = (tag) => { const r = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(x); return r ? r[1].trim() : null; };
    const area = parseFloat(g('excluUseAr') ?? 'NaN');
    const dep = g('deposit');
    const rent = g('monthlyRent');
    out.push({
      area,
      deposit: dep === null ? null : parseInt(dep.replace(/,/g, ''), 10) * MANWON,
      monthlyRent: rent === null ? null : parseInt(rent.replace(/,/g, ''), 10) * MANWON,
      contractType: g('contractType'),
      houseType: g('houseType'),
    });
  }
  return out;
}
function diagReport() {
  const q = (arr, p) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  const conv = (it, r) => Math.round(it.monthlyRent + (it.deposit * r) / 12);
  const cats = { share: [], studio: [], oneBed: [], twoBed: [], over80: [] };
  let noDeposit = 0;
  const ctypes = {};
  const htypes = {};
  for (const it of DIAG) {
    if (it.deposit === null) noDeposit++;
    ctypes[it.contractType] = (ctypes[it.contractType] ?? 0) + 1;
    htypes[it.houseType] = (htypes[it.houseType] ?? 0) + 1;
    const c = areaToCategory(it.area) ?? 'over80';
    cats[c].push(it);
  }
  const summary = { total: DIAG.length, noDeposit, ctypes, htypes, cats: {} };
  for (const [c, list] of Object.entries(cats)) {
    const wolse = list.filter((it) => it.monthlyRent > 0 && it.deposit !== null);
    const jeonse = list.filter((it) => it.monthlyRent === 0 && it.deposit !== null);
    const shin = wolse.filter((it) => it.contractType === '신규');
    const row = {
      nWolse: wolse.length,
      nJeonse: jeonse.length,
      nWolseNew: shin.length,
      rawMedian: median(wolse.map((it) => it.monthlyRent)),
      rawP25: q(wolse.map((it) => it.monthlyRent), 0.25),
      rawP75: q(wolse.map((it) => it.monthlyRent), 0.75),
      depositMedian: median(wolse.map((it) => it.deposit)),
      depositP75: q(wolse.map((it) => it.deposit), 0.75),
      depositP90: q(wolse.map((it) => it.deposit), 0.9),
      shareDepositGe1eok: wolse.length ? +(wolse.filter((it) => it.deposit >= 100000000).length / wolse.length).toFixed(3) : null,
      areaMedian: median(wolse.map((it) => Math.round(it.area * 10))) / 10,
      jeonseDepositMedian: median(jeonse.map((it) => it.deposit)),
    };
    for (const r of [0.041, 0.046, 0.05, 0.0525, 0.06]) {
      row[`conv_${r}`] = median(wolse.map((it) => conv(it, r)));
    }
    row.convP25_046 = q(wolse.map((it) => conv(it, 0.046)), 0.25);
    row.convP75_046 = q(wolse.map((it) => conv(it, 0.046)), 0.75);
    row.convNewOnly_046 = median(shin.map((it) => conv(it, 0.046)));
    row.rawNewOnly = median(shin.map((it) => it.monthlyRent));
    row.convInclJeonse_046 = median([...wolse, ...jeonse].map((it) => conv(it, 0.046)));
    summary.cats[c] = row;
  }
  console.log(`KR_MOLIT_DIAG ${JSON.stringify(summary)}`);
}

/**
 * 응답 코드 체크.
 * @param {string} xml
 * @returns {{ok: boolean, code: string, msg: string}}
 */
export function parseResultCode(xml) {
  const codeMatch = /<resultCode>([\w]+)<\/resultCode>/.exec(xml);
  const msgMatch = /<resultMsg>([^<]*)<\/resultMsg>/.exec(xml);

  const code = codeMatch?.[1] ?? 'UNKNOWN';
  const msg = msgMatch?.[1] ?? '';

  return { ok: code === '000', code, msg };
}

/**
 * 메디안 계산.
 * @param {number[]} values
 * @returns {number | null}
 */
export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * 국토부 실거래가 → seoul.rent 갱신.
 * @param {{dryRun?: boolean}} [opts]
 * @returns {Promise<RefreshResult>}
 */
export default async function refresh(opts = {}) {
  const apiKey = process.env.KR_DATA_API_KEY;
  if (!apiKey) {
    throw createMissingApiKeyError(
      'KR_DATA_API_KEY is required. Register at https://www.data.go.kr',
    );
  }

  const errors = [];
  const warnings = [];
  const allItems = [];
  // 국토부 실거래가는 통상 1~2개월 지연 공개 — 전달 기준으로 조회.
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const dealYm = `${prev.getFullYear()}${String(prev.getMonth() + 1).padStart(2, '0')}`;

  // 25개 자치구 병렬 fetch — concurrency 5 chunks (data.go.kr rate limit 보호 + GitHub Actions 6분 timeout 회피).
  const CONCURRENCY = 5;
  const NUM_OF_ROWS = 1000;
  const fetchOne = async (lawd) => {
    const items = [];
    try {
      // totalCount 가 numOfRows 를 넘는 자치구 (예: 송파구 월 1,300건+) 는 pageNo 를 올려 끝까지 받는다.
      for (let pageNo = 1; ; pageNo++) {
        const params = new URLSearchParams({
          serviceKey: apiKey,
          LAWD_CD: lawd,
          DEAL_YMD: dealYm,
          numOfRows: String(NUM_OF_ROWS),
          pageNo: String(pageNo),
        });
        const url = `${API_BASE}?${params}`;
        const response = await fetchWithRetry(url, { timeoutMs: 20000 });
        const xml = await response.text();

        const result = parseResultCode(xml);
        if (!result.ok) {
          // 기술문서 에러 코드: 30 등록되지 않은 서비스키, 31 기간 만료된 서비스키, 03 No Data.
          if (result.code === '30' || result.code === '31') {
            return { items: [], error: { reason: `API key invalid or expired: ${result.msg}` } };
          }
          if (result.code === '03') {
            // 1페이지면 매물 0건, 이후 페이지면 앞서 받은 페이지까지가 전부 — 둘 다 오류 아님.
            return { items };
          }
          return { items: [], error: { reason: `API error for ${lawd}: ${result.code} ${result.msg}` } };
        }
        items.push(...parseRentXml(xml));
        DIAG.push(...diagParse(xml));
        const totalCountMatch = /<totalCount>(\d+)<\/totalCount>/.exec(xml);
        if (!totalCountMatch) {
          // 기술문서상 필수 항목 — 없으면 다음 페이지가 있는지 알 수 없어 자치구 전체를 오류로 남긴다.
          return { items: [], error: { reason: `Missing totalCount for ${lawd} (page ${pageNo})` } };
        }
        if (pageNo * NUM_OF_ROWS >= Number(totalCountMatch[1])) return { items };
      }
    } catch (err) {
      return {
        items: [],
        error: { reason: `Fetch failed for district ${lawd}: ${redactErrorMessage(String(err?.message ?? 'unknown'))}` },
      };
    }
  };

  for (let i = 0; i < SEOUL_DISTRICT_CODES.length; i += CONCURRENCY) {
    const chunk = SEOUL_DISTRICT_CODES.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(fetchOne));
    for (const { items, error } of results) {
      if (error) errors.push({ cityId: 'seoul', ...error });
      allItems.push(...items);
    }
  }

  diagReport();
  const byCategory = { share: [], studio: [], oneBed: [], twoBed: [] };
  for (const item of allItems) {
    const cat = areaToCategory(item.area);
    if (cat) {
      byCategory[cat].push(toConvertedRent(item));
    }
  }

  const newRent = {
    share: median(byCategory.share),
    studio: median(byCategory.studio),
    oneBed: median(byCategory.oneBed),
    twoBed: median(byCategory.twoBed),
  };

  if (allItems.length === 0) {
    // NO_DATA — 1-2개월 지연 공개 특성상 일시적으로 발생 가능. 결과값(기존값)은 유효하므로
    // warnings 채널로 기록해 종료 코드에 영향을 주지 않는다 (ADR-079). 구 단위 fetch 실패는
    // 위쪽에서 errors 로 남아 있으므로 그 경우는 여전히 isTotalFailure 대상이다.
    warnings.push({ cityId: 'seoul', reason: 'No rental data for previous month (MOLIT publication lag, retry next cycle)' });
    return {
      source: 'kr_molit',
      cities: [],
      fields: [],
      changes: [],
      errors,
      warnings,
    };
  }

  let oldData;
  try {
    oldData = await readCity('seoul');
  } catch (err) {
    if (err?.code !== 'CITY_NOT_FOUND') {
      errors.push({ cityId: 'seoul', reason: `Failed to read existing data: ${redactErrorMessage(String(err?.message ?? ""))}` });
    }
  }

  const changes = [];
  const fields = [];
  const oldRent = oldData?.rent ?? {};

  for (const field of ['share', 'studio', 'oneBed', 'twoBed']) {
    const oldVal = oldRent[field] ?? null;
    const newVal = newRent[field];

    if (oldVal !== newVal && newVal !== null) {
      fields.push(field);
      const pctChange = computePctChange(oldVal, newVal);
      changes.push({ cityId: 'seoul', field: `rent.${field}`, oldValue: oldVal, newValue: newVal, pctChange });
    }
  }

  if (!opts.dryRun && changes.length > 0) {
    const base = oldData ?? createCitySeed({ id: 'seoul', name: { ko: '서울', en: 'Seoul' }, country: 'KR', currency: 'KRW', region: 'asia' });
    const updatedData = { ...base, rent: { ...base.rent, ...newRent } };

    try {
      await writeCity('seoul', updatedData, SOURCE);
    } catch (err) {
      errors.push({ cityId: 'seoul', reason: `Write failed: ${redactErrorMessage(String(err?.message ?? "unknown"))}` });
    }
  }

  return {
    source: 'kr_molit',
    cities: changes.length > 0 ? ['seoul'] : [],
    fields,
    changes,
    errors,
    warnings,
  };
}

