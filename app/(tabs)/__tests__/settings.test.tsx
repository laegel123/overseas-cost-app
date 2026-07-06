/**
 * Settings 화면 테스트 — 데이터 최신화 카드 (ADR-067 페르소나 제거).
 *
 * - 데이터 최신화 카드: 렌더 + 새로고침 버튼 탭 → refreshCache 호출
 * - 통계 카드 0건 / N건
 * - 메뉴 4개 모두 mount + 라벨 일치 (menu-refresh 는 카드로 승격되어 제거)
 * - formatLastSync (loading / error / null / 날짜) 카드에 표시
 * - snapshot 1 케이스 (data-refresh-card + 통계 비어있음)
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
import { useRecentStore } from '@/store/recent';
import { useSettingsStore } from '@/store/settings';

import SettingsScreen from '../settings';

jest.mock('@/lib/linking', () => ({
  openURL: jest.fn(() => Promise.resolve(true)),
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
  useFavoritesStore.setState({ cityIds: [] });
  useRecentStore.setState({ cityIds: [] });
  useSettingsStore.setState({ lastSync: null });
}

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStores();
  });

  describe('데이터 최신화 카드', () => {
    it('카드 + 새로고침 버튼 렌더', () => {
      setupMocks();

      const { getByTestId, getByText } = render(<SettingsScreen />);

      expect(getByTestId('data-refresh-card')).toBeTruthy();
      expect(getByTestId('data-refresh-btn')).toBeTruthy();
      expect(getByText('데이터 최신화')).toBeTruthy();
    });

    it('새로고침 버튼 탭 → refreshCache 호출', async () => {
      setupMocks();

      const { getByTestId } = render(<SettingsScreen />);
      fireEvent.press(getByTestId('data-refresh-btn'));

      await waitFor(() => {
        expect(mockRefreshCache).toHaveBeenCalled();
      });
    });

    it('null lastSync — "동기화 전" 표시', () => {
      setupMocks();
      useSettingsStore.setState({ lastSync: null });

      const { getByTestId } = render(<SettingsScreen />);

      expect(getByTestId('data-refresh-last-sync').props.children).toBe('동기화 전');
    });

    it('날짜 lastSync — formatShortDate 표시', () => {
      setupMocks();
      useSettingsStore.setState({ lastSync: '2026-04-27T00:00:00Z' });

      const { getByTestId } = render(<SettingsScreen />);

      expect(getByTestId('data-refresh-last-sync').props.children).toBe('04-27');
    });

    it('로딩 중 — "갱신 중..." 텍스트 + 버튼 disabled', async () => {
      let resolveRefresh: ((v: { ok: boolean; lastSync: string }) => void) | undefined;
      (mockRefreshCache as jest.Mock).mockReturnValue(
        new Promise<{ ok: boolean; lastSync: string }>((resolve) => {
          resolveRefresh = resolve;
        }),
      );

      const { getByTestId, getByText } = render(<SettingsScreen />);
      const refreshBtn = getByTestId('data-refresh-btn');

      await act(async () => {
        fireEvent.press(refreshBtn);
      });

      expect(getByText('갱신 중...')).toBeTruthy();
      expect(refreshBtn.props.accessibilityState).toMatchObject({ disabled: true });

      await act(async () => {
        resolveRefresh?.({ ok: true, lastSync: new Date().toISOString() });
      });
    });

    it('성공 → lastSync 갱신', async () => {
      setupMocks();
      const updateLastSync = jest.fn();
      useSettingsStore.setState({ lastSync: null, updateLastSync });

      const { getByTestId } = render(<SettingsScreen />);

      await act(async () => {
        fireEvent.press(getByTestId('data-refresh-btn'));
      });

      await waitFor(() => {
        expect(updateLastSync).toHaveBeenCalled();
      });
    });

    it('실패 → "갱신 실패" 텍스트', async () => {
      (mockRefreshCache as jest.Mock).mockResolvedValue({
        ok: false,
        reason: 'network',
      });

      const { getByTestId, getByText } = render(<SettingsScreen />);

      await act(async () => {
        fireEvent.press(getByTestId('data-refresh-btn'));
      });

      await waitFor(() => {
        expect(getByText('갱신 실패')).toBeTruthy();
      });
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
    it('4개 메뉴 모두 렌더링 (menu-refresh 는 카드로 승격되어 제거)', () => {
      setupMocks();

      const { getByTestId, getByText, queryByTestId } = render(<SettingsScreen />);

      expect(queryByTestId('menu-refresh')).toBeNull();
      expect(getByTestId('menu-sources')).toBeTruthy();
      expect(getByTestId('menu-feedback')).toBeTruthy();
      expect(getByTestId('menu-privacy')).toBeTruthy();
      expect(getByTestId('menu-app-info')).toBeTruthy();

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

    it('개인정보 처리방침 → 출시 정본 Pages URL', () => {
      setupMocks();

      const { getByTestId } = render(<SettingsScreen />);
      fireEvent.press(getByTestId('menu-privacy'));

      expect(mockOpenURL).toHaveBeenCalledWith(
        expect.stringContaining('privacy-policy.html'),
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
    // TESTING.md §6.6 — 100라인 정책. 화면 전체 대신 데이터 최신화 카드 영역만.
    it('data-refresh-card — 회귀 감지', () => {
      setupMocks({ cities: {} });
      useFavoritesStore.setState({ cityIds: [] });
      useRecentStore.setState({ cityIds: [] });
      useSettingsStore.setState({ lastSync: null });

      const tree = render(<SettingsScreen />);

      expect(jsonByTestId(tree.toJSON(), 'data-refresh-card')).toMatchSnapshot();
    });
  });
});
