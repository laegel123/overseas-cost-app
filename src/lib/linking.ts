/**
 * Linking wrapper — 테스트 용이성을 위한 thin wrapper.
 *
 * react-native 의 Linking 을 직접 export. 테스트에서 jest.mock('@/lib/linking')
 * 으로 간단히 mock 가능. TESTING.md §5 의 react-native Linking mock 문제 회피.
 */

import { Linking } from 'react-native';

export const openURL = (url: string) => Linking.openURL(url);
