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
 * 4. data/seed/all.json 을 동일 내용으로 갱신 (앱 번들 fallback)
 * 5. atomic write (tmp → rename)
 *
 * ADR-074 (ADR-045 supersede): 시드는 실 도시 데이터 전체를 담는다.
 * 구버전은 fixture 2개 (seoul + vancouver) 로 고정돼 있어, 네트워크 실패 시 앱이
 * 21개 → 2개로 퇴행했다. 이제 본 스크립트가 all.json 과 시드를 함께 써서
 * fallback 바닥을 21개로 끌어올린다 (번들 +~50KB).
 *
 * 단, data/cities 가 비어 시드를 소스로 읽은 경우에는 시드를 다시 쓰지 않는다
 * (자기 참조 — 새로 실릴 내용이 없다).
 */

import { readFile, writeFile, readdir, mkdir, rename, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { validateCityData } from './refresh/_common.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const CITIES_DIR = join(ROOT, 'data', 'cities');
const ALL_JSON_PATH = join(ROOT, 'data', 'all.json');
// 앱 번들에 포함되는 시드. data/cities 가 비면 소스로도 읽는다 (ADR-074).
const SEED_PATH = join(ROOT, 'data', 'seed', 'all.json');

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
  // 시드를 소스로 읽은 빌드는 시드를 다시 쓰지 않는다 (자기 참조).
  const builtFromCityFiles = cityFiles.length > 0;

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

      validateCityData(parsed, id);
      cities[id] = parsed;
    }
    console.log(`Loaded ${cityFiles.length} city files from data/cities/`);
  } else {
    const seedContent = await readFile(SEED_PATH, 'utf-8');
    const seedData = JSON.parse(seedContent);

    if (!seedData.cities || typeof seedData.cities !== 'object') {
      throw new Error('Invalid seed file: missing cities object');
    }

    for (const [id, data] of Object.entries(seedData.cities)) {
      validateCityData(data, id);
      cities[id] = data;
    }
    console.log(`Loaded ${Object.keys(cities).length} cities from existing seed`);
  }

  const cityCount = Object.keys(cities).length;
  if (cityCount === 0) {
    throw new Error('No city data found');
  }
  // PRD v1.0 = 21 도시 (서울 + 20). 미만이면 불완전 배포 경고 (CI 가 fail 까지는 아님 — partial PR 허용).
  const V1_CITY_COUNT = 21;
  if (cityCount < V1_CITY_COUNT) {
    console.warn(
      `WARN: Built ${cityCount} cities, expected ${V1_CITY_COUNT} for v1.0. Incomplete data deployment.`,
    );
  }

  const now = new Date().toISOString();
  // 빌드 실행 시점 날짜 — 실제 환율 데이터 fetch 일자가 아님.
  // 클라이언트는 환율 fetch 시점은 currency.ts 의 lastSync 를 사용해야 함.
  // (필드명 호환성을 위해 유지 — v1.x 에서 builtAt 으로 rename 검토)
  const fxBaseDate = now.slice(0, 10);

  /** @type {import('../src/types/city').AllCitiesData} */
  const allData = {
    schemaVersion: 1,
    generatedAt: now,
    fxBaseDate,
    cities,
  };

  const serialized = JSON.stringify(allData, null, 2) + '\n';

  await mkdir(dirname(ALL_JSON_PATH), { recursive: true });
  await atomicWrite(ALL_JSON_PATH, serialized);
  console.log(`Written ${ALL_JSON_PATH}`);

  // ADR-074 — 시드도 같은 내용으로 갱신해 오프라인 fallback 바닥을 21개로 유지.
  if (builtFromCityFiles) {
    await mkdir(dirname(SEED_PATH), { recursive: true });
    await atomicWrite(SEED_PATH, serialized);
    console.log(`Written ${SEED_PATH} (${cityCount} cities)`);
  } else {
    console.log('Skipped seed write — built from seed itself');
  }

  console.log(`Build complete: ${cityCount} cities`);
}

/**
 * atomic write (tmp → rename).
 * @param {string} filePath
 * @param {string} content
 */
async function atomicWrite(filePath, content) {
  // 동일 디렉터리 내 tmp — cross-device rename (EXDEV) 방어 (refresh/_common.mjs writeCity 동일 패턴).
  const tmpPath = join(dirname(filePath), `.tmp-build-${randomUUID()}.json`);
  await writeFile(tmpPath, content, 'utf-8');
  await rename(tmpPath, filePath);
}

main().catch((err) => {
  console.error('Build failed:', err.message);
  process.exit(1);
});
