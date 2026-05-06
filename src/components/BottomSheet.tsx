/**
 * BottomSheet — 화면 하단에서 슬라이드 업되는 시트 컴포넌트.
 *
 * UI_GUIDE.md §시트 콘텐츠 사양: top corners radius 22, white bg, navy text.
 * 외부 영역 탭으로 dismiss + 명시적 닫기 (children 가 닫기 액션 포함).
 *
 * RN 내장 Modal 기반 (외부 sheet 라이브러리 비도입 — 디자인 토큰 유지 단순,
 * 추가 dep 없음).
 */

import * as React from 'react';

import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  View,
} from 'react-native';

import { SHEET_BACKDROP_COLOR } from '@/theme/tokens';

import { H3 } from './typography/Text';

export type BottomSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  children: React.ReactNode;
  testID?: string;
};

export function BottomSheet({
  visible,
  onDismiss,
  title,
  children,
  testID,
}: BottomSheetProps): React.ReactElement {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      {...(testID !== undefined ? { testID } : {})}
    >
      {/* Backdrop — 탭으로 dismiss */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="시트 닫기"
        onPress={onDismiss}
        style={{ flex: 1, backgroundColor: SHEET_BACKDROP_COLOR }}
        testID={testID !== undefined ? `${testID}-backdrop` : undefined}
      >
        {/* 시트 본체 — backdrop 위에 absolute, 본체 탭은 dismiss 안 함 */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end' }}
          pointerEvents="box-none"
        >
          <Pressable
            // 본체 탭은 dismiss 없음 — 빈 onPress 로 backdrop 으로 이벤트
            // 전파 차단. accessible=false 로 본체 자체는 보이지만 a11y tree
            // 에서 button 으로 잡히지 않도록.
            accessible={false}
            onPress={() => undefined}
          >
            <View
              className="bg-white rounded-t-[22px] px-screen-x pt-5 pb-6"
              testID={testID !== undefined ? `${testID}-body` : undefined}
            >
              <H3 color="navy" className="font-manrope-bold mb-4">
                {title}
              </H3>
              {children}
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
