/**
 * `/sources/[cityId]` 도시별 출처 화면 테스트 (ADR-071 / in-app-policy-pages step 4).
 *
 * 그룹핑·순서는 `src/lib/sources.ts` 책임이라 mock 으로 고정하고, 화면이 받은
 * 순서 그대로 그리는지·출처 원문을 가공 없이 노출하는지·외부 링크 실패를 사용자에게
 * 알리는지를 본다. `Linking` 은 `@/lib/linking` wrapper 로만 접근 (TESTING.md §5).
 */

import * as React from 'react';

import { Alert } from 'react-native';

import { act, fireEvent, render } from '@testing-library/react-native';

import {
  getCity as mockGetCity,
  getCitySourcesByCategory as mockGetCitySourcesByCategory,
} from '@/lib';
import type { CategorySourceGroup } from '@/lib';
import { CityNotFoundError } from '@/lib/errors';
import { openURL as mockOpenURL } from '@/lib/linking';
import type { CityCostData } from '@/types/city';

import SourceCityScreen from '../[cityId]';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/lib/linking', () => ({
  openURL: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@/lib', () => {
  const actual = jest.requireActual('@/lib');
  return {
    ...actual,
    getCity: jest.fn(),
    getCitySourcesByCategory: jest.fn(),
  };
});

const { useLocalSearchParams } = jest.requireMock('expo-router');

/**
 * 서울 실데이터 모양 — rent 1 / food 2 / transport 1, tuition·tax·visa 없음.
 * food 2건이 "한 카테고리에 출처 여러 개" 케이스를 담당한다.
 */
const SEOUL_GROUPS: CategorySourceGroup[] = [
  {
    category: 'rent',
    sources: [
      {
        category: 'rent',
        name: '국토교통부 실거래가 공개시스템',
        url: 'https://rt.molit.go.kr/',
        accessedAt: '2026-05-02',
      },
    ],
  },
  {
    category: 'food',
    sources: [
      {
        category: 'food',
        name: 'KOSIS 소비자물가조사',
        url: 'https://kosis.kr/',
        accessedAt: '2026-05-02',
      },
      {
        category: 'food',
        name: '한국농수산식품유통공사(aT) 농산물유통정보',
        url: 'https://www.kamis.or.kr/',
        accessedAt: '2026-05-03',
      },
    ],
  },
  {
    category: 'transport',
    sources: [
      {
        category: 'transport',
        name: '서울교통공사',
        url: 'https://www.seoulmetro.co.kr/',
        accessedAt: '2026-05-02',
      },
    ],
  },
];

/** 해외 도시 — tuition·visa 포함, 이름이 길어 말줄임 금지 검증에 쓰인다. */
const LONG_TUITION_NAME =
  '東京大学 · 早稲田大学 · 慶應義塾大学 공식 국제학생 학비 페이지 (정적 추정치)';

const TOKYO_GROUPS: CategorySourceGroup[] = [
  {
    category: 'food',
    sources: [
      {
        category: 'food',
        name: '総務省統計局 消費者物価指数',
        url: 'https://www.stat.go.jp/',
        accessedAt: '2026-05-02',
      },
    ],
  },
  {
    category: 'tuition',
    sources: [
      {
        category: 'tuition',
        name: LONG_TUITION_NAME,
        url: 'https://www.u-tokyo.ac.jp/en/prospective-students/tuition_fees.html',
        accessedAt: '2026-09-07',
      },
    ],
  },
];

function city(nameKo: string): CityCostData {
  return { name: { ko: nameKo } } as CityCostData;
}

function setupMocks(opts?: { cityId?: string; groups?: CategorySourceGroup[]; nameKo?: string }) {
  const cityId = opts?.cityId ?? 'seoul';
  (useLocalSearchParams as jest.Mock).mockReturnValue({ cityId });
  (mockGetCitySourcesByCategory as jest.Mock).mockReturnValue(opts?.groups ?? SEOUL_GROUPS);
  (mockGetCity as jest.Mock).mockReturnValue(city(opts?.nameKo ?? '서울'));
}

describe('SourceCityScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockOpenURL as jest.Mock).mockResolvedValue(true);
  });

  it('카테고리 그룹을 lib 이 준 CATEGORY_ORDER 순서 그대로 렌더한다', () => {
    setupMocks();

    const { getAllByTestId } = render(<SourceCityScreen />);

    const groups = getAllByTestId(/^source-group-/);
    expect(groups.map((g) => g.props.testID)).toEqual([
      'source-group-rent',
      'source-group-food',
      'source-group-transport',
    ]);
  });

  it('각 그룹에 카테고리 라벨과 아이콘이 표시된다', () => {
    setupMocks();

    const { getByText, getByTestId } = render(<SourceCityScreen />);

    expect(getByText('월세')).toBeTruthy();
    expect(getByText('식비')).toBeTruthy();
    expect(getByText('교통')).toBeTruthy();
    // 아이콘은 CATEGORY_ICON 매핑 (rent→house, food→fork, transport→bus).
    expect(getByTestId('source-icon-rent')).toBeTruthy();
    expect(getByTestId('source-icon-food')).toBeTruthy();
    expect(getByTestId('source-icon-transport')).toBeTruthy();
  });

  it('한 카테고리에 출처가 2개면 둘 다 렌더한다 (서울 food)', () => {
    setupMocks();

    const { getByTestId, getByText } = render(<SourceCityScreen />);

    expect(getByTestId('source-item-food-0')).toBeTruthy();
    expect(getByTestId('source-item-food-1')).toBeTruthy();
    expect(getByText('KOSIS 소비자물가조사')).toBeTruthy();
    expect(getByText('한국농수산식품유통공사(aT) 농산물유통정보')).toBeTruthy();
  });

  it('출처 이름과 접속일을 원문 그대로 표시한다', () => {
    setupMocks();

    const { getAllByText, getByText } = render(<SourceCityScreen />);

    expect(getByText('국토교통부 실거래가 공개시스템')).toBeTruthy();
    expect(getByText('서울교통공사')).toBeTruthy();
    // 같은 접속일을 쓰는 출처가 3건 — 접속일은 출처별로 각각 표시된다.
    expect(getAllByText('접속일 2026-05-02')).toHaveLength(3);
    expect(getByText('접속일 2026-05-03')).toBeTruthy();
  });

  it('긴 출처 이름을 말줄임하지 않는다 (numberOfLines 미적용)', () => {
    setupMocks({ cityId: 'tokyo', groups: TOKYO_GROUPS, nameKo: '도쿄' });

    const { getByText } = render(<SourceCityScreen />);

    const nameNode = getByText(LONG_TUITION_NAME);
    expect(nameNode.props.numberOfLines).toBeUndefined();
  });

  it('"페이지 열기 →" 탭 → 해당 출처의 url 로 openURL 호출', () => {
    setupMocks();

    const { getByTestId } = render(<SourceCityScreen />);

    fireEvent.press(getByTestId('source-open-food-1'));

    expect(mockOpenURL).toHaveBeenCalledTimes(1);
    expect(mockOpenURL).toHaveBeenCalledWith('https://www.kamis.or.kr/');
  });

  it('링크 열기 버튼이 button role 과 출처명을 담은 a11y 라벨을 갖는다', () => {
    setupMocks();

    const { getByTestId, getByLabelText } = render(<SourceCityScreen />);

    expect(getByTestId('source-open-rent-0').props.accessibilityRole).toBe('button');
    expect(getByLabelText('국토교통부 실거래가 공개시스템 페이지 열기')).toBeTruthy();
  });

  it('openURL 실패 → Alert 로 알린다 (silent fail 아님)', async () => {
    setupMocks();
    (mockOpenURL as jest.Mock).mockRejectedValue(new Error('no browser'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByTestId } = render(<SourceCityScreen />);

    fireEvent.press(getByTestId('source-open-rent-0'));
    // openURL 거절 → catch → Alert 는 전부 마이크로태스크. fake timer 무관.
    await act(async () => {
      await Promise.resolve();
    });

    expect(alertSpy).toHaveBeenCalledWith('링크 열기 실패', '브라우저를 열 수 없습니다.');
    alertSpy.mockRestore();
  });

  it('tax 그룹은 렌더되지 않는다 (v1.0 출처 0개 — lib 이 빈 그룹을 주지 않음)', () => {
    setupMocks();

    const { queryByTestId, queryByText } = render(<SourceCityScreen />);

    expect(queryByTestId('source-group-tax')).toBeNull();
    expect(queryByText('세금')).toBeNull();
  });

  it('헤더에 도시 한국어명과 출처 수를 표시한다', () => {
    setupMocks();

    const { getByText } = render(<SourceCityScreen />);

    expect(getByText('서울')).toBeTruthy();
    expect(getByText('출처 4개')).toBeTruthy();
  });

  it('자동 갱신 정책 안내 푸터를 표시한다', () => {
    setupMocks();

    const { getByTestId } = render(<SourceCityScreen />);

    expect(getByTestId('source-city-footer')).toBeTruthy();
  });

  it('back 탭 → router.back()', () => {
    setupMocks();

    const { getByTestId } = render(<SourceCityScreen />);

    fireEvent.press(getByTestId('source-city-topbar-back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('존재하지 않는 cityId → ErrorView 렌더, 크래시 없음', () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ cityId: 'atlantis' });
    (mockGetCitySourcesByCategory as jest.Mock).mockImplementation(() => {
      throw new CityNotFoundError('atlantis');
    });
    (mockGetCity as jest.Mock).mockReturnValue(undefined);

    const { getByTestId, queryByTestId, getByText } = render(<SourceCityScreen />);

    expect(getByTestId('source-city-error')).toBeTruthy();
    expect(queryByTestId('source-city-screen')).toBeNull();
    expect(getByText('출처 정보를 찾을 수 없어요')).toBeTruthy();
  });

  it('ErrorView 의 "돌아가기" 탭 → router.back()', () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ cityId: 'atlantis' });
    (mockGetCitySourcesByCategory as jest.Mock).mockImplementation(() => {
      throw new CityNotFoundError('atlantis');
    });

    const { getByLabelText } = render(<SourceCityScreen />);

    fireEvent.press(getByLabelText('돌아가기'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('cityId 파라미터가 없으면 ErrorView (lib 호출 없음)', () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({});

    const { getByTestId } = render(<SourceCityScreen />);

    expect(getByTestId('source-city-error')).toBeTruthy();
    expect(mockGetCitySourcesByCategory).not.toHaveBeenCalled();
  });
});
