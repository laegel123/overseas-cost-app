/**
 * `scripts/gen_privacy_docs.mjs` — 생성물 드리프트 가드 (TESTING.md §9-A.11).
 *
 * 개인정보 처리방침 본문의 단일 출처는 `src/lib/privacyPolicy.json` 이고 (ADR-072),
 * `docs/privacy-policy.html` (스토어 등록 URL) / `docs/PRIVACY.md` 는 생성물이다.
 * 본 테스트가 "정본에서 만든 결과 = 커밋된 파일" 을 CI 에서 강제해, 생성물을 손으로
 * 고치거나 정본만 고치고 재생성을 잊는 drift 를 차단한다.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PRIVACY_POLICY } from '@/lib/privacyPolicy';
import type { PrivacyPolicy } from '@/lib/privacyPolicy';

import { renderHtml, renderMarkdown } from '../gen_privacy_docs.mjs';

const ROOT = join(__dirname, '..', '..');

const REGEN_HINT =
  '생성물이 정본(src/lib/privacyPolicy.json)과 다릅니다. ' +
  '생성물을 직접 편집하지 말고 `npm run gen:privacy` 를 실행해 재생성하세요 (ADR-072).';

// 불일치 시 jest 의 diff 를 살리면서 재생성 안내를 앞에 붙인다.
function expectMatchesCommitted(generated: string, relPath: string): void {
  const committed = readFileSync(join(ROOT, relPath), 'utf8');
  try {
    expect(generated).toBe(committed);
  } catch (err) {
    throw new Error(`${REGEN_HINT}\n대상: ${relPath}\n\n${(err as Error).message}`);
  }
}

// 렌더 규칙 검증용 최소 fixture — 정본이 바뀌어도 흔들리지 않는다.
const FIXTURE: PrivacyPolicy = {
  appName: '테스트앱',
  lead: '수집하지 않습니다.',
  operatorEmail: 'a@b.com',
  updatedAt: '2026-01-02',
  sections: [
    { title: '첫 섹션', blocks: [{ kind: 'paragraph', text: '문단입니다.' }] },
    { title: '둘째 섹션', blocks: [{ kind: 'list', items: ['항목 1', '항목 2'] }] },
    { title: '셋째 섹션', blocks: [{ kind: 'email', label: '운영자', email: 'a@b.com' }] },
  ],
};

describe('생성물 드리프트 가드', () => {
  it('renderHtml(PRIVACY_POLICY) 가 docs/privacy-policy.html 과 정확히 일치한다', () => {
    expectMatchesCommitted(renderHtml(PRIVACY_POLICY), 'docs/privacy-policy.html');
  });

  it('renderMarkdown(PRIVACY_POLICY) 가 docs/PRIVACY.md 와 정확히 일치한다', () => {
    expectMatchesCommitted(renderMarkdown(PRIVACY_POLICY), 'docs/PRIVACY.md');
  });

  it('불일치 시 재생성 안내가 실패 메시지에 담긴다', () => {
    expect(() => expectMatchesCommitted('바뀐 내용', 'docs/PRIVACY.md')).toThrow(
      /npm run gen:privacy/,
    );
  });
});

describe('renderHtml', () => {
  it('섹션 번호를 1부터 순서대로 붙인다 (title 은 번호를 갖지 않는다)', () => {
    const html: string = renderHtml(FIXTURE);

    expect(html).toContain('<h2>1. 첫 섹션</h2>');
    expect(html).toContain('<h2>2. 둘째 섹션</h2>');
    expect(html).toContain('<h2>3. 셋째 섹션</h2>');
  });

  it('email 블록을 mailto: 링크로 렌더한다', () => {
    expect(renderHtml(FIXTURE)).toContain(
      '<p>운영자: <a href="mailto:a@b.com">a@b.com</a></p>',
    );
  });

  it('paragraph 는 <p>, list 는 <ul><li> 로 렌더한다', () => {
    const html: string = renderHtml(FIXTURE);

    expect(html).toContain('<p>문단입니다.</p>');
    expect(html).toContain('<li>항목 1</li>');
    expect(html).toContain('<li>항목 2</li>');
  });

  it('생성물 표시와 갱신일을 담고 개행 하나로 끝난다', () => {
    const html: string = renderHtml(FIXTURE);

    expect(html).toContain('npm run gen:privacy');
    expect(html).toContain('마지막 갱신: 2026-01-02');
    expect(html.endsWith('</html>\n')).toBe(true);
  });

  it('배포된 <style> 블록을 그대로 유지한다 (리디자인 금지)', () => {
    const html: string = renderHtml(FIXTURE);

    expect(html).toContain('--accent: #fc6011;');
    expect(html).toContain('max-width: 720px;');
  });
});

describe('renderMarkdown', () => {
  it('섹션 번호를 1부터 순서대로 붙인다', () => {
    const md: string = renderMarkdown(FIXTURE);

    expect(md).toContain('## 1. 첫 섹션');
    expect(md).toContain('## 2. 둘째 섹션');
    expect(md).toContain('## 3. 셋째 섹션');
  });

  it('email 블록을 마크다운 mailto 링크로 렌더한다', () => {
    expect(renderMarkdown(FIXTURE)).toContain('운영자: [a@b.com](mailto:a@b.com)');
  });

  it('생성물 표시와 갱신일을 담고 개행 하나로 끝난다', () => {
    const md: string = renderMarkdown(FIXTURE);

    expect(md).toContain('npm run gen:privacy');
    expect(md).toContain('마지막 갱신: 2026-01-02');
    expect(md.endsWith('마지막 갱신: 2026-01-02\n')).toBe(true);
  });
});
