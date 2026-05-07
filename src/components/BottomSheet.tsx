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

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SHEET_BACKDROP_COLOR } from '@/theme/tokens';

import { H3 } from './typography/Text';

export type BottomSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  children: React.ReactNode;
  testID?: string;
};

// PR #25 3차 review — iPhone X+ home indicator 영역 (~34pt) 보다 작은 24pt 만
// 두면 시트 마지막 항목이 indicator 에 가려질 수 있어 SafeAreaInsets bottom 을
// 추가로 적용. tailwind 의 pb-6 (24px) 은 minimum 으로 유지.
const SHEET_BOTTOM_PAD_MIN = 24;

export function BottomSheet({
  visible,
  onDismiss,
  title,
  children,
  testID,
}: BottomSheetProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, SHEET_BOTTOM_PAD_MIN);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      testID={testID}
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
          // PR #25 6차 review — RN 0.71+ 에서 pointerEvents View prop deprecated.
          // style.pointerEvents 권장 형식 사용.
          style={{ flex: 1, justifyContent: 'flex-end', pointerEvents: 'box-none' }}
        >
          <Pressable
            // 본체 탭은 dismiss 없음 — 빈 onPress 로 backdrop 으로 이벤트
            // 전파 차단. accessible=false 로 본체 자체는 보이지만 a11y tree
            // 에서 button 으로 잡히지 않도록.
            accessible={false}
            onPress={() => undefined}
          >
            <View
              // accessibilityViewIsModal — VoiceOver/TalkBack 이 시트 외부 요소를
              // 접근 트리에서 제외 (PR #25 4차 review). a11y 사용자가 modal
              // 컨텍스트만 탐색하도록.
              accessibilityViewIsModal
              className="bg-white rounded-t-[22px] px-screen-x pt-5"
              style={{ paddingBottom: bottomPad }}
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
