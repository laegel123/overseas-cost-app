import { InvalidMultiplierError } from '../errors';
import { formatMultiplier, isHot } from '../format';

describe('isHot', () => {
  describe('정상 입력', () => {
    it('1.99 → false (경계 미만)', () => {
      expect(isHot(1.99)).toBe(false);
    });

    it('2.0 → true (정확히 경계)', () => {
      expect(isHot(2.0)).toBe(true);
    });

    it('2.01 → true (경계 초과)', () => {
      expect(isHot(2.01)).toBe(true);
    });

    it('5.0 → true', () => {
      expect(isHot(5.0)).toBe(true);
    });

    it('1.0 → false', () => {
      expect(isHot(1.0)).toBe(false);
    });

    it('0.5 → false', () => {
      expect(isHot(0.5)).toBe(false);
    });

    it('0.01 → false (매우 작은 양수)', () => {
      expect(isHot(0.01)).toBe(false);
    });

    it('10.0 → true', () => {
      expect(isHot(10.0)).toBe(true);
    });
  });

  describe('신규 케이스', () => {
    it('"신규" → false (신규는 hot 아님)', () => {
      expect(isHot('신규')).toBe(false);
    });
  });

  describe('에러 케이스', () => {
    it('0 → throws InvalidMultiplierError', () => {
      expect(() => isHot(0)).toThrow(InvalidMultiplierError);
    });

    it('음수 → throws InvalidMultiplierError', () => {
      expect(() => isHot(-1)).toThrow(InvalidMultiplierError);
      expect(() => isHot(-0.5)).toThrow(InvalidMultiplierError);
    });

    it('NaN → throws InvalidMultiplierError', () => {
      expect(() => isHot(NaN)).toThrow(InvalidMultiplierError);
    });

    it('Infinity → throws InvalidMultiplierError', () => {
      expect(() => isHot(Infinity)).toThrow(InvalidMultiplierError);
    });

    it('-Infinity → throws InvalidMultiplierError', () => {
      expect(() => isHot(-Infinity)).toThrow(InvalidMultiplierError);
    });
  });
});

describe('formatMultiplier', () => {
  describe('정상 입력', () => {
    it('1.0 → "1.0×" (화살표 없음)', () => {
      expect(formatMultiplier(1.0)).toBe('1.0×');
    });

    it('1.04 → "1.0×" (반내림)', () => {
      expect(formatMultiplier(1.04)).toBe('1.0×');
    });

    it('1.05 → "↑1.1×" (반올림)', () => {
      expect(formatMultiplier(1.05)).toBe('↑1.1×');
    });

    it('1.5 → "↑1.5×"', () => {
      expect(formatMultiplier(1.5)).toBe('↑1.5×');
    });

    it('1.94 → "↑1.9×" (반내림)', () => {
      expect(formatMultiplier(1.94)).toBe('↑1.9×');
    });

    it('1.95 → "↑2.0×" (반올림 → hot 경계)', () => {
      expect(formatMultiplier(1.95)).toBe('↑2.0×');
    });

    it('2.0 → "↑2.0×" (hot 경계)', () => {
      expect(formatMultiplier(2.0)).toBe('↑2.0×');
    });

    it('2.01 → "↑2.0×" (반내림)', () => {
      expect(formatMultiplier(2.01)).toBe('↑2.0×');
    });

    it('9.99 → "↑10.0×" (반올림)', () => {
      expect(formatMultiplier(9.99)).toBe('↑10.0×');
    });

    it('10.0 → "↑10.0×"', () => {
      expect(formatMultiplier(10.0)).toBe('↑10.0×');
    });

    it('0.95 → "↓1.0×" (반올림)', () => {
      expect(formatMultiplier(0.95)).toBe('↓1.0×');
    });

    it('0.94 → "↓0.9×" (반내림)', () => {
      expect(formatMultiplier(0.94)).toBe('↓0.9×');
    });

    it('0.5 → "↓0.5×"', () => {
      expect(formatMultiplier(0.5)).toBe('↓0.5×');
    });

    it('0.05 → "↓0.1×" (반올림)', () => {
      expect(formatMultiplier(0.05)).toBe('↓0.1×');
    });
  });

  describe('신규 케이스', () => {
    it('"신규" → "신규"', () => {
      expect(formatMultiplier('신규')).toBe('신규');
    });
  });

  describe('에러 케이스', () => {
    it('0 → throws InvalidMultiplierError', () => {
      expect(() => formatMultiplier(0)).toThrow(InvalidMultiplierError);
    });

    it('음수 → throws InvalidMultiplierError', () => {
      expect(() => formatMultiplier(-1)).toThrow(InvalidMultiplierError);
    });

    it('NaN → throws InvalidMultiplierError', () => {
      expect(() => formatMultiplier(NaN)).toThrow(InvalidMultiplierError);
    });

    it('Infinity → throws InvalidMultiplierError', () => {
      expect(() => formatMultiplier(Infinity)).toThrow(InvalidMultiplierError);
    });
  });
});
