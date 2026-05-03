/**
 * scripts/refresh/fx_backup.mjs
 *
 * ECB Daily Exchange Rates → data/static/fx_fallback.json 갱신.
 *
 * 목적: 클라이언트 open.er-api.com 실패 시 3차 fallback 값 갱신 (DATA.md §5.1).
 * GitHub Actions refresh-fx.yml 에서 일 1회 cron 실행 (AUTOMATION.md §4.6).
 *
 * API 키 요구 사항:
 *   - ECB: 불필요 (공개 XML)
 *   - 한국은행 ECOS API (https://ecos.bok.or.kr/api): 인증키 필요 — 본 스크립트 미사용
 *
 * 참고: ECB XML 은 EUR base (1 EUR = X 통화). KRW base 변환 필요.
 *       ECB 에 KRW 가 포함되지 않으면 fallback 갱신 불가 (error).
 *       이 경우 수동 갱신 필요 (운영자 알림).
 */

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

import { fetchWithRetry, redactErrorMessage } from './_common.mjs';
import { computePctChange } from './_outlier.mjs';

const ECB_DAILY_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';

const TARGET_CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'JPY', 'SGD', 'VND', 'AED'];

function getFxFallbackPath() {
  return resolve(process.env.FX_FALLBACK_PATH ?? 'data/static/fx_fallback.json');
}

/**
 * @typedef {import('./_common.mjs').RefreshResult} RefreshResult
 */

/**
 * ECB XML 파싱 — EUR base rates 추출.
 * @param {string} xml
 * @returns {Record<string, number>} EUR base rates (1 EUR = X currency)
 */
function parseEcbXml(xml) {
  const rates = { EUR: 1 };
  const regex = /<Cube currency=['"]([A-Z]{3})['"] rate=['"]([0-9.]+)['"]\s*\/>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const [, currency, rateStr] = match;
    const rate = parseFloat(rateStr);
    if (Number.isFinite(rate) && rate > 0) {
      rates[currency] = rate;
    }
  }
  return rates;
}

/**
 * EUR base → KRW base 변환.
 * @param {Record<string, number>} eurRates EUR base rates
 * @returns {Record<string, number>} KRW base rates (1 X = N KRW)
 */
function convertToKrwBase(eurRates) {
  const krwPerEur = eurRates['KRW'];
  if (typeof krwPerEur !== 'number' || !Number.isFinite(krwPerEur) || krwPerEur <= 0) {
    throw new Error('ECB response missing KRW rate — cannot convert to KRW base');
  }

  const out = {};
  for (const [code, eurRate] of Object.entries(eurRates)) {
    if (code === 'KRW') continue;
    if (typeof eurRate !== 'number' || !Number.isFinite(eurRate) || eurRate <= 0) continue;
    out[code] = krwPerEur / eurRate;
  }
  return out;
}

/**
 * fx_fallback.json atomic write.
 * @param {Record<string, number>} krwRates
 * @returns {Promise<void>}
 */
async function writeFallbackJson(krwRates) {
  const fallbackPath = getFxFallbackPath();
  const dir = dirname(fallbackPath);
  await mkdir(dir, { recursive: true });

  const d = new Date();
  const asOf = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const filteredRates = {};
  for (const code of TARGET_CURRENCIES) {
    if (code === 'KRW') continue;
    const rate = krwRates[code];
    if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
      filteredRates[code] = Math.round(rate * 1000) / 1000;
    }
  }

  const data = {
    schemaVersion: 1,
    baseCurrency: 'KRW',
    asOf,
    rates: filteredRates,
  };

  const tmpPath = join(tmpdir(), `fx-fallback-${randomUUID()}.json`);
  const content = JSON.stringify(data, null, 2) + '\n';

  await writeFile(tmpPath, content, 'utf-8');
  await rename(tmpPath, fallbackPath);
}

/**
 * 기존 fx_fallback.json 읽기.
 * @returns {Promise<{schemaVersion: number, baseCurrency: string, asOf: string, rates: Record<string, number>} | null>}
 */
async function readExistingFallback() {
  try {
    const content = await readFile(getFxFallbackPath(), 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * 변경 비교.
 * @param {Record<string, number>} oldRates
 * @param {Record<string, number>} newRates
 * @returns {Array<{cityId: string, field: string, oldValue: number|null, newValue: number|null, pctChange: number}>}
 */
function computeChanges(oldRates, newRates) {
  const changes = [];
  const allCodes = new Set([...Object.keys(oldRates ?? {}), ...Object.keys(newRates ?? {})]);

  for (const code of allCodes) {
    const oldVal = oldRates?.[code] ?? null;
    const newVal = newRates?.[code] ?? null;

    if (oldVal === null && newVal !== null) {
      changes.push({ cityId: 'fx', field: code, oldValue: null, newValue: newVal, pctChange: computePctChange(null, newVal) });
    } else if (oldVal !== null && newVal === null) {
      changes.push({ cityId: 'fx', field: code, oldValue: oldVal, newValue: null, pctChange: computePctChange(oldVal, null) });
    } else if (oldVal !== null && newVal !== null && oldVal !== newVal) {
      changes.push({ cityId: 'fx', field: code, oldValue: oldVal, newValue: newVal, pctChange: computePctChange(oldVal, newVal) });
    }
  }

  return changes;
}

/**
 * ECB → fx_fallback.json 갱신.
 * @param {{dryRun?: boolean}} [opts]
 * @returns {Promise<RefreshResult>}
 */
export default async function refresh(opts = {}) {
  const errors = [];
  let eurRates;

  try {
    const response = await fetchWithRetry(ECB_DAILY_URL, { timeoutMs: 15000 });
    const xml = await response.text();

    if (!xml || xml.length === 0) {
      throw new Error('ECB returned empty response');
    }

    eurRates = parseEcbXml(xml);
    const rateCount = Object.keys(eurRates).length;

    if (rateCount < 2) {
      throw new Error(`ECB returned too few currencies: ${rateCount}`);
    }
  } catch (err) {
    errors.push({ cityId: 'fx', reason: `ECB fetch failed: ${redactErrorMessage(String(err?.message ?? 'unknown'))}` });
    return {
      source: 'fx_backup',
      cities: [],
      fields: [],
      changes: [],
      errors,
    };
  }

  let krwRates;
  try {
    krwRates = convertToKrwBase(eurRates);
  } catch (err) {
    errors.push({ cityId: 'fx', reason: redactErrorMessage(String(err?.message ?? 'KRW conversion failed')) });
    return {
      source: 'fx_backup',
      cities: [],
      fields: [],
      changes: [],
      errors,
    };
  }

  const existing = await readExistingFallback();
  const oldRates = existing?.rates ?? {};
  const changes = computeChanges(oldRates, krwRates);
  const updatedFields = changes.map((c) => c.field);

  if (!opts.dryRun) {
    try {
      await writeFallbackJson(krwRates);
    } catch (err) {
      errors.push({ cityId: 'fx', reason: `Write failed: ${redactErrorMessage(String(err?.message ?? 'unknown'))}` });
    }
  }

  return {
    source: 'fx_backup',
    cities: ['fx'],
    fields: updatedFields,
    changes,
    errors,
  };
}

export { parseEcbXml, convertToKrwBase, ECB_DAILY_URL, TARGET_CURRENCIES };
