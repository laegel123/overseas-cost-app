/**
 * RegionPill — 홈 화면 권역 필터 chip. design/README §3 (Home — 권역 그리드).
 *
 * active true: navy fill + white text. false: white bg + line border + navy
 * text. count 옵션 — `"북미 (8)"` 형식. hit slop 44×44 보장.
 *
 * 모든 시각 토큰은 tailwind config (CLAUDE.md CRITICAL).
 */

import * as React from 'react';

import { Pressable } from 'react-native';

import { Small } from './typography/Text';

export type RegionPillProps = {
  label: string;
  count?: number;
  active?: boolean;
  onSelect?: () => void;
  testID?: string;
};

// hit slop — RN Pressable 의 터치 영역 확장. 44×44 (Apple HIG / Material).
// padding (좌우 14 / 상하 8) + slop (8) ≥ 44 = 충분.
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

export function RegionPill({
  label,
  count,
  active = false,
  onSelect,
  testID,
}: RegionPillProps): React.ReactElement {
  const bgClass = active ? 'bg-navy' : 'bg-white border border-line';
  const textColor = active ? 'white' : 'navy';
  const displayLabel = count !== undefined ? `${label} (${count})` : label;

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={displayLabel}
      hitSlop={HIT_SLOP}
      className={`rounded-chip px-3.5 py-2 ${bgClass}`}
      testID={testID}
    >
      <Small color={textColor} numberOfLines={1}>
        {/* design/README §3 — chip 텍스트 12px (small 토큰) */}
        {/* TODO(v1.x): count "(8)" 부분만 opacity 0.6 — design 정밀 스펙. 현재
            단일 노드로 렌더해 균질 alpha. 화면 phase 진입 시 디자인 검토 후 재결정. */}
        {displayLabel}
      </Small>
    </Pressable>
  );
}
