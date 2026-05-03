/**
 * scripts/refresh/ 공통 헬퍼.
 * Node 20 native ESM + native fetch.
 */

import { readFile, writeFile, mkdir, rename, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

/**
 * DATA_DIR 환경 변수로 override 가능 (테스트용).
 * 기본값: 'data/cities'
 */
export function getDataDir() {
  return process.env.DATA_DIR ?? 'data/cities';
}

/**
 * 도시 파일 경로 반환. path traversal 차단.
 * @param {string} id
 * @returns {string}
 */
export function getCityPath(id) {
  if (typeof id !== 'string' || id.length === 0) {
    throw createInvalidCityIdError(`invalid city id: empty or non-string`);
  }
  if (!/^[a-z][a-z0-9-]*$/.test(id)) {
    throw createInvalidCityIdError(`invalid city id format: ${id}`);
  }
  const dataDir = getDataDir();
  const filePath = join(dataDir, `${id}.json`);
  const resolved = resolve(filePath);
  const resolvedDataDir = resolve(dataDir);
  if (!resolved.startsWith(resolvedDataDir)) {
    throw createInvalidCityIdError(`path traversal attempt: ${id}`);
  }
  return filePath;
}

/**
 * @typedef {Object} RefreshResult
 * @property {string} source
 * @property {string[]} cities
 * @property {string[]} fields
 * @property {Array<{cityId: string, field: string, oldValue: number|null, newValue: number|null, pctChange: number}>} changes
 * @property {Array<{cityId: string, reason: string}>} errors
 */

const BACKOFF_BASE_MS = 1000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * exponential backoff retry (1s, 2s, 4s) 로 fetch.
 * 5xx → 재시도, 4xx → 즉시 throw.
 * `method`, `headers`, `body` 등 표준 RequestInit 옵션 모두 fetch 로 forward.
 * @param {string} url
 * @param {RequestInit & {maxRetries?: number, timeoutMs?: number}} [opts]
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, opts = {}) {
  const { maxRetries = DEFAULT_MAX_RETRIES, timeoutMs = DEFAULT_TIMEOUT_MS, signal: externalSignal, ...fetchInit } =
    opts;
  // 에러 메시지에 노출되는 URL 은 항상 마스킹 (undici 가 message 에 원본 URL 포함 가능 — API 키 누출 방어).
  const safeUrl = redactSecretsInUrl(url);
  const sanitizeMsg = (msg) => (msg ? redactErrorMessage(String(msg)) : 'unknown error');

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    let cleanupSignal = () => {};

    try {
      let signal;
      if (externalSignal) {
        const combined = combineSignals(externalSignal, controller.signal);
        signal = combined.signal;
        cleanupSignal = combined.cleanup;
      } else {
        signal = controller.signal;
      }

      const response = await fetch(url, { ...fetchInit, signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        return response;
      }

      // 429 (Too Many Requests) 는 transient — backoff 로 재시도. 다른 4xx 는 즉시 throw.
      if (response.status === 429) {
        lastError = new Error(`HTTP 429`);
      } else if (response.status >= 400 && response.status < 500) {
        throw createFetchRetryExhaustedError(
          `HTTP ${response.status} (client error, no retry) ${safeUrl}`,
          attempt,
        );
      } else {
        lastError = new Error(`HTTP ${response.status}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);

      if (err?.name === 'AbortError') {
        if (externalSignal?.aborted) {
          throw createFetchTimeoutError(`request aborted by caller ${safeUrl}`);
        }
        throw createFetchTimeoutError(`request timed out after ${timeoutMs}ms ${safeUrl}`);
      }

      if (err?.code === 'FETCH_RETRY_EXHAUSTED' || err?.code === 'FETCH_TIMEOUT') {
        throw err;
      }

      lastError = err;
    } finally {
      // attempt 종료 시 externalSignal 의 listener 정리 (성공 / 5xx / 네트워크 에러 모두).
      cleanupSignal();
    }

    if (attempt < maxRetries) {
      const backoffMs = BACKOFF_BASE_MS * Math.pow(2, attempt);
      await sleep(backoffMs);
    }
  }

  throw createFetchRetryExhaustedError(
    `fetch failed after ${maxRetries + 1} attempts: ${sanitizeMsg(lastError?.message)} ${safeUrl}`,
    maxRetries + 1,
  );
}

/**
 * 도시 JSON 읽기.
 * @param {string} id
 * @returns {Promise<import('../../src/types/city').CityCostData>}
 */
export async function readCity(id) {
  const filePath = getCityPath(id);

  let content;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (err) {
    if (err?.code === 'ENOENT') {
      throw createCityNotFoundError(`city file not found: ${id}`);
    }
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw createCityParseError(`invalid JSON in city file: ${id}`, err);
  }

  const validated = validateCityData(parsed, id);
  return validated;
}

/**
 * 도시 JSON 쓰기 (atomic write).
 * @param {string} id
 * @param {import('../../src/types/city').CityCostData} data
 * @param {{category: string, name: string, url: string}} source
 * @returns {Promise<void>}
 */
export async function writeCity(id, data, source) {
  const filePath = getCityPath(id);
  const dir = dirname(filePath);

  await mkdir(dir, { recursive: true });

  const d = new Date();
  const now = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const updatedData = {
    ...data,
    lastUpdated: now,
    sources: updateSources(data.sources, source, now),
  };

  validateCityData(updatedData, id);

  const tmpPath = join(tmpdir(), `city-${randomUUID()}.json`);
  const content = JSON.stringify(updatedData, null, 2) + '\n';

  await writeFile(tmpPath, content, 'utf-8');
  await rename(tmpPath, filePath);
}

/**
 * sources 배열 업데이트. 같은 category+name 이면 accessedAt 만 갱신.
 * @param {import('../../src/types/city').CitySource[] | undefined} sources
 * @param {{category: string, name: string, url: string}} newSource
 * @param {string} accessedAt
 * @returns {import('../../src/types/city').CitySource[]}
 */
function updateSources(sources, newSource, accessedAt) {
  const existing = sources ?? [];
  const idx = existing.findIndex(
    (s) => s.category === newSource.category && s.name === newSource.name,
  );

  const entry = {
    category: newSource.category,
    name: newSource.name,
    url: newSource.url,
    accessedAt,
  };

  if (idx >= 0) {
    const updated = [...existing];
    updated[idx] = entry;
    return updated;
  }

  return [...existing, entry];
}

/**
 * 도시 데이터 스키마 검증 (간이 버전).
 * 실제 validateCity 는 빌드 시 citySchema.ts 에서 직접 사용.
 * @param {unknown} data
 * @param {string} ctxId
 * @returns {import('../../src/types/city').CityCostData}
 */
export function validateCityData(data, ctxId) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw createCitySchemaError(`city data must be an object: ${ctxId}`);
  }

  const obj = data;

  const requiredStrings = ['id', 'country', 'currency', 'region', 'lastUpdated'];
  for (const key of requiredStrings) {
    if (typeof obj[key] !== 'string' || obj[key].length === 0) {
      throw createCitySchemaError(`${ctxId}.${key}: missing or invalid`);
    }
  }

  // build_data.mjs 와 동일한 검증 — 잘못된 파일 (e.g. seoul.json 에 id: 'tokyo') 차단.
  if (obj.id !== ctxId) {
    throw createCitySchemaError(
      `${ctxId}.id: id field mismatch (expected "${ctxId}", got "${obj.id}")`,
    );
  }

  if (typeof obj.name !== 'object' || obj.name === null) {
    throw createCitySchemaError(`${ctxId}.name: missing or invalid`);
  }
  if (
    typeof obj.name.ko !== 'string' ||
    obj.name.ko.length === 0 ||
    typeof obj.name.en !== 'string' ||
    obj.name.en.length === 0
  ) {
    throw createCitySchemaError(`${ctxId}.name: ko and en required (non-empty)`);
  }

  for (const section of ['rent', 'food', 'transport']) {
    if (typeof obj[section] !== 'object' || obj[section] === null) {
      throw createCitySchemaError(`${ctxId}.${section}: missing or invalid`);
    }
  }

  if (!Array.isArray(obj.sources) || obj.sources.length === 0) {
    throw createCitySchemaError(`${ctxId}.sources: must be non-empty array`);
  }

  return data;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * URL 의 민감한 쿼리 파라미터 (API key 류) 를 마스킹.
 * 로그·에러 메시지에 URL 노출 시 사용. fetch 호출 자체는 원본 URL 사용.
 * @param {string} url
 * @returns {string} 마스킹된 URL
 */
export function redactSecretsInUrl(url) {
  const SECRET_PARAMS = /^(serviceKey|api_?Key|apikey|key|token|access_?Token|registrationkey)$/i;
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) {
      if (SECRET_PARAMS.test(k)) u.searchParams.set(k, '***REDACTED***');
    }
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * 에러 메시지 안에 박혀 있는 URL 의 secret 쿼리도 마스킹.
 * undici 등이 던지는 에러는 원본 URL 을 그대로 메시지에 포함하므로 별도 처리 필요.
 * @param {string} message
 * @returns {string}
 */
export function redactErrorMessage(message) {
  return message.replace(/https?:\/\/[^\s'"]+/g, (m) => redactSecretsInUrl(m));
}

/**
 * 두 AbortSignal 중 하나라도 abort 시 새 controller.signal 도 abort.
 * retry 루프에서 반복 호출되므로 listener 누적을 막기 위해 cleanup 함수도 반환.
 * @returns {{signal: AbortSignal, cleanup: () => void}}
 */
function combineSignals(signal1, signal2) {
  const controller = new AbortController();

  if (signal1.aborted || signal2.aborted) {
    controller.abort();
    return { signal: controller.signal, cleanup: () => {} };
  }

  const abort = () => {
    controller.abort();
    signal1.removeEventListener('abort', abort);
    signal2.removeEventListener('abort', abort);
  };

  signal1.addEventListener('abort', abort, { once: true });
  signal2.addEventListener('abort', abort, { once: true });

  // 호출자 (fetchWithRetry) 가 attempt 종료 시 cleanup 호출 — 성공 path 에서 listener 누적 방지.
  const cleanup = () => {
    signal1.removeEventListener('abort', abort);
    signal2.removeEventListener('abort', abort);
  };

  return { signal: controller.signal, cleanup };
}

/**
 * 도시 seed 데이터 생성 — refresh 스크립트 초기화용 (도시 JSON 파일 부재 시).
 *
 * **반환된 객체는 의도적으로 invalid 상태**: `lastUpdated: ''` + `sources: []` 가
 * `validateCityData` 를 통과하지 못한다. 이는 caller (refresh 스크립트) 가
 * `writeCity` 호출 시 양쪽 필드를 채우도록 강제하는 안전망 역할.
 *
 * 외부 호출 금지 — refresh 스크립트 내부에서만 사용.
 *
 * @param {{id: string, name: {ko: string, en: string}, country: string, currency: string, region: string}} config
 * @returns {import('../../src/types/city').CityCostData}
 * @internal
 */
export function createCitySeed(config) {
  return {
    id: config.id,
    name: config.name,
    country: config.country,
    currency: config.currency,
    region: config.region,
    lastUpdated: '',
    rent: { share: null, studio: null, oneBed: null, twoBed: null },
    food: {
      restaurantMeal: 0,
      cafe: 0,
      groceries: {
        milk1L: 0,
        eggs12: 0,
        rice1kg: 0,
        chicken1kg: 0,
        bread: 0,
      },
    },
    transport: { monthlyPass: 0, singleRide: 0, taxiBase: 0 },
    sources: [],
  };
}

function createFetchRetryExhaustedError(message, retryCount) {
  const err = new Error(message);
  err.name = 'FetchRetryExhaustedError';
  err.code = 'FETCH_RETRY_EXHAUSTED';
  err.retryCount = retryCount;
  return err;
}

function createFetchTimeoutError(message) {
  const err = new Error(message);
  err.name = 'FetchTimeoutError';
  err.code = 'FETCH_TIMEOUT';
  return err;
}

function createCityNotFoundError(message) {
  const err = new Error(message);
  err.name = 'CityNotFoundError';
  err.code = 'CITY_NOT_FOUND';
  return err;
}

function createCityParseError(message, cause) {
  const err = new Error(message);
  err.name = 'CityParseError';
  err.code = 'CITY_PARSE_FAILED';
  err.cause = cause;
  return err;
}

function createCitySchemaError(message) {
  const err = new Error(message);
  err.name = 'CitySchemaError';
  err.code = 'CITY_SCHEMA_INVALID';
  return err;
}

function createInvalidCityIdError(message) {
  const err = new Error(message);
  err.name = 'InvalidCityIdError';
  err.code = 'INVALID_CITY_ID';
  return err;
}

export function createMissingApiKeyError(message) {
  const err = new Error(message);
  err.name = 'MissingApiKeyError';
  err.code = 'MISSING_API_KEY';
  return err;
}
