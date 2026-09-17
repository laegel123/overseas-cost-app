/**
 * 광고 설정·타입 — `ads.native.ts` 와 `ads.web.ts` 가 공유한다.
 *
 * 광고 SDK 를 참조하지 않는다. 이 파일이 SDK 를 import 하면 웹 번들에 네이티브 모듈이
 * 끌려온다.
 */

import { AdsConfigError } from './errors';

export type AdsMode = 'test' | 'production';
export type AdsStatus = 'idle' | 'initializing' | 'ready' | 'disabled';

export type AdsInitResult = {
  status: 'ready' | 'disabled';
  canRequestAds: boolean;
  /** 설정 메뉴 노출 조건 (`privacyOptionsRequirementStatus === 'REQUIRED'`) */
  privacyOptionsRequired: boolean;
  /** disabled 사유 또는 부분 실패 (AdsConfigError | 동의·초기화 실패) */
  error: Error | null;
};

/** 운영자가 AdMob 콘솔 값으로 교체. placeholder 패턴은 resolveBannerUnitId 가 거부한다. */
export const AD_UNIT_IDS = {
  ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY',
  android: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY',
} as const;

const PLACEHOLDER_UNIT_ID_RE = /X{16}\/Y{10}/;

/** `EXPO_PUBLIC_ADS_TEST=1` 또는 개발 빌드면 테스트 광고. */
export function resolveAdsMode(env = process.env.EXPO_PUBLIC_ADS_TEST, dev = __DEV__): AdsMode {
  return env === '1' || dev ? 'test' : 'production';
}

/** 프로덕션 광고 단위 ID. placeholder 면 AdsConfigError — 광고를 끈다. */
export function resolveProductionUnitId(platform: 'ios' | 'android'): string {
  const unitId = AD_UNIT_IDS[platform];
  if (PLACEHOLDER_UNIT_ID_RE.test(unitId)) {
    throw new AdsConfigError(`ad unit id for '${platform}' is a placeholder: '${unitId}'`);
  }
  return unitId;
}
