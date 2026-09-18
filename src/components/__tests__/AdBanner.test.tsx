/**
 * AdBanner — TESTING.md §9.44. 광고 SDK 는 §5.1 전역 mock 이라 테스트도 SDK 를
 * import 하지 않고 `jest.requireMock` 으로 접근한다 (ESLint `no-restricted-imports`).
 *
 * `BannerAd` mock 은 `jest.fn(() => null)` — props 를 `mock.calls` 로 검사하고
 * `onAdLoaded` / `onAdFailedToLoad` 를 직접 호출해 로드·실패를 시뮬레이션한다.
 */

import * as React from 'react';

import { Platform } from 'react-native';

import { act, render, screen } from '@testing-library/react-native';

import { useAdsStore } from '@/store';

import { AdBanner } from '../AdBanner';

/** 컴포넌트가 `BannerAd` 에 넘기는 props (SDK 타입을 import 하지 않고 로컬 선언). */
type BannerAdCallProps = {
  unitId: string;
  size: string;
  onAdLoaded: () => void;
  onAdFailedToLoad: (error: Error) => void;
};

type AdsSdkMock = {
  BannerAd: jest.Mock<null, [BannerAdCallProps]>;
  TestIds: { ADAPTIVE_BANNER: string };
};

const sdk = jest.requireMock<AdsSdkMock>('react-native-google-mobile-ads');

/** 마지막 렌더에서 `BannerAd` 가 받은 props. */
function bannerProps(): BannerAdCallProps {
  const calls = sdk.BannerAd.mock.calls;
  return calls[calls.length - 1]![0];
}

function className(): string {
  return String(screen.getByTestId('ad-banner').props.className);
}

beforeEach(() => {
  jest.clearAllMocks();
  useAdsStore.getState().reset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AdBanner — 렌더 조건', () => {
  it("status 'idle' (초기) → null + BannerAd 미호출", () => {
    render(<AdBanner />);
    expect(screen.queryByTestId('ad-banner')).toBeNull();
    expect(sdk.BannerAd).not.toHaveBeenCalled();
  });

  it("status 'ready' + canRequestAds=false → null", () => {
    useAdsStore.setState({ status: 'ready', canRequestAds: false });
    render(<AdBanner />);
    expect(screen.queryByTestId('ad-banner')).toBeNull();
    expect(sdk.BannerAd).not.toHaveBeenCalled();
  });

  it("status 'disabled' → null", () => {
    useAdsStore.setState({ status: 'disabled', canRequestAds: false });
    render(<AdBanner />);
    expect(screen.queryByTestId('ad-banner')).toBeNull();
    expect(sdk.BannerAd).not.toHaveBeenCalled();
  });

  it("Platform.OS 'web' → null (ready + canRequestAds 여도 미렌더)", () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    useAdsStore.setState({ status: 'ready', canRequestAds: true });
    render(<AdBanner />);
    expect(screen.queryByTestId('ad-banner')).toBeNull();
    expect(sdk.BannerAd).not.toHaveBeenCalled();
  });
});

describe('AdBanner — ready + canRequestAds', () => {
  beforeEach(() => {
    useAdsStore.setState({ status: 'ready', canRequestAds: true });
  });

  it('BannerAd 1회 마운트 + unitId(테스트 ID) · size prop', () => {
    render(<AdBanner />);
    expect(sdk.BannerAd).toHaveBeenCalledTimes(1);
    // 테스트 환경은 __DEV__ → resolveAdsMode() = 'test'
    expect(bannerProps().unitId).toBe(sdk.TestIds.ADAPTIVE_BANNER);
    expect(bannerProps().size).toBe('ANCHORED_ADAPTIVE_BANNER');
  });

  it('로드 전 컨테이너 접힘 (h-0) → onAdLoaded 후 펼침 (border-t)', () => {
    render(<AdBanner />);
    expect(className()).toContain('h-0');
    expect(className()).toContain('overflow-hidden');

    act(() => bannerProps().onAdLoaded());

    expect(className()).not.toContain('h-0');
    expect(className()).toContain('border-t');
    expect(className()).toContain('border-line');
  });

  it('onAdFailedToLoad → 다시 접힘 + __DEV__ console.error 1회', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<AdBanner />);
    act(() => bannerProps().onAdLoaded());
    expect(className()).not.toContain('h-0');

    const error = new Error('no fill');
    act(() => bannerProps().onAdFailedToLoad(error));

    expect(className()).toContain('h-0');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('[ads] banner load failed:', error);
  });

  it('로드 실패 후에도 BannerAd 는 마운트 유지 (SDK 재시도 보존)', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<AdBanner />);
    act(() => bannerProps().onAdFailedToLoad(new Error('no fill')));
    expect(screen.getByTestId('ad-banner')).toBeTruthy();
  });

  it('a11y — 컨테이너 accessibilityLabel "광고"', () => {
    render(<AdBanner />);
    const container = screen.getByTestId('ad-banner');
    expect(container.props.accessibilityLabel).toBe('광고');
    expect(container.props.accessibilityRole).toBe('none');
  });

  it('testID 기본값 ad-banner → prop 으로 override 가능', () => {
    render(<AdBanner testID="custom-banner" />);
    expect(screen.getByTestId('custom-banner')).toBeTruthy();
    expect(screen.queryByTestId('ad-banner')).toBeNull();
  });
});

describe('AdBanner.web', () => {
  /** jest-expo 는 `../AdBanner` 를 .native 로 해석하므로 웹 파일을 경로로 직접 require 한다. */
  function loadWeb(): typeof import('../AdBanner.web') {
    let loaded: typeof import('../AdBanner.web') | undefined;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      loaded = require('../AdBanner.web');
    });
    return loaded as typeof import('../AdBanner.web');
  }

  it('항상 null + SDK 미참조', () => {
    useAdsStore.setState({ status: 'ready', canRequestAds: true });
    const { AdBanner: WebAdBanner } = loadWeb();
    render(<WebAdBanner />);
    expect(screen.queryByTestId('ad-banner')).toBeNull();
    expect(sdk.BannerAd).not.toHaveBeenCalled();
  });
});
