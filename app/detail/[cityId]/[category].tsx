// Placeholder. 실제 구현은 Phase 5 (screens) 에서.
import { SafeAreaView, Text, View } from 'react-native';

import { useLocalSearchParams } from 'expo-router';

export default function DetailScreen() {
  const { cityId, category } = useLocalSearchParams<{ cityId: string; category: string }>();
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center">
        <Text className="font-manrope text-h2 text-navy">{`Detail: ${cityId ?? '?'} / ${category ?? '?'} (준비 중)`}</Text>
      </View>
    </SafeAreaView>
  );
}
