/**
 * RootLayout 부트로더 테스트.
 *
 * step 0~2 책임 검증:
 *   - step 0: 폰트 + 4 store hydration 동시 await + null 렌더 + hideAsync 1회 호출
 *   - step 1: timeout fallback (ADR-052) 도 bootReady 진입
 *   - step 2: persona.onboarded 기반 router.replace redirect (무한 redirect 방지)
 *
 * ErrorBoundary·lastSync bridge 는 step 3~4.
 */

import * as React from 'react';

import * as SplashScreen from 'expo-splash-screen';

import { act, render } from '@testing-library/react-native';

import RootLayout from '../_layout';

jest.mock('@/store', () => ({
  waitForStoresOrTimeout: jest.fn(),
  usePersonaStore: jest.fn(),
  bridgeLastSyncFromMeta: jest.fn(),
}));

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
const mockedUsePersonaStore = jest.requireMock('@/store').usePersonaStore as jest.Mock;
const mockedBridgeLastSync = jest.requireMock('@/store')
  .bridgeLastSyncFromMeta as jest.Mock;
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

type PersonaSlice = { onboarded: boolean };

function setPersona(onboarded: boolean): void {
  mockedUsePersonaStore.mockImplementation(
    (selector: (state: PersonaSlice) => unknown) => selector({ onboarded }),
  );
}

describe('RootLayout 부트로더', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let replaceMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedHideAsync.mockResolvedValue(undefined);
    mockedPreventAutoHideAsync.mockResolvedValue(undefined);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    replaceMock = jest.fn();
    mockedUseRouter.mockReturnValue({ replace: replaceMock, push: jest.fn(), back: jest.fn() });
    mockedUseSegments.mockReturnValue([]);
    setPersona(true); // 기본: onboarded=true → step 2 의 redirect 가 트리거되지 않음
    mockedBridgeLastSync.mockResolvedValue(undefined);
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
    setPersona(false);
    mockedUseSegments.mockReturnValue(['(tabs)']);

    render(<RootLayout />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith('/onboarding');
  });

  it('onboarded + 초기 segment onboarding → router.replace("/(tabs)")', async () => {
    mockedUseAppFonts.mockReturnValue({ ready: true, error: null });
    mockedWaitForStoresOrTimeout.mockResolvedValue('ok');
    setPersona(true);
    mockedUseSegments.mockReturnValue(['onboarding']);

    render(<RootLayout />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith('/(tabs)');
  });

  it('!onboarded + 이미 onboarding segment → no-op (무한 redirect 방지)', async () => {
    mockedUseAppFonts.mockReturnValue({ ready: true, error: null });
    mockedWaitForStoresOrTimeout.mockResolvedValue('ok');
    setPersona(false);
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
    setPersona(true);
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
    setPersona(false);
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
    setPersona(false);
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
    setPersona(false);
    mockedUseSegments.mockReturnValue(['(tabs)']);

    render(<RootLayout />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(replaceMock).toHaveBeenCalledWith('/onboarding');
  });
});
