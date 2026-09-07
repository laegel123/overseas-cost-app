/**
 * `/sources` 목록 화면 테스트 (ADR-071 / in-app-policy-pages step 3).
 *
 * 정렬·집계는 `src/lib/sources.ts` 책임이라 여기서는 mock 으로 고정한 순서가
 * 그대로 렌더되는지만 본다 (화면이 재정렬하지 않는다는 것이 검증 대상).
 */

import * as React from 'react';

import { fireEvent, render } from '@testing-library/react-native';

import {
  countUniqueSources as mockCountUniqueSources,
  getCitySourceGroups as mockGetCitySourceGroups,
} from '@/lib';
import type { CitySourceGroup } from '@/lib';

import SourcesScreen from '../index';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}));

jest.mock('@/lib', () => {
  const actual = jest.requireActual('@/lib');
  return {
    ...actual,
    getCitySourceGroups: jest.fn(),
    countUniqueSources: jest.fn(),
  };
});

// lib 이 이미 표시 순서로 정렬해 준 결과 — 서울 고정 + 권역 + 가나다.
const GROUPS: CitySourceGroup[] = [
  { cityId: 'seoul', cityNameKo: '서울', count: 4 },
  { cityId: 'newyork', cityNameKo: '뉴욕', count: 5 },
  { cityId: 'vancouver', cityNameKo: '밴쿠버', count: 6 },
];

function setupMocks(opts?: { groups?: CitySourceGroup[]; uniqueCount?: number }) {
  (mockGetCitySourceGroups as jest.Mock).mockReturnValue(opts?.groups ?? GROUPS);
  (mockCountUniqueSources as jest.Mock).mockReturnValue(opts?.uniqueCount ?? 15);
}

describe('SourcesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lib 이 준 순서 그대로 렌더한다 (서울이 첫 행)', () => {
    setupMocks();

    const { getAllByTestId } = render(<SourcesScreen />);

    const rows = getAllByTestId(/^source-city-/);
    expect(rows.map((r) => r.props.testID)).toEqual([
      'source-city-seoul',
      'source-city-newyork',
      'source-city-vancouver',
    ]);
  });

  it('각 행에 도시 한국어 이름과 출처 수를 `N개` 형식으로 표시한다', () => {
    setupMocks();

    const { getByText } = render(<SourcesScreen />);

    expect(getByText('서울')).toBeTruthy();
    expect(getByText('4개')).toBeTruthy();
    expect(getByText('뉴욕')).toBeTruthy();
    expect(getByText('5개')).toBeTruthy();
    expect(getByText('밴쿠버')).toBeTruthy();
    expect(getByText('6개')).toBeTruthy();
  });

  it('행 탭 → 해당 도시의 상세 경로로 push', () => {
    setupMocks();

    const { getByTestId } = render(<SourcesScreen />);

    fireEvent.press(getByTestId('source-city-vancouver'));

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/sources/vancouver');
  });

  it('back 탭 → router.back()', () => {
    setupMocks();

    const { getByTestId } = render(<SourcesScreen />);

    fireEvent.press(getByTestId('sources-topbar-back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('헤더 부제에 unique 출처 수를 표시한다', () => {
    setupMocks({ uniqueCount: 46 });

    const { getByText } = render(<SourcesScreen />);

    expect(getByText('데이터 출처')).toBeTruthy();
    expect(getByText('출처 46개')).toBeTruthy();
  });

  it('도시 0개 → 빈 상태 표시, 목록 미렌더, 크래시 없음', () => {
    setupMocks({ groups: [], uniqueCount: 0 });

    const { getByTestId, queryByTestId } = render(<SourcesScreen />);

    expect(getByTestId('sources-empty')).toBeTruthy();
    expect(queryByTestId('sources-city-list')).toBeNull();
    // 헤더는 그대로 — 빈 화면이 아니라 이유가 보이는 화면.
    expect(getByTestId('sources-topbar')).toBeTruthy();
  });

  it('마지막 행만 bottom border 가 없다 (MenuRow isLast 관례)', () => {
    setupMocks();

    const { getByTestId } = render(<SourcesScreen />);

    expect(getByTestId('source-city-seoul').props.className).toContain('border-b');
    expect(getByTestId('source-city-vancouver').props.className).not.toContain('border-b');
  });

  it('각 행이 button role 과 의미 있는 a11y 라벨을 갖는다', () => {
    setupMocks();

    const { getByTestId, getByLabelText } = render(<SourcesScreen />);

    expect(getByTestId('source-city-seoul').props.accessibilityRole).toBe('button');
    expect(getByLabelText('서울 출처 4개 보기')).toBeTruthy();
  });
});
