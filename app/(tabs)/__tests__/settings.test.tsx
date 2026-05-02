/**
 * Settings 화면 테스트 — step3.md 요구사항.
 *
 * - 페르소나 3 분기 라벨 / sub
 * - 통계 카드 0건 / N건
 * - 메뉴 5개 모두 mount + 라벨 일치
 * - 데이터 새로고침 탭 → refreshCache 호출
 * - 변경 버튼 → setOnboarded(false) + router.replace('/onboarding')
 * - snapshot 1 케이스 (worker 페르소나 + 통계 비어있음)
 */

import * as React from 'react';

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { jsonByTestId } from '@/__test-utils__/snapshotByTestId';
import {
  getAllCities as mockGetAllCities,
  refreshCache as mockRefreshCache,
} from '@/lib';
import { openURL as mockOpenURL } from '@/lib/linking';
import { useFavoritesStore } from '@/store/favorites';
import { usePersonaStore } from '@/store/persona';
import { useRecentStore } from '@/store/recent';
import { useSettingsStore } from '@/store/settings';

import SettingsScreen from '../settings';

jest.mock('@/lib/linking', () => ({
  openURL: jest.fn(() => Promise.resolve(true)),
}));

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      version: '1.0.0',
    },
  },
}));

jest.mock('@/lib', () => {
  const actual = jest.requireActual('@/lib');
  return {
    ...actual,
    getAllCities: jest.fn(),
    refreshCache: jest.fn(),
  };
});

const cityMapWith20 = Object.fromEntries(
  Array.from({ length: 20 }, (_, i) => [
    `city${i}`,
    { id: `city${i}`, name: { ko: `도시${i}`, en: `City${i}` } },
  ]),
);

function setupMocks(opts?: { cities?: Record<string, unknown> }) {
  const cities = opts?.cities ?? cityMapWith20;
  (mockGetAllCities as jest.Mock).mockReturnValue(cities);
  (mockRefreshCache as jest.Mock).mockResolvedValue({
    ok: true,
    lastSync: new Date().toISOString(),
  });
}

function resetStores() {
  usePersonaStore.setState({ persona: 'unknown', onboarded: true });
  useFavoritesStore.setState({ cityIds: [] });
  useRecentStore.setState({ cityIds: [] });
  useSettingsStore.setState({ lastSync: null });
}

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStores();
  });

  describe('페르소나 표시', () => {
    it('student — 유학생 모드', () => {
      setupMocks();
      usePersonaStore.setState({ persona: 'student' });

      const { getByTestId } = render(<SettingsScreen />);

      expect(getByTestId('persona-label').props.children).toContain('유학생');
      expect(getByTestId('persona-sub').props.children).toContain('학비 중심');
    });

    it('worker — 취업자 모드', () => {
      setupMocks();
      usePersonaStore.setState({ persona: 'worker' });

      const { getByTestId } = render(<SettingsScreen />);

      expect(getByTestId('persona-label').props.children).toContain('취업자');
      expect(getByTestId('persona-sub').props.children).toContain('실수령 중심');
    });

    it('unknown — 아직 모름 모드', () => {
      setupMocks();
      usePersonaStore.setState({ persona: 'unknown' });

      const { getByTestId } = render(<SettingsScreen />);

      expect(getByTestId('persona-label').props.children).toContain('아직 모름');
      expect(getByTestId('persona-sub').props.children).toContain('둘 다');
    });
  });

  describe('변경 버튼', () => {
    it('탭 → setOnboarded(false) + router.replace(/onboarding)', () => {
      setupMocks();
      const setOnboarded = jest.fn();
      usePersonaStore.setState({ persona: 'student', setOnboarded });

      const { getByTestId } = render(<SettingsScreen />);
      const changeBtn = getByTestId('persona-change-btn');
      fireEvent.press(changeBtn);

      expect(setOnboarded).toHaveBeenCalledWith(false);
      expect(mockReplace).toHaveBeenCalledWith('/onboarding');
    });
  });

  describe('통계 카드', () => {
    it('0건 — 모두 0 표시', () => {
      setupMocks({ cities: {} });
      useFavoritesStore.setState({ cityIds: [] });
      useRecentStore.setState({ cityIds: [] });

      const { getByTestId } = render(<SettingsScreen />);

      expect(getByTestId('stat-favorites-value').props.children).toBe(0);
      expect(getByTestId('stat-recent-value').props.children).toBe(0);
      expect(getByTestId('stat-cities-value').props.children).toBe(0);
    });

    it('N건 — 정확한 카운트 표시', () => {
      setupMocks();
      useFavoritesStore.setState({ cityIds: ['a', 'b', 'c'] });
      useRecentStore.setState({ cityIds: ['x', 'y'] });

      const { getByTestId } = render(<SettingsScreen />);

      expect(getByTestId('stat-favorites-value').props.children).toBe(3);
      expect(getByTestId('stat-recent-value').props.children).toBe(2);
      expect(getByTestId('stat-cities-value').props.children).toBe(20);
    });
  });

  describe('메뉴 리스트', () => {
    it('5개 메뉴 모두 렌더링', () => {
      setupMocks();

      const { getByTestId, getByText } = render(<SettingsScreen />);

      expect(getByTestId('menu-refresh')).toBeTruthy();
      expect(getByTestId('menu-sources')).toBeTruthy();
      expect(getByTestId('menu-feedback')).toBeTruthy();
      expect(getByTestId('menu-privacy')).toBeTruthy();
      expect(getByTestId('menu-app-info')).toBeTruthy();

      expect(getByText('데이터 새로고침')).toBeTruthy();
      expect(getByText('데이터 출처 보기')).toBeTruthy();
      expect(getByText('피드백 보내기')).toBeTruthy();
      expect(getByText('개인정보 처리방침')).toBeTruthy();
      expect(getByText('앱 정보')).toBeTruthy();
    });

    it('앱 정보 rightText = v1.0.0', () => {
      setupMocks();

      const { getByText } = render(<SettingsScreen />);

      expect(getByText('v1.0.0')).toBeTruthy();
    });

    it('출처 rightText = 12개', () => {
      setupMocks();

      const { getByText } = render(<SettingsScreen />);

      expect(getByText('12개')).toBeTruthy();
    });
  });

  describe('데이터 새로고침', () => {
    it('탭 → refreshCache 호출', async () => {
      setupMocks();

      const { getByTestId } = render(<SettingsScreen />);
      const refreshRow = getByTestId('menu-refresh');
      fireEvent.press(refreshRow);

      await waitFor(() => {
        expect(mockRefreshCache).toHaveBeenCalled();
      });
    });

    it('성공 → lastSync 갱신', async () => {
      setupMocks();
      const updateLastSync = jest.fn();
      useSettingsStore.setState({ lastSync: null, updateLastSync });

      const { getByTestId } = render(<SettingsScreen />);
      const refreshRow = getByTestId('menu-refresh');

      await act(async () => {
        fireEvent.press(refreshRow);
      });

      await waitFor(() => {
        expect(updateLastSync).toHaveBeenCalled();
      });
    });

    it('로딩 중 — "갱신 중..." 텍스트 + 버튼 disabled', async () => {
      let resolveRefresh: ((v: { ok: boolean; lastSync: string }) => void) | undefined;
      (mockRefreshCache as jest.Mock).mockReturnValue(
        new Promise<{ ok: boolean; lastSync: string }>((resolve) => {
          resolveRefresh = resolve;
        }),
      );

      const { getByTestId, getByText } = render(<SettingsScreen />);
      const refreshRow = getByTestId('menu-refresh');

      await act(async () => {
        fireEvent.press(refreshRow);
      });

      expect(getByText('갱신 중...')).toBeTruthy();
      expect(refreshRow.props.accessibilityState).toMatchObject({ disabled: true });

      await act(async () => {
        resolveRefresh?.({ ok: true, lastSync: new Date().toISOString() });
      });
    });

    it('실패 → 갱신 실패 텍스트', async () => {
      (mockRefreshCache as jest.Mock).mockResolvedValue({
        ok: false,
        reason: 'network',
      });

      const { getByTestId, getByText } = render(<SettingsScreen />);
      const refreshRow = getByTestId('menu-refresh');

      await act(async () => {
        fireEvent.press(refreshRow);
      });

      await waitFor(() => {
        expect(getByText('갱신 실패')).toBeTruthy();
      });
    });
  });

  describe('외부 링크', () => {
    it('피드백 보내기 → mailto 링크', () => {
      setupMocks();

      const { getByTestId } = render(<SettingsScreen />);
      fireEvent.press(getByTestId('menu-feedback'));

      expect(mockOpenURL).toHaveBeenCalledWith(
        expect.stringContaining('mailto:laegel1@gmail.com'),
      );
    });

    it('데이터 출처 보기 → GitHub URL', () => {
      setupMocks();

      const { getByTestId } = render(<SettingsScreen />);
      fireEvent.press(getByTestId('menu-sources'));

      expect(mockOpenURL).toHaveBeenCalledWith(
        expect.stringContaining('DATA_SOURCES.md'),
      );
    });

    it('개인정보 처리방침 → GitHub URL', () => {
      setupMocks();

      const { getByTestId } = render(<SettingsScreen />);
      fireEvent.press(getByTestId('menu-privacy'));

      expect(mockOpenURL).toHaveBeenCalledWith(
        expect.stringContaining('PRIVACY.md'),
      );
    });
  });

  describe('Footer', () => {
    it('Made with ♥ 표시', () => {
      setupMocks();

      const { getByTestId } = render(<SettingsScreen />);

      expect(getByTestId('footer-text').props.children).toContain('Made with');
    });
  });

  describe('스냅샷', () => {
    // TESTING.md §6.6 — 100라인 정책. 화면 전체 대신 페르소나 카드 영역만.
    it('persona-card (worker) — 회귀 감지', () => {
      setupMocks({ cities: {} });
      usePersonaStore.setState({ persona: 'worker', onboarded: true });
      useFavoritesStore.setState({ cityIds: [] });
      useRecentStore.setState({ cityIds: [] });
      useSettingsStore.setState({ lastSync: null });

      const tree = render(<SettingsScreen />);

      expect(jsonByTestId(tree.toJSON(), 'persona-card')).toMatchSnapshot();
    });
  });
});
