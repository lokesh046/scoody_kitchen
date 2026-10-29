import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Current on-screen keyboard height (0 when hidden). Android only: inside a
// Modal under edge-to-edge the window is not resized for the keyboard, and
// KeyboardAvoidingView's 'height' mode jumps the layout while it animates, so
// bottom sheets pad themselves by this value instead. iOS keeps using
// KeyboardAvoidingView's 'padding' mode and gets 0 here.
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}

// Height of the Android system navigation bar under edge-to-edge (0 elsewhere).
// Bottom-sheet modals add it to their bottom padding so their last button is not
// covered by the bar.
export function useNavBarInset(): number {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'android' ? insets.bottom : 0;
}
