import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  ActivityIndicator,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
  RefreshControl,
  Modal,
  Animated,
  Easing,
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
  SlidersHorizontal,
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
  Package,
  UtensilsCrossed,
  ChevronRight,
  CheckCircle2,
  X,
} from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { FONT_DISPLAY, FONT_DISPLAY_SEMIBOLD, FONT_BODY, FONT_BODY_BOLD, LEDGER_MONO } from '../theme/typography';
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
    badge: 'Family Owned • Since 2016',
    title: 'Hearth & Hound: Small-Batch Nutrition',
    subtitle: 'Wholesome Chicken & Sweet Potato recipes hand-crafted with human-grade ingredients.',
    ctaText: 'Explore Kitchen',
    targetScreen: 'Shop',
    bgImage: 'https://res.cloudinary.com/utnenyxi/image/upload/v1788521361/scooby_kitchen/zfmzprttuoojru2qleeh.jpg',
  },
  {
    id: '2',
    badge: '100% Transparent',
    title: 'Honest Ingredients. Zero Filler.',
    subtitle: 'Every batch contains zero corn, wheat, soy, or synthetic preservatives. Tested by nutritionists.',
    ctaText: 'Explore Recipes',
    targetScreen: 'Shop',
    bgImage: 'https://res.cloudinary.com/utnenyxi/image/upload/v1788521353/scooby_kitchen/l0pkroz1l1dt6d0filb9.jpg',
  },
  {
    id: '3',
    badge: 'Farm Fresh',
    title: 'Farm-To-Bowl Holistic Meals',
    subtitle: 'Real whole-food chicken and farm-fresh sweet potatoes slow-cooked daily to nurture vitality.',
    ctaText: 'Explore Menu',
    targetScreen: 'Shop',
    bgImage: 'https://res.cloudinary.com/utnenyxi/image/upload/v1788521315/scooby_kitchen/nji85annhntaovsycm9q.jpg',
  },
  {
    id: '4',
    badge: 'High Protein',
    title: 'Raptor: All-Meat Diet',
    subtitle: 'Pure primal nutrition engineered for athletic endurance, lean muscle, and digestive resilience.',
    ctaText: 'View Recipe',
    targetScreen: 'Shop',
    bgImage: 'https://res.cloudinary.com/utnenyxi/image/upload/v1788521296/scooby_kitchen/fcw2fhniavnni3qracok.jpg',
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

// Each category is themed from one of DESIGN.md's four confirmed brand
// hues (turmeric/ochre, navy, sage, and the existing accentRed alert
// color) instead of unrelated generic amber/emerald/blue/red — Forest
// Green is deliberately left out of this grid entirely, since the Canopy
// Stamp Rule reserves it for real CTAs/warnings, not passive category tiles.
const CORE_SERVICES: CoreService[] = [
  {
    id: 'kitchen',
    badge: 'FARM FRESH',
    title: 'Shop Recipes',
    desc: 'Small-batch human-grade recipes cooked fresh daily at 4°C.',
    icon: UtensilsCrossed,
    color: COLORS.brandGold,
    bg: '#F9F6F4',
    borderColor: '#E3D6CA',
    badgeBg: '#EEE6DD',
    badgeColor: '#684521',
    actionType: 'navigate',
    target: 'Shop',
  },
  {
    id: 'telehealth',
    badge: '1-ON-1 VET',
    title: 'Vet Consults',
    desc: 'Certified holistic doctors online for video diet consultations.',
    icon: Stethoscope,
    color: COLORS.navy,
    bg: COLORS.navyTintBg,
    borderColor: COLORS.navyTintBorder,
    badgeBg: COLORS.navyTintBadgeBg,
    badgeColor: COLORS.navyTintText,
    actionType: 'navigate',
    target: 'Consult',
  },
  {
    id: 'orders',
    badge: 'TRACK ORDERS',
    title: 'My Orders',
    desc: 'Real-time kitchen delivery tracking & 1-tap fast reordering.',
    icon: Package,
    color: COLORS.sageIcon,
    bg: COLORS.sageTintBg,
    borderColor: COLORS.sageTintBorder,
    badgeBg: COLORS.sageTintBadgeBg,
    badgeColor: COLORS.sageTintText,
    actionType: 'navigate',
    target: 'Orders',
  },
  {
    id: 'pets',
    badge: 'HEALTH LOGS',
    title: 'Know Your Pet',
    desc: 'Manage medical history, vaccination calendar & allergy flags.',
    icon: PawPrint,
    color: COLORS.accentRed,
    bg: '#F9F5F4',
    borderColor: '#E2CECA',
    badgeBg: '#EEE0DD',
    badgeColor: '#672F22',
    actionType: 'navigate',
    target: 'Pets',
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
  const [imgUri, setImgUri] = useState(item.bgImage);

  useEffect(() => {
    setImgUri(item.bgImage);
  }, [item.bgImage]);

  return (
    <View style={[styles.bannerSlideWrapper, slideWidth ? { width: slideWidth } : null]}>
      <View style={[styles.bannerSlide, cardWidth ? { width: cardWidth } : null]}>
        <Image
          source={{ uri: imgUri }}
          style={styles.bannerImage}
          contentFit="cover"
          onError={() => {
            if (imgUri !== HERO_BANNERS[0].bgImage) {
              setImgUri(HERO_BANNERS[0].bgImage);
            }
          }}
        />
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
            accessibilityRole="button"
            accessibilityLabel={item.ctaText}
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
        accessibilityRole="button"
        accessibilityLabel={`View ${product.name}`}
      >
        <Image
          source={{
            uri:
              product.image_url ||
              'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=400&auto=format&fit=crop&q=75',
          }}
          style={styles.cardProductImage}
          contentFit="cover"
        />

        {/* Stock Badge — reflects the product's real available_stock, hidden when unknown */}
        {hasStockInfo && (
          <View style={[styles.stockTag, isOutOfStock && styles.stockTagOut]}>
            <Text style={[styles.stockTagText, isOutOfStock && styles.stockTagTextOut]}>
              {isOutOfStock ? 'OUT OF STOCK' : 'IN STOCK'}
            </Text>
          </View>
        )}

        {/* Heart Button */}
        <TouchableOpacity
          style={styles.heartCircle}
          onPress={() => onToggleFavorite(product.id)}
          activeOpacity={0.8}
          hitSlop={{ top: 9, bottom: 9, left: 9, right: 9 }}
          accessibilityRole="button"
          accessibilityLabel={isFav ? `Remove ${product.name} from favorites` : `Add ${product.name} to favorites`}
        >
          <Heart
            size={14}
            color={isFav ? COLORS.accentRed : COLORS.textCoffee}
            fill={isFav ? COLORS.accentRed : 'none'}
          />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Card Body */}
      <View style={styles.cardBody}>
        <TouchableOpacity
          onPress={() => onSelectProduct(product.id)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`View ${product.name}`}
        >
          {/* Rating (only shown once the recipe has real reviews) */}
          {hasReviews && (
            <View style={styles.ratingRow}>
              <Star size={13} color={COLORS.accentGold} fill={COLORS.accentGold} />
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
          <View style={styles.cardFooterLeft}>
            {product.sku && (
              <Text style={styles.batchLabel} numberOfLines={1}>
                SKU: {product.sku}
              </Text>
            )}
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
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={inCartItem.quantity > 1 ? `Decrease quantity of ${product.name}` : `Remove ${product.name} from cart`}
              >
                <Minus size={11} color="#FFFFFF" strokeWidth={2.6} />
              </TouchableOpacity>

              <Text style={styles.stepperQty}>{inCartItem.quantity}</Text>

              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => onUpdateQuantity(inCartItem.id, inCartItem.quantity + 1)}
                hitSlop={{ top: 12, bottom: 12, left: 10, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel={`Increase quantity of ${product.name}`}
              >
                <Plus size={11} color="#FFFFFF" strokeWidth={2.6} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.cardAddBtn}
              onPress={() => onAddItem(product.id, 1)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Add ${product.name} to cart`}
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
      accessibilityRole="button"
      accessibilityLabel={`View review by ${review.author_name}, ${review.rating} out of 5 stars`}
    >
      {/* Review Picture with Badge */}
      <View style={styles.reviewImageWrap}>
        <Image
          source={{ uri: displayImage }}
          style={styles.reviewCardImg as any}
          contentFit="cover"
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

      {/* Star rating (accentGold — same token as ProductFavoriteCard's stars) */}
      <View style={styles.reviewStarRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={13}
            color={COLORS.accentGold}
            fill={star <= review.rating ? COLORS.accentGold : COLORS.kraftBorder}
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
            <CheckCircle2 size={13} color={COLORS.sageIcon} />
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
          accessibilityRole="button"
          accessibilityLabel={review.type === 'doctor' ? 'View consultation details' : 'View product details'}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
            {review.type === 'doctor' ? (
              <Stethoscope size={11} color={COLORS.navy} />
            ) : (
              <UtensilsCrossed size={11} color="#C27835" />
            )}
            <Text
              style={[
                styles.reviewTargetItem,
                review.type === 'doctor' && { color: COLORS.navy },
              ]}
              numberOfLines={1}
            >
              {review.reviewed_item_name}
            </Text>
          </View>
          <ChevronRight
            size={12}
            color={review.type === 'doctor' ? COLORS.navy : '#C27835'}
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
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(true);
  // True only when the very first load came back empty or failed — a later
  // background refresh returning nothing doesn't retroactively invalidate
  // real products we're already successfully showing.
  const [productsLoadFailed, setProductsLoadFailed] = useState<boolean>(false);
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
        title: 'Welcome to Scooby’s Kitchen 🐾',
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

  // The AI Vision spotlight card communicates "this scans your pet" through
  // a camera-viewfinder motif (corner brackets + this sweeping line) instead
  // of a paragraph of copy — one authored motion moment, not a decorative
  // loop, so it stays a single continuous animation rather than restarting
  // visibly on every re-render.
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scanLineAnim]);

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
    <>
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
        {/* 3. Search Bar with Filter Sliders */}
        <View style={styles.searchBarContainer}>
          <Search size={18} color={COLORS.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search fresh recipes, calming chews..."
            placeholderTextColor={COLORS.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() =>
              handleNavigateScreen('Shop', searchQuery.trim() ? { searchQuery: searchQuery.trim() } : undefined)
            }
            returnKeyType="search"
          />
          <TouchableOpacity
            style={styles.filterBtn}
            onPress={() => handleNavigateScreen('Shop')}
            activeOpacity={0.8}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            accessibilityRole="button"
            accessibilityLabel="Filter search results"
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
            initialScrollIndex={banners.length > 1 ? 1 : 0}
            onMomentumScrollEnd={onBannerScrollEnd}
            getItemLayout={getBannerItemLayout}
            renderItem={renderBannerItem}
            initialNumToRender={3}
            maxToRenderPerBatch={3}
            windowSize={5}
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
            <View style={[styles.scanCorner, styles.scanCornerTL]} />
            <View style={[styles.scanCorner, styles.scanCornerTR]} />
            <View style={[styles.scanCorner, styles.scanCornerBL]} />
            <View style={[styles.scanCorner, styles.scanCornerBR]} />
            <View style={styles.visionCameraIconWrapper}>
              <Camera size={20} color="#FFFFFF" />
              <View style={styles.visionPulseDot} />
            </View>
            {/* Drawn after (on top of) the lens circle so the line visibly
                sweeps across it — placing it underneath left it fully
                hidden behind the opaque circle for its whole travel range,
                caught only by sampling several live frames, not a single
                screenshot. */}
            <Animated.View
              style={[
                styles.scanLine,
                {
                  opacity: scanLineAnim.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] }),
                  transform: [
                    {
                      translateY: scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 16] }),
                    },
                  ],
                },
              ]}
            />
          </View>

          <View style={styles.visionSpotlightCenter}>
            <Text style={styles.visionSpotlightTitle}>Scan & Diagnose</Text>
          </View>

          <View style={styles.visionScanArrowBtn}>
            <ArrowRight size={17} color="#FFFFFF" strokeWidth={2.4} />
          </View>
        </TouchableOpacity>

        {/* Core Services — Ledger Index. Each service is a full-width tab
            row (not a same-size icon+heading+text tile) so the description
            always has room to wrap in full instead of being clipped by a
            narrow grid column; the colored index tab riffs on DESIGN.md's
            own notebook Spine Motif rather than a generic accent border. */}
        <View style={styles.serviceLedger}>
          {CORE_SERVICES.map((srv) => {
            const IconComp = srv.icon;
            return (
              <TouchableOpacity
                key={srv.id}
                style={[
                  styles.serviceLedgerRow,
                  { backgroundColor: srv.bg, borderColor: srv.borderColor },
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
                accessibilityRole="button"
                accessibilityLabel={`${srv.title}: ${srv.desc}`}
              >
                <View style={[styles.serviceLedgerTab, { backgroundColor: srv.color }]} />

                <View style={[styles.serviceLedgerIconWrap, { borderColor: srv.color }]}>
                  <IconComp size={19} color={srv.color} strokeWidth={2.2} />
                </View>

                <View style={styles.serviceLedgerBody}>
                  <View style={styles.serviceLedgerTitleRow}>
                    <Text style={styles.serviceLedgerTitle}>{srv.title}</Text>
                    <View style={[styles.serviceMiniBadge, { backgroundColor: srv.badgeBg }]}>
                      <Text style={[styles.serviceMiniBadgeText, { color: srv.badgeColor }]}>
                        {srv.badge}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.serviceLedgerDesc}>{srv.desc}</Text>
                </View>

                <View style={[styles.serviceLedgerArrow, { backgroundColor: srv.color }]}>
                  <ArrowRight size={15} color="#FFFFFF" strokeWidth={2.4} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

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
              />
            ))}
          </ScrollView>
        )}

        {/* Meal Planner entry — mirrors web's persistent "Meal Planner"
            nav item / Home CTA (frontend/src/features/onboarding), a diet
            quiz usable any time rather than a first-run/signup gate. */}
        <View style={styles.mealPlannerCard}>
          <View style={styles.mealPlannerIconCircle}>
            <Sparkles size={22} color={COLORS.brandGold} />
          </View>
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

        {/* 7. Vet Consultation Card (Dark Forest Green). "Telehealth
            Apothecary" wasn't the right name for what this is — it's a vet
            consultation booking, so the badge says that plainly. The price
            pill is gone (rates vary by doctor and aren't fixed at ₹499), and
            the pulse-line glyph that replaces it in that slot says
            "clinical" through the design instead of another label. Copy
            trimmed to what a glance actually needs. */}
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
            Need expert vet advice?
          </Text>

          <Text style={styles.telehealthSubtitle}>
            Certified vets, ready in minutes.
          </Text>

          <TouchableOpacity
            style={styles.findVetBtn}
            onPress={() => handleNavigateScreen('Consult')}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Find a vet"
          >
            <Stethoscope size={16} color="#FFFFFF" />
            <Text style={styles.findVetBtnText}>Find a Vet</Text>
          </TouchableOpacity>
        </View>

        {/* 8. Community Feedback Ledger (Dynamic Reviews Carousel) — only shown once real reviews exist */}
        {reviews.length > 0 && (
          <View
            onLayout={(e) => {
              reviewsSectionYRef.current = e.nativeEvent.layout.y;
            }}
          >
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
                <Text style={[styles.reviewFilterText, reviewFilter === 'product' && styles.reviewFilterTextActive]}>
                  🐾 Meals ({productReviewsCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.reviewFilterPill, reviewFilter === 'doctor' && styles.reviewFilterPillActive]}
                onPress={() => setReviewFilter('doctor')}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: reviewFilter === 'doctor' }}
                accessibilityLabel={`Vet reviews, ${doctorReviewsCount}`}
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

        {/* 10. Footer Brand Signature */}
        <View style={styles.footerSignature}>
          <Text style={styles.footerLoveText}>
            Scooby Kitchen • Batched with Love in Bangalore & Portland
          </Text>
          <Text style={styles.footerLicenseText}>
            Clinical Veterinary License #SC-4891-PET
          </Text>
        </View>
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
                  <View style={styles.reviewStarRow}>
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
    borderColor: COLORS.kraftBorder,
    marginBottom: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONT_BODY,
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
    backgroundColor: COLORS.textCoffee,
  },
  bannerImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  bannerContent: {
    gap: 8,
    maxWidth: '90%',
  },
  bannerTitle: {
    fontSize: 18,
    fontFamily: FONT_DISPLAY,
    color: '#F5F1EA',
    lineHeight: 23,
  },
  bannerSub: {
    fontSize: 11,
    fontFamily: FONT_BODY,
    color: COLORS.kraftBorder,
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
    fontFamily: FONT_BODY_BOLD,
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
    fontFamily: FONT_DISPLAY,
    color: COLORS.brandGold, // Ochre Hierarchy Rule — main section headings on the light canvas
  },
  sectionSubtitle: {
    fontSize: 11,
    fontFamily: FONT_BODY,
    color: COLORS.textMuted,
    marginTop: 1,
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
    fontFamily: LEDGER_MONO,
    color: '#92400E',
    letterSpacing: 0.5,
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
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    // Rectangular clip only (no radius) — a rounded frame would cut the
    // crisp viewfinder corner brackets into curves at their outer tips.
    overflow: 'hidden',
  },
  scanCorner: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderColor: COLORS.brandGold,
  },
  scanCornerTL: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 6 },
  scanCornerTR: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 6 },
  scanCornerBL: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 6 },
  scanCornerBR: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 6 },
  scanLine: {
    position: 'absolute',
    width: 40,
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.brandGold,
  },
  visionCameraIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.forestGreen,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  visionPulseDot: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
    borderWidth: 1.5,
    borderColor: COLORS.forestDark,
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
    gap: 10,
  },
  serviceLedgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 12,
    shadowColor: COLORS.textCoffee,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  // A die-cut index tab riffing on DESIGN.md's notebook Spine Motif —
  // poking out past the card's own left edge like a filing divider,
  // instead of a flat inline accent border.
  serviceLedgerTab: {
    position: 'absolute',
    left: -8,
    top: '50%',
    marginTop: -15,
    width: 16,
    height: 30,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    shadowColor: '#000',
    shadowOffset: { width: -1, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 3,
  },
  serviceLedgerIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  serviceLedgerBody: {
    flex: 1,
    gap: 3,
  },
  serviceLedgerTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 7,
  },
  serviceLedgerTitle: {
    fontSize: 14,
    fontFamily: FONT_DISPLAY_SEMIBOLD,
    color: COLORS.textCoffee,
  },
  serviceMiniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  serviceMiniBadgeText: {
    fontSize: 8,
    fontFamily: LEDGER_MONO,
    letterSpacing: 0.4,
  },
  serviceLedgerDesc: {
    fontSize: 11.5,
    fontFamily: FONT_BODY,
    color: COLORS.textMuted,
    lineHeight: 16,
  },
  serviceLedgerArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
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
  favoriteCard: {
    width: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
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
  },
  stockTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: COLORS.sageTintBadgeBg, // Sage tint — DESIGN.md's sage is the documented "verified label" color, replacing generic Tailwind green
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stockTagOut: {
    backgroundColor: '#EEE0DD', // accentRed tint — the existing brand "Urgent/Alert" color, not generic red
  },
  stockTagText: {
    fontSize: 9,
    fontFamily: LEDGER_MONO,
    color: COLORS.sageTintText,
    letterSpacing: 0.4,
  },
  stockTagTextOut: {
    color: '#672F22',
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
    fontFamily: LEDGER_MONO,
    color: COLORS.textCoffee,
  },
  reviewsCount: {
    fontSize: 10,
    fontFamily: LEDGER_MONO,
    color: COLORS.textMuted,
  },
  cardTitle: {
    fontSize: 13,
    fontFamily: FONT_DISPLAY_SEMIBOLD,
    color: COLORS.textCoffee,
  },
  cardSubtitle: {
    fontSize: 11,
    fontFamily: FONT_BODY,
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
  // Lets the SKU/price block shrink and truncate instead of forcing the
  // row wider than the card — without this, a long SKU pushed the Add
  // button/stepper past the card's own right edge.
  cardFooterLeft: {
    flex: 1,
    marginRight: 8,
  },
  batchLabel: {
    fontSize: 9,
    fontFamily: LEDGER_MONO,
    color: COLORS.textLight,
  },
  cardPrice: {
    fontSize: 14,
    fontFamily: LEDGER_MONO,
    color: COLORS.textCoffee,
  },
  cardAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.ctaBrown,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    flexShrink: 0,
  },
  cardAddText: {
    fontSize: 12,
    fontFamily: FONT_BODY_BOLD,
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
    flexShrink: 0,
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
    fontFamily: LEDGER_MONO,
    color: '#FFFFFF',
    minWidth: 14,
    textAlign: 'center',
  },

  /* 7. Telehealth Apothecary Card */
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
    fontSize: 14,
    fontFamily: FONT_DISPLAY,
    color: COLORS.textCoffee,
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
    letterSpacing: -0.2,
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
  reviewFilterText: {
    fontSize: 11,
    fontFamily: LEDGER_MONO,
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
    shadowColor: COLORS.textCoffee,
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
    backgroundColor: COLORS.sageTintBadgeBg,
    borderColor: COLORS.sageLight,
  },
  doctorTypeBadge: {
    backgroundColor: COLORS.navyTintBg,
    borderColor: COLORS.navyTintBorder,
  },
  reviewTypeBadgeText: {
    fontSize: 8.5,
    fontFamily: LEDGER_MONO,
  },
  productTypeText: {
    color: COLORS.sageTintText,
  },
  doctorTypeText: {
    color: COLORS.navy,
  },
  reviewStarRow: {
    flexDirection: 'row',
    gap: 3,
  },
  reviewCommentSnippet: {
    fontSize: 11,
    fontFamily: FONT_BODY,
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
    fontFamily: FONT_DISPLAY_SEMIBOLD,
    color: COLORS.textCoffee,
  },
  reviewTargetItem: {
    fontSize: 9.5,
    fontFamily: LEDGER_MONO,
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

  /* 10. Footer */
  footerSignature: {
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 4,
    marginBottom: 10,
  },
  footerLoveText: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    fontFamily: FONT_BODY,
  },
  footerLicenseText: {
    fontSize: 10,
    color: COLORS.textLight,
    textAlign: 'center',
    fontFamily: LEDGER_MONO,
  },
});
