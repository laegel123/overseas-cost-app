import '../global.css';

import { useEffect, useState } from 'react';

import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { ErrorBoundary } from '@/components';
import { bridgeLastSyncFromMeta, usePersonaStore, waitForStoresOrTimeout } from '@/store';
import { useAppFonts } from '@/theme/fonts';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* splash 가 이미 hide 된 경우 무시 — dev fast refresh */
});

export default function RootLayout() {
  const { ready: fontsReady, error: fontsError } = useAppFonts();
  const [storesHydrated, setStoresHydrated] = useState(false);
  // hydrationTimedOut 의 reader 는 step 3 (ErrorView 토스트) 에서 추가. 본 step
  // 의 라우팅은 INITIAL_STATE 의 onboarded=false 를 통해 자연스럽게 onboarding
  // 으로 redirect 되므로 별도 분기 불필요.
  const [, setHydrationTimedOut] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const onboarded = usePersonaStore((s) => s.onboarded);

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

  useEffect(() => {
    if (!bootReady) return;
    // 무한 redirect 방지 — 현재 segment 가 이미 대상이면 no-op.
    const isOnAuthFlow = segments[0] === 'onboarding';
    if (!onboarded && !isOnAuthFlow) {
      router.replace('/onboarding');
    } else if (onboarded && isOnAuthFlow) {
      router.replace('/(tabs)');
    }
  }, [bootReady, onboarded, segments, router]);

  // meta:lastSync ↔ useSettingsStore.lastSync 단방향 sync (DATA.md §269).
  // 비차단 best-effort — bridge 실패는 부팅 흐름 차단 안 함.
  useEffect(() => {
    if (!storesHydrated) return;
    bridgeLastSyncFromMeta().catch((e: unknown) => {
      if (__DEV__) {
        console.error('[app-shell] lastSync bridge failed:', e);
      }
    });
  }, [storesHydrated]);

  if (!bootReady) {
    // FOUC + AsyncStorage race 방지 — ARCHITECTURE.md §부팅·hydration 순서.
    return null;
  }

  return (
    <ErrorBoundary>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.white },
        }}
      />
    </ErrorBoundary>
  );
}
