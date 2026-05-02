/**
 * Onboarding — 설치 직후 1회 페르소나 선택.
 *
 * 3개 카드: 유학생 (primary) / 취업자 (secondary) / 아직 모름 (tertiary).
 * 탭 → setPersona + setOnboarded(true) + router.replace('/(tabs)').
 */

import * as React from 'react';

import { Pressable, View } from 'react-native';

import { useRouter } from 'expo-router';

import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Body, Display, H3, MonoLabel, Small, Tiny } from '@/components/typography/Text';
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
    'flex-row items-center gap-3.5 p-4 rounded-card-lg',
    isPrimary && 'border-[1.5px] border-orange bg-orange-tint',
    variant === 'secondary' && 'border border-line bg-white',
    isTertiary && 'border border-dashed border-line bg-transparent',
  ]
    .filter(Boolean)
    .join(' ');

  // tertiary variant 는 icon box 자체를 미렌더 (아래 {!isTertiary && ...}).
  const iconBoxClassName = [
    'w-11 h-11 rounded-xl items-center justify-center',
    isPrimary && 'bg-orange',
    variant === 'secondary' && 'bg-light',
  ]
    .filter(Boolean)
    .join(' ');

  const iconColor = isPrimary ? colors.white : colors.navy;
  const chevronColor = isPrimary ? colors.orange : colors.gray2;

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
          {isTertiary ? (
            <Small color="gray" className="font-manrope-bold">{label}</Small>
          ) : (
            <H3>{label}</H3>
          )}
          <Tiny>{sub}</Tiny>
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
  // 빠른 연타 가드 — 첫 탭만 store/navigate 실행. router.replace 후 unmount 되지만
  // 첫 동작이 동기 setState 라 같은 tick 안의 두 번째 탭이 navigate 직전 통과 가능.
  const isNavigatingRef = React.useRef(false);

  const handleSelect = React.useCallback(
    (persona: Persona) => {
      if (isNavigatingRef.current) return;
      isNavigatingRef.current = true;
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
            className="w-14 h-14 rounded-hero-icon bg-orange items-center justify-center"
            style={shadows.orangeCta}
          >
            <Icon name="globe" size={28} color={colors.white} strokeWidth={2.2} />
          </View>

          {/* Greeting */}
          <View className="gap-1">
            <Display>안녕하세요</Display>
            <Display color="orange">어디로 떠나시나요?</Display>
          </View>

          {/* Description */}
          <Body className="max-w-[240px]">
            서울 기준으로 해외 도시의 생활비를{'\n'}본인 페르소나에 맞게 비교해 드려요.
          </Body>
        </View>

        {/* Persona selection */}
        <View className="mt-6 gap-2.5">
          <MonoLabel className="mb-1">어떤 분이신가요?</MonoLabel>

          <PersonaCard persona="student" variant="primary" onPress={() => handleSelect('student')} />
          <PersonaCard persona="worker" variant="secondary" onPress={() => handleSelect('worker')} />
          <PersonaCard persona="unknown" variant="tertiary" onPress={() => handleSelect('unknown')} />
        </View>

        {/* Footer */}
        <View className="mt-5 mb-4">
          <Tiny className="text-center">설정에서 언제든 변경할 수 있어요</Tiny>
        </View>
      </View>
    </Screen>
  );
}
