/**
 * ErrorBoundary — React 의 표준 class component 패턴 (function/hook 미지원).
 *
 * ARCHITECTURE.md §에러 핸들링 전략 의 app 계층. RootLayout 의 자식 트리
 * throw 를 잡아 `<ErrorView fatal />` 표시 + 재시작 CTA. DEV 빌드는 RN 의
 * LogBox 가 먼저 잡으므로 추가 로그 없음 (ARCHITECTURE.md §247) — production
 * 빌드만 console.error 로 운영 가시성 확보 (CLAUDE.md silent fail 금지).
 *
 * "다시 시작" CTA = component-level reset (자식 트리 다시 mount). Expo managed
 * workflow 에는 native restart API 가 없고, 사이드 프로젝트 운영 정책상 별도
 * 의존성 도입 안 함.
 */

import * as React from 'react';

import { AppError } from '@/lib/errors';

import { ErrorView } from './ErrorView';

type Props = {
  children: React.ReactNode;
  onError?: (error: Error, info: React.ErrorInfo) => void;
};

type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    /* istanbul ignore if: __DEV__ 는 jest 환경에서 항상 true — production 분기는 운영 빌드 한정 */
    if (!__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
    this.props.onError?.(error, info);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  override render(): React.ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;

    const isAppError = error instanceof AppError;
    const message = isAppError
      ? '앱에서 오류가 발생했습니다.'
      : '알 수 없는 오류가 발생했습니다.';

    return (
      <ErrorView
        variant="fatal"
        message={message}
        {...(isAppError ? { detail: error.code } : {})}
        retryLabel="다시 시작"
        onRetry={this.reset}
      />
    );
  }
}
