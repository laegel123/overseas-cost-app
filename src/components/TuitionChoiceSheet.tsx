/**
 * 학비 — 학교 선택 시트.
 *
 * 도시의 등록된 학교 목록 + 마지막 행 "직접 입력" → 입력 모드 전환.
 * 저장 시 useTuitionChoiceStore.setTuitionChoice 호출 + dismiss.
 *
 * Props 의 cityTuition 은 도시 데이터 그대로. resolved 선택값은 시각 강조용.
 */

import * as React from 'react';

import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useShallow } from 'zustand/react/shallow';

import { convertToKRW, formatKRW } from '@/lib';
import { resolveTuitionChoice, useTuitionChoiceStore } from '@/store';
import { colors } from '@/theme/tokens';
import type { CityCostData, ExchangeRates } from '@/types/city';

import { BottomSheet } from './BottomSheet';
import { Body, Small, Tiny } from './typography/Text';

export type TuitionChoiceSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  cityId: string;
  cityCurrency: string;
  cityTuition: CityCostData['tuition'];
  fx: ExchangeRates;
  testID?: string;
};

type Mode = 'list' | 'custom';

export function TuitionChoiceSheet({
  visible,
  onDismiss,
  cityId,
  cityCurrency,
  cityTuition,
  fx,
  testID,
}: TuitionChoiceSheetProps): React.ReactElement {
  const { choice, setChoice, clearChoice } = useTuitionChoiceStore(
    useShallow((s) => ({
      choice: s.choices[cityId],
      setChoice: s.setTuitionChoice,
      clearChoice: s.clearTuitionChoice,
    })),
  );

  const resolved = resolveTuitionChoice(cityTuition, choice);

  const [mode, setMode] = React.useState<Mode>(
    choice?.kind === 'custom' ? 'custom' : 'list',
  );
  const [draft, setDraft] = React.useState<string>(
    choice?.kind === 'custom' ? String(choice.annual) : '',
  );

  // visible 이 다시 열릴 때 mode/draft 초기화 — 닫혔을 때 상태가 stale 하지 않도록.
  React.useEffect(() => {
    if (!visible) return;
    setMode(choice?.kind === 'custom' ? 'custom' : 'list');
    setDraft(choice?.kind === 'custom' ? String(choice.annual) : '');
  }, [visible, choice]);

  const entries = cityTuition ?? [];

  const handlePickPreset = (school: string) => {
    setChoice(cityId, { kind: 'preset', school });
    onDismiss();
  };

  const handleSaveCustom = () => {
    const n = Number(draft);
    if (!Number.isFinite(n) || n <= 0) return;
    setChoice(cityId, { kind: 'custom', annual: n });
    onDismiss();
  };

  const handleClearCustom = () => {
    // entries 유무와 무관하게 항상 choice 제거 — entries 가 있으면
    // resolveTuitionChoice 가 entries[0] 로 fallback 하고, 없어도 store 에 stale
    // custom 이 남아 시트 재오픈 시 custom 모드 자동 진입하는 무한 loop 방지
    // (PR #25 2차 review).
    clearChoice(cityId);
    setMode('list');
  };

  // custom 모드 입력 유효성 — 렌더당 1회 평가 (PR #25 2차 review: IIFE 제거).
  const draftNum = Number(draft);
  const isValidDraft = Number.isFinite(draftNum) && draftNum > 0;

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      title={mode === 'custom' ? '학비 직접 입력' : '학교 선택'}
      {...(testID !== undefined ? { testID } : {})}
    >
      {mode === 'list' ? (
        <ScrollView
          className="max-h-[420px]"
          showsVerticalScrollIndicator={false}
        >
          {entries.map((e) => {
            const isSelected =
              resolved !== null && !resolved.isCustom && resolved.school === e.school;
            const monthlyKRW = convertToKRW(e.annual / 12, cityCurrency, fx);
            return (
              <Pressable
                key={e.school}
                onPress={() => handlePickPreset(e.school)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                className={`flex-row items-center gap-3 px-3 py-3 rounded-card ${
                  isSelected ? 'bg-orange' : ''
                }`}
                testID={
                  testID !== undefined ? `${testID}-preset-${e.school}` : undefined
                }
              >
                <View
                  className={`w-9 h-9 items-center justify-center rounded-[10px] ${
                    isSelected ? 'bg-white' : 'bg-orange-soft'
                  }`}
                >
                  <Text style={{ fontSize: 18 }}>🎓</Text>
                </View>
                <View className="flex-1 min-w-0">
                  <Body
                    color={isSelected ? 'white' : 'navy'}
                    numberOfLines={1}
                    className="font-manrope-bold"
                  >
                    {e.school}
                  </Body>
                  <Tiny color={isSelected ? 'white' : 'gray-2'} numberOfLines={1}>
                    연 {e.annual.toLocaleString()} {cityCurrency} · 월 {formatKRW(monthlyKRW)}
                  </Tiny>
                </View>
              </Pressable>
            );
          })}

          {/* PR #25 4차 review — entries 없으면 구분선만 홀로 렌더되어 어색함. */}
          {entries.length > 0 ? <View className="border-t border-line my-2" /> : null}

          <Pressable
            onPress={() => {
              setMode('custom');
              if (choice?.kind === 'custom') {
                setDraft(String(choice.annual));
              } else {
                setDraft('');
              }
            }}
            accessibilityRole="button"
            className={`flex-row items-center gap-3 px-3 py-3 rounded-card ${
              resolved !== null && resolved.isCustom ? 'bg-orange' : ''
            }`}
            testID={testID !== undefined ? `${testID}-custom-row` : undefined}
          >
            <View
              className={`w-9 h-9 items-center justify-center rounded-[10px] ${
                resolved !== null && resolved.isCustom ? 'bg-white' : 'bg-light'
              }`}
            >
              <Text style={{ fontSize: 18 }}>✏️</Text>
            </View>
            <View className="flex-1 min-w-0">
              <Body
                color={resolved !== null && resolved.isCustom ? 'white' : 'navy'}
                className="font-manrope-bold"
              >
                직접 입력
              </Body>
              <Tiny color={resolved !== null && resolved.isCustom ? 'white' : 'gray-2'}>
                {resolved !== null && resolved.isCustom
                  ? `연 ${resolved.annual.toLocaleString()} ${cityCurrency}`
                  : '연 학비를 직접 입력해요'}
              </Tiny>
            </View>
          </Pressable>
        </ScrollView>
      ) : (
        <View className="gap-4">
          <View className="gap-1">
            <Small color="navy" className="font-manrope-bold">
              연 학비 ({cityCurrency})
            </Small>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              keyboardType="numeric"
              placeholder="예: 12000"
              placeholderTextColor={colors.gray2}
              accessibilityLabel="연 학비"
              className="bg-light-2 rounded-card px-4 py-3 text-body text-navy"
              testID={testID !== undefined ? `${testID}-custom-input` : undefined}
            />
            <Tiny color="gray-2">
              0보다 큰 숫자를 입력하세요. 환율로 자동 환산됩니다.
            </Tiny>
          </View>

          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setMode('list')}
              accessibilityRole="button"
              className="flex-1 items-center justify-center py-3 rounded-button bg-light"
              testID={testID !== undefined ? `${testID}-back` : undefined}
            >
              <Body color="navy" className="font-manrope-bold">
                ← 학교 목록
              </Body>
            </Pressable>
            <Pressable
              onPress={handleSaveCustom}
              accessibilityRole="button"
              accessibilityState={{ disabled: !isValidDraft }}
              className={`flex-1 items-center justify-center py-3 rounded-button ${
                isValidDraft ? 'bg-orange' : 'bg-orange-soft'
              }`}
              testID={testID !== undefined ? `${testID}-save` : undefined}
            >
              <Body color="white" className="font-manrope-bold">
                저장
              </Body>
            </Pressable>
          </View>

          {choice?.kind === 'custom' ? (
            <Pressable
              onPress={handleClearCustom}
              accessibilityRole="button"
              testID={testID !== undefined ? `${testID}-clear` : undefined}
            >
              <Tiny color="gray-2" className="text-center">
                초기화 (등록된 학교 첫 항목으로)
              </Tiny>
            </Pressable>
          ) : null}
        </View>
      )}
    </BottomSheet>
  );
}
