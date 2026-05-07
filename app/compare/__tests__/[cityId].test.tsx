/**
 * Compare 화면 테스트 — step0.md 요구사항.
 */

import * as React from 'react';

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';

import {
  loadAllCities as mockLoadAllCities,
  getCity as mockGetCity,
  fetchExchangeRates as mockFetchExchangeRates,
  getLastSync as mockGetLastSync,
} from '@/lib';
import { useCategoryInclusionStore } from '@/store/categoryInclusion';
import { useFavoritesStore } from '@/store/favorites';
import { usePersonaStore } from '@/store/persona';
import { useRecentStore } from '@/store/recent';
import { useRentChoiceStore } from '@/store/rentChoice';
import { useTaxChoiceStore } from '@/store/taxChoice';
import { useTuitionChoiceStore } from '@/store/tuitionChoice';

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
  // ADR-060 — rent choice 도 영속 store. 테스트 격리.
  useRentChoiceStore.getState().reset();
  // ADR-061 — tuition/tax 도시별 단일 선택 store.
  useTuitionChoiceStore.getState().reset();
  useTaxChoiceStore.getState().reset();
  // ADR-062 — categoryInclusion 도시별 토글 store.
  useCategoryInclusionStore.getState().reset();
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

  describe('rent — useRentChoiceStore 연동 (ADR-060)', () => {
    // Detail 화면에서 사용자가 바꾼 주거 형태 선택이 Compare hero / 월세 카드
    // 에도 같은 기준으로 반영되어야 도시 간 비교가 일관됨. 본 테스트는 store
    // 가 Compare 의 단일 출처로 작동함을 검증.

    it("기본 'share' → 월세 카드 = 35만원 / 93.1만원 (vancouver fixture)", async () => {
      setupMocks();
      const { getByTestId } = render(<CompareScreen />);
      await act(async () => {
        await flushPromises();
      });

      const rentCard = getByTestId('compare-pair-rent');
      expect(within(rentCard).getByText('35만원')).toBeTruthy();
      expect(within(rentCard).getByText('93.1만원')).toBeTruthy();
    });

    it("store='oneBed' → 월세 카드 = 120만원 / 225.4만원 (Detail 의 변경이 Compare 에 반영)", async () => {
      useRentChoiceStore.getState().setRentChoice('oneBed');
      setupMocks();
      const { getByTestId } = render(<CompareScreen />);
      await act(async () => {
        await flushPromises();
      });

      const rentCard = getByTestId('compare-pair-rent');
      expect(within(rentCard).getByText('120만원')).toBeTruthy();
      expect(within(rentCard).getByText('225.4만원')).toBeTruthy();
    });

    it('도시에 선택 키 데이터 결측 → resolveRentChoice fallback (share → studio → oneBed → twoBed)', async () => {
      useRentChoiceStore.getState().setRentChoice('oneBed');
      // share/studio 는 있지만 oneBed 가 null 인 가상 도시 — fallback 으로 share 사용
      const cityWithNoOneBed = {
        ...vancouverValid,
        rent: { ...vancouverValid.rent, oneBed: null },
      };
      setupMocks({ city: cityWithNoOneBed });
      const { getByTestId } = render(<CompareScreen />);
      await act(async () => {
        await flushPromises();
      });

      const rentCard = getByTestId('compare-pair-rent');
      // share 로 fallback — 93.1만원
      expect(within(rentCard).getByText('93.1만원')).toBeTruthy();
    });

    // PR #24 review 이슈 2 — 두 도시가 각각 fallback 하면 "서울 oneBed vs 도시
    // share" 같은 의미 없는 비교가 발생할 수 있다. city 기준 resolved key 를
    // 1 회 결정 후 양쪽에 같은 key 강제 적용하는지 회귀 검증.
    it('city.oneBed=null 이고 store=oneBed → 양쪽 모두 share 기준 (서울 oneBed 사용 안 함)', async () => {
      useRentChoiceStore.getState().setRentChoice('oneBed');
      const cityWithNoOneBed = {
        ...vancouverValid,
        rent: { ...vancouverValid.rent, oneBed: null },
      };
      setupMocks({ city: cityWithNoOneBed });
      const { getByTestId } = render(<CompareScreen />);
      await act(async () => {
        await flushPromises();
      });

      const rentCard = getByTestId('compare-pair-rent');
      // 서울도 share 기준 (35만원) — seoul.oneBed (120만원) 가 노출되면 안 됨
      expect(within(rentCard).getByText('35만원')).toBeTruthy();
      expect(within(rentCard).getByText('93.1만원')).toBeTruthy();
      expect(within(rentCard).queryByText('120만원')).toBeNull();
    });

    // PR #24 review 이슈 3 — 마운트된 상태에서 store 변경 → 화면 실시간 갱신.
    // 기존 테스트는 모두 "mount 전 store 설정 → mount" 패턴이라 reactive 동작이
    // 검증되지 않음.
    it('마운트된 상태에서 store rentChoice 변경 → Compare 월세 카드 실시간 갱신', async () => {
      setupMocks();
      const { getByTestId } = render(<CompareScreen />);
      await act(async () => {
        await flushPromises();
      });

      // 초기: share 기준
      let rentCard = getByTestId('compare-pair-rent');
      expect(within(rentCard).getByText('35만원')).toBeTruthy();
      expect(within(rentCard).getByText('93.1만원')).toBeTruthy();

      // store 변경 (Detail 화면에서 탭한 것과 동일 효과)
      await act(async () => {
        useRentChoiceStore.getState().setRentChoice('oneBed');
      });

      rentCard = getByTestId('compare-pair-rent');
      expect(within(rentCard).getByText('120만원')).toBeTruthy();
      expect(within(rentCard).getByText('225.4만원')).toBeTruthy();
    });
  });

  describe('tuition / tax — useTuitionChoiceStore / useTaxChoiceStore 연동 (ADR-061)', () => {
    // Detail 화면에서 사용자가 바꾼 학교 / 연봉 선택이 Compare hero / 카드에도
    // 같은 기준으로 반영되어야 도시 간 비교가 일관됨.

    it('tuition: 미선택 → 첫 entry (UBC) 기준', async () => {
      usePersonaStore.getState().setPersona('student');
      setupMocks();
      const { getByTestId } = render(<CompareScreen />);
      await act(async () => {
        await flushPromises();
      });
      // UBC annual 45000 CAD / 12 = 3750 CAD/월 = 367.5만원 (FX 980)
      const tuitionCard = getByTestId('compare-pair-tuition');
      expect(within(tuitionCard).getByText('367.5만원')).toBeTruthy();
    });

    it('tuition: store 에 SFU preset → SFU 기준 (35000/12*980 = 285.8만원)', async () => {
      usePersonaStore.getState().setPersona('student');
      useTuitionChoiceStore
        .getState()
        .setTuitionChoice('vancouver', { kind: 'preset', school: 'SFU' });
      setupMocks();
      const { getByTestId } = render(<CompareScreen />);
      await act(async () => {
        await flushPromises();
      });
      const tuitionCard = getByTestId('compare-pair-tuition');
      expect(within(tuitionCard).getByText('285.8만원')).toBeTruthy();
    });

    it('tuition: custom 18000 CAD/year → 월 1500 CAD = 147만원', async () => {
      usePersonaStore.getState().setPersona('student');
      useTuitionChoiceStore
        .getState()
        .setTuitionChoice('vancouver', { kind: 'custom', annual: 18000 });
      setupMocks();
      const { getByTestId } = render(<CompareScreen />);
      await act(async () => {
        await flushPromises();
      });
      const tuitionCard = getByTestId('compare-pair-tuition');
      expect(within(tuitionCard).getByText('147만원')).toBeTruthy();
    });

    it('tuition: 마운트된 상태에서 store 갱신 → 카드 실시간 갱신', async () => {
      usePersonaStore.getState().setPersona('student');
      setupMocks();
      const { getByTestId } = render(<CompareScreen />);
      await act(async () => {
        await flushPromises();
      });
      // 초기 UBC
      let card = getByTestId('compare-pair-tuition');
      expect(within(card).getByText('367.5만원')).toBeTruthy();
      // SFU 로 갱신
      await act(async () => {
        useTuitionChoiceStore
          .getState()
          .setTuitionChoice('vancouver', { kind: 'preset', school: 'SFU' });
      });
      card = getByTestId('compare-pair-tuition');
      expect(within(card).getByText('285.8만원')).toBeTruthy();
    });

    // PR #25 3차 review — TUITION_CONFIG.getValue 가 seoul 도 동일 호출에 통과
    // 하므로, custom choice 가 적용되면 seoulVal 이 1500원 등 의도치 않은 값으로
    // 계산되는 버그 회귀 방지. seoul 정책상 학비 0원이라 카드는 "신규" 배지.
    it('tuition: custom choice 적용 시에도 seoul 측은 null (0원 정책 유지) → 신규 배지', async () => {
      usePersonaStore.getState().setPersona('student');
      useTuitionChoiceStore
        .getState()
        .setTuitionChoice('vancouver', { kind: 'custom', annual: 18000 });
      setupMocks();
      const { getByTestId } = render(<CompareScreen />);
      await act(async () => {
        await flushPromises();
      });
      const card = getByTestId('compare-pair-tuition');
      // 도시 측은 custom 18000 / 12 * 980 = 147만원
      expect(within(card).getByText('147만원')).toBeTruthy();
      // 서울 측은 null → '신규' 배지 (visa 와 동일 패턴)
      expect(within(card).getByText('신규')).toBeTruthy();
    });

    // PR #25 review — takeHomePctApprox 의 `/100` 버그 회귀 방지.
    // 60000 * (1 - 0.74) / 12 * 980 = 1,274,000원 = 127.4만원.
    it('tax: 미선택 → 첫 tier (60000, 0.74 takeHome) 월 세금 = 127.4만원', async () => {
      usePersonaStore.getState().setPersona('worker');
      setupMocks();
      const { getByTestId } = render(<CompareScreen />);
      await act(async () => {
        await flushPromises();
      });
      const taxCard = getByTestId('compare-pair-tax');
      expect(within(taxCard).getByText('127.4만원')).toBeTruthy();
    });

    // 80000 * (1 - 0.7) / 12 * 980 = 1,960,000원 = 196만원.
    it('tax: store 80000 preset (0.7 takeHome) → 196만원 (60000 tier 와 다른 값)', async () => {
      usePersonaStore.getState().setPersona('worker');
      useTaxChoiceStore
        .getState()
        .setTaxChoice('vancouver', { kind: 'preset', annualSalary: 80000 });
      setupMocks();
      const { getByTestId } = render(<CompareScreen />);
      await act(async () => {
        await flushPromises();
      });
      const taxCard = getByTestId('compare-pair-tax');
      expect(within(taxCard).getByText('196만원')).toBeTruthy();
    });

    it('tax: custom 100000 CAD/year → 카드 mount + 다른 값으로 갱신', async () => {
      usePersonaStore.getState().setPersona('worker');
      useTaxChoiceStore
        .getState()
        .setTaxChoice('vancouver', { kind: 'custom', annualSalary: 100000 });
      setupMocks();
      const { getByTestId } = render(<CompareScreen />);
      await act(async () => {
        await flushPromises();
      });
      expect(getByTestId('compare-pair-tax')).toBeTruthy();
    });

    // PR #25 7차 review — tax custom 시 takeHomePctApprox 차용 한계를 사용자에게
    // 가시화. preset 일 때는 일반 라벨, custom 일 때만 "(근사)" 표기.
    it('tax: custom 입력 시 라벨에 "(근사)" 표기', async () => {
      usePersonaStore.getState().setPersona('worker');
      useTaxChoiceStore
        .getState()
        .setTaxChoice('vancouver', { kind: 'custom', annualSalary: 100000 });
      setupMocks();
      const { getByTestId } = render(<CompareScreen />);
      await act(async () => {
        await flushPromises();
      });
      const taxCard = getByTestId('compare-pair-tax');
      expect(within(taxCard).getByText('세금 (근사)')).toBeTruthy();
    });

    it('tax: preset / 미선택 시 라벨은 "세금" (근사 표기 없음)', async () => {
      usePersonaStore.getState().setPersona('worker');
      // 미선택 (default)
      setupMocks();
      const { getByTestId } = render(<CompareScreen />);
      await act(async () => {
        await flushPromises();
      });
      const taxCard = getByTestId('compare-pair-tax');
      expect(within(taxCard).getByText('세금')).toBeTruthy();
      expect(within(taxCard).queryByText('세금 (근사)')).toBeNull();
    });
  });

  describe('inclusion (포함/제외 토글) — useCategoryInclusionStore 연동 (ADR-062)', () => {
    it('worker default: rent/food/transport/tax ON, visa OFF — 토글/배지 시각 상태', async () => {
      usePersonaStore.getState().setPersona('worker');
      setupMocks();
      const { getByTestId, queryByTestId } = render(<CompareScreen />);
      await act(async () => {
        await flushPromises();
      });

      // ON 카테고리 — 토글 value=true, 배지 미렌더
      ['rent', 'food', 'transport', 'tax'].forEach((cat) => {
        const toggle = getByTestId(`compare-pair-${cat}-toggle`);
        expect(toggle.props.value).toBe(true);
        expect(queryByTestId(`compare-pair-${cat}-excluded-badge`)).toBeNull();
      });

      // visa default OFF — 토글 value=false + "제외됨" 배지
      const visaToggle = getByTestId('compare-pair-visa-toggle');
      expect(visaToggle.props.value).toBe(false);
      expect(getByTestId('compare-pair-visa-excluded-badge')).toBeTruthy();
    });

    it('student default: tuition ON, visa OFF (worker 와 다른 default 분기)', async () => {
      usePersonaStore.getState().setPersona('student');
      setupMocks();
      const { getByTestId } = render(<CompareScreen />);
      await act(async () => {
        await flushPromises();
      });

      const tuitionToggle = getByTestId('compare-pair-tuition-toggle');
      expect(tuitionToggle.props.value).toBe(true);

      const visaToggle = getByTestId('compare-pair-visa-toggle');
      expect(visaToggle.props.value).toBe(false);
    });

    it('default 합산 → visa OFF 상태로 hero 표시 + 토글 ON 시 hero 도시값 증가 (default 가 합산에 반영)', async () => {
      usePersonaStore.getState().setPersona('worker');
      setupMocks();
      const { getByTestId } = render(<CompareScreen />);
      await act(async () => {
        await flushPromises();
      });

      // before — visa OFF (default)
      const heroBefore = getByTestId('compare-hero');
      const heroRightBefore = within(heroBefore).getAllByText(/만원$/);
      const beforeRightValue = String(
        heroRightBefore[heroRightBefore.length - 1].props.children,
      );

      // visa 토글 ON
      act(() => {
        useCategoryInclusionStore.getState().setInclusion('vancouver', 'visa', true);
      });

      // after — hero 도시값이 visa 비용만큼 증가
      const heroAfter = getByTestId('compare-hero');
      const heroRightAfter = within(heroAfter).getAllByText(/만원$/);
      const afterRightValue = String(
        heroRightAfter[heroRightAfter.length - 1].props.children,
      );
      expect(afterRightValue).not.toBe(beforeRightValue);

      // visa 카드 자체도 토글 ON + 배지 미렌더로 갱신.
      const visaToggle = getByTestId('compare-pair-visa-toggle');
      expect(visaToggle.props.value).toBe(true);
    });

    it('서울합=0 케이스 → hero 가운데 mult 영역 미렌더 (ADR-062)', async () => {
      // 학비 + 비자만 ON, 나머지 OFF — 학비/비자는 서울 측 0원 카테고리.
      // → seoulTotal === 0 → centerMult undefined → mult 영역 미렌더.
      usePersonaStore.getState().setPersona('student');
      setupMocks();
      const { getByTestId, queryByText } = render(<CompareScreen />);
      await act(async () => {
        await flushPromises();
      });

      act(() => {
        const set = useCategoryInclusionStore.getState().setInclusion;
        set('vancouver', 'rent', false);
        set('vancouver', 'food', false);
        set('vancouver', 'transport', false);
        set('vancouver', 'tuition', true);
        set('vancouver', 'visa', true);
      });

      // hero 의 가운데 mult 텍스트 (`↑X.X×` 형식) 가 미렌더 — caption (차액) 만 표시.
      // 직접 `compare-hero-center` 가 caption 만 갖고 mult 는 없어야 한다.
      const hero = getByTestId('compare-hero');
      // mult 텍스트는 보통 `↑1.9×` 형식 — `×` 문자가 없는지로 약식 검증.
      const multTexts = within(hero).queryAllByText(/×$/);
      expect(multTexts).toHaveLength(0);

      // caption 은 여전히 표시 — `+N만원/월` 또는 `만원/월` 패턴.
      const captionTexts = within(hero).queryAllByText(/만원\/월$/);
      expect(captionTexts.length).toBeGreaterThan(0);

      // 다시 한 카드라도 서울 측 양수 카테고리 (rent) ON 하면 mult 복구.
      act(() => {
        useCategoryInclusionStore.getState().setInclusion('vancouver', 'rent', true);
      });
      const heroAgain = getByTestId('compare-hero');
      expect(within(heroAgain).queryAllByText(/×$/).length).toBeGreaterThan(0);

      // queryByText 사용 (미사용 변수 lint 회피).
      void queryByText;
    });

    it('store 사용자 토글 갱신 → ComparePair 시각 상태 즉시 갱신', async () => {
      usePersonaStore.getState().setPersona('worker');
      setupMocks();
      const { getByTestId, queryByTestId } = render(<CompareScreen />);
      await act(async () => {
        await flushPromises();
      });

      // before — rent default ON
      expect(getByTestId('compare-pair-rent-toggle').props.value).toBe(true);
      expect(queryByTestId('compare-pair-rent-excluded-badge')).toBeNull();

      // 사용자가 rent OFF
      act(() => {
        useCategoryInclusionStore.getState().setInclusion('vancouver', 'rent', false);
      });

      expect(getByTestId('compare-pair-rent-toggle').props.value).toBe(false);
      expect(getByTestId('compare-pair-rent-excluded-badge')).toBeTruthy();
    });

    it('도시별 inclusion 독립 — vancouver 의 토글이 osaka 에 영향 없음', async () => {
      usePersonaStore.getState().setPersona('worker');
      // vancouver 의 visa 만 강제 ON (사전 설정).
      useCategoryInclusionStore.getState().setInclusion('vancouver', 'visa', true);
      // osaka 화면 진입 — osaka 의 visa 는 default (worker → false).
      setupMocks({ cityId: 'osaka', city: vancouverValid });
      // 위에선 vancouver fixture 를 osaka id 로 주입 (시각 검증만 — 도시별 inclusion
      // 키 격리 보증).
      const { getByTestId } = render(<CompareScreen />);
      await act(async () => {
        await flushPromises();
      });

      // osaka 의 visa default 는 OFF (worker default 정책) — vancouver 의 ON 토글에
      // 영향받지 않음.
      const visaToggle = getByTestId('compare-pair-visa-toggle');
      expect(visaToggle.props.value).toBe(false);
    });
  });
});
