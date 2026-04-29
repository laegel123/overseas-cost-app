/**
 * Zustand 스토어의 단일 진입점.
 * 도메인별 스토어 (ADR-004) — 후속 step 에서 favorites/recent/settings 추가.
 */

export { usePersonaStore } from './persona';
export type { PersonaActions, PersonaState } from './persona';
