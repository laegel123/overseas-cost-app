/**
 * meta:lastSync (data layer 측 AsyncStorage 메타키) → useSettingsStore.lastSync
 * 단방향 동기화 (DATA.md §269).
 *
 * data layer 가 source of truth — `loadAllCities` 의 saveCacheEntry / refreshFx
 * 가 메타키를 갱신하므로, store 는 그 결과의 mirror 일 뿐. 역방향 sync (store →
 * data) 는 모순이라 금지. 사용자가 store 의 lastSync 를 직접 편집할 일 없음.
 *
 * 부트로더 (app-shell phase) 가 store hydration 완료 후 1회 호출.
 *
 * 비차단 best-effort — bridge 실패가 splash 무한 대기를 유발하면 ADR-052 와
 * 동일한 hang. caller 가 catch 하면 dev 콘솔 로그만, 부팅 흐름은 진행.
 */

import { getLastSync } from '@/lib';

import { useSettingsStore } from './settings';

export async function bridgeLastSyncFromMeta(): Promise<void> {
  const meta = await getLastSync();
  const current = useSettingsStore.getState().lastSync;
  if (meta !== current) {
    // updateLastSync 는 string | null 모두 정규화 (Date 도 받지만 본 호출은 string|null).
    useSettingsStore.getState().updateLastSync(meta);
  }
}
