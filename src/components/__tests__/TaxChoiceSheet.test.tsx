/**
 * docs/TESTING.md §9.20.6 — TaxChoiceSheet (ADR-061).
 */

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { useTaxChoiceStore } from '@/store';
import type { CityCostData, ExchangeRates } from '@/types/city';

import { TaxChoiceSheet } from '../TaxChoiceSheet';

const tax: NonNullable<CityCostData['tax']> = [
  { annualSalary: 60000, takeHomePctApprox: 0.74 },
  { annualSalary: 80000, takeHomePctApprox: 0.7 },
];

const fx: ExchangeRates = { KRW: 1, CAD: 980 };

beforeEach(() => {
  useTaxChoiceStore.getState().reset();
});

function renderSheet(overrides?: { onDismiss?: jest.Mock }) {
  const onDismiss = overrides?.onDismiss ?? jest.fn();
  render(
    <TaxChoiceSheet
      visible
      onDismiss={onDismiss}
      cityId="vancouver"
      cityCurrency="CAD"
      cityTax={tax}
      fx={fx}
      testID="sheet"
    />,
  );
  return { onDismiss };
}

describe('TaxChoiceSheet', () => {
  it('연봉 tier 목록 + 직접 입력 행 렌더', () => {
    renderSheet();
    expect(screen.getByTestId('sheet-preset-60000')).toBeTruthy();
    expect(screen.getByTestId('sheet-preset-80000')).toBeTruthy();
    expect(screen.getByTestId('sheet-custom-row')).toBeTruthy();
  });

  it('preset 탭 → store 갱신 + dismiss', () => {
    const { onDismiss } = renderSheet();
    fireEvent.press(screen.getByTestId('sheet-preset-80000'));
    expect(useTaxChoiceStore.getState().choices.vancouver).toEqual({
      kind: 'preset',
      annualSalary: 80000,
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('custom 저장 → store 에 custom kind', () => {
    renderSheet();
    fireEvent.press(screen.getByTestId('sheet-custom-row'));
    fireEvent.changeText(screen.getByTestId('sheet-custom-input'), '75000');
    fireEvent.press(screen.getByTestId('sheet-save'));
    expect(useTaxChoiceStore.getState().choices.vancouver).toEqual({
      kind: 'custom',
      annualSalary: 75000,
    });
  });

  it('0 이하 입력 → save 무시', () => {
    renderSheet();
    fireEvent.press(screen.getByTestId('sheet-custom-row'));
    fireEvent.changeText(screen.getByTestId('sheet-custom-input'), '-1');
    fireEvent.press(screen.getByTestId('sheet-save'));
    expect(useTaxChoiceStore.getState().choices.vancouver).toBeUndefined();
  });

  it('현재 선택이 custom → 시트가 custom 모드로 시작', () => {
    act(() => {
      useTaxChoiceStore
        .getState()
        .setTaxChoice('vancouver', { kind: 'custom', annualSalary: 75000 });
    });
    renderSheet();
    expect(screen.getByTestId('sheet-custom-input')).toBeTruthy();
  });

  it('초기화 → 도시 entry 제거 + list 복귀', () => {
    act(() => {
      useTaxChoiceStore
        .getState()
        .setTaxChoice('vancouver', { kind: 'custom', annualSalary: 75000 });
    });
    renderSheet();
    fireEvent.press(screen.getByTestId('sheet-clear'));
    expect(useTaxChoiceStore.getState().choices.vancouver).toBeUndefined();
    expect(screen.queryByTestId('sheet-custom-input')).toBeNull();
  });

  // PR #25 3차 review — entries 부재 도시는 custom 행 자체를 노출하지 않고
  // 안내 문구로 대체 (silent failure 방지). takeHomePctApprox 차용 불가.
  it('cityTax 부재 → custom 행 미렌더 + 안내 문구 노출', () => {
    render(
      <TaxChoiceSheet
        visible
        onDismiss={jest.fn()}
        cityId="someCity"
        cityCurrency="USD"
        cityTax={undefined}
        fx={fx}
        testID="sheet"
      />,
    );
    expect(screen.queryByTestId('sheet-custom-row')).toBeNull();
    expect(screen.getByTestId('sheet-custom-disabled')).toBeTruthy();
    expect(
      screen.getByText('이 도시는 세율 데이터가 없어 직접 입력이 지원되지 않아요.'),
    ).toBeTruthy();
  });

  // PR #25 5차 review — entries=0 일 때 구분선이 빈 영역 위에 단독 렌더되는
  // 시각적 회귀 방지. entries>0 분기에서만 구분선이 노출되어야 한다.
  it('cityTax 부재 → 구분선 미렌더', () => {
    render(
      <TaxChoiceSheet
        visible
        onDismiss={jest.fn()}
        cityId="someCity"
        cityCurrency="USD"
        cityTax={undefined}
        fx={fx}
        testID="sheet"
      />,
    );
    expect(screen.queryByTestId('sheet-divider')).toBeNull();
  });

  it('cityTax entries 존재 → 구분선 렌더', () => {
    renderSheet();
    expect(screen.getByTestId('sheet-divider')).toBeTruthy();
  });

  // PR #25 6차 review — 영속화된 stale custom + entries=0 도시에서 사용자가
  // UI 로 stale 값을 제거할 수 있어야 한다 (resolveTaxChoice null 인 silent
  // 상태에서도). custom 모드 진입 차단 + 안내 섹션의 clear 버튼.
  describe('entries=0 + stale custom (PR #25 6차 review)', () => {
    it('stale custom 이 있어도 list 모드 + 안내 섹션 진입 (custom 모드 차단)', () => {
      act(() => {
        useTaxChoiceStore
          .getState()
          .setTaxChoice('ghostCity', { kind: 'custom', annualSalary: 50000 });
      });
      render(
        <TaxChoiceSheet
          visible
          onDismiss={jest.fn()}
          cityId="ghostCity"
          cityCurrency="USD"
          cityTax={undefined}
          fx={fx}
          testID="sheet"
        />,
      );
      expect(screen.queryByTestId('sheet-custom-input')).toBeNull();
      expect(screen.getByTestId('sheet-custom-disabled')).toBeTruthy();
      expect(screen.getByTestId('sheet-clear-stale')).toBeTruthy();
    });

    it('clear-stale 버튼 → store 에서 도시 entry 제거', () => {
      act(() => {
        useTaxChoiceStore
          .getState()
          .setTaxChoice('ghostCity', { kind: 'custom', annualSalary: 50000 });
      });
      render(
        <TaxChoiceSheet
          visible
          onDismiss={jest.fn()}
          cityId="ghostCity"
          cityCurrency="USD"
          cityTax={undefined}
          fx={fx}
          testID="sheet"
        />,
      );
      fireEvent.press(screen.getByTestId('sheet-clear-stale'));
      expect(useTaxChoiceStore.getState().choices.ghostCity).toBeUndefined();
    });

    it('choice 미존재 + entries=0 → clear-stale 버튼 미렌더', () => {
      render(
        <TaxChoiceSheet
          visible
          onDismiss={jest.fn()}
          cityId="ghostCity"
          cityCurrency="USD"
          cityTax={undefined}
          fx={fx}
          testID="sheet"
        />,
      );
      expect(screen.queryByTestId('sheet-clear-stale')).toBeNull();
    });
  });
});
