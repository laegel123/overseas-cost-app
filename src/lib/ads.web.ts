/**
 * 웹 빌드용 광고 lib — 광고를 싣지 않는다. export 시그니처는 `ads.native.ts` 와 동일.
 *
 * 광고 SDK 와 `ads.native.ts` 를 import 하지 않는다 (웹 번들에 네이티브 모듈이 끌려온다).
 */

import { type AdsInitResult, type AdsMode, resolveProductionUnitId } from './adsConfig';

export type { AdsInitResult, AdsMode, AdsStatus } from './adsConfig';
export { AD_UNIT_IDS, resolveAdsMode } from './adsConfig';

/** SDK `TestIds.ADAPTIVE_BANNER` 와 같은 Google 샘플 광고 단위 ID. */
const TEST_ADAPTIVE_BANNER_UNIT_ID = 'ca-app-pub-3940256099942544/2435281174';

export function resolveBannerUnitId(mode: AdsMode, platform: 'ios' | 'android'): string {
  return mode === 'test' ? TEST_ADAPTIVE_BANNER_UNIT_ID : resolveProductionUnitId(platform);
}

export function initializeAds(): Promise<AdsInitResult> {
  return Promise.resolve({
    status: 'disabled',
    canRequestAds: false,
    privacyOptionsRequired: false,
    error: null,
  });
}

export function showPrivacyOptionsForm(): Promise<void> {
  return Promise.resolve();
}

/** @internal 테스트 격리 전용 — 웹은 상태가 없어 no-op. */
export function __resetForTesting(): void {}
