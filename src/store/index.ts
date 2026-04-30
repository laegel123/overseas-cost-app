/**
 * Zustand 스토어의 단일 진입점.
 *
 * 4 도메인 store — 단일 거대 스토어 금지 (ARCHITECTURE.md §상태 관리, ADR-004).
 * 컴포넌트는 본 인덱스에서 import:
 *   import { usePersonaStore, useFavoritesStore } from '@/store';
 *
 * 부트로더 (app-shell phase) 는 4 store 의 hydration 을 동시 await:
 *   await waitForAllStoresHydrated();
 */

export { usePersonaStore } from './persona';
export type { PersonaActions, PersonaState } from './persona';
export { MAX_FAVORITES, useFavoritesStore } from './favorites';
export type { AddResult, FavoritesActions, FavoritesState } from './favorites';
export { MAX_RECENT, useRecentStore } from './recent';
export type { RecentActions, RecentState } from './recent';
export { useSettingsStore } from './settings';
export type { SettingsActions, SettingsState } from './settings';

export {
  DEFAULT_HYDRATION_TIMEOUT_MS,
  waitForAllStoresHydrated,
  waitForStoresOrTimeout,
} from './hydration';
export { bridgeLastSyncFromMeta } from './lastSyncBridge';
