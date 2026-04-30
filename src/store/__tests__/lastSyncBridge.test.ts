/**
 * lastSyncBridge — meta:lastSync (data layer) → useSettingsStore.lastSync 단방향
 * 동기화. data layer 가 source of truth (DATA.md §269).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { bridgeLastSyncFromMeta } from '../lastSyncBridge';
import { useSettingsStore } from '../settings';

const META_KEY = 'meta:lastSync';

beforeEach(async () => {
  await AsyncStorage.clear();
  // store 초기화 — 이전 테스트의 상태가 누수되지 않도록.
  useSettingsStore.setState({ lastSync: null });
  await useSettingsStore.persist.rehydrate();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('bridgeLastSyncFromMeta', () => {
  it('meta = ISO string, store = null → store 갱신', async () => {
    const iso = '2026-04-30T10:00:00.000Z';
    await AsyncStorage.setItem(META_KEY, iso);

    await bridgeLastSyncFromMeta();

    expect(useSettingsStore.getState().lastSync).toBe(iso);
  });

  it('meta = null (메타키 없음), store = ISO string → store null 로 갱신', async () => {
    useSettingsStore.setState({ lastSync: '2026-01-01T00:00:00.000Z' });

    await bridgeLastSyncFromMeta();

    expect(useSettingsStore.getState().lastSync).toBeNull();
  });

  it('meta === store → no-op (불필요한 setState 방지)', async () => {
    const iso = '2026-04-30T10:00:00.000Z';
    await AsyncStorage.setItem(META_KEY, iso);
    useSettingsStore.setState({ lastSync: iso });
    const updateSpy = jest.spyOn(useSettingsStore.getState(), 'updateLastSync');

    await bridgeLastSyncFromMeta();

    expect(updateSpy).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().lastSync).toBe(iso);
  });

  it('meta != store (값 변경) → store 가 새 값으로 갱신', async () => {
    const oldIso = '2026-01-01T00:00:00.000Z';
    const newIso = '2026-04-30T10:00:00.000Z';
    useSettingsStore.setState({ lastSync: oldIso });
    await AsyncStorage.setItem(META_KEY, newIso);

    await bridgeLastSyncFromMeta();

    expect(useSettingsStore.getState().lastSync).toBe(newIso);
  });
});
