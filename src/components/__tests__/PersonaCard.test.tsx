/**
 * PersonaCard — Onboarding 페르소나 선택 카드. TESTING.md §9.34.
 */

import * as React from 'react';

import { fireEvent, render, screen } from '@testing-library/react-native';

import { PersonaCard } from '@/components/PersonaCard';

describe('PersonaCard', () => {
  it('persona 라벨/sub 렌더 (단일 출처)', () => {
    render(<PersonaCard persona="student" variant="primary" onPress={jest.fn()} />);
    expect(screen.getByText('유학생')).toBeTruthy();
    expect(screen.getByText('서울에서 출발 · 학비 중심')).toBeTruthy();
  });

  it('primary variant — icon box 렌더', () => {
    render(<PersonaCard persona="student" variant="primary" onPress={jest.fn()} />);
    expect(screen.getByTestId('persona-card-student')).toBeTruthy();
  });

  it('secondary variant — icon box 렌더', () => {
    render(<PersonaCard persona="worker" variant="secondary" onPress={jest.fn()} />);
    expect(screen.getByText('취업자')).toBeTruthy();
  });

  it('tertiary variant — icon box 미렌더 (Small 라벨)', () => {
    render(<PersonaCard persona="unknown" variant="tertiary" onPress={jest.fn()} />);
    expect(screen.getByText('아직 모름')).toBeTruthy();
    expect(screen.getByText('둘 다 보여드려요')).toBeTruthy();
  });

  it('탭 → onPress 호출', () => {
    const onPress = jest.fn();
    render(<PersonaCard persona="student" variant="primary" onPress={onPress} />);
    fireEvent.press(screen.getByTestId('persona-card-student'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('accessibilityLabel = "{label} 선택"', () => {
    render(<PersonaCard persona="worker" variant="secondary" onPress={jest.fn()} />);
    expect(screen.getByLabelText('취업자 선택')).toBeTruthy();
  });
});
