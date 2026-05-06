/**
 * 세금 — 연봉 기준 선택 시트.
 *
 * 도시의 등록된 연봉 tier 목록 + "직접 입력" → 입력 모드. takeHomePctApprox 는
 * 도시 첫 preset 의 값을 차용 (resolveTaxChoice 정책).
 */

import * as React from 'react';

import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { convertToKRW, formatKRW } from '@/lib';
import { resolveTaxChoice, useTaxChoiceStore } from '@/store';
import { colors } from '@/theme/tokens';
import type { CityCostData, ExchangeRates } from '@/types/city';

import { BottomSheet } from './BottomSheet';
import { Body, Small, Tiny } from './typography/Text';

export type TaxChoiceSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  cityId: string;
  cityCurrency: string;
  cityTax: CityCostData['tax'];
  fx: ExchangeRates;
  testID?: string;
};

type Mode = 'list' | 'custom';

export function TaxChoiceSheet({
  visible,
  onDismiss,
  cityId,
  cityCurrency,
  cityTax,
  fx,
  testID,
}: TaxChoiceSheetProps): React.ReactElement {
  const choice = useTaxChoiceStore((s) => s.choices[cityId]);
  const setChoice = useTaxChoiceStore((s) => s.setTaxChoice);
  const clearChoice = useTaxChoiceStore((s) => s.clearTaxChoice);

  const resolved = resolveTaxChoice(cityTax, choice);

  const [mode, setMode] = React.useState<Mode>(
    choice?.kind === 'custom' ? 'custom' : 'list',
  );
  const [draft, setDraft] = React.useState<string>(
    choice?.kind === 'custom' ? String(choice.annualSalary) : '',
  );

  React.useEffect(() => {
    if (!visible) return;
    setMode(choice?.kind === 'custom' ? 'custom' : 'list');
    setDraft(choice?.kind === 'custom' ? String(choice.annualSalary) : '');
  }, [visible, choice]);

  const entries = cityTax ?? [];

  const handlePickPreset = (annualSalary: number) => {
    setChoice(cityId, { kind: 'preset', annualSalary });
    onDismiss();
  };

  const handleSaveCustom = () => {
    const n = Number(draft);
    if (!Number.isFinite(n) || n <= 0) return;
    setChoice(cityId, { kind: 'custom', annualSalary: n });
    onDismiss();
  };

  const handleClearCustom = () => {
    // entries 유무와 무관하게 choice 제거 — stale custom 으로 인한 무한 custom
    // 모드 진입 방지 (PR #25 2차 review).
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
      title={mode === 'custom' ? '연봉 직접 입력' : '연봉 기준 선택'}
      {...(testID !== undefined ? { testID } : {})}
    >
      {mode === 'list' ? (
        <ScrollView
          className="max-h-[420px]"
          showsVerticalScrollIndicator={false}
        >
          {entries.map((e) => {
            const isSelected =
              resolved !== null &&
              !resolved.isCustom &&
              resolved.annualSalary === e.annualSalary;
            // takeHomePctApprox 는 [0,1] 소수 (citySchema 검증). PR #25 review.
            const monthlyTaxLocal =
              (e.annualSalary / 12) * (1 - e.takeHomePctApprox);
            const monthlyTaxKRW = convertToKRW(monthlyTaxLocal, cityCurrency, fx);
            return (
              <Pressable
                key={String(e.annualSalary)}
                onPress={() => handlePickPreset(e.annualSalary)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                className={`flex-row items-center gap-3 px-3 py-3 rounded-card ${
                  isSelected ? 'bg-orange' : ''
                }`}
                testID={
                  testID !== undefined
                    ? `${testID}-preset-${e.annualSalary}`
                    : undefined
                }
              >
                <View
                  className={`w-9 h-9 items-center justify-center rounded-[10px] ${
                    isSelected ? 'bg-white' : 'bg-orange-soft'
                  }`}
                >
                  <Text style={{ fontSize: 18 }}>💼</Text>
                </View>
                <View className="flex-1 min-w-0">
                  <Body
                    color={isSelected ? 'white' : 'navy'}
                    className="font-manrope-bold"
                    numberOfLines={1}
                  >
                    연봉 {e.annualSalary.toLocaleString()} {cityCurrency}
                  </Body>
                  <Tiny
                    color={isSelected ? 'white' : 'gray-2'}
                    numberOfLines={1}
                  >
                    실수령 {(e.takeHomePctApprox * 100).toFixed(0)}% · 월 세금{' '}
                    {formatKRW(monthlyTaxKRW)}
                  </Tiny>
                </View>
              </Pressable>
            );
          })}

          <View className="border-t border-line my-2" />

          {/*
            PR #25 3차 review — tax custom 은 takeHomePctApprox 차용을 위해
            entries[0] 가 필요. entries 부재 시 resolveTaxChoice 가 null 을 반환해
            저장해도 화면에 반영되지 않는 silent failure. 사용자 혼란 방지를
            위해 custom 행을 노출하지 않고 안내 문구만 표시.
          */}
          {entries.length === 0 ? (
            <View
              className="px-3 py-3 rounded-card bg-orange-tint"
              testID={testID !== undefined ? `${testID}-custom-disabled` : undefined}
            >
              <Tiny color="orange">
                이 도시는 세율 데이터가 없어 직접 입력이 지원되지 않아요.
              </Tiny>
            </View>
          ) : (
          <Pressable
            onPress={() => {
              setMode('custom');
              if (choice?.kind === 'custom') {
                setDraft(String(choice.annualSalary));
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
              <Tiny
                color={resolved !== null && resolved.isCustom ? 'white' : 'gray-2'}
              >
                {resolved !== null && resolved.isCustom
                  ? `연봉 ${resolved.annualSalary.toLocaleString()} ${cityCurrency}`
                  : '연봉을 직접 입력해요'}
              </Tiny>
            </View>
          </Pressable>
          )}
        </ScrollView>
      ) : (
        <View className="gap-4">
          <View className="gap-1">
            <Small color="navy" className="font-manrope-bold">
              연봉 ({cityCurrency})
            </Small>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              keyboardType="numeric"
              placeholder="예: 70000"
              placeholderTextColor={colors.gray2}
              accessibilityLabel="연봉"
              className="bg-light-2 rounded-card px-4 py-3 text-body text-navy"
              testID={testID !== undefined ? `${testID}-custom-input` : undefined}
            />
            <Tiny color="gray-2">
              0보다 큰 숫자. 실수령률은 도시 평균값을 사용합니다.
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
                ← 연봉 목록
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
                초기화 (등록된 첫 연봉 tier 로)
              </Tiny>
            </Pressable>
          ) : null}
        </View>
      )}
    </BottomSheet>
  );
}
