/**
 * docs/TESTING.md §9.x 매트릭스 — useRentChoiceStore + resolveRentChoice.
 *
 * 카테고리: 기본 동작 / 영속화 / Hydration race / 손상 캐시 / Fallback resolver.
 * AsyncStorage 는 jest.setup.js 의 AsyncStorageMock 으로 격리, 시간 의존 0.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CityCostData } from '@/types/city';

import {
  RENT_CHOICE_FALLBACK_ORDER,
  resolveRentChoice,
  useRentChoiceStore,
} from '../rentChoice';

const PERSIST_KEY = 'rentChoice:v1';

beforeEach(async () => {
  await AsyncStorage.clear();
  useRentChoiceStore.getState().reset();
  await useRentChoiceStore.persist.rehydrate();
});

describe('기본 동작', () => {
  it("초기 상태는 { rentChoice: 'share' }", () => {
    expect(useRentChoiceStore.getState().rentChoice).toBe('share');
  });

  it("setRentChoice('oneBed') → state 변경", () => {
    useRentChoiceStore.getState().setRentChoice('oneBed');
    expect(useRentChoiceStore.getState().rentChoice).toBe('oneBed');
  });

  it.each(['share', 'studio', 'oneBed', 'twoBed'] as const)(
    "setRentChoice('%s') → state 변경",
    (choice) => {
      useRentChoiceStore.getState().setRentChoice(choice);
      expect(useRentChoiceStore.getState().rentChoice).toBe(choice);
    },
  );

  it('reset() → 초기 상태 복귀', () => {
    useRentChoiceStore.getState().setRentChoice('twoBed');
    useRentChoiceStore.getState().reset();
    expect(useRentChoiceStore.getState().rentChoice).toBe('share');
  });
});

describe('영속화', () => {
  it("AsyncStorage 키는 정확히 'rentChoice:v1'", async () => {
    useRentChoiceStore.getState().setRentChoice('studio');
    await Promise.resolve();
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    expect(raw).not.toBeNull();
  });

  it('partialize: 액션은 영속화되지 않고 state 만 저장', async () => {
    useRentChoiceStore.getState().setRentChoice('oneBed');
    await Promise.resolve();
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    const parsed = JSON.parse(raw as string) as {
      state: Record<string, unknown>;
      version: number;
    };
    expect(parsed.state.rentChoice).toBe('oneBed');
    expect(parsed.state.setRentChoice).toBeUndefined();
    expect(parsed.state.reset).toBeUndefined();
    expect(parsed.version).toBe(1);
  });

  it('round-trip: storage 에 박힌 v1 entry → rehydrate 후 메모리 반영', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({ state: { rentChoice: 'twoBed' }, version: 1 }),
    );
    expect(useRentChoiceStore.getState().rentChoice).toBe('share');
    await useRentChoiceStore.persist.rehydrate();
    expect(useRentChoiceStore.getState().rentChoice).toBe('twoBed');
  });
});

describe('손상 캐시 / 알 수 없는 literal — INITIAL fallback (silent fail 금지)', () => {
  it('잘못된 JSON → INITIAL 적용', async () => {
    await AsyncStorage.setItem(PERSIST_KEY, '{ broken json');
    await useRentChoiceStore.persist.rehydrate();
    expect(useRentChoiceStore.getState().rentChoice).toBe('share');
  });

  it('알 수 없는 rentChoice literal → INITIAL', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({ state: { rentChoice: 'penthouse' }, version: 1 }),
    );
    await useRentChoiceStore.persist.rehydrate();
    expect(useRentChoiceStore.getState().rentChoice).toBe('share');
  });

  it('rentChoice 누락 → INITIAL', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({ state: {}, version: 1 }),
    );
    await useRentChoiceStore.persist.rehydrate();
    expect(useRentChoiceStore.getState().rentChoice).toBe('share');
  });

  it('rentChoice 가 number 등 잘못된 타입 → INITIAL', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({ state: { rentChoice: 42 }, version: 1 }),
    );
    await useRentChoiceStore.persist.rehydrate();
    expect(useRentChoiceStore.getState().rentChoice).toBe('share');
  });
});

describe('RENT_CHOICE_FALLBACK_ORDER 정의', () => {
  it("순서는 'share' → 'studio' → 'oneBed' → 'twoBed' 고정", () => {
    expect([...RENT_CHOICE_FALLBACK_ORDER]).toEqual(['share', 'studio', 'oneBed', 'twoBed']);
  });
});

describe('resolveRentChoice (순수 함수 — Compare/Detail 단일 fallback 정책)', () => {
  function makeRent(overrides: Partial<CityCostData['rent']>): CityCostData['rent'] {
    return {
      share: 350_000,
      studio: 650_000,
      oneBed: 1_200_000,
      twoBed: 1_800_000,
      ...overrides,
    };
  }

  it('선택값이 있으면 그대로 반환', () => {
    const result = resolveRentChoice(makeRent({}), 'oneBed');
    expect(result).toEqual({ key: 'oneBed', value: 1_200_000 });
  });

  it("선택값이 null 이면 fallback 순서로 첫 non-null (share → studio → oneBed → twoBed)", () => {
    const result = resolveRentChoice(makeRent({ oneBed: null }), 'oneBed');
    expect(result).toEqual({ key: 'share', value: 350_000 });
  });

  it("share/studio 가 null + 선택 oneBed 도 null → fallback 'twoBed'", () => {
    const result = resolveRentChoice(
      makeRent({ share: null, studio: null, oneBed: null }),
      'oneBed',
    );
    expect(result).toEqual({ key: 'twoBed', value: 1_800_000 });
  });

  it('모든 키가 null → null 반환 (호출자 분기)', () => {
    const result = resolveRentChoice(
      makeRent({ share: null, studio: null, oneBed: null, twoBed: null }),
      'share',
    );
    expect(result).toBeNull();
  });

  it("선택 'twoBed' 가 null 이면 fallback 'share' 부터 (선택 키 자체는 fallback 순회 시 skip)", () => {
    const result = resolveRentChoice(makeRent({ twoBed: null }), 'twoBed');
    expect(result).toEqual({ key: 'share', value: 350_000 });
  });
});
