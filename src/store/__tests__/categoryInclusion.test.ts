/**
 * docs/TESTING.md §9.8.4 매트릭스 — useCategoryInclusionStore + resolveInclusion +
 * getDefaultInclusion (ADR-062).
 *
 * 카테고리: 기본 동작 / 영속화 / 손상 캐시 / Default 페르소나 분기 / Resolver.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Persona, SourceCategory } from '@/types/city';

import {
  getDefaultInclusion,
  resolveInclusion,
  useCategoryInclusionStore,
} from '../categoryInclusion';

const PERSIST_KEY = 'categoryInclusion:v1';

beforeEach(async () => {
  await AsyncStorage.clear();
  useCategoryInclusionStore.getState().reset();
  await useCategoryInclusionStore.persist.rehydrate();
});

describe('기본 동작', () => {
  it('초기 상태는 { inclusions: {} }', () => {
    expect(useCategoryInclusionStore.getState().inclusions).toEqual({});
  });

  it("setInclusion('osaka', 'rent', false) → 도시별 entry", () => {
    useCategoryInclusionStore.getState().setInclusion('osaka', 'rent', false);
    expect(useCategoryInclusionStore.getState().inclusions.osaka).toEqual({
      rent: false,
    });
  });

  it('같은 도시 내 여러 카테고리 독립 보존', () => {
    useCategoryInclusionStore.getState().setInclusion('osaka', 'tuition', true);
    useCategoryInclusionStore.getState().setInclusion('osaka', 'visa', true);
    expect(useCategoryInclusionStore.getState().inclusions.osaka).toEqual({
      tuition: true,
      visa: true,
    });
  });

  it('도시별 선택은 독립 — osaka 와 vancouver 동시 보존', () => {
    useCategoryInclusionStore.getState().setInclusion('osaka', 'tuition', true);
    useCategoryInclusionStore
      .getState()
      .setInclusion('vancouver', 'tuition', false);
    expect(useCategoryInclusionStore.getState().inclusions).toEqual({
      osaka: { tuition: true },
      vancouver: { tuition: false },
    });
  });

  it('setInclusion 같은 키 재설정 → 덮어쓰기', () => {
    useCategoryInclusionStore.getState().setInclusion('osaka', 'rent', false);
    useCategoryInclusionStore.getState().setInclusion('osaka', 'rent', true);
    expect(useCategoryInclusionStore.getState().inclusions.osaka).toEqual({
      rent: true,
    });
  });

  it("resetCity('osaka') → 그 도시만 제거, 다른 도시는 보존", () => {
    useCategoryInclusionStore.getState().setInclusion('osaka', 'tuition', true);
    useCategoryInclusionStore
      .getState()
      .setInclusion('vancouver', 'tuition', false);
    useCategoryInclusionStore.getState().resetCity('osaka');
    expect(useCategoryInclusionStore.getState().inclusions).toEqual({
      vancouver: { tuition: false },
    });
  });

  it('resetCity 미존재 cityId → state 변경 없음 (no-op)', () => {
    useCategoryInclusionStore.getState().setInclusion('osaka', 'tuition', true);
    const before = useCategoryInclusionStore.getState().inclusions;
    useCategoryInclusionStore.getState().resetCity('nonexistent');
    expect(useCategoryInclusionStore.getState().inclusions).toBe(before);
  });

  it('reset() → 모든 도시 entry 제거', () => {
    useCategoryInclusionStore.getState().setInclusion('osaka', 'tuition', true);
    useCategoryInclusionStore
      .getState()
      .setInclusion('vancouver', 'visa', true);
    useCategoryInclusionStore.getState().reset();
    expect(useCategoryInclusionStore.getState().inclusions).toEqual({});
  });
});

describe('영속화', () => {
  it('persist key 는 정확히 categoryInclusion:v1', async () => {
    useCategoryInclusionStore.getState().setInclusion('osaka', 'rent', false);
    await Promise.resolve();
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    expect(raw).not.toBeNull();
  });

  it('partialize: 액션은 영속화되지 않고 inclusions 만 저장', async () => {
    useCategoryInclusionStore.getState().setInclusion('osaka', 'tuition', true);
    await Promise.resolve();
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    const parsed = JSON.parse(raw as string) as {
      state: Record<string, unknown>;
      version: number;
    };
    expect(parsed.state.inclusions).toEqual({ osaka: { tuition: true } });
    expect(parsed.state.setInclusion).toBeUndefined();
    expect(parsed.state.resetCity).toBeUndefined();
    expect(parsed.state.reset).toBeUndefined();
    expect(parsed.version).toBe(1);
  });

  it('round-trip: storage 에 박힌 v1 entry → rehydrate 후 메모리 반영', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: {
          inclusions: { osaka: { tuition: true, visa: false } },
        },
        version: 1,
      }),
    );
    expect(useCategoryInclusionStore.getState().inclusions).toEqual({});
    await useCategoryInclusionStore.persist.rehydrate();
    expect(useCategoryInclusionStore.getState().inclusions).toEqual({
      osaka: { tuition: true, visa: false },
    });
  });
});

describe('손상 캐시 — INITIAL fallback (silent fail 금지)', () => {
  it('잘못된 JSON → INITIAL', async () => {
    await AsyncStorage.setItem(PERSIST_KEY, '{ broken json');
    await useCategoryInclusionStore.persist.rehydrate();
    expect(useCategoryInclusionStore.getState().inclusions).toEqual({});
  });

  it('inclusions 누락 → INITIAL', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({ state: {}, version: 1 }),
    );
    await useCategoryInclusionStore.persist.rehydrate();
    expect(useCategoryInclusionStore.getState().inclusions).toEqual({});
  });

  it('알 수 없는 카테고리 키 → INITIAL', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { inclusions: { osaka: { unknownCategory: true } } },
        version: 1,
      }),
    );
    await useCategoryInclusionStore.persist.rehydrate();
    expect(useCategoryInclusionStore.getState().inclusions).toEqual({});
  });

  it('boolean 아닌 값 → INITIAL', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { inclusions: { osaka: { rent: 'yes' } } },
        version: 1,
      }),
    );
    await useCategoryInclusionStore.persist.rehydrate();
    expect(useCategoryInclusionStore.getState().inclusions).toEqual({});
  });

  it('city map 자체가 객체가 아님 → INITIAL', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { inclusions: { osaka: 'not-an-object' } },
        version: 1,
      }),
    );
    await useCategoryInclusionStore.persist.rehydrate();
    expect(useCategoryInclusionStore.getState().inclusions).toEqual({});
  });
});

describe('getDefaultInclusion — persona-aware default 매트릭스', () => {
  const ALL_PERSONAS: Persona[] = ['student', 'worker', 'unknown'];

  it.each(ALL_PERSONAS)(
    'rent/food/transport 는 페르소나 %s 와 무관하게 항상 true',
    (persona) => {
      expect(getDefaultInclusion('rent', persona)).toBe(true);
      expect(getDefaultInclusion('food', persona)).toBe(true);
      expect(getDefaultInclusion('transport', persona)).toBe(true);
    },
  );

  it('tuition: student → true, worker/unknown → false', () => {
    expect(getDefaultInclusion('tuition', 'student')).toBe(true);
    expect(getDefaultInclusion('tuition', 'worker')).toBe(false);
    expect(getDefaultInclusion('tuition', 'unknown')).toBe(false);
  });

  it('tax: worker → true, student/unknown → false', () => {
    expect(getDefaultInclusion('tax', 'worker')).toBe(true);
    expect(getDefaultInclusion('tax', 'student')).toBe(false);
    expect(getDefaultInclusion('tax', 'unknown')).toBe(false);
  });

  it.each(ALL_PERSONAS)(
    'visa 는 페르소나 %s 와 무관하게 항상 false (일회성/조건부)',
    (persona) => {
      expect(getDefaultInclusion('visa', persona)).toBe(false);
    },
  );
});

describe('resolveInclusion (사용자 토글 우선 → default fallback)', () => {
  it('명시 토글값(true) → 그 값 반환', () => {
    expect(
      resolveInclusion('osaka', 'visa', 'unknown', {
        osaka: { visa: true },
      }),
    ).toBe(true);
  });

  it('명시 토글값(false) → 그 값 반환 (rent default true 위에 false override)', () => {
    expect(
      resolveInclusion('osaka', 'rent', 'student', {
        osaka: { rent: false },
      }),
    ).toBe(false);
  });

  it('미설정 도시 → persona default 적용', () => {
    expect(resolveInclusion('osaka', 'rent', 'student', {})).toBe(true);
    expect(resolveInclusion('osaka', 'tuition', 'worker', {})).toBe(false);
  });

  it('다른 도시의 토글이 현재 도시에 영향 없음', () => {
    expect(
      resolveInclusion('osaka', 'tuition', 'worker', {
        vancouver: { tuition: true },
      }),
    ).toBe(false);
  });

  it('다른 카테고리의 토글이 현재 카테고리에 영향 없음', () => {
    expect(
      resolveInclusion('osaka', 'tuition', 'student', {
        osaka: { visa: true },
      }),
    ).toBe(true);
  });

  it('도시 entry 빈 객체 → default 적용', () => {
    expect(resolveInclusion('osaka', 'rent', 'student', { osaka: {} })).toBe(true);
  });

  it.each<[SourceCategory, Persona, boolean]>([
    ['rent', 'student', true],
    ['food', 'worker', true],
    ['transport', 'unknown', true],
    ['tuition', 'student', true],
    ['tuition', 'worker', false],
    ['tax', 'worker', true],
    ['tax', 'student', false],
    ['visa', 'student', false],
    ['visa', 'worker', false],
    ['visa', 'unknown', false],
  ])(
    'default 매트릭스: %s × %s → %s',
    (category, persona, expected) => {
      expect(resolveInclusion('any-city', category, persona, {})).toBe(expected);
    },
  );
});
