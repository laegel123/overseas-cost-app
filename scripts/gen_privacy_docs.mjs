#!/usr/bin/env node
/**
 * 개인정보 처리방침 문서 생성 — src/lib/privacyPolicy.json → docs/privacy-policy.html + docs/PRIVACY.md
 *
 * Usage:
 *   npm run gen:privacy        (= node scripts/gen_privacy_docs.mjs, 레포 루트에서 실행)
 *
 * 본문 정본은 `src/lib/privacyPolicy.json` 하나다 (ADR-072). 두 문서는 생성물이며 손으로
 * 편집하지 않는다 — `scripts/__tests__/gen_privacy_docs.test.ts` 가 "생성 결과 = 커밋된 파일"
 * 을 CI 에서 강제하므로 직접 편집하면 빌드가 red 가 된다.
 *
 * `docs/privacy-policy.html` 은 GitHub Pages 로 호스팅되어 Play Store 에 등록된 URL
 * (`https://laegel123.github.io/overseas-cost-app/privacy-policy.html`) 이다 — 파일 경로와
 * `<style>` 블록은 바꾸지 않는다.
 *
 * 제약:
 *   - `renderHtml` / `renderMarkdown` 은 파일 시스템을 건드리지 않는 순수 함수 (드리프트 테스트가 재사용).
 *   - `import.meta.url` 미사용 — babel-preset-expo 가 트랜스폼하지 않아 jest import 가 깨진다
 *     (`scripts/refresh/_run.mjs` 주석과 동일 제약). 경로는 레포 루트(cwd) 기준 상대 경로.
 */

import { readFile, writeFile } from 'node:fs/promises';

const POLICY_JSON_PATH = 'src/lib/privacyPolicy.json';
const HTML_PATH = 'docs/privacy-policy.html';
const MD_PATH = 'docs/PRIVACY.md';

// 생성물임을 사람이 파일을 열자마자 알도록 상단에 박는다 (직접 편집 사고 방지).
const GENERATED_NOTE = [
  '이 파일은 생성물입니다. 직접 편집하지 마세요.',
  '본문 정본: src/lib/privacyPolicy.json (+ src/lib/privacyPolicy.ts)',
  '재생성: npm run gen:privacy   (ADR-072)',
];

// 이미 배포된 페이지의 스타일 — 리디자인 금지 (ADR-072). 본문만 정본에서 생성한다.
const HTML_STYLE = `    :root {
      --bg: #ffffff;
      --fg: #14202b;
      --muted: #6b7a83;
      --accent: #fc6011;
      --rule: #e4ecf2;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Apple SD Gothic Neo",
                   "Noto Sans KR", "Segoe UI", Roboto, sans-serif;
      color: var(--fg);
      background: var(--bg);
      line-height: 1.7;
      -webkit-font-smoothing: antialiased;
    }
    main {
      max-width: 720px;
      margin: 0 auto;
      padding: 48px 24px 96px;
    }
    header {
      border-bottom: 1px solid var(--rule);
      padding-bottom: 24px;
      margin-bottom: 32px;
    }
    h1 {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.01em;
      margin: 0 0 8px;
    }
    .subtitle {
      color: var(--muted);
      font-size: 14px;
      margin: 0;
    }
    h2 {
      font-size: 18px;
      font-weight: 700;
      margin: 40px 0 12px;
      letter-spacing: -0.005em;
    }
    p, li { font-size: 16px; }
    ul {
      padding-left: 20px;
      margin: 8px 0 16px;
    }
    li { margin: 6px 0; }
    .lead {
      font-size: 17px;
      font-weight: 600;
      background: #fff4ed;
      border-left: 3px solid var(--accent);
      padding: 16px 18px;
      border-radius: 0 8px 8px 0;
      margin: 0 0 24px;
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    footer {
      margin-top: 64px;
      padding-top: 24px;
      border-top: 1px solid var(--rule);
      color: var(--muted);
      font-size: 13px;
    }
    code {
      background: #f0f5f9;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 14px;
    }`;

/**
 * 텍스트를 HTML 에 넣기 전 escape. 정본은 마크업 없는 평문이다.
 *
 * `"` 까지 escape 하는 이유: 이 함수는 요소 내용뿐 아니라 큰따옴표 속성값
 * (`content="…"`, `href="mailto:…"`) 안에서도 재사용된다. `"` 를 남겨두면
 * 정본에 인용부호가 들어오는 순간 속성이 조기 종료돼 마크업이 깨진다.
 *
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 블록 하나를 HTML 로. `<main>` 안쪽 들여쓰기(4칸) 기준.
 * @param {import('../src/lib/privacyPolicy').PrivacyBlock} block
 * @returns {string}
 */
function renderHtmlBlock(block) {
  if (block.kind === 'paragraph') {
    return `    <p>${escapeHtml(block.text)}</p>`;
  }
  if (block.kind === 'list') {
    const items = block.items.map((item) => `      <li>${escapeHtml(item)}</li>`).join('\n');
    return `    <ul>\n${items}\n    </ul>`;
  }
  const mail = escapeHtml(block.email);
  return `    <p>${escapeHtml(block.label)}: <a href="mailto:${mail}">${mail}</a></p>`;
}

/**
 * 정본에서 HTML 전문을 만든다. 파일 쓰기 없음 — 순수 함수 (테스트가 재사용).
 * @param {import('../src/lib/privacyPolicy').PrivacyPolicy} policy
 * @returns {string}
 */
export function renderHtml(policy) {
  const body = policy.sections
    .map((section, i) => {
      const heading = `    <h2>${i + 1}. ${escapeHtml(section.title)}</h2>`;
      return [heading, ...section.blocks.map(renderHtmlBlock)].join('\n');
    })
    .join('\n\n');

  return `<!DOCTYPE html>
<!--
  ${GENERATED_NOTE.join('\n  ')}
-->
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>개인정보 처리방침 · ${escapeHtml(policy.appName)}</title>
  <meta name="description" content="${escapeHtml(policy.lead)}" />
  <style>
${HTML_STYLE}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(policy.appName)}<br />개인정보 처리방침</h1>
      <p class="subtitle">앱 이름: ${escapeHtml(policy.appName)} · 운영자: ${escapeHtml(policy.operatorEmail)}</p>
    </header>

    <p class="lead">${escapeHtml(policy.lead)}</p>

${body}

    <footer>
      마지막 갱신: ${escapeHtml(policy.updatedAt)}
    </footer>
  </main>
</body>
</html>
`;
}

/**
 * 블록 하나를 Markdown 으로.
 * @param {import('../src/lib/privacyPolicy').PrivacyBlock} block
 * @returns {string}
 */
function renderMarkdownBlock(block) {
  if (block.kind === 'paragraph') {
    return block.text;
  }
  if (block.kind === 'list') {
    return block.items.map((item) => `- ${item}`).join('\n');
  }
  return `${block.label}: [${block.email}](mailto:${block.email})`;
}

/**
 * 정본에서 Markdown 전문을 만든다. 파일 쓰기 없음 — 순수 함수.
 * @param {import('../src/lib/privacyPolicy').PrivacyPolicy} policy
 * @returns {string}
 */
export function renderMarkdown(policy) {
  const body = policy.sections
    .map((section, i) =>
      [`## ${i + 1}. ${section.title}`, ...section.blocks.map(renderMarkdownBlock)].join('\n\n'),
    )
    .join('\n\n');

  return `<!--
  ${GENERATED_NOTE.join('\n  ')}
-->

# ${policy.appName} 개인정보 처리방침

**${policy.lead}**

${body}

마지막 갱신: ${policy.updatedAt}
`;
}

/**
 * 정본 JSON 을 읽는다.
 * @returns {Promise<import('../src/lib/privacyPolicy').PrivacyPolicy>}
 */
async function readPolicy() {
  const raw = await readFile(POLICY_JSON_PATH, 'utf-8');
  return JSON.parse(raw);
}

/** 두 파일을 실제로 쓴다. `node scripts/gen_privacy_docs.mjs` 진입점. */
export default async function generate() {
  const policy = await readPolicy();

  await writeFile(HTML_PATH, renderHtml(policy), 'utf-8');
  console.log(`Written ${HTML_PATH}`);

  await writeFile(MD_PATH, renderMarkdown(policy), 'utf-8');
  console.log(`Written ${MD_PATH}`);
}

// CLI 직접 실행일 때만 파일을 쓴다 (테스트 import 시 side effect 금지).
// `import.meta.url` 대신 argv 로 판별 — 위 헤더 주석의 babel 제약 참고.
if (process.argv[1]?.endsWith('gen_privacy_docs.mjs') === true) {
  generate().catch((err) => {
    console.error('Privacy docs generation failed:', err.message);
    process.exit(1);
  });
}
