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
 *       HAS_NEW=true|false       (`classifyChange` 가 'new' 를 반환한 항목 1건 이상 — 검토 없이 main 직접 push 차단)
 *                                 - HEAD 에 없던 신규 도시 JSON 의 모든 numeric 필드, 그리고
 *                                 - 기존 도시의 placeholder(0 또는 null) 필드가 처음 실제 값으로 채워지는 경우
 *                                 (createCitySeed 가 placeholder 0 으로 도시 파일을 만든 뒤 fetcher 가 후속 갱신하는 패턴 보호)
 *
 * 종료 코드: 항상 0 (변동폭 자체는 에러가 아님 — schema 위반은 validate_cities.mjs 책임).
 */

import { execFileSync } from 'node:child_process';
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
  // 두 카운터 분리 — `news` 가 단일 변수일 때 신규 도시 파일 (파일 단위 +1) 과 기존 도시의
  // placeholder(0)→실제값 첫 갱신 (필드 단위 +n) 이 합산돼 로그 출력 단위가 혼란스러웠음
  // (PR #20 review round 14). HAS_NEW 의 boolean 결과는 둘 중 하나만 0 보다 크면 true 로 동일.
  let newFiles = 0;
  let newFields = 0;

  for (const file of jsonFiles) {
    const cityId = file.replace('.json', '');
    // defense-in-depth: readdir 결과를 git show 인자로 그대로 넣지 않음 — 악의적 파일명에 의한
    // command injection 방어. getCityPath 와 동일한 검증 형식.
    if (!/^[a-z][a-z0-9-]*$/.test(cityId)) {
      console.warn(`[detect_outliers] skipping invalid filename: ${file}`);
      continue;
    }
    // 단일 파일 JSON 파싱 실패 시 graceful skip — 깨진 파일 1개로 전체 outlier 감지 중단되지
    // 않도록 (PR #20 review round 15). 스키마 위반은 validate_cities.mjs 가 fail-fast 책임.
    let newData;
    try {
      newData = await readJson(join(CITIES_DIR, file));
    } catch (err) {
      console.warn(`[detect_outliers] ${file} JSON parse failed: ${err?.message ?? 'unknown'} — skipping outlier detection for this file`);
      continue;
    }
    const oldData = readGitHead(`data/cities/${file}`);

    if (!oldData) {
      newFiles += 1;
      continue;
    }

    for (const { path, oldVal, newVal } of iterNumericFields(oldData, newData)) {
      const change = classifyChange(oldVal, newVal);
      if (change === 'pr-outlier') {
        outliers.push({ cityId, field: path, oldValue: oldVal, newValue: newVal });
      } else if (change === 'pr-update' || change === 'pr-removed') {
        // pr-removed (값이 null 로 사라짐) 도 HAS_UPDATES 에 포함 — 값 소실은 5~30% 변동보다
        // 잠재적으로 더 심각한 신호이나 v1.0 에서는 outlier 한 단계 낮춰 auto-update PR 로 처리.
        // 핵심 의도: 직접 commit 차단 + 운영자 검토 강제 (silent data loss 방지). v1.x 별도 분기
        // (`HAS_REMOVED`) 도입 시 본 OR 조건 분리 (PR #20 review round 12).
        updates += 1;
      } else if (change === 'commit') {
        commits += 1;
      } else if (change === 'new') {
        newFields += 1;
      }
    }
  }

  console.log(`Outlier detection summary:`);
  console.log(`  Cities scanned: ${jsonFiles.length}`);
  console.log(`  commit (변동 <5%): ${commits}`);
  console.log(`  pr-update (5~30%): ${updates}`);
  console.log(`  pr-outlier (≥30%): ${outliers.length}`);
  console.log(`  new files (HEAD 미존재 도시): ${newFiles}`);
  console.log(`  new fields (placeholder→실제값 첫 갱신): ${newFields}`);

  if (outliers.length > 0) {
    console.log(`\nOutliers (≥30%):`);
    for (const o of outliers) {
      console.log(`  ${o.cityId}.${o.field}: ${o.oldValue} → ${o.newValue}`);
    }
  }

  const hasOutliers = outliers.length > 0;
  const hasUpdates = updates > 0;
  const hasNew = newFiles > 0 || newFields > 0;
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    await appendFile(
      githubOutput,
      [
        `HAS_OUTLIERS=${hasOutliers ? 'true' : 'false'}`,
        `HAS_UPDATES=${hasUpdates ? 'true' : 'false'}`,
        `HAS_NEW=${hasNew ? 'true' : 'false'}`,
        '',
      ].join('\n'),
    );
  }
}

async function readJson(filePath) {
  const content = await readFile(filePath, 'utf-8');
  try {
    return JSON.parse(content);
  } catch (err) {
    // 어느 파일에서 파싱 실패했는지 로그에 남김 — main().catch 가 잡으면 컨텍스트 없이는 진단 어려움.
    throw new Error(`Failed to parse JSON from ${filePath}: ${err.message}`);
  }
}

/**
 * `git show HEAD:<path>` 로 이전 commit 의 파일 내용 조회. 부재 시 null.
 *
 * `execFileSync` 사용 — 셸 우회로 command injection 방어 (defense-in-depth, repoPath 검증과 이중).
 *
 * **shallow clone 호환 (PR #20 review round 15)**: GitHub Actions 의 `actions/checkout` 기본
 * `fetch-depth: 1` 은 HEAD commit 만 가져오는데, `git show HEAD:<path>` 는 HEAD 만 필요하므로
 * shallow clone 에서도 정상 동작한다. 만약 미래에 분기 비교 (예: HEAD~1) 가 필요해지면
 * checkout step 의 `fetch-depth` 를 0 또는 필요한 수치로 늘려야 한다.
 *
 * @param {string} repoPath
 * @returns {Object | null}
 */
function readGitHead(repoPath) {
  let content;
  try {
    content = execFileSync('git', ['show', `HEAD:${repoPath}`], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf-8',
    });
  } catch {
    // HEAD 에 파일이 없는 경우 (신규 도시) — 정상.
    return null;
  }
  try {
    return JSON.parse(content);
  } catch (err) {
    // git show 는 성공했으나 JSON 이 깨진 경우 — silent skip 하면 outlier 감지가 누락되므로 경고.
    console.warn(`[detect_outliers] HEAD ${repoPath} JSON parse failed: ${err.message}`);
    return null;
  }
}

main().catch((err) => {
  console.error('detect_outliers failed:', err.message);
  process.exit(1);
});
