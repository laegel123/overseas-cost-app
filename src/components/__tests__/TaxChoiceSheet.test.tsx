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
});
