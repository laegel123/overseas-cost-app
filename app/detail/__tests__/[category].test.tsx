/**
 * Detail 화면 테스트 — step1.md 요구사항.
 *
 * 카테고리별 섹션 / row 갯수 / ErrorView / snapshot 검증.
 * compare 테스트 패턴 재사용 (mock, fixture).
 */

import * as React from 'react';

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import {
  fetchExchangeRates as mockFetchExchangeRates,
  getCity as mockGetCity,
  getLastSync as mockGetLastSync,
  loadAllCities as mockLoadAllCities,
} from '@/lib';
import { useAdsStore, useRentChoiceStore, useTaxChoiceStore, useTuitionChoiceStore } from '@/store';

import { seoulValid } from '../../../src/__fixtures__/cities/seoul-valid';
import { tokyoValid } from '../../../src/__fixtures__/cities/tokyo-valid';
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
  // ADR-060 / ADR-061 — 단일 선택 store 들. 테스트 격리 위해 reset.
  useRentChoiceStore.getState().reset();
  useTuitionChoiceStore.getState().reset();
  useTaxChoiceStore.getState().reset();
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

    it('loadAllCities reject → ErrorView', async () => {
      setupMocks();
      (mockLoadAllCities as jest.Mock).mockRejectedValue(new Error('network error'));
      render(<DetailScreen />);
      await flush();
      expect(screen.getByTestId('detail-screen-error')).toBeTruthy();
    });

    it('fetchExchangeRates reject → ErrorView (PR #17 review 이슈 3)', async () => {
      setupMocks();
      (mockFetchExchangeRates as jest.Mock).mockRejectedValue(new Error('fx error'));
      render(<DetailScreen />);
      await flush();
      expect(screen.getByTestId('detail-screen-error')).toBeTruthy();
    });

    it('getLastSync reject → ErrorView', async () => {
      setupMocks();
      (mockGetLastSync as jest.Mock).mockRejectedValue(new Error('sync error'));
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

    it('서울 값이 있는 행은 숫자 배수 표기 (신규 아님)', async () => {
      setupMocks({ category: 'food' });
      render(<DetailScreen />);
      await flush();
      // 서울 10,400원 vs 밴쿠버 22 CAD × 980 = 21,560원 → ↑2.1×
      const row = screen.getByTestId('detail-row-restaurantMeal');
      expect(within(row).getByText('↑2.1×')).toBeTruthy();
      expect(within(row).queryByText('신규')).toBeNull();
    });
  });

  describe('rent 카테고리', () => {
    it('주거 형태 섹션 mount', async () => {
      setupMocks({ category: 'rent' });
      render(<DetailScreen />);
      await flush();
      expect(screen.getByTestId('detail-section-주거 형태')).toBeTruthy();
    });

    // fx CAD=980 + fixture: share 35만 vs 93.1만 / oneBed 120만 vs 225.4만.
    // hero 합산 모드는 의미가 없어 (한 사람이 4 형태 동시 거주 X) "선택된 행
    // 1 개 기준" 으로 비교. 기본 선택 = 'share' (셰어하우스), 행 탭으로 교체.

    it('기본 선택 = 셰어하우스 → hero 좌·우값이 share 값과 일치', async () => {
      setupMocks({ category: 'rent' });
      render(<DetailScreen />);
      await flush();

      const hero = screen.getByTestId('detail-hero');
      expect(within(hero).getByText('35만원')).toBeTruthy();
      expect(within(hero).getByText('93.1만원')).toBeTruthy();
      expect(within(hero).getByText(/셰어하우스/)).toBeTruthy();
    });

    it('hero footer — "선택한 항목 기준 (탭으로 변경)"', async () => {
      setupMocks({ category: 'rent' });
      render(<DetailScreen />);
      await flush();

      const footer = screen.getByTestId('detail-hero-footer');
      expect(within(footer).getByText('선택한 항목 기준 (탭으로 변경)')).toBeTruthy();
    });

    it('selected 시각 (bg-orange) 은 기본 share 행에만 적용 (사용자 피드백 2026-05-06)', async () => {
      setupMocks({ category: 'rent' });
      render(<DetailScreen />);
      await flush();

      expect(screen.getByTestId('detail-row-share').props.className).toContain('bg-orange');
      expect(screen.getByTestId('detail-row-studio').props.className).not.toContain('bg-orange');
      expect(screen.getByTestId('detail-row-oneBed').props.className).not.toContain('bg-orange');
      expect(screen.getByTestId('detail-row-twoBed').props.className).not.toContain('bg-orange');
    });

    it('1베드룸 행 탭 → hero 값/캡션이 oneBed 로 갱신 + selected 강조 이동', async () => {
      setupMocks({ category: 'rent' });
      render(<DetailScreen />);
      await flush();

      await act(async () => {
        fireEvent.press(screen.getByTestId('detail-row-oneBed'));
      });

      const hero = screen.getByTestId('detail-hero');
      expect(within(hero).getByText('120만원')).toBeTruthy();
      expect(within(hero).getByText('225.4만원')).toBeTruthy();
      expect(within(hero).getByText(/1베드룸/)).toBeTruthy();

      // selected 강조 이동 — share 에는 없고 oneBed 에 있어야 함
      expect(screen.getByTestId('detail-row-share').props.className).not.toContain('bg-orange');
      expect(screen.getByTestId('detail-row-oneBed').props.className).toContain('bg-orange');
    });

    // PR #24 review 이슈 1 — Detail 의 selectedRow fallback 이 resolveRentChoice
    // 정책 (share → studio → oneBed → twoBed) 을 따르는지. 단순 rows[0] fallback
    // 이면 RENT_ROWS 정의 순서가 달라질 때 silently 어긋날 수 있다.
    it('store=oneBed + city.oneBed=null → resolveRentChoice fallback 으로 share 선택 강조', async () => {
      useRentChoiceStore.getState().setRentChoice('oneBed');
      const cityWithNoOneBed = {
        ...vancouverValid,
        rent: { ...vancouverValid.rent, oneBed: null },
      };
      setupMocks({ category: 'rent', city: cityWithNoOneBed });
      render(<DetailScreen />);
      await flush();

      const hero = screen.getByTestId('detail-hero');
      expect(within(hero).getByText('35만원')).toBeTruthy();
      expect(within(hero).getByText('93.1만원')).toBeTruthy();
      expect(screen.getByTestId('detail-row-share').props.className).toContain('bg-orange');
      // oneBed 행은 cRaw null 로 rows 에서 제외 (selectableSection.rows 빌드 단계)
      expect(screen.queryByTestId('detail-row-oneBed')).toBeNull();
    });

    it('store 에 oneBed 가 미리 박혀 있으면 hero 가 oneBed 기준으로 mount (영속화 — ADR-060)', async () => {
      useRentChoiceStore.getState().setRentChoice('oneBed');
      setupMocks({ category: 'rent' });
      render(<DetailScreen />);
      await flush();

      const hero = screen.getByTestId('detail-hero');
      expect(within(hero).getByText('120만원')).toBeTruthy();
      expect(within(hero).getByText('225.4만원')).toBeTruthy();
      expect(screen.getByTestId('detail-row-oneBed').props.className).toContain('bg-orange');
    });

    it('탭으로 바꾼 선택은 store 에 반영된다 (Compare 화면 연동의 단일 출처)', async () => {
      setupMocks({ category: 'rent' });
      render(<DetailScreen />);
      await flush();

      expect(useRentChoiceStore.getState().rentChoice).toBe('share');

      await act(async () => {
        fireEvent.press(screen.getByTestId('detail-row-twoBed'));
      });

      expect(useRentChoiceStore.getState().rentChoice).toBe('twoBed');
    });

    it('rent 행은 Pressable (accessibilityRole=button), food 행은 일반 View', async () => {
      setupMocks({ category: 'rent' });
      const { unmount } = render(<DetailScreen />);
      await flush();
      const rentRow = screen.getByTestId('detail-row-share');
      expect(rentRow.props.accessibilityRole).toBe('button');
      unmount();

      setupMocks({ category: 'food' });
      render(<DetailScreen />);
      await flush();
      const foodRow = screen.getByTestId('detail-row-restaurantMeal');
      expect(foodRow.props.accessibilityRole).toBeUndefined();
    });
  });

  describe('합계 모드 (rent 외)', () => {
    it('food — hero footer "항목 단가 합" (기존 합계 모드 유지)', async () => {
      setupMocks({ category: 'food' });
      render(<DetailScreen />);
      await flush();

      const footer = screen.getByTestId('detail-hero-footer');
      expect(within(footer).getByText('항목 단가 합')).toBeTruthy();
    });

    it('food — selected 강조 미적용 + Pressable 아님 (selectable 아님)', async () => {
      setupMocks({ category: 'food' });
      render(<DetailScreen />);
      await flush();
      expect(screen.getByTestId('detail-row-restaurantMeal').props.className).not.toContain('bg-orange');
      expect(screen.getByTestId('detail-row-milk1L').props.className).not.toContain('bg-orange');
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

  describe('tuition 카테고리 (ADR-061: 단일 선택 + 시트)', () => {
    it('도시 데이터 있는 경우 학교 섹션 + 1 row (선택된 학교)', async () => {
      setupMocks({ category: 'tuition' });
      render(<DetailScreen />);
      await flush();
      expect(screen.getByTestId('detail-section-학교 (월 환산)')).toBeTruthy();
      // 첫 entry fallback — UBC (vancouver fixture)
      expect(screen.getByTestId('detail-row-tuition-UBC')).toBeTruthy();
      // 다른 학교 (SFU) 는 노출 안 됨 (단일 선택 1 row)
      expect(screen.queryByTestId('detail-row-tuition-SFU')).toBeNull();
    });

    it('서울 학비 데이터 부재 — seoulVal=0 정책 (한국 거주 기준)', async () => {
      // seoul 에 tuition 없음 — 기본 fixture 그대로
      setupMocks({ category: 'tuition' });
      render(<DetailScreen />);
      await flush();
      // 서울 0원 → computeMultiplier 가 '신규' 반환 → 행 배수도 hero 와 동일하게 '신규'.
      // 이전엔 호출부가 '신규' 를 1 로 강등해 "1.0×" 로 표기됐다 (E2E 결함 1).
      const row = screen.getByTestId('detail-row-tuition-UBC');
      expect(within(row).getByText('신규')).toBeTruthy();
      expect(within(row).queryByText('1.0×')).toBeNull();
    });

    it('preset 변경 — store 갱신 시 다른 학교가 row 로 표시', async () => {
      setupMocks({ category: 'tuition' });
      render(<DetailScreen />);
      await flush();
      expect(screen.getByTestId('detail-row-tuition-UBC')).toBeTruthy();

      await act(async () => {
        useTuitionChoiceStore
          .getState()
          .setTuitionChoice('vancouver', { kind: 'preset', school: 'SFU' });
      });

      expect(screen.getByTestId('detail-row-tuition-SFU')).toBeTruthy();
      expect(screen.queryByTestId('detail-row-tuition-UBC')).toBeNull();
    });

    it('custom 입력값 적용 시 row 가 "직접 입력" 으로 표시', async () => {
      setupMocks({ category: 'tuition' });
      render(<DetailScreen />);
      await flush();

      await act(async () => {
        useTuitionChoiceStore
          .getState()
          .setTuitionChoice('vancouver', { kind: 'custom', annual: 30000 });
      });

      const customRow = screen.getByTestId('detail-row-tuition-custom');
      expect(within(customRow).getByText('직접 입력')).toBeTruthy();
    });

    it('row 탭 → 시트 visible (sheet body 노출)', async () => {
      setupMocks({ category: 'tuition' });
      render(<DetailScreen />);
      await flush();
      // 시트는 처음엔 닫힘
      expect(screen.queryByTestId('detail-tuition-sheet-body')).toBeNull();
      fireEvent.press(screen.getByTestId('detail-row-tuition-UBC'));
      expect(screen.getByTestId('detail-tuition-sheet-body')).toBeTruthy();
    });

    it('도시에 tuition 데이터 없음 → emptyText + "직접 입력" 버튼', async () => {
      const { tuition: _drop, ...rest } = vancouverValid;
      setupMocks({
        category: 'tuition',
        city: rest as typeof vancouverValid,
      });
      render(<DetailScreen />);
      await flush();
      expect(
        screen.getByText('학비 데이터가 아직 준비되지 않았어요.'),
      ).toBeTruthy();
      // empty 상태에도 직접 입력 버튼 노출
      expect(screen.getByTestId('detail-picker-empty-tuition')).toBeTruthy();
    });

    it('hero footer = "선택된 항목 기준 (탭으로 변경)"', async () => {
      setupMocks({ category: 'tuition' });
      render(<DetailScreen />);
      await flush();
      const footer = screen.getByTestId('detail-hero-footer');
      expect(within(footer).getByText('선택된 항목 기준 (탭으로 변경)')).toBeTruthy();
    });
  });

  describe('tax 카테고리 (ADR-061: 단일 선택 + 시트)', () => {
    it('월 세금 섹션 + 1 row (첫 연봉 tier)', async () => {
      setupMocks({ category: 'tax' });
      render(<DetailScreen />);
      await flush();
      expect(screen.getByTestId('detail-section-월 세금 (대략)')).toBeTruthy();
      expect(screen.getByTestId('detail-row-tax-60000')).toBeTruthy();
      expect(screen.queryByTestId('detail-row-tax-80000')).toBeNull();
    });

    // PR #25 review — takeHomePctApprox 의 `/100` 버그 회귀 방지.
    // 60000 CAD * (1 - 0.74) / 12 * 980 = 1,274,000원 = 127.4만원.
    // 버그 (`/100`) 이면 4,963,740원 ≈ 496.4만원으로 4× 차이가 나므로 명확.
    it('hero — 첫 tier (60000 CAD, 0.74 takeHome) 월 세금 = 127.4만원', async () => {
      setupMocks({ category: 'tax' });
      render(<DetailScreen />);
      await flush();
      const hero = screen.getByTestId('detail-hero');
      expect(within(hero).getByText('127.4만원')).toBeTruthy();
    });

    it('preset 변경 → 다른 연봉 tier 의 row 로 변경', async () => {
      setupMocks({ category: 'tax' });
      render(<DetailScreen />);
      await flush();
      expect(screen.getByTestId('detail-row-tax-60000')).toBeTruthy();
      await act(async () => {
        useTaxChoiceStore
          .getState()
          .setTaxChoice('vancouver', { kind: 'preset', annualSalary: 80000 });
      });
      expect(screen.getByTestId('detail-row-tax-80000')).toBeTruthy();
      expect(screen.queryByTestId('detail-row-tax-60000')).toBeNull();
    });

    it('custom 입력 → row 가 "(직접 입력)" 라벨', async () => {
      setupMocks({ category: 'tax' });
      render(<DetailScreen />);
      await flush();
      await act(async () => {
        useTaxChoiceStore
          .getState()
          .setTaxChoice('vancouver', { kind: 'custom', annualSalary: 75000 });
      });
      expect(screen.getByTestId('detail-row-tax-custom')).toBeTruthy();
    });

    it('row 탭 → 세금 시트 visible', async () => {
      setupMocks({ category: 'tax' });
      render(<DetailScreen />);
      await flush();
      expect(screen.queryByTestId('detail-tax-sheet-body')).toBeNull();
      fireEvent.press(screen.getByTestId('detail-row-tax-60000'));
      expect(screen.getByTestId('detail-tax-sheet-body')).toBeTruthy();
    });

    it('도시에 tax 데이터 없음 → emptyText', async () => {
      const { tax: _drop, ...rest } = vancouverValid;
      setupMocks({
        category: 'tax',
        city: rest as typeof vancouverValid,
      });
      render(<DetailScreen />);
      await flush();
      expect(
        screen.getByText('세금 데이터가 아직 준비되지 않았어요.'),
      ).toBeTruthy();
    });
  });

  describe('visa 카테고리', () => {
    it('비자/정착 섹션 mount', async () => {
      setupMocks({ category: 'visa' });
      render(<DetailScreen />);
      await flush();
      expect(screen.getByTestId('detail-section-비자/정착')).toBeTruthy();
    });

    it('서울 비자 데이터 부재 — 행 배수가 "신규" (1.0× 강등 금지)', async () => {
      setupMocks({ category: 'visa' });
      render(<DetailScreen />);
      await flush();
      const row = screen.getByTestId('detail-row-visa-fee');
      expect(within(row).getByText('신규')).toBeTruthy();
      expect(within(row).queryByText('1.0×')).toBeNull();
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

    it('출처 푸터: 헤더(N개 + 갱신 MM-DD) + 카테고리 출처 모두 노출', async () => {
      setupMocks({ category: 'food' });
      render(<DetailScreen />);
      await flush();

      const footer = screen.getByTestId('detail-sources');
      expect(footer).toBeTruthy();
      // food 카테고리 → vancouver fixture 의 'Statistics Canada CPI' 1개
      expect(screen.getByText('출처 1개')).toBeTruthy();
      expect(screen.getByText(/^갱신/)).toBeTruthy();
      expect(screen.getByTestId('detail-source-0')).toBeTruthy();
      expect(screen.getByText('Statistics Canada CPI')).toBeTruthy();
    });

    it('출처 0건 카테고리 → "출처 정보가 없어요"', async () => {
      // sources 가 비어있는 도시로 override (vancouver fixture 에 모든 카테고리 source 존재).
      setupMocks({
        category: 'visa',
        city: { ...vancouverValid, sources: [] },
      });
      render(<DetailScreen />);
      await flush();
      expect(screen.getByText('출처 0개')).toBeTruthy();
      expect(screen.getByText('출처 정보가 없어요')).toBeTruthy();
    });
  });

  // ADR-077 — ready 상태 Screen 에만 footer 배선. AdBanner 는 mock 하지 않고 실제 컴포넌트 +
  // 전역 SDK mock 으로 렌더 (접힌 상태여도 testID 존재). 부재 케이스도 광고 store 를 ready 로
  // 주입해 "화면이 footer 를 안 붙였다" 만 검증한다.
  describe('광고 배너 (ADR-077)', () => {
    beforeEach(() => {
      useAdsStore.setState({ status: 'ready', canRequestAds: true });
    });

    afterEach(() => {
      useAdsStore.getState().reset();
    });

    it('ready 상태 → ad-banner 존재', async () => {
      setupMocks();
      render(<DetailScreen />);
      await flush();

      expect(screen.getByTestId('detail-screen')).toBeTruthy();
      expect(screen.getByTestId('ad-banner')).toBeTruthy();
    });

    it('로딩 상태 → ad-banner 부재', async () => {
      setupMocks();
      (mockLoadAllCities as jest.Mock).mockReturnValue(new Promise(() => {}));
      render(<DetailScreen />);
      await flush();

      expect(screen.getByTestId('detail-screen-loading')).toBeTruthy();
      expect(screen.queryByTestId('ad-banner')).toBeNull();
    });

    it('에러 상태 → ad-banner 부재', async () => {
      setupMocks({ city: undefined });
      render(<DetailScreen />);
      await flush();

      expect(screen.getByTestId('detail-screen-error')).toBeTruthy();
      expect(screen.queryByTestId('ad-banner')).toBeNull();
    });

    it('광고 store idle → ready 화면에도 ad-banner 부재 (렌더 조건은 AdBanner 소유)', async () => {
      useAdsStore.getState().reset();
      setupMocks();
      render(<DetailScreen />);
      await flush();

      expect(screen.getByTestId('detail-screen')).toBeTruthy();
      expect(screen.queryByTestId('ad-banner')).toBeNull();
    });
  });

  describe('핵심 contract (TESTING.md §6.3·§6.4 / PR #17 review 이슈 2)', () => {
    // 거대 트리 snapshot (이전 1226 라인) 대신 contract 단언 — pretty-format
    // ReactTestInstance fiber cyclic 직렬화 RangeError 회피. 시각 회귀 정밀
    // 검증은 v2 스크린샷 도구 (ADR-035) 후로 미룸.

    it('food — hero / 외식·식재료 섹션 / 출처 mount', async () => {
      setupMocks({ category: 'food' });
      render(<DetailScreen />);
      await flush();

      expect(screen.getByTestId('detail-hero')).toBeTruthy();
      expect(screen.getByTestId('detail-section-외식')).toBeTruthy();
      expect(screen.getByTestId('detail-section-식재료')).toBeTruthy();
      expect(screen.getByTestId('detail-row-restaurantMeal')).toBeTruthy();
      expect(screen.getByTestId('detail-row-milk1L')).toBeTruthy();
    });

    it('visa — hero / 비자 섹션 (다른 골격)', async () => {
      setupMocks({ category: 'visa' });
      render(<DetailScreen />);
      await flush();

      expect(screen.getByTestId('detail-hero')).toBeTruthy();
      expect(screen.getByTestId('detail-section-비자/정착')).toBeTruthy();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 도시끼리 비교 (`?base=<id>`, ADR-089 / city-pair-compare step 3)
//
// 위 `describe('DetailScreen')` 의 케이스는 전부 서울 모드다 — 한 줄도 고치지
// 않고 통과해야 한다 ("서울 모드 무변경" 의 증거). 아래는 추가 케이스만 담는다.
// ─────────────────────────────────────────────────────────────────────────────

/** JPY 환율 추가 — 도쿄 fixture 환산용. */
const pairFx = { ...defaultFx, JPY: 9 };

/** 양쪽 모두 세금 데이터가 없는 조합 (v1.0 실데이터 모양) — 빈 상태 검증용. */
const { tax: _vancouverTax, ...vancouverNoTax } = vancouverValid;

/** 학비 데이터가 없는 도쿄 — "한쪽만 결측" 조합 검증용. */
const { tuition: _tokyoTuition, ...tokyoNoTuition } = tokyoValid;

/** 세금 데이터가 있는 도쿄 — 데이터가 생겼을 때의 경로 (학비와 공유) 검증용. */
const tokyoWithTax: typeof tokyoValid = {
  ...tokyoValid,
  tax: [{ annualSalary: 5_000_000, takeHomePctApprox: 0.8 }],
};

function setupPairMocks(overrides?: {
  baseId?: string;
  cityId?: string;
  category?: string;
  base?: typeof vancouverValid | undefined;
  city?: typeof tokyoValid | undefined;
  fx?: typeof pairFx;
  lastSync?: string | null;
}) {
  const opts = {
    baseId: 'vancouver',
    cityId: 'tokyo',
    category: 'food',
    base: vancouverValid,
    city: tokyoValid,
    fx: pairFx,
    lastSync: '2026-04-30T10:00:00.000Z',
    ...overrides,
  };

  (useLocalSearchParams as jest.Mock).mockReturnValue({
    cityId: opts.cityId,
    category: opts.category,
    base: opts.baseId,
  });
  (mockLoadAllCities as jest.Mock).mockResolvedValue({});
  (mockGetCity as jest.Mock).mockImplementation((id: string) => {
    if (id === 'seoul') return seoulValid;
    if (id === opts.baseId) return opts.base;
    if (id === opts.cityId) return opts.city;
    return undefined;
  });
  (mockFetchExchangeRates as jest.Mock).mockResolvedValue(opts.fx);
  (mockGetLastSync as jest.Mock).mockResolvedValue(opts.lastSync);
}

/**
 * `render(...).toJSON()` 트리의 텍스트 노드를 순서대로 수집. 함수 prop (onPress 등)
 * 은 렌더마다 참조가 달라 트리 자체를 toEqual 로 비교할 수 없어, 사용자가 보는
 * 문자열만 뽑아 비교한다 (compare 테스트와 동일 헬퍼).
 */
function collectTexts(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap((child) => collectTexts(child));
  if (node !== null && typeof node === 'object') {
    return collectTexts((node as { children?: unknown }).children);
  }
  return [];
}

describe('DetailScreen — 도시끼리 모드 (`?base=`, ADR-089)', () => {
  describe('서울 모드 정규화', () => {
    it('`base` 생략과 `base=seoul` 이 같은 화면을 낸다', async () => {
      setupMocks({ category: 'food' });
      const first = render(<DetailScreen />);
      await flush();
      const withoutBase = collectTexts(first.toJSON());
      expect(withoutBase).toContain('서울');
      first.unmount();

      setupMocks({ category: 'food' });
      (useLocalSearchParams as jest.Mock).mockReturnValue({
        cityId: 'vancouver',
        category: 'food',
        base: 'seoul',
      });
      const second = render(<DetailScreen />);
      await flush();

      expect(collectTexts(second.toJSON())).toEqual(withoutBase);
    });

    it('cityId=seoul + base=tokyo → `/detail/tokyo/food` 로 replace (서울은 항상 기준)', async () => {
      setupPairMocks({ baseId: 'tokyo', cityId: 'seoul', base: tokyoValid });
      render(<DetailScreen />);
      await flush();

      expect(mockReplace).toHaveBeenCalledWith('/detail/tokyo/food');
      // 정규화 중에는 loading 유지 — 서울이 오른쪽인 화면을 그리지 않는다.
      expect(screen.getByTestId('detail-screen-loading')).toBeTruthy();
    });
  });

  describe('제목 · 부제', () => {
    it('제목 = "{카테고리} · {기준} vs {대상}", hero 좌측 라벨 = 기준 도시 한글명', async () => {
      setupPairMocks();
      render(<DetailScreen />);
      await flush();

      expect(
        within(screen.getByTestId('detail-topbar')).getByText('식비 · 밴쿠버 vs 도쿄'),
      ).toBeTruthy();
      const hero = screen.getByTestId('detail-hero');
      expect(within(hero).getByText('밴쿠버')).toBeTruthy();
      expect(within(hero).getByText('도쿄')).toBeTruthy();
      expect(within(hero).queryByText('서울')).toBeNull();
    });

    it('부제 = 두 도시 통화 모두 한 줄 (기준 → 대상 순)', async () => {
      setupPairMocks();
      render(<DetailScreen />);
      await flush();

      expect(
        within(screen.getByTestId('detail-topbar')).getByText(
          '1 CAD = 980원 · 1 JPY = 9원 · 04-30',
        ),
      ).toBeTruthy();
    });

    it('부제 — 두 도시 통화가 같으면 한 번만', async () => {
      setupPairMocks({ city: { ...tokyoValid, currency: 'CAD' } });
      render(<DetailScreen />);
      await flush();

      expect(
        within(screen.getByTestId('detail-topbar')).getByText('1 CAD = 980원 · 04-30'),
      ).toBeTruthy();
    });
  });

  describe('식비 · 월세 · 교통 — 왼쪽 열이 기준 도시 값', () => {
    it('food 행 — 밴쿠버 22 CAD(2.2만원) → 도쿄 1200 JPY(1.1만원), 배수 ↓0.5×', async () => {
      setupPairMocks({ category: 'food' });
      render(<DetailScreen />);
      await flush();

      const row = screen.getByTestId('detail-row-restaurantMeal');
      expect(within(row).getByText('2.2만원 → 1.1만원')).toBeTruthy();
      expect(within(row).getByTestId('detail-row-restaurantMeal-mult').props.children).toBe(
        '↓0.5×',
      );
      // hero 합계 — 밴쿠버 74,970원 / 도쿄 43,200원
      const hero = screen.getByTestId('detail-hero');
      expect(within(hero).getByText('7.5만원')).toBeTruthy();
      expect(within(hero).getByText('4.3만원')).toBeTruthy();
      expect(within(hero).getByText('↓0.6×')).toBeTruthy();
    });

    it('rent 행 — 기본 선택(share) hero 가 양쪽 share 값, 배수 ↓0.6×', async () => {
      setupPairMocks({ category: 'rent' });
      render(<DetailScreen />);
      await flush();

      const row = screen.getByTestId('detail-row-share');
      expect(within(row).getByText('93.1만원 → 58.5만원')).toBeTruthy();
      const hero = screen.getByTestId('detail-hero');
      expect(within(hero).getByText('93.1만원')).toBeTruthy();
      expect(within(hero).getByText('58.5만원')).toBeTruthy();
      expect(within(hero).getByText('↓0.6×')).toBeTruthy();
    });

    it('기준·대상을 맞바꾸면 배수가 뒤집힌다 (base=tokyo, city=vancouver)', async () => {
      setupPairMocks({
        baseId: 'tokyo',
        cityId: 'vancouver',
        category: 'rent',
        base: tokyoValid,
        city: vancouverValid,
      });
      render(<DetailScreen />);
      await flush();

      const row = screen.getByTestId('detail-row-share');
      expect(within(row).getByText('58.5만원 → 93.1만원')).toBeTruthy();
      expect(within(row).getByTestId('detail-row-share-mult').props.children).toBe('↑1.6×');
    });

    it('transport 행 — monthlyPass 10.3만원 → 9.5만원, taxiBase 는 ↑1.3×', async () => {
      setupPairMocks({ category: 'transport' });
      render(<DetailScreen />);
      await flush();

      const pass = screen.getByTestId('detail-row-monthlyPass');
      expect(within(pass).getByText('10.3만원 → 9.5만원')).toBeTruthy();
      const taxi = screen.getByTestId('detail-row-taxiBase');
      expect(within(taxi).getByTestId('detail-row-taxiBase-mult').props.children).toBe(
        '↑1.3×',
      );
    });
  });

  describe('visa — 양쪽 모두 실제 값', () => {
    it('신청 수수료 14.7만원 → 2.7만원 (왼쪽 0원·"신규" 아님)', async () => {
      setupPairMocks({ category: 'visa' });
      render(<DetailScreen />);
      await flush();

      const fee = screen.getByTestId('detail-row-visa-fee');
      expect(within(fee).getByText('14.7만원 → 2.7만원')).toBeTruthy();
      expect(within(fee).queryByText('신규')).toBeNull();
      expect(within(fee).getByTestId('detail-row-visa-fee-mult').props.children).toBe(
        '↓0.2×',
      );

      const settle = screen.getByTestId('detail-row-visa-settle');
      expect(within(settle).getByText('147만원 → 180만원')).toBeTruthy();
    });
  });

  describe('tuition — 도시별 선택 줄 (ADR-061 + ADR-089)', () => {
    it('선택 줄 2개 + 각 도시의 현재 선택 항목', async () => {
      setupPairMocks({ category: 'tuition' });
      render(<DetailScreen />);
      await flush();

      const basePicker = screen.getByTestId('detail-picker-city-vancouver');
      expect(within(basePicker).getByText('밴쿠버')).toBeTruthy();
      expect(within(basePicker).getByText('UBC')).toBeTruthy();
      const cityPicker = screen.getByTestId('detail-picker-city-tokyo');
      expect(within(cityPicker).getByText('도쿄')).toBeTruthy();
      expect(within(cityPicker).getByText('東京大学')).toBeTruthy();
      // 서울 모드 전용 UI 는 노출되지 않는다.
      expect(screen.queryByTestId('detail-picker-change-tuition')).toBeNull();
    });

    it('양쪽 값 — 밴쿠버 UBC 367.5만원 → 도쿄 東大 40.2만원 (↓0.1×)', async () => {
      setupPairMocks({ category: 'tuition' });
      render(<DetailScreen />);
      await flush();

      const row = screen.getByTestId('detail-row-tuition-pair');
      expect(within(row).getByText('367.5만원 → 40.2만원')).toBeTruthy();
      expect(within(row).getByTestId('detail-row-tuition-pair-mult').props.children).toBe(
        '↓0.1×',
      );
    });

    it('hero caption = "{카테고리} · 선택 항목" (양쪽 항목 이름이 달라서)', async () => {
      setupPairMocks({ category: 'tuition' });
      render(<DetailScreen />);
      await flush();

      const hero = screen.getByTestId('detail-hero');
      expect(within(hero).getByText('학비 · 선택 항목')).toBeTruthy();
      expect(
        within(screen.getByTestId('detail-hero-footer')).getByText(
          '도시별 선택 항목 기준 (바꾸기로 변경)',
        ),
      ).toBeTruthy();
    });

    it('기준 도시 줄 탭 → 그 도시(밴쿠버) 학교 목록 시트, 선택은 밴쿠버 store 에만 기록', async () => {
      setupPairMocks({ category: 'tuition' });
      render(<DetailScreen />);
      await flush();

      expect(screen.queryByTestId('detail-tuition-sheet-body')).toBeNull();
      await act(async () => {
        fireEvent.press(screen.getByTestId('detail-picker-city-vancouver'));
      });

      expect(screen.getByTestId('detail-tuition-sheet-body')).toBeTruthy();
      // 밴쿠버 학교 목록 (UBC / SFU) — 도쿄 학교는 없어야 한다.
      expect(screen.getByTestId('detail-tuition-sheet-preset-UBC')).toBeTruthy();
      expect(screen.getByTestId('detail-tuition-sheet-preset-SFU')).toBeTruthy();
      expect(screen.queryByTestId('detail-tuition-sheet-preset-東京大学')).toBeNull();

      await act(async () => {
        fireEvent.press(screen.getByTestId('detail-tuition-sheet-preset-SFU'));
      });

      expect(useTuitionChoiceStore.getState().choices['vancouver']).toEqual({
        kind: 'preset',
        school: 'SFU',
      });
      expect(useTuitionChoiceStore.getState().choices['tokyo']).toBeUndefined();
    });

    it('대상 도시 줄 탭 → 그 도시(도쿄) 학교 목록 시트', async () => {
      setupPairMocks({ category: 'tuition' });
      render(<DetailScreen />);
      await flush();

      await act(async () => {
        fireEvent.press(screen.getByTestId('detail-picker-city-tokyo'));
      });

      expect(screen.getByTestId('detail-tuition-sheet-preset-東京大学')).toBeTruthy();
      expect(screen.getByTestId('detail-tuition-sheet-preset-早稲田大学')).toBeTruthy();
      expect(screen.queryByTestId('detail-tuition-sheet-preset-UBC')).toBeNull();
    });

    it('한쪽 선택을 바꿔도 반대쪽 값은 불변 (섞이면 비교가 거짓이 된다)', async () => {
      useTuitionChoiceStore
        .getState()
        .setTuitionChoice('vancouver', { kind: 'preset', school: 'SFU' });
      setupPairMocks({ category: 'tuition' });
      render(<DetailScreen />);
      await flush();

      // 기준 = SFU 285.8만원 / 대상 = 東大 40.2만원
      expect(
        within(screen.getByTestId('detail-row-tuition-pair')).getByText(
          '285.8만원 → 40.2만원',
        ),
      ).toBeTruthy();

      await act(async () => {
        useTuitionChoiceStore
          .getState()
          .setTuitionChoice('tokyo', { kind: 'preset', school: '早稲田大学' });
      });

      // 대상만 112.5만원 으로 갱신, 기준은 SFU 그대로
      expect(
        within(screen.getByTestId('detail-row-tuition-pair')).getByText(
          '285.8만원 → 112.5만원',
        ),
      ).toBeTruthy();
      expect(
        within(screen.getByTestId('detail-picker-city-vancouver')).getByText('SFU'),
      ).toBeTruthy();
      expect(
        within(screen.getByTestId('detail-picker-city-tokyo')).getByText('早稲田大学'),
      ).toBeTruthy();
    });
  });

  describe('tax — 실데이터(양쪽 결측) 와 데이터가 생겼을 때', () => {
    it('양쪽 모두 tax 없음 (v1.0 실데이터) → 빈 상태 1회 + 선택 줄·직접 입력 없음', async () => {
      setupPairMocks({
        category: 'tax',
        base: vancouverNoTax as typeof vancouverValid,
      });
      render(<DetailScreen />);
      await flush();

      expect(
        screen.getAllByText('세금 데이터가 아직 준비되지 않았어요.'),
      ).toHaveLength(1);
      expect(screen.queryByTestId('detail-picker-city-vancouver')).toBeNull();
      expect(screen.queryByTestId('detail-picker-city-tokyo')).toBeNull();
      // 직접 입력은 서울 모드 전용 (세금은 entries 없으면 저장이 silent fail — ADR-089)
      expect(screen.queryByTestId('detail-picker-empty-tax')).toBeNull();
    });

    it('양쪽 tax 데이터 있음 → 학비와 같은 구조 (선택 줄 2개 + 양쪽 값)', async () => {
      setupPairMocks({ category: 'tax', city: tokyoWithTax });
      render(<DetailScreen />);
      await flush();

      const basePicker = screen.getByTestId('detail-picker-city-vancouver');
      expect(within(basePicker).getByText('연봉 5880만원')).toBeTruthy();
      const cityPicker = screen.getByTestId('detail-picker-city-tokyo');
      expect(within(cityPicker).getByText('연봉 4500만원')).toBeTruthy();

      const row = screen.getByTestId('detail-row-tax-pair');
      expect(within(row).getByText('127.4만원 → 75만원')).toBeTruthy();
      expect(within(row).getByTestId('detail-row-tax-pair-mult').props.children).toBe(
        '↓0.6×',
      );
    });

    it('양쪽 tax 데이터 있음 — 줄 탭 시 그 도시의 연봉 목록 시트', async () => {
      setupPairMocks({ category: 'tax', city: tokyoWithTax });
      render(<DetailScreen />);
      await flush();

      await act(async () => {
        fireEvent.press(screen.getByTestId('detail-picker-city-tokyo'));
      });

      expect(screen.getByTestId('detail-tax-sheet-body')).toBeTruthy();
      expect(screen.getByTestId('detail-tax-sheet-preset-5000000')).toBeTruthy();
      expect(screen.queryByTestId('detail-tax-sheet-preset-60000')).toBeNull();
    });
  });

  describe('결측 표기 (한쪽만 값 없음 — fixture 전용 조합)', () => {
    it('대상 도시에 학비 없음 → 그쪽 값 `—`, 배수 미표시, 0원 표기 금지', async () => {
      setupPairMocks({
        category: 'tuition',
        city: tokyoNoTuition as typeof tokyoValid,
      });
      render(<DetailScreen />);
      await flush();

      const row = screen.getByTestId('detail-row-tuition-pair');
      expect(within(row).getByText('367.5만원 → —')).toBeTruthy();
      expect(within(row).queryByText(/0원/)).toBeNull();
      expect(within(row).queryByTestId('detail-row-tuition-pair-mult')).toBeNull();

      // hero 도 같은 규칙 — 오른쪽 `—` + 가운데 배수 미표시
      const hero = screen.getByTestId('detail-hero');
      expect(within(hero).getByText('367.5만원')).toBeTruthy();
      expect(within(hero).getByText('—')).toBeTruthy();
      expect(within(hero).queryByText(/×/)).toBeNull();
      expect(within(hero).queryByText('신규')).toBeNull();

      // 선택 줄은 양쪽 모두 유지 — 데이터 없는 쪽은 '데이터 없음'
      expect(
        within(screen.getByTestId('detail-picker-city-tokyo')).getByText('데이터 없음'),
      ).toBeTruthy();
    });

    it('합계 모드 — 한쪽만 결측인 행은 양쪽 합계에서 제외, 전부 결측이면 hero 도 `—`', async () => {
      // 도쿄만 visa 보유 → 두 행 모두 한쪽 결측 → 합산 대상 0건
      const { visa: _drop, ...vancouverNoVisa } = vancouverValid;
      setupPairMocks({
        category: 'visa',
        base: vancouverNoVisa as typeof vancouverValid,
      });
      render(<DetailScreen />);
      await flush();

      const fee = screen.getByTestId('detail-row-visa-fee');
      expect(within(fee).getByText('— → 2.7만원')).toBeTruthy();
      expect(within(fee).queryByTestId('detail-row-visa-fee-mult')).toBeNull();

      const hero = screen.getByTestId('detail-hero');
      expect(within(hero).getAllByText('—')).toHaveLength(2);
      expect(within(hero).queryByText('0원')).toBeNull();
      expect(within(hero).queryByText(/×/)).toBeNull();
    });
  });

  describe('출처 (ADR-076 — 양쪽 도시 묶음)', () => {
    it('도시별 묶음 2개 + 개수는 합 (food: 밴쿠버 1 + 도쿄 1)', async () => {
      setupPairMocks({ category: 'food' });
      render(<DetailScreen />);
      await flush();

      expect(screen.getByText('출처 2개')).toBeTruthy();
      const baseGroup = screen.getByTestId('detail-sources-city-vancouver');
      expect(within(baseGroup).getByText('밴쿠버')).toBeTruthy();
      expect(within(baseGroup).getByText('Statistics Canada CPI')).toBeTruthy();
      const cityGroup = screen.getByTestId('detail-sources-city-tokyo');
      expect(within(cityGroup).getByText('도쿄')).toBeTruthy();
      expect(within(cityGroup).getByText('e-Stat 消費者物価指数')).toBeTruthy();
    });

    it('한쪽 도시에 그 카테고리 출처가 없으면 그 묶음만 "출처 정보가 없어요"', async () => {
      // tax 출처는 밴쿠버만 보유 (도쿄 fixture 에 tax 출처 없음)
      setupPairMocks({ category: 'tax', city: tokyoWithTax });
      render(<DetailScreen />);
      await flush();

      expect(screen.getByText('출처 1개')).toBeTruthy();
      expect(
        within(screen.getByTestId('detail-sources-city-vancouver')).getByText(
          'Canada Revenue Agency',
        ),
      ).toBeTruthy();
      expect(
        within(screen.getByTestId('detail-sources-city-tokyo')).getByText(
          '출처 정보가 없어요',
        ),
      ).toBeTruthy();
    });
  });

  describe('에러 분기', () => {
    it('`base` 가 도시 목록에 없음 → ErrorView', async () => {
      setupPairMocks({ baseId: 'nowhere', base: undefined });
      render(<DetailScreen />);
      await flush();

      expect(screen.getByTestId('detail-screen-error')).toBeTruthy();
      expect(screen.getByText('도시 데이터를 찾을 수 없습니다')).toBeTruthy();
    });

    it('`base === cityId` → ErrorView ("같은 도시끼리는 비교할 수 없어요")', async () => {
      setupPairMocks({ baseId: 'tokyo', cityId: 'tokyo', base: tokyoValid });
      render(<DetailScreen />);
      await flush();

      expect(screen.getByTestId('detail-screen-error')).toBeTruthy();
      expect(screen.getByText('같은 도시끼리는 비교할 수 없어요')).toBeTruthy();
    });
  });

  // 광고 위치 정책은 서울 모드와 같다 (ADR-077 — ready 화면 footer).
  describe('광고 배너 (ADR-077)', () => {
    beforeEach(() => {
      useAdsStore.setState({ status: 'ready', canRequestAds: true });
    });

    afterEach(() => {
      useAdsStore.getState().reset();
    });

    it('ready 상태 → ad-banner 존재 (현행 유지)', async () => {
      setupPairMocks();
      render(<DetailScreen />);
      await flush();

      expect(screen.getByTestId('detail-screen')).toBeTruthy();
      expect(screen.getByTestId('ad-banner')).toBeTruthy();
    });
  });
});
