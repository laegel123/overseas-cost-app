/**
 * docs/TESTING.md §9.20.5 — TuitionChoiceSheet (ADR-061).
 *
 * 도시 학교 목록 렌더 / preset 탭 시 store 갱신 + dismiss / 직접 입력 모드 전환 /
 * custom 저장 / 0 이하 입력 무시.
 */

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { useTuitionChoiceStore } from '@/store';
import type { CityCostData, ExchangeRates } from '@/types/city';

import { TuitionChoiceSheet } from '../TuitionChoiceSheet';

const tuition: NonNullable<CityCostData['tuition']> = [
  { school: 'Sorbonne', level: 'undergrad', annual: 3800 },
  { school: 'Sciences Po', level: 'undergrad', annual: 14500 },
];

const fx: ExchangeRates = { KRW: 1, EUR: 1500 };

beforeEach(() => {
  useTuitionChoiceStore.getState().reset();
});

function renderSheet(overrides?: { onDismiss?: jest.Mock }) {
  const onDismiss = overrides?.onDismiss ?? jest.fn();
  render(
    <TuitionChoiceSheet
      visible
      onDismiss={onDismiss}
      cityId="paris"
      cityCurrency="EUR"
      cityTuition={tuition}
      fx={fx}
      testID="sheet"
    />,
  );
  return { onDismiss };
}

describe('TuitionChoiceSheet', () => {
  it('학교 목록 렌더 + 직접 입력 행', () => {
    renderSheet();
    expect(screen.getByTestId('sheet-preset-Sorbonne')).toBeTruthy();
    expect(screen.getByTestId('sheet-preset-Sciences Po')).toBeTruthy();
    expect(screen.getByTestId('sheet-custom-row')).toBeTruthy();
  });

  it('preset 탭 → store 갱신 + onDismiss 호출', () => {
    const { onDismiss } = renderSheet();
    fireEvent.press(screen.getByTestId('sheet-preset-Sciences Po'));
    expect(useTuitionChoiceStore.getState().choices.paris).toEqual({
      kind: 'preset',
      school: 'Sciences Po',
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('직접 입력 행 탭 → custom 모드로 전환 (input 표시)', () => {
    renderSheet();
    fireEvent.press(screen.getByTestId('sheet-custom-row'));
    expect(screen.getByTestId('sheet-custom-input')).toBeTruthy();
    expect(screen.getByTestId('sheet-save')).toBeTruthy();
    expect(screen.getByTestId('sheet-back')).toBeTruthy();
  });

  it('custom 저장 → store 에 custom kind + onDismiss', () => {
    const { onDismiss } = renderSheet();
    fireEvent.press(screen.getByTestId('sheet-custom-row'));
    fireEvent.changeText(screen.getByTestId('sheet-custom-input'), '9000');
    fireEvent.press(screen.getByTestId('sheet-save'));
    expect(useTuitionChoiceStore.getState().choices.paris).toEqual({
      kind: 'custom',
      annual: 9000,
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('0 이하 입력 → save 무시 (store 변경 없음)', () => {
    const { onDismiss } = renderSheet();
    fireEvent.press(screen.getByTestId('sheet-custom-row'));
    fireEvent.changeText(screen.getByTestId('sheet-custom-input'), '0');
    fireEvent.press(screen.getByTestId('sheet-save'));
    expect(useTuitionChoiceStore.getState().choices.paris).toBeUndefined();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('빈 입력 → save 무시', () => {
    renderSheet();
    fireEvent.press(screen.getByTestId('sheet-custom-row'));
    fireEvent.changeText(screen.getByTestId('sheet-custom-input'), '');
    fireEvent.press(screen.getByTestId('sheet-save'));
    expect(useTuitionChoiceStore.getState().choices.paris).toBeUndefined();
  });

  it('숫자 아닌 입력 → save 무시', () => {
    renderSheet();
    fireEvent.press(screen.getByTestId('sheet-custom-row'));
    fireEvent.changeText(screen.getByTestId('sheet-custom-input'), 'abc');
    fireEvent.press(screen.getByTestId('sheet-save'));
    expect(useTuitionChoiceStore.getState().choices.paris).toBeUndefined();
  });

  it('← 학교 목록 탭 → list 모드로 복귀', () => {
    renderSheet();
    fireEvent.press(screen.getByTestId('sheet-custom-row'));
    expect(screen.getByTestId('sheet-custom-input')).toBeTruthy();
    fireEvent.press(screen.getByTestId('sheet-back'));
    expect(screen.queryByTestId('sheet-custom-input')).toBeNull();
    expect(screen.getByTestId('sheet-preset-Sorbonne')).toBeTruthy();
  });

  it('현재 선택이 preset 일 때 — 해당 행 selected 강조 (bg-orange)', () => {
    act(() => {
      useTuitionChoiceStore
        .getState()
        .setTuitionChoice('paris', { kind: 'preset', school: 'Sciences Po' });
    });
    renderSheet();
    const sciencesPo = screen.getByTestId('sheet-preset-Sciences Po');
    expect(sciencesPo.props.className).toContain('bg-orange');
    const sorbonne = screen.getByTestId('sheet-preset-Sorbonne');
    expect(sorbonne.props.className).not.toContain('bg-orange');
  });

  it('현재 선택이 custom 일 때 — 직접 입력 행 selected 강조 + 모드 = custom', () => {
    act(() => {
      useTuitionChoiceStore
        .getState()
        .setTuitionChoice('paris', { kind: 'custom', annual: 9000 });
    });
    renderSheet();
    // 시트가 처음부터 custom 모드로 진입 (effect 가 visible 변경 시 동기화).
    expect(screen.getByTestId('sheet-custom-input')).toBeTruthy();
  });

  it('초기화 버튼 → store 에서 도시 entry 제거 + list 모드 복귀', () => {
    act(() => {
      useTuitionChoiceStore
        .getState()
        .setTuitionChoice('paris', { kind: 'custom', annual: 9000 });
    });
    renderSheet();
    fireEvent.press(screen.getByTestId('sheet-clear'));
    expect(useTuitionChoiceStore.getState().choices.paris).toBeUndefined();
    expect(screen.queryByTestId('sheet-custom-input')).toBeNull();
  });

  it('cityTuition undefined + custom 저장 → 정상 (도시에 학교 없어도 직접 입력 가능)', () => {
    render(
      <TuitionChoiceSheet
        visible
        onDismiss={jest.fn()}
        cityId="paris"
        cityCurrency="EUR"
        cityTuition={undefined}
        fx={fx}
        testID="sheet"
      />,
    );
    // 빈 시트는 custom 행만 노출
    expect(screen.queryByTestId('sheet-preset-Sorbonne')).toBeNull();
    fireEvent.press(screen.getByTestId('sheet-custom-row'));
    fireEvent.changeText(screen.getByTestId('sheet-custom-input'), '5000');
    fireEvent.press(screen.getByTestId('sheet-save'));
    expect(useTuitionChoiceStore.getState().choices.paris).toEqual({
      kind: 'custom',
      annual: 5000,
    });
  });
});
