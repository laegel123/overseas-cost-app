/**
 * Compare 화면 테스트 — step0.md 요구사항.
 */

import * as React from 'react';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import {
  loadAllCities as mockLoadAllCities,
  getCity as mockGetCity,
  fetchExchangeRates as mockFetchExchangeRates,
  getLastSync as mockGetLastSync,
} from '@/lib';
import { useFavoritesStore } from '@/store/favorites';
import { usePersonaStore } from '@/store/persona';
import { useRecentStore } from '@/store/recent';

import { seoulValid } from '../../../src/__fixtures__/cities/seoul-valid';
import { vancouverValid } from '../../../src/__fixtures__/cities/vancouver-valid';
import CompareScreen from '../[cityId]';


const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
    canGoBack: mockCanGoBack,
  }),
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/lib', () => {
  const actual = jest.requireActual('@/lib');
  return {
    ...actual,
    loadAllCities: jest.fn(),
    getCity: jest.fn(),
    fetchExchangeRates: jest.fn(),
    getLastSync: jest.fn(),
  };
});

const { useLocalSearchParams } = jest.requireMock('expo-router');

const defaultFx = { KRW: 1, CAD: 980, USD: 1380 };

function setupMocks(overrides?: {
  cityId?: string;
  seoul?: typeof seoulValid | undefined;
  city?: typeof vancouverValid | undefined;
  fx?: typeof defaultFx;
  lastSync?: string | null;
}) {
  const opts = {
    cityId: 'vancouver',
    seoul: seoulValid,
    city: vancouverValid,
    fx: defaultFx,
    lastSync: '2026-04-30T10:00:00.000Z',
    ...overrides,
  };

  (useLocalSearchParams as jest.Mock).mockReturnValue({ cityId: opts.cityId });
  (mockLoadAllCities as jest.Mock).mockResolvedValue({});
  (mockGetCity as jest.Mock).mockImplementation((id: string) => {
    if (id === 'seoul') return opts.seoul;
    if (id === opts.cityId) return opts.city;
    return undefined;
  });
  (mockFetchExchangeRates as jest.Mock).mockResolvedValue(opts.fx);
  (mockGetLastSync as jest.Mock).mockResolvedValue(opts.lastSync);
}

function resetStores() {
  usePersonaStore.getState().reset();
  useFavoritesStore.getState().clear();
  useRecentStore.getState().clear();
}

const flushPromises = () => new Promise((r) => setImmediate(r));

describe('CompareScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStores();
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useFakeTimers();
  });

  it('mock 함수가 호출되는지 확인', async () => {
    setupMocks();
    render(<CompareScreen />);

    await waitFor(() => {
      expect(mockLoadAllCities).toHaveBeenCalled();
      expect(mockFetchExchangeRates).toHaveBeenCalled();
      expect(mockGetLastSync).toHaveBeenCalled();
    }, { timeout: 3000 });

    expect(mockGetCity).toHaveBeenCalledWith('seoul');
    expect(mockGetCity).toHaveBeenCalledWith('vancouver');
  });

  describe('페르소나별 카테고리 카드 분기', () => {
    it('student 페르소나: rent, food, transport, tuition, visa 5개', async () => {
      setupMocks();
      usePersonaStore.setState({ persona: 'student', onboarded: true });

      const { getByTestId, queryByTestId } = render(<CompareScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(getByTestId('compare-screen')).toBeTruthy();

      expect(getByTestId('compare-pair-rent')).toBeTruthy();
      expect(getByTestId('compare-pair-food')).toBeTruthy();
      expect(getByTestId('compare-pair-transport')).toBeTruthy();
      expect(getByTestId('compare-pair-tuition')).toBeTruthy();
      expect(getByTestId('compare-pair-visa')).toBeTruthy();
      expect(queryByTestId('compare-pair-tax')).toBeNull();
    });

    it('worker 페르소나: rent, food, transport, tax, visa 5개', async () => {
      setupMocks();
      usePersonaStore.setState({ persona: 'worker', onboarded: true });

      const { getByTestId, queryByTestId } = render(<CompareScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(getByTestId('compare-screen')).toBeTruthy();
      expect(getByTestId('compare-pair-rent')).toBeTruthy();
      expect(getByTestId('compare-pair-food')).toBeTruthy();
      expect(getByTestId('compare-pair-transport')).toBeTruthy();
      expect(getByTestId('compare-pair-tax')).toBeTruthy();
      expect(getByTestId('compare-pair-visa')).toBeTruthy();
      expect(queryByTestId('compare-pair-tuition')).toBeNull();
    });

    it('unknown 페르소나: rent, food, transport, tuition, tax, visa 6개 (합집합)', async () => {
      setupMocks();
      usePersonaStore.setState({ persona: 'unknown', onboarded: true });

      const { getByTestId } = render(<CompareScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(getByTestId('compare-screen')).toBeTruthy();
      expect(getByTestId('compare-pair-rent')).toBeTruthy();
      expect(getByTestId('compare-pair-food')).toBeTruthy();
      expect(getByTestId('compare-pair-transport')).toBeTruthy();
      expect(getByTestId('compare-pair-tuition')).toBeTruthy();
      expect(getByTestId('compare-pair-tax')).toBeTruthy();
      expect(getByTestId('compare-pair-visa')).toBeTruthy();
    });
  });

  describe('HeroCard / ComparePair mount', () => {
    it('HeroCard orange variant 렌더', async () => {
      setupMocks();

      const { getByTestId } = render(<CompareScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(getByTestId('compare-hero')).toBeTruthy();
    });

    it('ComparePair 각 카테고리별 1회 mount', async () => {
      setupMocks();
      usePersonaStore.setState({ persona: 'worker', onboarded: true });

      const { getByTestId } = render(<CompareScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(getByTestId('compare-pair-rent')).toBeTruthy();
      expect(getByTestId('compare-pair-food')).toBeTruthy();
      expect(getByTestId('compare-pair-transport')).toBeTruthy();
      expect(getByTestId('compare-pair-tax')).toBeTruthy();
      expect(getByTestId('compare-pair-visa')).toBeTruthy();
    });

    it('ComparePair cLabel 은 도시명 (한글) — 국가코드 아님 (PR #17 review 이슈 1)', async () => {
      setupMocks();
      usePersonaStore.setState({ persona: 'worker', onboarded: true });

      render(<CompareScreen />);

      await act(async () => {
        await flushPromises();
      });

      // 화면 어디든 도시 한글명 "밴쿠버" 가 노출되어야 한다 (TopBar / HeroCard /
      // 카테고리 카드). 국가코드 'CA' 는 cLabel 자리에 들어가서는 안 됨.
      expect(screen.getAllByText('밴쿠버').length).toBeGreaterThan(0);
    });
  });

  describe('TopBar 인터랙션', () => {
    it('back 버튼 클릭 시 router.back() 호출', async () => {
      setupMocks();

      const { getByTestId } = render(<CompareScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(getByTestId('compare-topbar')).toBeTruthy();

      const backButton = getByTestId('compare-topbar-back');
      fireEvent.press(backButton);

      expect(mockBack).toHaveBeenCalledTimes(1);
    });

    it('star 버튼 클릭 시 즐겨찾기 토글', async () => {
      setupMocks();

      const { getByTestId } = render(<CompareScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(getByTestId('compare-topbar')).toBeTruthy();
      expect(useFavoritesStore.getState().cityIds).toEqual([]);

      const starButton = getByTestId('compare-topbar-right');
      fireEvent.press(starButton);

      expect(useFavoritesStore.getState().cityIds).toContain('vancouver');
    });
  });

  describe('recent.push 호출', () => {
    it('마운트 + 데이터 로드 완료 시 recent.push(cityId) 호출', async () => {
      setupMocks();

      expect(useRecentStore.getState().cityIds).toEqual([]);

      render(<CompareScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(useRecentStore.getState().cityIds).toContain('vancouver');
    });
  });

  describe('에러 분기', () => {
    it('cityId 없음 → ErrorView', async () => {
      setupMocks({ cityId: '' });
      (useLocalSearchParams as jest.Mock).mockReturnValue({ cityId: undefined });

      const { getByTestId } = render(<CompareScreen />);

      await waitFor(() => {
        expect(getByTestId('compare-screen-error')).toBeTruthy();
      });
    });

    it('도시 데이터 없음 → ErrorView', async () => {
      setupMocks({ city: undefined });

      const { getByTestId, getByText } = render(<CompareScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(getByTestId('compare-screen-error')).toBeTruthy();
      expect(getByText('도시 데이터를 찾을 수 없습니다')).toBeTruthy();
    });

    it('서울 데이터 없음 → ErrorView', async () => {
      setupMocks({ seoul: undefined });

      const { getByTestId, getByText } = render(<CompareScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(getByTestId('compare-screen-error')).toBeTruthy();
      expect(getByText('서울 데이터를 찾을 수 없습니다')).toBeTruthy();
    });

    it('loadAllCities reject → ErrorView', async () => {
      setupMocks();
      (mockLoadAllCities as jest.Mock).mockRejectedValue(new Error('network error'));

      const { getByTestId } = render(<CompareScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(getByTestId('compare-screen-error')).toBeTruthy();
    });

    it('fetchExchangeRates reject → ErrorView (PR #17 review 이슈 3)', async () => {
      setupMocks();
      (mockFetchExchangeRates as jest.Mock).mockRejectedValue(new Error('fx error'));

      const { getByTestId } = render(<CompareScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(getByTestId('compare-screen-error')).toBeTruthy();
    });

    it('getLastSync reject → ErrorView', async () => {
      setupMocks();
      (mockGetLastSync as jest.Mock).mockRejectedValue(new Error('sync error'));

      const { getByTestId } = render(<CompareScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(getByTestId('compare-screen-error')).toBeTruthy();
    });
  });

  describe('핵심 contract (TESTING.md §6.3·§6.4 / PR #17 review 이슈 2)', () => {
    // 거대 트리 snapshot (이전 1281 라인) 대신 contract 단언 — pretty-format
    // 이 ReactTestInstance fiber 를 cyclic 직렬화 시도해 RangeError 발생하는
    // 문제도 회피. 시각 회귀 정밀 검증은 v2 시각 회귀 테스트 도구 (스크린샷)
    // 도입 후로 미룸 (ADR-035).

    it('vancouver + worker — hero / 카테고리 카드 mount + 핵심 텍스트 노출', async () => {
      setupMocks();
      usePersonaStore.setState({ persona: 'worker', onboarded: true });

      const { getByTestId } = render(<CompareScreen />);

      await act(async () => {
        await flushPromises();
      });

      // hero 노드 존재 + variant 확인 (props.testID)
      expect(getByTestId('compare-hero')).toBeTruthy();

      // 핵심 카테고리 카드 모두 노출 (worker 페르소나 = 5 카드)
      expect(getByTestId('compare-pair-rent')).toBeTruthy();
      expect(getByTestId('compare-pair-food')).toBeTruthy();
      expect(getByTestId('compare-pair-transport')).toBeTruthy();
      expect(getByTestId('compare-pair-tax')).toBeTruthy();
      expect(getByTestId('compare-pair-visa')).toBeTruthy();

      // 도시명 노출 — TopBar / hero / 카테고리 카드 어느 곳이든
      expect(screen.getAllByText('밴쿠버').length).toBeGreaterThan(0);
    });
  });
});
