/**
 * TopBar — 화면 상단 헤더. title (필수) + 옵셔널 subtitle / back 버튼 / 우측 버튼.
 *
 * 8 prop 조합 매트릭스 (TESTING.md §9.12). 모든 시각 토큰 (bg, padding, radius)
 * 은 tailwind config — 매직 hex / px 금지.
 *
 * 좌측 back 버튼: 36×36 light bg + Icon 'back'.
 * 우측 버튼: 36×36, 기본 bg-light. accent='star' 일 때 orange-soft bg (즐겨찾기 강조).
 * title: H2 navy, 가운데 정렬, 1줄 ellipsis.
 * subtitle: title 아래 Tiny gray-2, 1줄 ellipsis.
 */

import * as React from 'react';

import { Pressable, View } from 'react-native';

import { Icon, type IconName } from './Icon';
import { H2, H3, Tiny } from './typography/Text';

export type TopBarTitleVariant = 'h2' | 'h3';

export type TopBarProps = {
  title: string;
  /**
   * 제목 폰트 사이즈 — design/README 화면별 사양:
   *   - 'h2' (18px Manrope 800) — Home / Settings / Detail (기본)
   *   - 'h3' (14px Manrope 700) — Compare 화면 (좁은 헤더)
   */
  titleVariant?: TopBarTitleVariant;
  subtitle?: string;
  onBack?: () => void;
  rightIcon?: IconName;
  rightIconAccent?: 'default' | 'star';
  /**
   * 우측 버튼의 스크린 리더 라벨. 미제공 시 fallback `'우측 메뉴'`.
   * 아이콘 의미 (`'즐겨찾기'`, `'검색'`, `'정보'`) 를 명시하면 a11y 향상.
   */
  rightIconAccessibilityLabel?: string;
  /**
   * 우측 버튼 onPress. **`rightIcon` 과 함께 제공해야** 버튼이 렌더된다.
   * 한쪽만 주면 silent no-op 회피 차원에서 버튼 자체가 렌더 안 됨.
   */
  onRightPress?: () => void;
  testID?: string;
};

const BUTTON_SIZE_CLASS = 'w-9 h-9 rounded-icon-md items-center justify-center';

export function TopBar({
  title,
  titleVariant = 'h2',
  subtitle,
  onBack,
  rightIcon,
  rightIconAccent = 'default',
  rightIconAccessibilityLabel,
  onRightPress,
  testID,
}: TopBarProps): React.ReactElement {
  const showBack = onBack !== undefined;
  // rightIcon + onRightPress 둘 다 있어야 버튼 렌더 — 한쪽만 주면 silent no-op
  // 이라 디버깅 어렵고 의미 없음. 의도적 read-only icon 이 필요한 케이스가
  // 생기면 별도 prop (`rightIconReadOnly`) 추가 후 ADR.
  const showRight = rightIcon !== undefined && onRightPress !== undefined;
  const rightBgClass =
    rightIconAccent === 'star' ? 'bg-orange-soft' : 'bg-light';
  const TitleComponent = titleVariant === 'h3' ? H3 : H2;

  return (
    <View
      className="flex-row items-center px-screen-x-tight py-2"
      testID={testID}
    >
      {/* 좌측 — back 버튼 또는 균형용 placeholder */}
      <View className="w-9">
        {showBack && (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="뒤로가기"
            className={`${BUTTON_SIZE_CLASS} bg-light`}
            testID={testID !== undefined ? `${testID}-back` : undefined}
          >
            <Icon name="back" size={22} />
          </Pressable>
        )}
      </View>

      {/* 가운데 — title + subtitle */}
      <View className="flex-1 items-center px-2">
        <TitleComponent numberOfLines={1}>{title}</TitleComponent>
        {subtitle !== undefined && <Tiny numberOfLines={1}>{subtitle}</Tiny>}
      </View>

      {/* 우측 — right 버튼 또는 균형용 placeholder */}
      <View className="w-9 items-end">
        {showRight && (
          <Pressable
            onPress={onRightPress}
            accessibilityRole="button"
            accessibilityLabel={rightIconAccessibilityLabel ?? '우측 메뉴'}
            className={`${BUTTON_SIZE_CLASS} ${rightBgClass}`}
            testID={testID !== undefined ? `${testID}-right` : undefined}
          >
            <Icon name={rightIcon} size={22} />
          </Pressable>
        )}
      </View>
    </View>
  );
}
