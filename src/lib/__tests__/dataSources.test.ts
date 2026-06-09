/**
 * `src/lib/dataSources.ts` — DATA_SOURCES_COUNT 드리프트 가드 (TESTING.md §9.33).
 *
 * 출처 유형 총수는 `docs/DATA_SOURCES.md` 의 머신 마커 `<!-- DATA_SOURCES_COUNT: N -->`
 * 가 단일 출처 (ADR-065). 본 테스트가 마커 ↔ 상수 동기화를 CI 에서 강제해, 한쪽만
 * 갱신하는 silent drift 를 차단한다 (이전엔 settings.tsx 하드코딩 수동 동기화).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DATA_SOURCES_COUNT } from '@/lib/dataSources';

const MARKER_RE = /<!--\s*DATA_SOURCES_COUNT:\s*(\d+)\s*-->/;

// 마커에서 카운트 추출. 부재 시 명시적 throw — silent fail 금지 (CLAUDE.md CRITICAL).
function parseMarkerCount(markdown: string): number {
  const match = markdown.match(MARKER_RE);
  if (match === null) {
    throw new Error(
      'docs/DATA_SOURCES.md 에서 <!-- DATA_SOURCES_COUNT: N --> 마커를 찾지 못했습니다',
    );
  }
  return Number(match[1]);
}

describe('DATA_SOURCES_COUNT (출처 유형 총수)', () => {
  it('양의 정수다', () => {
    expect(Number.isInteger(DATA_SOURCES_COUNT)).toBe(true);
    expect(DATA_SOURCES_COUNT).toBeGreaterThan(0);
  });

  it('docs/DATA_SOURCES.md 마커와 동기화되어 있다 (드리프트 가드)', () => {
    const docPath = join(__dirname, '..', '..', '..', 'docs', 'DATA_SOURCES.md');
    const markdown = readFileSync(docPath, 'utf8');
    const docCount = parseMarkerCount(markdown);

    // 불일치 시: docs/DATA_SOURCES.md 마커와 src/lib/dataSources.ts 의 상수를 맞출 것.
    expect(DATA_SOURCES_COUNT).toBe(docCount);
  });

  it('마커가 없으면 throw 한다 (silent fail 금지)', () => {
    expect(() => parseMarkerCount('# 마커 없는 문서')).toThrow(/DATA_SOURCES_COUNT/);
  });
});
