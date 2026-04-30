/**
 * RegionPill — TESTING.md §9.16 매트릭스. active state + count + hit slop.
 */

import * as React from 'react';

import { fireEvent, render, screen } from '@testing-library/react-native';

import { RegionPill } from '../RegionPill';

describe('RegionPill', () => {
  describe('active state', () => {
    it('active=true → bg-navy + white label', () => {
      render(<RegionPill label="북미" active testID="p" />);
      const pill = screen.getByTestId('p');
      expect(pill.props.className).toContain('bg-navy');
      const label = screen.getByText('북미');
      expect(label.props.className).toContain('text-white');
      expect(pill.props.accessibilityState).toEqual({ selected: true });
    });

    it('active=false (default) → bg-white + border-line + navy label', () => {
      render(<RegionPill label="북미" testID="p" />);
      const pill = screen.getByTestId('p');
      expect(pill.props.className).toContain('bg-white');
      expect(pill.props.className).toContain('border-line');
      const label = screen.getByText('북미');
      expect(label.props.className).toContain('text-navy');
      expect(pill.props.accessibilityState).toEqual({ selected: false });
    });
  });

  describe('count', () => {
    it('count 있을 때 — 라벨에 "(N)" 결합', () => {
      render(<RegionPill label="북미" count={8} testID="p" />);
      expect(screen.getByText('북미 (8)')).toBeTruthy();
    });

    it('count 미지정 → 라벨만 노출', () => {
      render(<RegionPill label="북미" testID="p" />);
      expect(screen.getByText('북미')).toBeTruthy();
      expect(screen.queryByText(/북미 \(/)).toBeNull();
    });

    it('count=0 도 명시적으로 표기 ("0" 도 정보)', () => {
      render(<RegionPill label="아시아" count={0} testID="p" />);
      expect(screen.getByText('아시아 (0)')).toBeTruthy();
    });
  });

  describe('동작', () => {
    it('탭 → onSelect 호출', () => {
      const onSelect = jest.fn();
      render(<RegionPill label="유럽" onSelect={onSelect} testID="p" />);
      fireEvent.press(screen.getByTestId('p'));
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('hit slop 44×44 보장 — props.hitSlop 정확', () => {
      render(<RegionPill label="x" testID="p" />);
      const pill = screen.getByTestId('p');
      expect(pill.props.hitSlop).toEqual({ top: 8, bottom: 8, left: 8, right: 8 });
    });

    it('긴 region 이름 → numberOfLines={1}', () => {
      render(<RegionPill label="아시아 태평양 대도시권" testID="p" />);
      const label = screen.getByText('아시아 태평양 대도시권');
      expect(label.props.numberOfLines).toBe(1);
    });
  });

  describe('a11y', () => {
    it('accessibilityLabel — count 포함된 displayLabel', () => {
      render(<RegionPill label="북미" count={8} testID="p" />);
      expect(screen.getByLabelText('북미 (8)')).toBeTruthy();
    });

    it('accessibilityLabel — count 없으면 라벨만', () => {
      render(<RegionPill label="북미" testID="p" />);
      expect(screen.getByLabelText('북미')).toBeTruthy();
    });

    it('accessibilityRole=button', () => {
      render(<RegionPill label="x" testID="p" />);
      expect(screen.getByTestId('p').props.accessibilityRole).toBe('button');
    });
  });

  // ─── snapshot — TESTING.md §6.1 단순 시각 컴포넌트 ────────────────────────
  describe('snapshot', () => {
    it('active=true', () => {
      const { toJSON } = render(
        <RegionPill label="북미" count={8} active testID="p" />,
      );
      expect(toJSON()).toMatchSnapshot();
    });

    it('active=false (default)', () => {
      const { toJSON } = render(<RegionPill label="북미" count={8} testID="p" />);
      expect(toJSON()).toMatchSnapshot();
    });
  });
});
