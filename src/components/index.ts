/**
 * 도메인 컴포넌트의 단일 진입점.
 */

export { Icon, ICON_NAMES } from './Icon';
export type { IconName, IconProps } from './Icon';

export { Screen } from './Screen';
export type { ScreenEdge, ScreenPadding, ScreenProps } from './Screen';

export { TopBar } from './TopBar';
export type { TopBarProps } from './TopBar';

export { BottomTabBar } from './BottomTabBar';
export type { BottomTabBarProps, Tab } from './BottomTabBar';

export { ErrorBoundary } from './ErrorBoundary';
export { ErrorView } from './ErrorView';
export type { ErrorViewProps, ErrorViewVariant } from './ErrorView';

export {
  Body,
  Display,
  H1,
  H2,
  H3,
  MonoLabel,
  Small,
  Tiny,
} from './typography/Text';
export type { TextColor, TextProps } from './typography/Text';
