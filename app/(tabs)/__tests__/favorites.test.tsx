/**
 * 즐겨찾기 탭 화면 테스트 — TESTING.md §9.26.1 (ADR-084).
 */

import * as React from 'react';

import { act, fireEvent, render } from '@testing-library/react-native';

import { Screen } from '@/components/Screen';
import {
  fetchExchangeRates as mockFetchExchangeRates,
  getAllCities as mockGetAllCities,
  loadAllCities as mockLoadAllCities,
} from '@/lib';
import { useFavoritesStore } from '@/store/favorites';

import { seoulValid } from '../../../src/__fixtures__/cities/seoul-valid';
import { vancouverValid } from '../../../src/__fixtures__/cities/vancouver-valid';
import FavoritesScreen from '../favorites';

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

const defaultFx = { KRW: 1, CAD: 980, JPY: 9 };
const citiesMap = { seoul: seoulValid, vancouver: vancouverValid, tokyo: tokyoValid };

function setupMocks(cities: Record<string, unknown> = citiesMap) {
  (mockLoadAllCities as jest.Mock).mockResolvedValue(cities);
  (mockGetAllCities as jest.Mock).mockReturnValue(cities);
  (mockFetchExchangeRates as jest.Mock).mockResolvedValue(defaultFx);
}

const flushPromises = () => new Promise((r) => setImmediate(r));

async function renderReady() {
  const utils = render(<FavoritesScreen />);
  await act(async () => {
    await flushPromises();
  });
  return utils;
}

// 타이머 역전 패턴 — index.test.tsx 와 동일 (load() 가 setImmediate flush 에 의존).
describe('FavoritesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useFavoritesStore.getState().clear();
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useFakeTimers();
  });

  it('로딩 중 스피너 표시', () => {
    (mockLoadAllCities as jest.Mock).mockReturnValue(new Promise(() => {}));
    (mockFetchExchangeRates as jest.Mock).mockReturnValue(new Promise(() => {}));

    const { getByTestId } = render(<FavoritesScreen />);

    expect(getByTestId('favorites-screen-loading')).toBeTruthy();
  });

  it('즐겨찾기 0개 → 빈 상태 + CTA, CTA 탭 → 홈으로 navigate', async () => {
    setupMocks();

    const { getByTestId, queryByTestId } = await renderReady();

    expect(getByTestId('favorites-empty')).toBeTruthy();
    expect(queryByTestId('favorites-list')).toBeNull();

    fireEvent.press(getByTestId('favorites-empty-cta'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('즐겨찾기 여러 개 → 스토어 순서대로 전부 표시', async () => {
    setupMocks();
    useFavoritesStore.getState().add('tokyo');
    useFavoritesStore.getState().add('vancouver');
    const ids = useFavoritesStore.getState().cityIds;

    const { getByTestId, getAllByTestId, queryByTestId } = await renderReady();

    expect(queryByTestId('favorites-empty')).toBeNull();
    const rows = getAllByTestId(/^favorites-row-[a-z]+$/);
    expect(rows.map((r) => r.props.testID)).toEqual(ids.map((id) => `favorites-row-${id}`));
    expect(getByTestId('favorites-row-tokyo')).toBeTruthy();
    expect(getByTestId('favorites-row-vancouver')).toBeTruthy();
  });

  it('행 탭 → /compare/{cityId} push', async () => {
    setupMocks();
    useFavoritesStore.getState().add('vancouver');
    useFavoritesStore.getState().add('tokyo');

    const { getByText } = await renderReady();

    fireEvent.press(getByText('도쿄'));
    expect(mockPush).toHaveBeenCalledWith('/compare/tokyo');
  });

  it('데이터에 없는 도시 id · seoul 은 목록에서 제외', async () => {
    setupMocks();
    useFavoritesStore.getState().add('vancouver');
    useFavoritesStore.getState().add('atlantis');
    useFavoritesStore.getState().add('seoul');

    const { getAllByTestId } = await renderReady();

    expect(getAllByTestId(/^favorites-row-[a-z]+$/)).toHaveLength(1);
  });

  it('서울 데이터 없음 → 에러 화면', async () => {
    setupMocks({ vancouver: vancouverValid });

    const { getByTestId, getByText } = await renderReady();

    expect(getByTestId('favorites-screen-error')).toBeTruthy();
    expect(getByText('서울 데이터를 찾을 수 없습니다')).toBeTruthy();
  });

  it('로드 실패 → 에러 메시지 + 다시 시도 → 재로드 후 ready', async () => {
    (mockLoadAllCities as jest.Mock).mockRejectedValueOnce(new Error('네트워크 오류'));
    (mockFetchExchangeRates as jest.Mock).mockResolvedValue(defaultFx);

    const { getByTestId, getByText } = await renderReady();
    expect(getByText('네트워크 오류')).toBeTruthy();

    setupMocks();
    fireEvent.press(getByTestId('favorites-retry-btn'));
    await act(async () => {
      await flushPromises();
    });

    expect(getByTestId('favorites-screen')).toBeTruthy();
  });

  it('광고 footer 없음 (ADR-077 — 광고는 홈·비교·상세만)', async () => {
    setupMocks();

    const { UNSAFE_getByType } = await renderReady();

    expect(UNSAFE_getByType(Screen).props.footer).toBeUndefined();
  });
});
