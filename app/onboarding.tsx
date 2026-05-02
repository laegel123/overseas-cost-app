/**
 * Onboarding — 설치 직후 1회 페르소나 선택.
 *
 * 3개 카드: 유학생 (primary) / 취업자 (secondary) / 아직 모름 (tertiary).
 * 탭 → setPersona + setOnboarded(true) + router.replace('/(tabs)').
 */

import * as React from 'react';

import { Pressable, Text, View } from 'react-native';

import { useRouter } from 'expo-router';

import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { PERSONA_ICON, PERSONA_LABEL, PERSONA_SUB } from '@/lib/persona';
import { usePersonaStore } from '@/store';
import { colors, shadows } from '@/theme/tokens';
import type { Persona } from '@/types/city';

type CardVariant = 'primary' | 'secondary' | 'tertiary';

type PersonaCardProps = {
  persona: Persona;
  variant: CardVariant;
  onPress: () => void;
};

function PersonaCard({ persona, variant, onPress }: PersonaCardProps): React.ReactElement {
  const label = PERSONA_LABEL[persona];
  const sub = PERSONA_SUB[persona];
  const iconName = PERSONA_ICON[persona];

  const isPrimary = variant === 'primary';
  const isTertiary = variant === 'tertiary';

  const cardClassName = [
    'flex-row items-center gap-3.5 p-4 rounded-[18px]',
    isPrimary && 'border-[1.5px] border-orange bg-orangeTint',
    variant === 'secondary' && 'border border-line bg-white',
    isTertiary && 'border border-dashed border-line bg-transparent',
  ]
    .filter(Boolean)
    .join(' ');

  const iconBoxClassName = [
    'w-11 h-11 rounded-xl items-center justify-center',
    isPrimary && 'bg-orange',
    variant === 'secondary' && 'bg-light',
    isTertiary && 'bg-light',
  ]
    .filter(Boolean)
    .join(' ');

  const iconColor = isPrimary ? colors.white : colors.navy;
  const chevronColor = isPrimary ? colors.orange : colors.gray2;
  const labelClassName = isTertiary
    ? 'font-manrope-bold text-[13px] text-gray'
    : 'font-manrope-bold text-h3 text-navy';
  const subClassName = 'font-mulish text-tiny text-gray2';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} 선택`}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
      testID={`persona-card-${persona}`}
    >
      <View className={cardClassName}>
        {!isTertiary && (
          <View className={iconBoxClassName}>
            <Icon name={iconName} size={22} color={iconColor} />
          </View>
        )}
        <View className="flex-1 gap-1">
          <Text className={labelClassName}>{label}</Text>
          <Text className={subClassName}>{sub}</Text>
        </View>
        <Icon name="chev-right" size={isTertiary ? 18 : 20} color={chevronColor} />
      </View>
    </Pressable>
  );
}

export default function OnboardingScreen(): React.ReactElement {
  const router = useRouter();
  const setPersona = usePersonaStore((s) => s.setPersona);
  const setOnboarded = usePersonaStore((s) => s.setOnboarded);

  const handleSelect = React.useCallback(
    (persona: Persona) => {
      setPersona(persona);
      setOnboarded(true);
      router.replace('/(tabs)');
    },
    [setPersona, setOnboarded, router],
  );

  return (
    <Screen padding="screen-x-loose" testID="onboarding-screen">
      <View className="flex-1 justify-between">
        {/* Hero section */}
        <View className="mt-6 gap-3">
          {/* Hero icon */}
          <View
            className="w-14 h-14 rounded-[18px] bg-orange items-center justify-center"
            style={shadows.orangeCta}
          >
            <Icon name="globe" size={28} color={colors.white} strokeWidth={2.2} />
          </View>

          {/* Greeting */}
          <View className="gap-1">
            <Text className="font-manrope-extrabold text-display text-navy leading-tight tracking-tight">
              안녕하세요
            </Text>
            <Text className="font-manrope-extrabold text-display text-orange leading-tight tracking-tight">
              어디로 떠나시나요?
            </Text>
          </View>

          {/* Description */}
          <Text className="font-mulish text-body text-navy leading-relaxed max-w-[240px]">
            서울 기준으로 해외 도시의 생활비를{'\n'}본인 페르소나에 맞게 비교해 드려요.
          </Text>
        </View>

        {/* Persona selection */}
        <View className="mt-6 gap-2.5">
          <Text className="font-manrope-semibold text-[10px] uppercase tracking-widest text-gray2 mb-1">
            어떤 분이신가요?
          </Text>

          <PersonaCard persona="student" variant="primary" onPress={() => handleSelect('student')} />
          <PersonaCard persona="worker" variant="secondary" onPress={() => handleSelect('worker')} />
          <PersonaCard persona="unknown" variant="tertiary" onPress={() => handleSelect('unknown')} />
        </View>

        {/* Footer */}
        <View className="mt-5 mb-4">
          <Text className="font-mulish text-tiny text-gray2 text-center">
            설정에서 언제든 변경할 수 있어요
          </Text>
        </View>
      </View>
    </Screen>
  );
}
