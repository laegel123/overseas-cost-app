#!/usr/bin/env node
/**
 * E2E 프리플라이트 게이트 — maestro 배치 실행 전 환경을 검증한다.
 *
 * 왜 필요한가 (ADR-066 검증 세션 회고):
 *   dev build 는 JS 를 Metro 에서 로드한다. 세션 중 Metro 가 죽으면 앱이
 *   "No script URL provided" red-box 로 뜨고, 이후 모든 flow 가 "onboarding-screen
 *   안 보임" 같은 엉뚱한 실패로 연쇄 붕괴한다. lsof(포트 점유)는 죽은 프로세스의
 *   잔여 항목/IPv6 바인딩 때문에 신뢰할 수 없다 — 반드시 실제 응답으로 확인한다.
 *
 * 검사 항목 (모두 하드 게이트):
 *   1. 부팅된 iOS 시뮬레이터 존재
 *   2. 앱(번들 ID) 설치됨
 *   3. Metro 응답 (curl 이 아니라 fetch /status == 'packager-status:running')
 *
 * 사용:  node scripts/e2e/preflight.mjs      (npm run e2e:check)
 *        e2e / e2e:smoke 의 pre-script 로 자동 실행됨.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const METRO_URL = process.env.RCT_METRO_URL ?? 'http://localhost:8081';

function readBundleId() {
  const app = JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8'));
  const id = app?.expo?.ios?.bundleIdentifier;
  if (!id) throw new Error('app.json 에서 expo.ios.bundleIdentifier 를 찾지 못했습니다');
  return id;
}

function sh(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** 1) 부팅된 시뮬레이터 */
function checkSimulator() {
  try {
    const out = sh('xcrun', ['simctl', 'list', 'devices', 'booted']);
    if (!/\(Booted\)/.test(out)) {
      return { ok: false, msg: '부팅된 시뮬레이터 없음', hint: 'Simulator.app 실행 또는 `xcrun simctl boot "iPhone 17 Pro"`' };
    }
    const name = (out.match(/^\s*(.+?)\s+\([0-9A-F-]+\)\s+\(Booted\)/m) || [])[1] ?? '?';
    return { ok: true, msg: `시뮬레이터 부팅됨 (${name})` };
  } catch (e) {
    return { ok: false, msg: 'xcrun simctl 실패', hint: 'Xcode / command line tools 설치 확인', detail: e.message };
  }
}

/** 2) 앱 설치 여부 — get_app_container 는 미설치 시 non-zero */
function checkAppInstalled(bundleId) {
  try {
    sh('xcrun', ['simctl', 'get_app_container', 'booted', bundleId, 'app']);
    return { ok: true, msg: `앱 설치됨 (${bundleId})` };
  } catch {
    return {
      ok: false,
      msg: `앱 미설치 (${bundleId})`,
      hint: 'npx expo run:ios --device "iPhone 17 Pro"  (최초 1회 dev build)',
    };
  }
}

/** 3) Metro 실제 응답 — lsof 아님 */
async function checkMetro() {
  try {
    const res = await fetch(`${METRO_URL}/status`, { signal: AbortSignal.timeout(3000) });
    const body = (await res.text()).trim();
    if (res.ok && body.includes('packager-status:running')) {
      return { ok: true, msg: `Metro 응답 정상 (${METRO_URL})` };
    }
    return { ok: false, msg: `Metro 비정상 응답 (${res.status} "${body.slice(0, 40)}")`, hint: 'npm run dev 재시작' };
  } catch (e) {
    return {
      ok: false,
      msg: `Metro 무응답 (${METRO_URL})`,
      hint: '별도 터미널에서 `npm run dev` 실행 후 재시도',
      detail: e.name === 'TimeoutError' ? 'timeout' : e.message,
    };
  }
}

async function main() {
  const bundleId = readBundleId();
  const checks = [checkSimulator(), checkAppInstalled(bundleId), await checkMetro()];

  let failed = false;
  for (const c of checks) {
    if (c.ok) {
      console.log(`  ✅ ${c.msg}`);
    } else {
      failed = true;
      console.error(`  ❌ ${c.msg}`);
      if (c.detail) console.error(`     ↳ ${c.detail}`);
      if (c.hint) console.error(`     → 조치: ${c.hint}`);
    }
  }

  if (failed) {
    console.error('\n⛔ 프리플라이트 실패 — 위 항목을 조치한 뒤 다시 실행하세요.');
    process.exit(1);
  }
  console.log('\n✈️  프리플라이트 통과 — maestro 실행 가능.');
}

main().catch((e) => {
  console.error('프리플라이트 오류:', e.message);
  process.exit(1);
});
