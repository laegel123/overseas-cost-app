/**
 * 광고 SDK 경유 단일 지점 (ADR-077). 컴포넌트·화면은 SDK 를 직접 import 하지 않는다
 * (ESLint `no-restricted-imports`).
 *
 * `initializeAds` 는 throw 하지 않는다 — 광고는 핵심 기능이 아니므로 실패는 부팅을 막지 않고
 * 결과 객체의 `status: 'disabled'` + `error` 로 노출한다 (silent fail 아님).
 */

import { Platform } from 'react-native';

import mobileAds, { AdsConsent, TestIds } from 'react-native-google-mobile-ads';

import {
  type AdsInitResult,
  type AdsMode,
  resolveAdsMode,
  resolveProductionUnitId,
} from './adsConfig';
import { AdsConfigError } from './errors';

export type { AdsInitResult, AdsMode, AdsStatus } from './adsConfig';
export { AD_UNIT_IDS, resolveAdsMode } from './adsConfig';

export function resolveBannerUnitId(mode: AdsMode, platform: 'ios' | 'android'): string {
  return mode === 'test' ? TestIds.ADAPTIVE_BANNER : resolveProductionUnitId(platform);
}

// 첫 호출의 Promise 를 세션 동안 보관 — 진행 중이면 in-flight dedup, 완료 후면 캐시된 결과.
// runInitialization 은 reject 하지 않으므로 실패 결과도 그대로 캐시된다.
let initPromise: Promise<AdsInitResult> | null = null;

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

function disabled(error: Error): AdsInitResult {
  return { status: 'disabled', canRequestAds: false, privacyOptionsRequired: false, error };
}

async function runSteps(): Promise<AdsInitResult> {
  const platform = Platform.OS;
  if (platform !== 'ios' && platform !== 'android') {
    return disabled(new AdsConfigError(`unsupported platform: '${platform}'`));
  }
  try {
    resolveBannerUnitId(resolveAdsMode(), platform);
  } catch (e) {
    return disabled(toError(e));
  }

  // 동의 수집 실패는 중단하지 않는다 — 이전 세션 동의로 진행 (invertase 권장 순서).
  let consentError: Error | null = null;
  try {
    await AdsConsent.gatherConsent();
  } catch (e) {
    consentError = toError(e);
  }

  try {
    await mobileAds().initialize();
    const info = await AdsConsent.getConsentInfo();
    return {
      status: 'ready',
      canRequestAds: info.canRequestAds,
      privacyOptionsRequired: info.privacyOptionsRequirementStatus === 'REQUIRED',
      error: consentError,
    };
  } catch (e) {
    return disabled(toError(e));
  }
}

async function runInitialization(): Promise<AdsInitResult> {
  const result = await runSteps();
  if (result.error !== null && __DEV__) {
    console.error('[ads] initialization error:', result.error);
  }
  return result;
}

/** 동의 수집 → SDK 초기화 → 동의 상태 조회. 멱등 — 앱 세션당 1회만 실행된다. */
export function initializeAds(): Promise<AdsInitResult> {
  if (initPromise === null) {
    initPromise = runInitialization();
  }
  return initPromise;
}

/** 설정 메뉴의 "광고 개인정보 설정". 실패는 그대로 reject — 호출자가 알린다. */
export async function showPrivacyOptionsForm(): Promise<void> {
  await AdsConsent.showPrivacyOptionsForm();
}

/**
 * @internal 테스트 격리 전용 — 진행 중 Promise 와 캐시된 결과를 함께 초기화.
 * 프로덕션 코드 경로에서 호출 금지.
 */
export function __resetForTesting(): void {
  initPromise = null;
}
