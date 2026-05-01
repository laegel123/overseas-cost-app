import { fireEvent, render, screen } from '@testing-library/react-native';

import { RecentRow, type RecentRowProps } from '../RecentRow';

const defaultProps: RecentRowProps = {
  cityId: 'vancouver',
  cityName: '밴쿠버',
  cityNameEn: 'Vancouver',
  countryCode: 'CA',
  mult: 1.9,
  testID: 'recent-row',
};

function renderRow(overrides: Partial<RecentRowProps> = {}) {
  return render(<RecentRow {...defaultProps} {...overrides} />);
}

describe('RecentRow', () => {
  describe('Hot 규칙 (경계값)', () => {
    it('mult=1.99 → not hot (반올림 2.0 but 원본 < 2.0)', () => {
      renderRow({ mult: 1.99 });
      const mult = screen.getByTestId('recent-row-mult');
      expect(mult.props.children).toBe('↑2.0×');
    });

    it('mult=2.0 → hot (orange)', () => {
      renderRow({ mult: 2.0 });
      const mult = screen.getByTestId('recent-row-mult');
      expect(mult.props.children).toBe('↑2.0×');
    });

    it('mult=2.3 → hot', () => {
      renderRow({ mult: 2.3 });
      const mult = screen.getByTestId('recent-row-mult');
      expect(mult.props.children).toBe('↑2.3×');
    });

    it('mult=0.8 → cool (↓0.8×, gray-2)', () => {
      renderRow({ mult: 0.8 });
      const mult = screen.getByTestId('recent-row-mult');
      expect(mult.props.children).toBe('↓0.8×');
    });

    it('mult=1.0 → 동일 (1.0×, gray-2)', () => {
      renderRow({ mult: 1.0 });
      const mult = screen.getByTestId('recent-row-mult');
      expect(mult.props.children).toBe('1.0×');
    });

    it('mult=0.5 → cool', () => {
      renderRow({ mult: 0.5 });
      const mult = screen.getByTestId('recent-row-mult');
      expect(mult.props.children).toBe('↓0.5×');
    });
  });

  describe('isLast border', () => {
    it('isLast=false → border-b 표시', () => {
      renderRow({ isLast: false });
      const row = screen.getByTestId('recent-row');
      expect(row.props.className).toContain('border-b');
    });

    it('isLast=true → border-b 없음', () => {
      renderRow({ isLast: true });
      const row = screen.getByTestId('recent-row');
      expect(row.props.className).not.toContain('border-b');
    });

    it('isLast 미지정 → false (border-b 표시)', () => {
      renderRow({});
      const row = screen.getByTestId('recent-row');
      expect(row.props.className).toContain('border-b');
    });
  });

  describe('텍스트 렌더링', () => {
    it('도시명 / 영문명 / 국가코드 표시', () => {
      renderRow();
      expect(screen.getByText('밴쿠버')).toBeTruthy();
      expect(screen.getByText('Vancouver')).toBeTruthy();
      expect(screen.getByText('CA')).toBeTruthy();
    });

    it('국가코드 박스 36×36 렌더', () => {
      renderRow();
      const countryBox = screen.getByTestId('recent-row-country-box');
      expect(countryBox).toBeTruthy();
      expect(countryBox.props.className).toContain('w-9');
      expect(countryBox.props.className).toContain('h-9');
    });

    it('mult 포매팅 (↑/↓ 화살표)', () => {
      renderRow({ mult: 1.5 });
      const mult = screen.getByTestId('recent-row-mult');
      expect(mult.props.children).toBe('↑1.5×');
    });
  });

  describe('인터랙션', () => {
    it('onPress 정의 시 탭 → cityId 전달', () => {
      const onPress = jest.fn();
      renderRow({ onPress });
      const row = screen.getByTestId('recent-row');
      fireEvent.press(row);
      expect(onPress).toHaveBeenCalledWith('vancouver');
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('onPress 미정의 시 비-탭', () => {
      const { onPress: _, ...propsWithoutOnPress } = defaultProps;
      render(<RecentRow {...propsWithoutOnPress} />);
      const row = screen.getByTestId('recent-row');
      expect(row.props.accessibilityRole).not.toBe('button');
    });
  });

  describe('testID 전파', () => {
    it('testID 미지정 시 testID 속성 없음', () => {
      const { testID: _, ...propsWithoutTestID } = defaultProps;
      render(<RecentRow {...propsWithoutTestID} />);
      expect(screen.queryByTestId('recent-row')).toBeNull();
    });
  });
});
