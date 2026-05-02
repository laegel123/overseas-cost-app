/**
 * linking.ts — Linking wrapper. TESTING.md §9.32.
 *
 * react-native Linking 직접 호출 회피용 thin wrapper. 본 테스트는 react-native
 * 모듈 자체를 mock 해 wrapper 가 Linking.openURL 로 정확히 위임하는지 검증.
 */

import { Linking } from 'react-native';

import { openURL } from '@/lib/linking';

jest.mock('react-native', () => ({
  Linking: {
    openURL: jest.fn(() => Promise.resolve(true)),
  },
}));

const mockOpenURL = Linking.openURL as jest.Mock;

describe('openURL', () => {
  beforeEach(() => {
    mockOpenURL.mockClear();
  });

  it('Linking.openURL 로 위임', async () => {
    await openURL('https://example.com');
    expect(mockOpenURL).toHaveBeenCalledWith('https://example.com');
  });

  it('mailto: scheme 도 그대로 전달', async () => {
    await openURL('mailto:test@example.com?subject=hi');
    expect(mockOpenURL).toHaveBeenCalledWith('mailto:test@example.com?subject=hi');
  });
});
