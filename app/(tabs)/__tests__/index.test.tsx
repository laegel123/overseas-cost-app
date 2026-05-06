/**
 * Home 화면 테스트 — step2.md 요구사항.
 */

import * as React from 'react';

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { jsonByTestId } from '@/__test-utils__/snapshotByTestId';
import {
  fetchExchangeRates as mockFetchExchangeRates,
  getAllCities as mockGetAllCities,
  loadAllCities as mockLoadAllCities,
} from '@/lib';
import { useFavoritesStore } from '@/store/favorites';
import { useRecentStore } from '@/store/recent';

import { seoulValid } from '../../../src/__fixtures__/cities/seoul-valid';
import { vancouverValid } from '../../../src/__fixtures__/cities/vancouver-valid';
import HomeScreen from '../index';

const mockPush = jest.fn();
const mockNavigate = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    navigate: mockNavigate,
  }),
}));

jest.mock('@/lib', () => {
  const actual = jest.requireActual('@/lib');
  return {
    ...actual,
    loadAllCities: jest.fn(),
    getAllCities: jest.fn(),
    fetchExchangeRates: jest.fn(),
  };
});

const tokyoValid = {
  ...vancouverValid,
  id: 'tokyo',
  name: { ko: '도쿄', en: 'Tokyo' },
  country: 'JP',
  currency: 'JPY',
  region: 'asia' as const,
};

const londonValid = {
  ...vancouverValid,
  id: 'london',
  name: { ko: '런던', en: 'London' },
  country: 'GB',
  currency: 'GBP',
  region: 'eu' as const,
};

const sydneyValid = {
  ...vancouverValid,
  id: 'sydney',
  name: { ko: '시드니', en: 'Sydney' },
  country: 'AU',
  currency: 'AUD',
  region: 'oceania' as const,
};

const defaultFx = { KRW: 1, CAD: 980, USD: 1380, JPY: 9, GBP: 1750, AUD: 900 };

const citiesMap = {
  seoul: seoulValid,
  vancouver: vancouverValid,
  tokyo: tokyoValid,
  london: londonValid,
  sydney: sydneyValid,
};

function setupMocks(overrides?: {
  cities?: typeof citiesMap | Record<string, never>;
  fx?: typeof defaultFx;
}) {
  const opts = {
    cities: citiesMap,
    fx: defaultFx,
    ...overrides,
  };

  (mockLoadAllCities as jest.Mock).mockResolvedValue(opts.cities);
  (mockGetAllCities as jest.Mock).mockReturnValue(opts.cities);
  (mockFetchExchangeRates as jest.Mock).mockResolvedValue(opts.fx);
}

function resetStores() {
  useFavoritesStore.getState().clear();
  useRecentStore.getState().clear();
}

const flushPromises = () => new Promise((r) => setImmediate(r));

// 타이머 역전 패턴 — jest.setup.js 가 fakeTimers 를 전역 기본값으로 설정.
// 비동기 load() 가 setImmediate flush 에 의존하므로 본 파일에서만 realTimers 사용.
// afterEach 에서 전역 default(fakeTimers) 로 복원해 다른 파일 누출 방지.
describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStores();
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useFakeTimers();
  });

  describe('로딩 상태', () => {
    it('로딩 중 스피너 표시', () => {
      (mockLoadAllCities as jest.Mock).mockReturnValue(new Promise(() => {}));
      (mockFetchExchangeRates as jest.Mock).mockReturnValue(new Promise(() => {}));

      const { getByTestId } = render(<HomeScreen />);

      expect(getByTestId('home-screen-loading')).toBeTruthy();
    });
  });

  describe('데이터 로드 완료', () => {
    it('기본 UI 요소 렌더링', async () => {
      setupMocks();

      const { getByTestId, getByText } = render(<HomeScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(getByTestId('home-screen')).toBeTruthy();
      expect(getByText('안녕하세요 👋')).toBeTruthy();
      expect(getByText('어디 가시나요?')).toBeTruthy();
      expect(getByTestId('home-search-stub')).toBeTruthy();
      expect(getByTestId('home-avatar')).toBeTruthy();
    });
  });

  describe('즐겨찾기 섹션', () => {
    it('즐겨찾기 0건 — 빈 상태 메시지', async () => {
      setupMocks();

      const { getByTestId, getByText } = render(<HomeScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(getByTestId('home-favorites-empty')).toBeTruthy();
      expect(getByText(/아직 즐겨찾기가 없어요/)).toBeTruthy();
    });

    it('즐겨찾기 N건 — FavCard 렌더링', async () => {
      setupMocks();
      useFavoritesStore.setState({ cityIds: ['vancouver', 'tokyo'] });

      const { getByTestId, queryByTestId } = render(<HomeScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(queryByTestId('home-favorites-empty')).toBeNull();
      expect(getByTestId('home-favorites-scroll')).toBeTruthy();
      expect(getByTestId('home-favcard-vancouver')).toBeTruthy();
      expect(getByTestId('home-favcard-tokyo')).toBeTruthy();
    });

    it('첫 카드 accent=true (navy bg)', async () => {
      setupMocks();
      useFavoritesStore.setState({ cityIds: ['vancouver', 'tokyo'] });

      const { getByTestId } = render(<HomeScreen />);

      await act(async () => {
        await flushPromises();
      });

      const firstCard = getByTestId('home-favcard-vancouver');
      const secondCard = getByTestId('home-favcard-tokyo');

      expect(firstCard.props.className).toMatch(/bg-navy/);
      expect(secondCard.props.className).not.toMatch(/bg-navy/);
    });

    it('FavCard 탭 → /compare/{cityId} push', async () => {
      setupMocks();
      useFavoritesStore.setState({ cityIds: ['vancouver'] });

      const { getByTestId } = render(<HomeScreen />);

      await act(async () => {
        await flushPromises();
      });

      const card = getByTestId('home-favcard-vancouver');
      fireEvent.press(card);

      expect(mockPush).toHaveBeenCalledWith('/compare/vancouver');
    });
  });

  describe('최근 본 도시 섹션', () => {
    it('최근 0건 — 빈 상태 메시지', async () => {
      setupMocks();

      const { getByTestId, getByText } = render(<HomeScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(getByTestId('home-recent-empty')).toBeTruthy();
      expect(getByText('최근 본 도시가 없어요')).toBeTruthy();
    });

    it('최근 N건 — RecentRow 렌더링', async () => {
      setupMocks();
      useRecentStore.setState({ cityIds: ['vancouver', 'tokyo', 'london'] });

      const { getByTestId, queryByTestId } = render(<HomeScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(queryByTestId('home-recent-empty')).toBeNull();
      expect(getByTestId('home-recent-list')).toBeTruthy();
      expect(getByTestId('home-recentrow-vancouver')).toBeTruthy();
      expect(getByTestId('home-recentrow-tokyo')).toBeTruthy();
      expect(getByTestId('home-recentrow-london')).toBeTruthy();
    });

    it('마지막 RecentRow → border-b 미표시 (isLast=true)', async () => {
      setupMocks();
      useRecentStore.setState({ cityIds: ['vancouver', 'tokyo', 'london'] });

      const { getByTestId } = render(<HomeScreen />);

      await act(async () => {
        await flushPromises();
      });

      const lastRow = getByTestId('home-recentrow-london');
      const middleRow = getByTestId('home-recentrow-tokyo');

      // RecentRow 의 className 은 isLast=true 일 때 border-b 클래스 미포함.
      const lastClassName = String(lastRow.props.className ?? '');
      const middleClassName = String(middleRow.props.className ?? '');
      expect(lastClassName.includes('border-b')).toBe(false);
      expect(middleClassName.includes('border-b')).toBe(true);
    });

    it('RecentRow 탭 → /compare/{cityId} push', async () => {
      setupMocks();
      useRecentStore.setState({ cityIds: ['tokyo'] });

      const { getByTestId } = render(<HomeScreen />);

      await act(async () => {
        await flushPromises();
      });

      const row = getByTestId('home-recentrow-tokyo');
      fireEvent.press(row);

      expect(mockPush).toHaveBeenCalledWith('/compare/tokyo');
    });
  });

  describe('권역 필터', () => {
    it('RegionPill 6개 렌더링 (전체 + 5개 권역)', async () => {
      setupMocks();

      const { getByTestId } = render(<HomeScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(getByTestId('home-region-pills')).toBeTruthy();
      expect(getByTestId('home-region-all')).toBeTruthy();
      expect(getByTestId('home-region-na')).toBeTruthy();
      expect(getByTestId('home-region-eu')).toBeTruthy();
      expect(getByTestId('home-region-asia')).toBeTruthy();
      expect(getByTestId('home-region-oceania')).toBeTruthy();
      expect(getByTestId('home-region-me')).toBeTruthy();
    });

    it('기본 active = 전체', async () => {
      setupMocks();

      const { getByTestId } = render(<HomeScreen />);

      await act(async () => {
        await flushPromises();
      });

      const allPill = getByTestId('home-region-all');
      expect(allPill.props.accessibilityState.selected).toBe(true);
    });

    it('권역 탭 시 active 토글', async () => {
      setupMocks();

      const { getByTestId } = render(<HomeScreen />);

      await act(async () => {
        await flushPromises();
      });

      const naPill = getByTestId('home-region-na');
      fireEvent.press(naPill);

      await waitFor(() => {
        expect(getByTestId('home-region-na').props.accessibilityState.selected).toBe(true);
        expect(getByTestId('home-region-all').props.accessibilityState.selected).toBe(false);
      });
    });

    it('전체 선택 시 모든 해외 도시 노출 (서울 제외, 가나다 순)', async () => {
      setupMocks();

      const { getByTestId, queryByTestId } = render(<HomeScreen />);

      await act(async () => {
        await flushPromises();
      });

      // citiesMap: vancouver / tokyo / london / sydney + seoul
      // 가나다 순 (en 식별자로 testID 만 검증) — 도쿄 / 런던 / 밴쿠버 / 시드니
      expect(getByTestId('home-region-city-tokyo')).toBeTruthy();
      expect(getByTestId('home-region-city-london')).toBeTruthy();
      expect(getByTestId('home-region-city-vancouver')).toBeTruthy();
      expect(getByTestId('home-region-city-sydney')).toBeTruthy();
      expect(queryByTestId('home-region-city-seoul')).toBeNull();
    });

    it('권역 선택 시 해당 권역 도시만 노출', async () => {
      setupMocks();

      const { getByTestId, queryByTestId } = render(<HomeScreen />);

      await act(async () => {
        await flushPromises();
      });

      fireEvent.press(getByTestId('home-region-eu'));

      await waitFor(() => {
        expect(getByTestId('home-region-city-london')).toBeTruthy();
        expect(queryByTestId('home-region-city-tokyo')).toBeNull();
        expect(queryByTestId('home-region-city-vancouver')).toBeNull();
        expect(queryByTestId('home-region-city-sydney')).toBeNull();
      });
    });

    it('권역 도시 행 탭 → /compare/{cityId} push', async () => {
      setupMocks();

      const { getByTestId } = render(<HomeScreen />);

      await act(async () => {
        await flushPromises();
      });

      fireEvent.press(getByTestId('home-region-city-tokyo'));

      expect(mockPush).toHaveBeenCalledWith('/compare/tokyo');
    });
  });

  describe('아바타 설정 진입', () => {
    it('아바타 탭 → /settings navigate (push 아님 — 탭 stack 누적 회피)', async () => {
      setupMocks();

      const { getByTestId } = render(<HomeScreen />);

      await act(async () => {
        await flushPromises();
      });

      const avatar = getByTestId('home-avatar');
      fireEvent.press(avatar);

      expect(mockNavigate).toHaveBeenCalledWith('/settings');
      expect(mockPush).not.toHaveBeenCalledWith('/settings');
    });
  });

  describe('에러 상태', () => {
    it('서울 데이터 없음 — 에러 메시지', async () => {
      setupMocks({ cities: {} });

      const { getByTestId, getByText } = render(<HomeScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(getByTestId('home-screen-error')).toBeTruthy();
      expect(getByText('서울 데이터를 찾을 수 없습니다')).toBeTruthy();
    });

    it('다시 시도 버튼 → loading 상태로 전환 후 재로드', async () => {
      // 첫 호출: cities 없음 → 에러. 두 번째 호출: 정상.
      let callCount = 0;
      (mockGetAllCities as jest.Mock).mockImplementation(() => {
        callCount += 1;
        return callCount === 1 ? {} : citiesMap;
      });
      (mockLoadAllCities as jest.Mock).mockResolvedValue(undefined);
      (mockFetchExchangeRates as jest.Mock).mockResolvedValue(defaultFx);

      const { getByTestId, queryByTestId } = render(<HomeScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(getByTestId('home-screen-error')).toBeTruthy();
      const retry = getByTestId('home-retry-btn');
      fireEvent.press(retry);

      await act(async () => {
        await flushPromises();
      });

      expect(queryByTestId('home-screen-error')).toBeNull();
      expect(getByTestId('home-screen')).toBeTruthy();
    });
  });

  describe('스냅샷', () => {
    // TESTING.md §6.6 — 100라인 정책. 화면 전체 트리 대신 핵심 영역만 캡처.
    it('즐겨찾기 첫 카드 (accent navy) — 회귀 감지', async () => {
      setupMocks();
      useFavoritesStore.setState({ cityIds: ['vancouver', 'tokyo', 'london'] });

      const tree = render(<HomeScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(jsonByTestId(tree.toJSON(), 'home-favcard-vancouver')).toMatchSnapshot();
    });

    it('권역 pill 컨테이너 — 5개 pill 회귀 감지', async () => {
      setupMocks();

      const tree = render(<HomeScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(jsonByTestId(tree.toJSON(), 'home-region-pills')).toMatchSnapshot();
    });
  });
});
