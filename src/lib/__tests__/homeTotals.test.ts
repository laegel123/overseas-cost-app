/**
 * docs/TESTING.md §9.3.1 — computeCityTotal / multFromTotals (ADR-056 단일 출처).
 *
 * Home 카드 배수용 단순화 총비용. rent(첫 non-null) + food(외식 20일 + groceries
 * 4종 4회) + transport.monthlyPass 만 합산. 세금·비자·학비·ramen·bread·onion·apple
 * 제외 — 도시 간 비교 가능한 근사값만.
 */

import { seoulValid } from '@/__fixtures__/cities/seoul-valid';
import { vancouverValid } from '@/__fixtures__/cities/vancouver-valid';
import type { CityCostData, ExchangeRates } from '@/types/city';

import { computeCityTotal, multFromTotals } from '../homeTotals';

const FX: ExchangeRates = { CAD: 980 };

describe('computeCityTotal', () => {
  it('밴쿠버 (CAD) — rent share + food(외식 20일 + groceries 4종 4회) + monthlyPass', () => {
    // rent share 950 CAD → 931,000
    // food (22+6)*20 + (3.4+7.5+4.2+17.5)*4 = 560 + 130.4 = 690.4 CAD → 676,592
    // transport 105 CAD → 102,900
    expect(computeCityTotal(vancouverValid, FX)).toBe(931_000 + 676_592 + 102_900);
  });

  it('서울 (KRW) — pass-through 합산 (fx 무관)', () => {
    // rent 350,000 + food (10400+5900)*20 + (3200+2600+2750+12000)*4 + transport 65,000
    // = 350,000 + 408,200 + 65,000
    expect(computeCityTotal(seoulValid, {})).toBe(350_000 + 408_200 + 65_000);
  });

  it('groceries 는 milk/eggs/rice/chicken 4종만 — ramen·bread·onion·apple 제외', () => {
    const inflated: CityCostData = {
      ...vancouverValid,
      food: {
        ...vancouverValid.food,
        groceries: {
          ...vancouverValid.food.groceries,
          ramen: 99_999,
          bread: 99_999,
          onion1kg: 99_999,
          apple1kg: 99_999,
        },
      },
    };
    expect(computeCityTotal(inflated, FX)).toBe(computeCityTotal(vancouverValid, FX));
  });

  it('rent 는 share ?? studio ?? oneBed 순 fallback', () => {
    const noShare: CityCostData = {
      ...vancouverValid,
      rent: { ...vancouverValid.rent, share: null },
    };
    // studio 1800 CAD 사용 → food·transport 동일, rent 만 차이
    const delta = (1800 - 950) * 980;
    expect(computeCityTotal(noShare, FX)).toBe(computeCityTotal(vancouverValid, FX) + delta);
  });

  it('rent 전부 null → 0 으로 fallback (food + transport 만)', () => {
    const noRent: CityCostData = {
      ...vancouverValid,
      rent: { share: null, studio: null, oneBed: null, twoBed: null },
    };
    expect(computeCityTotal(noRent, FX)).toBe(computeCityTotal(vancouverValid, FX) - 931_000);
  });
});

describe('multFromTotals', () => {
  it('도시 총비용 / 서울 총비용 배수', () => {
    const seoulTotal = computeCityTotal(seoulValid, {});
    const cityTotal = computeCityTotal(vancouverValid, FX);
    expect(multFromTotals(vancouverValid, seoulTotal, FX)).toBe(cityTotal / seoulTotal);
  });

  it("서울 총비용 0 + 도시 총비용 > 0 → '신규'", () => {
    expect(multFromTotals(vancouverValid, 0, FX)).toBe('신규');
  });
});
