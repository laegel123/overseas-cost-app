import '../global.css';

import { useEffect } from 'react';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { useAppFonts } from '@/theme/fonts';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* splash 가 이미 hide 된 경우 무시 — dev fast refresh */
});

export default function RootLayout() {
  const { ready, error } = useAppFonts();

  useEffect(() => {
    if (error) {
      // ADR-014: silent fail 금지. 폰트 로드 실패는 system font 로 fallback 되어
      // 화면은 뜨지만, 운영 가시성을 위해 명시적으로 기록한다.
      console.error('[RootLayout] font load failed:', error);
    }
    if (ready || error) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [ready, error]);

  if (!ready && !error) {
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
