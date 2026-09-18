/**
 * AdBanner — 화면 하단 고정 anchored adaptive 배너 (ADR-077).
 *
 * **광고가 실제로 로드된 뒤에만 높이를 차지한다.** 로드 전·실패·오프라인·동의
 * 미완료면 컨테이너가 `h-0` 로 접혀 기존 레이아웃과 동일하다. placeholder 높이를
 * 예약하지 않는 대신 로드 후 1회의 레이아웃 시프트를 수용한다.
 *
 * 로드 실패 시에도 `BannerAd` 는 마운트를 유지한다 — 재시도는 SDK 가 한다.
 *
 * 펼친 높이는 SDK 가 기기 폭에 맞춰 계산하므로 코드에 px 가 없다. 색·border 는
 * tailwind 토큰만 사용 (CLAUDE.md CRITICAL).
 *
 * `src/lib/ads.native.ts` 와 함께 `react-native-google-mobile-ads` 를 직접 import
 * 하는 두 파일 중 하나다 (ESLint `no-restricted-imports` override).
 */

import * as React from 'react';

import { Platform, View } from 'react-native';

import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';

import { resolveAdsMode, resolveBannerUnitId } from '@/lib';
import { useAdsStore } from '@/store';

export type AdBannerProps = {
  /** 기본 'ad-banner'. 접힌 상태에서도 같은 값 (E2E 가 존재만 확인). */
  testID?: string;
};

export function AdBanner({ testID = 'ad-banner' }: AdBannerProps): React.ReactElement | null {
  const canShow = useAdsStore((s) => s.status === 'ready' && s.canRequestAds);
  const [loaded, setLoaded] = React.useState(false);
  const platform = Platform.OS;

  // canShow 를 조건에 포함 — 광고가 꺼진 상태에서 placeholder 설정으로 인한
  // AdsConfigError 가 터지지 않게 한다. 반대로 store 가 ready 면 lib 이 이미 같은
  // 검증을 통과한 뒤이므로 여기서 throw 는 설정 불일치 버그다 (삼키지 않고 노출).
  const unitId = React.useMemo(
    () =>
      canShow && (platform === 'ios' || platform === 'android')
        ? resolveBannerUnitId(resolveAdsMode(), platform)
        : null,
    [canShow, platform],
  );

  const handleAdLoaded = React.useCallback(() => setLoaded(true), []);

  const handleAdFailedToLoad = React.useCallback((error: Error) => {
    setLoaded(false);
    if (__DEV__) {
      console.error('[ads] banner load failed:', error);
    }
  }, []);

  if (unitId === null) {
    return null;
  }

  const containerClass = loaded
    ? 'bg-white border-t border-line items-center'
    : 'h-0 overflow-hidden';

  return (
    <View
      // SDK 뷰가 자체 라벨을 가지므로 컨테이너는 role 없이 라벨만.
      accessibilityLabel="광고"
      accessibilityRole="none"
      className={containerClass}
      testID={testID}
    >
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdLoaded={handleAdLoaded}
        onAdFailedToLoad={handleAdFailedToLoad}
      />
    </View>
  );
}
