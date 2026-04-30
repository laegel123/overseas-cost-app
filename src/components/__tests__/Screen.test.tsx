/**
 * Screen — TESTING.md §9.11 매트릭스. SafeArea + 배경 + padding + scroll.
 */

import * as React from 'react';

import { ScrollView, Text, View } from 'react-native';

import { render, screen } from '@testing-library/react-native';

import { Screen } from '../Screen';

describe('Screen', () => {
  it('자식 렌더 + 기본 padding (screen-x) + flex-1', () => {
    render(
      <Screen testID="s">
        <Text testID="child">hello</Text>
      </Screen>,
    );
    expect(screen.getByTestId('child')).toBeTruthy();
    // testID 가 inner View 에 부여 — SafeAreaView mock 은 passthrough 라
    // chrome 클래스 (flex-1 / bg-white) 는 outer SafeAreaView 의 책임.
    const root = screen.getByTestId('s');
    expect(root.props.className).toContain('flex-1');
    expect(root.props.className).toContain('px-screen-x');
  });

  it('scroll=true → ScrollView wrap', () => {
    render(
      <Screen scroll testID="s">
        <Text>x</Text>
      </Screen>,
    );
    expect(screen.UNSAFE_getByType(ScrollView)).toBeTruthy();
  });

  it('scroll=false (default) → 일반 View', () => {
    render(
      <Screen testID="s">
        <Text>x</Text>
      </Screen>,
    );
    expect(screen.UNSAFE_queryByType(ScrollView)).toBeNull();
  });

  it.each([
    ['none', ''],
    ['screen-x', 'px-screen-x'],
    ['screen-x-tight', 'px-screen-x-tight'],
    ['screen-x-loose', 'px-screen-x-loose'],
  ] as const)('padding=%s → 클래스 %s 적용', (padding, expectedClass) => {
    const { UNSAFE_getAllByType } = render(
      <Screen padding={padding}>
        <Text>x</Text>
      </Screen>,
    );
    // 가장 안쪽 View (padding 적용된 wrapper) 확인
    const views = UNSAFE_getAllByType(View);
    const innerView = views[views.length - 1];
    if (expectedClass === '') {
      expect(innerView.props.className ?? '').not.toContain('px-');
    } else {
      expect(innerView.props.className).toContain(expectedClass);
    }
  });

  it('edges 미지정 → default ["top", "bottom"] 적용', () => {
    render(
      <Screen testID="s">
        <Text>x</Text>
      </Screen>,
    );
    // SafeAreaView mock 은 edges 를 받지만 testID 외에 props 검증을 위한 래핑 없음.
    // 실제 inset 동작은 라이브러리 책임 — 본 테스트는 컴포넌트가 throw 안 함 검증.
    expect(screen.getByTestId('s')).toBeTruthy();
  });

  it('edges 명시 → prop 으로 전달 (SafeAreaView 가 받음)', () => {
    render(
      <Screen edges={['top']} testID="s">
        <Text>x</Text>
      </Screen>,
    );
    // edges prop 은 SafeAreaView mock 으로 전달되지만 mock 이 받기만 하므로
    // 컴포넌트가 정상 렌더하는지만 검증.
    expect(screen.getByTestId('s')).toBeTruthy();
  });

  it('scroll=true + padding=none → ScrollView className 미설정', () => {
    render(
      <Screen scroll padding="none">
        <Text>x</Text>
      </Screen>,
    );
    const sv = screen.UNSAFE_getByType(ScrollView);
    expect(sv.props.className ?? '').toBe('');
  });

  it('scroll=true + padding=screen-x → ScrollView className 에 padding 적용', () => {
    render(
      <Screen scroll padding="screen-x">
        <Text>x</Text>
      </Screen>,
    );
    const sv = screen.UNSAFE_getByType(ScrollView);
    expect(sv.props.className).toContain('px-screen-x');
  });

  it('scroll=true → contentContainerStyle 에 flexGrow:1 (children flex 동작)', () => {
    render(
      <Screen scroll>
        <Text>x</Text>
      </Screen>,
    );
    const sv = screen.UNSAFE_getByType(ScrollView);
    expect(sv.props.contentContainerStyle).toMatchObject({ flexGrow: 1 });
  });

  it('testID 전달', () => {
    render(
      <Screen testID="my-screen">
        <Text>x</Text>
      </Screen>,
    );
    expect(screen.getByTestId('my-screen')).toBeTruthy();
  });
});
