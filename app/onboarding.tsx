// Placeholder. 실제 구현은 Phase 5 (screens) 에서.
import { Text, View } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

export default function OnboardingScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center">
        <Text className="font-manrope text-h2 text-navy">온보딩 (준비 중)</Text>
      </View>
    </SafeAreaView>
  );
}
