/**
 * TopBar — TESTING.md §9.12 매트릭스. 8 prop 조합 + 개별 동작.
 */

import * as React from 'react';

import { fireEvent, render, screen } from '@testing-library/react-native';

import { TopBar } from '../TopBar';

describe('TopBar', () => {
  // ─── 8 prop 조합 매트릭스 ─────────────────────────────────────────────────
  describe('prop 조합', () => {
    it('title 만', () => {
      render(<TopBar title="홈" testID="tb" />);
      expect(screen.getByText('홈')).toBeTruthy();
      expect(screen.queryByTestId('tb-back')).toBeNull();
      expect(screen.queryByTestId('tb-right')).toBeNull();
    });

    it('title + back', () => {
      const onBack = jest.fn();
      render(<TopBar title="비교" onBack={onBack} testID="tb" />);
      expect(screen.getByText('비교')).toBeTruthy();
      expect(screen.getByTestId('tb-back')).toBeTruthy();
      expect(screen.queryByTestId('tb-right')).toBeNull();
    });

    it('title + right', () => {
      const onRight = jest.fn();
      render(
        <TopBar title="홈" rightIcon="search" onRightPress={onRight} testID="tb" />,
      );
      expect(screen.queryByTestId('tb-back')).toBeNull();
      expect(screen.getByTestId('tb-right')).toBeTruthy();
    });

    it('title + back + right', () => {
      render(
        <TopBar
          title="비교"
          onBack={jest.fn()}
          rightIcon="star"
          onRightPress={jest.fn()}
          testID="tb"
        />,
      );
      expect(screen.getByTestId('tb-back')).toBeTruthy();
      expect(screen.getByTestId('tb-right')).toBeTruthy();
    });

    it('title + subtitle', () => {
      render(<TopBar title="설정" subtitle="v1.0" testID="tb" />);
      expect(screen.getByText('설정')).toBeTruthy();
      expect(screen.getByText('v1.0')).toBeTruthy();
    });

    it('title + subtitle + back', () => {
      render(
        <TopBar title="비교" subtitle="서울 vs 도쿄" onBack={jest.fn()} testID="tb" />,
      );
      expect(screen.getByText('서울 vs 도쿄')).toBeTruthy();
      expect(screen.getByTestId('tb-back')).toBeTruthy();
    });

    it('title + subtitle + right', () => {
      render(
        <TopBar
          title="홈"
          subtitle="안녕하세요"
          rightIcon="user"
          onRightPress={jest.fn()}
          testID="tb"
        />,
      );
      expect(screen.getByText('안녕하세요')).toBeTruthy();
      expect(screen.getByTestId('tb-right')).toBeTruthy();
    });

    it('title + subtitle + back + right (full)', () => {
      render(
        <TopBar
          title="상세"
          subtitle="식비"
          onBack={jest.fn()}
          rightIcon="info"
          onRightPress={jest.fn()}
          testID="tb"
        />,
      );
      expect(screen.getByText('상세')).toBeTruthy();
      expect(screen.getByText('식비')).toBeTruthy();
      expect(screen.getByTestId('tb-back')).toBeTruthy();
      expect(screen.getByTestId('tb-right')).toBeTruthy();
    });
  });

  // ─── 개별 동작 ────────────────────────────────────────────────────────────
  describe('동작', () => {
    it('back 버튼 탭 → onBack 호출', () => {
      const onBack = jest.fn();
      render(<TopBar title="x" onBack={onBack} testID="tb" />);
      fireEvent.press(screen.getByTestId('tb-back'));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('back 버튼 시각: 36×36 (w-9 h-9) + bg-light + rounded-icon-md', () => {
      render(<TopBar title="x" onBack={jest.fn()} testID="tb" />);
      const back = screen.getByTestId('tb-back');
      expect(back.props.className).toContain('w-9');
      expect(back.props.className).toContain('h-9');
      expect(back.props.className).toContain('bg-light');
      expect(back.props.className).toContain('rounded-icon-md');
    });

    it('right 버튼 탭 → onRightPress 호출', () => {
      const onRight = jest.fn();
      render(
        <TopBar title="x" rightIcon="star" onRightPress={onRight} testID="tb" />,
      );
      fireEvent.press(screen.getByTestId('tb-right'));
      expect(onRight).toHaveBeenCalledTimes(1);
    });

    it('right accent="default" → bg-light', () => {
      render(
        <TopBar
          title="x"
          rightIcon="search"
          onRightPress={jest.fn()}
          testID="tb"
        />,
      );
      const right = screen.getByTestId('tb-right');
      expect(right.props.className).toContain('bg-light');
      expect(right.props.className).not.toContain('bg-orange-soft');
    });

    it('right accent="star" → bg-orange-soft', () => {
      render(
        <TopBar
          title="x"
          rightIcon="star"
          rightIconAccent="star"
          onRightPress={jest.fn()}
          testID="tb"
        />,
      );
      const right = screen.getByTestId('tb-right');
      expect(right.props.className).toContain('bg-orange-soft');
    });

    it('title 긴 문자열 → numberOfLines={1}', () => {
      render(<TopBar title="매우 매우 매우 긴 제목" testID="tb" />);
      const titleNode = screen.getByText('매우 매우 매우 긴 제목');
      expect(titleNode.props.numberOfLines).toBe(1);
    });

    it('subtitle → numberOfLines={1}', () => {
      render(<TopBar title="x" subtitle="긴 서브 텍스트" testID="tb" />);
      const sub = screen.getByText('긴 서브 텍스트');
      expect(sub.props.numberOfLines).toBe(1);
    });

    it('back / right 버튼 accessibility — role + default label', () => {
      render(
        <TopBar
          title="x"
          onBack={jest.fn()}
          rightIcon="star"
          onRightPress={jest.fn()}
          testID="tb"
        />,
      );
      expect(screen.getByLabelText('뒤로가기')).toBeTruthy();
      // rightIconAccessibilityLabel 미제공 → '우측 메뉴' fallback
      expect(screen.getByLabelText('우측 메뉴')).toBeTruthy();
    });

    it('rightIconAccessibilityLabel 명시 → fallback 무시 + custom label 적용', () => {
      render(
        <TopBar
          title="x"
          rightIcon="star"
          rightIconAccessibilityLabel="즐겨찾기"
          onRightPress={jest.fn()}
          testID="tb"
        />,
      );
      expect(screen.getByLabelText('즐겨찾기')).toBeTruthy();
      expect(screen.queryByLabelText('우측 메뉴')).toBeNull();
    });

    it('testID 미제공 → back/right 의 testID 도 미설정 (정상 렌더)', () => {
      // back + right 둘 다 렌더해서 양쪽 testID 분기 모두 cover.
      render(
        <TopBar
          title="x"
          onBack={jest.fn()}
          rightIcon="star"
          onRightPress={jest.fn()}
        />,
      );
      expect(screen.getByLabelText('뒤로가기')).toBeTruthy();
      expect(screen.getByLabelText('우측 메뉴')).toBeTruthy();
    });
  });
});
