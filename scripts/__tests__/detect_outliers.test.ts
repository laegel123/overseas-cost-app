/**
 * detect_outliers.mjs 의 핵심 로직 — `iterNumericFields` 평탄화 검증.
 * (CLI 진입점은 jest 에서 import 못 함 — `import.meta.url` 사용. babel-preset-expo 는 transform 미지원.
 *  로직이 _outlier.mjs 에 있어 직접 테스트.)
 * TESTING.md §9-A.11 인벤토리.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { iterNumericFields } from '../refresh/_outlier.mjs';

describe('iterNumericFields', () => {
  it('rent / food / transport top-level numeric 필드 평탄화', () => {
    const oldData = {
      rent: { share: 100, studio: 200, oneBed: 300, twoBed: 400 },
      food: { restaurantMeal: 10, cafe: 5, groceries: {} },
      transport: { monthlyPass: 50, singleRide: 2, taxiBase: 3 },
    };
    const newData = {
      rent: { share: 110, studio: 200, oneBed: 300, twoBed: 400 },
      food: { restaurantMeal: 10, cafe: 5, groceries: {} },
      transport: { monthlyPass: 50, singleRide: 2, taxiBase: 3 },
    };

    const fields = [...iterNumericFields(oldData, newData)];
    const shareEntry = fields.find((f: any) => f.path === 'rent.share');

    expect(shareEntry).toBeDefined();
    expect(shareEntry?.oldVal).toBe(100);
    expect(shareEntry?.newVal).toBe(110);
  });

  it('groceries — old/new 양쪽의 키 합집합으로 순회', () => {
    const oldData = {
      rent: {},
      food: { restaurantMeal: 1, cafe: 1, groceries: { milk1L: 1, eggs12: 2 } },
      transport: {},
    };
    const newData = {
      rent: {},
      food: { restaurantMeal: 1, cafe: 1, groceries: { milk1L: 1, rice1kg: 3 } },
      transport: {},
    };

    const fields = [...iterNumericFields(oldData, newData)];
    const groceryPaths = fields
      .filter((f: any) => f.path.startsWith('food.groceries.'))
      .map((f: any) => f.path);

    expect(groceryPaths).toEqual(
      expect.arrayContaining(['food.groceries.milk1L', 'food.groceries.eggs12', 'food.groceries.rice1kg']),
    );
  });

  it('tuition[i].annual 인덱스별 비교', () => {
    const oldData = {
      rent: {},
      food: { groceries: {} },
      transport: {},
      tuition: [
        { school: 'A', level: 'undergrad', annual: 100 },
        { school: 'B', level: 'undergrad', annual: 200 },
      ],
    };
    const newData = {
      rent: {},
      food: { groceries: {} },
      transport: {},
      tuition: [
        { school: 'A', level: 'undergrad', annual: 150 },
        { school: 'B', level: 'undergrad', annual: 200 },
        { school: 'C', level: 'undergrad', annual: 300 },
      ],
    };

    const fields = [...iterNumericFields(oldData, newData)];
    const tuitionPaths = fields.filter((f: any) => f.path.startsWith('tuition['));

    expect(tuitionPaths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'tuition[0].annual', oldVal: 100, newVal: 150 }),
        expect.objectContaining({ path: 'tuition[2].annual', oldVal: null, newVal: 300 }),
      ]),
    );
  });

  it('visa.* 필드 비교', () => {
    const oldData = {
      rent: {},
      food: { groceries: {} },
      transport: {},
      visa: { studentApplicationFee: 100, workApplicationFee: 200 },
    };
    const newData = {
      rent: {},
      food: { groceries: {} },
      transport: {},
      visa: { studentApplicationFee: 130, workApplicationFee: 200, settlementApprox: 5000 },
    };

    const fields = [...iterNumericFields(oldData, newData)];
    const visaPaths = fields.filter((f: any) => f.path.startsWith('visa.'));

    expect(visaPaths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'visa.studentApplicationFee', oldVal: 100, newVal: 130 }),
        expect.objectContaining({ path: 'visa.settlementApprox', oldVal: null, newVal: 5000 }),
      ]),
    );
  });

  it('null 값은 그대로 null 로 yield (예: rent.share=null)', () => {
    const oldData = {
      rent: { share: null, studio: 200 },
      food: { groceries: {} },
      transport: {},
    };
    const newData = {
      rent: { share: 100, studio: 200 },
      food: { groceries: {} },
      transport: {},
    };

    const fields = [...iterNumericFields(oldData, newData)];
    const shareEntry = fields.find((f: any) => f.path === 'rent.share');

    expect(shareEntry?.oldVal).toBeNull();
    expect(shareEntry?.newVal).toBe(100);
  });

  it('양쪽 모두 undefined 인 optional 섹션은 skip', () => {
    const oldData = {
      rent: {},
      food: { groceries: {} },
      transport: {},
    };
    const newData = {
      rent: {},
      food: { groceries: {} },
      transport: {},
    };

    const fields = [...iterNumericFields(oldData, newData)];
    const visaPaths = fields.filter((f: any) => f.path.startsWith('visa.'));
    const tuitionPaths = fields.filter((f: any) => f.path.startsWith('tuition['));

    expect(visaPaths).toEqual([]);
    expect(tuitionPaths).toEqual([]);
  });
});
