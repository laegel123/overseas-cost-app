/**
 * ErrorView — 3 variant (fatal / inline / screen) + 옵션 prop 동작 검증.
 *
 * 색상에만 의존하지 않는 3중 인코딩 (CLAUDE.md) — ⚠ prefix + 한국어 메시지
 * 기본 노출. detail 은 __DEV__ 한정 (jest 환경에서 true 가정).
 */

import * as React from 'react';

import { fireEvent, render, screen } from '@testing-library/react-native';

import { ErrorView } from '../ErrorView';

describe('ErrorView', () => {
  it('fatal — message + ⚠ prefix 표시 + 기본 retryLabel "다시 시작"', () => {
    const onRetry = jest.fn();
    render(
      <ErrorView
        variant="fatal"
        message="앱에서 오류가 발생했습니다."
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText('앱에서 오류가 발생했습니다.')).toBeTruthy();
    expect(screen.getByText('⚠')).toBeTruthy();
    expect(screen.getByLabelText('다시 시작')).toBeTruthy();
  });

  it('fatal — onRetry 미제공 시 CTA 미렌더', () => {
    render(<ErrorView variant="fatal" message="X" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('fatal — onRetry 호출 시 콜백 발화', () => {
    const onRetry = jest.fn();
    render(<ErrorView variant="fatal" message="X" onRetry={onRetry} />);

    fireEvent.press(screen.getByLabelText('다시 시작'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('fatal — detail 은 __DEV__ 에서 표시', () => {
    render(<ErrorView variant="fatal" message="X" detail="ERR_CODE_42" />);
    expect(screen.getByText('ERR_CODE_42')).toBeTruthy();
  });

  it('inline — 한 줄 배지 + 기본 retryLabel "다시 시도"', () => {
    const onRetry = jest.fn();
    render(
      <ErrorView
        variant="inline"
        message="데이터 갱신 실패"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText('데이터 갱신 실패')).toBeTruthy();
    expect(screen.getByLabelText('다시 시도')).toBeTruthy();
  });

  it('inline — onRetry 미제공 시 CTA 미렌더', () => {
    render(<ErrorView variant="inline" message="X" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('inline — detail 무시 (한 줄 배지에 추가 정보 X)', () => {
    render(<ErrorView variant="inline" message="X" detail="should-not-render" />);
    expect(screen.queryByText('should-not-render')).toBeNull();
  });

  it('screen — 비-fatal 레이아웃 + 기본 retryLabel "다시 시도"', () => {
    const onRetry = jest.fn();
    render(<ErrorView variant="screen" message="X" onRetry={onRetry} />);
    expect(screen.getByLabelText('다시 시도')).toBeTruthy();
  });

  it('screen — DEV 빌드에서 detail 표시', () => {
    render(<ErrorView variant="screen" message="X" detail="ERR_SCREEN" />);
    expect(screen.getByText('ERR_SCREEN')).toBeTruthy();
  });

  it('retryLabel 명시 → default 무시', () => {
    const onRetry = jest.fn();
    render(
      <ErrorView
        variant="fatal"
        message="X"
        retryLabel="재시도"
        onRetry={onRetry}
      />,
    );
    expect(screen.getByLabelText('재시도')).toBeTruthy();
    expect(screen.queryByLabelText('다시 시작')).toBeNull();
  });

  it('detail 미제공 + onRetry 미제공 → 메시지만 렌더', () => {
    render(<ErrorView variant="screen" message="단순 에러" />);
    expect(screen.getByText('단순 에러')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
