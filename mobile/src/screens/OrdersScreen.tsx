import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useFonts, Outfit_700Bold, Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import { Quicksand_400Regular, Quicksand_700Bold } from '@expo-google-fonts/quicksand';
import {
  Clock,
  MapPin,
  ChevronRight,
  UtensilsCrossed,
  CheckCircle2,
  XCircle,
  PackageOpen,
  ShieldCheck,
  KeyRound,
} from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { BrandMedallion } from '../components/BrandLogo';
import { fetchMyOrders, Order } from '../api/orders';
import { useAuthStore } from '../store/authStore';
import { tabPrefetchCache } from '../services/tabPrefetch';
import { useResponsive } from '../hooks/useResponsive';
import ResponsiveContainer from '../components/ResponsiveContainer';
import { isConfirmedAndPaid, isDelivered, isCancelled, getStatusBadgeStyle } from '../utils/orderStatus';
import { LEDGER_MONO, FONT_DISPLAY, FONT_DISPLAY_SEMIBOLD, FONT_BODY_BOLD } from '../theme/typography';

type FilterType = 'ALL' | 'CONFIRMED' | 'CANCELLED' | 'DELIVERED';

interface OrderCardItemProps {
  order: Order;
  onSelect: (orderId: number) => void;
}

const OrderCardItem = memo(function OrderCardItem({ order, onSelect }: OrderCardItemProps) {
  const badge = getStatusBadgeStyle(order.status);
  const dateStr = useMemo(() => {
    try {
      return new Date(order.created_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return order.created_at;
    }
  }, [order.created_at]);

  const handlePress = useCallback(() => {
    onSelect(order.id);
  }, [onSelect, order.id]);

  return (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {/* Order Top Line */}
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.orderIdText}>Order #{order.id}</Text>
          <View style={styles.dateRow}>
            <Clock size={12} color={COLORS.textLight} />
            <Text style={styles.dateText}>{dateStr}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.statusBadgeText, { color: badge.text }]}>
            {badge.label}
          </Text>
        </View>
      </View>

      {/* Items Summary Preview */}
      <View style={styles.itemsContainer}>
        {order.items && order.items.length > 0 ? (
          order.items.slice(0, 3).map((item, idx) => (
            <View key={item.id || idx} style={styles.itemRow}>
              <View style={styles.itemThumb}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.itemThumbImg} />
                ) : (
                  <UtensilsCrossed size={14} color={COLORS.brandGold} />
                )}
              </View>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.product_name || `Recipe #${item.product_id}`}
              </Text>
              <Text style={styles.itemQty}>x{item.quantity}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyItemsText}>Fresh Canine Recipe Order</Text>
        )}
        {order.items && order.items.length > 3 && (
          <Text style={styles.moreItemsText}>
            +{order.items.length - 3} more recipes in this order
          </Text>
        )}
      </View>

      {/* Address Snippet */}
      <View style={styles.addressRow}>
        <MapPin size={14} color={COLORS.brandGold} />
        <Text style={styles.addressText} numberOfLines={1}>
          {order.shipping_address}
        </Text>
      </View>

      {/* Bottom Financial & Tracking CTA */}
      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.totalLabel}>Total Payable</Text>
          <Text style={styles.totalAmount}>₹{Number(order.total_amount).toFixed(2)}</Text>
        </View>
        <View style={styles.trackCta}>
          <Text style={styles.trackCtaText}>Track & View Details</Text>
          <ChevronRight size={16} color={COLORS.forestGreen} />
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function OrdersScreen({ navigation }: any) {
  // Loads the brand faces once; Text using FONT_DISPLAY/FONT_BODY renders in
  // the system font until this resolves, then re-renders automatically.
  useFonts({ Outfit_700Bold, Outfit_600SemiBold, Quicksand_400Regular, Quicksand_700Bold });
  const { user, isGuest, logout } = useAuthStore();
  const { isTablet } = useResponsive();
  // Seeded from the app-boot prefetch (see services/tabPrefetch.ts) when
  // available, so this screen's first paint can show real orders instead of
  // an empty list + spinner while its own fetch is still in flight.
  const [orders, setOrders] = useState<Order[]>(() => tabPrefetchCache.orders || []);
  const [loading, setLoading] = useState(() => !tabPrefetchCache.orders);
  const [refreshing, setRefreshing] = useState(false);
  const [isAuthError, setIsAuthError] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('ALL');

  const ordersLastFetchedRef = useRef(tabPrefetchCache.ordersFetchedAt || 0);
  const loadOrders = useCallback(
    async (force = false) => {
      if (!user || isGuest) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      // Skip refetching if we already have a recent copy — avoids a redundant
      // network round-trip every time this tab regains focus.
      if (!force && Date.now() - ordersLastFetchedRef.current < 12000) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      try {
        const data = await fetchMyOrders();
        setOrders(data || []);
        setIsAuthError(false);
        ordersLastFetchedRef.current = Date.now();
      } catch (e: any) {
        console.log('Error loading orders:', e?.response?.status || e);
        if (e?.response?.status === 401) {
          setIsAuthError(true);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, isGuest]
  );

  // Initial load
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Synchronize orders automatically when user focuses the tab
  useFocusEffect(
    useCallback(() => {
      if (user && !isGuest) {
        loadOrders();
      }
    }, [user, isGuest, loadOrders])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadOrders(true);
  }, [loadOrders]);

  // Single-pass computation for counts and filtered list
  const { filteredOrders, confirmedCount, cancelledCount, deliveredCount } = useMemo(() => {
    let conf = 0;
    let cancel = 0;
    let del = 0;
    for (const o of orders) {
      if (isConfirmedAndPaid(o.status)) conf++;
      if (isCancelled(o.status)) cancel++;
      if (isDelivered(o.status)) del++;
    }
    const filtered = orders.filter((o) => {
      if (selectedFilter === 'CONFIRMED') return isConfirmedAndPaid(o.status);
      if (selectedFilter === 'CANCELLED') return isCancelled(o.status);
      if (selectedFilter === 'DELIVERED') return isDelivered(o.status);
      return true;
    });
    return {
      filteredOrders: filtered,
      confirmedCount: conf,
      cancelledCount: cancel,
      deliveredCount: del,
    };
  }, [orders, selectedFilter]);

  const handleOpenOrderDetail = useCallback(
    (orderId: number) => {
      navigation.navigate('OrderDetail', { orderId });
    },
    [navigation]
  );

  const renderOrderItem = useCallback(
    ({ item }: { item: Order }) => (
      <OrderCardItem order={item} onSelect={handleOpenOrderDetail} />
    ),
    [handleOpenOrderDetail]
  );

  const keyExtractor = useCallback((item: Order) => item.id.toString(), []);

  // Wrapped in useCallback so FlatList's ListEmptyComponent prop gets a
  // stable reference across renders instead of a brand-new function every
  // time — otherwise FlatList treats the empty-state subtree as changed.
  const renderEmptyComponent = useCallback(() => {
    if (!user || isGuest || isAuthError) {
      return (
        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyIconCircle}>
            <ShieldCheck size={48} color={COLORS.brandGold} />
          </View>
          <Text style={styles.emptyTitle}>
            {isAuthError ? 'Session Expired' : 'Sign In to View Orders'}
          </Text>
          <Text style={styles.emptySub}>
            {isAuthError
              ? 'Your login session has expired. Tap below to log in again and view your live orders ledger.'
              : 'Log in with your pet parent account to track live kitchen preparation and view official payment receipts.'}
          </Text>
          <TouchableOpacity
            style={styles.exploreBtn}
            onPress={() => logout()}
          >
            <KeyRound size={16} color="#FFFFFF" />
            <Text style={styles.exploreBtnText}>Sign In to Account</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.forestGreen} />
          <Text style={styles.loadingText}>Loading your orders...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyStateContainer}>
        <View style={styles.emptyIconCircle}>
          <PackageOpen size={48} color={COLORS.brandGold} />
        </View>
        <Text style={styles.emptyTitle}>
          {selectedFilter === 'ALL'
            ? 'No Orders Placed Yet'
            : selectedFilter === 'CANCELLED'
            ? 'No Cancelled Orders'
            : 'No Past Delivered Orders'}
        </Text>
        <Text style={styles.emptySub}>
          Fresh, veterinarian-designed canine recipes prepared in small batches are ready in the kitchen.
        </Text>
        <TouchableOpacity
          style={styles.exploreBtn}
          onPress={() => navigation.navigate('Kitchen')}
        >
          <UtensilsCrossed size={16} color="#FFFFFF" />
          <Text style={styles.exploreBtnText}>Explore Fresh Recipes</Text>
        </TouchableOpacity>
      </View>
    );
  }, [user, isGuest, isAuthError, loading, selectedFilter, logout, navigation]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <ResponsiveContainer maxWidth={880}>
        <View style={styles.header}>
          <View style={styles.headerLeftGroup}>
            <BrandMedallion size="sm" />
            <View style={styles.headerTextCol}>
              <View style={styles.brandRow}>
                <View style={styles.livePulseDot} />
                <Text style={styles.brandLabel}>OFFICIAL PURCHASES</Text>
              </View>
              <Text style={styles.headerTitle} numberOfLines={1}>Orders Ledger</Text>
            </View>
          </View>
          <View style={styles.headerActionIcons}>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{orders.length} Total</Text>
            </View>
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.85}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel="Open your profile"
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

        {/* Filter Tabs - Sticky above the list */}
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            <TouchableOpacity
              style={[styles.filterChip, selectedFilter === 'ALL' && styles.filterChipActive]}
              onPress={() => setSelectedFilter('ALL')}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={`All orders, ${orders.length}`}
              accessibilityState={{ selected: selectedFilter === 'ALL' }}
            >
              <Text style={[styles.filterText, selectedFilter === 'ALL' && styles.filterTextActive]}>
                All ({orders.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, selectedFilter === 'CONFIRMED' && styles.filterChipActive]}
              onPress={() => setSelectedFilter('CONFIRMED')}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={`Confirmed and paid orders, ${confirmedCount}`}
              accessibilityState={{ selected: selectedFilter === 'CONFIRMED' }}
            >
              <View style={styles.filterChipInner}>
                <CheckCircle2 size={13} color={selectedFilter === 'CONFIRMED' ? '#FFFFFF' : COLORS.forestGreen} />
                <Text style={[styles.filterText, selectedFilter === 'CONFIRMED' && styles.filterTextActive]}>
                  Confirmed & Paid ({confirmedCount})
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, selectedFilter === 'CANCELLED' && styles.filterChipActive]}
              onPress={() => setSelectedFilter('CANCELLED')}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={`Cancelled orders, ${cancelledCount}`}
              accessibilityState={{ selected: selectedFilter === 'CANCELLED' }}
            >
              <View style={styles.filterChipInner}>
                <XCircle size={13} color={selectedFilter === 'CANCELLED' ? '#FFFFFF' : '#DC2626'} />
                <Text style={[styles.filterText, selectedFilter === 'CANCELLED' && styles.filterTextActive]}>
                  Cancelled ({cancelledCount})
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, selectedFilter === 'DELIVERED' && styles.filterChipActive]}
              onPress={() => setSelectedFilter('DELIVERED')}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={`Delivered orders, ${deliveredCount}`}
              accessibilityState={{ selected: selectedFilter === 'DELIVERED' }}
            >
              <Text style={[styles.filterText, selectedFilter === 'DELIVERED' && styles.filterTextActive]}>
                Delivered ({deliveredCount})
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </ResponsiveContainer>

      {/* Virtualized Orders FlatList */}
      <FlatList
        data={loading || !user || isGuest || isAuthError ? [] : filteredOrders}
        keyExtractor={keyExtractor}
        renderItem={renderOrderItem}
        ListEmptyComponent={renderEmptyComponent}
        contentContainerStyle={[
          styles.scrollBody,
          isTablet && { maxWidth: 880, width: '100%', alignSelf: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.forestGreen]} />
        }
      />
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
    paddingVertical: 14,
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
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  brandLabel: { fontSize: 10, fontWeight: '800', color: COLORS.brandGold, letterSpacing: 1, fontFamily: FONT_BODY_BOLD },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textCoffee, fontFamily: FONT_DISPLAY },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  headerActionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  countBadge: {
    backgroundColor: '#FAF5EE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textCoffee,
  },
  avatarBtn: { marginLeft: 0 },
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
  filterRow: {
    backgroundColor: '#FAF7F2',
    paddingVertical: 10,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  filterChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: COLORS.forestGreen,
    borderColor: COLORS.forestGreen,
  },
  filterText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.textCoffee,
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollBody: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
    flexGrow: 1,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FAF5EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textCoffee,
    textAlign: 'center',
    fontFamily: FONT_DISPLAY_SEMIBOLD,
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.forestGreen,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  exploreBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  orderCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderIdText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textCoffee,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  dateText: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  itemsContainer: {
    backgroundColor: COLORS.canvas,
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemThumb: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemThumbImg: {
    width: '100%',
    height: '100%',
  },
  itemName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textCoffee,
  },
  itemQty: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.brandGold,
    fontFamily: LEDGER_MONO,
  },
  emptyItemsText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  moreItemsText: {
    fontSize: 10.5,
    color: COLORS.textLight,
    fontStyle: 'italic',
    marginTop: 2,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addressText: {
    flex: 1,
    fontSize: 11.5,
    color: COLORS.textMuted,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.kraftBorder,
    borderStyle: 'dashed',
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textLight,
    textTransform: 'uppercase',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textCoffee,
    fontFamily: LEDGER_MONO,
  },
  trackCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trackCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.forestGreen,
  },
});
