import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

/**
 * 루트 레이아웃. 폰트 로딩 / Zustand hydration gate 는 각각 Step 5 / Phase 3 에서 추가된다.
 * 본 step 에서는 Stack 만 깐다.
 */
export default function RootLayout() {
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
