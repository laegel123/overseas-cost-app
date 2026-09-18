/**
 * AdBanner (web) — 웹 빌드에서는 광고를 렌더하지 않는다 (ADR-077).
 *
 * 광고 SDK 와 `AdBanner.native.tsx` 를 import 하지 않는다 (웹 번들에 네이티브
 * 모듈이 끌려온다). 계약은 `AdBannerProps` 만 동일하고 결과는 항상 null.
 */

import type * as React from 'react';

export type AdBannerProps = {
  /** 네이티브 구현과 동일한 계약 유지 — 웹에서는 렌더 결과가 없어 사용되지 않는다. */
  testID?: string;
};

export function AdBanner(_props: AdBannerProps): React.ReactElement | null {
  return null;
}
