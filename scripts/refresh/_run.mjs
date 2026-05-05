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
if (!/^[a-z][a-z0-9_]*$/.test(moduleName) || moduleName.startsWith('_')) {
  console.error(`Invalid module name: ${moduleName}`);
  process.exit(1);
}

// writeCity 를 호출하지 않는 라이브러리 모듈 — 다른 fetcher 가 import 해서 보조 자료로 사용하는
// 골조 (v1.x 에서 실제 fallback wire up 예정, eu_eurostat.mjs 헤더 참조). 워크플로우에서 단독
// 실행하면 데이터 변경 0 + 의도 불명확이라 fail-fast. integration.test.ts 가 워크플로우 yml 에서
// LIBRARY_MODULES 호출 라인이 들어오지 않는지 회귀 검증한다. 파일명도 `_` prefix 라 path
// traversal 정규식으로 1차 차단되지만 의미적 의도 명시 차원에서 본 set 도 유지.
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
