import { render, screen } from '@testing-library/react-native';

import { GroceryRow, type GroceryRowProps } from '../GroceryRow';

const defaultProps: GroceryRowProps = {
  name: '라멘 한 그릇',
  emoji: '🍜',
  seoulPrice: '1.2만',
  cityPrice: '2.2만',
  mult: 1.8,
  testID: 'grocery-row',
};

function renderRow(overrides: Partial<GroceryRowProps> = {}) {
  return render(<GroceryRow {...defaultProps} {...overrides} />);
}

describe('GroceryRow', () => {
  describe('Hot 규칙 (경계값) — 표시값 (rounded) 기반', () => {
    it('mult=1.94 → not hot (반올림 1.9, bg-light)', () => {
      renderRow({ mult: 1.94 });
      const emojiBox = screen.getByTestId('grocery-row-emoji-box');
      expect(emojiBox.props.className).toContain('bg-light');
      expect(emojiBox.props.className).not.toContain('bg-orange-soft');
    });

    it('mult=1.95 → hot (반올림 2.0, formatMultiplier 와 일관 — PR #16 review 이슈 1)', () => {
      renderRow({ mult: 1.95 });
      const emojiBox = screen.getByTestId('grocery-row-emoji-box');
      expect(emojiBox.props.className).toContain('bg-orange-soft');
    });

    it('mult=1.99 → hot (반올림 2.0)', () => {
      renderRow({ mult: 1.99 });
      const emojiBox = screen.getByTestId('grocery-row-emoji-box');
      expect(emojiBox.props.className).toContain('bg-orange-soft');
    });

    it('mult=2.0 → hot (이모지 박스 bg-orange-soft)', () => {
      renderRow({ mult: 2.0 });
      const emojiBox = screen.getByTestId('grocery-row-emoji-box');
      expect(emojiBox.props.className).toContain('bg-orange-soft');
    });

    it('mult=2.5 → hot', () => {
      renderRow({ mult: 2.5 });
      const emojiBox = screen.getByTestId('grocery-row-emoji-box');
      expect(emojiBox.props.className).toContain('bg-orange-soft');
    });

    it('mult=0.5 → not hot (cool)', () => {
      renderRow({ mult: 0.5 });
      const emojiBox = screen.getByTestId('grocery-row-emoji-box');
      expect(emojiBox.props.className).toContain('bg-light');
    });

    it('mult=1.0 → not hot', () => {
      renderRow({ mult: 1.0 });
      const emojiBox = screen.getByTestId('grocery-row-emoji-box');
      expect(emojiBox.props.className).toContain('bg-light');
    });
  });

  describe('Hot prop override', () => {
    it('hot=true 강제 (mult=1.5) → orange-soft', () => {
      renderRow({ mult: 1.5, hot: true });
      const emojiBox = screen.getByTestId('grocery-row-emoji-box');
      expect(emojiBox.props.className).toContain('bg-orange-soft');
    });

    it('hot=false 강제 (mult=3.0) → bg-light', () => {
      renderRow({ mult: 3.0, hot: false });
      const emojiBox = screen.getByTestId('grocery-row-emoji-box');
      expect(emojiBox.props.className).toContain('bg-light');
      expect(emojiBox.props.className).not.toContain('bg-orange-soft');
    });

    it('hot 미지정 → 자동 판정', () => {
      renderRow({ mult: 2.5 });
      const emojiBox = screen.getByTestId('grocery-row-emoji-box');
      expect(emojiBox.props.className).toContain('bg-orange-soft');
    });
  });

  describe('isLast border', () => {
    it('isLast=false → border-b 표시', () => {
      renderRow({ isLast: false });
      const row = screen.getByTestId('grocery-row');
      expect(row.props.className).toContain('border-b');
    });

    it('isLast=true → border-b 없음', () => {
      renderRow({ isLast: true });
      const row = screen.getByTestId('grocery-row');
      expect(row.props.className).not.toContain('border-b');
    });

    it('isLast 미지정 → false (border-b 표시)', () => {
      renderRow({});
      const row = screen.getByTestId('grocery-row');
      expect(row.props.className).toContain('border-b');
    });
  });

  describe('텍스트 렌더링', () => {
    it('품목명 표시', () => {
      renderRow();
      expect(screen.getByText('라멘 한 그릇')).toBeTruthy();
    });

    it('이모지 표시', () => {
      renderRow();
      expect(screen.getByText('🍜')).toBeTruthy();
    });

    it('가격 범위: "서울 → 도시" 형식', () => {
      renderRow();
      expect(screen.getByText('1.2만 → 2.2만')).toBeTruthy();
    });

    it('다양한 이모지 렌더', () => {
      renderRow({ emoji: '🥚', name: '계란 12개' });
      expect(screen.getByText('🥚')).toBeTruthy();
      expect(screen.getByText('계란 12개')).toBeTruthy();
    });
  });

  describe('mult 포매팅', () => {
    it('mult=1.8 → ↑1.8×', () => {
      renderRow({ mult: 1.8 });
      const mult = screen.getByTestId('grocery-row-mult');
      expect(mult.props.children).toBe('↑1.8×');
    });

    it('mult=0.7 → ↓0.7×', () => {
      renderRow({ mult: 0.7 });
      const mult = screen.getByTestId('grocery-row-mult');
      expect(mult.props.children).toBe('↓0.7×');
    });

    it('mult=1.0 → 1.0×', () => {
      renderRow({ mult: 1.0 });
      const mult = screen.getByTestId('grocery-row-mult');
      expect(mult.props.children).toBe('1.0×');
    });
  });

  describe('이모지 박스', () => {
    it('36×36 (w-9 h-9) 크기', () => {
      renderRow();
      const emojiBox = screen.getByTestId('grocery-row-emoji-box');
      expect(emojiBox.props.className).toContain('w-9');
      expect(emojiBox.props.className).toContain('h-9');
    });

    it('rounded-[10px] 라운드', () => {
      renderRow();
      const emojiBox = screen.getByTestId('grocery-row-emoji-box');
      expect(emojiBox.props.className).toContain('rounded-[10px]');
    });
  });

  describe('testID 전파', () => {
    it('testID 미지정 시 testID 속성 없음', () => {
      const { testID: _, ...propsWithoutTestID } = defaultProps;
      render(<GroceryRow {...propsWithoutTestID} />);
      expect(screen.queryByTestId('grocery-row')).toBeNull();
    });
  });
});
