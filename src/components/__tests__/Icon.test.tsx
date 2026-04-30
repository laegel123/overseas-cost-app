/**
 * Icon — TESTING.md §9.10 매트릭스. 25 IconName 매핑 + props passthrough.
 *
 * lucide-react-native 컴포넌트는 testID / accessibilityLabel 을 svg 까지
 * propagate 하지 않으므로 Icon 은 View 로 wrap. 본 테스트는 wrapper View 의
 * 동작만 검증 — 실제 SVG path 는 lucide 라이브러리 책임.
 */

import * as React from 'react';

import { render, screen } from '@testing-library/react-native';

import { colors } from '@/theme/tokens';

import { Icon, ICON_NAMES, type IconName } from '../Icon';

describe('Icon', () => {
  // ─── 25 IconName 모두 렌더 ────────────────────────────────────────────────
  describe('IconName 카탈로그', () => {
    it.each(ICON_NAMES)('"%s" 렌더 (testID 발견)', (name) => {
      render(<Icon name={name} testID={`icon-${name}`} />);
      expect(screen.getByTestId(`icon-${name}`)).toBeTruthy();
    });

    it('ICON_NAMES 배열은 25개', () => {
      expect(ICON_NAMES).toHaveLength(25);
    });

    it('ICON_NAMES 는 readonly tuple — 중복 없음', () => {
      const set = new Set<IconName>(ICON_NAMES);
      expect(set.size).toBe(ICON_NAMES.length);
    });
  });

  // ─── Props ───────────────────────────────────────────────────────────────
  describe('Props', () => {
    it('size 기본값 22 → wrapper width/height 22', () => {
      render(<Icon name="home" testID="icon-default" />);
      const node = screen.getByTestId('icon-default');
      expect(node.props.style).toMatchObject({ width: 22, height: 22 });
    });

    it('size 커스텀 32 → wrapper width/height 32', () => {
      render(<Icon name="home" size={32} testID="icon-32" />);
      const node = screen.getByTestId('icon-32');
      expect(node.props.style).toMatchObject({ width: 32, height: 32 });
    });

    it('testID 전달', () => {
      render(<Icon name="star" testID="my-test-id" />);
      expect(screen.getByTestId('my-test-id')).toBeTruthy();
    });

    it('accessibilityLabel 전달', () => {
      render(
        <Icon name="star" accessibilityLabel="즐겨찾기" testID="icon-a11y" />,
      );
      expect(screen.getByTestId('icon-a11y').props.accessibilityLabel).toBe(
        '즐겨찾기',
      );
    });

    it('accessibilityLabel 미제공 → wrapper 에 prop 미전달', () => {
      render(<Icon name="star" testID="icon-no-a11y" />);
      expect(screen.getByTestId('icon-no-a11y').props.accessibilityLabel).toBeUndefined();
    });

    it('testID + accessibilityLabel 모두 미제공 → 조건부 spread false 브랜치 커버', () => {
      // RNTL container 쿼리 — testID 없이도 정상 렌더 검증.
      const { toJSON } = render(<Icon name="home" />);
      expect(toJSON()).not.toBeNull();
    });

    it('color / strokeWidth 는 lucide 컴포넌트로 전달 — wrapper 자체엔 영향 없음', () => {
      // 본 테스트는 Icon wrapper 가 color/strokeWidth prop 을 받아도 crash 하지
      // 않는지만 검증 (lucide 내부 SVG 색상 적용은 라이브러리 책임).
      render(
        <Icon name="home" color={colors.orange} strokeWidth={1.5} testID="icon-color" />,
      );
      expect(screen.getByTestId('icon-color')).toBeTruthy();
    });

    it('accessibilityLabel 있을 때 → accessible + role="image" + importantForAccessibility="yes"', () => {
      render(<Icon name="star" accessibilityLabel="즐겨찾기" testID="a11y-yes" />);
      const node = screen.getByTestId('a11y-yes');
      // iOS VoiceOver: accessible=true 로 노출
      expect(node.props.accessible).toBe(true);
      // Android TalkBack: importantForAccessibility='yes'
      expect(node.props.importantForAccessibility).toBe('yes');
      expect(node.props.accessibilityRole).toBe('image');
    });

    it('accessibilityLabel 없을 때 (데코레이티브) → accessible=false + importantForAccessibility="no"', () => {
      render(<Icon name="star" testID="a11y-no" />);
      const node = screen.getByTestId('a11y-no');
      // iOS VoiceOver: accessible=false 로 데코레이티브 아이콘 skip
      expect(node.props.accessible).toBe(false);
      // Android TalkBack: importantForAccessibility='no'
      expect(node.props.importantForAccessibility).toBe('no');
      expect(node.props.accessibilityRole).toBeUndefined();
    });
  });

  // ─── 매핑 정합성 ──────────────────────────────────────────────────────────
  describe('매핑 정합성', () => {
    it('동일 IconName 으로 같은 컴포넌트 렌더 (안정성)', () => {
      const a = render(<Icon name="home" testID="icon-a" />);
      expect(screen.getByTestId('icon-a')).toBeTruthy();
      a.unmount();

      render(<Icon name="home" testID="icon-b" />);
      expect(screen.getByTestId('icon-b')).toBeTruthy();
    });

    it('서로 다른 IconName → 모두 렌더 가능 (매핑 충돌 없음)', () => {
      ['compare', 'back', 'star', 'house'].forEach((name) => {
        const { unmount } = render(
          <Icon name={name as IconName} testID={`m-${name}`} />,
        );
        expect(screen.getByTestId(`m-${name}`)).toBeTruthy();
        unmount();
      });
    });
  });
});
