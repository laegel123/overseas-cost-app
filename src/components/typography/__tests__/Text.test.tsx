/**
 * 타이포 8 variant 매트릭스 — TESTING.md §9.9.
 *
 * variant 별 fontFamily / fontSize 정확 매칭은 `props.className` 토큰 검증으로
 * 확인 (NativeWind v4 가 className 을 RN style 로 컴파일 — 테스트 환경에서는
 * className 그대로 보존). 매직 hex / px 사용 여부는 component 소스에서 1차 차단.
 */

import * as React from 'react';

import { render, screen } from '@testing-library/react-native';

import {
  Body,
  Display,
  H1,
  H2,
  H3,
  MonoLabel,
  Small,
  Tiny,
} from '../Text';

type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'tiny' | 'mono-label';

type VariantSpec = {
  name: Variant;
  Component: React.ComponentType<{ children: React.ReactNode; color?: 'orange' | 'white' | 'gray' | 'gray-2' | 'navy'; numberOfLines?: number; testID?: string; accessibilityRole?: 'header' | 'text' }>;
  fontClass: string;
  sizeClass: string;
  defaultColorClass: string;
  defaultRole: 'header' | 'text';
};

const VARIANTS: VariantSpec[] = [
  { name: 'display', Component: Display, fontClass: 'font-manrope-extrabold', sizeClass: 'text-display', defaultColorClass: 'text-navy', defaultRole: 'header' },
  { name: 'h1', Component: H1, fontClass: 'font-manrope-extrabold', sizeClass: 'text-h1', defaultColorClass: 'text-navy', defaultRole: 'header' },
  { name: 'h2', Component: H2, fontClass: 'font-manrope-bold', sizeClass: 'text-h2', defaultColorClass: 'text-navy', defaultRole: 'header' },
  { name: 'h3', Component: H3, fontClass: 'font-manrope-bold', sizeClass: 'text-h3', defaultColorClass: 'text-navy', defaultRole: 'header' },
  { name: 'body', Component: Body, fontClass: 'font-mulish', sizeClass: 'text-body', defaultColorClass: 'text-navy', defaultRole: 'text' },
  { name: 'small', Component: Small, fontClass: 'font-mulish', sizeClass: 'text-small', defaultColorClass: 'text-gray', defaultRole: 'text' },
  { name: 'tiny', Component: Tiny, fontClass: 'font-mulish', sizeClass: 'text-tiny', defaultColorClass: 'text-gray-2', defaultRole: 'text' },
  { name: 'mono-label', Component: MonoLabel, fontClass: 'font-manrope-semibold', sizeClass: 'text-mono-label', defaultColorClass: 'text-gray-2', defaultRole: 'text' },
];

describe('Text 8 variant', () => {
  // ─── 렌더링 (한국어 / 영문 / 한글+이모지) ─────────────────────────────────
  describe('children 렌더', () => {
    it.each(VARIANTS)('$name — 한국어 렌더', ({ Component }) => {
      render(<Component>안녕하세요</Component>);
      expect(screen.getByText('안녕하세요')).toBeTruthy();
    });

    it.each(VARIANTS.filter((v) => v.name !== 'mono-label'))(
      '$name — 영문 렌더',
      ({ Component }) => {
        render(<Component>Hello World</Component>);
        expect(screen.getByText('Hello World')).toBeTruthy();
      },
    );

    it('mono-label — 영문 입력 → 대문자 변환 후 렌더 (별도 uppercase 섹션 참조)', () => {
      render(<MonoLabel>Hello World</MonoLabel>);
      expect(screen.getByText('HELLO WORLD')).toBeTruthy();
    });

    it.each(VARIANTS)('$name — 한글+이모지 렌더', ({ Component, name }) => {
      const text = `안녕 👋 ${name}`;
      render(<Component>{text}</Component>);
      // mono-label 은 uppercase 변환 — 별도 검증
      if (name !== 'mono-label') {
        expect(screen.getByText(text)).toBeTruthy();
      }
    });

    it.each(VARIANTS.filter((v) => v.name !== 'mono-label'))(
      '$name — 숫자 children',
      ({ Component }) => {
        render(<Component>{12345}</Component>);
        expect(screen.getByText('12345')).toBeTruthy();
      },
    );
  });

  // ─── className 토큰 (font + size + color) ────────────────────────────────
  describe('className 토큰', () => {
    it.each(VARIANTS)(
      '$name — fontClass + sizeClass + 기본 colorClass 적용',
      ({ Component, fontClass, sizeClass, defaultColorClass, name }) => {
        // mono-label 은 uppercase 변환되므로 평문 대신 testID 로 조회
        render(<Component testID={`t-${name}`}>x</Component>);
        const node = screen.getByTestId(`t-${name}`);
        const cls = node.props.className as string;
        expect(cls).toContain(fontClass);
        expect(cls).toContain(sizeClass);
        expect(cls).toContain(defaultColorClass);
      },
    );

    it('color prop override → 기본 색상 미적용', () => {
      render(
        <Body color="orange" testID="t-override">
          x
        </Body>,
      );
      const cls = screen.getByTestId('t-override').props.className as string;
      expect(cls).toContain('text-orange');
      expect(cls).not.toContain('text-navy');
    });

    it('color="white" — 4 색상 토큰 모두 적용 가능', () => {
      const colors = ['navy', 'gray', 'gray-2', 'white', 'orange'] as const;
      colors.forEach((c) => {
        const { unmount } = render(
          <Body color={c} testID={`color-${c}`}>
            x
          </Body>,
        );
        const cls = screen.getByTestId(`color-${c}`).props.className as string;
        expect(cls).toContain(`text-${c}`);
        unmount();
      });
    });

    it('className prop 추가 → composed 출력', () => {
      render(
        <Body className="mt-4 italic" testID="t-extra">
          x
        </Body>,
      );
      const cls = screen.getByTestId('t-extra').props.className as string;
      expect(cls).toContain('mt-4');
      expect(cls).toContain('italic');
    });
  });

  // ─── numberOfLines / style passthrough ───────────────────────────────────
  describe('passthrough props', () => {
    it('numberOfLines={1} 적용 (RN Text 가 ellipsis 처리)', () => {
      render(
        <Body numberOfLines={1} testID="t-1">
          매우 매우 매우 긴 텍스트가 들어갑니다
        </Body>,
      );
      expect(screen.getByTestId('t-1').props.numberOfLines).toBe(1);
    });

    it('numberOfLines={2} 다중 라인', () => {
      render(
        <Body numberOfLines={2} testID="t-2">
          긴 텍스트
        </Body>,
      );
      expect(screen.getByTestId('t-2').props.numberOfLines).toBe(2);
    });

    it('numberOfLines 미제공 → undefined (RN 이 기본 동작)', () => {
      render(<Body testID="t-no-lines">x</Body>);
      expect(screen.getByTestId('t-no-lines').props.numberOfLines).toBeUndefined();
    });

    it('style prop passthrough', () => {
      render(
        <Body style={{ marginTop: 5 }} testID="t-style">
          x
        </Body>,
      );
      expect(screen.getByTestId('t-style').props.style).toEqual({ marginTop: 5 });
    });

    it('testID passthrough', () => {
      render(<Body testID="my-test-id">x</Body>);
      expect(screen.getByTestId('my-test-id')).toBeTruthy();
    });
  });

  // ─── accessibilityRole ───────────────────────────────────────────────────
  describe('accessibilityRole', () => {
    it.each(VARIANTS.filter((v) => v.defaultRole === 'header'))(
      '$name — default header',
      ({ Component, name }) => {
        render(<Component testID={`r-${name}`}>x</Component>);
        expect(screen.getByTestId(`r-${name}`).props.accessibilityRole).toBe('header');
      },
    );

    it.each(VARIANTS.filter((v) => v.defaultRole === 'text'))(
      '$name — default text',
      ({ Component, name }) => {
        render(<Component testID={`r-${name}`}>x</Component>);
        expect(screen.getByTestId(`r-${name}`).props.accessibilityRole).toBe('text');
      },
    );

    it('accessibilityRole override — heading 을 text 로 강제', () => {
      render(
        <H1 accessibilityRole="text" testID="role-override">
          x
        </H1>,
      );
      expect(screen.getByTestId('role-override').props.accessibilityRole).toBe('text');
    });
  });

  // ─── MonoLabel uppercase ─────────────────────────────────────────────────
  describe('MonoLabel uppercase', () => {
    it('영문 소문자 → 대문자 자동 변환', () => {
      render(<MonoLabel>foo bar</MonoLabel>);
      expect(screen.getByText('FOO BAR')).toBeTruthy();
    });

    it('한국어 children → 그대로 렌더 (uppercase 영향 없음)', () => {
      render(<MonoLabel>한국어</MonoLabel>);
      expect(screen.getByText('한국어')).toBeTruthy();
    });

    it('non-string children (숫자) → uppercase 변환 안 함', () => {
      // 숫자는 typeof !== 'string' 이라 변환 skip — RNText 가 직접 렌더.
      render(<MonoLabel testID="num">{123}</MonoLabel>);
      expect(screen.getByTestId('num')).toBeTruthy();
    });
  });
});
