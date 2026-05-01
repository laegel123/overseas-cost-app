/**
 * Detail 화면 테스트 — step1.md 요구사항.
 *
 * 카테고리별 섹션 / row 갯수 / ErrorView / snapshot 검증.
 * compare 테스트 패턴 재사용 (mock, fixture).
 */

import * as React from 'react';

import { act, render, screen } from '@testing-library/react-native';

import {
  fetchExchangeRates as mockFetchExchangeRates,
  getCity as mockGetCity,
  getLastSync as mockGetLastSync,
  loadAllCities as mockLoadAllCities,
} from '@/lib';

import { seoulValid } from '../../../src/__fixtures__/cities/seoul-valid';
import { vancouverValid } from '../../../src/__fixtures__/cities/vancouver-valid';
import DetailScreen from '../[cityId]/[category]';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);

jest.mock('expo-router', () => ({
  useRouter: () => ({
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
  category?: string;
  seoul?: typeof seoulValid | undefined;
  city?: typeof vancouverValid | undefined;
  fx?: typeof defaultFx;
  lastSync?: string | null;
}) {
  const opts = {
    cityId: 'vancouver',
    category: 'food',
    seoul: seoulValid,
    city: vancouverValid,
    fx: defaultFx,
    lastSync: '2026-04-30T10:00:00.000Z',
    ...overrides,
  };

  (useLocalSearchParams as jest.Mock).mockReturnValue({
    cityId: opts.cityId,
    category: opts.category,
  });
  (mockLoadAllCities as jest.Mock).mockResolvedValue({});
  (mockGetCity as jest.Mock).mockImplementation((id: string) => {
    if (id === 'seoul') return opts.seoul;
    if (id === opts.cityId) return opts.city;
    return undefined;
  });
  (mockFetchExchangeRates as jest.Mock).mockResolvedValue(opts.fx);
  (mockGetLastSync as jest.Mock).mockResolvedValue(opts.lastSync);
}

const flushPromises = () => new Promise((r) => setImmediate(r));

async function flush() {
  await act(async () => {
    await flushPromises();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
  jest.useRealTimers();
});

afterEach(() => {
  jest.useFakeTimers();
});

describe('DetailScreen', () => {
  describe('카테고리 검증', () => {
    it('알 수 없는 카테고리 → ErrorView', async () => {
      setupMocks({ category: 'unknown-cat' });
      render(<DetailScreen />);
      await flush();
      expect(screen.getByTestId('detail-screen-error')).toBeTruthy();
    });

    it('cityId 누락 → ErrorView', async () => {
      setupMocks();
      (useLocalSearchParams as jest.Mock).mockReturnValue({
        cityId: undefined,
        category: 'food',
      });
      render(<DetailScreen />);
      await flush();
      expect(screen.getByTestId('detail-screen-error')).toBeTruthy();
    });

    it('도시 데이터 없음 → ErrorView', async () => {
      setupMocks({ city: undefined });
      render(<DetailScreen />);
      await flush();
      expect(screen.getByTestId('detail-screen-error')).toBeTruthy();
    });
  });

  describe('food 카테고리', () => {
    it('외식 + 식재료 두 섹션 mount', async () => {
      setupMocks({ category: 'food' });
      render(<DetailScreen />);
      await flush();
      expect(screen.getByTestId('detail-section-외식')).toBeTruthy();
      expect(screen.getByTestId('detail-section-식재료')).toBeTruthy();
    });

    it('외식 섹션은 2 항목 (식당 한 끼 + 카페)', async () => {
      setupMocks({ category: 'food' });
      render(<DetailScreen />);
      await flush();
      expect(screen.getByTestId('detail-row-restaurantMeal')).toBeTruthy();
      expect(screen.getByTestId('detail-row-cafe')).toBeTruthy();
    });

    it('식재료 섹션 — 공통 항목 모두 렌더', async () => {
      setupMocks({ category: 'food' });
      render(<DetailScreen />);
      await flush();
      expect(screen.getByTestId('detail-row-milk1L')).toBeTruthy();
      expect(screen.getByTestId('detail-row-rice1kg')).toBeTruthy();
      expect(screen.getByTestId('detail-row-chicken1kg')).toBeTruthy();
    });
  });

  describe('rent 카테고리', () => {
    it('주거 형태 섹션 mount', async () => {
      setupMocks({ category: 'rent' });
      render(<DetailScreen />);
      await flush();
      expect(screen.getByTestId('detail-section-주거 형태')).toBeTruthy();
    });
  });

  describe('transport 카테고리', () => {
    it('교통 수단 섹션 mount + 3 row', async () => {
      setupMocks({ category: 'transport' });
      render(<DetailScreen />);
      await flush();
      expect(screen.getByTestId('detail-row-monthlyPass')).toBeTruthy();
      expect(screen.getByTestId('detail-row-singleRide')).toBeTruthy();
      expect(screen.getByTestId('detail-row-taxiBase')).toBeTruthy();
    });
  });

  describe('tuition 카테고리', () => {
    it('도시 데이터 있는 경우 학교 섹션', async () => {
      setupMocks({ category: 'tuition' });
      render(<DetailScreen />);
      await flush();
      expect(screen.getByTestId('detail-section-학교 (월 환산)')).toBeTruthy();
    });
  });

  describe('tax 카테고리', () => {
    it('월 세금 섹션 mount', async () => {
      setupMocks({ category: 'tax' });
      render(<DetailScreen />);
      await flush();
      expect(screen.getByTestId('detail-section-월 세금 (대략)')).toBeTruthy();
    });
  });

  describe('visa 카테고리', () => {
    it('비자/정착 섹션 mount', async () => {
      setupMocks({ category: 'visa' });
      render(<DetailScreen />);
      await flush();
      expect(screen.getByTestId('detail-section-비자/정착')).toBeTruthy();
    });
  });

  describe('Hero / 출처', () => {
    it('navy HeroCard mount', async () => {
      setupMocks({ category: 'food' });
      render(<DetailScreen />);
      await flush();
      expect(screen.getByTestId('detail-hero')).toBeTruthy();
    });

    it('TopBar mount + 카테고리 라벨 포함', async () => {
      setupMocks({ category: 'food' });
      render(<DetailScreen />);
      await flush();
      expect(screen.getByTestId('detail-topbar')).toBeTruthy();
      // 식비 + 도시명 포함 검증 (TopBar title 텍스트)
      expect(screen.getByText(/식비.*밴쿠버/)).toBeTruthy();
    });
  });

  describe('snapshot', () => {
    it('food + vancouver', async () => {
      setupMocks({ category: 'food' });
      const tree = render(<DetailScreen />);
      await flush();
      expect(tree.toJSON()).toMatchSnapshot();
    });

    it('visa + vancouver (다른 골격)', async () => {
      setupMocks({ category: 'visa' });
      const tree = render(<DetailScreen />);
      await flush();
      expect(tree.toJSON()).toMatchSnapshot();
    });
  });
});
