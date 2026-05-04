#!/usr/bin/env node
/**
 * 직전 commit (HEAD) 대비 현재 워킹트리의 도시 JSON 변동폭 검사.
 *
 * 워크플로우 흐름: refresh-*.mjs 가 워킹트리에 새 데이터 작성 → build_data.mjs →
 * validate_cities.mjs (스키마 검증) → detect_outliers.mjs (변동폭 분류) →
 * 워크플로우가 outlier / update / commit 중 하나로 분기 (AUTOMATION.md §1).
 *
 * Usage:
 *   node scripts/detect_outliers.mjs
 *
 * 출력:
 *   - 분류 요약 (commit / pr-update / pr-outlier 카운트)
 *   - process.env.GITHUB_OUTPUT 가 설정된 경우:
 *       HAS_OUTLIERS=true|false  (≥30% 변동 1건 이상)
 *       HAS_UPDATES=true|false   (5~30% 변동 1건 이상, outlier 와 별개로 집계)
 *
 * 종료 코드: 항상 0 (변동폭 자체는 에러가 아님 — schema 위반은 validate_cities.mjs 책임).
 */

import { execSync } from 'node:child_process';
import { readFile, readdir, appendFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { classifyChange, iterNumericFields } from './refresh/_outlier.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CITIES_DIR = join(ROOT, 'data', 'cities');

async function main() {
  const files = await readdir(CITIES_DIR);
  const jsonFiles = files.filter((f) => f.endsWith('.json'));

  const outliers = [];
  let updates = 0;
  let commits = 0;
  let news = 0;

  for (const file of jsonFiles) {
    const cityId = file.replace('.json', '');
    // defense-in-depth: readdir 결과를 git show 인자로 그대로 넣지 않음 — 악의적 파일명에 의한
    // command injection 방어. getCityPath 와 동일한 검증 형식.
    if (!/^[a-z][a-z0-9-]*$/.test(cityId)) {
      console.warn(`[detect_outliers] skipping invalid filename: ${file}`);
      continue;
    }
    const newData = await readJson(join(CITIES_DIR, file));
    const oldData = readGitHead(`data/cities/${file}`);

    if (!oldData) {
      news += 1;
      continue;
    }

    for (const { path, oldVal, newVal } of iterNumericFields(oldData, newData)) {
      const change = classifyChange(oldVal, newVal);
      if (change === 'pr-outlier') {
        outliers.push({ cityId, field: path, oldValue: oldVal, newValue: newVal });
      } else if (change === 'pr-update' || change === 'pr-removed') {
        updates += 1;
      } else if (change === 'commit') {
        commits += 1;
      } else if (change === 'new') {
        news += 1;
      }
    }
  }

  console.log(`Outlier detection summary:`);
  console.log(`  Cities scanned: ${jsonFiles.length}`);
  console.log(`  commit (변동 <5%): ${commits}`);
  console.log(`  pr-update (5~30%): ${updates}`);
  console.log(`  pr-outlier (≥30%): ${outliers.length}`);
  console.log(`  new / removed: ${news}`);

  if (outliers.length > 0) {
    console.log(`\nOutliers (≥30%):`);
    for (const o of outliers) {
      console.log(`  ${o.cityId}.${o.field}: ${o.oldValue} → ${o.newValue}`);
    }
  }

  const hasOutliers = outliers.length > 0;
  const hasUpdates = updates > 0;
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    await appendFile(
      githubOutput,
      `HAS_OUTLIERS=${hasOutliers ? 'true' : 'false'}\nHAS_UPDATES=${hasUpdates ? 'true' : 'false'}\n`,
    );
  }
}

async function readJson(filePath) {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * `git show HEAD:<path>` 로 이전 commit 의 파일 내용 조회. 부재 시 null.
 * @param {string} repoPath
 * @returns {Object | null}
 */
function readGitHead(repoPath) {
  try {
    const content = execSync(`git show HEAD:${repoPath}`, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf-8',
    });
    return JSON.parse(content);
  } catch {
    return null;
  }
}

main().catch((err) => {
  console.error('detect_outliers failed:', err.message);
  process.exit(1);
});
