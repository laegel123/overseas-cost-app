/**
 * ErrorView — 사용자 노출 에러 표시 컴포넌트.
 *
 * UI_GUIDE.md §빈/에러/로딩 상태 의 3가지 표현을 단일 컴포넌트로:
 *   - `fatal`: 전체 화면 (RootLayout 의 ErrorBoundary 가 사용 — 자식 트리 throw 시)
 *   - `inline`: 한 줄 경고 배지 (네트워크 실패 후 시드 fallback 시 상단 표시 — 후속 phase)
 *   - `screen`: 화면 단위 (스키마 실패 / 도시 not-found 등 — 후속 phase)
 *
 * 시각 인코딩은 색상 + 아이콘성 prefix(⚠) + 텍스트 3중 (CLAUDE.md — 색상에만
 * 의존하지 않음). 디자인 토큰 외 컬러 hex 직접 사용 금지 (CLAUDE.md CRITICAL).
 *
 * `detail` 은 `__DEV__` 한정 노출 — 운영 빌드는 사용자에게 코드 노출하지 않음.
 */

import * as React from 'react';

import { Pressable, Text, View } from 'react-native';

export type ErrorViewVariant = 'fatal' | 'inline' | 'screen';

export type ErrorViewProps = {
  variant: ErrorViewVariant;
  message: string;
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
};

function defaultRetryLabel(variant: ErrorViewVariant): string {
  return variant === 'fatal' ? '다시 시작' : '다시 시도';
}

export function ErrorView({
  variant,
  message,
  detail,
  onRetry,
  retryLabel,
}: ErrorViewProps): React.ReactElement {
  const label = retryLabel ?? defaultRetryLabel(variant);

  if (variant === 'inline') {
    return (
      <View
        accessibilityRole="alert"
        className="flex-row items-center bg-orange-tint px-screen-x py-2 gap-2"
      >
        <Text className="text-orange text-small font-semibold">⚠</Text>
        <Text className="flex-1 text-navy text-small">{message}</Text>
        {onRetry !== undefined && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={onRetry}
          >
            <Text className="text-orange text-small font-semibold">{label}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // fatal / screen 공통 레이아웃 — 차이는 padding/typography 만.
  const isFatal = variant === 'fatal';
  return (
    <View
      accessibilityRole="alert"
      className={
        isFatal
          ? 'flex-1 items-center justify-center bg-white px-screen-x'
          : 'items-center justify-center bg-white px-screen-x py-12'
      }
    >
      <Text
        className={
          isFatal
            ? 'text-orange text-display font-extrabold'
            : 'text-orange text-h1 font-bold'
        }
      >
        ⚠
      </Text>
      <Text
        className={
          isFatal
            ? 'text-navy text-h1 font-bold mt-4 text-center'
            : 'text-navy text-h2 font-bold mt-3 text-center'
        }
      >
        {message}
      </Text>
      {detail !== undefined && __DEV__ && (
        <Text className="text-gray-2 text-small mt-2 text-center">{detail}</Text>
      )}
      {onRetry !== undefined && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onRetry}
          className="mt-6 bg-orange rounded-button px-6 py-3"
        >
          <Text className="text-white text-body font-semibold">{label}</Text>
        </Pressable>
      )}
    </View>
  );
}
