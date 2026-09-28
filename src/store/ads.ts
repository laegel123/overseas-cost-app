/**
 * 광고 store — 광고 초기화 상태 (ADR-077).
 *
 * 비영속 store. 동의 상태는 UMP SDK 가 자체 저장하고, 초기화 결과는 매 부팅마다
 * `initializeAds()` 로 다시 얻는다 — 앱이 중복 저장하면 두 출처가 어긋난다.
 * 단일 거대 store 금지 정책 (ADR-004) — 본 모듈은 광고 초기화 상태만 책임.
 *
 * hydration 합성 (`waitForAllStoresHydrated`) 에 참여하지 않는다. 영속 데이터가
 * 없어 기다릴 것이 없고, 광고 초기화는 부팅을 막지 않는 비차단 흐름이다.
 *
 * Public API:
 *   - useAdsStore: zustand hook + .getState() + .setState()
 *   - AdsState / AdsActions: 외부 타입
 *
 * 흐름: 루트 레이아웃이 `begin()` → `initializeAds().then(settle)`.
 * `AdBanner` 는 `status === 'ready' && canRequestAds` 일 때만 렌더하고, 설정 화면은
 * `privacyOptionsRequired` 로 메뉴를 조건부 노출한다.
 *
 * `settle` 은 `result.error` 를 담지 않는다 — 에러 노출은 lib 이 `__DEV__`
 * console.error 로 이미 했고, 화면은 status 만 본다.
 *
 * 본 store 는 throw 하지 않는다.
 */

import { create } from 'zustand';

import type { AdsInitResult, AdsStatus } from '@/lib';

export type AdsState = {
  status: AdsStatus;
  canRequestAds: boolean;
  privacyOptionsRequired: boolean;
};

export type AdsActions = {
  begin: () => void;
  settle: (result: AdsInitResult) => void;
  reset: () => void;
};

// 초기 상태 — create 와 reset() 이 같은 상수를 참조 (drift 방지).
export const INITIAL_STATE: AdsState = {
  status: 'idle',
  canRequestAds: false,
  privacyOptionsRequired: false,
};

export const useAdsStore = create<AdsState & AdsActions>()((set) => ({
  ...INITIAL_STATE,
  begin: () => set({ status: 'initializing' }),
  settle: (result) =>
    set({
      status: result.status,
      canRequestAds: result.canRequestAds,
      privacyOptionsRequired: result.privacyOptionsRequired,
    }),
  reset: () => set(INITIAL_STATE),
}));
