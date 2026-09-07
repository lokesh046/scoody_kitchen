import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Search,
  Flame,
  ShieldCheck,
  Check,
  ShoppingBag,
  X,
  PawPrint,
  AlertCircle,
  Plus,
  Minus,
  Star,
  CheckCircle2,
  MessageSquarePlus,
  Camera,
  Clock,
  Package,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFonts, Outfit_700Bold, Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import { Quicksand_400Regular, Quicksand_700Bold } from '@expo-google-fonts/quicksand';
import { COLORS } from '../theme/colors';
import { BrandMedallion } from '../components/BrandLogo';
import { Product, Category } from '../types';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { fetchCategories, fetchProducts } from '../api/products';
import {
  fetchProductReviews,
  submitProductReview,
  checkProductReviewEligibility,
  ProductReview,
  ReviewEligibilityResponse,
} from '../api/reviews';
import { useResponsive } from '../hooks/useResponsive';
import ResponsiveContainer from '../components/ResponsiveContainer';

const DEFAULT_DOG_IMAGES = [
  'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1534361960057-19889db9621e?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&q=80&w=600',
];

const LEDGER_MONO = Platform.OS === 'ios' ? 'Courier' : 'monospace';

function formatPrice(price: number | string): string {
  const n = typeof price === 'string' ? parseFloat(price) : price;
  if (Number.isNaN(n)) return String(price);
  return n.toFixed(2);
}

type StockBadgeInfo = { label: string; tone: 'in' | 'low' | 'out' } | null;

// available_stock is untracked (null/undefined) for recipes without live inventory
// counts, so those are treated as always in stock rather than flagged as a problem.
function getStockBadge(stock: number | null | undefined, lowThreshold: number | null | undefined): StockBadgeInfo {
  if (stock === null || stock === undefined) return { label: 'In Stock', tone: 'in' };
  if (stock <= 0) return { label: 'Out of Stock', tone: 'out' };
  if (stock <= (lowThreshold ?? 5)) return { label: `Low Stock (${stock} left)`, tone: 'low' };
  return { label: 'In Stock', tone: 'in' };
}

// DESIGN.md's brand faces: Outfit for display/headings, Quicksand for body copy.
const FONT_DISPLAY = 'Outfit_700Bold';
const FONT_DISPLAY_SEMIBOLD = 'Outfit_600SemiBold';
const FONT_BODY = 'Quicksand_400Regular';
const FONT_BODY_BOLD = 'Quicksand_700Bold';

interface RecipeCardItemProps {
  recipe: Product;
  inCartItem?: { id: number; quantity: number };
  isJustAdded: boolean;
  onSelectRecipe: (recipe: Product) => void;
  onAddToCart: (recipe: Product) => void;
  onUpdateQuantity: (cartId: number, quantity: number) => void;
  onRemoveItem: (cartId: number) => void;
}

const RecipeCardItem = memo(function RecipeCardItem({
  recipe,
  inCartItem,
  isJustAdded,
  onSelectRecipe,
  onAddToCart,
  onUpdateQuantity,
  onRemoveItem,
}: RecipeCardItemProps) {
  const displayImage =
    recipe.image_url ||
    (recipe.images && recipe.images.length > 0 ? recipe.images[0].image_url : null) ||
    'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=400&auto=format&fit=crop&q=75';

  const stockBadge = getStockBadge(recipe.available_stock, recipe.low_stock_threshold);
  const isOutOfStock = stockBadge?.tone === 'out';
  const hasReviews = !!recipe.review_count && recipe.review_count > 0;

  const liftAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(liftAnim, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 5 }).start();
  }, [liftAnim]);
  const handlePressOut = useCallback(() => {
    Animated.spring(liftAnim, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 5 }).start();
  }, [liftAnim]);

  const animatedCardStyle = {
    transform: [
      { translateY: liftAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
    ],
  };

  return (
    <Animated.View style={[styles.recipeCard, animatedCardStyle]}>
      {/* Full-width image block, its own section separate from the content below */}
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={() => onSelectRecipe(recipe)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.imageContainer}
      >
        <Image source={{ uri: displayImage }} style={styles.recipeImage} />
        {isOutOfStock && <View style={styles.imageOutOfStockDim} />}

        {stockBadge && (
          <View
            style={[
              styles.stockBadge,
              stockBadge.tone === 'low' && styles.stockBadgeLow,
              stockBadge.tone === 'out' && styles.stockBadgeOut,
            ]}
          >
            {stockBadge.tone === 'low' ? (
              <Clock size={10} color="#FFFFFF" strokeWidth={2.5} />
            ) : (
              <View style={styles.stockDot} />
            )}
            <Text style={styles.stockBadgeText}>{stockBadge.label}</Text>
          </View>
        )}
        {recipe.category && (
          <View style={styles.categoryTag}>
            <Text style={styles.categoryTagText} numberOfLines={1}>{recipe.category.name}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Content block below the image */}
      <TouchableOpacity
        style={styles.cardContent}
        onPress={() => onSelectRecipe(recipe)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
      >
        {hasReviews && (
          <View style={styles.cardRatingRow}>
            <Star size={12} color={COLORS.accentGold} fill={COLORS.accentGold} />
            <Text style={styles.cardRatingScore}>{(recipe.average_rating ?? 0).toFixed(1)}</Text>
            <Text style={styles.cardRatingReviews} numberOfLines={1}>({recipe.review_count})</Text>
            <View style={styles.verifiedDot} />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        )}
        <Text style={styles.recipeTitle} numberOfLines={1}>{recipe.name}</Text>
        {recipe.description ? (
          <Text style={styles.recipeDesc} numberOfLines={2}>
            {recipe.description}
          </Text>
        ) : null}

        {/* Price & Add to Cart Bar */}
        <View style={styles.footerRow}>
          <View style={styles.priceColumn}>
            <Text style={styles.priceText} numberOfLines={1}>₹{formatPrice(recipe.price)}</Text>
            <Text style={styles.unitText} numberOfLines={1}>per pouch</Text>
          </View>

          {!isJustAdded && !isOutOfStock && inCartItem && inCartItem.quantity > 0 ? (
            <View style={styles.cardStepperWrapper}>
              <TouchableOpacity
                style={styles.cardStepperBtn}
                onPress={() => {
                  if (inCartItem.quantity > 1) {
                    onUpdateQuantity(inCartItem.id, inCartItem.quantity - 1);
                  } else {
                    onRemoveItem(inCartItem.id);
                  }
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 6 }}
                activeOpacity={0.7}
              >
                <Minus size={12} color="#FFFFFF" strokeWidth={2.8} />
              </TouchableOpacity>

              <Text style={styles.cardStepperQty}>{inCartItem.quantity}</Text>

              <TouchableOpacity
                style={styles.cardStepperBtn}
                onPress={() => onUpdateQuantity(inCartItem.id, inCartItem.quantity + 1)}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
                activeOpacity={0.7}
              >
                <Plus size={12} color="#FFFFFF" strokeWidth={2.8} />
              </TouchableOpacity>
            </View>
          ) : (
            // Same TouchableOpacity across Add/Added/Out-of-Stock so tapping it
            // never swaps to a different component type mid-gesture (RN warns
            // "Ended a touch event which was not counted" when that happens).
            <TouchableOpacity
              style={[
                styles.addBtn,
                isOutOfStock && styles.addBtnDisabled,
                isJustAdded && styles.addBtnSuccess,
              ]}
              onPress={() => onAddToCart(recipe)}
              activeOpacity={0.85}
              disabled={isOutOfStock || isJustAdded}
            >
              {isOutOfStock ? (
                <Text style={styles.addBtnDisabledText}>Out of Stock</Text>
              ) : isJustAdded ? (
                <>
                  <Check size={15} color="#FFFFFF" strokeWidth={2.8} />
                  <Text style={styles.addBtnText}>Added</Text>
                </>
              ) : (
                <>
                  <ShoppingBag size={15} color="#FFFFFF" />
                  <Text style={styles.addBtnText}>Add to Bowl</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

interface RecipeReviewCardProps {
  review: ProductReview;
  idx: number;
  recipeName: string;
  recipeImage?: string | null;
  onInspect: (review: ProductReview) => void;
}

const RecipeReviewCard = memo(function RecipeReviewCard({
  review,
  idx,
  recipeName,
  recipeImage,
  onInspect,
}: RecipeReviewCardProps) {
  const displayImg =
    review.image_url ||
    recipeImage ||
    DEFAULT_DOG_IMAGES[idx % DEFAULT_DOG_IMAGES.length];
  const authorName = review.user?.first_name
    ? `${review.user.first_name} ${review.user.last_name || ''}`.trim()
    : 'Pet Parent';

  return (
    <TouchableOpacity
      style={styles.recipeReviewCard}
      onPress={() => onInspect(review)}
      activeOpacity={0.88}
    >
      {/* Top Image with Badge */}
      <View style={styles.recipeReviewImgWrap}>
        <Image source={{ uri: displayImg }} style={styles.recipeReviewImg as any} />
        <View style={styles.recipeReviewBadge}>
          <Text style={styles.recipeReviewBadgeText}>🐾 Verified Meal</Text>
        </View>
      </View>

      {/* Centered 5 Emerald Stars */}
      <View style={styles.recipeReviewStarRow}>
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            size={15}
            color="#00B67A"
            fill={s <= review.rating ? '#00B67A' : '#E5E7EB'}
          />
        ))}
      </View>

      {/* Centered Italicized Quote */}
      <Text style={styles.recipeReviewQuoteText} numberOfLines={3}>
        "{review.comment || 'good one very one can buy this product'}"
      </Text>

      {/* Footer with Divider, Author, Verified Badge & Recipe Name */}
      <View style={styles.recipeReviewFooter}>
        <View style={styles.recipeReviewAuthorRow}>
          <Text style={styles.recipeReviewAuthorName} numberOfLines={1}>
            {authorName}
          </Text>
          {review.is_verified_buyer && <CheckCircle2 size={13} color="#00B67A" />}
        </View>
        <Text style={styles.recipeReviewRecipeTag} numberOfLines={1}>
          RECIPE: {recipeName.toUpperCase()}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

export default function KitchenScreen({ navigation, route }: any) {
  // Loads the brand faces once; Text using FONT_DISPLAY/FONT_BODY renders in the
  // system font until this resolves, then re-renders automatically — no gate needed.
  useFonts({ Outfit_700Bold, Outfit_600SemiBold, Quicksand_400Regular, Quicksand_700Bold });
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Product | null>(null);
  const [selectedWeight, setSelectedWeight] = useState<string>('500g');
  const [addedNotice, setAddedNotice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [productReviews, setProductReviews] = useState<ProductReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState<boolean>(false);
  const [writeReviewVisible, setWriteReviewVisible] = useState<boolean>(false);
  const [inspectReviewModal, setInspectReviewModal] = useState<ProductReview | null>(null);
  const [newRating, setNewRating] = useState<number>(5);
  const [newReviewTitle, setNewReviewTitle] = useState<string>('');
  const [newReviewComment, setNewReviewComment] = useState<string>('');
  const [newReviewImage, setNewReviewImage] = useState<string | null>(null);
  const [reviewEligibility, setReviewEligibility] = useState<ReviewEligibilityResponse | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const lastAddTapRef = useRef<{ [productId: number]: number }>({});
  const modalScrollRef = useRef<ScrollView>(null);
  const modalBodyYRef = useRef<number>(0);
  const reviewsSectionYRef = useRef<number>(0);
  const pendingScrollToReviewsRef = useRef<boolean>(false);

  const reviewsRemaining = reviewEligibility
    ? Math.max(0, reviewEligibility.purchase_count - reviewEligibility.review_count)
    : 0;

  const { addItem, updateQuantity, removeItem, loadCart, items } = useCartStore();
  const { user } = useAuthStore();
  const searchTimeoutRef = useRef<any>(null);

  const { isTablet, modalOverlayStyle, modalSheetContainerStyle } = useResponsive();

  // Cart Map for O(1) quantity check per card instead of O(N) .find
  const cartMap = useMemo(() => {
    const map = new Map<number, { id: number; quantity: number }>();
    for (let i = 0; i < items.length; i++) {
      map.set(items[i].product_id, { id: items[i].id, quantity: items[i].quantity });
    }
    return map;
  }, [items]);

  // Memoized reviews breakdown calculation
  const reviewsSummary = useMemo(() => {
    if (productReviews.length === 0) {
      return {
        avg: null as string | null,
        count: 0,
        bars: [] as { star: number; pct: string; count: number }[],
      };
    }
    const total = productReviews.length;
    const avg = (productReviews.reduce((acc, r) => acc + r.rating, 0) / total).toFixed(1);
    const bars = [5, 4, 3, 2, 1].map((star) => {
      const cnt = productReviews.filter((r) => r.rating === star).length;
      const pct = `${total > 0 ? Math.round((cnt / total) * 100) : 0}%`;
      return { star, pct, count: cnt };
    });
    return { avg, count: total, bars };
  }, [productReviews]);

  const loadData = useCallback(
    async (customSearch?: string) => {
      setErrorMsg('');
      try {
        const activeSearch = typeof customSearch === 'string' ? customSearch : searchQuery;
        const [catsRes, prodsRes] = await Promise.all([
          fetchCategories().catch(() => []),
          fetchProducts({
            category_id: selectedCategoryId || undefined,
            search: activeSearch.trim() || undefined,
            limit: 30,
          }).catch(() => ({ items: [], total: 0, page: 1, pages: 1 })),
        ]);

        setCategories(catsRes);
        setProducts(prodsRes.items || []);
      } catch (err: any) {
        console.log('Error loading products from backend:', err);
        setErrorMsg('Could not load products from the backend API.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedCategoryId, searchQuery]
  );

  useEffect(() => {
    loadData();
    if (user) {
      loadCart();
    }
  }, [selectedCategoryId, user]);

  // Sync cart when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadCart();
      }
    }, [user, loadCart])
  );

  // Deep-link auto-select product recipe modal if navigated with productId
  useEffect(() => {
    if (route?.params?.productId && products.length > 0) {
      const targetId = Number(route.params.productId);
      const found = products.find((p) => p.id === targetId);
      if (found) {
        if (route.params.scrollToReviews) {
          pendingScrollToReviewsRef.current = true;
        }
        setSelectedRecipe(found);
      }
    }
  }, [route?.params?.productId, route?.params?.scrollToReviews, products]);

  // Once that recipe's real reviews have finished loading, jump straight to them
  useEffect(() => {
    if (pendingScrollToReviewsRef.current && selectedRecipe && !loadingReviews) {
      pendingScrollToReviewsRef.current = false;
      // Give the freshly-rendered reviews section a moment to finish laying out
      // before scrolling to the Y position measured from it.
      const timer = setTimeout(() => {
        modalScrollRef.current?.scrollTo({ y: reviewsSectionYRef.current, animated: true });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedRecipe, loadingReviews]);

  useEffect(() => {
    if (selectedRecipe) {
      loadProductReviews(selectedRecipe.id);
      if (user) {
        checkProductReviewEligibility(selectedRecipe.id)
          .then(setReviewEligibility)
          .catch(() => setReviewEligibility(null));
      } else {
        setReviewEligibility(null);
      }
    } else {
      setProductReviews([]);
      setReviewEligibility(null);
      setWriteReviewVisible(false);
    }
  }, [selectedRecipe, user]);

  const loadProductReviews = async (productId: number) => {
    try {
      setLoadingReviews(true);
      const res = await fetchProductReviews(productId);
      if (res && res.items) {
        setProductReviews(res.items);
      }
    } catch (e) {
      console.log('Error loading product reviews:', e);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleOpenWriteReview = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to your account to review this recipe.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => navigation?.navigate('Profile') },
      ]);
      return;
    }
    if (!selectedRecipe) return;

    try {
      const eligibility = await checkProductReviewEligibility(selectedRecipe.id);
      setReviewEligibility(eligibility);

      if (!eligibility.eligible) {
        if (eligibility.reason === 'no_purchase') {
          Alert.alert(
            'Verified Buyers Only 🐾',
            'You haven\'t ordered this recipe yet. To maintain trustworthy community ratings, only verified buyers can share reviews.\n\nWould you like to add this recipe to your cart?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Add to Cart 🛒',
                onPress: () => handleAddToCart(selectedRecipe),
              },
            ]
          );
        } else if (eligibility.reason === 'already_reviewed') {
          Alert.alert(
            `All Purchases Reviewed (${eligibility.purchase_count}/${eligibility.purchase_count}) ✓`,
            `You have already submitted ${eligibility.review_count} review(s) for your ${eligibility.purchase_count} purchase(s) of this recipe.\n\nEvery time you re-order, you unlock a new verified review slot! Would you like to re-order now?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Re-order Now 🛒',
                onPress: () => handleAddToCart(selectedRecipe),
              },
            ]
          );
        }
        return;
      }
      setWriteReviewVisible(true);
    } catch {
      setWriteReviewVisible(true);
    }
  };

  const handlePickReviewImage = async () => {
    Alert.alert('Attach Photo', 'Share a photo of your companion or fresh recipe bowl', [
      {
        text: 'Take Photo',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('Camera Permission Required', 'Please enable camera access to snap a photo.');
            return;
          }
          const res = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          });
          if (!res.canceled && res.assets && res.assets.length > 0) {
            setNewReviewImage(res.assets[0].uri);
          }
        },
      },
      {
        text: 'Choose from Gallery',
        onPress: async () => {
          const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          });
          if (!res.canceled && res.assets && res.assets.length > 0) {
            setNewReviewImage(res.assets[0].uri);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleReviewSubmit = async () => {
    if (!selectedRecipe) return;
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to submit a review for this recipe.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => navigation?.navigate('Profile') },
      ]);
      return;
    }
    if (!newReviewComment.trim()) {
      Alert.alert('Comment Required', 'Please write your experience in the review box.');
      return;
    }

    try {
      setIsSubmittingReview(true);
      const formData = new FormData();
      formData.append('rating', String(newRating));
      const fullText = newReviewTitle.trim()
        ? `${newReviewTitle.trim()}\n\n${newReviewComment.trim()}`
        : newReviewComment.trim();
      formData.append('comment', fullText);

      if (newReviewImage) {
        const uriParts = newReviewImage.split('.');
        const fileType = uriParts[uriParts.length - 1] || 'jpg';
        formData.append('image', {
          uri: newReviewImage,
          name: `review_${Date.now()}.${fileType}`,
          type: `image/${fileType.toLowerCase() === 'png' ? 'png' : 'jpeg'}`,
        } as any);
      }

      await submitProductReview(selectedRecipe.id, formData);
      Alert.alert('Review Published! 🐾', 'Thank you for sharing your feedback with the Scooby community.');
      setWriteReviewVisible(false);
      setNewReviewTitle('');
      setNewReviewComment('');
      setNewReviewImage(null);
      setNewRating(5);
      loadProductReviews(selectedRecipe.id);
    } catch (err: any) {
      Alert.alert('Submission Error', err?.response?.data?.detail || 'Failed to submit review. Please try again.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      loadData(text);
    }, 350);
  }, [loadData]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    loadData('');
  }, [loadData]);

  const handleSearch = useCallback(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
    if (user) {
      loadCart();
    }
  }, [loadData, user, loadCart]);

  const handleSelectRecipe = useCallback((recipe: Product) => {
    setSelectedRecipe(recipe);
  }, []);

  const handleInspectReview = useCallback((review: ProductReview) => {
    setInspectReviewModal(review);
  }, []);

  const handleUpdateQuantity = useCallback(
    (cartId: number, quantity: number) => {
      updateQuantity(cartId, quantity);
    },
    [updateQuantity]
  );

  const handleRemoveItem = useCallback(
    (cartId: number) => {
      removeItem(cartId);
    },
    [removeItem]
  );

  const handleAddToCart = useCallback(
    async (product: Product) => {
      if (!user) {
        Alert.alert(
          'Pet Parent Sign In Required',
          'Please sign in to add freshly cooked recipes to your database bowl ledger.',
          [
            { text: 'Keep Browsing', style: 'cancel' },
            { text: 'Go to Account', onPress: () => navigation?.navigate('Profile') },
          ]
        );
        return;
      }

      const now = Date.now();
      const lastTap = lastAddTapRef.current[product.id] || 0;
      if (now - lastTap < 1200) {
        return;
      }
      lastAddTapRef.current[product.id] = now;

      setAddedNotice(product.id);
      setTimeout(() => {
        setAddedNotice((current) => (current === product.id ? null : current));
      }, 1500);

      const productImg =
        product.image_url ||
        (product.images && product.images.length > 0 ? product.images[0].image_url : null);

      try {
        await addItem(product.id, 1, selectedWeight, {
          name: product.name,
          price: product.price,
          image_url: productImg,
          description: product.description,
        });
      } catch (err: any) {
        setAddedNotice((current) => (current === product.id ? null : current));
        delete lastAddTapRef.current[product.id];
        const msg = err.response?.data?.detail || 'Could not add recipe to server bowl.';
        Alert.alert('Bowl Sync Error', msg);
      }
    },
    [user, selectedWeight, addItem, navigation]
  );

  const renderRecipeItem = useCallback(
    ({ item }: { item: Product }) => (
      <RecipeCardItem
        recipe={item}
        inCartItem={cartMap.get(item.id)}
        isJustAdded={addedNotice === item.id}
        onSelectRecipe={handleSelectRecipe}
        onAddToCart={handleAddToCart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
      />
    ),
    [cartMap, addedNotice, handleSelectRecipe, handleAddToCart, handleUpdateQuantity, handleRemoveItem]
  );

  const keyExtractorRecipe = useCallback((item: Product) => String(item.id), []);

  const renderRecipeEmpty = useCallback(() => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.forestGreen} />
          <Text style={styles.loadingText}>Fetching recipes from backend...</Text>
        </View>
      );
    }
    if (errorMsg) {
      return (
        <View style={styles.errorContainer}>
          <AlertCircle size={28} color="#C25E48" />
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleSearch}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.centerContainer}>
        <PawPrint size={40} color={COLORS.brandGold} />
        <Text style={styles.emptyTitle}>No Recipes Found</Text>
        <Text style={styles.emptySub}>
          {selectedCategoryId
            ? 'No products found under this category in the database.'
            : 'No products currently available in the backend catalogue.'}
        </Text>
      </View>
    );
  }, [loading, errorMsg, selectedCategoryId, handleSearch]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeftGroup}>
          <BrandMedallion size="sm" />
          <View style={styles.headerTextCol}>
            <Text style={styles.headerHeadline} numberOfLines={1}>HEARTH & HOUND</Text>
          </View>
        </View>
        <View style={styles.headerActionIcons}>
          <TouchableOpacity
            style={styles.iconCircleBtn}
            onPress={() => navigation.navigate('Orders')}
            activeOpacity={0.8}
          >
            <Package size={17} color={COLORS.textCoffee} strokeWidth={1.8} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.85}
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

      <ResponsiveContainer style={styles.headerAreaContainer}>
        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <Search size={18} color={COLORS.textLight} />
          <TextInput
            placeholder="Search recipes, ingredients..."
            placeholderTextColor={COLORS.textLight}
            value={searchQuery}
            onChangeText={handleSearchChange}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            style={styles.searchInput}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={handleClearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color={COLORS.textLight} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Backend Categories Carousel */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
          nestedScrollEnabled={true}
        >
          <TouchableOpacity
            style={[styles.categoryPill, selectedCategoryId === null && styles.categoryPillActive]}
            onPress={() => setSelectedCategoryId(null)}
            activeOpacity={0.8}
          >
            <Text style={[styles.categoryText, selectedCategoryId === null && styles.categoryTextActive]}>
              All Recipes
            </Text>
          </TouchableOpacity>

          {categories.map((cat) => {
            const isActive = cat.id === selectedCategoryId;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                onPress={() => setSelectedCategoryId(cat.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </ResponsiveContainer>

      {/* Virtualized Recipe List — a single column of full-width rows, so no
          card ever fights a floating FAB or a neighboring column for space */}
      <FlatList
        data={loading || errorMsg ? [] : products}
        keyExtractor={keyExtractorRecipe}
        renderItem={renderRecipeItem}
        ListEmptyComponent={renderRecipeEmpty}
        contentContainerStyle={[
          styles.scrollBody,
          isTablet && { maxWidth: 720, width: '100%', alignSelf: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.forestGreen]} />
        }
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
      />

      {/* Recipe Detail Modal */}
      <Modal
        visible={!!selectedRecipe}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedRecipe(null)}
      >
        <View style={isTablet ? modalOverlayStyle : styles.modalBackdrop}>
          <View style={[styles.modalContent, isTablet && modalSheetContainerStyle]}>
            {selectedRecipe && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalHeaderTitle}>Recipe Details</Text>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setSelectedRecipe(null)}
                  >
                    <X size={20} color={COLORS.textCoffee} />
                  </TouchableOpacity>
                </View>

                <ScrollView ref={modalScrollRef} showsVerticalScrollIndicator={false}>
                  <Image
                    source={{
                      uri:
                        selectedRecipe.image_url ||
                        (selectedRecipe.images && selectedRecipe.images.length > 0
                          ? selectedRecipe.images[0].image_url
                          : 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600&auto=format&fit=crop&q=80'),
                    }}
                    style={styles.modalImage}
                  />

                  <View
                    style={styles.modalBody}
                    onLayout={(e) => {
                      modalBodyYRef.current = e.nativeEvent.layout.y;
                    }}
                  >
                    <Text style={styles.modalTitle}>{selectedRecipe.name}</Text>
                    {selectedRecipe.category && (
                      <Text style={styles.modalCategoryBadge}>{selectedRecipe.category.name}</Text>
                    )}
                    <Text style={styles.modalDescription}>
                      {selectedRecipe.description || 'Veterinary formulated complete canine fresh meal.'}
                    </Text>

                    {/* Pack Size Selector */}
                    <Text style={styles.sectionHeading}>Portion Size</Text>
                    <View style={styles.weightSelector}>
                      {['250g', '500g', '1kg', '2kg'].map((w) => (
                        <TouchableOpacity
                          key={w}
                          style={[
                            styles.weightPill,
                            selectedWeight === w && styles.weightPillActive,
                          ]}
                          onPress={() => setSelectedWeight(w)}
                        >
                          <Text
                            style={[
                              styles.weightText,
                              selectedWeight === w && styles.weightTextActive,
                            ]}
                          >
                            {w}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Customer Reviews Section (Matching Frontend Product Detail) */}
                    <View
                      style={styles.reviewsSectionHeader}
                      onLayout={(e) => {
                        reviewsSectionYRef.current = modalBodyYRef.current + e.nativeEvent.layout.y;
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={styles.sectionHeading}>Customer Reviews</Text>
                          {user && reviewEligibility && (
                            <View
                              style={[
                                styles.headerQuotaPill,
                                reviewsRemaining > 0
                                  ? styles.headerQuotaPillAvailable
                                  : reviewEligibility.reason === 'already_reviewed'
                                  ? styles.headerQuotaPillCompleted
                                  : styles.headerQuotaPillLocked,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.headerQuotaPillText,
                                  reviewsRemaining > 0
                                    ? styles.headerQuotaTextAvailable
                                    : reviewEligibility.reason === 'already_reviewed'
                                    ? styles.headerQuotaTextCompleted
                                    : styles.headerQuotaTextLocked,
                                ]}
                              >
                                {reviewsRemaining > 0
                                  ? `★ ${reviewsRemaining} Review Left`
                                  : reviewEligibility.reason === 'already_reviewed'
                                  ? `✓ Reviewed (${reviewEligibility.purchase_count}/${reviewEligibility.purchase_count})`
                                  : 'Verified Buyers'}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.reviewsSectionSub}>Verified customer ratings & feedback</Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.writeReviewTriggerBtn,
                          reviewsRemaining === 0 && reviewEligibility && { backgroundColor: '#78909C' },
                        ]}
                        onPress={handleOpenWriteReview}
                        activeOpacity={0.8}
                      >
                        <MessageSquarePlus size={13} color="#FFFFFF" />
                        <Text style={styles.writeReviewTriggerText}>
                          {reviewsRemaining > 0
                            ? `Write a Review (${reviewsRemaining})`
                            : 'Write a Review'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Reviews Summary & Star Breakdown Card — only shown once real reviews exist */}
                    {reviewsSummary.count > 0 ? (
                      <View style={styles.reviewsSummaryCard}>
                        <View style={styles.summaryLeftCol}>
                          <View style={styles.averageScoreRow}>
                            <Text style={styles.averageRatingScore}>
                              {reviewsSummary.avg}
                            </Text>
                            <Text style={styles.outOfFiveText}>out of 5</Text>
                          </View>
                          <View style={styles.summaryStarsRow}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star key={star} size={14} color="#00B67A" fill="#00B67A" />
                            ))}
                          </View>
                          <View style={styles.verifiedCountRow}>
                            <Text style={styles.basedOnText}>
                              Based on {reviewsSummary.count} reviews
                            </Text>
                            <CheckCircle2 size={12} color="#00B67A" />
                          </View>
                        </View>

                        {/* Star Breakdown Bars */}
                        <View style={styles.summaryBarsCol}>
                          {reviewsSummary.bars.map((b) => (
                            <View key={b.star} style={styles.breakdownRow}>
                              <Text style={styles.breakdownStarLabel}>{b.star}★</Text>
                              <View style={styles.breakdownTrack}>
                                <View style={[styles.breakdownFill, { width: b.pct as any }]} />
                              </View>
                              <Text style={styles.breakdownCountText}>{b.count}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : !loadingReviews ? (
                      <View style={styles.noReviewsBox}>
                        <Star size={20} color={COLORS.textLight} />
                        <Text style={styles.noReviewsText}>
                          No reviews yet — be the first to share your experience!
                        </Text>
                      </View>
                    ) : null}

                    {/* Product Reviews List - Horizontal Carousel */}
                    {loadingReviews ? (
                      <ActivityIndicator size="small" color={COLORS.forestGreen} style={{ marginVertical: 14 }} />
                    ) : productReviews.length > 0 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        nestedScrollEnabled={true}
                        contentContainerStyle={styles.recipeReviewsScroll}
                      >
                        {productReviews.map((pr, idx) => (
                          <RecipeReviewCard
                            key={pr.id}
                            review={pr}
                            idx={idx}
                            recipeName={selectedRecipe.name}
                            recipeImage={selectedRecipe.image_url}
                            onInspect={handleInspectReview}
                          />
                        ))}
                      </ScrollView>
                    ) : null}
                  </View>
                </ScrollView>

                {/* Modal Footer CTA */}
                <View style={styles.modalFooter}>
                  <View>
                    <Text style={styles.modalPrice}>₹{selectedRecipe.price}</Text>
                    <Text style={styles.modalWeightLabel}>{selectedWeight} Vacuum Sealed</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.modalAddBtn}
                    onPress={() => {
                      handleAddToCart(selectedRecipe);
                      setSelectedRecipe(null);
                    }}
                  >
                    <ShoppingBag size={18} color="#FFFFFF" />
                    <Text style={styles.modalAddText}>Add to Bowl</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Recipe Review Detail Inspection Modal */}
      {inspectReviewModal && (
        <Modal
          visible={!!inspectReviewModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setInspectReviewModal(null)}
        >
          <View style={styles.inspectModalOverlay}>
            <View style={styles.inspectModalCard}>
              <TouchableOpacity
                style={styles.inspectModalClose}
                onPress={() => setInspectReviewModal(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <X size={18} color={COLORS.textCoffee} />
              </TouchableOpacity>

              <Image
                source={{
                  uri:
                    inspectReviewModal.image_url ||
                    selectedRecipe?.image_url ||
                    DEFAULT_DOG_IMAGES[0],
                }}
                style={styles.inspectModalImage as any}
              />

              <View style={styles.inspectModalBody}>
                <View style={styles.inspectModalMetaRow}>
                  <View style={styles.inspectModalStarRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={16}
                        color="#00B67A"
                        fill={star <= inspectReviewModal.rating ? '#00B67A' : '#E5E7EB'}
                      />
                    ))}
                  </View>
                  <View style={styles.inspectModalBadge}>
                    <Text style={styles.inspectModalBadgeText}>🐾 Verified Meal</Text>
                  </View>
                </View>

                <View style={styles.inspectModalAuthorBlock}>
                  <View style={styles.inspectAuthorAvatar}>
                    <Text style={styles.inspectAuthorAvatarText}>
                      {inspectReviewModal.user?.first_name ? inspectReviewModal.user.first_name[0].toUpperCase() : 'P'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.inspectAuthorName}>
                        {inspectReviewModal.user?.first_name
                          ? `${inspectReviewModal.user.first_name} ${inspectReviewModal.user.last_name || ''}`.trim()
                          : 'Verified Customer'}
                      </Text>
                      {inspectReviewModal.is_verified_buyer && (
                        <View style={styles.headerQuotaPillAvailable}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#00B67A' }}>Verified</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.inspectDateText}>
                      {new Date(inspectReviewModal.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                </View>

                <ScrollView style={{ maxHeight: 110 }} showsVerticalScrollIndicator={false}>
                  <Text style={styles.inspectCommentText}>
                    "{inspectReviewModal.comment || 'good one very one can buy this product'}"
                  </Text>
                </ScrollView>

                <View style={styles.inspectRecipeTagRow}>
                  <Text style={styles.recipeReviewRecipeTag}>
                    RECIPE: {selectedRecipe?.name.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Write a Review Modal */}
      <Modal
        visible={writeReviewVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setWriteReviewVisible(false)}
      >
        <View style={isTablet ? modalOverlayStyle : styles.writeReviewOverlay}>
          <View style={[styles.writeReviewCard, isTablet && modalSheetContainerStyle]}>
            <View style={styles.writeReviewHeader}>
              <Text style={styles.writeReviewTitle}>Write a Review</Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setWriteReviewVisible(false)}
              >
                <X size={18} color={COLORS.textCoffee} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Verified Order Review Quota Card */}
              <View style={styles.reviewQuotaBanner}>
                <View style={styles.quotaIconWrap}>
                  <ShieldCheck size={18} color="#00B67A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.quotaBannerTitle}>
                    Verified Order Review #{(reviewEligibility?.review_count || 0) + 1}
                  </Text>
                  <Text style={styles.quotaBannerSub}>
                    {reviewsRemaining > 1
                      ? `You have ${reviewsRemaining} reviews left for your ${reviewEligibility?.purchase_count} verified orders`
                      : 'You have 1 review available for this verified purchase'}
                  </Text>
                </View>
                <View style={styles.quotaBadgePill}>
                  <Text style={styles.quotaBadgeText}>{reviewsRemaining} Left</Text>
                </View>
              </View>

              <Text style={styles.inputLabel}>Rating</Text>
              <View style={styles.ratingSelectorRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={styles.starSelectBtn}
                    onPress={() => setNewRating(s)}
                    activeOpacity={0.8}
                  >
                    <Star
                      size={26}
                      color="#00B67A"
                      fill={s <= newRating ? '#00B67A' : 'none'}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Title (Optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Loved the fresh ingredients!"
                placeholderTextColor={COLORS.textLight}
                value={newReviewTitle}
                onChangeText={setNewReviewTitle}
              />

              <Text style={styles.inputLabel}>Feedback</Text>
              <TextInput
                style={[styles.formInput, styles.formTextArea]}
                placeholder="Share your pet's experience with this recipe..."
                placeholderTextColor={COLORS.textLight}
                value={newReviewComment}
                onChangeText={setNewReviewComment}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <Text style={styles.inputLabel}>Photo Attachment (Optional)</Text>
              {newReviewImage ? (
                <View style={styles.reviewImagePreviewContainer}>
                  <Image source={{ uri: newReviewImage }} style={styles.reviewImagePreview as any} />
                  <TouchableOpacity
                    style={styles.reviewImageRemoveBtn}
                    onPress={() => setNewReviewImage(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={14} color="#FFFFFF" strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.reviewAttachImageBtn}
                  onPress={handlePickReviewImage}
                  activeOpacity={0.8}
                >
                  <Camera size={18} color={COLORS.forestGreen} />
                  <Text style={styles.reviewAttachImageText}>Add Photo of Companion / Recipe</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.submitReviewBtn, isSubmittingReview && { opacity: 0.7 }]}
                onPress={handleReviewSubmit}
                disabled={isSubmittingReview}
                activeOpacity={0.85}
              >
                {isSubmittingReview ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
                    <Text style={styles.submitReviewBtnText}>Submit Verified Review</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF7F2' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FAF7F2',
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  headerTextCol: { flex: 1, minWidth: 0 },
  headerHeadline: { fontSize: 19, fontWeight: '800', color: '#000000', fontFamily: FONT_DISPLAY },
  headerActionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  },
  avatarBtn: { marginLeft: 2 },
  avatarImg: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.forestGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  scrollBody: { paddingHorizontal: 20, paddingBottom: 30, gap: 14 },
  headerAreaContainer: { paddingTop: 8 },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.card,
    marginHorizontal: 20,
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.textCoffee, fontFamily: FONT_BODY },
  categoryScroll: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14, gap: 7 },
  categoryPill: {
    paddingHorizontal: 12,
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  categoryPillActive: { backgroundColor: COLORS.forestGreen, borderColor: COLORS.forestGreen },
  categoryText: {
    fontSize: 10,
    color: COLORS.brandGold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontFamily: FONT_BODY_BOLD,
  },
  categoryTextActive: { color: '#FFFFFF' },
  centerContainer: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  loadingText: { fontSize: 13, color: COLORS.textMuted, marginTop: 8, fontFamily: FONT_BODY },
  emptyTitle: { fontSize: 16, color: COLORS.textCoffee, fontFamily: FONT_DISPLAY_SEMIBOLD },
  emptySub: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', lineHeight: 18, fontFamily: FONT_BODY },
  errorContainer: { alignItems: 'center', padding: 30, gap: 10 },
  errorText: { fontSize: 13, color: '#991B1B', textAlign: 'center', fontFamily: FONT_BODY },
  retryBtn: { backgroundColor: COLORS.forestGreen, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  /* Floating Square Product Tile */
  /* Product card: full-width image block on top, content block below — each
     its own section — with a floating (elevated) ambient drop shadow. */
  recipeCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: COLORS.forestGreen,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  imageContainer: { width: '100%', aspectRatio: 1.7, position: 'relative' },
  recipeImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  imageOutOfStockDim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(249,246,240,0.6)' },
  stockBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.forestGreen,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  stockBadgeLow: { backgroundColor: COLORS.accentRed },
  stockBadgeOut: { backgroundColor: COLORS.textLight },
  stockDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  stockBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF', fontFamily: FONT_BODY_BOLD },
  categoryTag: {
    position: 'absolute',
    top: 12,
    right: 12,
    maxWidth: '55%',
    backgroundColor: COLORS.forestGreen,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  categoryTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: '#FFFFFF',
    fontFamily: FONT_BODY_BOLD,
  },

  cardContent: { padding: 18, paddingTop: 14, gap: 5 },
  cardRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  cardRatingScore: { fontSize: 13, fontWeight: '800', color: COLORS.textCoffee },
  cardRatingReviews: { fontSize: 12, color: COLORS.textMuted },
  verifiedDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: COLORS.successGreen, marginLeft: 2 },
  verifiedText: { fontSize: 12, fontWeight: '700', color: COLORS.successGreen },
  recipeTitle: { fontSize: 18, color: COLORS.textCoffee, fontFamily: FONT_DISPLAY_SEMIBOLD },
  recipeDesc: { fontSize: 13.5, color: COLORS.textMuted, lineHeight: 18, marginTop: 1, fontFamily: FONT_BODY },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.kraftBorder,
  },
  priceColumn: { gap: 1, flex: 1, minWidth: 0, marginRight: 10 },
  priceText: { fontSize: 19, fontWeight: '800', color: COLORS.textCoffee, fontFamily: LEDGER_MONO },
  unitText: { fontSize: 11, color: COLORS.textMuted, fontFamily: FONT_BODY },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 16,
    backgroundColor: COLORS.forestGreen,
    borderRadius: 21,
  },
  addBtnText: { fontSize: 13.5, fontWeight: '800', color: '#FFFFFF', fontFamily: FONT_BODY_BOLD },
  addBtnSuccess: { backgroundColor: COLORS.successGreen },
  addBtnDisabled: { backgroundColor: COLORS.kraftBorder, paddingHorizontal: 12 },
  addBtnDisabledText: { fontSize: 12, fontWeight: '800', color: COLORS.textMuted, fontFamily: FONT_BODY_BOLD },

  /* Recipe Card In-Place Quantity Stepper */
  cardStepperWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.forestGreen,
    borderRadius: 21,
    paddingHorizontal: 5,
    width: 108,
    height: 42,
    shadowColor: COLORS.forestGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  cardStepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardStepperQty: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    minWidth: 22,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  /* Modal Details */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.kraftBorder,
  },
  modalHeaderTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textCoffee },
  closeBtn: { padding: 4 },
  modalImage: { width: '100%', height: 180, resizeMode: 'cover' },
  modalBody: { padding: 20, gap: 14 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textCoffee },
  modalCategoryBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.brandGold,
    backgroundColor: '#FAF4EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  modalDescription: { fontSize: 13, color: COLORS.textMuted, lineHeight: 19 },
  sectionHeading: { fontSize: 14, fontWeight: '800', color: COLORS.textCoffee, marginTop: 6 },
  weightSelector: { flexDirection: 'row', gap: 10 },
  weightPill: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  weightPillActive: { backgroundColor: COLORS.forestGreen, borderColor: COLORS.forestGreen },
  weightText: { fontSize: 12, fontWeight: '700', color: COLORS.textCoffee },
  weightTextActive: { color: '#FFFFFF' },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderTopWidth: 1,
    borderTopColor: COLORS.kraftBorder,
    backgroundColor: COLORS.card,
  },
  modalPrice: { fontSize: 20, fontWeight: '800', color: COLORS.textCoffee },
  modalWeightLabel: { fontSize: 11, color: COLORS.textMuted },
  modalAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.forestGreen,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  modalAddText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  /* Customer Reviews Section in Recipe Modal */
  reviewsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 10,
  },
  reviewsSectionSub: {
    fontSize: 10.5,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  writeReviewTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#00B67A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  writeReviewTriggerText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  /* Reviews Summary & Star Breakdown Card */
  reviewsSummaryCard: {
    backgroundColor: '#FAF7F2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFEBE4',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  noReviewsBox: {
    backgroundColor: '#FAF7F2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFEBE4',
    padding: 20,
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  noReviewsText: {
    fontSize: 12.5,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  summaryLeftCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#EBE0D0',
    paddingRight: 10,
    gap: 3,
  },
  averageScoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  averageRatingScore: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.textCoffee,
  },
  outOfFiveText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  summaryStarsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  verifiedCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  basedOnText: {
    fontSize: 9.5,
    color: COLORS.textMuted,
  },
  summaryBarsCol: {
    flex: 1.3,
    gap: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  breakdownStarLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textCoffee,
    width: 18,
  },
  breakdownTrack: {
    flex: 1,
    height: 5,
    backgroundColor: '#EAE5DC',
    borderRadius: 3,
    overflow: 'hidden',
  },
  breakdownFill: {
    height: '100%',
    backgroundColor: '#00B67A',
    borderRadius: 3,
  },
  breakdownCountText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    width: 16,
    textAlign: 'right',
  },

  /* Product Reviews Cards Carousel (Matching Home & Screenshot) */
  recipeReviewsScroll: {
    paddingVertical: 6,
    gap: 14,
    paddingRight: 10,
    marginBottom: 20,
  },
  recipeReviewCard: {
    width: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: '#EBE0D0',
    padding: 12,
    gap: 10,
    shadowColor: '#2C1810',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  recipeReviewImgWrap: {
    width: '100%',
    height: 155,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F5EFE6',
  },
  recipeReviewImg: {
    width: '100%',
    height: 155,
    resizeMode: 'cover',
  },
  recipeReviewBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  recipeReviewBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#047857',
  },
  recipeReviewStarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3.5,
  },
  recipeReviewQuoteText: {
    fontSize: 11.5,
    fontStyle: 'italic',
    color: COLORS.textCoffee,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 4,
  },
  recipeReviewFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F3EFE9',
    paddingTop: 8,
    gap: 3,
    alignItems: 'center',
  },
  recipeReviewAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  recipeReviewAuthorName: {
    fontSize: 11.5,
    fontWeight: '800',
    color: COLORS.textCoffee,
  },
  recipeReviewRecipeTag: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#0D9488',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  /* Recipe Review Detail Inspection Modal */
  inspectModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23,35,61,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  inspectModalCard: {
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
  inspectModalClose: {
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
  inspectModalImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
    backgroundColor: '#F5EFE6',
  },
  inspectModalBody: {
    padding: 16,
    gap: 12,
  },
  inspectModalMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  inspectModalStarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  inspectModalBadge: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  inspectModalBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#047857',
  },
  inspectModalAuthorBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3EFE9',
    paddingBottom: 10,
  },
  inspectAuthorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inspectAuthorAvatarText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#92400E',
  },
  inspectAuthorName: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textCoffee,
  },
  inspectDateText: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  inspectCommentText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: COLORS.textCoffee,
    lineHeight: 18,
  },
  inspectRecipeTagRow: {
    borderTopWidth: 1,
    borderTopColor: '#F3EFE9',
    paddingTop: 10,
    alignItems: 'center',
  },

  /* Write a Review Modal */
  writeReviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23,35,61,0.65)',
    justifyContent: 'flex-end',
  },
  writeReviewCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  writeReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  writeReviewTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.textCoffee,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textCoffee,
    marginBottom: 6,
    marginTop: 10,
  },
  ratingSelectorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6,
  },
  starSelectBtn: {
    padding: 4,
  },
  formInput: {
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#EFEBE4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12.5,
    color: COLORS.textCoffee,
  },
  formTextArea: {
    height: 90,
  },
  reviewAttachImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F3F8F5',
    borderWidth: 1.2,
    borderColor: '#C7E4D7',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
  },
  reviewAttachImageText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.forestGreen,
  },
  reviewImagePreviewContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#EFEBE4',
  },
  reviewImagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  reviewImageRemoveBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#00B67A',
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 18,
    marginBottom: 10,
  },
  submitReviewBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerQuotaPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  headerQuotaPillAvailable: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  headerQuotaPillCompleted: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  headerQuotaPillLocked: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  headerQuotaPillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  headerQuotaTextAvailable: {
    color: '#00B67A',
  },
  headerQuotaTextCompleted: {
    color: '#4B5563',
  },
  headerQuotaTextLocked: {
    color: '#B45309',
  },
  reviewQuotaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F3F8F5',
    borderWidth: 1,
    borderColor: '#C7E4D7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  quotaIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quotaBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textCoffee,
  },
  quotaBannerSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  quotaBadgePill: {
    backgroundColor: '#00B67A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  quotaBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
