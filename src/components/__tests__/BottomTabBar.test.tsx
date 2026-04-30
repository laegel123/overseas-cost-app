/**
 * BottomTabBar — TESTING.md §9.13 매트릭스. 4 탭 + active state + safe area.
 */

import * as React from 'react';

import { fireEvent, render, screen } from '@testing-library/react-native';

import { BottomTabBar, type Tab } from '../BottomTabBar';

describe('BottomTabBar', () => {
  it('4 탭 모두 한국어 라벨 (홈 / 비교 / 즐겨찾기 / 설정) 렌더', () => {
    render(<BottomTabBar active="home" onSelect={jest.fn()} />);
    expect(screen.getByText('홈')).toBeTruthy();
    expect(screen.getByText('비교')).toBeTruthy();
    expect(screen.getByText('즐겨찾기')).toBeTruthy();
    expect(screen.getByText('설정')).toBeTruthy();
  });

  it.each(['home', 'compare', 'favorites', 'settings'] as const)(
    'active=%s → 해당 탭이 selected 상태',
    (active) => {
      render(<BottomTabBar active={active} onSelect={jest.fn()} testID="tb" />);
      const tab = screen.getByTestId(`tb-${active}`);
      expect(tab.props.accessibilityState).toEqual({ selected: true });
    },
  );

  it('inactive 탭은 selected=false', () => {
    render(<BottomTabBar active="home" onSelect={jest.fn()} testID="tb" />);
    expect(screen.getByTestId('tb-compare').props.accessibilityState).toEqual({
      selected: false,
    });
  });

  it.each(['home', 'compare', 'favorites', 'settings'] as const)(
    '%s 탭 클릭 → onSelect(%s) 호출',
    (tab) => {
      const onSelect = jest.fn();
      render(<BottomTabBar active="home" onSelect={onSelect} testID="tb" />);
      fireEvent.press(screen.getByTestId(`tb-${tab}`));
      expect(onSelect).toHaveBeenCalledWith(tab);
    },
  );

  it('active 탭 라벨 → text-orange', () => {
    render(<BottomTabBar active="home" onSelect={jest.fn()} />);
    const homeLabel = screen.getByText('홈');
    expect(homeLabel.props.className).toContain('text-orange');
  });

  it('inactive 탭 라벨 → text-gray-2', () => {
    render(<BottomTabBar active="home" onSelect={jest.fn()} />);
    const compareLabel = screen.getByText('비교');
    expect(compareLabel.props.className).toContain('text-gray-2');
  });

  it('safe area bottom inset 적용 (mock 14px)', () => {
    render(<BottomTabBar active="home" onSelect={jest.fn()} testID="tb" />);
    const root = screen.getByTestId('tb');
    expect(root.props.style).toMatchObject({ paddingBottom: 14 });
  });

  it('iPhone SE (no home indicator) — bottom inset 0 가정', () => {
    // Per-test mockReturnValue 갱신.
    const safeArea = jest.requireMock('react-native-safe-area-context');
    const original = safeArea.useSafeAreaInsets;
    safeArea.useSafeAreaInsets = () => ({ top: 20, bottom: 0, left: 0, right: 0 });

    render(<BottomTabBar active="home" onSelect={jest.fn()} testID="tb-se" />);
    const root = screen.getByTestId('tb-se');
    expect(root.props.style).toMatchObject({ paddingBottom: 0 });

    safeArea.useSafeAreaInsets = original;
  });

  it('탭의 accessibilityLabel — 한국어 라벨 그대로', () => {
    render(<BottomTabBar active="home" onSelect={jest.fn()} testID="tb" />);
    expect(screen.getByLabelText('홈')).toBeTruthy();
    expect(screen.getByLabelText('비교')).toBeTruthy();
    expect(screen.getByLabelText('즐겨찾기')).toBeTruthy();
    expect(screen.getByLabelText('설정')).toBeTruthy();
  });

  it('testID 미제공 → 정상 렌더 + label 로 조회 가능', () => {
    const tabs: Tab[] = ['home', 'compare', 'favorites', 'settings'];
    const onSelect = jest.fn();
    render(<BottomTabBar active="home" onSelect={onSelect} />);
    fireEvent.press(screen.getByLabelText('비교'));
    expect(onSelect).toHaveBeenCalledWith('compare');
    // tabs 변수 사용 (eslint no-unused-vars 회피)
    expect(tabs).toHaveLength(4);
  });
});
