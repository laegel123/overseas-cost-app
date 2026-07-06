#!/usr/bin/env node
/**
 * maestro 계층 인스펙터 — 현재 시뮬레이터 화면의 UI 계층을 쿼리로 필터해 출력한다.
 *
 * 왜 필요한가: flow 디버깅 중 "testID 가 뭔가", "이 텍스트가 접근성에 노출되나",
 *   "화면 밖(스크롤 아래)인가"를 반복 확인하게 된다. 매번 `maestro hierarchy | python -c ...`
 *   를 타이핑하는 대신 상시 도구로 만든다.
 *
 * 사용:
 *   node scripts/e2e/inspect.mjs                 # rid/text 있는 모든 노드
 *   node scripts/e2e/inspect.mjs home-search     # rid·acc·text 에 부분일치
 *   node scripts/e2e/inspect.mjs 밴쿠버 --onscreen  # 화면 안 노드만
 *   node scripts/e2e/inspect.mjs --all           # 빈 노드까지 전부
 *   node scripts/e2e/inspect.mjs sheet --json     # 필터 결과 JSON (에이전트용)
 *
 * 주의: 앱이 원하는 화면 상태일 때 실행한다 (별도 launchApp 하지 않음 = 현재 상태 스냅샷).
 */

import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const query = args.filter((a) => !a.startsWith('--'))[0]?.toLowerCase() ?? null;
const onscreenOnly = flags.has('--onscreen');
const includeEmpty = flags.has('--all');
const asJson = flags.has('--json');

function parseBounds(b) {
  const m = /\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/.exec(b || '');
  if (!m) return null;
  const [, x1, y1, x2, y2] = m.map(Number);
  return { x1, y1, x2, y2 };
}

function getHierarchy() {
  let out;
  try {
    out = execFileSync('maestro', ['hierarchy'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (e) {
    console.error('maestro hierarchy 실행 실패 — 시뮬레이터/앱이 떠 있는지 확인하세요.');
    console.error(e.stderr?.toString?.() || e.message);
    process.exit(1);
  }
  const start = out.indexOf('{');
  if (start < 0) {
    console.error('계층 JSON 을 찾지 못했습니다.');
    process.exit(1);
  }
  return JSON.parse(out.slice(start));
}

const tree = getHierarchy();
const rootBounds = parseBounds(tree?.attributes?.bounds) ?? { x1: 0, y1: 0, x2: 402, y2: 874 };
const screenW = rootBounds.x2 || 402;
const screenH = rootBounds.y2 || 874;

const matches = [];

function isOnScreen(b) {
  if (!b) return false;
  return b.x1 < screenW && b.x2 > 0 && b.y1 < screenH && b.y2 > 0 && b.x2 > b.x1 && b.y2 > b.y1;
}

function walk(node) {
  const a = node.attributes || {};
  const rid = a['resource-id'] || '';
  const acc = a.accessibilityText || '';
  const text = a.text || '';
  const bounds = parseBounds(a.bounds);

  const hasContent = rid || acc || text;
  const passesEmpty = includeEmpty || hasContent;
  const passesQuery =
    !query || `${rid}\n${acc}\n${text}`.toLowerCase().includes(query);
  const passesScreen = !onscreenOnly || isOnScreen(bounds);

  if (passesEmpty && passesQuery && passesScreen) {
    matches.push({ rid, acc, text, bounds: a.bounds || '', onScreen: isOnScreen(bounds) });
  }
  for (const c of node.children || []) walk(c);
}

walk(tree);

if (asJson) {
  console.log(JSON.stringify(matches, null, 2));
  process.exit(0);
}

if (matches.length === 0) {
  console.log(query ? `일치 노드 없음: "${query}"` : '노드 없음');
  process.exit(0);
}

console.log(`화면 ${screenW}x${screenH} · ${matches.length}개 노드${query ? ` (필터: "${query}")` : ''}\n`);
for (const m of matches) {
  const off = m.onScreen ? '' : '  ⬇︎화면밖';
  const parts = [];
  if (m.rid) parts.push(`id=${m.rid}`);
  if (m.acc) parts.push(`acc=${JSON.stringify(m.acc)}`);
  if (m.text) parts.push(`text=${JSON.stringify(m.text)}`);
  console.log(`${parts.join('  ')}  ${m.bounds}${off}`);
}
