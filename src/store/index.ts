/**
 * Zustand 스토어의 단일 진입점.
 * 도메인별 스토어 (ADR-004).
 */

export { usePersonaStore } from './persona';
export type { PersonaActions, PersonaState } from './persona';
export { MAX_FAVORITES, useFavoritesStore } from './favorites';
export type { AddResult, FavoritesActions, FavoritesState } from './favorites';
export { MAX_RECENT, useRecentStore } from './recent';
export type { RecentActions, RecentState } from './recent';
export { useSettingsStore } from './settings';
export type { SettingsActions, SettingsState } from './settings';
