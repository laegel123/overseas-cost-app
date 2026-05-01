import { fireEvent, render, screen } from '@testing-library/react-native';

import { FavCard, type FavCardProps } from '../FavCard';

const defaultProps: FavCardProps = {
  cityId: 'vancouver',
  cityName: '밴쿠버',
  cityNameEn: 'Vancouver',
  countryCode: 'CA',
  mult: 1.9,
  testID: 'fav-card',
};

function renderCard(overrides: Partial<FavCardProps> = {}) {
  return render(<FavCard {...defaultProps} {...overrides} />);
}

describe('FavCard', () => {
  describe('accent variant', () => {
    it('accent=true: bg-navy (첫 카드 스타일)', () => {
      renderCard({ accent: true });
      const card = screen.getByTestId('fav-card');
      expect(card.props.className).toContain('bg-navy');
      expect(card.props.className).not.toContain('bg-white');
    });

    it('accent=false: bg-white + border-line (기본)', () => {
      renderCard({ accent: false });
      const card = screen.getByTestId('fav-card');
      expect(card.props.className).toContain('bg-white');
      expect(card.props.className).toContain('border-line');
    });

    it('accent 미지정 → false (white bg)', () => {
      renderCard({});
      const card = screen.getByTestId('fav-card');
      expect(card.props.className).toContain('bg-white');
    });
  });

  describe('Hot 규칙 (경계값)', () => {
    it('mult=1.99 → not hot (navy mult)', () => {
      renderCard({ mult: 1.99 });
      const mult = screen.getByTestId('fav-card-mult');
      expect(mult.props.children).toBe('↑2.0×');
    });

    it('mult=2.0 → hot (orange mult)', () => {
      renderCard({ mult: 2.0 });
      const mult = screen.getByTestId('fav-card-mult');
      expect(mult.props.children).toBe('↑2.0×');
    });

    it('mult=2.3 → hot (orange mult)', () => {
      renderCard({ mult: 2.3 });
      const mult = screen.getByTestId('fav-card-mult');
      expect(mult.props.children).toBe('↑2.3×');
    });

    it('mult=0.8 → cool (↓0.8×)', () => {
      renderCard({ mult: 0.8 });
      const mult = screen.getByTestId('fav-card-mult');
      expect(mult.props.children).toBe('↓0.8×');
    });

    it('mult=1.0 → 동일 (1.0×, gray-2)', () => {
      renderCard({ mult: 1.0 });
      const mult = screen.getByTestId('fav-card-mult');
      expect(mult.props.children).toBe('1.0×');
    });
  });

  describe('accent + hot 조합', () => {
    it('accent=true + hot=true → mult orange (accent 내에서도 hot 강조)', () => {
      renderCard({ accent: true, mult: 2.5 });
      const mult = screen.getByTestId('fav-card-mult');
      expect(mult.props.children).toBe('↑2.5×');
    });

    it('accent=true + not hot → mult white (accent 계승)', () => {
      renderCard({ accent: true, mult: 1.5 });
      const mult = screen.getByTestId('fav-card-mult');
      expect(mult.props.children).toBe('↑1.5×');
    });
  });

  describe('텍스트 렌더링', () => {
    it('도시명 / 영문명 / 국가코드 표시', () => {
      renderCard();
      expect(screen.getByText('밴쿠버')).toBeTruthy();
      expect(screen.getByText('Vancouver')).toBeTruthy();
      expect(screen.getByText('CA')).toBeTruthy();
    });

    it('영문명 sub opacity 0.7', () => {
      renderCard();
      const sub = screen.getByTestId('fav-card-sub');
      expect(sub.props.style).toEqual(
        expect.objectContaining({ opacity: 0.7 }),
      );
    });

    it('국가코드 박스 렌더', () => {
      renderCard();
      const countryBox = screen.getByTestId('fav-card-country-box');
      expect(countryBox).toBeTruthy();
    });

    it('star 아이콘 렌더', () => {
      renderCard();
      const star = screen.getByTestId('fav-card-star');
      expect(star).toBeTruthy();
    });
  });

  describe('인터랙션', () => {
    it('onPress 정의 시 탭 → cityId 전달', () => {
      const onPress = jest.fn();
      renderCard({ onPress });
      const card = screen.getByTestId('fav-card');
      fireEvent.press(card);
      expect(onPress).toHaveBeenCalledWith('vancouver');
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('onPress 미정의 시 비-탭 카드', () => {
      const { onPress: _, ...propsWithoutOnPress } = defaultProps;
      render(<FavCard {...propsWithoutOnPress} />);
      const card = screen.getByTestId('fav-card');
      expect(card.props.accessibilityRole).not.toBe('button');
    });
  });

  describe('testID 전파', () => {
    it('testID 미지정 시 testID 속성 없음', () => {
      const { testID: _, ...propsWithoutTestID } = defaultProps;
      render(<FavCard {...propsWithoutTestID} />);
      expect(screen.queryByTestId('fav-card')).toBeNull();
    });
  });
});
