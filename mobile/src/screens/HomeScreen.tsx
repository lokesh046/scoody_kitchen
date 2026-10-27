import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import {
  Search,
  ShoppingBag,
  Bell,
  Sparkles,
  ArrowRight,
  Heart,
  Star,
  Plus,
  Minus,
  Stethoscope,
  PawPrint,
  ShieldCheck,
  Camera,
  UtensilsCrossed,
  ChevronRight,
  CheckCircle2,
  X,
} from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { FONT_DISPLAY, FONT_DISPLAY_SEMIBOLD, FONT_BODY, FONT_BODY_BOLD, FONT_HEADING_SCRIPT, LEDGER_MONO } from '../theme/typography';
import FAQSection from '../components/FAQSection';
import BlogPreviewSection from '../components/BlogPreviewSection';
import {
  BannerSlideItem,
  ProductFavoriteCard,
  ReviewCardItem,
  HERO_BANNERS,
  DEFAULT_DOG_IMAGES,
  homeCardStyles,
  type HeroBanner,
} from '../components/HomeCards';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { usePetStore } from '../store/petStore';
import { useTourStore } from '../store/tourStore';
import { fetchProducts } from '../api/products';
import { fetchActiveBanners } from '../api/banners';
import { fetchRecentReviews, UnifiedReview } from '../api/reviews';
import { Product } from '../types';
import PetVisionModal from '../components/PetVisionModal';
import AppTour, { TourStep } from '../components/AppTour';
import { NotificationModal } from '../components/NotificationModal';
import { BrandHeader } from '../components/BrandLogo';
import { fetchUnreadCount } from '../api/notifications';
import { BASE_URL } from '../api/client';
import { useResponsive } from '../hooks/useResponsive';
import { useFeatureFlag, useFeatureFlagFallback } from '../hooks/useFeatureFlag';
import ResponsiveContainer from '../components/ResponsiveContainer';
import { ToolIcon } from '../components/ToolIcon';
import { WhyHearthSection } from '../components/WhyHearthSection';
import { HearthHoundSection } from '../components/HearthHoundSection';

interface CoreService {
  id: string;
  title: string;
  desc: string;
  image: any;
  actionType: 'navigate' | 'vision' | 'chatbot';
  target?: string;
}

const CORE_SERVICES: CoreService[] = [
  {
    id: 'kitchen',
    title: 'Shop Recipes',
    desc: 'Small-batch, human-grade recipes, blast-frozen for freshness.',
    image: require('../../assets/toolkit/shop-recipes.webp'),
    actionType: 'navigate',
    target: 'Shop',
  },
  {
    id: 'telehealth',
    title: 'Vet Consults',
    desc: 'Certified holistic doctors online for video diet consultations.',
    image: require('../../assets/toolkit/vet-3d.webp'),
    actionType: 'navigate',
    target: 'Consult',
  },
  {
    id: 'pets',
    title: 'Know Your Pet',
    desc: 'Manage medical history, vaccination calendar & allergy flags.',
    image: require('../../assets/toolkit/pet-3d.webp'),
    actionType: 'navigate',
    target: 'Pets',
  },
];

const REVIEW_CARD_WIDTH = 224;
const REVIEW_CARD_GAP = 14;
const REVIEW_STRIDE = REVIEW_CARD_WIDTH + REVIEW_CARD_GAP;

export default function HomeScreen({ navigation }: any) {
  const isFocused = useIsFocused();
  const { user } = useAuthStore();
  const { pets } = usePetStore();
  const { items, addItem, updateQuantity, removeItem, getTotalItems } = useCartStore();

  const isMealPlannerEnabled = useFeatureFlag('shop_meal_planner', true);
  const isKnowYourPetEnabled = useFeatureFlag('pets_know_your_pet', true);
  // Mirrors web's HomePage: the Shop/Consult tabs are gated behind these same
  // flags (see TabNavigator), but Home's own recipe cards and vet CTA had no
  // matching check — letting someone add to cart or book a vet consult here
  // even while both were flagged off everywhere else in the app.
  const isShopEnabled = useFeatureFlag('shop_checkout', true);
  const isConsultationsEnabled = useFeatureFlag('consultations_booking', true);
  const shopFallback = useFeatureFlagFallback('shop_checkout');
  const consultationsFallback = useFeatureFlagFallback('consultations_booking');
  // The Add button itself always shows a disabled state when ordering is
  // off, whatever the fallback — 'hide' only applies to secondary elements
  // like the "View Full Product Ledger" link below, never to leaving the
  // purchase action silently tappable-but-broken.
  const shopDisabledLabel = isShopEnabled
    ? undefined
    : shopFallback === 'coming_soon'
    ? 'Coming Soon'
    : shopFallback === 'unavailable'
    ? 'Unavailable'
    : 'Ordering Unavailable';

  const [banners, setBanners] = useState<HeroBanner[]>(HERO_BANNERS);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(true);
  // True only when the very first load came back empty or failed — a later
  // background refresh returning nothing doesn't retroactively invalidate
  // real products we're already successfully showing.
  const [productsLoadFailed, setProductsLoadFailed] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeBannerIndex, setActiveBannerIndex] = useState<number>(0);
  const [petVisionVisible, setPetVisionVisible] = useState<boolean>(false);
  const [reviews, setReviews] = useState<UnifiedReview[]>([]);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'product' | 'doctor'>('all');
  const [selectedReviewModal, setSelectedReviewModal] = useState<UnifiedReview | null>(null);
  const [favoriteHearts, setFavoriteHearts] = useState<{ [key: number]: boolean }>({ 101: true });
  const [notificationModalVisible, setNotificationModalVisible] = useState<boolean>(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [liveToast, setLiveToast] = useState<{ title: string; message: string } | null>(null);

  const bannerListRef = useRef<FlatList>(null);
  const autoPlayTimerRef = useRef<any>(null);
  const currentIndexRef = useRef<number>(1);

  const reviewListRef = useRef<FlatList>(null);
  const reviewAutoPlayTimerRef = useRef<any>(null);
  const reviewCurrentIndexRef = useRef<number>(0);
  const isReviewDraggingRef = useRef<boolean>(false);
  // Gates the reviews carousel's autoplay: the hero banner already autoplays
  // above the fold, so the reviews carousel — which the user hasn't
  // scrolled to yet — shouldn't also be silently auto-advancing behind the
  // scenes. It only starts once the section has actually entered view.
  const [reviewsSectionSeen, setReviewsSectionSeen] = useState<boolean>(false);
  const reviewsSectionYRef = useRef<number>(Infinity);

  // Everything below the hero banner (sections 5-11: services grid, vision
  // scanner, favorites, telehealth, reviews, badges, quick links, footer)
  // mounts one tick after the initial frame instead of all at once — the
  // first paint only has to produce what's actually visible above the fold.
  const [belowFoldReady, setBelowFoldReady] = useState<boolean>(false);
  useEffect(() => {
    // InteractionManager is deprecated in this RN version in favor of
    // requestIdleCallback — but it isn't guaranteed to exist in every RN/JS
    // engine, so fall back to a same-effect setTimeout(0) where it's missing.
    const ric: typeof requestIdleCallback | undefined = (globalThis as any).requestIdleCallback;
    const cic: typeof cancelIdleCallback | undefined = (globalThis as any).cancelIdleCallback;
    if (typeof ric === 'function') {
      const id = ric(() => setBelowFoldReady(true));
      return () => cic?.(id);
    }
    const timer = setTimeout(() => setBelowFoldReady(true), 0);
    return () => clearTimeout(timer);
  }, []);
  const toastTimerRef = useRef<any>(null);

  // First-run coach-mark tour (see AppTour.tsx) — targets two real elements
  // already on this screen rather than a separate tutorial mode.
  const recipesSectionRef = useRef<View>(null);
  const vetCardRef = useRef<View>(null);
  const hasSeenHomeTour = useTourStore((s) => s.hasSeenHomeTour);
  const hasLoadedTourFlag = useTourStore((s) => s.hasLoadedSeenFlag);
  const loadTourSeenFlag = useTourStore((s) => s.loadSeenFlag);
  const startTour = useTourStore((s) => s.startTour);
  const isTourActive = useTourStore((s) => s.isTourActive);
  const endTour = useTourStore((s) => s.endTour);
  const tourSteps = useMemo<TourStep[]>(
    () => [
      {
        icon: PawPrint,
        title: 'Welcome to Hearth & One',
        description:
          'A 20-second look at what makes us different: total ingredient transparency, backed by real veterinary guidance.',
      },
      {
        targetRef: recipesSectionRef,
        icon: ShieldCheck,
        title: 'See exactly what’s inside',
        description:
          'Every recipe lists precise ingredient percentages — real meat, real vegetables, zero mystery fillers.',
      },
      {
        targetRef: vetCardRef,
        icon: Stethoscope,
        title: 'Vet-backed, always',
        description:
          'Every recipe is formulated with veterinary guidance, and certified vets are a tap away whenever you need advice.',
      },
      {
        icon: PawPrint,
        title: 'You’re all set!',
        description: 'Explore recipes, meet our vets, and give your pup the transparency they deserve.',
      },
    ],
    []
  );

  useEffect(() => {
    loadTourSeenFlag();
  }, [loadTourSeenFlag]);

  useEffect(() => {
    if (!hasLoadedTourFlag || hasSeenHomeTour) return;
    const timer = setTimeout(() => startTour(), 500);
    return () => clearTimeout(timer);
  }, [hasLoadedTourFlag, hasSeenHomeTour, startTour]);

  // The tour's spotlighted elements (e.g. "Find a Vet") are genuinely
  // tappable, so a real interaction can navigate away from Home mid-tour.
  // Tabs stay mounted when unfocused, so without this the overlay would
  // otherwise keep running invisibly and reappear on return to Home.
  useEffect(() => {
    if (!isFocused && isTourActive) endTour();
  }, [isFocused, isTourActive, endTour]);

  // Cart item Map for O(1) quantity check per card instead of O(N) .find
  const cartMap = useMemo(() => {
    const map = new Map<number, { id: number; quantity: number }>();
    for (let i = 0; i < items.length; i++) {
      map.set(items[i].product_id, { id: items[i].id, quantity: items[i].quantity });
    }
    return map;
  }, [items]);

  // Review category count memoization
  const productReviewsCount = useMemo(
    () => reviews.filter((r) => r.type === 'product').length,
    [reviews]
  );
  const doctorReviewsCount = useMemo(
    () => reviews.filter((r) => r.type === 'doctor').length,
    [reviews]
  );
  const overallReviewRating = useMemo(() => {
    if (reviews.length === 0) return null;
    return (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1);
  }, [reviews]);

  // Infinite Loop Clone Array: [lastClone, ...banners, firstClone]
  const extendedBanners = useMemo(() => {
    if (banners.length <= 1) return banners;
    const firstClone: HeroBanner = {
      ...banners[0],
      id: `${banners[0].id}-infinite-tail`,
    };
    const lastClone: HeroBanner = {
      ...banners[banners.length - 1],
      id: `${banners[banners.length - 1].id}-infinite-head`,
    };
    return [lastClone, ...banners, firstClone];
  }, [banners]);

  const totalCartCount = getTotalItems();
  const primaryPet = pets.length > 0 ? pets[0] : null;

  const { width: windowWidth, isTablet, contentWidth } = useResponsive();
  // ResponsiveContainer adds 24px of padding on each side on tablet, so the
  // carousel's real visible width is the container's content width minus that
  // padding, not the raw screen width — otherwise slides render wider than
  // the space they have and the right edge gets clipped.
  const carouselWidth = isTablet ? contentWidth - 48 : windowWidth;
  const bannerCardWidth = isTablet ? carouselWidth - 48 : windowWidth - 32;

  const homeLastFetchedRef = useRef(0);

  // Concurrent Parallel Data Fetching via Promise.allSettled
  const loadHomeData = useCallback(async (force = false) => {
    // Only the very first load (or an explicit pull-to-refresh) blocks the
    // view with a spinner. Every other focus refetches quietly in the
    // background and swaps in fresh data once it arrives — the screen never
    // makes the user wait on a network round trip it already has an answer for.
    const isFirstLoad = homeLastFetchedRef.current === 0;
    if (isFirstLoad || force) {
      setLoadingProducts(true);
    }
    try {
      const [bannersRes, productsRes, reviewsRes, unreadRes] = await Promise.allSettled([
        fetchActiveBanners(),
        fetchProducts({ limit: 6 }),
        fetchRecentReviews(100),
        user ? fetchUnreadCount() : Promise.resolve(null),
      ]);

      // 1. Process Banners
      if (bannersRes.status === 'fulfilled' && bannersRes.value && bannersRes.value.length > 0) {
        const mapped: HeroBanner[] = bannersRes.value.map((b) => {
          const isConsultation = (b.link_url || '').includes('consult');
          return {
            id: String(b.id),
            title: b.title || 'Hand-crafted fresh meals & herbal supplements',
            subtitle:
              b.subtitle ||
              'Steamed small-batch holistic nutrition crafted daily by clinical pet nutritionists and herbalists.',
            ctaText: isConsultation ? 'Book Consultation' : 'Explore Spring Menu',
            targetScreen: isConsultation ? 'Consult' : 'Shop',
            bgImage: b.image_url || HERO_BANNERS[0].bgImage,
          };
        });
        setBanners(mapped);
      }

      // 2. Process Products
      if (productsRes.status === 'fulfilled' && productsRes.value?.items?.length) {
        setProducts(productsRes.value.items);
        setProductsLoadFailed(false);
      } else if (isFirstLoad) {
        setProductsLoadFailed(true);
      }

      // 3. Process Reviews
      if (reviewsRes.status === 'fulfilled' && reviewsRes.value?.reviews?.length) {
        setReviews(reviewsRes.value.reviews);
      }

      // 4. Process Notifications Unread Count
      if (unreadRes.status === 'fulfilled' && unreadRes.value && typeof unreadRes.value.count === 'number') {
        const newCount = unreadRes.value.count;
        setUnreadNotificationsCount((prev) => (prev !== newCount ? newCount : prev));
      }

      homeLastFetchedRef.current = Date.now();
    } catch (err) {
      console.log('[HomeScreen] Error in parallel loadHomeData:', err);
      if (isFirstLoad) setProductsLoadFailed(true);
    } finally {
      setLoadingProducts(false);
      setRefreshing(false);
    }
  }, [user]);

  const filteredReviews = useMemo(() => {
    if (reviewFilter === 'product') return reviews.filter((r) => r.type === 'product');
    if (reviewFilter === 'doctor') return reviews.filter((r) => r.type === 'doctor');
    return reviews;
  }, [reviews, reviewFilter]);

  // Multiplied buffer for continuous loop scrolling without abrupt jumps
  // The looped 4x buffer only exists to make the continuous auto-scroll on "All" seamless.
  // Filtered tabs (Meals/Vets) are manually browsed with no auto-scroll, so they get the
  // plain, bounded list instead — scrolling to the last card should just stop there.
  const infiniteReviews = useMemo(() => {
    if (filteredReviews.length === 0) return [];
    if (reviewFilter !== 'all' || filteredReviews.length === 1) return filteredReviews;
    return [
      ...filteredReviews,
      ...filteredReviews,
      ...filteredReviews,
      ...filteredReviews,
    ];
  }, [filteredReviews, reviewFilter]);

  // Navigation and Action Handlers
  const handleNavigateScreen = useCallback(
    (screenName: string, params?: any) => {
      if (navigation?.navigate) {
        navigation.navigate(screenName, params);
      }
    },
    [navigation]
  );

  // Same copy as the Consult tab's own disabled-tab alert (TabNavigator) —
  // tapping "Find a Vet" here used to skip that gate entirely and navigate
  // straight into VetScreen.
  const handleFindVetPress = useCallback(() => {
    if (!isConsultationsEnabled) {
      Alert.alert(
        consultationsFallback === 'coming_soon' ? 'Coming Soon' : 'Temporarily Unavailable',
        consultationsFallback === 'coming_soon'
          ? "Vet Consultations isn't available yet — check back soon!"
          : 'Vet Consultations is temporarily unavailable. Please check back later.'
      );
      return;
    }
    handleNavigateScreen('Consult');
  }, [isConsultationsEnabled, consultationsFallback, handleNavigateScreen]);

  const handleNavigateToReviewTarget = useCallback(
    (review: UnifiedReview) => {
      setSelectedReviewModal(null);
      if (review.type === 'doctor') {
        navigation?.navigate('Consult', { doctorId: review.reviewed_item_id });
      } else {
        // Land directly on this recipe's own review list, not the top of its detail page
        navigation?.navigate('Shop', { productId: review.reviewed_item_id, scrollToReviews: true });
      }
    },
    [navigation]
  );

  const handleSelectProduct = useCallback(
    (productId: number) => {
      navigation?.navigate('Shop', { productId });
    },
    [navigation]
  );

  const toggleFavorite = useCallback((productId: number) => {
    setFavoriteHearts((prev) => ({ ...prev, [productId]: !prev[productId] }));
  }, []);

  const handleAddToCart = useCallback(
    (productId: number, quantity: number) => {
      if (!isShopEnabled) return; // safety net — the card's own Add button is already disabled in this case
      addItem(productId, quantity);
    },
    [addItem, isShopEnabled]
  );

  const handleUpdateQuantity = useCallback(
    (cartId: number, quantity: number) => {
      updateQuantity(cartId, quantity);
    },
    [updateQuantity]
  );

  const handleRemoveCartItem = useCallback(
    (cartId: number) => {
      removeItem(cartId);
    },
    [removeItem]
  );

  // Reset reviews carousel scroll position on filter change: "All" jumps into the middle of
  // its loop buffer (needed for seamless auto-scroll); filtered tabs just start at the first card.
  useEffect(() => {
    if (reviewFilter === 'all' && filteredReviews.length > 1) {
      const startIdx = filteredReviews.length;
      reviewCurrentIndexRef.current = startIdx;
      const timer = setTimeout(() => {
        reviewListRef.current?.scrollToOffset({
          offset: startIdx * REVIEW_STRIDE,
          animated: false,
        });
      }, 60);
      return () => clearTimeout(timer);
    } else {
      reviewCurrentIndexRef.current = 0;
      reviewListRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [filteredReviews.length, reviewFilter]);

  // Auto-scroll Reviews carousel forward continuously in an infinite loop (pauses when unfocused,
  // or when a specific filter is active so the user can read at their own pace)
  useEffect(() => {
    if (
      filteredReviews.length <= 1 ||
      selectedReviewModal !== null ||
      !isFocused ||
      reviewFilter !== 'all' ||
      !reviewsSectionSeen
    ) {
      if (reviewAutoPlayTimerRef.current) clearInterval(reviewAutoPlayTimerRef.current);
      return;
    }

    reviewAutoPlayTimerRef.current = setInterval(() => {
      if (isReviewDraggingRef.current) return;

      const N = filteredReviews.length;
      const nextIndex = reviewCurrentIndexRef.current + 1;
      reviewCurrentIndexRef.current = nextIndex;

      reviewListRef.current?.scrollToOffset({
        offset: nextIndex * REVIEW_STRIDE,
        animated: true,
      });

      // Wrap around cleanly once we slide past 3 * N
      if (nextIndex >= 3 * N) {
        setTimeout(() => {
          const resetIdx = N + (nextIndex % N);
          reviewCurrentIndexRef.current = resetIdx;
          reviewListRef.current?.scrollToOffset({
            offset: resetIdx * REVIEW_STRIDE,
            animated: false,
          });
        }, 450);
      }
    }, 3200);

    return () => {
      if (reviewAutoPlayTimerRef.current) clearInterval(reviewAutoPlayTimerRef.current);
    };
  }, [filteredReviews.length, selectedReviewModal, isFocused, reviewFilter, reviewsSectionSeen]);

  const onReviewScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Filtered tabs render a plain, non-looped list — no wrap-around bookkeeping needed there.
    if (filteredReviews.length <= 1 || reviewFilter !== 'all') return;
    const offset = event.nativeEvent.contentOffset.x;
    const N = filteredReviews.length;
    let idx = Math.round(offset / REVIEW_STRIDE);

    if (idx >= 3 * N) {
      const resetIdx = N + (idx % N);
      reviewCurrentIndexRef.current = resetIdx;
      reviewListRef.current?.scrollToOffset({
        offset: resetIdx * REVIEW_STRIDE,
        animated: false,
      });
    } else if (idx < N) {
      const resetIdx = 2 * N + (idx % N);
      reviewCurrentIndexRef.current = resetIdx;
      reviewListRef.current?.scrollToOffset({
        offset: resetIdx * REVIEW_STRIDE,
        animated: false,
      });
    } else {
      reviewCurrentIndexRef.current = idx;
    }
  };

  // Automatically refresh live banners and notifications when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadHomeData();
    }, [loadHomeData])
  );

  const handleUnreadCountChange = useCallback((count: number) => {
    setUnreadNotificationsCount((prev) => (prev !== count ? count : prev));
  }, []);

  // Real-Time WebSocket Notification Stream
  const accessToken = useAuthStore((state) => state.accessToken);
  useEffect(() => {
    if (!accessToken || !user) return;

    let ws: WebSocket | null = null;
    let isMounted = true;

    try {
      const wsUrl = `${BASE_URL.replace(/^http/, 'ws')}/notifications/ws?token=${accessToken}`;
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const payload = JSON.parse(event.data);
          setUnreadNotificationsCount((prev) => prev + 1);
          if (payload?.title) {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            setLiveToast({
              title: payload.title,
              message: payload.message || 'New activity update recorded in your feed.',
            });
            toastTimerRef.current = setTimeout(() => {
              if (isMounted) setLiveToast(null);
            }, 4500);
          }
        } catch {}
      };
    } catch {}

    return () => {
      isMounted = false;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (ws) {
        try {
          ws.close();
        } catch {}
      }
    };
  }, [accessToken, user]);

  // Reset to initial real item (index 1) whenever banners list updates
  useEffect(() => {
    if (banners.length > 1) {
      currentIndexRef.current = 1;
      setActiveBannerIndex(0);
      const timer = setTimeout(() => {
        bannerListRef.current?.scrollToOffset({
          offset: carouselWidth,
          animated: false,
        });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [banners, carouselWidth]);

  // Infinite auto-advance carousel forward every 4 seconds (pauses when unfocused)
  useEffect(() => {
    if (banners.length <= 1 || !isFocused) {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      return;
    }

    let loopResetTimer: ReturnType<typeof setTimeout> | null = null;
    autoPlayTimerRef.current = setInterval(() => {
      const nextIndex = currentIndexRef.current + 1;
      currentIndexRef.current = nextIndex;
      bannerListRef.current?.scrollToOffset({
        offset: nextIndex * carouselWidth,
        animated: true,
      });
      setActiveBannerIndex((nextIndex - 1 + banners.length) % banners.length);
      if (nextIndex >= banners.length + 1) {
        // Landed on the clone of the first slide: once the slide animation has
        // finished, swap silently to the real first slide (identical picture).
        loopResetTimer = setTimeout(() => {
          currentIndexRef.current = 1;
          bannerListRef.current?.scrollToOffset({ offset: carouselWidth, animated: false });
        }, 450);
      }
    }, 4000);

    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      if (loopResetTimer) clearTimeout(loopResetTimer);
    };
  }, [banners.length, isFocused, carouselWidth]);

  // Handle seamless infinite loop on momentum scroll end
  const onBannerScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (banners.length <= 1) return;
    const offset = event.nativeEvent.contentOffset.x;
    let index = Math.round(offset / carouselWidth);

    // If we slid into the cloned first item at the tail -> silently jump to real index 1
    if (index >= banners.length + 1) {
      index = 1;
      currentIndexRef.current = 1;
      bannerListRef.current?.scrollToOffset({
        offset: carouselWidth,
        animated: false,
      });
    } else if (index <= 0) {
      // If user swiped backward into the cloned last item at the head -> silently jump to real index N
      index = banners.length;
      currentIndexRef.current = banners.length;
      bannerListRef.current?.scrollToOffset({
        offset: banners.length * carouselWidth,
        animated: false,
      });
    } else {
      currentIndexRef.current = index;
    }

    const realDotIndex = (index - 1 + banners.length) % banners.length;
    setActiveBannerIndex(realDotIndex);
  };

  // Virtualized list callbacks
  const renderBannerItem = useCallback(
    ({ item }: { item: HeroBanner }) => (
      <BannerSlideItem
        item={item}
        onNavigate={handleNavigateScreen}
        slideWidth={carouselWidth}
        cardWidth={bannerCardWidth}
      />
    ),
    [handleNavigateScreen, carouselWidth, bannerCardWidth]
  );

  const getBannerItemLayout = useCallback(
    (_: any, index: number) => ({
      length: carouselWidth,
      offset: carouselWidth * index,
      index,
    }),
    [carouselWidth]
  );

  const bannerKeyExtractor = useCallback(
    (item: HeroBanner, index: number) => `${item.id}-${index}`,
    []
  );

  const renderReviewItem = useCallback(
    ({ item, index }: { item: UnifiedReview; index: number }) => (
      <ReviewCardItem
        review={item}
        index={index}
        onOpenModal={setSelectedReviewModal}
        onNavigateTarget={handleNavigateToReviewTarget}
        width={REVIEW_CARD_WIDTH}
      />
    ),
    [handleNavigateToReviewTarget]
  );

  const getReviewItemLayout = useCallback(
    (_: any, index: number) => ({
      length: REVIEW_STRIDE,
      offset: REVIEW_STRIDE * index,
      index,
    }),
    []
  );

  const reviewKeyExtractor = useCallback(
    (item: UnifiedReview, index: number) => `${item.id}-${index}`,
    []
  );

  return (
    <>
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 1. Header with Logo & Notification Controls */}
      <View style={styles.header}>
        <BrandHeader
          subtitle={primaryPet ? `Feeding ${primaryPet.name}` : 'CANINE NUTRITION LEDGER'}
          medallionSize="sm"
        />

        <View style={styles.headerActionIcons}>
          <TouchableOpacity
            style={styles.iconCircleBtn}
            onPress={() => handleNavigateScreen('Shop')}
            activeOpacity={0.8}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel="Search"
          >
            <Search size={18} color={COLORS.textCoffee} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconCircleBtn}
            onPress={() => handleNavigateScreen('Cart')}
            activeOpacity={0.8}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={totalCartCount > 0 ? `Cart, ${totalCartCount} item${totalCartCount === 1 ? '' : 's'}` : 'Cart'}
          >
            <ShoppingBag size={18} color={COLORS.textCoffee} />
            {totalCartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totalCartCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconCircleBtn}
            onPress={() => setNotificationModalVisible(true)}
            activeOpacity={0.8}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={unreadNotificationsCount > 0 ? `Notifications, ${unreadNotificationsCount} unread` : 'Notifications'}
          >
            <Bell size={18} color={COLORS.textCoffee} />
            {unreadNotificationsCount > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => handleNavigateScreen('Profile')}
            activeOpacity={0.8}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel="Profile"
          >
            {user?.profile_image_url ? (
              <Image source={{ uri: user.profile_image_url }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>
                  {user?.first_name ? user.first_name[0].toUpperCase() : 'G'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={(e) => {
          if (reviewsSectionSeen) return;
          const scrollY = e.nativeEvent.contentOffset.y;
          const viewportBottom = scrollY + e.nativeEvent.layoutMeasurement.height;
          // "Seen" once the section's top has scrolled into the lower
          // two-thirds of the viewport, not only once fully on-screen.
          if (viewportBottom >= reviewsSectionYRef.current + 80) {
            setReviewsSectionSeen(true);
          }
        }}
        scrollEventThrottle={100}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadHomeData(true);
            }}
            colors={[COLORS.forestGreen]}
          />
        }
      >
        <ResponsiveContainer>
        {/* 4. Hero Banner Carousel with Infinite Loop & Progress Bar */}
        <View style={styles.bannerCarouselContainer}>
          <FlatList
            ref={bannerListRef}
            data={extendedBanners}
            keyExtractor={bannerKeyExtractor}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={banners.length > 1 ? 1 : 0}
            onMomentumScrollEnd={onBannerScrollEnd}
            getItemLayout={getBannerItemLayout}
            renderItem={renderBannerItem}
            // Every slide (including the loop clones) stays mounted so the jump
            // from the last slide back to the first never reveals a blank frame.
            initialNumToRender={extendedBanners.length}
            maxToRenderPerBatch={extendedBanners.length}
            windowSize={extendedBanners.length + 1}
            removeClippedSubviews={false}
            decelerationRate="fast"
            snapToInterval={carouselWidth}
            snapToAlignment="center"
          />

          {/* Dots Indicator */}
          {banners.length > 1 && (
            <View style={styles.paginationDotsWrapper}>
              {banners.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    idx === activeBannerIndex ? styles.activeDotBar : styles.inactiveDot,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Sections 5-11 stage in one tick after first paint — see
            belowFoldReady above — rather than all mounting immediately
            alongside the hero banner. */}
        {belowFoldReady && (
        <>
        {/* 5. Scooby Core Care & App Features Section — a plain heading,
            no badge: the rows below already show what's on offer, so a
            "AI ECOSYSTEM" chip and a restating subtitle were saying the
            same thing twice. */}
        <View style={styles.sectionHeaderRowPlain}>
          <Text style={styles.sectionTitleLarge}>Hearth & One Care & Services</Text>
        </View>

        {/* Feature Spotlight: AI Pet Vision Scanner. Reads through a
            camera-viewfinder motif (corner brackets + a sweeping scan line)
            instead of an eyebrow label, an internal port/runtime badge, and
            a description sentence — the design communicates "this scans
            your pet," not the words around it. */}
        <TouchableOpacity
          style={styles.visionSpotlightCard}
          onPress={() => setPetVisionVisible(true)}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Scan & Diagnose: open the AI pet vision scanner"
        >
          <View style={styles.visionScanFrame}>
            <ToolIcon source={require('../../assets/toolkit/scan-diagnose.webp')} size={64} />
          </View>

          <View style={styles.visionSpotlightCenter}>
            <Text style={styles.visionSpotlightTitle}>Scan & Diagnose</Text>
          </View>

          <View style={styles.visionScanArrowBtn}>
            <ArrowRight size={17} color="#FFFFFF" strokeWidth={2.4} />
          </View>
        </TouchableOpacity>

        {/* Core Services — a plain ruled list, like a table of contents in
            a field journal: one weight, one hairline divider between rows,
            no per-row colour or badge competing for attention. */}
        <View style={styles.serviceLedger}>
          {CORE_SERVICES.filter(
            (srv) =>
              (srv.id !== 'pets' || isKnowYourPetEnabled) &&
              (srv.id !== 'telehealth' || isConsultationsEnabled || consultationsFallback !== 'hide')
          ).map((srv, i, arr) => {
            const isDisabledConsult = srv.target === 'Consult' && !isConsultationsEnabled;
            return (
              <TouchableOpacity
                key={srv.id}
                style={[
                  styles.serviceRow,
                  i === arr.length - 1 && styles.serviceRowLast,
                ]}
                onPress={() => {
                  if (srv.target === 'Consult') {
                    handleFindVetPress();
                  } else if (srv.actionType === 'navigate' && srv.target) {
                    handleNavigateScreen(srv.target);
                  } else if (srv.actionType === 'vision') {
                    setPetVisionVisible(true);
                  } else if (srv.actionType === 'chatbot') {
                    navigation.navigate('Chatbot');
                  }
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={
                  isDisabledConsult
                    ? `${srv.title}: ${consultationsFallback === 'coming_soon' ? 'Coming soon' : 'Temporarily unavailable'}`
                    : `${srv.title}: ${srv.desc}`
                }
              >
                <ToolIcon source={srv.image} delay={i * 500} dimmed={isDisabledConsult} />

                <View style={styles.serviceRowBody}>
                  <View style={styles.serviceRowTitleRow}>
                    <Text style={[styles.serviceRowTitle, isDisabledConsult && styles.serviceRowTitleDisabled]}>
                      {srv.title}
                    </Text>
                    {isDisabledConsult && (
                      <View style={styles.serviceRowSoonPill}>
                        <Text style={styles.serviceRowSoonPillText}>
                          {consultationsFallback === 'coming_soon' ? 'SOON' : 'PAUSED'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.serviceRowDesc} numberOfLines={2}>{srv.desc}</Text>
                </View>

                <ChevronRight size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Story sections, in the web home page's order: Why Hearth & One,
            then the Hearth & Hound teaser, then the recipes. */}
        <WhyHearthSection />
        <HearthHoundSection />

        {/* 6. Kitchen Favorites Section */}
        <View style={styles.sectionHeaderRow} ref={recipesSectionRef} collapsable={false}>
          <View>
            <Text style={styles.sectionTitle}>Signature Recipes</Text>
          </View>
          <View style={styles.vetFormulatedBadge}>
            <Heart size={12} color={COLORS.forestGreen} />
            <Text style={styles.vetFormulatedText}>VET FORMULATED</Text>
          </View>
        </View>

        {loadingProducts ? (
          <View style={styles.productsStateBox}>
            <ActivityIndicator size="small" color={COLORS.forestGreen} />
            <Text style={styles.productsStateText}>Loading today's recipes…</Text>
          </View>
        ) : productsLoadFailed ? (
          <View style={styles.productsStateBox}>
            <UtensilsCrossed size={26} color={COLORS.textLight} />
            <Text style={styles.productsStateTitle}>Couldn't load today's menu</Text>
            <Text style={styles.productsStateText}>Check your connection and try again.</Text>
            <TouchableOpacity
              style={styles.productsRetryBtn}
              onPress={() => loadHomeData(true)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Retry loading recipes"
            >
              <Text style={styles.productsRetryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : products.length === 0 ? (
          <View style={styles.productsStateBox}>
            <UtensilsCrossed size={26} color={COLORS.textLight} />
            <Text style={styles.productsStateTitle}>No recipes available right now</Text>
            <Text style={styles.productsStateText}>Check back soon — the kitchen is always cooking up something new.</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.favoritesCarousel}
            nestedScrollEnabled={true}
          >
            {products.map((product) => (
              <ProductFavoriteCard
                key={product.id}
                product={product}
                inCartItem={cartMap.get(product.id)}
                isFav={favoriteHearts[product.id] ?? false}
                onToggleFavorite={toggleFavorite}
                onAddItem={handleAddToCart}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveCartItem}
                onSelectProduct={handleSelectProduct}
                orderingDisabledLabel={shopDisabledLabel}
              />
            ))}
          </ScrollView>
        )}

        {/* Meal Planner entry — mirrors web's persistent "Meal Planner"
            nav item / Home CTA (frontend/src/features/onboarding), a diet
            quiz usable any time rather than a first-run/signup gate. */}
        {isMealPlannerEnabled && (
          <View style={styles.mealPlannerCard}>
            <ToolIcon source={require('../../assets/toolkit/meal-planner.webp')} size={62} delay={700} />
            <View style={styles.mealPlannerTextCol}>
              <Text style={styles.mealPlannerTitle}>Meal Planner</Text>
              <Text style={styles.mealPlannerSubtitle}>
                Get a personalized recipe recommendation in 90 seconds.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.mealPlannerBtn}
              onPress={() => handleNavigateScreen('MealPlanner')}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Open meal planner"
            >
              <ArrowRight size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* 7. Vet Consultation Card (Dark Forest Green). "Telehealth
            Apothecary" wasn't the right name for what this is — it's a vet
            consultation booking, so the badge says that plainly. The price
            pill is gone (rates vary by doctor and aren't fixed at ₹499), and
            the pulse-line glyph that replaces it in that slot says
            "clinical" through the design instead of another label. Copy
            trimmed to what a glance actually needs.
            Hidden entirely when consultations_booking's fallback is 'hide',
            matching web's HomePage (FeaturePlaceholderCard or nothing). */}
        {(isConsultationsEnabled || consultationsFallback !== 'hide') && (
          <View style={styles.telehealthCard} ref={vetCardRef} collapsable={false}>
            <View style={styles.telehealthHeaderRow}>
              <View style={styles.telehealthPill}>
                <Stethoscope size={13} color={COLORS.sageLight} />
                <Text style={styles.telehealthPillText}>VET CONSULTATION</Text>
              </View>

              <Svg width={52} height={20} viewBox="0 0 130 40" accessibilityElementsHidden importantForAccessibility="no">
                <Path
                  d="M0,20 L28,20 L36,4 L46,36 L54,20 L102,20 L110,4 L120,36 L130,20"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </Svg>
            </View>

            <Text style={styles.telehealthTitle}>
              {isConsultationsEnabled ? 'Need expert vet advice?' : 'Vet consultations paused'}
            </Text>

            <Text style={styles.telehealthSubtitle}>
              {isConsultationsEnabled
                ? 'Certified vets, ready in minutes.'
                : consultationsFallback === 'coming_soon'
                ? "Online booking isn't open yet — check back soon."
                : 'Online booking is temporarily unavailable.'}
            </Text>

            <TouchableOpacity
              style={[styles.findVetBtn, !isConsultationsEnabled && styles.findVetBtnDisabled]}
              onPress={handleFindVetPress}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Find a vet"
            >
              <Stethoscope size={16} color={isConsultationsEnabled ? '#FFFFFF' : COLORS.sageLight} />
              <Text style={[styles.findVetBtnText, !isConsultationsEnabled && styles.findVetBtnTextDisabled]}>
                {isConsultationsEnabled ? 'Find a Vet' : consultationsFallback === 'coming_soon' ? 'Coming Soon' : 'Unavailable'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 8. Community Feedback Ledger (Dynamic Reviews Carousel) — only shown once real reviews exist */}
        {reviews.length > 0 && (
          <View
            onLayout={(e) => {
              reviewsSectionYRef.current = e.nativeEvent.layout.y;
            }}
          >
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Let our #HearthAndOneFam speak</Text>
              </View>
              {overallReviewRating && (
                <View style={styles.trustpilotBadge}>
                  <Star size={11} color="#FFFFFF" fill="#FFFFFF" />
                  <Text style={styles.trustpilotBadgeText}>{overallReviewRating} / 5</Text>
                </View>
              )}
            </View>

            {/* Review Filter Pills */}
            <View style={styles.reviewFilterRow}>
              <TouchableOpacity
                style={[styles.reviewFilterPill, reviewFilter === 'all' && styles.reviewFilterPillActive]}
                onPress={() => setReviewFilter('all')}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: reviewFilter === 'all' }}
                accessibilityLabel={`All reviews, ${reviews.length}`}
              >
                <Text style={[styles.reviewFilterText, reviewFilter === 'all' && styles.reviewFilterTextActive]}>
                  All ({reviews.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.reviewFilterPill, reviewFilter === 'product' && styles.reviewFilterPillActive]}
                onPress={() => setReviewFilter('product')}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: reviewFilter === 'product' }}
                accessibilityLabel={`Meal reviews, ${productReviewsCount}`}
              >
                <View style={styles.reviewFilterContent}>
                  <UtensilsCrossed size={12} color={reviewFilter === 'product' ? '#FFFFFF' : COLORS.textMuted} strokeWidth={2.2} />
                  <Text style={[styles.reviewFilterText, reviewFilter === 'product' && styles.reviewFilterTextActive]}>
                    Meals ({productReviewsCount})
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.reviewFilterPill, reviewFilter === 'doctor' && styles.reviewFilterPillActive]}
                onPress={() => setReviewFilter('doctor')}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: reviewFilter === 'doctor' }}
                accessibilityLabel={`Vet reviews, ${doctorReviewsCount}`}
              >
                <View style={styles.reviewFilterContent}>
                  <Stethoscope size={12} color={reviewFilter === 'doctor' ? '#FFFFFF' : COLORS.textMuted} strokeWidth={2.2} />
                  <Text style={[styles.reviewFilterText, reviewFilter === 'doctor' && styles.reviewFilterTextActive]}>
                    Vets ({doctorReviewsCount})
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {filteredReviews.length === 0 ? (
              // A filter tab with a real, non-zero count (e.g. "Vets (0)"
              // never shows) can't happen from the pill counts themselves,
              // but the two categories are independently sized — an app
              // with product reviews and zero vet reviews yet is a normal
              // state, not a bug, so it gets a message instead of a blank
              // horizontal strip.
              <View style={styles.reviewsEmptyState}>
                <Text style={styles.reviewsEmptyStateText}>
                  {reviewFilter === 'doctor'
                    ? 'No vet consultation reviews yet.'
                    : 'No recipe reviews yet.'}
                </Text>
              </View>
            ) : (
              <FlatList
                key={reviewFilter}
                ref={reviewListRef}
                data={infiniteReviews}
                keyExtractor={reviewKeyExtractor}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[
                  styles.reviewsListScroll,
                  // Side padding that puts the active card in the middle of the screen.
                  { paddingHorizontal: Math.max(16, (windowWidth - REVIEW_CARD_WIDTH) / 2) },
                ]}
                // One card at a time, each stopping in the centre.
                snapToInterval={REVIEW_STRIDE}
                snapToAlignment="start"
                decelerationRate="fast"
                onScrollBeginDrag={() => {
                  isReviewDraggingRef.current = true;
                }}
                onScrollEndDrag={() => {
                  isReviewDraggingRef.current = false;
                }}
                onMomentumScrollEnd={onReviewScrollEnd}
                renderItem={renderReviewItem}
                getItemLayout={getReviewItemLayout}
                initialNumToRender={3}
                maxToRenderPerBatch={3}
                windowSize={3}
                removeClippedSubviews={Platform.OS === 'android'}
              />
            )}
          </View>
        )}

        {/* 9. 100% Human-Grade Standard Badge */}
        <View style={styles.humanGradeBanner}>
          <View style={styles.shieldCircle}>
            <ShieldCheck size={20} color={COLORS.forestGreen} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.humanGradeTitle}>100% Human-Grade Standard</Text>
            <Text style={styles.humanGradeSub}>
              No fillers, by-products, or artificial preservatives ever.
            </Text>
          </View>
        </View>

        {/* Quick Links grid removed — it routed to the exact same four
            screens (Orders/Pets/Consult/Shop) as the Core Services ledger
            shown earlier in this same scroll, under different icons and
            copy, forcing a re-evaluation of choices already made above with
            zero new information. See critique 2026-09-10. */}

        <BlogPreviewSection navigation={navigation} />

        <FAQSection />
        </>
        )}
        </ResponsiveContainer>
      </ScrollView>

      {/* AI Pet Vision Scanner Modal */}
      <PetVisionModal
        visible={petVisionVisible}
        onClose={() => setPetVisionVisible(false)}
        onApplyPetDetails={() => {
          setPetVisionVisible(false);
          handleNavigateScreen('Pets');
        }}
      />

      {/* Real-Time In-App Notification Center */}
      <NotificationModal
        visible={notificationModalVisible}
        onClose={() => setNotificationModalVisible(false)}
        onNavigateTarget={(targetScreen, params) => {
          handleNavigateScreen(targetScreen, params);
        }}
        onUnreadCountChange={handleUnreadCountChange}
      />

      {/* Floating In-App Live Notification Toast */}
      {liveToast && (
        <TouchableOpacity
          style={styles.liveToastContainer}
          activeOpacity={0.9}
          onPress={() => {
            setLiveToast(null);
            setNotificationModalVisible(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Notification: ${liveToast.title}. ${liveToast.message}`}
        >
          <View style={styles.liveToastIconWrap}>
            <Sparkles size={16} color={COLORS.sageIcon} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.liveToastTitle} numberOfLines={1}>
              {liveToast.title}
            </Text>
            <Text style={styles.liveToastMessage} numberOfLines={2}>
              {liveToast.message}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setLiveToast(null)}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            accessibilityRole="button"
            accessibilityLabel="Dismiss notification"
          >
            <X size={15} color="#8C7E74" />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Review Detail Modal Popup */}
      {selectedReviewModal && (
        <Modal
          visible={!!selectedReviewModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedReviewModal(null)}
        >
          <View style={styles.reviewModalOverlay}>
            <View style={styles.reviewModalCard}>
              <TouchableOpacity
                style={styles.reviewModalClose}
                onPress={() => setSelectedReviewModal(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <X size={18} color={COLORS.textCoffee} />
              </TouchableOpacity>

              <Image
                source={{
                  uri:
                    selectedReviewModal.image_url ||
                    DEFAULT_DOG_IMAGES[0],
                }}
                style={styles.reviewModalImage}
                contentFit="cover"
              />

              <View style={styles.reviewModalBody}>
                {/* Meta Row: Non-overlapping Stars on left & Badge on right */}
                <View style={styles.reviewModalMetaRow}>
                  <View style={homeCardStyles.reviewStarRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={15}
                        color={COLORS.accentGold}
                        fill={star <= selectedReviewModal.rating ? COLORS.accentGold : COLORS.kraftBorder}
                      />
                    ))}
                  </View>
                  <View
                    style={[
                      styles.reviewModalBadge,
                      selectedReviewModal.type === 'doctor'
                        ? homeCardStyles.doctorTypeBadge
                        : homeCardStyles.productTypeBadge,
                    ]}
                  >
                    {selectedReviewModal.type === 'doctor' ? (
                      <Stethoscope size={10} color={COLORS.navy} strokeWidth={2.4} />
                    ) : (
                      <UtensilsCrossed size={10} color={COLORS.sageTintText} strokeWidth={2.4} />
                    )}
                    <Text
                      style={[
                        homeCardStyles.reviewTypeBadgeText,
                        selectedReviewModal.type === 'doctor'
                          ? homeCardStyles.doctorTypeText
                          : homeCardStyles.productTypeText,
                      ]}
                    >
                      {selectedReviewModal.type === 'doctor' ? 'Vet Consult' : 'Fresh Meal'}
                    </Text>
                  </View>
                </View>

                {/* Author Info */}
                <View style={styles.reviewModalAuthorBlock}>
                  <View style={styles.reviewAuthorAvatar}>
                    <Text style={styles.reviewAuthorAvatarText}>
                      {selectedReviewModal.author_name ? selectedReviewModal.author_name[0].toUpperCase() : 'P'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={styles.reviewModalAuthorName}>
                        {selectedReviewModal.author_name}
                      </Text>
                      {selectedReviewModal.is_verified_buyer && (
                        <View style={styles.verifiedBuyerTag}>
                          <CheckCircle2 size={11} color={COLORS.sageIcon} />
                          <Text style={styles.verifiedBuyerTagText}>Verified</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.reviewModalDateText}>
                      {new Date(selectedReviewModal.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                </View>

                {/* Testimonial Quote */}
                <ScrollView style={styles.reviewModalCommentScroll} showsVerticalScrollIndicator={false}>
                  <Text style={styles.reviewModalCommentText}>
                    "{selectedReviewModal.comment || 'No comment provided.'}"
                  </Text>
                </ScrollView>

                {/* Product / Doctor Deep Link Button */}
                <View style={styles.reviewModalLinkSection}>
                  <Text style={styles.reviewModalLinkLabel}>
                    {selectedReviewModal.type === 'doctor' ? 'CONSULTED SPECIALIST' : 'SOURCED RECIPE'}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.reviewModalLinkBtn,
                      selectedReviewModal.type === 'doctor'
                        ? styles.reviewModalLinkBtnDoctor
                        : styles.reviewModalLinkBtnProduct,
                    ]}
                    onPress={() => handleNavigateToReviewTarget(selectedReviewModal)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={selectedReviewModal.type === 'doctor' ? 'View consulted specialist' : 'View sourced recipe'}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <View
                        style={[
                          styles.reviewModalIconCircle,
                          selectedReviewModal.type === 'doctor'
                            ? { backgroundColor: COLORS.navyTintBadgeBg }
                            : { backgroundColor: COLORS.sageTintBadgeBg },
                        ]}
                      >
                        {selectedReviewModal.type === 'doctor' ? (
                          <Stethoscope size={15} color={COLORS.navy} />
                        ) : (
                          <UtensilsCrossed size={15} color={COLORS.sageIcon} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reviewModalTargetTitle} numberOfLines={1}>
                          {selectedReviewModal.reviewed_item_name}
                        </Text>
                        <Text style={styles.reviewModalTargetSubtitle}>
                          {selectedReviewModal.type === 'doctor'
                            ? 'Tap to book consultation'
                            : 'Tap to view recipe formulation'}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.reviewModalArrowCircle,
                        selectedReviewModal.type === 'doctor'
                          ? { backgroundColor: COLORS.navy }
                          : { backgroundColor: COLORS.sageIcon },
                      ]}
                    >
                      <ChevronRight size={13} color="#FFFFFF" strokeWidth={2.5} />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>

    {/* Rendered as a sibling of SafeAreaView, not a child — its coordinates
        come from measureInWindow (true full-window), and SafeAreaView's top
        inset would otherwise offset it from the window. */}
    <AppTour steps={tourSteps} />
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  scrollContent: {
    paddingBottom: 50,
  },

  /* 1. Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FAF7F2',
  },
  headerActionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: COLORS.forestGreen,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    fontSize: 9,
    fontFamily: LEDGER_MONO,
    color: '#FFFFFF',
  },
  bellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: COLORS.sageIcon,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  bellBadgeText: {
    fontSize: 9,
    fontFamily: LEDGER_MONO,
    color: '#FFFFFF',
  },
  liveToastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 38,
    left: 16,
    right: 16,
    zIndex: 9999,
    backgroundColor: '#FAF7F2',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: COLORS.sageIcon,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  liveToastIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.sageTintBadgeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveToastTitle: {
    fontSize: 12.5,
    fontFamily: FONT_DISPLAY_SEMIBOLD,
    color: COLORS.textCoffee,
  },
  liveToastMessage: {
    fontSize: 11,
    fontFamily: FONT_BODY,
    color: '#715D52',
    marginTop: 1,
  },
  avatarBtn: {
    marginLeft: 2,
  },
  avatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.forestGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 14,
    fontFamily: FONT_DISPLAY_SEMIBOLD,
    color: '#FFFFFF',
  },

  /* 4. Hero Banner Carousel */
  bannerCarouselContainer: {
    marginBottom: 20,
  },
  paginationDotsWrapper: {
    position: 'absolute',
    bottom: 14,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  dot: {
    height: 5,
    borderRadius: 2.5,
  },
  activeDotBar: {
    width: 18,
    backgroundColor: '#FFFFFF',
  },
  inactiveDot: {
    width: 5,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },

  /* 5. Scooby Core Care & App Features */
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: FONT_HEADING_SCRIPT,
    // Deliberate deviation from DESIGN.md's Ochre Hierarchy Rule (main
    // titles default to brandGold), scoped to this screen only, per
    // explicit user request: unify every light-canvas section heading to
    // the same black used by sectionTitleLarge, instead of splitting them
    // between ochre and black. See DESIGN.md discussion before applying
    // this color elsewhere in the app.
    color: COLORS.textCoffee,
  },
  sectionSubtitle: {
    fontSize: 11,
    fontFamily: FONT_BODY,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  sectionHeaderRowPlain: {
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  sectionTitleLarge: {
    fontSize: 26,
    fontFamily: FONT_HEADING_SCRIPT,
    color: COLORS.textCoffee,
  },

  /* Feature Spotlight: AI Pet Vision Scanner — a camera-viewfinder motif
     (corner brackets + sweeping scan line) carries the "this scans your
     pet" meaning instead of an eyebrow label and a description sentence.
     Background aligned to COLORS.forestDark so this and telehealthCard
     share one dark-surface identity instead of two ad-hoc browns. */
  visionSpotlightCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: COLORS.forestDark,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: COLORS.textCoffee,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  visionScanFrame: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  visionSpotlightCenter: {
    flex: 1,
  },
  visionSpotlightTitle: {
    fontSize: 16,
    fontFamily: FONT_DISPLAY,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  visionScanArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },

  /* Core Services — Ledger Index (full-width tab rows, not a tile grid) */
  serviceLedger: {
    paddingHorizontal: 16,
    marginBottom: 22,
  },
  // One card per service: the illustrated icon on the left, title and
  // description beside it.
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 14,
    marginBottom: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 20,
  },
  serviceRowLast: {
    marginBottom: 0,
  },
  serviceRowBody: {
    flex: 1,
    gap: 2,
  },
  serviceRowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  serviceRowTitle: {
    fontSize: 15,
    fontFamily: FONT_DISPLAY_SEMIBOLD,
    color: COLORS.textCoffee,
    // Matches the tightened-tracking voice every other headline role on
    // this screen now carries — the services list was the one left out.
    letterSpacing: -0.2,
  },
  serviceRowTitleDisabled: {
    color: COLORS.textLight,
  },
  serviceRowSoonPill: {
    backgroundColor: COLORS.kraftBorder,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  serviceRowSoonPillText: {
    fontSize: 8.5,
    fontFamily: FONT_BODY_BOLD,
    color: COLORS.textLight,
    letterSpacing: 0.4,
  },
  serviceRowDesc: {
    fontSize: 12,
    fontFamily: FONT_BODY,
    color: COLORS.textMuted,
  },

  /* 6. Kitchen Favorites */
  vetFormulatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6F1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  vetFormulatedText: {
    fontSize: 10,
    fontFamily: LEDGER_MONO,
    color: COLORS.forestGreen,
    letterSpacing: 0.4,
  },
  productsStateBox: {
    marginHorizontal: 16,
    marginBottom: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: COLORS.cardAlt,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    alignItems: 'center',
    gap: 4,
  },
  productsStateTitle: {
    fontSize: 13,
    fontFamily: FONT_DISPLAY_SEMIBOLD,
    color: COLORS.textCoffee,
    marginTop: 8,
    textAlign: 'center',
  },
  productsStateText: {
    fontSize: 12,
    fontFamily: FONT_BODY,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  productsRetryBtn: {
    marginTop: 10,
    backgroundColor: COLORS.forestGreen,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 10,
  },
  productsRetryText: {
    fontSize: 12.5,
    fontFamily: FONT_BODY_BOLD,
    color: '#FFFFFF',
  },
  favoritesCarousel: {
    paddingHorizontal: 16,
    gap: 14,
    paddingBottom: 6,
    marginBottom: 20,
  },
  /* 7. Meal Planner CTA & Vet Consultation Card */
  mealPlannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.card,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    padding: 14,
  },
  mealPlannerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealPlannerTextCol: { flex: 1, gap: 2 },
  mealPlannerTitle: {
    // Matches visionSpotlightTitle exactly (16px, -0.2 tracking) — both are
    // the same "icon circle + headline + trailing arrow" row-card pattern,
    // and had drifted to two different sizes for no functional reason.
    fontSize: 16,
    fontFamily: FONT_DISPLAY,
    color: COLORS.textCoffee,
    letterSpacing: -0.2,
  },
  mealPlannerSubtitle: {
    fontSize: 11.5,
    fontFamily: FONT_BODY,
    color: COLORS.textMuted,
  },
  mealPlannerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.forestGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  telehealthCard: {
    backgroundColor: COLORS.forestDark,
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 18,
    gap: 10,
    marginBottom: 24,
  },
  telehealthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  telehealthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  telehealthPillText: {
    fontSize: 10,
    fontFamily: LEDGER_MONO,
    color: COLORS.sageLight,
    letterSpacing: 0.5,
  },
  telehealthTitle: {
    fontSize: 18,
    fontFamily: FONT_DISPLAY,
    color: '#FFFFFF',
    lineHeight: 23,
    // Unified with bannerTitle at -0.3 — same 18px tier, one tracking value.
    letterSpacing: -0.3,
  },
  telehealthSubtitle: {
    fontSize: 12.5,
    fontFamily: FONT_BODY,
    color: '#D1D5DB',
  },
  findVetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.ctaBrown,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  findVetBtnText: {
    fontSize: 13,
    fontFamily: FONT_BODY_BOLD,
    color: '#FFFFFF',
  },
  findVetBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  findVetBtnTextDisabled: {
    color: COLORS.sageLight,
  },

  /* 8. Community Feedback Ledger (Reviews Carousel) */
  trustpilotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.sageIcon,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  trustpilotBadgeText: {
    fontSize: 10,
    fontFamily: LEDGER_MONO,
    color: '#FFFFFF',
  },
  reviewFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 14,
  },
  reviewFilterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FAF4EB',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  reviewFilterPillActive: {
    backgroundColor: COLORS.forestGreen,
    borderColor: COLORS.forestGreen,
  },
  reviewFilterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  reviewFilterText: {
    fontSize: 11,
    fontFamily: LEDGER_MONO,
    color: COLORS.textMuted,
  },
  reviewFilterTextActive: {
    color: '#FFFFFF',
  },
  reviewsListScroll: {
    gap: 14,
    marginBottom: 24,
  },
  reviewsEmptyState: {
    marginHorizontal: 16,
    marginBottom: 24,
    paddingVertical: 22,
    borderRadius: 16,
    backgroundColor: COLORS.cardAlt,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    alignItems: 'center',
  },
  reviewsEmptyStateText: {
    fontSize: 12,
    fontFamily: FONT_BODY,
    color: COLORS.textMuted,
  },
  /* Review Detail Modal */
  reviewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23,35,61,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  reviewModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  reviewModalClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FAF7F2',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  reviewModalImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#F5EFE6',
  },
  reviewModalBody: {
    padding: 16,
    gap: 12,
  },
  reviewModalMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewModalAuthorBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3EFE9',
    paddingBottom: 10,
  },
  reviewAuthorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAuthorAvatarText: {
    fontSize: 14,
    fontFamily: FONT_DISPLAY_SEMIBOLD,
    color: '#92400E',
  },
  reviewModalAuthorName: {
    fontSize: 13,
    fontFamily: FONT_DISPLAY_SEMIBOLD,
    color: COLORS.textCoffee,
  },
  reviewModalCommentScroll: {
    maxHeight: 120,
  },
  reviewModalCommentText: {
    fontSize: 12,
    fontFamily: FONT_BODY,
    fontStyle: 'italic',
    color: COLORS.textCoffee,
    lineHeight: 18,
  },
  reviewModalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  verifiedBuyerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.sageTintBadgeBg,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.sageLight,
  },
  verifiedBuyerTagText: {
    fontSize: 9,
    fontFamily: LEDGER_MONO,
    color: COLORS.sageIcon,
  },
  reviewModalDateText: {
    fontSize: 10,
    fontFamily: LEDGER_MONO,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  reviewModalLinkSection: {
    borderTopWidth: 1,
    borderTopColor: '#F3EFE9',
    paddingTop: 10,
    gap: 6,
  },
  reviewModalLinkLabel: {
    fontSize: 9,
    fontFamily: LEDGER_MONO,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  reviewModalLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  reviewModalLinkBtnProduct: {
    backgroundColor: COLORS.sageTintBg,
    borderColor: COLORS.sageTintBorder,
  },
  reviewModalLinkBtnDoctor: {
    backgroundColor: COLORS.navyTintBg,
    borderColor: COLORS.navyTintBorder,
  },
  reviewModalIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewModalTargetTitle: {
    fontSize: 11.5,
    fontFamily: FONT_DISPLAY_SEMIBOLD,
    color: COLORS.textCoffee,
  },
  reviewModalTargetSubtitle: {
    fontSize: 9.5,
    fontFamily: FONT_BODY,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  reviewModalArrowCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* 9. 100% Human-Grade Standard */
  humanGradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F7EBE4',
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 16,
    marginBottom: 14,
  },
  shieldCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  humanGradeTitle: {
    fontSize: 13,
    fontFamily: FONT_DISPLAY_SEMIBOLD,
    color: COLORS.textCoffee,
  },
  humanGradeSub: {
    fontSize: 11,
    fontFamily: FONT_BODY,
    color: COLORS.textMuted,
    marginTop: 2,
  },

});
