/**
 * `src/lib/privacyPolicy.ts` — 개인정보 처리방침 정본 데이터 검증 (TESTING.md §9.40).
 *
 * 본문은 JSON 이고 TS 는 타입 단언으로만 노출하므로 (컴파일러가 형태를 검증하지 않는다),
 * 런타임 형태·불변조건을 여기서 지킨다. 렌더 결과 ↔ 생성물 일치는 별도 드리프트 테스트
 * (`scripts/__tests__/gen_privacy_docs.test.ts`) 담당.
 */
import { PRIVACY_POLICY } from '@/lib/privacyPolicy';
import type { PrivacyBlock } from '@/lib/privacyPolicy';

// ADR-067 로 제거된 개념. 본문(법적 문서)에 남아 있으면 사실과 다르다.
const REMOVED_TERMS = ['페르소나', '유학생', '취업자'];

const ALL_BLOCKS: PrivacyBlock[] = PRIVACY_POLICY.sections.flatMap((s) => s.blocks);

describe('PRIVACY_POLICY (개인정보 처리방침 정본)', () => {
  it('섹션이 7개다 (수집·저장 / 외부 서비스 / 분석·추적 / 정확성 고지 / 보호책임자 / 변경 / 문의)', () => {
    expect(PRIVACY_POLICY.sections).toHaveLength(7);
  });

  it('모든 섹션에 title 과 최소 1개 block 이 있다', () => {
    for (const section of PRIVACY_POLICY.sections) {
      expect(section.title.length).toBeGreaterThan(0);
      expect(section.blocks.length).toBeGreaterThan(0);
    }
  });

  it('title 에 섹션 번호를 하드코딩하지 않는다 (번호는 렌더 시점에 붙인다)', () => {
    for (const section of PRIVACY_POLICY.sections) {
      expect(section.title).not.toMatch(/^\d+\./);
    }
  });

  it('모든 block 이 알려진 kind 이고 필수 필드를 갖는다', () => {
    for (const block of ALL_BLOCKS) {
      if (block.kind === 'paragraph') {
        expect(typeof block.text).toBe('string');
        expect(block.text.length).toBeGreaterThan(0);
      } else if (block.kind === 'list') {
        expect(block.items.length).toBeGreaterThan(0);
        expect(block.items.every((item) => typeof item === 'string' && item.length > 0)).toBe(true);
      } else {
        expect(block.kind).toBe('email');
        expect(block.label.length).toBeGreaterThan(0);
        expect(block.email.length).toBeGreaterThan(0);
      }
    }
  });

  it.each(REMOVED_TERMS)('본문 어디에도 "%s" 문자열이 없다 (ADR-067 회귀 방지)', (term) => {
    expect(JSON.stringify(PRIVACY_POLICY)).not.toContain(term);
  });

  it('updatedAt 이 YYYY-MM-DD 형식이다', () => {
    expect(PRIVACY_POLICY.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('모든 email 블록이 operatorEmail 과 일치한다', () => {
    const emails = ALL_BLOCKS.filter((b) => b.kind === 'email').map((b) =>
      b.kind === 'email' ? b.email : '',
    );

    expect(emails.length).toBeGreaterThan(0);
    for (const email of emails) {
      expect(email).toBe(PRIVACY_POLICY.operatorEmail);
    }
  });

  it('appName·lead·operatorEmail 이 비어 있지 않다', () => {
    expect(PRIVACY_POLICY.appName.length).toBeGreaterThan(0);
    expect(PRIVACY_POLICY.lead.length).toBeGreaterThan(0);
    expect(PRIVACY_POLICY.operatorEmail).toContain('@');
  });
});
