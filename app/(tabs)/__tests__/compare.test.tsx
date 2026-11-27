/**
 * 비교 탭 선택 화면 테스트 — TESTING.md §9.26.2 (ADR-089).
 *
 * 로드 패턴(타이머 역전 + setImmediate flush)은 favorites.test.tsx 와 동일.
 * 환율은 이 화면이 읽지 않으므로 `fetchExchangeRates` 를 mock 하지 않는다.
 */

import * as React from 'react';

import { act, fireEvent, render } from '@testing-library/react-native';

import { Screen } from '@/components/Screen';
import { getAllCities as mockGetAllCities, loadAllCities as mockLoadAllCities } from '@/lib';
import { useComparePairStore } from '@/store/comparePair';

import { seoulValid } from '../../../src/__fixtures__/cities/seoul-valid';
import { vancouverValid } from '../../../src/__fixtures__/cities/vancouver-valid';
import CompareTabScreen from '../compare';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib', () => {
  const actual = jest.requireActual('@/lib');
  return {
    ...actual,
    loadAllCities: jest.fn(),
    getAllCities: jest.fn(),
  };
});

const torontoValid = {
  ...vancouverValid,
  id: 'toronto',
  name: { ko: '토론토', en: 'Toronto' },
};
const osakaValid = {
  ...vancouverValid,
  id: 'osaka',
  name: { ko: '오사카', en: 'Osaka' },
  country: 'JP',
  currency: 'JPY',
  region: 'asia' as const,
};

const citiesMap = {
  vancouver: vancouverValid,
  seoul: seoulValid,
  toronto: torontoValid,
  osaka: osakaValid,
};

function setupMocks(cities: Record<string, unknown> = citiesMap) {
  (mockLoadAllCities as jest.Mock).mockResolvedValue(cities);
  (mockGetAllCities as jest.Mock).mockReturnValue(cities);
}

const flushPromises = () => new Promise((r) => setImmediate(r));

async function renderReady() {
  const utils = render(<CompareTabScreen />);
  await act(async () => {
    await flushPromises();
  });
  return utils;
}

describe('CompareTabScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useComparePairStore.setState({ baseId: null, cityId: null });
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useFakeTimers();
  });

  it('로딩 중 스피너 표시', () => {
    (mockLoadAllCities as jest.Mock).mockReturnValue(new Promise(() => {}));

    const { getByTestId } = render(<CompareTabScreen />);

    expect(getByTestId('compare-tab-screen-loading')).toBeTruthy();
  });

  it('로드 실패 → ErrorView + "다시 시도" → 재로드 후 ready', async () => {
    (mockLoadAllCities as jest.Mock).mockRejectedValueOnce(new Error('네트워크 오류'));

    const { getByTestId, getByText, getByLabelText } = await renderReady();

    expect(getByTestId('compare-tab-screen-error')).toBeTruthy();
    expect(getByText('네트워크 오류')).toBeTruthy();

    setupMocks();
    fireEvent.press(getByLabelText('다시 시도'));
    await act(async () => {
      await flushPromises();
    });

    expect(getByTestId('compare-tab-screen')).toBeTruthy();
  });

  it('초기 상태 → 두 칸 모두 빈 칸, "비교하기" 비활성', async () => {
    setupMocks();

    const { getByTestId, getAllByText } = await renderReady();

    expect(getByTestId('compare-tab-screen')).toBeTruthy();
    expect(getAllByText('도시 선택')).toHaveLength(2);
    expect(getByTestId('compare-tab-submit').props.accessibilityState).toEqual({
      disabled: true,
    });
  });

  it('칸 탭 → 도시 목록 시트, 서울 포함 전체가 한글 가나다순', async () => {
    setupMocks();

    const { getByTestId, getAllByTestId } = await renderReady();

    fireEvent.press(getByTestId('compare-tab-slot-base'));

    const options = getAllByTestId(/^compare-tab-option-/);
    expect(options.map((o) => o.props.testID)).toEqual([
      'compare-tab-option-vancouver', // 밴쿠버
      'compare-tab-option-seoul', // 서울
      'compare-tab-option-osaka', // 오사카
      'compare-tab-option-toronto', // 토론토
    ]);
  });

  it('도시 선택 → store 반영 + 시트 닫힘', async () => {
    setupMocks();

    const { getByTestId, queryByTestId } = await renderReady();

    fireEvent.press(getByTestId('compare-tab-slot-base'));
    fireEvent.press(getByTestId('compare-tab-option-vancouver'));

    expect(useComparePairStore.getState().baseId).toBe('vancouver');
    expect(queryByTestId('compare-tab-option-vancouver')).toBeNull();
    expect(getByTestId('compare-tab-slot-base')).toBeTruthy();

    fireEvent.press(getByTestId('compare-tab-slot-city'));
    fireEvent.press(getByTestId('compare-tab-option-toronto'));

    expect(useComparePairStore.getState().cityId).toBe('toronto');
  });

  it('반대편 칸에 든 도시는 비활성 — 눌러도 store 가 바뀌지 않음', async () => {
    setupMocks();
    useComparePairStore.setState({ baseId: 'vancouver', cityId: null });

    const { getByTestId } = await renderReady();

    fireEvent.press(getByTestId('compare-tab-slot-city'));

    const taken = getByTestId('compare-tab-option-vancouver');
    expect(taken.props.accessibilityState).toEqual({ disabled: true, selected: false });

    fireEvent.press(taken);
    expect(useComparePairStore.getState().cityId).toBeNull();

    const free = getByTestId('compare-tab-option-toronto');
    expect(free.props.accessibilityState).toEqual({ disabled: false, selected: false });
  });

  it('저장된 id 가 도시 목록에 없으면 빈 칸 (store 값은 유지)', async () => {
    setupMocks();
    useComparePairStore.setState({ baseId: 'atlantis', cityId: 'toronto' });

    const { getAllByText, getByText, getByTestId } = await renderReady();

    expect(getAllByText('도시 선택')).toHaveLength(1);
    expect(getByText('토론토')).toBeTruthy();
    expect(getByTestId('compare-tab-submit').props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(useComparePairStore.getState().baseId).toBe('atlantis');
  });

  it('두 칸 모두 유효 → "비교하기" 활성', async () => {
    setupMocks();
    useComparePairStore.setState({ baseId: 'vancouver', cityId: 'toronto' });

    const { getByTestId } = await renderReady();

    expect(getByTestId('compare-tab-submit').props.accessibilityState).toEqual({
      disabled: false,
    });
  });

  it('도시끼리 → /compare/<오른쪽>?base=<왼쪽> push', async () => {
    setupMocks();
    useComparePairStore.setState({ baseId: 'vancouver', cityId: 'toronto' });

    const { getByTestId } = await renderReady();

    fireEvent.press(getByTestId('compare-tab-submit'));
    expect(mockPush).toHaveBeenCalledWith('/compare/toronto?base=vancouver');
  });

  it('왼쪽이 서울 → /compare/<오른쪽> (base 없음)', async () => {
    setupMocks();
    useComparePairStore.setState({ baseId: 'seoul', cityId: 'toronto' });

    const { getByTestId } = await renderReady();

    fireEvent.press(getByTestId('compare-tab-submit'));
    expect(mockPush).toHaveBeenCalledWith('/compare/toronto');
  });

  it('오른쪽이 서울 → /compare/<왼쪽> (서울은 항상 기준)', async () => {
    setupMocks();
    useComparePairStore.setState({ baseId: 'toronto', cityId: 'seoul' });

    const { getByTestId } = await renderReady();

    fireEvent.press(getByTestId('compare-tab-submit'));
    expect(mockPush).toHaveBeenCalledWith('/compare/toronto');
  });

  it('비활성 "비교하기" 탭 → push 없음', async () => {
    setupMocks();
    useComparePairStore.setState({ baseId: 'vancouver', cityId: null });

    const { getByTestId } = await renderReady();

    fireEvent.press(getByTestId('compare-tab-submit'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('광고 footer 없음 (ADR-077 — 광고는 홈·비교·상세만)', async () => {
    setupMocks();

    const { UNSAFE_getByType } = await renderReady();

    expect(UNSAFE_getByType(Screen).props.footer).toBeUndefined();
  });
});
