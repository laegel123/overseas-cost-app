/**
 * RootLayout 부트로더 테스트.
 *
 * step 0~2 책임 검증:
 *   - step 0: 폰트 + 4 store hydration 동시 await + null 렌더 + hideAsync 1회 호출
 *   - step 1: timeout fallback (ADR-052) 도 bootReady 진입
 *   - step 2: onboarding.onboarded 기반 router.replace redirect (무한 redirect 방지)
 *
 * ErrorBoundary·lastSync bridge 는 step 3~4.
 * 광고 동의·초기화 트리거 (§9.46) 는 admob-banner-ads step 5.
 */

import * as React from 'react';

import * as SplashScreen from 'expo-splash-screen';

import { act, render } from '@testing-library/react-native';

import type { AdsInitResult } from '@/lib';

import RootLayout from '../_layout';

jest.mock('@/store', () => ({
  waitForStoresOrTimeout: jest.fn(),
  useOnboardingStore: jest.fn(),
  useAdsStore: jest.fn(),
  bridgeLastSyncFromMeta: jest.fn(),
}));

jest.mock('@/lib', () => {
  const actual = jest.requireActual('@/lib');
  return {
    ...actual,
    initializeAds: jest.fn(),
  };
});

jest.mock('@/theme/fonts', () => ({
  useAppFonts: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useSegments: jest.fn(),
  Stack: Object.assign(
    ({ children }: { children?: React.ReactNode }) => (children as React.ReactElement) ?? null,
    { Screen: () => null },
  ),
}));

const mockedUseAppFonts = jest.requireMock('@/theme/fonts').useAppFonts as jest.Mock;
const mockedWaitForStoresOrTimeout = jest.requireMock('@/store')
  .waitForStoresOrTimeout as jest.Mock;
const mockedUseOnboardingStore = jest.requireMock('@/store').useOnboardingStore as jest.Mock;
const mockedBridgeLastSync = jest.requireMock('@/store')
  .bridgeLastSyncFromMeta as jest.Mock;
const mockedUseAdsStore = jest.requireMock('@/store').useAdsStore as jest.Mock;
const mockedInitializeAds = jest.requireMock('@/lib').initializeAds as jest.Mock;
const mockedUseRouter = jest.requireMock('expo-router').useRouter as jest.Mock;
const mockedUseSegments = jest.requireMock('expo-router').useSegments as jest.Mock;
const mockedHideAsync = SplashScreen.hideAsync as jest.Mock;
const mockedPreventAutoHideAsync = SplashScreen.preventAutoHideAsync as jest.Mock;

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

type HydrationResult = 'ok' | 'timeout';

type OnboardingSlice = { onboarded: boolean };

function setOnboarded(onboarded: boolean): void {
  mockedUseOnboardingStore.mockImplementation(
    (selector: (state: OnboardingSlice) => unknown) => selector({ onboarded }),
  );
}

type AdsSlice = { begin: jest.Mock; settle: jest.Mock };

const ADS_READY_RESULT: AdsInitResult = {
  status: 'ready',
  canRequestAds: true,
  privacyOptionsRequired: false,
  error: null,
};

describe('RootLayout 부트로더', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let replaceMock: jest.Mock;
  let beginAdsMock: jest.Mock;
  let settleAdsMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedHideAsync.mockResolvedValue(undefined);
    mockedPreventAutoHideAsync.mockResolvedValue(undefined);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    replaceMock = jest.fn();
    mockedUseRouter.mockReturnValue({ replace: replaceMock, push: jest.fn(), back: jest.fn() });
    mockedUseSegments.mockReturnValue([]);
    setOnboarded(true); // 기본: onboarded=true → step 2 의 redirect 가 트리거되지 않음
    mockedBridgeLastSync.mockResolvedValue(undefined);
    // 셀렉터가 매 렌더 같은 참조를 받아야 effect deps 가 안정 (실제 zustand 액션과 동일).
    beginAdsMock = jest.fn();
    settleAdsMock = jest.fn();
    mockedUseAdsStore.mockImplementation((selector: (state: AdsSlice) => unknown) =>
      selector({ begin: beginAdsMock, settle: settleAdsMock }),
    );
    mockedInitializeAds.mockResolvedValue(ADS_READY_RESULT);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // ─── step 0 ────────────────────────────────────────────────────────────

  it('폰트 + 4 store hydration 모두 완료되면 hideAsync 1회 호출 (ok)', async () => {
    mockedUseAppFonts.mockReturnValue({ ready: true, error: null });
    const storesD = deferred<HydrationResult>();
    mockedWaitForStoresOrTimeout.mockReturnValue(storesD.promise);

    render(<RootLayout />);

    expect(mockedHideAsync).not.toHaveBeenCalled();

    await act(async () => {
      storesD.resolve('ok');
      await storesD.promise;
    });

    expect(mockedHideAsync).toHaveBeenCalledTimes(1);
  });

  it('폰트 미완 (ready=false, error=null) + stores hydrated → splash 유지', async () => {
    mockedUseAppFonts.mockReturnValue({ ready: false, error: null });
    mockedWaitForStoresOrTimeout.mockResolvedValue('ok');

    render(<RootLayout />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedHideAsync).not.toHaveBeenCalled();
  });

  it('폰트 에러 + stores hydrated → 시스템 폰트 fallback 진행 + 콘솔 에러 로그', async () => {
    const fontError = new Error('font load failed');
    mockedUseAppFonts.mockReturnValue({ ready: false, error: fontError });
    mockedWaitForStoresOrTimeout.mockResolvedValue('ok');

    render(<RootLayout />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedHideAsync).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[RootLayout] font load failed:',
      fontError,
    );
  });

  it('store hydration pending + 폰트 ready → splash 유지', async () => {
    mockedUseAppFonts.mockReturnValue({ ready: true, error: null });
    mockedWaitForStoresOrTimeout.mockReturnValue(new Promise(() => undefined));

    render(<RootLayout />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedHideAsync).not.toHaveBeenCalled();
  });

  it('unmount 후 hydration resolve → setState race 안전 (재마운트 시 재호출)', async () => {
    mockedUseAppFonts.mockReturnValue({ ready: true, error: null });
    const storesD = deferred<HydrationResult>();
    mockedWaitForStoresOrTimeout.mockReturnValue(storesD.promise);

    const { unmount } = render(<RootLayout />);
    unmount();

    await act(async () => {
      storesD.resolve('ok');
      await storesD.promise;
    });

    expect(mockedHideAsync).not.toHaveBeenCalled();
  });

  // ─── step 1 ────────────────────────────────────────────────────────────

  it('hydration timeout (ADR-052 fallback) → bootReady 진입 + hideAsync 1회', async () => {
    mockedUseAppFonts.mockReturnValue({ ready: true, error: null });
    mockedWaitForStoresOrTimeout.mockResolvedValue('timeout');

    render(<RootLayout />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedHideAsync).toHaveBeenCalledTimes(1);
  });

  // ─── step 2 ────────────────────────────────────────────────────────────

  it('!onboarded + 초기 segment (tabs) → router.replace("/onboarding")', async () => {
    mockedUseAppFonts.mockReturnValue({ ready: true, error: null });
    mockedWaitForStoresOrTimeout.mockResolvedValue('ok');
    setOnboarded(false);
    mockedUseSegments.mockReturnValue(['(tabs)']);

    render(<RootLayout />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith('/onboarding');
  });

  it('onboarded + onboarding segment → 게이트 미개입 (온보딩 화면이 스스로 compare 로 탈출, ADR-067)', async () => {
    // 게이트가 /(tabs) 로 재라우팅하면 온보딩→compare 직행을 덮어쓰는 경쟁 조건이
    // 발생하므로(onboarded 커밋과 세그먼트 커밋 사이 전이 렌더), 이 케이스는 no-op.
    // 온보딩 탈출 네비게이션은 app/onboarding.tsx 의 handleSelect 소유.
    mockedUseAppFonts.mockReturnValue({ ready: true, error: null });
    mockedWaitForStoresOrTimeout.mockResolvedValue('ok');
    setOnboarded(true);
    mockedUseSegments.mockReturnValue(['onboarding']);

    render(<RootLayout />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('!onboarded + 이미 onboarding segment → no-op (무한 redirect 방지)', async () => {
    mockedUseAppFonts.mockReturnValue({ ready: true, error: null });
    mockedWaitForStoresOrTimeout.mockResolvedValue('ok');
    setOnboarded(false);
    mockedUseSegments.mockReturnValue(['onboarding']);

    render(<RootLayout />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('onboarded + 이미 (tabs) segment → no-op (무한 redirect 방지)', async () => {
    mockedUseAppFonts.mockReturnValue({ ready: true, error: null });
    mockedWaitForStoresOrTimeout.mockResolvedValue('ok');
    setOnboarded(true);
    mockedUseSegments.mockReturnValue(['(tabs)']);

    render(<RootLayout />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('bootReady 가 false 인 동안 router.replace 호출 0회', async () => {
    mockedUseAppFonts.mockReturnValue({ ready: true, error: null });
    mockedWaitForStoresOrTimeout.mockReturnValue(new Promise(() => undefined));
    setOnboarded(false);
    mockedUseSegments.mockReturnValue(['(tabs)']);

    render(<RootLayout />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(replaceMock).not.toHaveBeenCalled();
  });

  // ─── step 4 ────────────────────────────────────────────────────────────

  it('storesHydrated 진입 시 bridgeLastSyncFromMeta 1회 호출', async () => {
    mockedUseAppFonts.mockReturnValue({ ready: true, error: null });
    mockedWaitForStoresOrTimeout.mockResolvedValue('ok');

    render(<RootLayout />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedBridgeLastSync).toHaveBeenCalledTimes(1);
  });

  it('bridge 실패 → 부팅 흐름 차단 안 함 (replace 정상 호출)', async () => {
    mockedUseAppFonts.mockReturnValue({ ready: true, error: null });
    mockedWaitForStoresOrTimeout.mockResolvedValue('ok');
    mockedBridgeLastSync.mockRejectedValue(new Error('bridge boom'));
    setOnboarded(false);
    mockedUseSegments.mockReturnValue(['(tabs)']);

    render(<RootLayout />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // 라우팅은 진행
    expect(replaceMock).toHaveBeenCalledWith('/onboarding');
    // dev 콘솔 로그 (silent fail 금지)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[app-shell] lastSync bridge failed:',
      expect.any(Error),
    );
  });

  it('storesHydrated false 동안 bridge 호출 0회', async () => {
    mockedUseAppFonts.mockReturnValue({ ready: true, error: null });
    mockedWaitForStoresOrTimeout.mockReturnValue(new Promise(() => undefined));

    render(<RootLayout />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedBridgeLastSync).not.toHaveBeenCalled();
  });

  it('timeout fallback → INITIAL onboarded=false 가정 시 /onboarding 자연 redirect', async () => {
    mockedUseAppFonts.mockReturnValue({ ready: true, error: null });
    mockedWaitForStoresOrTimeout.mockResolvedValue('timeout');
    // timeout fallback 은 미완 store 에 INITIAL_STATE 강제 → onboarded=false.
    // 본 테스트에서는 그 결과를 시뮬레이트.
    setOnboarded(false);
    mockedUseSegments.mockReturnValue(['(tabs)']);

    render(<RootLayout />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(replaceMock).toHaveBeenCalledWith('/onboarding');
  });

  // ─── admob-banner-ads step 5 (§9.46) ───────────────────────────────────

  it('bootReady && onboarded → begin 1회 → initializeAds 1회 → resolve 후 settle(결과) 1회', async () => {
    mockedUseAppFonts.mockReturnValue({ ready: true, error: null });
    mockedWaitForStoresOrTimeout.mockResolvedValue('ok');
    const adsD = deferred<AdsInitResult>();
    mockedInitializeAds.mockReturnValue(adsD.promise);

    render(<RootLayout />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(beginAdsMock).toHaveBeenCalledTimes(1);
    expect(mockedInitializeAds).toHaveBeenCalledTimes(1);
    expect(beginAdsMock.mock.invocationCallOrder[0]).toBeLessThan(
      mockedInitializeAds.mock.invocationCallOrder[0] as number,
    );
    // 비차단 — initializeAds 가 pending 이어도 부팅은 끝났고 settle 은 아직.
    expect(mockedHideAsync).toHaveBeenCalledTimes(1);
    expect(settleAdsMock).not.toHaveBeenCalled();

    const disabledResult: AdsInitResult = {
      status: 'disabled',
      canRequestAds: false,
      privacyOptionsRequired: false,
      error: new Error('init failed'),
    };
    await act(async () => {
      adsD.resolve(disabledResult);
      await adsD.promise;
    });

    expect(settleAdsMock).toHaveBeenCalledTimes(1);
    expect(settleAdsMock).toHaveBeenCalledWith(disabledResult);
  });

  it('onboarded=false → initializeAds 0회 (온보딩 화면 위 프롬프트 없음)', async () => {
    mockedUseAppFonts.mockReturnValue({ ready: true, error: null });
    mockedWaitForStoresOrTimeout.mockResolvedValue('ok');
    setOnboarded(false);
    mockedUseSegments.mockReturnValue(['onboarding']);

    render(<RootLayout />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedHideAsync).toHaveBeenCalledTimes(1); // bootReady 진입 확인
    expect(beginAdsMock).not.toHaveBeenCalled();
    expect(mockedInitializeAds).not.toHaveBeenCalled();
  });

  it('bootReady=false 동안 initializeAds 0회', async () => {
    mockedUseAppFonts.mockReturnValue({ ready: true, error: null });
    mockedWaitForStoresOrTimeout.mockReturnValue(new Promise(() => undefined));
    setOnboarded(true);

    render(<RootLayout />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(beginAdsMock).not.toHaveBeenCalled();
    expect(mockedInitializeAds).not.toHaveBeenCalled();
  });

  it('onboarded false → true 전이 (도시 선택 완료) 시점에 initializeAds 1회', async () => {
    mockedUseAppFonts.mockReturnValue({ ready: true, error: null });
    mockedWaitForStoresOrTimeout.mockResolvedValue('ok');
    setOnboarded(false);
    mockedUseSegments.mockReturnValue(['onboarding']);

    const { rerender } = render(<RootLayout />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockedInitializeAds).not.toHaveBeenCalled();

    setOnboarded(true);
    await act(async () => {
      rerender(<RootLayout />);
      await Promise.resolve();
    });

    expect(beginAdsMock).toHaveBeenCalledTimes(1);
    expect(mockedInitializeAds).toHaveBeenCalledTimes(1);
    expect(settleAdsMock).toHaveBeenCalledWith(ADS_READY_RESULT);
  });
});
