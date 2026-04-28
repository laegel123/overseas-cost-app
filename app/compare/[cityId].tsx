// Placeholder. 실제 구현은 Phase 5 (screens) 에서.
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView, Text, View } from 'react-native';

export default function CompareScreen() {
  const { cityId } = useLocalSearchParams<{ cityId: string }>();
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center">
        <Text className="font-manrope text-h2 text-navy">{`Compare: ${cityId ?? '?'} (준비 중)`}</Text>
      </View>
    </SafeAreaView>
  );
}
