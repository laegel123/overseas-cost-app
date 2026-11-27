/**
 * TabsLayout — BottomTabBar 어댑터 wiring 검증.
 *
 * _layout 은 BottomTabBar(제어형)를 expo-router Tabs 의 tabBar prop 에 연결한다.
 * 검증 대상(리뷰 회귀 방지):
 *   - route name ↔ Tab 매핑 (index 스크린 = 'home' 탭), active 파생
 *   - onSelect → 대상 라우트로 tabPress emit
 *   - 4개 탭 전부 기본 navigate (focus 시 no-op) — 비교 탭도 일반 탭 화면이다
 *     (ADR-089 가 ADR-041 의 redirect 를 제거)
 *
 * expo-router Tabs 는 react-navigation 의 custom tabBar 계약(emit('tabPress') →
 * screen listeners 발화, preventDefault → defaultPrevented)을 mock 으로 재현 —
 * 어댑터가 계약을 지키는지 보려면 listener 가 없는 현재도 필요하다.
 */

import * as React from 'react';

import { fireEvent, render, screen } from '@testing-library/react-native';

import TabsLayout from '../_layout';

// mock 접두사 규칙(babel-plugin-jest-hoist): 팩토리에서 참조하려면 `mock*`.
let mockTabIndex = 0;
const mockTabNavigate = jest.fn();

jest.mock('expo-router', () => {
  const ReactLocal = jest.requireActual('react') as typeof import('react');

  const Tabs = ({
    children,
    tabBar,
  }: {
    children?: React.ReactNode;
    tabBar: (props: unknown) => React.ReactElement;
  }): React.ReactElement => {
    const screens: {
      name: string;
      key: string;
      listeners?: { tabPress?: (e: { preventDefault: () => void }) => void } | undefined;
    }[] = [];

    ReactLocal.Children.forEach(children, (child) => {
      if (!ReactLocal.isValidElement(child)) return;
      const props = child.props as {
        name?: string;
        listeners?: { tabPress?: (e: { preventDefault: () => void }) => void };
      };
      if (props.name) {
        screens.push({ name: props.name, key: `key-${props.name}`, listeners: props.listeners });
      }
    });

    const routes = screens.map((s) => ({ name: s.name, key: s.key }));
    const state = { index: mockTabIndex, routes, key: 'tabs' };

    const navigation = {
      navigate: mockTabNavigate,
      emit: (arg: { type: string; target: string; canPreventDefault?: boolean }) => {
        let prevented = false;
        const event = {
          preventDefault() {
            if (arg.canPreventDefault) prevented = true;
          },
          get defaultPrevented() {
            return prevented;
          },
        };
        const targetScreen = screens.find((s) => s.key === arg.target);
        const listener = targetScreen?.listeners?.tabPress;
        if (arg.type === 'tabPress' && typeof listener === 'function') listener(event);
        return event;
      },
    };

    return tabBar({
      state,
      navigation,
      descriptors: {},
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    });
  };
  Tabs.displayName = 'MockTabs';
  Tabs.Screen = function MockTabsScreen(): null {
    return null;
  };

  return { Tabs };
});

describe('TabsLayout — BottomTabBar 어댑터', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTabIndex = 0;
  });

  it('index 스크린이 active → 홈 탭 selected (route→Tab 매핑)', () => {
    mockTabIndex = 0;
    render(<TabsLayout />);
    expect(screen.getByLabelText('홈').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByLabelText('설정').props.accessibilityState).toEqual({ selected: false });
  });

  it('settings 스크린이 active → 설정 탭 selected', () => {
    mockTabIndex = 3;
    render(<TabsLayout />);
    expect(screen.getByLabelText('설정').props.accessibilityState).toEqual({ selected: true });
  });

  it('설정 탭 선택(비focus) → navigation.navigate("settings")', () => {
    mockTabIndex = 0; // 홈 active
    render(<TabsLayout />);
    fireEvent.press(screen.getByLabelText('설정'));
    expect(mockTabNavigate).toHaveBeenCalledWith('settings');
  });

  it('홈 탭 선택(비focus, index=설정) → navigation.navigate("index")', () => {
    mockTabIndex = 3; // 설정 active
    render(<TabsLayout />);
    fireEvent.press(screen.getByLabelText('홈'));
    expect(mockTabNavigate).toHaveBeenCalledWith('index');
  });

  it('이미 focus 된 탭 재선택 → navigate no-op', () => {
    mockTabIndex = 0; // 홈 active
    render(<TabsLayout />);
    fireEvent.press(screen.getByLabelText('홈'));
    expect(mockTabNavigate).not.toHaveBeenCalled();
  });

  it('비교 탭 선택 → 기본 navigate("compare") (ADR-089 — redirect 없음)', () => {
    mockTabIndex = 0; // 홈 active
    render(<TabsLayout />);
    fireEvent.press(screen.getByLabelText('비교'));
    expect(mockTabNavigate).toHaveBeenCalledWith('compare');
  });

  it('즐겨찾기 탭 선택 → 기본 navigate("favorites") (ADR-084)', () => {
    render(<TabsLayout />);
    fireEvent.press(screen.getByLabelText('즐겨찾기'));
    expect(mockTabNavigate).toHaveBeenCalledWith('favorites');
  });

  it('compare 스크린에 tabPress listener 가 없다 (redirect 제거 회귀 방지)', () => {
    render(<TabsLayout />);
    fireEvent.press(screen.getByLabelText('비교'));
    // listener 가 preventDefault 하면 기본 navigate 가 억제된다 → 호출됐다는 것이
    // 곧 listener 부재의 증거.
    expect(mockTabNavigate).toHaveBeenCalledTimes(1);
  });
});
