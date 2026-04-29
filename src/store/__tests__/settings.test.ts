/**
 * docs/TESTING.md §9.8 매트릭스 — useSettingsStore.
 *
 * 카테고리: 기본 동작 / 입력 정규화 / Persist / 손상 캐시.
 * AsyncStorage 는 jest.setup.js 의 AsyncStorageMock 으로 격리, 시간 의존 0.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSettingsStore } from '../settings';
import type { SettingsState } from '../settings';

const PERSIST_KEY = 'settings:v1';

beforeEach(async () => {
  await AsyncStorage.clear();
  useSettingsStore.getState().reset();
  await useSettingsStore.persist.rehydrate();
});

describe('기본 동작', () => {
  it('초기 상태는 lastSync: null', () => {
    expect(useSettingsStore.getState().lastSync).toBeNull();
  });

  it('updateLastSync(Date) → ISO 문자열로 저장', () => {
    const d = new Date('2026-04-29T00:00:00.000Z');
    useSettingsStore.getState().updateLastSync(d);
    expect(useSettingsStore.getState().lastSync).toBe('2026-04-29T00:00:00.000Z');
  });

  it('updateLastSync(null) → clear (lastSync: null)', () => {
    useSettingsStore.getState().updateLastSync(new Date('2026-04-29T00:00:00.000Z'));
    useSettingsStore.getState().updateLastSync(null);
    expect(useSettingsStore.getState().lastSync).toBeNull();
  });

  it('reset() → 초기 상태 복귀', () => {
    useSettingsStore.getState().updateLastSync(new Date('2026-04-29T00:00:00.000Z'));
    useSettingsStore.getState().reset();
    expect(useSettingsStore.getState().lastSync).toBeNull();
  });
});

describe('입력 정규화', () => {
  it('string 입력 → Date(string).toISOString() 정규화 결과 저장', () => {
    useSettingsStore.getState().updateLastSync('2026-04-29T00:00:00.000Z');
    expect(useSettingsStore.getState().lastSync).toBe('2026-04-29T00:00:00.000Z');
  });

  it('비-UTC ISO string → UTC 로 정규화', () => {
    // 2026-04-29 00:00:00 KST = 2026-04-28 15:00:00 UTC
    useSettingsStore.getState().updateLastSync('2026-04-29T00:00:00+09:00');
    expect(useSettingsStore.getState().lastSync).toBe('2026-04-28T15:00:00.000Z');
  });

  it('잘못된 string (NaN Date) → silent 무시, 기존값 유지', () => {
    const before = new Date('2026-04-29T00:00:00.000Z');
    useSettingsStore.getState().updateLastSync(before);
    expect(useSettingsStore.getState().lastSync).toBe('2026-04-29T00:00:00.000Z');

    useSettingsStore.getState().updateLastSync('not-a-date');
    expect(useSettingsStore.getState().lastSync).toBe('2026-04-29T00:00:00.000Z');
  });

  it('잘못된 Date (NaN) → silent 무시, 기존값 유지', () => {
    useSettingsStore.getState().updateLastSync(new Date('2026-04-29T00:00:00.000Z'));
    useSettingsStore.getState().updateLastSync(new Date('garbage'));
    expect(useSettingsStore.getState().lastSync).toBe('2026-04-29T00:00:00.000Z');
  });
});

describe('Persist', () => {
  it("AsyncStorage 키는 정확히 'settings:v1'", async () => {
    useSettingsStore.getState().updateLastSync(new Date('2026-04-29T00:00:00.000Z'));
    await Promise.resolve();
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    expect(raw).not.toBeNull();
  });

  it('partialize: 액션은 영속화되지 않고 lastSync 만 저장', async () => {
    useSettingsStore.getState().updateLastSync(new Date('2026-04-29T00:00:00.000Z'));
    await Promise.resolve();
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    const parsed = JSON.parse(raw as string) as {
      state: Record<string, unknown>;
      version: number;
    };
    expect(parsed.state.lastSync).toBe('2026-04-29T00:00:00.000Z');
    expect(parsed.state.updateLastSync).toBeUndefined();
    expect(parsed.state.reset).toBeUndefined();
    expect(parsed.version).toBe(1);
  });

  it('round-trip: updateLastSync → rehydrate 후 같은 값', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { lastSync: '2026-04-29T00:00:00.000Z' },
        version: 1,
      }),
    );
    expect(useSettingsStore.getState().lastSync).toBeNull();

    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().lastSync).toBe('2026-04-29T00:00:00.000Z');
  });

  it('hydration 후 null 이 아닌 값 (저장돼 있던 값 그대로 복원)', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { lastSync: '2026-01-01T00:00:00.000Z' },
        version: 1,
      }),
    );

    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().lastSync).toBe('2026-01-01T00:00:00.000Z');
  });

  it('손상된 캐시 (잘못된 JSON) → 초기 상태 fallback + INITIAL 직렬화로 정리', async () => {
    useSettingsStore.getState().updateLastSync(new Date('2026-04-29T00:00:00.000Z'));
    await Promise.resolve();
    await AsyncStorage.setItem(PERSIST_KEY, '{not json');

    await useSettingsStore.persist.rehydrate();
    await Promise.resolve();
    await Promise.resolve();

    expect(useSettingsStore.getState().lastSync).toBeNull();
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as { state: SettingsState };
    expect(parsed.state.lastSync).toBeNull();
  });

  it('손상된 캐시 (lastSync 가 number) → 초기 상태 fallback', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { lastSync: 1234567890 },
        version: 1,
      }),
    );

    await useSettingsStore.persist.rehydrate();
    await Promise.resolve();
    await Promise.resolve();

    expect(useSettingsStore.getState().lastSync).toBeNull();
  });

  it('손상된 캐시 (lastSync 가 객체) → 초기 상태 fallback', async () => {
    await AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: { lastSync: { invalid: true } },
        version: 1,
      }),
    );

    await useSettingsStore.persist.rehydrate();
    await Promise.resolve();
    await Promise.resolve();

    expect(useSettingsStore.getState().lastSync).toBeNull();
  });
});
