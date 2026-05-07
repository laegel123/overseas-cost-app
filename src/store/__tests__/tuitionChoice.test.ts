/**
 * docs/TESTING.md §9.8.2 매트릭스 — useTuitionChoiceStore + resolveTuitionChoice (ADR-061).
 *
 * 카테고리: 기본 동작 / 영속화 / 손상 캐시 / Fallback resolver / custom 입력.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CityCostData } from '@/types/city';

import { resolveTuitionChoice, useTuitionChoiceStore } from '../tuitionChoice';

const PERSIST_KEY = 'tuitionChoice:v1';

const tuitionEntries: NonNullable<CityCostData['tuition']> = [
  { school: 'Sorbonne', level: 'undergrad', annual: 3800 },
  { school: 'Sciences Po', level: 'undergrad', annual: 14500 },
];

beforeEach(async () => {
  await AsyncStorage.clear();
  useTuitionChoiceStore.getState().reset();
  await useTuitionChoiceStore.persist.rehydrate();
});

describe('기본 동작', () => {
  it('초기 상태는 { choices: {} } — 도시별 미선택', () => {
    expect(useTuitionChoiceStore.getState().choices).toEqual({});
  });

  it("setTuitionChoice('paris', { kind: 'preset', school: 'Sorbonne' }) → 도시별 entry", () => {
    useTuitionChoiceStore
      .getState()
      .setTuitionChoice('paris', { kind: 'preset', school: 'Sorbonne' });
    expect(useTuitionChoiceStore.getState().choices.paris).toEqual({
      kind: 'preset',
      school: 'Sorbonne',
    });
  });

  it("setTuitionChoice('paris', { kind: 'custom', annual: 9000 }) → custom entry", () => {
    useTuitionChoiceStore
      .getState()
      .setTuitionChoice('paris', { kind: 'custom', annual: 9000 });
    expect(useTuitionChoiceStore.getState().choices.paris).toEqual({
      kind: 'custom',
      annual: 9000,
    });
  });

  it('도시별 선택은 독립 — paris 와 london 동시 보존', () => {
    useTuitionChoiceStore
      .getState()
      .setTuitionChoice('paris', { kind: 'preset', school: 'Sorbonne' });
    useTuitionChoiceStore
      .getState()
      .setTuitionChoice('london', { kind: 'custom', annual: 30000 });
    expect(useTuitionChoiceStore.getState().choices).toEqual({
      paris: { kind: 'preset', school: 'Sorbonne' },
      london: { kind: 'custom', annual: 30000 },
    });
  });

  it("clearTuitionChoice('paris') → 그 도시만 제거", () => {
    useTuitionChoiceStore
      .getState()
      .setTuitionChoice('paris', { kind: 'preset', school: 'Sorbonne' });
    useTuitionChoiceStore
      .getState()
      .setTuitionChoice('london', { kind: 'custom', annual: 30000 });
    useTuitionChoiceStore.getState().clearTuitionChoice('paris');
    expect(useTuitionChoiceStore.getState().choices).toEqual({
      london: { kind: 'custom', annual: 30000 },
    });
  });

  it('clearTuitionChoice 미존재 cityId → state 변경 없음 (no-op)', () => {
    useTuitionChoiceStore
      .getState()
      .setTuitionChoice('paris', { kind: 'preset', school: 'Sorbonne' });
    const before = useTuitionChoiceStore.getState().choices;
    useTuitionChoiceStore.getState().clearTuitionChoice('nonexistent');
    expect(useTuitionChoiceStore.getState().choices).toBe(before);
  });

  it('reset() → 모든 도시 선택 제거', () => {
    useTuitionChoiceStore
      .getState()
      .setTuitionChoice('paris', { kind: 'preset', school: 'Sorbonne' });
    useTuitionChoiceStore.getState().reset();
    expect(useTuitionChoiceStore.getState().choices).toEqual({});
  });
});

describe('영속화', () => {
  it('persist key 는 정확히 tuitionChoice:v1', async () => {
    useTuitionChoiceStore
      .getState()
      .setTuitionChoice('paris', { kind: 'preset', school: 'Sorbonne' });
    await Promise.resolve();
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    expect(raw).not.toBeNull();
  });

  it('partialize: 액션은 영속화되지 않고 choices 만 저장', async () => {
    useTuitionChoiceStore
      .getState()
      .setTuitionChoice('paris', { kind: 'custom', annual: 9000 });
    await Promise.resolve();
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    const parsed = JSON.parse(raw as string) as {
      state: Record<string, unknown>;
      version: number;
    };
    expect(parsed.state.choices).toEqual({
      paris: { kind: 'custom', annual: 9000 },
    });
    expect(parsed.state.setTuitionChoice).toBeUndefined();
    expect(parsed.state.clearTuitionChoice).toBeUndefined();
    expect(parsed.state.reset).toBeUndefined();
    expect(parsed.version).toBe(1);
  });

  it('round-trip: storage 에 박힌 v1 entry → rehydrate 후 메모리 반영', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { choices: { paris: { kind: 'preset', school: 'Sorbonne' } } },
        version: 1,
      }),
    );
    expect(useTuitionChoiceStore.getState().choices).toEqual({});
    await useTuitionChoiceStore.persist.rehydrate();
    expect(useTuitionChoiceStore.getState().choices).toEqual({
      paris: { kind: 'preset', school: 'Sorbonne' },
    });
  });
});

describe('손상 캐시 — INITIAL fallback (silent fail 금지)', () => {
  it('잘못된 JSON → INITIAL', async () => {
    await AsyncStorage.setItem(PERSIST_KEY, '{ broken json');
    await useTuitionChoiceStore.persist.rehydrate();
    expect(useTuitionChoiceStore.getState().choices).toEqual({});
  });

  it('choices 누락 → INITIAL', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({ state: {}, version: 1 }),
    );
    await useTuitionChoiceStore.persist.rehydrate();
    expect(useTuitionChoiceStore.getState().choices).toEqual({});
  });

  it('알 수 없는 kind → INITIAL', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { choices: { paris: { kind: 'unknown', school: 'X' } } },
        version: 1,
      }),
    );
    await useTuitionChoiceStore.persist.rehydrate();
    expect(useTuitionChoiceStore.getState().choices).toEqual({});
  });

  it('preset 의 school 누락 → INITIAL', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { choices: { paris: { kind: 'preset' } } },
        version: 1,
      }),
    );
    await useTuitionChoiceStore.persist.rehydrate();
    expect(useTuitionChoiceStore.getState().choices).toEqual({});
  });

  it('custom 의 annual 이 음수/0 → INITIAL', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { choices: { paris: { kind: 'custom', annual: -100 } } },
        version: 1,
      }),
    );
    await useTuitionChoiceStore.persist.rehydrate();
    expect(useTuitionChoiceStore.getState().choices).toEqual({});
  });

  it('custom 의 annual 이 NaN → INITIAL', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { choices: { paris: { kind: 'custom', annual: 'abc' } } },
        version: 1,
      }),
    );
    await useTuitionChoiceStore.persist.rehydrate();
    expect(useTuitionChoiceStore.getState().choices).toEqual({});
  });
});

describe('resolveTuitionChoice (순수 함수 — Compare/Detail 단일 fallback 정책)', () => {
  it('choice 미지정 + entries 있음 → entries[0] fallback', () => {
    expect(resolveTuitionChoice(tuitionEntries, undefined)).toEqual({
      school: 'Sorbonne',
      annual: 3800,
      isCustom: false,
    });
  });

  it('preset choice 매칭 성공', () => {
    const r = resolveTuitionChoice(tuitionEntries, {
      kind: 'preset',
      school: 'Sciences Po',
    });
    expect(r).toEqual({ school: 'Sciences Po', annual: 14500, isCustom: false });
  });

  it('preset choice 매칭 실패 → entries[0] fallback (학교 사라진 케이스)', () => {
    const r = resolveTuitionChoice(tuitionEntries, {
      kind: 'preset',
      school: 'Removed School',
    });
    expect(r).toEqual({ school: 'Sorbonne', annual: 3800, isCustom: false });
  });

  it('custom choice → entries 무시하고 그대로 사용', () => {
    const r = resolveTuitionChoice(tuitionEntries, {
      kind: 'custom',
      annual: 9000,
    });
    expect(r).toEqual({ school: '직접 입력', annual: 9000, isCustom: true });
  });

  it('entries 부재 + preset choice → null (도시 데이터 없음)', () => {
    expect(
      resolveTuitionChoice(undefined, { kind: 'preset', school: 'X' }),
    ).toBeNull();
    expect(
      resolveTuitionChoice([], { kind: 'preset', school: 'X' }),
    ).toBeNull();
  });

  it('entries 부재 + custom choice → custom 그대로 (도시 entries 없어도 사용자 입력은 유효)', () => {
    expect(
      resolveTuitionChoice(undefined, { kind: 'custom', annual: 9000 }),
    ).toEqual({ school: '직접 입력', annual: 9000, isCustom: true });
  });

  it('entries 부재 + choice 미지정 → null', () => {
    expect(resolveTuitionChoice(undefined, undefined)).toBeNull();
    expect(resolveTuitionChoice([], undefined)).toBeNull();
  });
});
