/**
 * `/sources` 목록 화면 테스트 (ADR-071 / in-app-policy-pages step 3).
 *
 * 정렬·집계는 `src/lib/sources.ts` 책임이라 여기서는 mock 으로 고정한 순서가
 * 그대로 렌더되는지만 본다 (화면이 재정렬하지 않는다는 것이 검증 대상).
 *
 * 푸터의 ER-API 링크(ADR-076)는 약관 필수 표기라 문구를 정확 일치로 검증한다.
 * `Linking` 은 `@/lib/linking` wrapper 만 mock (§5 — RN `Linking` 직접 import 금지).
 */

import * as React from 'react';

import { Alert } from 'react-native';

import { act, fireEvent, render } from '@testing-library/react-native';

import {
  countUniqueSources as mockCountUniqueSources,
  getCitySourceGroups as mockGetCitySourceGroups,
} from '@/lib';
import type { CitySourceGroup } from '@/lib';
import { openURL as mockOpenURL } from '@/lib/linking';

import SourcesScreen from '../index';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}));

jest.mock('@/lib/linking', () => ({
  openURL: jest.fn(() => Promise.resolve(true)),
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
    (mockOpenURL as jest.Mock).mockResolvedValue(true);
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

  describe('환율 출처 푸터 (ADR-076)', () => {
    it('링크 텍스트가 약관 원문과 정확히 일치한다 (번역·변형 금지)', () => {
      setupMocks();

      const { getByTestId, getByText } = render(<SourcesScreen />);

      expect(getByTestId('sources-footer')).toBeTruthy();
      expect(getByText('환율은 아래 서비스의 무료 API 로 매일 갱신됩니다.')).toBeTruthy();
      // 문자열 exact match — 번역·"→" 덧붙임이 있으면 실패한다.
      expect(getByText('Rates By Exchange Rate API')).toBeTruthy();
    });

    it('탭 → exchangerate-api.com 으로 openURL 호출', () => {
      setupMocks();

      const { getByTestId } = render(<SourcesScreen />);

      fireEvent.press(getByTestId('fx-attribution-link'));

      expect(mockOpenURL).toHaveBeenCalledTimes(1);
      expect(mockOpenURL).toHaveBeenCalledWith('https://www.exchangerate-api.com');
    });

    it('openURL 실패 → Alert 로 알린다 (silent fail 아님)', async () => {
      setupMocks();
      (mockOpenURL as jest.Mock).mockRejectedValue(new Error('no browser'));
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

      const { getByTestId } = render(<SourcesScreen />);

      fireEvent.press(getByTestId('fx-attribution-link'));
      // openURL 거절 → catch → Alert 는 전부 마이크로태스크. fake timer 무관.
      await act(async () => {
        await Promise.resolve();
      });

      expect(alertSpy).toHaveBeenCalledWith('링크 열기 실패', '브라우저를 열 수 없습니다.');
      alertSpy.mockRestore();
    });

    it('도시 0개(빈 상태)에서도 링크가 보인다 (1차 소스는 언제나 ER-API)', () => {
      setupMocks({ groups: [], uniqueCount: 0 });

      const { getByTestId } = render(<SourcesScreen />);

      expect(getByTestId('sources-empty')).toBeTruthy();
      expect(getByTestId('fx-attribution-link')).toBeTruthy();
    });

    it('링크가 link role 과 a11y 라벨을 갖는다', () => {
      setupMocks();

      const { getByTestId, getByLabelText } = render(<SourcesScreen />);

      expect(getByTestId('fx-attribution-link').props.accessibilityRole).toBe('link');
      expect(getByLabelText('Exchange Rate API 페이지 열기')).toBeTruthy();
    });
  });
});
