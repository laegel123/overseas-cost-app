import { fireEvent, render, screen } from '@testing-library/react-native';

import { ComparePair, type ComparePairProps } from '../ComparePair';

const defaultProps: ComparePairProps = {
  category: 'rent',
  label: '월세',
  sLabel: '서울',
  sValue: '60만',
  cLabel: '밴쿠버',
  cValue: '135만',
  mult: 2.3,
  swPct: 0.4,
  cwPct: 1.0,
  testID: 'compare-pair',
};

function renderPair(overrides: Partial<ComparePairProps> = {}) {
  return render(<ComparePair {...defaultProps} {...overrides} />);
}

describe('ComparePair', () => {
  describe('Hot 규칙 (경계값)', () => {
    it('mult=1.99 → not hot (icon bg-light, mult navy)', () => {
      renderPair({ mult: 1.99 });
      const iconBox = screen.getByTestId('compare-pair-icon-box');
      expect(iconBox.props.className).toContain('bg-light');
      expect(iconBox.props.className).not.toContain('bg-orange-soft');
    });

    it('mult=2.0 → hot (icon bg-orange-soft, mult orange)', () => {
      renderPair({ mult: 2.0 });
      const iconBox = screen.getByTestId('compare-pair-icon-box');
      expect(iconBox.props.className).toContain('bg-orange-soft');
    });

    it('mult=2.01 → hot', () => {
      renderPair({ mult: 2.01 });
      const iconBox = screen.getByTestId('compare-pair-icon-box');
      expect(iconBox.props.className).toContain('bg-orange-soft');
    });

    it('mult=10.0 → hot', () => {
      renderPair({ mult: 10.0 });
      const iconBox = screen.getByTestId('compare-pair-icon-box');
      expect(iconBox.props.className).toContain('bg-orange-soft');
    });

    it('mult=0.5 → not hot (cool)', () => {
      renderPair({ mult: 0.5 });
      const iconBox = screen.getByTestId('compare-pair-icon-box');
      expect(iconBox.props.className).toContain('bg-light');
    });
  });

  describe('Hot prop override', () => {
    it('hot=true 강제 (mult=1.5) → orange', () => {
      renderPair({ mult: 1.5, hot: true });
      const iconBox = screen.getByTestId('compare-pair-icon-box');
      expect(iconBox.props.className).toContain('bg-orange-soft');
    });

    it('hot=false 강제 (mult=3.0) → not hot', () => {
      renderPair({ mult: 3.0, hot: false });
      const iconBox = screen.getByTestId('compare-pair-icon-box');
      expect(iconBox.props.className).toContain('bg-light');
      expect(iconBox.props.className).not.toContain('bg-orange-soft');
    });

    it('hot 미지정 → 자동 판정 (isHot)', () => {
      renderPair({ mult: 2.5 });
      const iconBox = screen.getByTestId('compare-pair-icon-box');
      expect(iconBox.props.className).toContain('bg-orange-soft');
    });
  });

  describe('신규 케이스', () => {
    it('mult="신규" → "신규" 표기', () => {
      renderPair({ mult: '신규' });
      const multText = screen.getByTestId('compare-pair-mult');
      expect(multText.props.children).toBe('신규');
    });

    it('mult="신규" → not hot (navy color)', () => {
      renderPair({ mult: '신규' });
      const iconBox = screen.getByTestId('compare-pair-icon-box');
      expect(iconBox.props.className).toContain('bg-light');
    });
  });

  describe('막대 폭', () => {
    it('sw=0.4, cw=1.0 → 막대 정상 렌더', () => {
      renderPair({ swPct: 0.4, cwPct: 1.0 });
      const seoulBar = screen.getByTestId('compare-pair-bar-seoul');
      const cityBar = screen.getByTestId('compare-pair-bar-city');
      expect(seoulBar.props.style.width).toBe('40%');
      expect(cityBar.props.style.width).toBe('100%');
    });

    it('sw=0.0, cw=1.0 → 서울 막대 미표시', () => {
      renderPair({ swPct: 0.0, cwPct: 1.0 });
      expect(screen.queryByTestId('compare-pair-bar-seoul')).toBeNull();
      expect(screen.getByTestId('compare-pair-bar-city')).toBeTruthy();
    });

    it('sw=1.0, cw=0.5 → 정상', () => {
      renderPair({ swPct: 1.0, cwPct: 0.5 });
      const seoulBar = screen.getByTestId('compare-pair-bar-seoul');
      const cityBar = screen.getByTestId('compare-pair-bar-city');
      expect(seoulBar.props.style.width).toBe('100%');
      expect(cityBar.props.style.width).toBe('50%');
    });

    it('범위 벗어난 값 → clamp + warn', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      renderPair({ swPct: 1.5, cwPct: -0.2 });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ComparePair] swPct out of [0,1]'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ComparePair] cwPct out of [0,1]'),
      );
      const seoulBar = screen.getByTestId('compare-pair-bar-seoul');
      expect(seoulBar.props.style.width).toBe('100%');
      expect(screen.queryByTestId('compare-pair-bar-city')).toBeNull();
      warnSpy.mockRestore();
    });
  });

  describe('Icon 매핑', () => {
    const categories: { category: ComparePairProps['category']; icon: string }[] = [
      { category: 'rent', icon: 'house' },
      { category: 'food', icon: 'fork' },
      { category: 'transport', icon: 'bus' },
      { category: 'tuition', icon: 'graduation' },
      { category: 'tax', icon: 'briefcase' },
      { category: 'visa', icon: 'passport' },
    ];

    it.each(categories)('category=$category → $icon icon', ({ category }) => {
      renderPair({ category });
      expect(screen.getByTestId('compare-pair-icon-box')).toBeTruthy();
    });
  });

  describe('텍스트 렌더링', () => {
    it('라벨 / 값 표시', () => {
      renderPair();
      expect(screen.getByText('월세')).toBeTruthy();
      expect(screen.getByText('서울')).toBeTruthy();
      expect(screen.getByText('60만')).toBeTruthy();
      expect(screen.getByText('밴쿠버')).toBeTruthy();
      expect(screen.getByText('135만')).toBeTruthy();
    });

    it('mult 포매팅 — 2.3 → "↑2.3×"', () => {
      renderPair({ mult: 2.3 });
      const multText = screen.getByTestId('compare-pair-mult');
      expect(multText.props.children).toBe('↑2.3×');
    });

    it('mult=1.0 → "1.0×" (화살표 없음, gray-2)', () => {
      renderPair({ mult: 1.0 });
      const multText = screen.getByTestId('compare-pair-mult');
      expect(multText.props.children).toBe('1.0×');
    });

    it('mult=0.8 → "↓0.8×" (cool)', () => {
      renderPair({ mult: 0.8 });
      const multText = screen.getByTestId('compare-pair-mult');
      expect(multText.props.children).toBe('↓0.8×');
    });
  });

  describe('인터랙션', () => {
    it('onPress 정의 시 탭 동작', () => {
      const onPress = jest.fn();
      renderPair({ onPress });
      const card = screen.getByTestId('compare-pair');
      fireEvent.press(card);
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('onPress 미정의 시 비-탭 카드', () => {
      const { onPress: _, ...propsWithoutOnPress } = defaultProps;
      render(<ComparePair {...propsWithoutOnPress} />);
      const card = screen.getByTestId('compare-pair');
      expect(card.props.accessibilityRole).not.toBe('button');
    });
  });

  describe('testID 전파', () => {
    it('testID 미지정 시 testID 속성 없음', () => {
      const { testID: _, ...propsWithoutTestID } = defaultProps;
      render(<ComparePair {...propsWithoutTestID} />);
      expect(screen.queryByTestId('compare-pair')).toBeNull();
    });
  });
});
