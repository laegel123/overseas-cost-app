#!/usr/bin/env node
/**
 * 도시 JSON 파일 빌드 — data/cities/*.json → data/all.json
 *
 * Usage:
 *   node scripts/build_data.mjs
 *
 * 1. data/cities/*.json 21개 수집 (없으면 시드 fallback)
 * 2. 각 파일 스키마 검증
 * 3. data/all.json 생성 (원본 — GitHub raw 로 배포되어 앱이 fetch)
 * 4. atomic write (tmp → rename)
 *
 * ADR-045: data/seed/all.json 은 fixture-based 로 유지 — 본 스크립트가 덮어쓰지 않는다.
 * 시드는 schema-pass fixture (seoul + vancouver) 만 포함하며 앱 번들에 포함되어
 * 첫 콜드스타트 + 오프라인 fallback 으로 사용. 실 데이터는 fetch 로 덮어씀.
 */

import { readFile, writeFile, readdir, mkdir, rename, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const CITIES_DIR = join(ROOT, 'data', 'cities');
const ALL_JSON_PATH = join(ROOT, 'data', 'all.json');
// data/cities 가 비었을 때만 fallback 으로 읽는 fixture seed (ADR-045).
const FALLBACK_SEED_PATH = join(ROOT, 'data', 'seed', 'all.json');

async function main() {
  console.log('Building data files...');

  let cityFiles;
  try {
    const files = await readdir(CITIES_DIR);
    cityFiles = files.filter((f) => f.endsWith('.json'));
  } catch (err) {
    if (err?.code === 'ENOENT') {
      console.log('No cities directory found, using existing seed as source');
      cityFiles = [];
    } else {
      throw err;
    }
  }

  /** @type {Record<string, unknown>} */
  const cities = {};

  if (cityFiles.length > 0) {
    for (const file of cityFiles) {
      const id = file.replace('.json', '');
      const filePath = join(CITIES_DIR, file);
      const content = await readFile(filePath, 'utf-8');

      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (err) {
        throw new Error(`Invalid JSON in ${file}: ${err.message}`);
      }

      validateCity(parsed, id);
      cities[id] = parsed;
    }
    console.log(`Loaded ${cityFiles.length} city files from data/cities/`);
  } else {
    const seedContent = await readFile(FALLBACK_SEED_PATH, 'utf-8');
    const seedData = JSON.parse(seedContent);

    if (!seedData.cities || typeof seedData.cities !== 'object') {
      throw new Error('Invalid seed file: missing cities object');
    }

    for (const [id, data] of Object.entries(seedData.cities)) {
      validateCity(data, id);
      cities[id] = data;
    }
    console.log(`Loaded ${Object.keys(cities).length} cities from existing seed`);
  }

  const cityCount = Object.keys(cities).length;
  if (cityCount === 0) {
    throw new Error('No city data found');
  }

  const now = new Date().toISOString();
  const fxBaseDate = now.slice(0, 10);

  /** @type {import('../src/types/city').AllCitiesData} */
  const allData = {
    schemaVersion: 1,
    generatedAt: now,
    fxBaseDate,
    cities,
  };

  await mkdir(dirname(ALL_JSON_PATH), { recursive: true });
  await atomicWrite(ALL_JSON_PATH, JSON.stringify(allData, null, 2) + '\n');
  console.log(`Written ${ALL_JSON_PATH}`);

  // ADR-045 — seed 는 덮어쓰지 않음. fixture-based 유지.

  console.log(`Build complete: ${cityCount} cities`);
}

/**
 * atomic write (tmp → rename).
 * @param {string} filePath
 * @param {string} content
 */
async function atomicWrite(filePath, content) {
  const tmpPath = join(tmpdir(), `build-${randomUUID()}.json`);
  await writeFile(tmpPath, content, 'utf-8');
  await rename(tmpPath, filePath);
}

/**
 * 간이 스키마 검증.
 * @param {unknown} data
 * @param {string} id
 */
function validateCity(data, id) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error(`${id}: city data must be an object`);
  }

  const obj = data;

  const requiredStrings = ['id', 'country', 'currency', 'region', 'lastUpdated'];
  for (const key of requiredStrings) {
    if (typeof obj[key] !== 'string' || obj[key].length === 0) {
      throw new Error(`${id}.${key}: missing or invalid`);
    }
  }

  if (typeof obj.name !== 'object' || obj.name === null) {
    throw new Error(`${id}.name: missing or invalid`);
  }
  if (typeof obj.name.ko !== 'string' || typeof obj.name.en !== 'string') {
    throw new Error(`${id}.name: ko and en required`);
  }

  for (const section of ['rent', 'food', 'transport']) {
    if (typeof obj[section] !== 'object' || obj[section] === null) {
      throw new Error(`${id}.${section}: missing or invalid`);
    }
  }

  if (!Array.isArray(obj.sources) || obj.sources.length === 0) {
    throw new Error(`${id}.sources: must be non-empty array`);
  }

  if (obj.id !== id) {
    throw new Error(`${id}: id field mismatch (expected "${id}", got "${obj.id}")`);
  }
}

main().catch((err) => {
  console.error('Build failed:', err.message);
  process.exit(1);
});
