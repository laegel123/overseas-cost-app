/**
 * Icon — design/README.md §Assets 의 25 아이콘 카탈로그 단일 진입점.
 *
 * lucide-react-native (ADR-054) 의 named export 를 정적 매핑. 사용처는
 * `<Icon name="home" size={22} color={colors.navy} />` 처럼 IconName 만 알면
 * 됨 — lucide 컴포넌트를 직접 import 하지 않는다 (라이브러리 교체 시 본 파일만
 * 변경).
 *
 * 시각 표준 (design/README.md):
 *   - line-style stroke (more 만 fill dots)
 *   - viewBox 24×24
 *   - default size 22, strokeWidth 2, color navy
 */

import * as React from 'react';

import { View } from 'react-native';

import {
  ArrowLeftRight,
  ArrowUp,
  Book,
  BookMarked,
  Briefcase,
  Bus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Globe,
  GraduationCap,
  Home,
  House,
  Info,
  type LucideProps,
  Mail,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Star,
  User,
  UtensilsCrossed,
} from 'lucide-react-native';

import { type ColorToken, colors } from '@/theme/tokens';

export const ICON_NAMES = [
  'home',
  'compare',
  'star',
  'settings',
  'search',
  'back',
  'more',
  'house',
  'fork',
  'bus',
  'passport',
  'graduation',
  'briefcase',
  'globe',
  'chev-right',
  'chev-down',
  'info',
  'refresh',
  'mail',
  'shield',
  'book',
  'user',
  'plus',
  'filter',
  'up',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export type IconProps = {
  name: IconName;
  size?: number;
  /**
   * 디자인 토큰 hex (`tokens.ts` 의 `colors`) 만 허용 — 매직 hex 직접 박지
   * 못하도록 좁힘 (CLAUDE.md CRITICAL).
   */
  color?: (typeof colors)[ColorToken];
  strokeWidth?: number;
  testID?: string;
  accessibilityLabel?: string;
};

type LucideComponent = React.ComponentType<LucideProps>;

const ICON_MAP: Record<IconName, LucideComponent> = {
  home: Home,
  compare: ArrowLeftRight,
  star: Star,
  settings: Settings,
  search: Search,
  back: ChevronLeft,
  more: MoreHorizontal,
  house: House,
  fork: UtensilsCrossed,
  bus: Bus,
  passport: BookMarked,
  graduation: GraduationCap,
  briefcase: Briefcase,
  globe: Globe,
  'chev-right': ChevronRight,
  'chev-down': ChevronDown,
  info: Info,
  refresh: RefreshCw,
  mail: Mail,
  shield: Shield,
  book: Book,
  user: User,
  plus: Plus,
  filter: SlidersHorizontal,
  up: ArrowUp,
};

const DEFAULT_SIZE = 22;
const DEFAULT_STROKE_WIDTH = 2;

export function Icon({
  name,
  size = DEFAULT_SIZE,
  color = colors.navy,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  testID,
  accessibilityLabel,
}: IconProps): React.ReactElement {
  const Component = ICON_MAP[name];
  // lucide-react-native 는 testID / accessibilityLabel 을 svg 로 propagate 하지
  // 않으므로 View 로 wrap. style width/height = size 로 hitbox 정합성 유지.
  // accessibilityLabel 이 있으면 의미 있는 아이콘 → 'image' role + 스크린 리더 노출.
  // 없으면 데코레이티브 → importantForAccessibility='no' 로 스킵.
  const hasLabel = accessibilityLabel !== undefined;
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole={hasLabel ? 'image' : undefined}
      importantForAccessibility={hasLabel ? 'yes' : 'no'}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
    >
      <Component size={size} color={color} strokeWidth={strokeWidth} />
    </View>
  );
}
