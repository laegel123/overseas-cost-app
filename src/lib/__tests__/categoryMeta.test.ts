/**
 * categoryMeta — 카테고리 라벨·아이콘·순서 단일 출처 (ADR-071).
 *
 * 값이 바뀌면 Compare 카드·Detail 헤더·출처 화면이 동시에 바뀐다. 본 테스트는
 * 6 카테고리 전수와 정확한 문자열을 고정해 의도치 않은 문구 변경을 막는다.
 */

import { ICON_NAMES } from '@/components/Icon';
import { CATEGORY_ICON, CATEGORY_LABEL, CATEGORY_ORDER } from '@/lib/categoryMeta';
import type { SourceCategory } from '@/types/city';

const ALL_CATEGORIES: SourceCategory[] = [
  'rent',
  'food',
  'transport',
  'tuition',
  'tax',
  'visa',
];

describe('CATEGORY_LABEL', () => {
  it('6 카테고리를 빠짐없이 갖는다', () => {
    expect(Object.keys(CATEGORY_LABEL).sort()).toEqual([...ALL_CATEGORIES].sort());
  });

  it.each([
    ['rent', '월세'],
    ['food', '식비'],
    ['transport', '교통'],
    ['tuition', '학비'],
    ['tax', '세금'],
    ['visa', '비자/정착'],
  ] as [SourceCategory, string][])('%s → "%s"', (category, label) => {
    expect(CATEGORY_LABEL[category]).toBe(label);
  });
});

describe('CATEGORY_ICON', () => {
  it('6 카테고리를 빠짐없이 갖는다', () => {
    expect(Object.keys(CATEGORY_ICON).sort()).toEqual([...ALL_CATEGORIES].sort());
  });

  it.each([
    ['rent', 'house'],
    ['food', 'fork'],
    ['transport', 'bus'],
    ['tuition', 'graduation'],
    ['tax', 'briefcase'],
    ['visa', 'passport'],
  ] as [SourceCategory, string][])('%s → "%s"', (category, icon) => {
    expect(CATEGORY_ICON[category]).toBe(icon);
  });

  it('모든 값이 ICON_NAMES 에 존재하는 유효한 아이콘 이름이다', () => {
    for (const category of ALL_CATEGORIES) {
      expect(ICON_NAMES).toContain(CATEGORY_ICON[category]);
    }
  });
});

describe('CATEGORY_ORDER', () => {
  it('Compare 카드 순서와 동일하다', () => {
    expect(CATEGORY_ORDER).toEqual(ALL_CATEGORIES);
  });

  it('6 카테고리를 중복 없이 전부 담는다', () => {
    expect(new Set(CATEGORY_ORDER).size).toBe(ALL_CATEGORIES.length);
    expect([...CATEGORY_ORDER].sort()).toEqual([...ALL_CATEGORIES].sort());
  });
});
