import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Animated,
  Alert,
  PanResponder,
  LayoutChangeEvent,
  Keyboard,
  TouchableOpacity,
  Text,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FONT_DISPLAY, FONT_BODY } from '../theme/typography';
import AIDogIcon from './AIDogIcon';

interface ScoobyAIFABProps {
  initialPrompt?: string;
  inline?: boolean;
  bottomOffset?: number;
  leftOffset?: number;
  // Set when ai_chatbot is off but its fallback isn't "hide" — renders a
  // muted, non-navigating version instead of the real FAB.
  disabledFallback?: 'coming_soon' | 'unavailable';
}

const SIZE = 52;
const EDGE = 12;
// Keeps the button clear of the status bar and screen headers when dragged up.
const TOP_LIMIT = 96;
const IDLE_MS = 3500;
const STORAGE_KEY = 'ai_fab_position_v1';

type Side = 'left' | 'right';
interface SavedPosition {
  side: Side;
  // 0 = highest allowed spot, 1 = lowest (just above the tab bar). A ratio,
  // not pixels, so it stays valid across screen sizes and rotation.
  yRatio: number;
}

// A floating button for the AI chat assistant. It used to sit at a fixed
// spot above the tab bar, which meant it always covered something as the
// screen scrolled behind it (a card's text, the Sign Out button). Now it can
// be dragged anywhere: on release it snaps to the nearest screen edge and
// remembers where it was left. A tap still opens the chat, and it fades
// back after a few idle seconds so it covers less.
export function ScoobyAIFAB({
  initialPrompt,
  inline = false,
  bottomOffset = 96,
  leftOffset = EDGE,
  disabledFallback,
}: ScoobyAIFABProps) {
  const navigation = useNavigation<any>();
  const [keyboardVisible, setKeyboardVisible] = useState(Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const [area, setArea] = useState<{ w: number; h: number } | null>(null);
  const [saved, setSaved] = useState<SavedPosition | null>(null);
  const [loadedSaved, setLoadedSaved] = useState(false);

  const pos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const scale = useRef(new Animated.Value(1)).current;
  const dim = useRef(new Animated.Value(1)).current;
  const dragStart = useRef({ x: 0, y: 0 });
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as SavedPosition;
        if ((parsed.side === 'left' || parsed.side === 'right') && typeof parsed.yRatio === 'number') {
          setSaved(parsed);
        }
      })
      .catch(() => {})
      .finally(() => setLoadedSaved(true));
  }, []);

  const bounds = useMemo(() => {
    if (!area) return null;
    const minY = TOP_LIMIT;
    const maxY = Math.max(minY, area.h - bottomOffset - SIZE);
    return { minY, maxY, leftX: leftOffset, rightX: area.w - SIZE - EDGE };
  }, [area, bottomOffset, leftOffset]);

  const wake = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    Animated.timing(dim, { toValue: 1, duration: 120, useNativeDriver: true }).start();
    idleTimer.current = setTimeout(() => {
      Animated.timing(dim, { toValue: 0.8, duration: 400, useNativeDriver: true }).start();
    }, IDLE_MS);
  }, [dim]);

  useEffect(() => {
    wake();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [wake]);

  // Place the button once the area is measured and any saved spot is read
  // (default: bottom-left, as before), and again if the bounds change.
  useEffect(() => {
    if (!bounds || !loadedSaved) return;
    const side: Side = saved?.side ?? 'left';
    const ratio = saved?.yRatio ?? 1;
    pos.setValue({
      x: side === 'left' ? bounds.leftX : bounds.rightX,
      y: bounds.minY + ratio * (bounds.maxY - bounds.minY),
    });
  }, [bounds, loadedSaved, saved, pos]);

  const openChat = useCallback(() => {
    if (disabledFallback) {
      Alert.alert(
        disabledFallback === 'coming_soon' ? 'Coming Soon' : 'Temporarily Unavailable',
        disabledFallback === 'coming_soon'
          ? "The AI Nutrition Coach isn't available yet — check back soon!"
          : 'The AI Nutrition Coach is temporarily unavailable. Please check back later.'
      );
      return;
    }
    navigation.navigate('Chatbot', { initialQuery: initialPrompt });
  }, [disabledFallback, navigation, initialPrompt]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          wake();
          // @ts-ignore — _value is the current resolved value of the ValueXY.
          dragStart.current = { x: pos.x._value, y: pos.y._value };
          Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 24 }).start();
        },
        onPanResponderMove: (_, g) => {
          if (!bounds) return;
          const x = Math.min(bounds.rightX, Math.max(bounds.leftX, dragStart.current.x + g.dx));
          const y = Math.min(bounds.maxY, Math.max(bounds.minY, dragStart.current.y + g.dy));
          pos.setValue({ x, y });
        },
        onPanResponderRelease: (_, g) => {
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 24 }).start();
          wake();
          if (!bounds) return;
          if (Math.abs(g.dx) < 8 && Math.abs(g.dy) < 8) {
            openChat();
            return;
          }
          const x = Math.min(bounds.rightX, Math.max(bounds.leftX, dragStart.current.x + g.dx));
          const y = Math.min(bounds.maxY, Math.max(bounds.minY, dragStart.current.y + g.dy));
          const side: Side = x + SIZE / 2 < (bounds.leftX + bounds.rightX + SIZE) / 2 ? 'left' : 'right';
          Animated.spring(pos, {
            toValue: { x: side === 'left' ? bounds.leftX : bounds.rightX, y },
            useNativeDriver: false,
            friction: 7,
            tension: 90,
          }).start();
          const yRatio = bounds.maxY === bounds.minY ? 1 : (y - bounds.minY) / (bounds.maxY - bounds.minY);
          const next: SavedPosition = { side, yRatio };
          setSaved(next);
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        },
        onPanResponderTerminate: () => {
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 24 }).start();
        },
      }),
    [bounds, openChat, pos, scale, wake]
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea((prev) => (prev && prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  };

  if (inline) {
    return (
      <TouchableOpacity style={styles.inlineCard} onPress={openChat} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Open AI assistant">
        <AIDogIcon size={40} animated={false} />
        <View style={styles.inlineText}>
          <Text style={styles.inlineTitle}>Ask your AI assistant</Text>
          <Text style={styles.inlineSubtitle}>{disabledFallback === 'coming_soon' ? 'Coming soon' : disabledFallback === 'unavailable' ? 'Temporarily unavailable' : 'Nutrition and everyday pet care'}</Text>
        </View>
        <Text style={styles.inlineArrow} accessibilityElementsHidden importantForAccessibility="no">→</Text>
      </TouchableOpacity>
    );
  }
  if (keyboardVisible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={onLayout}>
      {bounds && loadedSaved ? (
        <Animated.View
          {...panResponder.panHandlers}
          style={[styles.floatingContainer, { transform: [{ translateX: pos.x }, { translateY: pos.y }] }]}
          accessible
          accessibilityRole="button"
          accessibilityHint="Drag to move this button"
          accessibilityLabel={
            disabledFallback
              ? `Hearth & One AI chat assistant — ${disabledFallback === 'coming_soon' ? 'coming soon' : 'temporarily unavailable'}`
              : 'Open Hearth & One AI chat assistant'
          }
          onAccessibilityTap={openChat}
        >
          {/* Position runs on the JS driver (it is set while dragging); the press
              scale and idle fade run natively. React Native will not mix the two
              on one view, so they live on separate nested views. */}
          <Animated.View style={{ opacity: dim, transform: [{ scale }] }}>
            <View style={[styles.outerCircle, disabledFallback && styles.outerCircleDisabled]}>
              <AIDogIcon size={SIZE - 8} animated={!disabledFallback} />
            </View>
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inlineCard: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#F3EADB', borderWidth: 1, borderColor: '#DFC49C', borderRadius: 20 },
  inlineText: { flex: 1 },
  inlineTitle: { fontSize: 15, fontFamily: FONT_DISPLAY, color: '#2C1810' },
  inlineSubtitle: { fontSize: 12, fontFamily: FONT_BODY, color: '#705B45', marginTop: 3 },
  inlineArrow: { fontSize: 22, color: '#976430' },
  floatingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 9997,
    shadowColor: '#2C1D11',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 8,
  },
  outerCircle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: '#CF9255', // Warm ochre caramel — same brand accent as FloatingCartBadge
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  outerCircleDisabled: {
    backgroundColor: '#A3A3A3',
    opacity: 0.7,
  },
});

export default ScoobyAIFAB;
