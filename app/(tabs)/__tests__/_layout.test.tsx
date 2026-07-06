/**
 * TabsLayout — BottomTabBar 어댑터 wiring 검증.
 *
 * _layout 은 BottomTabBar(제어형)를 expo-router Tabs 의 tabBar prop 에 연결한다.
 * 검증 대상(리뷰 회귀 방지):
 *   - route name ↔ Tab 매핑 (index 스크린 = 'home' 탭), active 파생
 *   - onSelect → 대상 라우트로 tabPress emit
 *   - home/settings: 기본 navigate (focus 시 no-op)
 *   - compare/favorites: listeners 가 preventDefault + redirect → 기본 navigate 억제
 *   - compare 타깃 = recent[0] ?? favorites[0], favorites 타깃 = favorites[0]
 *   - 도시 0개 → router.replace('/') + Alert
 *
 * expo-router Tabs 는 react-navigation 의 custom tabBar 계약(emit('tabPress') →
 * screen listeners 발화, preventDefault → defaultPrevented)을 mock 으로 재현.
 */

import * as React from 'react';

import { Alert } from 'react-native';

import { fireEvent, render, screen } from '@testing-library/react-native';

import TabsLayout from '../_layout';

// mock 접두사 규칙(babel-plugin-jest-hoist): 팩토리에서 참조하려면 `mock*`.
let mockTabIndex = 0;
const mockTabNavigate = jest.fn();
const mockRouterNavigate = jest.fn();
const mockRouterReplace = jest.fn();

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

  return {
    Tabs,
    useRouter: () => ({ navigate: mockRouterNavigate, replace: mockRouterReplace }),
  };
});

jest.mock('@/store/recent', () => ({ useRecentStore: jest.fn() }));
jest.mock('@/store/favorites', () => ({ useFavoritesStore: jest.fn() }));

const mockedUseRecentStore = jest.requireMock('@/store/recent').useRecentStore as jest.Mock;
const mockedUseFavoritesStore = jest.requireMock('@/store/favorites')
  .useFavoritesStore as jest.Mock;

describe('TabsLayout — BottomTabBar 어댑터', () => {
  let recentIds: string[] = [];
  let favoriteIds: string[] = [];
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTabIndex = 0;
    recentIds = [];
    favoriteIds = [];
    mockedUseRecentStore.mockImplementation((sel: (s: { cityIds: string[] }) => unknown) =>
      sel({ cityIds: recentIds }),
    );
    mockedUseFavoritesStore.mockImplementation((sel: (s: { cityIds: string[] }) => unknown) =>
      sel({ cityIds: favoriteIds }),
    );
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
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

  it('설정 탭 선택(비focus) → navigation.navigate("settings"), redirect 미발생', () => {
    mockTabIndex = 0; // 홈 active
    render(<TabsLayout />);
    fireEvent.press(screen.getByLabelText('설정'));
    expect(mockTabNavigate).toHaveBeenCalledWith('settings');
    expect(mockRouterNavigate).not.toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
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

  it('비교 탭 선택 + recent 존재 → router.navigate("/compare/<recent[0]>"), 기본 navigate 억제', () => {
    recentIds = ['tokyo'];
    favoriteIds = ['osaka'];
    render(<TabsLayout />);
    fireEvent.press(screen.getByLabelText('비교'));
    expect(mockRouterNavigate).toHaveBeenCalledWith('/compare/tokyo');
    expect(mockTabNavigate).not.toHaveBeenCalled();
  });

  it('비교 탭 선택 + recent 없음 → favorites[0] fallback', () => {
    recentIds = [];
    favoriteIds = ['osaka'];
    render(<TabsLayout />);
    fireEvent.press(screen.getByLabelText('비교'));
    expect(mockRouterNavigate).toHaveBeenCalledWith('/compare/osaka');
  });

  it('비교 탭 선택 + 도시 0개 → router.replace("/") + Alert, 기본 navigate 억제', () => {
    render(<TabsLayout />);
    fireEvent.press(screen.getByLabelText('비교'));
    expect(mockRouterReplace).toHaveBeenCalledWith('/');
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(mockTabNavigate).not.toHaveBeenCalled();
  });

  it('즐겨찾기 탭 선택 + favorites 존재 → router.navigate("/compare/<favorites[0]>")', () => {
    favoriteIds = ['seoul'];
    render(<TabsLayout />);
    fireEvent.press(screen.getByLabelText('즐겨찾기'));
    expect(mockRouterNavigate).toHaveBeenCalledWith('/compare/seoul');
    expect(mockTabNavigate).not.toHaveBeenCalled();
  });

  it('즐겨찾기 탭 선택 + favorites 없음 → router.replace("/") + Alert (recent 무시)', () => {
    recentIds = ['tokyo'];
    favoriteIds = [];
    render(<TabsLayout />);
    fireEvent.press(screen.getByLabelText('즐겨찾기'));
    expect(mockRouterReplace).toHaveBeenCalledWith('/');
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(mockRouterNavigate).not.toHaveBeenCalled();
  });
});
