/**
 * Screen — 모든 화면의 chrome wrapper. SafeAreaView + 배경 + padding 토큰 +
 * 선택적 ScrollView wrap.
 *
 * iOS notch / iPhone SE / Android safe-area 모두 `react-native-safe-area-context`
 * 가 처리. padding 은 tailwind config 의 spacing 토큰 (`screen-x*`) 만 사용 —
 * 매직 px 금지 (CLAUDE.md CRITICAL).
 */

import * as React from 'react';

import { ScrollView, View, type ViewStyle } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

export type ScreenPadding = 'none' | 'screen-x' | 'screen-x-tight' | 'screen-x-loose';

export type ScreenEdge = 'top' | 'bottom' | 'left' | 'right';

export type ScreenProps = {
  children: React.ReactNode;
  /** ScrollView 로 wrap (기본 false — 일반 View) */
  scroll?: boolean;
  /** 좌우 horizontal padding 토큰 — tailwind spacing 매핑 (기본 'screen-x') */
  padding?: ScreenPadding;
  /** SafeArea edges (기본 ['top', 'bottom']) — iPhone notch / home indicator 양쪽 보호 */
  edges?: ScreenEdge[];
  testID?: string;
};

const PADDING_CLASS: Record<ScreenPadding, string> = {
  none: '',
  'screen-x': 'px-screen-x',
  'screen-x-tight': 'px-screen-x-tight',
  'screen-x-loose': 'px-screen-x-loose',
};

const DEFAULT_EDGES: readonly ScreenEdge[] = ['top', 'bottom'];

// 모듈 레벨 상수 — 매 렌더 새 객체 참조 회피로 ScrollView 의 불필요한 re-render 방지.
const SCROLL_CONTENT_STYLE: ViewStyle = { flexGrow: 1 };

export function Screen({
  children,
  scroll = false,
  padding = 'screen-x',
  edges,
  testID,
}: ScreenProps): React.ReactElement {
  const paddingClass = PADDING_CLASS[padding];
  const innerClassName = ['flex-1', paddingClass].filter(Boolean).join(' ');
  const safeEdges = edges ?? DEFAULT_EDGES;

  if (scroll) {
    // ScrollView 는 padding 을 contentContainerStyle 로 받아야 children flex 가 정상 동작.
    return (
      <SafeAreaView edges={[...safeEdges]} className="flex-1 bg-white">
        <ScrollView
          contentContainerStyle={SCROLL_CONTENT_STYLE}
          className={paddingClass}
          testID={testID}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={[...safeEdges]} className="flex-1 bg-white">
      <View className={innerClassName} testID={testID}>
        {children}
      </View>
    </SafeAreaView>
  );
}
