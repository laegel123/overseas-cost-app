/**
 * ComparePair — Compare 화면 카테고리별 듀얼 바 카드.
 * design/README §3 + UI_GUIDE §ComparePair.
 *
 * Hot 판정은 isHot(mult) 단일 함수 사용 (CLAUDE.md CRITICAL).
 *
 * 포함/제외 토글 (ADR-062):
 *   사용자가 카드별 Switch 로 hero 합산에 포함할지 결정. 미포함 카드는 화면에서
 *   숨기지 않고 카드 전체 opacity + "제외됨" 배지 + 토글 OFF 색 = 3중 인코딩
 *   으로 표시. 토글은 자체 native 터치 영역을 가지므로 부모 Pressable 의 onPress
 *   (Detail 진입) 와 충돌하지 않는다.
 */

import * as React from 'react';

import { Pressable, Switch, View } from 'react-native';

import { formatMultiplier, getMultColor, isHot } from '@/lib';
import { colors, EXCLUDED_CARD_OPACITY } from '@/theme/tokens';
import type { SourceCategory } from '@/types/city';

import { Icon, type IconName } from './Icon';
import { H3, Small, Tiny } from './typography/Text';

export type ComparePairProps = {
  category: SourceCategory;
  /** 카테고리 라벨 — 예: "월세" */
  label: string;
  /** 서울 라벨 — 예: "서울" */
  sLabel: string;
  /** 서울 값 — 예: "120만" */
  sValue: string;
  /** 도시 라벨 — 예: "밴쿠버" */
  cLabel: string;
  /** 도시 값 — 예: "240만" */
  cValue: string;
  /** 배수 — 1.0 = 동일, > 1 = 도시가 비쌈 */
  mult: number | '신규';
  /** 서울 막대 폭 [0, 1] */
  swPct: number;
  /** 도시 막대 폭 [0, 1] */
  cwPct: number;
  /** hot override — 미지정 시 isHot(mult) 자동 판정 */
  hot?: boolean;
  /**
   * 사용자가 hero 합산에 포함할지 여부 (ADR-062). 기본 true.
   * false 면 카드 전체 opacity 약화 + "제외됨" 배지.
   */
  included?: boolean;
  /**
   * 토글 변경 콜백 — 미지정 시 Switch 자체를 렌더링하지 않음 (구 호출처 호환).
   * 호출되면 next 가 다음 included 값.
   */
  onToggleInclude?: (next: boolean) => void;
  onPress?: () => void;
  testID?: string;
};

const CATEGORY_ICON: Record<SourceCategory, IconName> = {
  rent: 'house',
  food: 'fork',
  transport: 'bus',
  tuition: 'graduation',
  tax: 'briefcase',
  visa: 'passport',
};

/**
 * 막대 폭 clamp [0, 1]. 범위 벗어나면 dev warn.
 */
function clampPct(pct: number, name: string): number {
  const clamped = Math.max(0, Math.min(1, pct));
  /* istanbul ignore else: __DEV__ 는 jest 환경에서 항상 true */
  if (__DEV__ && clamped !== pct) {
    // eslint-disable-next-line no-console
    console.warn(`[ComparePair] ${name} out of [0,1] — clamped. (${pct})`);
  }
  return clamped;
}

export function ComparePair({
  category,
  label,
  sLabel,
  sValue,
  cLabel,
  cValue,
  mult,
  swPct,
  cwPct,
  hot,
  included = true,
  onToggleInclude,
  onPress,
  testID,
}: ComparePairProps): React.ReactElement {
  const effectiveHot =
    hot !== undefined ? hot : typeof mult === 'number' && isHot(mult);

  const iconName = CATEGORY_ICON[category];
  const sw = clampPct(swPct, 'swPct');
  const cw = clampPct(cwPct, 'cwPct');

  const multText = formatMultiplier(mult);
  const multColor = getMultColor(mult, effectiveHot);

  const handleToggle = React.useCallback(
    (next: boolean) => {
      onToggleInclude?.(next);
    },
    [onToggleInclude],
  );

  const card = (
    <View
      style={{ opacity: included ? 1 : EXCLUDED_CARD_OPACITY }}
      className="bg-white border border-line rounded-card p-3"
      testID={testID}
    >
      {/* 헤더: 아이콘 박스 + 라벨 (+ "제외됨" 배지) / 배수 + 토글 */}
      <View className="flex-row items-center justify-between mb-2 gap-2">
        <View className="flex-row items-center gap-2 flex-1 min-w-0">
          <View
            className={`w-8 h-8 rounded-icon-sm items-center justify-center ${
              effectiveHot ? 'bg-orange-soft' : 'bg-light'
            }`}
            {...(testID !== undefined ? { testID: `${testID}-icon-box` } : {})}
          >
            <Icon
              name={iconName}
              size={18}
              color={effectiveHot ? colors.orange : colors.navy}
            />
          </View>
          <H3 numberOfLines={1}>{label}</H3>
          {!included && (
            <View
              className="bg-light rounded-full px-2 py-0.5 shrink-0"
              {...(testID !== undefined ? { testID: `${testID}-excluded-badge` } : {})}
            >
              <Tiny color="gray-2">제외됨</Tiny>
            </View>
          )}
        </View>
        <View className="flex-row items-center gap-2 shrink-0">
          <H3
            color={multColor}
            numberOfLines={1}
            className="font-manrope-extrabold"
            {...(testID !== undefined ? { testID: `${testID}-mult` } : {})}
          >
            {multText}
          </H3>
          {onToggleInclude !== undefined && (
            <Switch
              value={included}
              onValueChange={handleToggle}
              trackColor={{ false: colors.line, true: colors.orange }}
              thumbColor={colors.white}
              ios_backgroundColor={colors.line}
              accessibilityRole="switch"
              accessibilityLabel={`${label} 합산 포함`}
              {...(testID !== undefined ? { testID: `${testID}-toggle` } : {})}
            />
          )}
        </View>
      </View>

      {/* 막대 영역 */}
      <View className="gap-1.5">
        {/* 서울 행 */}
        <View className="flex-row items-center gap-2">
          <Small
            color="gray-2"
            numberOfLines={1}
            className="w-7 font-manrope-bold"
          >
            {sLabel}
          </Small>
          <View className="flex-1 h-2 bg-light rounded">
            {sw > 0 && (
              <View
                style={{ width: `${sw * 100}%` }}
                className="h-2 bg-gray rounded"
                {...(testID !== undefined ? { testID: `${testID}-bar-seoul` } : {})}
              />
            )}
          </View>
          <Small
            color="gray"
            numberOfLines={1}
            className="w-14 text-right font-manrope-semibold"
          >
            {sValue}
          </Small>
        </View>

        {/* 도시 행 */}
        <View className="flex-row items-center gap-2">
          <Small
            // design/README.md §3 line 77 — "좌측 라벨 (SEO/VAN ... — 색상 일치)".
            // 도시 라벨은 막대 색 (orange) 과 일치하도록 hot 여부와 무관하게 항상
            // orange 고정 (PR #16 review 이슈 4).
            color="orange"
            numberOfLines={1}
            className="w-7 font-manrope-bold"
          >
            {cLabel}
          </Small>
          <View className="flex-1 h-2 bg-light rounded">
            {cw > 0 && (
              <View
                style={{ width: `${cw * 100}%` }}
                className="h-2 bg-orange rounded"
                {...(testID !== undefined ? { testID: `${testID}-bar-city` } : {})}
              />
            )}
          </View>
          <Small
            color="navy"
            numberOfLines={1}
            className="w-14 text-right font-manrope-bold"
          >
            {cValue}
          </Small>
        </View>
      </View>
    </View>
  );

  if (onPress !== undefined) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label} 비교 카드`}
      >
        {card}
      </Pressable>
    );
  }

  return card;
}
