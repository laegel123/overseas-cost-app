import '../global.css';

import { useEffect, useState } from 'react';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { waitForAllStoresHydrated } from '@/store';
import { useAppFonts } from '@/theme/fonts';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* splash 가 이미 hide 된 경우 무시 — dev fast refresh */
});

export default function RootLayout() {
  const { ready: fontsReady, error: fontsError } = useAppFonts();
  const [storesHydrated, setStoresHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    waitForAllStoresHydrated().then(() => {
      if (!cancelled) setStoresHydrated(true);
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

  // 폰트 실패는 system font fallback 으로 진행 (현재 동작 유지). store hydration
  // 실패는 v1.0 에서 latent edge case 로 수용 (ADR-052) — timeout guard 는 step 1.
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
