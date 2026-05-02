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
 * @param {string} url
 * @param {{maxRetries?: number, timeoutMs?: number, signal?: AbortSignal}} [opts]
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, opts = {}) {
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const signal = opts.signal
        ? combineSignals(opts.signal, controller.signal)
        : controller.signal;

      const response = await fetch(url, { signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        return response;
      }

      if (response.status >= 400 && response.status < 500) {
        throw createFetchRetryExhaustedError(
          `HTTP ${response.status} (client error, no retry)`,
          attempt,
        );
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      clearTimeout(timeoutId);

      if (err?.name === 'AbortError') {
        if (opts.signal?.aborted) {
          throw createFetchTimeoutError('request aborted by caller');
        }
        throw createFetchTimeoutError(`request timed out after ${timeoutMs}ms`);
      }

      if (err?.code === 'FETCH_RETRY_EXHAUSTED' || err?.code === 'FETCH_TIMEOUT') {
        throw err;
      }

      lastError = err;
    }

    if (attempt < maxRetries) {
      const backoffMs = BACKOFF_BASE_MS * Math.pow(2, attempt);
      await sleep(backoffMs);
    }
  }

  throw createFetchRetryExhaustedError(
    `fetch failed after ${maxRetries + 1} attempts: ${lastError?.message ?? 'unknown error'}`,
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
function validateCityData(data, ctxId) {
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

  if (typeof obj.name !== 'object' || obj.name === null) {
    throw createCitySchemaError(`${ctxId}.name: missing or invalid`);
  }
  if (typeof obj.name.ko !== 'string' || typeof obj.name.en !== 'string') {
    throw createCitySchemaError(`${ctxId}.name: ko and en required`);
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

function combineSignals(signal1, signal2) {
  const controller = new AbortController();
  const abort = () => controller.abort();

  if (signal1.aborted || signal2.aborted) {
    controller.abort();
    return controller.signal;
  }

  signal1.addEventListener('abort', abort);
  signal2.addEventListener('abort', abort);

  return controller.signal;
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
