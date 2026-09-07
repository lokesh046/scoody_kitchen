import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Dimensions,
  ActivityIndicator,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import {
  Search,
  ShoppingBag,
  Bell,
  SlidersHorizontal,
  Sparkles,
  ArrowRight,
  Flame,
  Leaf,
  Shield,
  Heart,
  Star,
  Plus,
  Minus,
  Check,
  Stethoscope,
  BookOpen,
  Truck,
  PawPrint,
  Building2,
  ShieldCheck,
  MessageSquare,
  Circle,
  Clock,
  Camera,
  Package,
  UtensilsCrossed,
  ChevronRight,
  CheckCircle2,
  X,
} from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { usePetStore } from '../store/petStore';
import { fetchProducts } from '../api/products';
import { fetchActiveBanners } from '../api/banners';
import { fetchRecentReviews, UnifiedReview } from '../api/reviews';
import { Product } from '../types';
import PetVisionModal from '../components/PetVisionModal';
import { NotificationModal } from '../components/NotificationModal';
import { BrandHeader } from '../components/BrandLogo';
import { fetchUnreadCount } from '../api/notifications';
import { BASE_URL } from '../api/client';
import { useResponsive } from '../hooks/useResponsive';
import ResponsiveContainer from '../components/ResponsiveContainer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - 32;

const DEFAULT_DOG_IMAGES = [
  'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1534361960057-19889db9621e?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&q=80&w=600',
];

interface HeroBanner {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  ctaText: string;
  targetScreen: string;
  bgImage: string;
}

const HERO_BANNERS: HeroBanner[] = [
  {
    id: '1',
    badge: '🌸 New Spring Release',
    title: 'Hand-crafted fresh meals & herbal supplements',
    subtitle: 'Steamed small-batch holistic nutrition crafted daily by clinical pet nutritionists and herbalists.',
    ctaText: 'Explore Spring Menu',
    targetScreen: 'Shop',
    bgImage: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=85&w=1200',
  },
  {
    id: '2',
    badge: 'Family Owned • Since 2016',
    title: "THE SCOOBY'S FAM: Honest Nutrition",
    subtitle: 'Come be a part of our family quest for thriving pets! Crafted with premium human-grade ingredients.',
    ctaText: 'Explore Kitchen',
    targetScreen: 'Shop',
    bgImage: 'https://images.unsplash.com/photo-1589924691106-07a3c22a12e7?auto=format&fit=crop&q=85&w=1200',
  },
  {
    id: '3',
    badge: '100% Veterinary Audited',
    title: 'Clinical Care & Tailored Diets',
    subtitle: 'Zero corn, wheat, or rendering byproducts. Schedule online consultations with certified veterinarians.',
    ctaText: 'Book Consultation',
    targetScreen: 'Consult',
    bgImage: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&q=85&w=1200',
  },
];

interface CoreService {
  id: string;
  badge: string;
  title: string;
  desc: string;
  icon: any;
  color: string;
  bg: string;
  borderColor: string;
  badgeBg: string;
  badgeColor: string;
  actionType: 'navigate' | 'vision' | 'chatbot';
  target?: string;
}

const CORE_SERVICES: CoreService[] = [
  {
    id: 'kitchen',
    badge: 'FARM FRESH',
    title: 'Fresh Kitchen',
    desc: 'Small-batch human-grade recipes cooked fresh daily at 4°C.',
    icon: UtensilsCrossed,
    color: '#D97706',
    bg: '#FFFBEB',
    borderColor: '#FDE68A',
    badgeBg: '#FEF3C7',
    badgeColor: '#92400E',
    actionType: 'navigate',
    target: 'Shop',
  },
  {
    id: 'telehealth',
    badge: '1-ON-1 VET',
    title: 'Vet Telehealth',
    desc: 'Certified holistic doctors online for video diet consultations.',
    icon: Stethoscope,
    color: '#059669',
    bg: '#ECFDF5',
    borderColor: '#A7F3D0',
    badgeBg: '#D1FAE5',
    badgeColor: '#065F46',
    actionType: 'navigate',
    target: 'Consult',
  },
  {
    id: 'orders',
    badge: 'TRACK ORDERS',
    title: 'My Orders',
    desc: 'Real-time kitchen delivery tracking & 1-tap fast reordering.',
    icon: Package,
    color: '#2563EB',
    bg: '#EFF6FF',
    borderColor: '#BFDBFE',
    badgeBg: '#DBEAFE',
    badgeColor: '#1E40AF',
    actionType: 'navigate',
    target: 'Orders',
  },
  {
    id: 'pets',
    badge: 'HEALTH LOGS',
    title: 'Pet Health Diary',
    desc: 'Manage medical history, vaccination calendar & allergy flags.',
    icon: PawPrint,
    color: '#DC2626',
    bg: '#FEF2F2',
    borderColor: '#FECACA',
    badgeBg: '#FEE2E2',
    badgeColor: '#991B1B',
    actionType: 'navigate',
    target: 'Pets',
  },
];

const FALLBACK_FAVORITES: Product[] = [
  {
    id: 101,
    name: 'Slow-Cooked Turkey & Pumpkin',
    description: 'Digestive comfort & gentle fiber balance',
    price: 380,
    is_active: true,
    category_id: 1,
    image_url: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 102,
    name: 'Chamomile & Lamb Calming Chew',
    description: 'Thunderstorm anxiety & restorative sleep blend',
    price: 450,
    is_active: true,
    category_id: 1,
    image_url: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 103,
    name: 'Atlantic Salmon & Omega Glaze',
    description: 'Joint flexibility & shiny coat nourishment',
    price: 420,
    is_active: true,
    category_id: 1,
    image_url: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=600&auto=format&fit=crop&q=80',
  },
];

const REVIEW_CARD_WIDTH = 260;
const REVIEW_CARD_GAP = 14;
const REVIEW_STRIDE = REVIEW_CARD_WIDTH + REVIEW_CARD_GAP;

interface BannerSlideItemProps {
  item: HeroBanner;
  onNavigate: (targetScreen: string) => void;
  slideWidth?: number;
  cardWidth?: number;
}

const BannerSlideItem = memo(function BannerSlideItem({
  item,
  onNavigate,
  slideWidth,
  cardWidth,
}: BannerSlideItemProps) {
  return (
    <View style={[styles.bannerSlideWrapper, slideWidth ? { width: slideWidth } : null]}>
      <View style={[styles.bannerSlide, cardWidth ? { width: cardWidth } : null]}>
        <Image source={{ uri: item.bgImage }} style={styles.bannerImage} fadeDuration={0} />
        <LinearGradient
          colors={['transparent', 'rgba(20,14,8,0.12)', 'rgba(20,14,8,0.72)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.bannerContent}>
          {/* Headline */}
          <Text style={styles.bannerTitle}>{item.title}</Text>

          {/* Subtitle */}
          <Text style={styles.bannerSub} numberOfLines={2}>
            {item.subtitle}
          </Text>

          {/* CTA Button */}
          <TouchableOpacity
            style={styles.bannerCtaBtn}
            onPress={() => onNavigate(item.targetScreen)}
            activeOpacity={0.88}
          >
            <Text style={styles.bannerCtaText}>{item.ctaText}</Text>
            <ArrowRight size={15} color="#FFFFFF" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

interface ProductFavoriteCardProps {
  product: Product;
  inCartItem?: { id: number; quantity: number };
  isFav: boolean;
  onToggleFavorite: (id: number) => void;
  onAddItem: (productId: number, quantity: number) => void;
  onUpdateQuantity: (itemId: number, quantity: number) => void;
  onRemoveItem: (itemId: number) => void;
  onSelectProduct: (productId: number) => void;
}

const ProductFavoriteCard = memo(function ProductFavoriteCard({
  product,
  inCartItem,
  isFav,
  onToggleFavorite,
  onAddItem,
  onUpdateQuantity,
  onRemoveItem,
  onSelectProduct,
}: ProductFavoriteCardProps) {
  const hasReviews = !!product.review_count && product.review_count > 0;
  const hasStockInfo = product.available_stock !== null && product.available_stock !== undefined;
  const isOutOfStock = hasStockInfo && product.available_stock === 0;

  return (
    <View style={styles.favoriteCard}>
      {/* Product Image & Badges */}
      <TouchableOpacity
        style={styles.cardImageContainer}
        onPress={() => onSelectProduct(product.id)}
        activeOpacity={0.9}
      >
        <Image
          source={{
            uri:
              product.image_url ||
              'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=400&auto=format&fit=crop&q=75',
          }}
          style={styles.cardProductImage}
          fadeDuration={0}
        />

        {/* Stock Badge — reflects the product's real available_stock, hidden when unknown */}
        {hasStockInfo && (
          <View style={[styles.stockTag, isOutOfStock && { backgroundColor: '#FEE2E2' }]}>
            <Text style={[styles.stockTagText, isOutOfStock && { color: '#B91C1C' }]}>
              {isOutOfStock ? 'OUT OF STOCK' : 'IN STOCK'}
            </Text>
          </View>
        )}

        {/* Heart Button */}
        <TouchableOpacity
          style={styles.heartCircle}
          onPress={() => onToggleFavorite(product.id)}
          activeOpacity={0.8}
        >
          <Heart
            size={14}
            color={isFav ? '#E11D48' : COLORS.textCoffee}
            fill={isFav ? '#E11D48' : 'none'}
          />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Card Body */}
      <View style={styles.cardBody}>
        <TouchableOpacity onPress={() => onSelectProduct(product.id)} activeOpacity={0.85}>
          {/* Rating (only shown once the recipe has real reviews) */}
          {hasReviews && (
            <View style={styles.ratingRow}>
              <Star size={13} color="#F59E0B" fill="#F59E0B" />
              <Text style={styles.ratingText}>
                {(product.average_rating ?? 0).toFixed(1)}{' '}
                <Text style={styles.reviewsCount}>
                  ({product.review_count} review{product.review_count === 1 ? '' : 's'})
                </Text>
              </Text>
            </View>
          )}

          {/* Product Title & Subtitle */}
          <Text style={styles.cardTitle} numberOfLines={1}>
            {product.name}
          </Text>
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {product.description || 'Digestive comfort & gentle fiber balance'}
          </Text>
        </TouchableOpacity>

        {/* Batch & Price + Add Button */}
        <View style={styles.cardFooter}>
          <View>
            {product.sku && <Text style={styles.batchLabel}>SKU: {product.sku}</Text>}
            <Text style={styles.cardPrice}>₹{product.price}</Text>
          </View>

          {inCartItem && inCartItem.quantity > 0 ? (
            /* Connected Quantity Stepper */
            <View style={styles.stepperContainer}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => {
                  if (inCartItem.quantity > 1) {
                    onUpdateQuantity(inCartItem.id, inCartItem.quantity - 1);
                  } else {
                    onRemoveItem(inCartItem.id);
                  }
                }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 4 }}
              >
                <Minus size={11} color="#FFFFFF" strokeWidth={2.6} />
              </TouchableOpacity>

              <Text style={styles.stepperQty}>{inCartItem.quantity}</Text>

              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => onUpdateQuantity(inCartItem.id, inCartItem.quantity + 1)}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 6 }}
              >
                <Plus size={11} color="#FFFFFF" strokeWidth={2.6} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.cardAddBtn}
              onPress={() => onAddItem(product.id, 1)}
              activeOpacity={0.85}
            >
              <Plus size={13} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.cardAddText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
});

interface ReviewCardItemProps {
  review: UnifiedReview;
  index: number;
  onOpenModal: (review: UnifiedReview) => void;
  onNavigateTarget: (review: UnifiedReview) => void;
}

const ReviewCardItem = memo(function ReviewCardItem({
  review,
  index,
  onOpenModal,
  onNavigateTarget,
}: ReviewCardItemProps) {
  const displayImage =
    review.image_url || DEFAULT_DOG_IMAGES[index % DEFAULT_DOG_IMAGES.length];

  return (
    <TouchableOpacity
      style={styles.reviewCard}
      onPress={() => onOpenModal(review)}
      activeOpacity={0.88}
    >
      {/* Review Picture with Badge */}
      <View style={styles.reviewImageWrap}>
        <Image
          source={{ uri: displayImage }}
          style={styles.reviewCardImg as any}
          fadeDuration={0}
        />
        <View
          style={[
            styles.reviewTypeBadge,
            review.type === 'doctor' ? styles.doctorTypeBadge : styles.productTypeBadge,
          ]}
        >
          <Text
            style={[
              styles.reviewTypeBadgeText,
              review.type === 'doctor' ? styles.doctorTypeText : styles.productTypeText,
            ]}
          >
            {review.type === 'doctor' ? '🩺 Vet Consult' : '🐾 Fresh Meal'}
          </Text>
        </View>
      </View>

      {/* Stars (#00B67A Emerald) */}
      <View style={styles.reviewStarRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={13}
            color="#00B67A"
            fill={star <= review.rating ? '#00B67A' : '#E5E7EB'}
          />
        ))}
      </View>

      {/* Review Comment Snippet */}
      <Text style={styles.reviewCommentSnippet} numberOfLines={3}>
        "{review.comment || 'Outstanding quality and nutrition for our companion.'}"
      </Text>

      {/* Review Footer with Author, Verified Check, and Actionable Item Link */}
      <View style={styles.reviewFooter}>
        <View style={styles.reviewAuthorRow}>
          <Text style={styles.reviewAuthorName} numberOfLines={1}>
            {review.author_name}
          </Text>
          {review.is_verified_buyer && (
            <CheckCircle2 size={13} color="#00B67A" />
          )}
        </View>

        <TouchableOpacity
          style={styles.reviewCardTargetLink}
          onPress={(e) => {
            e.stopPropagation?.();
            onNavigateTarget(review);
          }}
          activeOpacity={0.75}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
            {review.type === 'doctor' ? (
              <Stethoscope size={11} color="#1D4ED8" />
            ) : (
              <UtensilsCrossed size={11} color="#C27835" />
            )}
            <Text
              style={[
                styles.reviewTargetItem,
                review.type === 'doctor' && { color: '#1D4ED8' },
              ]}
              numberOfLines={1}
            >
              {review.reviewed_item_name}
            </Text>
          </View>
          <ChevronRight
            size={12}
            color={review.type === 'doctor' ? '#1D4ED8' : '#C27835'}
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

export default function HomeScreen({ navigation }: any) {
  const isFocused = useIsFocused();
  const { user } = useAuthStore();
  const { pets } = usePetStore();
  const { items, addItem, updateQuantity, removeItem, getTotalItems } = useCartStore();

  const [banners, setBanners] = useState<HeroBanner[]>(HERO_BANNERS);
  const [products, setProducts] = useState<Product[]>(FALLBACK_FAVORITES);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeBannerIndex, setActiveBannerIndex] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
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
  const toastTimerRef = useRef<any>(null);

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
  const carouselWidth = isTablet ? Math.min(windowWidth, 980) : windowWidth;
  const bannerCardWidth = isTablet ? carouselWidth - 48 : windowWidth - 32;
  const serviceCardWidth = isTablet
    ? (Math.min(contentWidth, 1040) - 32 - 12 * 3) / 4
    : (windowWidth - 32 - 12) / 2;
  const quickLinkWidth = isTablet
    ? (Math.min(contentWidth, 1040) - 32 - 10 * 3) / 4
    : (windowWidth - 42) / 2;

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
        const defaultBadges = [
          '🌸 New Spring Release',
          'Family Owned • Since 2016',
          '100% Veterinary Audited',
          'Fresh Daily Batch',
        ];
        const mapped: HeroBanner[] = bannersRes.value.map((b, idx) => {
          const isConsultation = (b.link_url || '').includes('consult');
          return {
            id: String(b.id),
            badge: defaultBadges[idx % defaultBadges.length],
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
      addItem(productId, quantity);
    },
    [addItem]
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
      reviewFilter !== 'all'
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
  }, [filteredReviews.length, selectedReviewModal, isFocused, reviewFilter]);

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

    autoPlayTimerRef.current = setInterval(() => {
      const nextIndex = currentIndexRef.current + 1;
      currentIndexRef.current = nextIndex;
      bannerListRef.current?.scrollToOffset({
        offset: nextIndex * carouselWidth,
        animated: true,
      });
    }, 4000);

    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 1. Header with Logo & Notification Controls */}
      <View style={styles.header}>
        <BrandHeader
          subtitle={primaryPet ? `Feeding ${primaryPet.name} 🐕` : 'CANINE NUTRITION LEDGER'}
          medallionSize="sm"
        />

        <View style={styles.headerActionIcons}>
          <TouchableOpacity
            style={styles.iconCircleBtn}
            onPress={() => handleNavigateScreen('Shop')}
            activeOpacity={0.8}
          >
            <Search size={18} color={COLORS.textCoffee} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconCircleBtn}
            onPress={() => handleNavigateScreen('Cart')}
            activeOpacity={0.8}
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
        {/* 2. Sub-Header Status Pills */}
        <View style={styles.statusPillsRow}>
          <View style={styles.statusPillLeft}>
            <Sparkles size={13} color={COLORS.brandGold} />
            <Text style={styles.statusPillLeftText}>SMALL-BATCH FARM FRESH</Text>
          </View>

          <View style={styles.statusPillRight}>
            <View style={styles.livePulseDot} />
            <Text style={styles.statusPillRightText}>Kitchen Warm & Prepping</Text>
          </View>
        </View>

        {/* 3. Search Bar with Filter Sliders */}
        <View style={styles.searchBarContainer}>
          <Search size={18} color={COLORS.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search fresh recipes, calming chews..."
            placeholderTextColor={COLORS.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => handleNavigateScreen('Shop')}
            returnKeyType="search"
          />
          <TouchableOpacity
            style={styles.filterBtn}
            onPress={() => handleNavigateScreen('Shop')}
            activeOpacity={0.8}
          >
            <SlidersHorizontal size={16} color={COLORS.textCoffee} />
          </TouchableOpacity>
        </View>

        {/* 4. Hero Banner Carousel with Infinite Loop & Progress Bar */}
        <View style={styles.bannerCarouselContainer}>
          <FlatList
            ref={bannerListRef}
            data={extendedBanners}
            keyExtractor={bannerKeyExtractor}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onBannerScrollEnd}
            getItemLayout={getBannerItemLayout}
            renderItem={renderBannerItem}
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            windowSize={3}
            removeClippedSubviews={Platform.OS === 'android'}
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

        {/* 5. Scooby Core Care & App Features Section */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Scooby Care & Services</Text>
            <Text style={styles.sectionSubtitle}>
              Integrated AI diagnostics, fresh kitchen & telehealth
            </Text>
          </View>
          <View style={styles.platformBadge}>
            <Sparkles size={11} color={COLORS.brandGold} />
            <Text style={styles.platformBadgeText}>AI ECOSYSTEM</Text>
          </View>
        </View>

        {/* Feature Spotlight: AI Pet Vision Scanner (ONNX Port 8003) */}
        <TouchableOpacity
          style={styles.visionSpotlightCard}
          onPress={() => setPetVisionVisible(true)}
          activeOpacity={0.88}
        >
          <View style={styles.visionSpotlightLeft}>
            <View style={styles.visionCameraIconWrapper}>
              <Camera size={22} color="#FFFFFF" />
              <View style={styles.visionPulseDot} />
            </View>
          </View>

          <View style={styles.visionSpotlightCenter}>
            <View style={styles.visionSpotlightBadgeRow}>
              <Text style={styles.visionSpotlightBadge}>AI PET VISION SCANNER</Text>
              <View style={styles.onnxMiniPill}>
                <Text style={styles.onnxMiniPillText}>8003 • ONNX</Text>
              </View>
            </View>
            <Text style={styles.visionSpotlightTitle}>Scan Pet & Diagnose Diet</Text>
            <Text style={styles.visionSpotlightDesc} numberOfLines={2}>
              Instant breed recognition, body condition score & personalized nutrition blueprint.
            </Text>
          </View>

          <View style={styles.visionScanArrowBtn}>
            <ArrowRight size={17} color="#FFFFFF" strokeWidth={2.4} />
          </View>
        </TouchableOpacity>

        {/* 2x2 Interactive Services Grid */}
        <View style={styles.servicesGrid}>
          {CORE_SERVICES.map((srv) => {
            const IconComp = srv.icon;
            return (
              <TouchableOpacity
                key={srv.id}
                style={[
                  styles.serviceCard,
                  {
                    width: serviceCardWidth,
                    backgroundColor: srv.bg,
                    borderColor: srv.borderColor,
                  },
                ]}
                onPress={() => {
                  if (srv.actionType === 'navigate' && srv.target) {
                    handleNavigateScreen(srv.target);
                  } else if (srv.actionType === 'vision') {
                    setPetVisionVisible(true);
                  } else if (srv.actionType === 'chatbot') {
                    navigation.navigate('Chatbot');
                  }
                }}
                activeOpacity={0.85}
              >
                <View style={styles.serviceCardTop}>
                  <View style={[styles.serviceIconWrap, { backgroundColor: '#FFFFFF' }]}>
                    <IconComp size={18} color={srv.color} strokeWidth={2.2} />
                  </View>
                  <View style={[styles.serviceMiniBadge, { backgroundColor: srv.badgeBg }]}>
                    <Text style={[styles.serviceMiniBadgeText, { color: srv.badgeColor }]}>
                      {srv.badge}
                    </Text>
                  </View>
                </View>

                <Text style={styles.serviceCardTitle}>{srv.title}</Text>
                <Text style={styles.serviceCardDesc} numberOfLines={2}>
                  {srv.desc}
                </Text>

                <View style={styles.serviceCardFooter}>
                  <Text style={[styles.serviceCardActionText, { color: srv.color }]}>
                    Explore
                  </Text>
                  <ChevronRight size={13} color={srv.color} strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 6. Kitchen Favorites Section */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Signature Recipes</Text>
            <Text style={styles.sectionSubtitle}>
              Prepared fresh at 4:00 AM & snap-chilled
            </Text>
          </View>
          <View style={styles.vetFormulatedBadge}>
            <Heart size={12} color={COLORS.forestGreen} />
            <Text style={styles.vetFormulatedText}>VET FORMULATED</Text>
          </View>
        </View>

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
            />
          ))}
        </ScrollView>

        {/* 7. Telehealth Apothecary Card (Dark Forest Green) */}
        <View style={styles.telehealthCard}>
          <View style={styles.telehealthHeaderRow}>
            <View style={styles.telehealthPill}>
              <Stethoscope size={13} color="#A7F3D0" />
              <Text style={styles.telehealthPillText}>TELEHEALTH APOTHECARY</Text>
            </View>

            <View style={styles.sessionPriceBadge}>
              <Text style={styles.sessionPriceText}>₹499 / session</Text>
            </View>
          </View>

          <Text style={styles.telehealthTitle}>
            Need expert clinical advice for diet or symptoms?
          </Text>

          <Text style={styles.telehealthSubtitle}>
            Certified holistic veterinarians ready in minutes for food allergies, digestion, and tailored recovery meals.
          </Text>

          <TouchableOpacity
            style={styles.findVetBtn}
            onPress={() => handleNavigateScreen('Consult')}
            activeOpacity={0.88}
          >
            <Stethoscope size={16} color="#FFFFFF" />
            <Text style={styles.findVetBtnText}>Find a Veterinarian</Text>
          </TouchableOpacity>
        </View>

        {/* 8. Community Feedback Ledger (Dynamic Reviews Carousel) — only shown once real reviews exist */}
        {reviews.length > 0 && (
          <>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Community Feedback Ledger</Text>
                <Text style={styles.sectionSubtitle}>Verified meal & consultation experiences</Text>
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
              >
                <Text style={[styles.reviewFilterText, reviewFilter === 'all' && styles.reviewFilterTextActive]}>
                  All ({reviews.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.reviewFilterPill, reviewFilter === 'product' && styles.reviewFilterPillActive]}
                onPress={() => setReviewFilter('product')}
                activeOpacity={0.8}
              >
                <Text style={[styles.reviewFilterText, reviewFilter === 'product' && styles.reviewFilterTextActive]}>
                  🐾 Meals ({productReviewsCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.reviewFilterPill, reviewFilter === 'doctor' && styles.reviewFilterPillActive]}
                onPress={() => setReviewFilter('doctor')}
                activeOpacity={0.8}
              >
                <Text style={[styles.reviewFilterText, reviewFilter === 'doctor' && styles.reviewFilterTextActive]}>
                  🩺 Vets ({doctorReviewsCount})
                </Text>
              </TouchableOpacity>
            </View>

            <FlatList
              key={reviewFilter}
              ref={reviewListRef}
              data={infiniteReviews}
              keyExtractor={reviewKeyExtractor}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.reviewsListScroll}
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
          </>
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

        {/* 10. 4 Quick Links Grid */}
        <View style={styles.quickLinksGrid}>
          <TouchableOpacity
            style={[styles.quickLinkItem, { width: quickLinkWidth }]}
            onPress={() => handleNavigateScreen('OrdersTab')}
            activeOpacity={0.8}
          >
            <Truck size={17} color={COLORS.textCoffee} />
            <Text style={styles.quickLinkText}>Track Order</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickLinkItem, { width: quickLinkWidth }]}
            onPress={() => handleNavigateScreen('Pets')}
            activeOpacity={0.8}
          >
            <PawPrint size={17} color={COLORS.textCoffee} />
            <Text style={styles.quickLinkText}>My Pets</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickLinkItem, { width: quickLinkWidth }]}
            onPress={() => handleNavigateScreen('Consult')}
            activeOpacity={0.8}
          >
            <Building2 size={17} color={COLORS.textCoffee} />
            <Text style={styles.quickLinkText}>Vet Partners</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickLinkItem, { width: quickLinkWidth }]}
            onPress={() => handleNavigateScreen('Shop')}
            activeOpacity={0.8}
          >
            <ShieldCheck size={17} color={COLORS.textCoffee} />
            <Text style={styles.quickLinkText}>Safety & QA</Text>
          </TouchableOpacity>
        </View>

        {/* 11. Footer Brand Signature */}
        <View style={styles.footerSignature}>
          <Text style={styles.footerLoveText}>
            Scooby Kitchen • Batched with Love in Bangalore & Portland
          </Text>
          <Text style={styles.footerLicenseText}>
            Clinical Veterinary License #SC-4891-PET
          </Text>
        </View>
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
        >
          <View style={styles.liveToastIconWrap}>
            <Sparkles size={16} color="#00B67A" />
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
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
              />

              <View style={styles.reviewModalBody}>
                {/* Meta Row: Non-overlapping Stars on left & Badge on right */}
                <View style={styles.reviewModalMetaRow}>
                  <View style={styles.reviewStarRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={15}
                        color="#00B67A"
                        fill={star <= selectedReviewModal.rating ? '#00B67A' : '#E5E7EB'}
                      />
                    ))}
                  </View>
                  <View
                    style={[
                      styles.reviewModalBadge,
                      selectedReviewModal.type === 'doctor'
                        ? styles.doctorTypeBadge
                        : styles.productTypeBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.reviewTypeBadgeText,
                        selectedReviewModal.type === 'doctor'
                          ? styles.doctorTypeText
                          : styles.productTypeText,
                      ]}
                    >
                      {selectedReviewModal.type === 'doctor' ? '🩺 Vet Consult' : '🐾 Fresh Meal'}
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
                          <CheckCircle2 size={11} color="#00B67A" />
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
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <View
                        style={[
                          styles.reviewModalIconCircle,
                          selectedReviewModal.type === 'doctor'
                            ? { backgroundColor: '#DBEAFE' }
                            : { backgroundColor: '#E2ECE9' },
                        ]}
                      >
                        {selectedReviewModal.type === 'doctor' ? (
                          <Stethoscope size={15} color="#1D4ED8" />
                        ) : (
                          <UtensilsCrossed size={15} color={COLORS.forestGreen} />
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
                          ? { backgroundColor: '#1D4ED8' }
                          : { backgroundColor: COLORS.forestGreen },
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
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EDE4D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.textCoffee,
  },
  brandSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
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
    borderColor: '#EFEBE4',
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
    fontWeight: '900',
    color: '#FFFFFF',
  },
  bellDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#00B67A',
  },
  bellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#00B67A',
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
    fontWeight: '900',
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
    borderColor: '#00B67A',
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
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveToastTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#2C1810',
  },
  liveToastMessage: {
    fontSize: 11,
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
    fontWeight: '800',
    color: '#FFFFFF',
  },

  /* 2. Sub-Header Status Pills */
  statusPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 10,
    gap: 8,
  },
  statusPillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FDF5EC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusPillLeftText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  statusPillRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6F1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#16A34A',
  },
  statusPillRightText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },

  /* 3. Search Bar */
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    borderWidth: 1,
    borderColor: '#EFEBE4',
    marginBottom: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textCoffee,
  },
  filterBtn: {
    padding: 4,
  },

  /* 4. Hero Banner Carousel */
  bannerCarouselContainer: {
    marginBottom: 20,
  },
  bannerSlideWrapper: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerSlide: {
    width: BANNER_WIDTH,
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'flex-end',
    padding: 18,
    backgroundColor: '#2C1810',
  },
  bannerImage: {
    ...StyleSheet.absoluteFill,
    resizeMode: 'cover',
  },
  bannerContent: {
    gap: 8,
    maxWidth: '90%',
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F5F1EA',
    lineHeight: 23,
  },
  bannerSub: {
    fontSize: 11,
    color: '#E5E7EB',
    lineHeight: 15,
  },
  bannerCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.forestGreen,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 4,
  },
  bannerCtaText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
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
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.textCoffee,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  viewAllLink: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.forestGreen,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  platformBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.5,
  },

  /* Feature Spotlight: AI Pet Vision Scanner */
  visionSpotlightCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: '#23160F',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#3D2619',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#2C1810',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  visionSpotlightLeft: {
    marginRight: 12,
  },
  visionCameraIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.forestGreen,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  visionPulseDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
    borderWidth: 1.5,
    borderColor: '#23160F',
  },
  visionSpotlightCenter: {
    flex: 1,
    gap: 3,
  },
  visionSpotlightBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  visionSpotlightBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FDE68A',
    letterSpacing: 0.6,
  },
  onnxMiniPill: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  onnxMiniPillText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#86EFAC',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  visionSpotlightTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  visionSpotlightDesc: {
    fontSize: 10.5,
    color: '#D1D5DB',
    lineHeight: 14,
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

  /* 2x2 Services Grid */
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 22,
  },
  serviceCard: {
    width: (SCREEN_WIDTH - 32 - 12) / 2,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    gap: 6,
    shadowColor: '#2C1810',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  serviceCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  serviceIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  serviceMiniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  serviceMiniBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  serviceCardTitle: {
    fontSize: 12.5,
    fontWeight: '900',
    color: COLORS.textCoffee,
  },
  serviceCardDesc: {
    fontSize: 10,
    color: COLORS.textMuted,
    lineHeight: 13.5,
  },
  serviceCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  serviceCardActionText: {
    fontSize: 10.5,
    fontWeight: '800',
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
    fontWeight: '800',
    color: COLORS.forestGreen,
    letterSpacing: 0.4,
  },
  favoritesCarousel: {
    paddingHorizontal: 16,
    gap: 14,
    paddingBottom: 6,
    marginBottom: 20,
  },
  favoriteCard: {
    width: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EFEBE4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardImageContainer: {
    width: '100%',
    height: 120,
    position: 'relative',
    backgroundColor: '#EAE1D5',
  },
  cardProductImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  stockTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stockTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.4,
  },
  heartCircle: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: 12,
    gap: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textCoffee,
  },
  reviewsCount: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textCoffee,
  },
  cardSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3EFE9',
  },
  batchLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  cardPrice: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.textCoffee,
  },
  cardAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#8B5A2B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cardAddText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.forestGreen,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 3,
    gap: 6,
  },
  stepperBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperQty: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    minWidth: 14,
    textAlign: 'center',
  },

  /* 7. Telehealth Apothecary Card */
  telehealthCard: {
    backgroundColor: '#274233',
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 18,
    gap: 12,
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
    fontWeight: '800',
    color: '#A7F3D0',
    letterSpacing: 0.5,
  },
  sessionPriceBadge: {
    backgroundColor: '#FDE68A',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sessionPriceText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#78350F',
  },
  telehealthTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 22,
  },
  telehealthSubtitle: {
    fontSize: 12,
    color: '#D1D5DB',
    lineHeight: 17,
  },
  findVetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#8B5A2B',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  findVetBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  /* 8. Community Feedback Ledger (Reviews Carousel) */
  trustpilotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00B67A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  trustpilotBadgeText: {
    fontSize: 10,
    fontWeight: '800',
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
    borderColor: '#EFEBE4',
  },
  reviewFilterPillActive: {
    backgroundColor: COLORS.forestGreen,
    borderColor: COLORS.forestGreen,
  },
  reviewFilterText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  reviewFilterTextActive: {
    color: '#FFFFFF',
  },
  reviewsListScroll: {
    paddingHorizontal: 16,
    gap: 14,
    marginBottom: 24,
  },
  reviewCard: {
    width: 250,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: '#EBE0D0',
    padding: 12,
    gap: 8,
    shadowColor: '#2C1810',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  reviewImageWrap: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F5EFE6',
  },
  reviewCardImg: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
  },
  reviewTypeBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  productTypeBadge: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  doctorTypeBadge: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  reviewTypeBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
  },
  productTypeText: {
    color: '#047857',
  },
  doctorTypeText: {
    color: '#1D4ED8',
  },
  reviewStarRow: {
    flexDirection: 'row',
    gap: 3,
  },
  reviewCommentSnippet: {
    fontSize: 11,
    color: COLORS.textCoffee,
    fontStyle: 'italic',
    lineHeight: 15,
  },
  reviewFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F3EFE9',
    paddingTop: 8,
    gap: 3,
  },
  reviewAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reviewAuthorName: {
    fontSize: 11.5,
    fontWeight: '800',
    color: COLORS.textCoffee,
  },
  reviewTargetItem: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#C27835',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  reviewCardTargetLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
    gap: 4,
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
    resizeMode: 'cover',
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
    fontWeight: '900',
    color: '#92400E',
  },
  reviewModalAuthorName: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textCoffee,
  },
  reviewModalItemName: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C27835',
    textTransform: 'uppercase',
  },
  reviewModalCommentScroll: {
    maxHeight: 120,
  },
  reviewModalCommentText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: COLORS.textCoffee,
    lineHeight: 18,
  },
  reviewModalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  verifiedBuyerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  verifiedBuyerTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#00B67A',
  },
  reviewModalDateText: {
    fontSize: 10,
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
    fontWeight: '800',
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
    backgroundColor: '#F3F8F5',
    borderColor: '#C7E4D7',
  },
  reviewModalLinkBtnDoctor: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
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
    fontWeight: '800',
    color: COLORS.textCoffee,
  },
  reviewModalTargetSubtitle: {
    fontSize: 9.5,
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
    fontWeight: '800',
    color: COLORS.textCoffee,
  },
  humanGradeSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  /* 10. 4 Quick Links Grid */
  quickLinksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 24,
  },
  quickLinkItem: {
    width: (SCREEN_WIDTH - 42) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FAF0E8',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  quickLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textCoffee,
  },

  /* 11. Footer */
  footerSignature: {
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 4,
    marginBottom: 10,
  },
  footerLoveText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  footerLicenseText: {
    fontSize: 10,
    color: COLORS.textLight,
    textAlign: 'center',
  },
});
