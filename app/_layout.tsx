import '../global.css';

import { useEffect, useState } from 'react';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { waitForStoresOrTimeout } from '@/store';
import { useAppFonts } from '@/theme/fonts';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* splash 가 이미 hide 된 경우 무시 — dev fast refresh */
});

export default function RootLayout() {
  const { ready: fontsReady, error: fontsError } = useAppFonts();
  const [storesHydrated, setStoresHydrated] = useState(false);
  // hydrationTimedOut 의 reader 는 step 2/3 (라우팅 / ErrorView 토스트) 에서
  // 추가. 본 step 은 setter 만 노출.
  const [, setHydrationTimedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    waitForStoresOrTimeout().then((result) => {
      if (cancelled) return;
      setStoresHydrated(true);
      if (result === 'timeout') setHydrationTimedOut(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (fontsError) {
      // ADR-014: silent fail 금지. 폰트 로드 실패는 system font 로 fallback 되어
      // 화면은 뜨지만, 운영 가시성을 위해 명시적으로 기록한다.
      console.error('[RootLayout] font load failed:', fontsError);
    }
  }, [fontsError]);

  // 폰트 실패는 system font fallback 으로 진행. store hydration 실패는 ADR-052
  // timeout guard 가 INITIAL_STATE fallback 으로 회복 — hydrationTimedOut 상태는
  // 후속 step (라우팅 / ErrorView) 이 참조.
  const fontsResolved = fontsReady || fontsError !== null;
  const bootReady = fontsResolved && storesHydrated;

  useEffect(() => {
    if (bootReady) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [bootReady]);

  if (!bootReady) {
    // FOUC + AsyncStorage race 방지 — ARCHITECTURE.md §부팅·hydration 순서.
    return null;
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.white },
        }}
      />
    </>
  );
}
