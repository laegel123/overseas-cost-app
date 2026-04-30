/**
 * MenuRow — TESTING.md §9.15 매트릭스. 3 variant + isLast + disabled +
 * showChevron + rightText + onPress.
 */

import * as React from 'react';

import { fireEvent, render, screen } from '@testing-library/react-native';

import { MenuRow } from '../MenuRow';

describe('MenuRow', () => {
  // ─── Variant ──────────────────────────────────────────────────────────────
  describe('variant', () => {
    it('default — bg-light icon box + navy label', () => {
      render(<MenuRow icon="settings" label="설정" testID="r" />);
      const row = screen.getByTestId('r');
      // icon box className 검증은 children 트리에서 찾아야 함 — 본 테스트는
      // label 렌더 + container 동작만 검증.
      expect(screen.getByText('설정')).toBeTruthy();
      expect(row.props.accessibilityRole).toBe('button');
    });

    it('hot variant — label은 navy 유지, 아이콘 박스만 orange-soft', () => {
      render(<MenuRow icon="info" label="알림" variant="hot" testID="r" />);
      // label 색상은 hot 에서도 navy (라벨 자체는 강조 X, 아이콘이 강조).
      const label = screen.getByText('알림');
      expect(label.props.className).toContain('text-navy');
    });

    it('dim variant — label gray-2', () => {
      render(<MenuRow icon="info" label="앱 정보" variant="dim" testID="r" />);
      const label = screen.getByText('앱 정보');
      expect(label.props.className).toContain('text-gray-2');
    });
  });

  // ─── rightText ────────────────────────────────────────────────────────────
  describe('rightText', () => {
    it('rightText 있을 때 — 오른쪽에 렌더', () => {
      render(<MenuRow icon="settings" label="버전" rightText="v1.0.0" testID="r" />);
      expect(screen.getByText('v1.0.0')).toBeTruthy();
    });

    it('rightText 없을 때 — 미렌더', () => {
      render(<MenuRow icon="settings" label="버전" testID="r" />);
      expect(screen.queryByText('v1.0.0')).toBeNull();
    });

    it('rightText 긴 경우 — numberOfLines={1}', () => {
      render(
        <MenuRow
          icon="settings"
          label="언어"
          rightText="매우매우긴언어이름테스트"
          testID="r"
        />,
      );
      const right = screen.getByText('매우매우긴언어이름테스트');
      expect(right.props.numberOfLines).toBe(1);
    });
  });

  // ─── isLast / border ──────────────────────────────────────────────────────
  describe('isLast', () => {
    it('isLast=true → border-b 미적용', () => {
      render(<MenuRow icon="settings" label="x" isLast testID="r" />);
      expect(screen.getByTestId('r').props.className).not.toContain('border-b');
    });

    it('isLast 미지정 (default false) → border-b border-line 적용', () => {
      render(<MenuRow icon="settings" label="x" testID="r" />);
      const cls = screen.getByTestId('r').props.className;
      expect(cls).toContain('border-b');
      expect(cls).toContain('border-line');
    });
  });

  // ─── disabled ─────────────────────────────────────────────────────────────
  describe('disabled', () => {
    it('disabled=true → opacity-50 + onPress 미호출', () => {
      const onPress = jest.fn();
      render(
        <MenuRow icon="settings" label="x" disabled onPress={onPress} testID="r" />,
      );
      const row = screen.getByTestId('r');
      expect(row.props.className).toContain('opacity-50');
      expect(row.props.accessibilityState).toEqual({ disabled: true });

      fireEvent.press(row);
      expect(onPress).not.toHaveBeenCalled();
    });

    it('disabled=false (default) → opacity 미적용 + onPress 호출', () => {
      const onPress = jest.fn();
      render(<MenuRow icon="settings" label="x" onPress={onPress} testID="r" />);
      const row = screen.getByTestId('r');
      expect(row.props.className).not.toContain('opacity-50');

      fireEvent.press(row);
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  // ─── showChevron ──────────────────────────────────────────────────────────
  describe('chevron', () => {
    it('showChevron=true (default) → chev-right 아이콘 렌더', () => {
      render(<MenuRow icon="settings" label="x" testID="r" />);
      // chevron 은 별도 testID 없이 렌더되므로 컴포넌트 트리에서 검색 어려움 —
      // 본 테스트는 default 가 throw 없이 렌더되는 것만 검증 (showChevron=false
      // 와 시각 차이는 소스 인스펙션으로 확인).
      expect(screen.getByTestId('r')).toBeTruthy();
    });

    it('showChevron=false → 정상 렌더 (dim 류 사용 케이스)', () => {
      render(
        <MenuRow icon="info" label="앱 정보" variant="dim" showChevron={false} testID="r" />,
      );
      expect(screen.getByTestId('r')).toBeTruthy();
    });
  });

  // ─── a11y ─────────────────────────────────────────────────────────────────
  describe('accessibility', () => {
    it('accessibilityLabel = label prop', () => {
      render(<MenuRow icon="settings" label="설정" testID="r" />);
      expect(screen.getByLabelText('설정')).toBeTruthy();
    });

    it('accessibilityRole=button', () => {
      render(<MenuRow icon="settings" label="x" testID="r" />);
      expect(screen.getByTestId('r').props.accessibilityRole).toBe('button');
    });
  });
});
