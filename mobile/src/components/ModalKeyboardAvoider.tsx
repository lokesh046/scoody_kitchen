import React from 'react';
import { KeyboardAvoidingView, Platform, StyleProp, View, ViewStyle } from 'react-native';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';

// Wraps the contents of a bottom-sheet Modal so the sheet rises above the keyboard.
// iOS uses KeyboardAvoidingView's 'padding' mode. On Android a Modal window is not
// resized for the keyboard, and KeyboardAvoidingView's 'height' mode made the sheet
// jump and flicker, so the overlay is padded by the measured keyboard height instead.
export function ModalKeyboardAvoider({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const keyboardHeight = useKeyboardHeight();

  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView behavior="padding" style={style}>
        {children}
      </KeyboardAvoidingView>
    );
  }

  return <View style={[style, keyboardHeight > 0 && { paddingBottom: keyboardHeight }]}>{children}</View>;
}

export default ModalKeyboardAvoider;
