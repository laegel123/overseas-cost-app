/**
 * Onboarding 화면 테스트 — persona-removal step 5 (ADR-067).
 *
 * 도시 선택 온보딩: 도시 리스트 렌더(seoul 제외) + 권역 필터 + 도시 탭 시
 * add(cityId) + setOnboarded(true) + router.replace('/compare/{id}') + 연타 가드.
 */

import * as React from 'react';

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import {
  fetchExchangeRates as mockFetchExchangeRates,
  getAllCities as mockGetAllCities,
  loadAllCities as mockLoadAllCities,
} from '@/lib';

import { seoulValid } from '../../src/__fixtures__/cities/seoul-valid';
import { vancouverValid } from '../../src/__fixtures__/cities/vancouver-valid';
import OnboardingScreen from '../onboarding';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockAdd = jest.fn();
const mockSetOnboarded = jest.fn();
jest.mock('@/store', () => ({
  useFavoritesStore: (selector: (s: { add: jest.Mock }) => unknown) => selector({ add: mockAdd }),
  useOnboardingStore: (selector: (s: { setOnboarded: jest.Mock }) => unknown) =>
    selector({ setOnboarded: mockSetOnboarded }),
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

const flushPromises = () => new Promise((r) => setImmediate(r));

// 타이머 역전 패턴 — jest.setup.js 가 fakeTimers 를 전역 기본값으로 설정.
// 비동기 load() 가 setImmediate flush 에 의존하므로 본 파일에서만 realTimers 사용.
describe('OnboardingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useFakeTimers();
  });

  // ─── 로딩 상태 ────────────────────────────────────────────────────────────

  describe('로딩 상태', () => {
    it('로딩 중 스피너 표시', () => {
      (mockLoadAllCities as jest.Mock).mockReturnValue(new Promise(() => {}));
      (mockFetchExchangeRates as jest.Mock).mockReturnValue(new Promise(() => {}));

      const { getByTestId } = render(<OnboardingScreen />);

      expect(getByTestId('onboarding-screen-loading')).toBeTruthy();
    });
  });

  // ─── UI 표시 ────────────────────────────────────────────────────────────

  describe('데이터 로드 완료', () => {
    it('hero 인사말 + 설명 표시', async () => {
      setupMocks();

      const { getByTestId, getByText } = render(<OnboardingScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(getByTestId('onboarding-screen')).toBeTruthy();
      expect(getByText('안녕하세요')).toBeTruthy();
      expect(getByText('어디로 떠나시나요?')).toBeTruthy();
      expect(getByText('서울 기준으로 해외 도시 생활비를 비교해 드려요.')).toBeTruthy();
      expect(getByText('도시를 골라보세요')).toBeTruthy();
    });

    it('도시 리스트 렌더 (서울 제외)', async () => {
      setupMocks();

      const { getByTestId, queryByTestId } = render(<OnboardingScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(getByTestId('onboarding-city-list')).toBeTruthy();
      expect(getByTestId('onboarding-city-tokyo')).toBeTruthy();
      expect(getByTestId('onboarding-city-london')).toBeTruthy();
      expect(getByTestId('onboarding-city-vancouver')).toBeTruthy();
      expect(getByTestId('onboarding-city-sydney')).toBeTruthy();
      expect(queryByTestId('onboarding-city-seoul')).toBeNull();
    });
  });

  // ─── 권역 필터 ────────────────────────────────────────────────────────────

  describe('권역 필터', () => {
    it('RegionPill 6개 렌더 + 기본 active = 전체', async () => {
      setupMocks();

      const { getByTestId } = render(<OnboardingScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(getByTestId('onboarding-region-pills')).toBeTruthy();
      expect(getByTestId('onboarding-region-all')).toBeTruthy();
      expect(getByTestId('onboarding-region-na')).toBeTruthy();
      expect(getByTestId('onboarding-region-eu')).toBeTruthy();
      expect(getByTestId('onboarding-region-asia')).toBeTruthy();
      expect(getByTestId('onboarding-region-oceania')).toBeTruthy();
      expect(getByTestId('onboarding-region-me')).toBeTruthy();
      expect(getByTestId('onboarding-region-all').props.accessibilityState.selected).toBe(true);
    });

    it('권역 선택 시 해당 권역 도시만 노출', async () => {
      setupMocks();

      const { getByTestId, queryByTestId } = render(<OnboardingScreen />);

      await act(async () => {
        await flushPromises();
      });

      fireEvent.press(getByTestId('onboarding-region-eu'));

      await waitFor(() => {
        expect(getByTestId('onboarding-region-eu').props.accessibilityState.selected).toBe(true);
        expect(getByTestId('onboarding-city-london')).toBeTruthy();
        expect(queryByTestId('onboarding-city-tokyo')).toBeNull();
        expect(queryByTestId('onboarding-city-vancouver')).toBeNull();
        expect(queryByTestId('onboarding-city-sydney')).toBeNull();
      });
    });
  });

  // ─── 도시 선택 흐름 ──────────────────────────────────────────────────────

  describe('도시 선택', () => {
    it('도시 탭 → add(cityId) + setOnboarded(true) + router.replace("/compare/{id}")', async () => {
      setupMocks();

      const { getByTestId } = render(<OnboardingScreen />);

      await act(async () => {
        await flushPromises();
      });

      fireEvent.press(getByTestId('onboarding-city-tokyo'));

      expect(mockAdd).toHaveBeenCalledWith('tokyo');
      expect(mockSetOnboarded).toHaveBeenCalledWith(true);
      expect(mockReplace).toHaveBeenCalledWith('/compare/tokyo');
    });

    it('선택 순서 보장 — add → setOnboarded → replace', async () => {
      setupMocks();

      const order: string[] = [];
      mockAdd.mockImplementation(() => order.push('add'));
      mockSetOnboarded.mockImplementation(() => order.push('setOnboarded'));
      mockReplace.mockImplementation(() => order.push('replace'));

      const { getByTestId } = render(<OnboardingScreen />);

      await act(async () => {
        await flushPromises();
      });

      fireEvent.press(getByTestId('onboarding-city-vancouver'));

      expect(order).toEqual(['add', 'setOnboarded', 'replace']);
    });
  });

  // ─── 연타 방어 ────────────────────────────────────────────────────────

  describe('연타 방어', () => {
    it('같은 도시 빠른 연타 → 첫 탭만 실행 (가드)', async () => {
      setupMocks();

      const { getByTestId } = render(<OnboardingScreen />);

      await act(async () => {
        await flushPromises();
      });

      const row = getByTestId('onboarding-city-vancouver');
      fireEvent.press(row);
      fireEvent.press(row);
      fireEvent.press(row);

      expect(mockAdd).toHaveBeenCalledTimes(1);
      expect(mockSetOnboarded).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledTimes(1);
    });

    it('서로 다른 도시 연타 → 첫 탭만 실행 (가드)', async () => {
      setupMocks();

      const { getByTestId } = render(<OnboardingScreen />);

      await act(async () => {
        await flushPromises();
      });

      fireEvent.press(getByTestId('onboarding-city-vancouver'));
      fireEvent.press(getByTestId('onboarding-city-tokyo'));

      expect(mockAdd).toHaveBeenCalledTimes(1);
      expect(mockAdd).toHaveBeenCalledWith('vancouver');
    });
  });

  // ─── 에러 상태 ────────────────────────────────────────────────────────

  describe('에러 상태', () => {
    it('서울 데이터 없음 — 에러 메시지 + 다시 시도', async () => {
      setupMocks({ cities: {} });

      const { getByTestId, getByText } = render(<OnboardingScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(getByTestId('onboarding-screen-error')).toBeTruthy();
      expect(getByText('서울 데이터를 찾을 수 없습니다')).toBeTruthy();
    });

    it('다시 시도 버튼 → loading 전환 후 재로드', async () => {
      let callCount = 0;
      (mockGetAllCities as jest.Mock).mockImplementation(() => {
        callCount += 1;
        return callCount === 1 ? {} : citiesMap;
      });
      (mockLoadAllCities as jest.Mock).mockResolvedValue(undefined);
      (mockFetchExchangeRates as jest.Mock).mockResolvedValue(defaultFx);

      const { getByTestId, queryByTestId } = render(<OnboardingScreen />);

      await act(async () => {
        await flushPromises();
      });

      expect(getByTestId('onboarding-screen-error')).toBeTruthy();
      fireEvent.press(getByTestId('onboarding-retry-btn'));

      await act(async () => {
        await flushPromises();
      });

      expect(queryByTestId('onboarding-screen-error')).toBeNull();
      expect(getByTestId('onboarding-screen')).toBeTruthy();
    });
  });
});
