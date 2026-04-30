/**
 * ErrorBoundary — class component 패턴, AppError vs 외부 Error 메시지 분기,
 * reset 동작.
 */

import * as React from 'react';

import { Text } from 'react-native';

import { fireEvent, render, screen } from '@testing-library/react-native';

import { CityNotFoundError } from '@/lib/errors';

import { ErrorBoundary } from '../ErrorBoundary';

function Thrower({ error }: { error: Error | null }): React.ReactElement {
  if (error !== null) throw error;
  return <Text>OK</Text>;
}

describe('ErrorBoundary', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    // RN/React 가 boundary 동작 시 자체 콘솔 로그 출력 → 테스트 노이즈 차단.
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('자식 throw 없음 → children 렌더', () => {
    render(
      <ErrorBoundary>
        <Thrower error={null} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('OK')).toBeTruthy();
  });

  it('자식 throw → ErrorView fatal 표시 + 기본 메시지', () => {
    render(
      <ErrorBoundary>
        <Thrower error={new Error('boom')} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('알 수 없는 오류가 발생했습니다.')).toBeTruthy();
    expect(screen.getByLabelText('다시 시작')).toBeTruthy();
  });

  it('AppError throw → "앱에서 오류" 분기 + DEV detail 에 code 표시', () => {
    render(
      <ErrorBoundary>
        <Thrower error={new CityNotFoundError('도쿄')} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('앱에서 오류가 발생했습니다.')).toBeTruthy();
    expect(screen.getByText('CITY_NOT_FOUND')).toBeTruthy();
  });

  it('reset → 자식 다시 mount (에러 멎으면 정상 렌더)', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <Thrower error={new Error('boom')} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('알 수 없는 오류가 발생했습니다.')).toBeTruthy();

    // 자식의 throw 조건 제거 후 reset 누르기
    rerender(
      <ErrorBoundary>
        <Thrower error={null} />
      </ErrorBoundary>,
    );
    fireEvent.press(screen.getByLabelText('다시 시작'));

    expect(screen.getByText('OK')).toBeTruthy();
  });

  it('onError 콜백 — error + componentStack 정보 전달', () => {
    const onError = jest.fn();
    const err = new Error('boom');
    render(
      <ErrorBoundary onError={onError}>
        <Thrower error={err} />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBe(err);
    expect(onError.mock.calls[0][1]).toHaveProperty('componentStack');
  });
});
