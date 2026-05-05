/**
 * _outlier.mjs 테스트.
 * TESTING.md §9-A.1 classifyChange 인벤토리 100% 커버.
 */

import { classifyChange, computePctChange, iterNumericFields } from '../_outlier.mjs';

describe('classifyChange', () => {
  describe('null 처리', () => {
    it('(null, null) → commit', () => {
      expect(classifyChange(null, null)).toBe('commit');
    });

    it('(null, 100) → new (신규 항목)', () => {
      expect(classifyChange(null, 100)).toBe('new');
    });

    it('(100, null) → pr-removed (제거)', () => {
      expect(classifyChange(100, null)).toBe('pr-removed');
    });
  });

  describe('변동 없음', () => {
    it('(100, 100) → commit (변동 0)', () => {
      expect(classifyChange(100, 100)).toBe('commit');
    });

    it('(0, 0) → commit', () => {
      expect(classifyChange(0, 0)).toBe('commit');
    });
  });

  describe('< 5% 경계 (commit)', () => {
    it('(100, 104) → commit (4% 변동)', () => {
      expect(classifyChange(100, 104)).toBe('commit');
    });

    it('(100, 104.99) → commit (4.99%)', () => {
      expect(classifyChange(100, 104.99)).toBe('commit');
    });

    it('(100, 96) → commit (-4%)', () => {
      expect(classifyChange(100, 96)).toBe('commit');
    });
  });

  describe('5~30% 경계 (pr-update)', () => {
    it('(100, 105) → pr-update (정확히 5%)', () => {
      expect(classifyChange(100, 105)).toBe('pr-update');
    });

    it('(100, 105.01) → pr-update', () => {
      expect(classifyChange(100, 105.01)).toBe('pr-update');
    });

    it('(100, 129.99) → pr-update (29.99%)', () => {
      expect(classifyChange(100, 129.99)).toBe('pr-update');
    });

    it('(100, 95) → pr-update (-5%)', () => {
      expect(classifyChange(100, 95)).toBe('pr-update');
    });
  });

  describe('≥ 30% 경계 (pr-outlier)', () => {
    it('(100, 130) → pr-outlier (정확히 30%)', () => {
      expect(classifyChange(100, 130)).toBe('pr-outlier');
    });

    it('(100, 130.01) → pr-outlier', () => {
      expect(classifyChange(100, 130.01)).toBe('pr-outlier');
    });

    it('(100, 200) → pr-outlier (100% 변동)', () => {
      expect(classifyChange(100, 200)).toBe('pr-outlier');
    });

    it('(100, 0) → pr-outlier (0 으로 변동, -100%)', () => {
      expect(classifyChange(100, 0)).toBe('pr-outlier');
    });

    it('(100, 70) → pr-outlier (-30%)', () => {
      expect(classifyChange(100, 70)).toBe('pr-outlier');
    });
  });

  describe('0 값 처리', () => {
    it('(0, 100) → new (0 에서 시작은 new 처리)', () => {
      expect(classifyChange(0, 100)).toBe('new');
    });
  });

  describe('에러 케이스', () => {
    it('음수 oldVal → throws', () => {
      expect(() => classifyChange(-1, 100)).toThrow('must be non-negative');
    });

    it('음수 newVal → throws', () => {
      expect(() => classifyChange(100, -1)).toThrow('must be non-negative');
    });

    it('NaN oldVal → throws', () => {
      expect(() => classifyChange(NaN, 100)).toThrow('must not be NaN');
    });

    it('NaN newVal → throws', () => {
      expect(() => classifyChange(100, NaN)).toThrow('must not be NaN');
    });

    it('Infinity oldVal → throws', () => {
      expect(() => classifyChange(Infinity, 100)).toThrow('must be finite');
    });

    it('Infinity newVal → throws', () => {
      expect(() => classifyChange(100, Infinity)).toThrow('must be finite');
    });
  });
});

describe('computePctChange', () => {
  it('정상 증가: (100, 150) → 50', () => {
    expect(computePctChange(100, 150)).toBe(50);
  });

  it('정상 감소: (100, 80) → -20', () => {
    expect(computePctChange(100, 80)).toBe(-20);
  });

  it('변동 없음: (100, 100) → 0', () => {
    expect(computePctChange(100, 100)).toBe(0);
  });

  it('null → null: 0', () => {
    expect(computePctChange(null, null)).toBe(0);
  });

  it('null → 값: 100 (신규)', () => {
    expect(computePctChange(null, 100)).toBe(100);
  });

  it('값 → null: -100 (제거)', () => {
    expect(computePctChange(100, null)).toBe(-100);
  });

  it('0 → 값: 100', () => {
    expect(computePctChange(0, 100)).toBe(100);
  });

  it('0 → 0: 0', () => {
    expect(computePctChange(0, 0)).toBe(0);
  });
});

describe('iterNumericFields', () => {
  // PR #20 review round 8 — us_census.mjs 의 `rent.censusMedian` 은 cross-validation 보조 필드라
  // outlier PR 트리거 대상이 아님. 본 테스트가 추적 제외 정책을 회귀 차단한다.
  // 정책이 변경되어 censusMedian 도 추적해야 한다면 본 테스트 + us_census.mjs 모듈 주석 + TESTING.md 동기화.
  it('rent.censusMedian 는 추적하지 않음 (cross-validation 전용 보조 필드)', () => {
    const oldData = {
      rent: { share: 1000, studio: 1500, oneBed: 1800, twoBed: 2200, censusMedian: 2100 },
      food: { restaurantMeal: 20, cafe: 5, groceries: {} },
      transport: { monthlyPass: 100, singleRide: 2.5, taxiBase: 3 },
      tuition: [],
      visa: { studentApplicationFee: 100, workApplicationFee: 200, settlementApprox: 3000 },
    };
    const newData = {
      rent: { share: 1100, studio: 1600, oneBed: 1900, twoBed: 2300, censusMedian: 2400 },
      food: { restaurantMeal: 20, cafe: 5, groceries: {} },
      transport: { monthlyPass: 100, singleRide: 2.5, taxiBase: 3 },
      tuition: [],
      visa: { studentApplicationFee: 100, workApplicationFee: 200, settlementApprox: 3000 },
    };

    const paths = [...iterNumericFields(oldData, newData)].map((f) => f.path);

    expect(paths).toContain('rent.share');
    expect(paths).toContain('rent.studio');
    expect(paths).toContain('rent.oneBed');
    expect(paths).toContain('rent.twoBed');
    expect(paths).not.toContain('rent.censusMedian');
  });

  it('tax / rent.deposit 도 추적하지 않음 (의도적 제외)', () => {
    // 모듈 주석에 명시된 정책 — fetcher 가 채우지 않거나 변동 알림이 의미 없는 필드.
    const oldData = {
      rent: { share: 1000, deposit: 5000 },
      food: {},
      transport: {},
      tax: { annualSalary: 50000000, takeHomePctApprox: 0.78 },
    };
    const newData = {
      rent: { share: 1100, deposit: 6000 },
      food: {},
      transport: {},
      tax: { annualSalary: 55000000, takeHomePctApprox: 0.77 },
    };

    const paths = [...iterNumericFields(oldData, newData)].map((f) => f.path);

    expect(paths).toContain('rent.share');
    expect(paths).not.toContain('rent.deposit');
    expect(paths).not.toContain('tax.annualSalary');
    expect(paths).not.toContain('tax.takeHomePctApprox');
  });
});
