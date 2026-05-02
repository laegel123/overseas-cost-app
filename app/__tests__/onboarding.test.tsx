/**
 * Onboarding 화면 테스트 — screens step 4.
 *
 * 페르소나 3종 카드 표시 + 탭 시 persona store + router.replace.
 */

import * as React from 'react';

import { fireEvent, render, screen } from '@testing-library/react-native';

import OnboardingScreen from '../onboarding';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockSetPersona = jest.fn();
const mockSetOnboarded = jest.fn();
jest.mock('@/store', () => ({
  usePersonaStore: (selector: (s: { setPersona: jest.Mock; setOnboarded: jest.Mock }) => unknown) =>
    selector({ setPersona: mockSetPersona, setOnboarded: mockSetOnboarded }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('OnboardingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── UI 표시 ────────────────────────────────────────────────────────────

  it('3개 페르소나 카드 표시', () => {
    render(<OnboardingScreen />);

    expect(screen.getByTestId('persona-card-student')).toBeTruthy();
    expect(screen.getByTestId('persona-card-worker')).toBeTruthy();
    expect(screen.getByTestId('persona-card-unknown')).toBeTruthy();
  });

  it('페르소나 라벨 표시 (단일 출처)', () => {
    render(<OnboardingScreen />);

    expect(screen.getByText('유학생')).toBeTruthy();
    expect(screen.getByText('취업자')).toBeTruthy();
    expect(screen.getByText('미선택')).toBeTruthy();
  });

  it('페르소나 sub 표시 (단일 출처)', () => {
    render(<OnboardingScreen />);

    expect(screen.getByText('서울에서 출발 · 학비 중심')).toBeTruthy();
    expect(screen.getByText('서울에서 출발 · 실수령 중심')).toBeTruthy();
    expect(screen.getByText('둘 다 보여드려요')).toBeTruthy();
  });

  it('인사말 표시', () => {
    render(<OnboardingScreen />);

    expect(screen.getByText('안녕하세요')).toBeTruthy();
    expect(screen.getByText('어디로 떠나시나요?')).toBeTruthy();
  });

  it('푸터 안내문 표시', () => {
    render(<OnboardingScreen />);

    expect(screen.getByText('설정에서 언제든 변경할 수 있어요')).toBeTruthy();
  });

  it('질문 라벨 표시', () => {
    render(<OnboardingScreen />);

    expect(screen.getByText('어떤 분이신가요?')).toBeTruthy();
  });

  // ─── 인터랙션 ────────────────────────────────────────────────────────────

  it('student 카드 탭 → setPersona("student") + setOnboarded(true) + router.replace("/(tabs)")', () => {
    render(<OnboardingScreen />);

    fireEvent.press(screen.getByTestId('persona-card-student'));

    expect(mockSetPersona).toHaveBeenCalledWith('student');
    expect(mockSetOnboarded).toHaveBeenCalledWith(true);
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it('worker 카드 탭 → setPersona("worker") + setOnboarded(true) + router.replace("/(tabs)")', () => {
    render(<OnboardingScreen />);

    fireEvent.press(screen.getByTestId('persona-card-worker'));

    expect(mockSetPersona).toHaveBeenCalledWith('worker');
    expect(mockSetOnboarded).toHaveBeenCalledWith(true);
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it('unknown 카드 탭 → setPersona("unknown") + setOnboarded(true) + router.replace("/(tabs)")', () => {
    render(<OnboardingScreen />);

    fireEvent.press(screen.getByTestId('persona-card-unknown'));

    expect(mockSetPersona).toHaveBeenCalledWith('unknown');
    expect(mockSetOnboarded).toHaveBeenCalledWith(true);
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  // ─── 접근성 ────────────────────────────────────────────────────────────

  it('student 카드 accessibilityLabel', () => {
    render(<OnboardingScreen />);

    expect(screen.getByLabelText('유학생 선택')).toBeTruthy();
  });

  it('worker 카드 accessibilityLabel', () => {
    render(<OnboardingScreen />);

    expect(screen.getByLabelText('취업자 선택')).toBeTruthy();
  });

  it('unknown 카드 accessibilityLabel', () => {
    render(<OnboardingScreen />);

    expect(screen.getByLabelText('미선택 선택')).toBeTruthy();
  });
});
