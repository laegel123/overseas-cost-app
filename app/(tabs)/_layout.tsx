import { Tabs } from 'expo-router';

/**
 * 하단 탭. v1.0 은 홈·설정 두 탭만 실제 화면 보유 (ADR-041).
 * 비교·즐겨찾기 탭은 Phase 5 에서 라우팅 단축 (홈으로 redirect + state 변형) 으로 구현.
 * 본 step 에서는 두 탭만 등록한다.
 */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: '홈' }} />
      <Tabs.Screen name="settings" options={{ title: '설정' }} />
    </Tabs>
  );
}
