/**
 * RootLayout 부트로더 테스트.
 *
 * step 0 (bootloader-hydration) 책임만 검증:
 *   - 폰트 + 4 store hydration 동시 await 합성
 *   - 둘 중 하나라도 미완 → null 렌더 (FOUC + AsyncStorage race 방지)
 *   - 폰트 에러 시 system font fallback 으로 부팅 진행 (silent fail 금지 — 콘솔 로그)
 *   - SplashScreen.hideAsync 정확히 1 회 호출
 *
 * 라우팅·timeout·ErrorBoundary·lastSync bridge 는 후속 step.
 */

import * as React from 'react';

import * as SplashScreen from 'expo-splash-screen';

import { act, render } from '@testing-library/react-native';

import RootLayout from '../_layout';

jest.mock('@/store', () => ({
  waitForStoresOrTimeout: jest.fn(),
}));

jest.mock('@/theme/fonts', () => ({
  useAppFonts: jest.fn(),
}));

const mockedUseAppFonts = jest.requireMock('@/theme/fonts').useAppFonts as jest.Mock;
const mockedWaitForStoresOrTimeout = jest.requireMock('@/store')
  .waitForStoresOrTimeout as jest.Mock;
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

describe('RootLayout 부트로더', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedHideAsync.mockResolvedValue(undefined);
    mockedPreventAutoHideAsync.mockResolvedValue(undefined);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('폰트 + 4 store hydration 모두 완료되면 hideAsync 1회 호출 (ok)', async () => {
    mockedUseAppFonts.mockReturnValue({ ready: true, error: null });
    const storesD = deferred<HydrationResult>();
    mockedWaitForStoresOrTimeout.mockReturnValue(storesD.promise);

    render(<RootLayout />);

    // hydration pending → splash 유지
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

    // unmount 후에는 hideAsync 가 호출되지 않아야 한다 (cancelled 플래그).
    expect(mockedHideAsync).not.toHaveBeenCalled();
  });

  it('hydration timeout (ADR-052 fallback) → bootReady 진입 + hideAsync 1회', async () => {
    mockedUseAppFonts.mockReturnValue({ ready: true, error: null });
    mockedWaitForStoresOrTimeout.mockResolvedValue('timeout');

    render(<RootLayout />);
    await act(async () => {
      await Promise.resolve();
    });

    // INITIAL_STATE fallback 으로 부팅 진행 — 무한 splash 회피.
    expect(mockedHideAsync).toHaveBeenCalledTimes(1);
  });
});
