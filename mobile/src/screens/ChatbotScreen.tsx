import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
  StatusBar,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Send,
  Sparkles,
  RotateCcw,
  PawPrint,
  Info,
  ShieldCheck,
  Square,
  Lock,
  ShoppingCart,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccessToken } from '../services/secureTokenStorage';
import { COLORS } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import { usePetStore } from '../store/petStore';
import { useCartStore } from '../store/cartStore';
import { BrandMedallion } from '../components/BrandLogo';
import { useResponsive } from '../hooks/useResponsive';
import { refreshAuthTokenSilently } from '../api/client';
import {
  streamChatMessage,
  fetchChatSessionHistory,
  clearChatSession,
  ChatMessage,
  ChatProduct,
} from '../api/chatbot';
import { Image } from 'expo-image';

const QUICK_PROMPTS = [
  '🫐 Can dogs eat blueberries?',
  '🍲 Transition to fresh cooked food?',
  '🩺 Best recipe for skin allergies?',
  '⚖️ Daily calorie needs for my dog',
  '🥦 Safe vegetables & toxic foods list',
];

// Helper to format timestamp like WhatsApp ("05:42 PM")
const formatTime = (isoOrDate?: string): string => {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  if (isNaN(d.getTime())) {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// WhatsApp Animated 3-Dot Typing Indicator Component
function TypingIndicator({ statusText }: { statusText?: string }) {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const createAnim = (val: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0.3,
            duration: 350,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const anim1 = createAnim(dot1, 0);
    const anim2 = createAnim(dot2, 180);
    const anim3 = createAnim(dot3, 360);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.typingContainer}>
      <View style={styles.assistantAvatarSmall}>
        <PawPrint size={14} color="#FFFFFF" />
      </View>
      <View style={styles.typingBubble}>
        <View style={styles.dotsRow}>
          <Animated.View style={[styles.dot, { opacity: dot1, transform: [{ scale: dot1 }] }]} />
          <Animated.View style={[styles.dot, { opacity: dot2, transform: [{ scale: dot2 }] }]} />
          <Animated.View style={[styles.dot, { opacity: dot3, transform: [{ scale: dot3 }] }]} />
        </View>
        <Text style={styles.typingText}>
          {statusText || 'Scooby is consulting veterinary ledger...'}
        </Text>
      </View>
    </View>
  );
}

// Formatter to render markdown-like **bold** text and lists nicely
const FormattedMessageText = memo(function FormattedMessageText({ text, isUser }: { text: string; isUser: boolean }) {
  const paragraphs = text.split('\n');

  return (
    <View style={styles.formattedContainer}>
      {paragraphs.map((paragraph, pIdx) => {
        const trimmed = paragraph.trim();
        if (!trimmed) {
          return <View key={`p-${pIdx}`} style={{ height: 6 }} />;
        }

        // Bullet point line
        const isBullet = trimmed.startsWith('•') || trimmed.startsWith('- ') || trimmed.startsWith('* ');
        const cleanLine = isBullet ? trimmed.replace(/^([•\-*]\s*)/, '') : trimmed;

        // Parse **bold** tokens
        const parts = cleanLine.split(/(\*\*.*?\*\*)/g);

        return (
          <View key={`p-${pIdx}`} style={isBullet ? styles.bulletRow : styles.paragraphRow}>
            {isBullet && (
              <Text style={[styles.bulletPoint, isUser ? styles.userBullet : styles.assistantBullet]}>
                •{' '}
              </Text>
            )}
            <Text style={[styles.messageText, isUser ? styles.userMessageText : styles.assistantMessageText]}>
              {parts.map((part, index) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  const boldContent = part.substring(2, part.length - 2);
                  return (
                    <Text
                      key={`part-${index}`}
                      style={[
                        styles.boldText,
                        isUser ? styles.userBoldText : styles.assistantBoldText,
                      ]}
                    >
                      {boldContent}
                    </Text>
                  );
                }
                return part;
              })}
            </Text>
          </View>
        );
      })}
    </View>
  );
});

// Tappable product cards the commerce agent attaches to a reply (e.g.
// "search products") so the user can jump straight to a product's detail
// view in Kitchen instead of just reading its name/price in prose.
const ProductSuggestionRow = memo(function ProductSuggestionRow({
  products,
  onSelectProduct,
}: {
  products: ChatProduct[];
  onSelectProduct: (product: ChatProduct) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.productRow}
      contentContainerStyle={styles.productRowContent}
    >
      {products.map((product) => (
        <TouchableOpacity
          key={product.id}
          style={styles.productCard}
          activeOpacity={0.85}
          onPress={() => onSelectProduct(product)}
        >
          {product.image_url ? (
            <Image source={{ uri: product.image_url }} style={styles.productCardImage} />
          ) : (
            <View style={styles.productCardImageFallback}>
              <ShoppingCart size={18} color={COLORS.brandGold} />
            </View>
          )}
          <Text style={styles.productCardName} numberOfLines={1}>
            {product.name}
          </Text>
          <Text style={styles.productCardPrice}>₹{Number(product.price).toFixed(0)}</Text>
          {product.in_stock === false && (
            <Text style={styles.productCardOutOfStock}>Out of stock</Text>
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
});

export default function ChatbotScreen({ navigation, route }: any) {
  const initialQuery: string | undefined = route?.params?.initialQuery;
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { getActivePet } = usePetStore();
  const activePet = getActivePet();
  const totalCartItems = useCartStore((state) => state.getTotalItems());

  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [streamingStatus, setStreamingStatus] = useState<string>('');
  const [stopStreamFn, setStopStreamFn] = useState<(() => void) | null>(null);

  const { isTablet } = useResponsive();
  const flatListRef = useRef<FlatList>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClose = () => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
    } else {
      navigation?.navigate('Home');
    }
  };

  const handleSelectProduct = useCallback(
    (product: ChatProduct) => {
      // Matches the existing deep-link convention KitchenScreen already
      // supports (see its `route.params.productId` effect), the same one
      // HomeScreen uses when a review card links back to its product.
      try {
        navigation.navigate('MainTabs', { screen: 'Shop', params: { productId: product.id } });
      } catch {
        navigation.navigate('Shop', { productId: product.id });
      }
    },
    [navigation]
  );

  // Initialize or restore session on mount
  useEffect(() => {
    const initSession = async () => {
      if (!user?.id) {
        return;
      }
      const token = await getAccessToken();
      const sidKey = `@scooby_chat_session_u${user.id}`;
      let sid = await AsyncStorage.getItem(sidKey);

      // Enforce strict u{user_id}_ session ownership
      if (!sid || !sid.startsWith(`u${user.id}_`)) {
        sid = `u${user.id}_mobile_${Date.now()}`;
        await AsyncStorage.setItem(sidKey, sid);
      }
      setSessionId(sid);

      // Load session history from chatbot backend with token
      try {
        const history = await fetchChatSessionHistory(sid, token);
        if (history && history.length > 0) {
          const formatted: ChatMessage[] = history.map((item, idx) => ({
            id: `hist_${idx}_${Date.now()}`,
            role: item.role === 'assistant' ? 'assistant' : 'user',
            content: item.content,
            timestamp: new Date().toISOString(),
          }));
          setMessages(formatted);
        } else {
          // Welcome message if fresh session
          const petGreeting = activePet
            ? ` I'm personalized for **${activePet.name}** (${activePet.breed || 'Dog'}, ${activePet.weight_kg ? activePet.weight_kg + 'kg' : 'companion'}).`
            : '';

          setMessages([
            {
              id: 'welcome_1',
              role: 'assistant',
              content: `Woof! I'm **Scooby AI**, your certified canine nutrition and veterinary health companion. 🐾${petGreeting}\n\nAsk me anything about fresh cooked recipes, canine allergies, safe foods, or symptoms!`,
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      } catch {
        // Fallback default greeting
        setMessages([
          {
            id: 'welcome_fallback',
            role: 'assistant',
            content: `Woof! I'm **Scooby AI**, your veterinary diet & wellness assistant. 🐾\n\nHow can I help your pup today?`,
            timestamp: new Date().toISOString(),
          },
        ]);
      }

      // If an initial query was passed in, auto-send it
      if (initialQuery && initialQuery.trim()) {
        setTimeout(() => {
          handleSendMessage(initialQuery.trim(), sid);
        }, 400);
      }
    };

    initSession();

    return () => {
      if (stopStreamFn) {
        stopStreamFn();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Auto-scroll to bottom on message updates. Coalesces bursts of calls
  // (e.g. one per streamed token) into a single pending scroll.
  const scrollToBottom = () => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      scrollTimeoutRef.current = null;
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleClearHistory = () => {
    Alert.alert(
      'Clear Conversation',
      'Are you sure you want to reset this chat with Scooby?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            const token = await getAccessToken();
            if (sessionId) {
              await clearChatSession(sessionId, token);
            }
            if (user?.id) {
              const sidKey = `@scooby_chat_session_u${user.id}`;
              const newSid = `u${user.id}_mobile_${Date.now()}`;
              await AsyncStorage.setItem(sidKey, newSid);
              setSessionId(newSid);
            }
            setMessages([
              {
                id: `fresh_${Date.now()}`,
                role: 'assistant',
                content: `Chat cleared! Ready for new questions about your dog's diet and health. 🐾`,
                timestamp: new Date().toISOString(),
              },
            ]);
          },
        },
      ]
    );
  };

  const handleSendMessage = async (customMessage?: string, targetSessionId?: string) => {
    const messageToSend = (customMessage || inputText).trim();
    if (!messageToSend || isSending) return;

    const currentSid = targetSessionId || sessionId;
    if (!currentSid) return;

    // Append active pet context to message if available to inform the AI
    let finalQuery = messageToSend;
    if (activePet && !messageToSend.toLowerCase().includes(activePet.name.toLowerCase())) {
      finalQuery = `[Context: Active Companion is ${activePet.name}, Breed: ${activePet.breed || 'Dog'}, Weight: ${activePet.weight_kg || 'unknown'}kg] ${messageToSend}`;
    }

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: messageToSend, // display clean message to user
      timestamp: new Date().toISOString(),
    };

    const assistantPlaceholderId = `asst_${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantPlaceholderId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
      statusText: 'Scooby is consulting veterinary ledger...',
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInputText('');
    setIsSending(true);
    setStreamingStatus('Consulting canine nutrition knowledge base...');
    scrollToBottom();

    // Streaming response with progressive updates
    let token = await getAccessToken();
    if (!token) {
      token = await refreshAuthTokenSilently();
    }

    let accumulatedContent = '';
    let sourcesReceived: string[] = [];
    let productsReceived: ChatProduct[] = [];

    // Streamed tokens can arrive many times per second; coalesce them into
    // one state update per flush interval instead of one per token, which
    // otherwise forces a full re-render (and message-list re-diff) per token.
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let flushScheduled = false;

    const flushContent = () => {
      flushScheduled = false;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantPlaceholderId
            ? {
                ...msg,
                content: accumulatedContent,
                isStreaming: false,
                statusText: undefined,
              }
            : msg
        )
      );
      scrollToBottom();
    };

    const scheduleFlush = () => {
      if (flushScheduled) return;
      flushScheduled = true;
      flushTimer = setTimeout(flushContent, 60);
    };

    const cancelPendingFlush = () => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      flushScheduled = false;
    };

    const cleanup = streamChatMessage(
      finalQuery,
      currentSid,
      (newToken) => {
        accumulatedContent += newToken;
        scheduleFlush();
      },
      (status) => {
        setStreamingStatus(status);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantPlaceholderId
              ? { ...msg, statusText: status }
              : msg
          )
        );
      },
      (sources) => {
        sourcesReceived = sources;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantPlaceholderId
              ? { ...msg, sources }
              : msg
          )
        );
      },
      (errorDetail) => {
        cancelPendingFlush();
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantPlaceholderId
              ? {
                  ...msg,
                  content:
                    accumulatedContent ||
                    `⚠️ ${errorDetail || 'Scooby AI service temporarily unreachable. Please check your connection.'}`,
                  isStreaming: false,
                  statusText: undefined,
                }
              : msg
          )
        );
      },
      () => {
        cancelPendingFlush();
        setIsSending(false);
        setStreamingStatus('');
        setStopStreamFn(null);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantPlaceholderId
              ? {
                  ...msg,
                  content: accumulatedContent || msg.content || 'Woof! Could not produce an answer.',
                  isStreaming: false,
                  statusText: undefined,
                  sources: sourcesReceived.length > 0 ? sourcesReceived : msg.sources,
                  products: productsReceived.length > 0 ? productsReceived : msg.products,
                }
              : msg
          )
        );
        scrollToBottom();
      },
      token,
      (products) => {
        productsReceived = products;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantPlaceholderId ? { ...msg, products } : msg
          )
        );
      }
    );

    setStopStreamFn(() => () => {
      cancelPendingFlush();
      cleanup();
    });
  };

  const renderMessageItem = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';

    // When assistant message is empty and still waiting for tokens
    if (!isUser && (!item.content || item.content.trim() === '') && item.isStreaming) {
      return <TypingIndicator statusText={item.statusText || streamingStatus} />;
    }

    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.userMessageRow : styles.assistantMessageRow,
        ]}
      >
        {/* Assistant Avatar on Left (WhatsApp style) */}
        {!isUser && (
          <BrandMedallion size="xs" style={{ marginRight: 6 }} />
        )}

        {/* WhatsApp Chat Bubble */}
        <View
          style={[
            styles.bubble,
            isUser ? styles.userBubble : styles.assistantBubble,
          ]}
        >
          {/* Assistant Sender Name Pill */}
          {!isUser && (
            <View style={styles.assistantHeaderRow}>
              <Text style={styles.assistantSenderName}>Scooby AI</Text>
              <View style={styles.verifiedPill}>
                <ShieldCheck size={11} color={COLORS.forestGreen} />
                <Text style={styles.verifiedText}>Vet Verified</Text>
              </View>
            </View>
          )}

          {/* Formatted Text Content */}
          <FormattedMessageText text={item.content} isUser={isUser} />

          {/* Pinecone RAG Source Citations */}
          {!isUser && item.sources && item.sources.length > 0 && (
            <View style={styles.sourcesContainer}>
              <View style={styles.sourcesHeader}>
                <Info size={11} color={COLORS.brandGold} />
                <Text style={styles.sourcesTitle}>Verified Knowledge Sources:</Text>
              </View>
              {item.sources.slice(0, 2).map((source, sIdx) => (
                <View key={`src-${sIdx}`} style={styles.sourcePill}>
                  <Text style={styles.sourcePillText} numberOfLines={1}>
                    📚 {source.trim()}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Tappable Product Suggestions */}
          {!isUser && item.products && item.products.length > 0 && (
            <ProductSuggestionRow products={item.products} onSelectProduct={handleSelectProduct} />
          )}

          {/* Bubble Metadata (Timestamp) */}
          <View style={[styles.metaRow, isUser ? styles.userMetaRow : styles.assistantMetaRow]}>
            <Text style={[styles.timeText, isUser ? styles.userTimeText : styles.assistantTimeText]}>
              {formatTime(item.timestamp)}
            </Text>
          </View>
        </View>
      </View>
    );
  }, [streamingStatus, handleSelectProduct]);

  return (
    <View style={styles.phoneContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#1F3A2B" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.flexFill}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          {/* WhatsApp-Style Dark Green Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.backButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <ArrowLeft size={22} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Scooby Avatar with Active Green Status Dot */}
            <View style={styles.avatarContainer}>
              <BrandMedallion size="sm" />
              <View style={styles.onlineBadge} />
            </View>

            {/* Title & Subtitle Info */}
            <View style={styles.headerInfo}>
              <View style={styles.headerTitleRow}>
                <Text style={styles.headerTitle}>Scooby AI Nutritionist</Text>
                <Sparkles size={14} color="#F6D365" />
              </View>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {isSending
                  ? 'typing...'
                  : activePet
                  ? `🐾 Companion: ${activePet.name} (${activePet.breed || 'Dog'})`
                  : 'online • Veterinary Knowledge AI'}
              </Text>
            </View>

            {/* Header Cart Badge with Item Count (redirects to Cart) */}
            {totalCartItems > 0 && (
              <TouchableOpacity
                onPress={() => {
                  try {
                    navigation.navigate('MainTabs', { screen: 'Cart' });
                  } catch {
                    navigation.navigate('Cart');
                  }
                }}
                style={styles.headerCartBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.85}
              >
                <View style={styles.headerCartOuterCircle}>
                  <View style={styles.headerCartInnerRing}>
                    <ShoppingCart size={15} color="#362820" strokeWidth={2.4} />
                  </View>
                  <View style={styles.headerCartBadge}>
                    <Text style={styles.headerCartBadgeText}>{totalCartItems}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}

            {/* Reset / Clear Chat Button */}
            <TouchableOpacity
              onPress={handleClearHistory}
              style={styles.headerActionBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <RotateCcw size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Auth Gate Screen for Unauthenticated Visitors */}
          {!user?.id ? (
            <View style={styles.authGateContainer}>
              <View style={styles.authGateCard}>
                <View style={styles.authLockIcon}>
                  <Lock size={32} color={COLORS.forestGreen} strokeWidth={2.2} />
                </View>
                <Text style={styles.authGateTitle}>Sign In to Consult Scooby AI</Text>
                <Text style={styles.authGateSubtitle}>
                  Certified canine nutrition and veterinary health advice is strictly personalized to registered pet parents to protect your account and ensure certified recommendations.
                </Text>
                <TouchableOpacity
                  style={styles.authGateBtn}
                  onPress={handleClose}
                  activeOpacity={0.85}
                >
                  <Text style={styles.authGateBtnText}>Sign In / Register</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            // On a tablet, a full-width chat canvas stretches message bubbles
            // to 700+dp — a stretched phone layout, not a tablet one. Capping
            // and centering the conversation column (the same shape WhatsApp/
            // Messages use on iPad) keeps bubbles at a comfortable reading
            // width instead of just scaling the phone layout wider.
            <View style={[styles.flexFill, isTablet && styles.tabletContentColumn]}>
              {/* Active Pet Context Banner */}
              {activePet && (
                <View style={styles.petContextBanner}>
                  <Text style={styles.petContextText}>
                    🐶 Advice tailored for{' '}
                    <Text style={styles.petContextBold}>{activePet.name}</Text>
                    {activePet.weight_kg ? ` (${activePet.weight_kg}kg)` : ''}
                  </Text>
                </View>
              )}

              {/* WhatsApp Chat Canvas */}
              <View style={styles.chatCanvas}>
                {/* Center Date Separator */}
                <View style={styles.dateSeparator}>
                  <Text style={styles.dateSeparatorText}>
                    CANINE HEALTH & NUTRITION ASSISTANT • AI POWERED
                  </Text>
                </View>

                {/* Messages FlatList */}
                <FlatList
                  ref={flatListRef}
                  data={messages}
                  keyExtractor={(item) => item.id}
                  renderItem={renderMessageItem}
                  contentContainerStyle={styles.listContent}
                  onContentSizeChange={scrollToBottom}
                  onLayout={scrollToBottom}
                  showsVerticalScrollIndicator={false}
                  initialNumToRender={15}
                  maxToRenderPerBatch={10}
                  windowSize={10}
                  removeClippedSubviews={Platform.OS === 'android'}
                />
              </View>

              {/* Quick Suggestion Chips Carousel */}
              <View style={styles.chipsWrapper}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsScroll}
                >
                  {QUICK_PROMPTS.map((prompt, idx) => (
                    <TouchableOpacity
                      key={`prompt-${idx}`}
                      style={styles.chipPill}
                      onPress={() => handleSendMessage(prompt)}
                      disabled={isSending}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.chipText}>{prompt}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* WhatsApp Input Bar */}
              <View
                style={[
                  styles.inputBar,
                  { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 10) },
                ]}
              >
                <View style={styles.inputPillContainer}>
                  <View style={styles.inputLeftIcon}>
                    <PawPrint size={18} color={COLORS.forestGreen} />
                  </View>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ask Scooby about diet, symptoms, recipes..."
                    placeholderTextColor="#8696A0"
                    value={inputText}
                    onChangeText={setInputText}
                    multiline
                    maxLength={600}
                    onSubmitEditing={() => handleSendMessage()}
                    blurOnSubmit={false}
                  />
                </View>

                {/* Circular WhatsApp Send / Stop Button */}
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    inputText.trim().length > 0 || isSending ? styles.sendButtonActive : styles.sendButtonInactive,
                  ]}
                  onPress={() => {
                    if (isSending && stopStreamFn) {
                      stopStreamFn();
                      setIsSending(false);
                    } else {
                      handleSendMessage();
                    }
                  }}
                  disabled={!isSending && inputText.trim().length === 0}
                  activeOpacity={0.8}
                >
                  {isSending ? (
                    <Square size={16} color="#FFFFFF" fill="#FFFFFF" />
                  ) : (
                    <Send size={18} color="#FFFFFF" style={{ marginLeft: 2 }} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  phoneContainer: {
    flex: 1,
    backgroundColor: '#1F3A2B',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#1F3A2B',
  },
  flexFill: { flex: 1 },
  // Caps the conversation column on tablets instead of stretching message
  // bubbles across the full window width — the header above stays full-bleed.
  tabletContentColumn: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  // WhatsApp Header
  header: {
    backgroundColor: '#1F3A2B',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2B4D3B',
  },
  backButton: {
    padding: 6,
    marginRight: 6,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 10,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#25D366', // WhatsApp Active Green
    borderWidth: 2,
    borderColor: '#1F3A2B',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#D4E2D8',
    marginTop: 1,
    fontWeight: '500',
  },
  headerActionBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#2C4E3A',
  },
  headerCartBtn: {
    marginRight: 8,
  },
  headerCartOuterCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#CF9255',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#1A120B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  headerCartInnerRing: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  headerCartBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#362820',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  headerCartBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
    includeFontPadding: false,
  },
  // Pet Context Banner
  petContextBanner: {
    backgroundColor: '#EBE3D5',
    paddingVertical: 6,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#D8CDBA',
  },
  petContextText: {
    fontSize: 12,
    color: '#423326',
    fontWeight: '600',
  },
  petContextBold: {
    fontWeight: '800',
    color: COLORS.forestGreen,
  },
  // WhatsApp Chat Canvas (Doodle-like warm background)
  chatCanvas: {
    flex: 1,
    backgroundColor: '#EFEAE2', // WhatsApp Authentic Warm Wallpaper Tone
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 16,
  },
  dateSeparator: {
    alignSelf: 'center',
    backgroundColor: '#E1DACB',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 1,
    elevation: 1,
  },
  dateSeparatorText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#655B4E',
    letterSpacing: 0.5,
  },
  // Message Rows (Side by Side Method)
  messageRow: {
    marginVertical: 3,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  userMessageRow: {
    justifyContent: 'flex-end',
    marginLeft: 48,
  },
  assistantMessageRow: {
    justifyContent: 'flex-start',
    marginRight: 40,
  },
  assistantAvatarSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.forestGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  // Message Bubbles
  bubble: {
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingTop: 7,
    paddingBottom: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  // USER BUBBLE (WhatsApp Light Green on the Right)
  userBubble: {
    backgroundColor: '#DCF8C6', // WhatsApp User Bubble Green
    borderTopRightRadius: 2,
    borderWidth: 0.5,
    borderColor: '#C7E5B3',
  },
  // ASSISTANT BUBBLE (Pure White on the Left)
  assistantBubble: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 2,
    borderWidth: 0.5,
    borderColor: '#E8E3DA',
  },
  assistantHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8,
  },
  assistantSenderName: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.forestGreen,
    letterSpacing: 0.2,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EFF6F1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.forestGreen,
  },
  // Text formatting
  formattedContainer: {
    marginTop: 1,
  },
  paragraphRow: {
    marginBottom: 2,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 3,
    paddingLeft: 2,
  },
  bulletPoint: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  userBullet: {
    color: '#213326',
  },
  assistantBullet: {
    color: COLORS.forestGreen,
  },
  messageText: {
    fontSize: 14.5,
    lineHeight: 20.5,
  },
  userMessageText: {
    color: '#111B21', // WhatsApp Dark message text
  },
  assistantMessageText: {
    color: '#1F2937',
  },
  boldText: {
    fontWeight: '800',
  },
  userBoldText: {
    color: '#0F2618',
  },
  assistantBoldText: {
    color: '#111827',
  },
  // Sources Citation Pills
  sourcesContainer: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F0EBE3',
  },
  sourcesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  sourcesTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.brandGold,
  },
  sourcePill: {
    backgroundColor: '#F9F6F0',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
    marginTop: 2,
    borderWidth: 0.5,
    borderColor: '#EAE1D4',
  },
  sourcePillText: {
    fontSize: 9.5,
    color: '#65574A',
    fontWeight: '600',
  },
  // Tappable Product Suggestion Cards
  productRow: {
    marginTop: 8,
  },
  productRowContent: {
    gap: 8,
    paddingRight: 4,
  },
  productCard: {
    width: 104,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 6,
    borderWidth: 1,
    borderColor: '#EAE1D4',
  },
  productCardImage: {
    width: '100%',
    height: 72,
    borderRadius: 7,
    backgroundColor: '#F9F6F0',
  },
  productCardImageFallback: {
    width: '100%',
    height: 72,
    borderRadius: 7,
    backgroundColor: '#F9F6F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productCardName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3A2E22',
    marginTop: 5,
  },
  productCardPrice: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.forestGreen,
    marginTop: 1,
  },
  productCardOutOfStock: {
    fontSize: 9,
    fontWeight: '700',
    color: '#B45309',
    marginTop: 1,
  },
  // Timestamp & Checkmarks
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 3,
    gap: 3,
  },
  userMetaRow: {
    alignSelf: 'flex-end',
  },
  assistantMetaRow: {
    alignSelf: 'flex-end',
  },
  timeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  userTimeText: {
    color: '#667781', // WhatsApp user time color
  },
  assistantTimeText: {
    color: '#8696A0', // WhatsApp assistant time color
  },
  // Typing Indicator
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 4,
    marginLeft: 2,
  },
  typingBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderTopLeftRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 0.5,
    borderColor: '#E8E3DA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1.5,
    elevation: 1,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
    backgroundColor: COLORS.forestGreen,
  },
  typingText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  // Quick Prompt Chips
  chipsWrapper: {
    backgroundColor: '#EFEAE2',
    paddingVertical: 6,
    borderTopWidth: 0.5,
    borderTopColor: '#E2DBD0',
  },
  chipsScroll: {
    paddingHorizontal: 10,
    gap: 8,
  },
  chipPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D8D0C3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 1,
    elevation: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.forestGreen,
  },
  // WhatsApp Input Bar
  inputBar: {
    backgroundColor: '#F0F2F5', // WhatsApp Bottom Bar Background
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  inputPillContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  inputLeftIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#111B21',
    maxHeight: 100,
    paddingVertical: 4,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  sendButtonActive: {
    backgroundColor: '#00A884', // WhatsApp Vibrant Green Send Button
  },
  sendButtonInactive: {
    backgroundColor: '#9DA8A2',
  },
  // Auth Gate Screen
  authGateContainer: {
    flex: 1,
    backgroundColor: '#EFEAE2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  authGateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2DBD0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    width: '100%',
    // Caps the card on tablets instead of stretching a centered prompt
    // edge-to-edge across the full window width.
    maxWidth: 420,
  },
  authLockIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  authGateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2C1810',
    marginBottom: 8,
    textAlign: 'center',
  },
  authGateSubtitle: {
    fontSize: 13,
    color: '#65574A',
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
  },
  authGateBtn: {
    backgroundColor: COLORS.forestGreen,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
    shadowColor: COLORS.forestDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  authGateBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
