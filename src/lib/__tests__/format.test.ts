import { InvalidMultiplierError } from '../errors';
import {
  computeBarPcts,
  computeMultiplier,
  formatMultiplier,
  formatShortDate,
  getMultColor,
  isHot,
} from '../format';

describe('isHot', () => {
  describe('정상 입력 — 표시값 (rounded) 기반', () => {
    it('1.94 → false (반올림 시 1.9 → cool)', () => {
      expect(isHot(1.94)).toBe(false);
    });

    it('1.95 → true (반올림 시 2.0 → hot, formatMultiplier 와 일관)', () => {
      expect(isHot(1.95)).toBe(true);
    });

    it('1.99 → true (반올림 시 2.0 → hot)', () => {
      expect(isHot(1.99)).toBe(true);
    });

    it('2.0 → true (hot 경계 정확값)', () => {
      expect(isHot(2.0)).toBe(true);
    });

    it('2.04 → true (반올림 시 2.0 → hot)', () => {
      expect(isHot(2.04)).toBe(true);
    });

    it('2.05 → true (반올림 시 2.1 → hot)', () => {
      expect(isHot(2.05)).toBe(true);
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

    it('1.95 → "↑2.0×" (반올림 → hot 경계, isHot 도 true)', () => {
      expect(formatMultiplier(1.95)).toBe('↑2.0×');
      // 표시값 ↔ hot 판정 일관성 (PR #16 review 이슈 1)
      expect(isHot(1.95)).toBe(true);
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

describe('getMultColor', () => {
  describe('hot=true override → orange (mult 무관)', () => {
    it('hot=true + mult=0.5 → orange', () => {
      expect(getMultColor(0.5, true)).toBe('orange');
    });

    it('hot=true + mult=1.0 → orange', () => {
      expect(getMultColor(1.0, true)).toBe('orange');
    });

    it('hot=true + mult="신규" → orange', () => {
      expect(getMultColor('신규', true)).toBe('orange');
    });
  });

  describe("'신규' (hot=false) → navy", () => {
    it('"신규" → navy', () => {
      expect(getMultColor('신규', false)).toBe('navy');
    });
  });

  describe('표시값 ≤ 1.0 (cool 또는 동일) → gray-2', () => {
    it('mult=0.5 → gray-2', () => {
      expect(getMultColor(0.5, false)).toBe('gray-2');
    });

    it('mult=0.94 → gray-2 (반올림 0.9)', () => {
      expect(getMultColor(0.94, false)).toBe('gray-2');
    });

    it('mult=0.95 → gray-2 (반올림 1.0)', () => {
      expect(getMultColor(0.95, false)).toBe('gray-2');
    });

    it('mult=1.0 → gray-2', () => {
      expect(getMultColor(1.0, false)).toBe('gray-2');
    });

    it('mult=1.04 → gray-2 (반올림 1.0)', () => {
      expect(getMultColor(1.04, false)).toBe('gray-2');
    });
  });

  describe('표시값 > 1.0 (mid) → navy', () => {
    it('mult=1.05 → navy (반올림 1.1)', () => {
      expect(getMultColor(1.05, false)).toBe('navy');
    });

    it('mult=1.5 → navy', () => {
      expect(getMultColor(1.5, false)).toBe('navy');
    });

    it('mult=1.94 → navy (반올림 1.9, hot 미만)', () => {
      expect(getMultColor(1.94, false)).toBe('navy');
    });
  });

  describe('에러 케이스 — silent fallback 금지 (PR #16 review 이슈 3)', () => {
    it('0 → throws InvalidMultiplierError (hot=false)', () => {
      expect(() => getMultColor(0, false)).toThrow(InvalidMultiplierError);
    });

    it('0 → throws InvalidMultiplierError (hot=true 도 검증 적용)', () => {
      expect(() => getMultColor(0, true)).toThrow(InvalidMultiplierError);
    });

    it('음수 → throws', () => {
      expect(() => getMultColor(-1, false)).toThrow(InvalidMultiplierError);
    });

    it('NaN → throws (hot=false, silent navy 반환 차단)', () => {
      expect(() => getMultColor(NaN, false)).toThrow(InvalidMultiplierError);
    });

    it('Infinity → throws', () => {
      expect(() => getMultColor(Infinity, false)).toThrow(InvalidMultiplierError);
    });

    it('-Infinity → throws', () => {
      expect(() => getMultColor(-Infinity, false)).toThrow(InvalidMultiplierError);
    });
  });
});

describe('computeMultiplier (PR #17 review 이슈 2 — Infinity → 신규)', () => {
  it('정상 비교: cityVal/seoulVal 반환', () => {
    expect(computeMultiplier(100, 200)).toBe(2);
    expect(computeMultiplier(200, 100)).toBe(0.5);
    expect(computeMultiplier(150, 150)).toBe(1);
  });

  it('seoulVal=0 + cityVal>0 → "신규" (Infinity silent 차단)', () => {
    expect(computeMultiplier(0, 100)).toBe('신규');
    expect(computeMultiplier(0, 1)).toBe('신규');
  });

  it('seoulVal=0 + cityVal=0 → 1 (둘 다 0 = 동일)', () => {
    expect(computeMultiplier(0, 0)).toBe(1);
  });

  it('formatMultiplier / isHot 와 합성 가능 (Infinity throw 회피)', () => {
    const mult = computeMultiplier(0, 500_000);
    expect(mult).toBe('신규');
    // 신규 는 둘 다 정상 처리
    expect(formatMultiplier(mult)).toBe('신규');
    expect(isHot(mult)).toBe(false);
  });
});

describe('computeBarPcts', () => {
  it('정상 비율: seoul + city 합 분모', () => {
    expect(computeBarPcts(40, 60)).toEqual({ swPct: 0.4, cwPct: 0.6 });
    expect(computeBarPcts(100, 100)).toEqual({ swPct: 0.5, cwPct: 0.5 });
  });

  it('합 0 → 0.5 / 0.5 (둘 다 0 = 시각 동일)', () => {
    expect(computeBarPcts(0, 0)).toEqual({ swPct: 0.5, cwPct: 0.5 });
  });

  it('seoul=0, city>0 → 0 / 1', () => {
    expect(computeBarPcts(0, 100)).toEqual({ swPct: 0, cwPct: 1 });
  });

  it('seoul>0, city=0 → 1 / 0', () => {
    expect(computeBarPcts(100, 0)).toEqual({ swPct: 1, cwPct: 0 });
  });
});

describe('formatShortDate (PR #17 review 이슈 6 — UTC 기반)', () => {
  it('UTC 자정 직후 → 해당 UTC 일자', () => {
    expect(formatShortDate('2026-04-27T00:00:00Z')).toBe('04-27');
  });

  it('UTC 23:59 → 해당 UTC 일자 (로컬 TZ 영향 X)', () => {
    expect(formatShortDate('2026-04-27T23:59:00Z')).toBe('04-27');
  });

  it('UTC 다음 일자 자정 → 다음 일자', () => {
    expect(formatShortDate('2026-04-28T00:00:00Z')).toBe('04-28');
  });

  it('Date 객체도 동일 (UTC 추출)', () => {
    expect(formatShortDate(new Date('2026-12-31T15:00:00Z'))).toBe('12-31');
  });

  it('잘못된 입력 → throws', () => {
    expect(() => formatShortDate('not-a-date')).toThrow();
  });
});
