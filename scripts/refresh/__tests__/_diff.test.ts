/**
 * _diff.mjs 테스트.
 * TESTING.md §9-A.1 diffCities 인벤토리.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
import { diffCities } from '../_diff.mjs';

const baseCity: any = {
  id: 'test',
  name: { ko: '테스트', en: 'Test' },
  country: 'KR',
  currency: 'KRW',
  region: 'asia',
  lastUpdated: '2026-04-01',
  rent: { share: 500000, studio: 700000, oneBed: 900000, twoBed: 1500000 },
  food: {
    restaurantMeal: 9000,
    cafe: 5000,
    groceries: { milk1L: 3000, eggs12: 5500, rice1kg: 4500, chicken1kg: 12000, bread: 4000 },
  },
  transport: { monthlyPass: 65000, singleRide: 1400, taxiBase: 4800 },
  sources: [{ category: 'rent', name: 'Test', url: 'https://example.com', accessedAt: '2026-04-01' }],
};

describe('diffCities', () => {
  it('변경 없음: 빈 배열', () => {
    const result = diffCities(baseCity, { ...baseCity });
    expect(result).toEqual([]);
  });

  it('단일 필드 변경: 1 record', () => {
    const newCity = {
      ...baseCity,
      rent: { ...baseCity.rent, oneBed: 1000000 },
    };
    const result = diffCities(baseCity, newCity);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      field: 'rent.oneBed',
      oldValue: 900000,
      newValue: 1000000,
    });
    expect(result[0]!.pctChange).toBeCloseTo(11.11, 1);
  });

  it('다중 필드 변경: 다 record', () => {
    const newCity = {
      ...baseCity,
      rent: { ...baseCity.rent, oneBed: 1000000, twoBed: 1600000 },
    };
    const result = diffCities(baseCity, newCity);

    expect(result).toHaveLength(2);
    expect(result.map((r: any) => r.field).sort()).toEqual(['rent.oneBed', 'rent.twoBed']);
  });

  it('중첩 필드 (food.groceries.milk1L): dot-path 표현', () => {
    const newCity = {
      ...baseCity,
      food: {
        ...baseCity.food,
        groceries: { ...baseCity.food.groceries, milk1L: 3500 },
      },
    };
    const result = diffCities(baseCity, newCity);

    expect(result).toHaveLength(1);
    expect(result[0]!.field).toBe('food.groceries.milk1L');
    expect(result[0]!.oldValue).toBe(3000);
    expect(result[0]!.newValue).toBe(3500);
  });

  it('신규 필드 (oldData 에 없음): oldValue=null', () => {
    const oldCity = {
      ...baseCity,
      rent: { share: 500000, studio: 700000, oneBed: null, twoBed: 1500000 },
    };
    const newCity = {
      ...baseCity,
      rent: { ...baseCity.rent, oneBed: 900000 },
    };
    const result = diffCities(oldCity, newCity);

    const oneBedChange = result.find((r: any) => r.field === 'rent.oneBed');
    expect(oneBedChange).toBeDefined();
    expect(oneBedChange!.oldValue).toBe(null);
    expect(oneBedChange!.newValue).toBe(900000);
  });

  it('제거된 필드: newValue=null', () => {
    const newCity = {
      ...baseCity,
      rent: { ...baseCity.rent, oneBed: null },
    };
    const result = diffCities(baseCity, newCity);

    const oneBedChange = result.find((r: any) => r.field === 'rent.oneBed');
    expect(oneBedChange).toBeDefined();
    expect(oneBedChange!.oldValue).toBe(900000);
    expect(oneBedChange!.newValue).toBe(null);
  });

  it('배열 변경 (tuition[]): 각 원소별 record', () => {
    const oldCity = {
      ...baseCity,
      tuition: [
        { school: 'UBC', level: 'undergrad', annual: 45000 },
        { school: 'SFU', level: 'undergrad', annual: 35000 },
      ],
    };
    const newCity = {
      ...baseCity,
      tuition: [
        { school: 'UBC', level: 'undergrad', annual: 48000 },
        { school: 'SFU', level: 'undergrad', annual: 35000 },
      ],
    };
    const result = diffCities(oldCity, newCity);

    expect(result).toHaveLength(1);
    expect(result[0]!.field).toBe('tuition[0].annual');
    expect(result[0]!.oldValue).toBe(45000);
    expect(result[0]!.newValue).toBe(48000);
  });

  it('메타 필드 (lastUpdated, sources): 변경 추적 제외', () => {
    const newCity = {
      ...baseCity,
      lastUpdated: '2026-05-01',
      sources: [
        { category: 'rent', name: 'Updated', url: 'https://new.com', accessedAt: '2026-05-01' },
      ],
    };
    const result = diffCities(baseCity, newCity);

    expect(result).toHaveLength(0);
  });

  it('id 필드: 변경 추적 제외', () => {
    const newCity = { ...baseCity, id: 'new-id' };
    const result = diffCities(baseCity, newCity);

    expect(result).toHaveLength(0);
  });

  it('pctChange 계산 정확', () => {
    const newCity = {
      ...baseCity,
      rent: { ...baseCity.rent, oneBed: 1080000 },
    };
    const result = diffCities(baseCity, newCity);

    expect(result[0]!.pctChange).toBe(20);
  });

  it('복합 변경: 여러 섹션 동시', () => {
    const newCity = {
      ...baseCity,
      rent: { ...baseCity.rent, oneBed: 1000000 },
      food: { ...baseCity.food, restaurantMeal: 10000 },
      transport: { ...baseCity.transport, monthlyPass: 70000 },
    };
    const result = diffCities(baseCity, newCity);

    expect(result).toHaveLength(3);
    expect(result.map((r: any) => r.field).sort()).toEqual([
      'food.restaurantMeal',
      'rent.oneBed',
      'transport.monthlyPass',
    ]);
  });
});
