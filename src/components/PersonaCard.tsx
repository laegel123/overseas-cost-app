/**
 * PersonaCard — Onboarding 페르소나 선택 카드.
 *
 * 3 variant: primary (orange tint) / secondary (white) / tertiary (dashed).
 * 라벨·아이콘 출처는 `src/lib/persona.ts` (단일 출처). 시각 토큰은 tailwind config.
 */

import * as React from 'react';

import { Pressable, View } from 'react-native';

import { PERSONA_ICON, PERSONA_LABEL, PERSONA_SUB } from '@/lib/persona';
import { colors } from '@/theme/tokens';
import type { Persona } from '@/types/city';

import { Icon } from './Icon';
import { H3, Small, Tiny } from './typography/Text';

export type PersonaCardVariant = 'primary' | 'secondary' | 'tertiary';

export type PersonaCardProps = {
  persona: Persona;
  variant: PersonaCardVariant;
  onPress: () => void;
};

export function PersonaCard({
  persona,
  variant,
  onPress,
}: PersonaCardProps): React.ReactElement {
  const label = PERSONA_LABEL[persona];
  const sub = PERSONA_SUB[persona];
  const iconName = PERSONA_ICON[persona];

  const isPrimary = variant === 'primary';
  const isTertiary = variant === 'tertiary';

  const cardClassName = [
    'flex-row items-center gap-3.5 p-4 rounded-card-lg',
    isPrimary && 'border-1.5 border-orange bg-orange-tint',
    variant === 'secondary' && 'border border-line bg-white',
    isTertiary && 'border border-dashed border-line bg-transparent',
  ]
    .filter(Boolean)
    .join(' ');

  // tertiary variant 는 icon box 자체를 미렌더 (아래 {!isTertiary && ...}).
  const iconBoxClassName = [
    'w-11 h-11 rounded-persona-icon items-center justify-center',
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
            <Small color="gray" className="font-manrope-bold">
              {label}
            </Small>
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
