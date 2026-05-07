/**
 * docs/TESTING.md §9.8.3 매트릭스 — useTaxChoiceStore + resolveTaxChoice (ADR-061).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CityCostData } from '@/types/city';

import { resolveTaxChoice, useTaxChoiceStore } from '../taxChoice';

const PERSIST_KEY = 'taxChoice:v1';

const taxEntries: NonNullable<CityCostData['tax']> = [
  { annualSalary: 60000, takeHomePctApprox: 0.74 },
  { annualSalary: 80000, takeHomePctApprox: 0.7 },
];

beforeEach(async () => {
  await AsyncStorage.clear();
  useTaxChoiceStore.getState().reset();
  await useTaxChoiceStore.persist.rehydrate();
});

describe('기본 동작', () => {
  it('초기 상태는 { choices: {} }', () => {
    expect(useTaxChoiceStore.getState().choices).toEqual({});
  });

  it("setTaxChoice('vancouver', preset 60000) → 도시별 entry", () => {
    useTaxChoiceStore
      .getState()
      .setTaxChoice('vancouver', { kind: 'preset', annualSalary: 60000 });
    expect(useTaxChoiceStore.getState().choices.vancouver).toEqual({
      kind: 'preset',
      annualSalary: 60000,
    });
  });

  it("setTaxChoice('vancouver', custom 75000) → custom entry", () => {
    useTaxChoiceStore
      .getState()
      .setTaxChoice('vancouver', { kind: 'custom', annualSalary: 75000 });
    expect(useTaxChoiceStore.getState().choices.vancouver).toEqual({
      kind: 'custom',
      annualSalary: 75000,
    });
  });

  it('도시별 선택 독립', () => {
    useTaxChoiceStore
      .getState()
      .setTaxChoice('vancouver', { kind: 'preset', annualSalary: 60000 });
    useTaxChoiceStore
      .getState()
      .setTaxChoice('nyc', { kind: 'custom', annualSalary: 90000 });
    expect(useTaxChoiceStore.getState().choices).toEqual({
      vancouver: { kind: 'preset', annualSalary: 60000 },
      nyc: { kind: 'custom', annualSalary: 90000 },
    });
  });

  // PR #25 2차 review — tuitionChoice 와 동일한 도시별 독립 제거 케이스.
  it("clearTaxChoice('vancouver') → 그 도시만 제거 (다른 도시 보존)", () => {
    useTaxChoiceStore
      .getState()
      .setTaxChoice('vancouver', { kind: 'preset', annualSalary: 60000 });
    useTaxChoiceStore
      .getState()
      .setTaxChoice('nyc', { kind: 'custom', annualSalary: 90000 });
    useTaxChoiceStore.getState().clearTaxChoice('vancouver');
    expect(useTaxChoiceStore.getState().choices).toEqual({
      nyc: { kind: 'custom', annualSalary: 90000 },
    });
  });

  it('clearTaxChoice 미존재 cityId → no-op', () => {
    useTaxChoiceStore
      .getState()
      .setTaxChoice('vancouver', { kind: 'preset', annualSalary: 60000 });
    const before = useTaxChoiceStore.getState().choices;
    useTaxChoiceStore.getState().clearTaxChoice('nonexistent');
    expect(useTaxChoiceStore.getState().choices).toBe(before);
  });

  it('reset() → 모두 제거', () => {
    useTaxChoiceStore
      .getState()
      .setTaxChoice('vancouver', { kind: 'preset', annualSalary: 60000 });
    useTaxChoiceStore.getState().reset();
    expect(useTaxChoiceStore.getState().choices).toEqual({});
  });
});

describe('영속화', () => {
  it('persist key 는 정확히 taxChoice:v1', async () => {
    useTaxChoiceStore
      .getState()
      .setTaxChoice('vancouver', { kind: 'preset', annualSalary: 60000 });
    await Promise.resolve();
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    expect(raw).not.toBeNull();
  });

  it('partialize: 액션 미영속, choices 만 저장', async () => {
    useTaxChoiceStore
      .getState()
      .setTaxChoice('vancouver', { kind: 'custom', annualSalary: 75000 });
    await Promise.resolve();
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    const parsed = JSON.parse(raw as string) as {
      state: Record<string, unknown>;
      version: number;
    };
    expect(parsed.state.choices).toEqual({
      vancouver: { kind: 'custom', annualSalary: 75000 },
    });
    expect(parsed.state.setTaxChoice).toBeUndefined();
    expect(parsed.version).toBe(1);
  });

  it('round-trip', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: {
          choices: { vancouver: { kind: 'preset', annualSalary: 60000 } },
        },
        version: 1,
      }),
    );
    expect(useTaxChoiceStore.getState().choices).toEqual({});
    await useTaxChoiceStore.persist.rehydrate();
    expect(useTaxChoiceStore.getState().choices).toEqual({
      vancouver: { kind: 'preset', annualSalary: 60000 },
    });
  });
});

describe('손상 캐시 — INITIAL fallback', () => {
  it('잘못된 JSON → INITIAL', async () => {
    await AsyncStorage.setItem(PERSIST_KEY, '{ broken');
    await useTaxChoiceStore.persist.rehydrate();
    expect(useTaxChoiceStore.getState().choices).toEqual({});
  });

  it('알 수 없는 kind → INITIAL', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: {
          choices: { vancouver: { kind: 'weird', annualSalary: 60000 } },
        },
        version: 1,
      }),
    );
    await useTaxChoiceStore.persist.rehydrate();
    expect(useTaxChoiceStore.getState().choices).toEqual({});
  });

  it('annualSalary 가 음수 → INITIAL', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: {
          choices: { vancouver: { kind: 'custom', annualSalary: -1 } },
        },
        version: 1,
      }),
    );
    await useTaxChoiceStore.persist.rehydrate();
    expect(useTaxChoiceStore.getState().choices).toEqual({});
  });
});

describe('resolveTaxChoice', () => {
  it('choice 미지정 + entries 있음 → entries[0] fallback', () => {
    expect(resolveTaxChoice(taxEntries, undefined)).toEqual({
      annualSalary: 60000,
      takeHomePctApprox: 0.74,
      isCustom: false,
    });
  });

  it('preset 매칭 성공', () => {
    expect(
      resolveTaxChoice(taxEntries, { kind: 'preset', annualSalary: 80000 }),
    ).toEqual({
      annualSalary: 80000,
      takeHomePctApprox: 0.7,
      isCustom: false,
    });
  });

  it('preset 매칭 실패 → entries[0] fallback', () => {
    expect(
      resolveTaxChoice(taxEntries, { kind: 'preset', annualSalary: 999999 }),
    ).toEqual({
      annualSalary: 60000,
      takeHomePctApprox: 0.74,
      isCustom: false,
    });
  });

  it('custom → annualSalary 사용 + 도시 첫 preset 의 takeHomePct', () => {
    expect(
      resolveTaxChoice(taxEntries, { kind: 'custom', annualSalary: 75000 }),
    ).toEqual({
      annualSalary: 75000,
      takeHomePctApprox: 0.74,
      isCustom: true,
    });
  });

  it('custom + entries 부재 → null (takeHomePct 차용 불가)', () => {
    expect(
      resolveTaxChoice(undefined, { kind: 'custom', annualSalary: 75000 }),
    ).toBeNull();
    expect(
      resolveTaxChoice([], { kind: 'custom', annualSalary: 75000 }),
    ).toBeNull();
  });

  it('entries 부재 + choice 미지정 → null', () => {
    expect(resolveTaxChoice(undefined, undefined)).toBeNull();
    expect(resolveTaxChoice([], undefined)).toBeNull();
  });
});
