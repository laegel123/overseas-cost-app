/**
 * 비교 탭 placeholder — ADR-041 라우팅 단축으로 실제 진입 불가.
 * _layout.tsx tabPress listener 가 /compare/{cityId} 로 redirect.
 */

import * as React from 'react';

import { View } from 'react-native';

export default function CompareTabPlaceholder(): React.ReactElement {
  return <View />;
}
