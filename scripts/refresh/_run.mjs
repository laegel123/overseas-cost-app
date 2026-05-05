#!/usr/bin/env node
/**
 * 모든 refresh/<source>.mjs fetcher 의 default export 를 호출하는 thin CLI runner.
 *
 * 왜 wrapper 인가:
 *  - 각 fetcher 가 default export 함수만 내보냄 → `node scripts/refresh/us_bls.mjs` 직접 실행 시
 *    함수가 호출되지 않음 (워크플로우 무효 결함).
 *  - fetcher 자체에 `if (import.meta.url === ...)` 진입점을 넣으면 jest (babel-preset-expo) 가
 *    `import.meta` 트랜스폼을 거부 → 테스트 import 가 깨짐. wrapper 한 곳에 격리.
 *
 * Usage:
 *   node scripts/refresh/_run.mjs <module-name> [--useStatic] [--dryRun]
 * 예:
 *   node scripts/refresh/_run.mjs us_bls
 *   node scripts/refresh/_run.mjs visas --useStatic
 *
 * 종료 코드:
 *   0 = 정상 (errors 가 있어도 부분 갱신 성공으로 간주 — fetcher 책임)
 *   1 = throw 발생 (MissingApiKeyError 등)
 */

const args = process.argv.slice(2);
const moduleName = args[0];
const useStatic = args.includes('--useStatic');
const dryRun = args.includes('--dryRun');

if (!moduleName) {
  console.error('Usage: node scripts/refresh/_run.mjs <module-name> [--useStatic] [--dryRun]');
  process.exit(1);
}

// path traversal / 잘못된 모듈명 차단 — `_outlier`, `../../etc/passwd` 등 거부.
//
// `^[a-z]` regex 가 사실상 `_` 시작 모듈을 이미 차단하므로 `startsWith('_')` 는 redundant 처럼 보인다
//. 의도적으로 두 단계 검증을 유지하는 이유: regex 가 실수로 변경되어
// `^[a-z_]` 로 완화되더라도 두 번째 조건이 라이브러리 모듈 직접 실행을 방어하는 defense-in-depth.
if (!/^[a-z][a-z0-9_]*$/.test(moduleName) || moduleName.startsWith('_')) {
  console.error(`Invalid module name: ${moduleName}`);
  process.exit(1);
}

// writeCity 를 호출하지 않는 라이브러리 모듈 — 다른 fetcher 가 import 해서 보조 자료로 사용하는
// 골조 (v1.x 에서 실제 fallback wire up 예정, eu_eurostat.mjs 헤더 참조). 워크플로우에서 단독
// 실행하면 데이터 변경 0 + 의도 불명확이라 fail-fast. integration.test.ts 가 워크플로우 yml 에서
// LIBRARY_MODULES 호출 라인이 들어오지 않는지 회귀 검증한다.
//
// **주의**: `eu_eurostat` 는 파일명에 `_` prefix 가 없어 위쪽
// path traversal 정규식 (`startsWith('_')` 차단) 으로는 통과한다 — 본 Set 이 LIBRARY_MODULES
// 호출 차단의 **유일한** 방어선이다. 이중 방어는 (a) 본 Set + (b) eu_eurostat.mjs default export
// 진입부의 `process.argv[1]` 기반 self-check + (c) integration.test.ts 의 yml 회귀 검증 3중.
//
// **신규 라이브러리 모듈 추가 시**: writeCity 를 호출하지 않고 다른 fetcher 가 import 만 하는
// 모듈을 추가했다면, (1) 본 Set 에 모듈명 추가 (2) 해당 모듈 default export 진입부에
// `process.argv[1].endsWith('_run.mjs')` self-check 추가 (3) integration.test.ts 의 yml 회귀
// 검증에 모듈명 추가 — 3 단계 모두 갱신해야 한다. 누락 시 워크플로우가 silent 하게 0 변경
// 결과를 commit 할 위험.
const LIBRARY_MODULES = new Set(['eu_eurostat']);
if (LIBRARY_MODULES.has(moduleName)) {
  console.error(`${moduleName} is a library module (no writeCity) and cannot be run directly.`);
  process.exit(1);
}

let mod;
try {
  mod = await import(`./${moduleName}.mjs`);
} catch (err) {
  console.error(`Failed to load module ${moduleName}:`, err.message);
  process.exit(1);
}

const refresh = mod.default;
if (typeof refresh !== 'function') {
  console.error(`Module ${moduleName} has no default export function`);
  process.exit(1);
}

try {
  const result = await refresh({ useStatic, dryRun });

  const source = result?.source ?? moduleName;
  const cities = result?.cities ?? [];
  const errors = result?.errors ?? [];

  console.log(`[${source}] updated ${cities.length} cities: ${cities.join(', ') || '(none)'}`);

  if (errors.length > 0) {
    // 부분 실패는 errors 에 기록되지만 종료 코드 0 — 다른 도시는 정상 갱신됐을 수 있음.
    // schema 위반은 별도 validate_cities.mjs 가 fail-fast.
    console.warn(`[${source}] ${errors.length} error(s):`);
    for (const e of errors) {
      console.warn(`  - ${e.cityId}: ${e.reason}`);
    }
  }
} catch (err) {
  console.error(`[${moduleName}] failed: ${err.message}`);
  process.exit(1);
}
