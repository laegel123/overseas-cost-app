import '../global.css';

import { useEffect } from 'react';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { useAppFonts } from '@/theme/fonts';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* splash 가 이미 hide 된 경우 무시 — dev fast refresh */
});

export default function RootLayout() {
  const { ready, error } = useAppFonts();

  useEffect(() => {
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
          contentStyle: { backgroundColor: '#FFFFFF' },
        }}
      />
    </>
  );
}
