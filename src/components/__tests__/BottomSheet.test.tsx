/**
 * docs/TESTING.md §9.20.4 — BottomSheet (ADR-061).
 *
 * RN Modal 기반. visible=false 면 children 미렌더, true 면 mount + backdrop 탭으로
 * dismiss + onRequestClose 핸들링 (Android 백버튼).
 */

import { Text, View } from 'react-native';

import { fireEvent, render, screen } from '@testing-library/react-native';

import { BottomSheet } from '../BottomSheet';

describe('BottomSheet', () => {
  it('visible=false → children 미렌더', () => {
    render(
      <BottomSheet
        visible={false}
        onDismiss={() => undefined}
        title="테스트 시트"
        testID="sheet"
      >
        <Text testID="sheet-content">내용</Text>
      </BottomSheet>,
    );
    expect(screen.queryByTestId('sheet-content')).toBeNull();
  });

  it('visible=true → title + children 렌더', () => {
    render(
      <BottomSheet
        visible
        onDismiss={() => undefined}
        title="테스트 시트"
        testID="sheet"
      >
        <View testID="sheet-content" />
      </BottomSheet>,
    );
    expect(screen.getByText('테스트 시트')).toBeTruthy();
    expect(screen.getByTestId('sheet-content')).toBeTruthy();
  });

  it('backdrop 탭 → onDismiss 호출', () => {
    const onDismiss = jest.fn();
    render(
      <BottomSheet visible onDismiss={onDismiss} title="시트" testID="sheet">
        <View testID="sheet-content" />
      </BottomSheet>,
    );
    fireEvent.press(screen.getByTestId('sheet-backdrop'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // PR #25 2차 review — 시트 body 탭은 backdrop 으로 전파되어 dismiss 되면
  // 안 됨. body 의 빈 onPress 가 이벤트 캡처 역할 (UX 보존).
  it('시트 body 탭 → onDismiss 미호출', () => {
    const onDismiss = jest.fn();
    render(
      <BottomSheet visible onDismiss={onDismiss} title="시트" testID="sheet">
        <View testID="sheet-content" />
      </BottomSheet>,
    );
    fireEvent.press(screen.getByTestId('sheet-body'));
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
