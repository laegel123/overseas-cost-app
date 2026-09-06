/**
 * ComparePair — Compare 화면 카테고리별 듀얼 바 카드.
 * design/README §3 + UI_GUIDE §ComparePair.
 *
 * Hot 판정은 isHot(mult) 단일 함수 사용 (CLAUDE.md CRITICAL).
 *
 * 포함/제외 토글 (ADR-062):
 *   사용자가 카드별 Switch 로 hero 합산에 포함할지 결정. 미포함 카드는 화면에서
 *   숨기지 않고 카드 전체 opacity + "제외됨" 배지 + 토글 OFF 색 = 3중 인코딩
 *   으로 표시.
 *
 * 접근성 구조 (e2e-defects step 2):
 *   시각 컨테이너(View, root testID) > 탭 영역(Pressable, 단일 button 요소) 과
 *   Switch 를 **형제**로 둔다. Switch 가 accessible Pressable 의 자손이면 iOS 가
 *   카드를 하나의 접근성 요소로 묶어 토글이 VoiceOver·E2E 트리에서 개별 요소로
 *   노출되지 않는다 (.maestro/GOTCHAS.md §5). Switch 는 헤더 우측 끝에 카드
 *   padding 과 같은 오프셋(top-3/right-3)으로 절대 배치한다.
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

  const hasToggle = onToggleInclude !== undefined;

  const content = (
    <>
      {/* 헤더: 아이콘 박스 + 라벨 (+ "제외됨" 배지) / 배수 */}
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
        {/* Switch 는 이 Pressable 밖에 절대 배치되므로 (파일 상단 주석) 겹치지
            않도록 Switch 폭만큼 우측 여백을 둔다.
            iOS Switch 의 실측 폭은 63pt 다 (RN 문서상 51pt 가 아니다 —
            maestro hierarchy 로 측정). right-3(12pt) 오프셋을 더하면 75pt 를
            비워야 하므로 mr-20(80px) 을 쓴다. mr-16(64px) 은 부족하다. */}
        <View
          className={`flex-row items-center gap-2 shrink-0${hasToggle ? ' mr-20' : ''}`}
        >
          <H3
            color={multColor}
            numberOfLines={1}
            className="font-manrope-extrabold"
            {...(testID !== undefined ? { testID: `${testID}-mult` } : {})}
          >
            {multText}
          </H3>
        </View>
      </View>

      {/* 막대 영역 — 컬럼 우선(column-major) 구조.
          불변식 B: 라벨/값을 행마다 auto 폭으로 두면 "서울" 과 "샌프란시스코"
          처럼 라벨 길이가 다를 때 두 막대의 시작·끝 x 가 어긋나 길이 비교라는
          듀얼 바의 존재 이유가 깨진다. 컬럼별로 두 행을 세로로 쌓아 폭을 긴
          쪽에 맞추고, 세 컬럼의 셀 높이(h-4 = Small line-height)와 행 간격
          (gap-1.5)을 동일하게 둬 행이 가로로 정렬되게 한다. */}
      <View className="flex-row items-center gap-2">
        {/* 라벨 컬럼 — 내용 폭 (고정 폭 없음 → 도시명 잘림 없음) */}
        <View className="shrink-0 gap-1.5">
          <View className="h-4 justify-center">
            <Small
              color="gray-2"
              numberOfLines={1}
              className="font-manrope-bold"
            >
              {sLabel}
            </Small>
          </View>
          <View className="h-4 justify-center">
            <Small
              // design/README.md §3 line 77 — "좌측 라벨 (SEO/VAN ... — 색상 일치)".
              // 도시 라벨은 막대 색 (orange) 과 일치하도록 hot 여부와 무관하게 항상
              // orange 고정 (PR #16 review 이슈 4).
              color="orange"
              numberOfLines={1}
              className="font-manrope-bold"
            >
              {cLabel}
            </Small>
          </View>
        </View>

        {/* 막대 컬럼 — 남는 폭 흡수 */}
        <View className="flex-1 min-w-0 gap-1.5">
          <View className="h-4 justify-center">
            <View className="h-2 bg-light rounded">
              {sw > 0 && (
                <View
                  style={{ width: `${sw * 100}%` }}
                  className="h-2 bg-gray rounded"
                  {...(testID !== undefined ? { testID: `${testID}-bar-seoul` } : {})}
                />
              )}
            </View>
          </View>
          <View className="h-4 justify-center">
            <View className="h-2 bg-light rounded">
              {cw > 0 && (
                <View
                  style={{ width: `${cw * 100}%` }}
                  className="h-2 bg-orange rounded"
                  {...(testID !== undefined ? { testID: `${testID}-bar-city` } : {})}
                />
              )}
            </View>
          </View>
        </View>

        {/* 값 컬럼 — 내용 폭, 우측 정렬 (금액 잘림 없음) */}
        <View className="shrink-0 items-end gap-1.5">
          <View className="h-4 justify-center">
            <Small
              color="gray"
              numberOfLines={1}
              className="text-right font-manrope-semibold"
            >
              {sValue}
            </Small>
          </View>
          <View className="h-4 justify-center">
            <Small
              color="navy"
              numberOfLines={1}
              className="text-right font-manrope-bold"
            >
              {cValue}
            </Small>
          </View>
        </View>
      </View>
    </>
  );

  return (
    <View
      style={{ opacity: included ? 1 : EXCLUDED_CARD_OPACITY }}
      className="bg-white border border-line rounded-card"
      testID={testID}
    >
      {onPress !== undefined ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${label} 비교 카드`}
          className="p-3"
        >
          {content}
        </Pressable>
      ) : (
        <View className="p-3">{content}</View>
      )}

      {hasToggle && (
        <View className="absolute top-3 right-3">
          <Switch
            value={included}
            onValueChange={handleToggle}
            trackColor={{ false: colors.line, true: colors.orange }}
            thumbColor={colors.white}
            ios_backgroundColor={colors.line}
            accessibilityRole="switch"
            accessibilityLabel={`${label} 합산 포함`}
            accessibilityState={{ checked: included }}
            {...(testID !== undefined ? { testID: `${testID}-toggle` } : {})}
          />
        </View>
      )}
    </View>
  );
}
