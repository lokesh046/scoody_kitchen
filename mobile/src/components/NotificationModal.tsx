import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
  Package,
  Stethoscope,
  Sparkles,
  Clock,
  CheckCheck,
  X,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react-native';
import {
  NotificationResponse,
  fetchMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../api/notifications';
import { useResponsive } from '../hooks/useResponsive';

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigateTarget?: (screen: string, params?: any) => void;
  onUnreadCountChange?: (count: number) => void;
}

const formatTimeAgo = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

export function NotificationModal({
  visible,
  onClose,
  onNavigateTarget,
  onUnreadCountChange,
}: NotificationModalProps) {
  const { isTablet, modalOverlayStyle, modalSheetContainerStyle } = useResponsive();
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'unread'>('all');

  const onUnreadCountChangeRef = useRef(onUnreadCountChange);
  onUnreadCountChangeRef.current = onUnreadCountChange;

  const loadData = useCallback(async (isPullToRefresh = false) => {
    if (isPullToRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await fetchMyNotifications(0, 20);
      const sorted = [...(data || [])].sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        if (timeA !== timeB) return timeB - timeA;
        return b.id - a.id;
      });
      setNotifications(sorted);
      const unread = sorted.filter((n) => !n.is_read).length;
      onUnreadCountChangeRef.current?.(unread);
    } catch {
      // Fallback: If network fails or user not logged in, keep existing or empty
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible, loadData]);

  const handleMarkRead = async (id: number) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    try {
      await markNotificationAsRead(id);
      const remainingUnread = notifications.filter((n) => n.id !== id && !n.is_read).length;
      onUnreadCountChangeRef.current?.(remainingUnread);
    } catch {
      // Revert if API fails
      loadData();
    }
  };

  const handleMarkAllRead = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    onUnreadCountChangeRef.current?.(0);

    try {
      await markAllNotificationsAsRead();
    } catch {
      loadData();
    } finally {
      setMarkingAll(false);
    }
  };

  const handleItemPress = (item: NotificationResponse) => {
    if (!item.is_read) {
      handleMarkRead(item.id);
    }

    const typeUpper = (item.type || '').toUpperCase();
    const link = item.link || '';

    if (link.includes('order') || typeUpper.includes('ORDER')) {
      onClose();
      onNavigateTarget?.('OrdersTab');
    } else if (
      link.includes('consult') ||
      link.includes('vet') ||
      typeUpper.includes('CONSULTATION') ||
      typeUpper.includes('DOCTOR')
    ) {
      onClose();
      onNavigateTarget?.('Consult');
    } else if (link.includes('kitchen') || link.includes('shop') || typeUpper.includes('PRODUCT')) {
      onClose();
      onNavigateTarget?.('Shop');
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filterTab === 'unread') return !n.is_read;
    return true;
  });

  const renderIcon = (type: string) => {
    const norm = (type || '').toUpperCase();
    if (norm.includes('ORDER')) {
      return (
        <View style={[styles.iconWrap, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
          <Package size={17} color="#00B67A" />
        </View>
      );
    }
    if (norm.includes('CONSULTATION') || norm.includes('DOCTOR') || norm.includes('VET')) {
      return (
        <View style={[styles.iconWrap, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
          <Stethoscope size={17} color="#2563EB" />
        </View>
      );
    }
    if (norm.includes('BROADCAST') || norm.includes('SYSTEM')) {
      return (
        <View style={[styles.iconWrap, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
          <Sparkles size={17} color="#D97706" />
        </View>
      );
    }
    return (
      <View style={[styles.iconWrap, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
        <Bell size={17} color="#C2410C" />
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={isTablet ? modalOverlayStyle : styles.overlay}>
        <TouchableOpacity
          style={isTablet ? StyleSheet.absoluteFill : styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <SafeAreaView
          edges={isTablet ? [] : ['bottom']}
          style={[
            styles.sheetContainer,
            isTablet && modalSheetContainerStyle,
            isTablet && { maxHeight: '80%', height: 640, minHeight: 400 },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <View style={styles.headerBadge}>
                <ShieldCheck size={11} color="#0D9488" />
                <Text style={styles.headerBadgeText}>ACTIVITY NOTIFICATIONS</Text>
              </View>
              <Text style={styles.headerTitle}>Notification Feed</Text>
            </View>

            <View style={styles.headerActions}>
              {unreadCount > 0 && (
                <TouchableOpacity
                  style={styles.markAllBtn}
                  onPress={handleMarkAllRead}
                  disabled={markingAll}
                  activeOpacity={0.7}
                >
                  <CheckCheck size={14} color="#00B67A" />
                  <Text style={styles.markAllText}>Mark all read</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color="#2C1810" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Filter Tabs */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, filterTab === 'all' && styles.tabBtnActive]}
              onPress={() => setFilterTab('all')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabText,
                  filterTab === 'all' && styles.tabTextActive,
                ]}
              >
                All ({notifications.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, filterTab === 'unread' && styles.tabBtnActive]}
              onPress={() => setFilterTab('unread')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabText,
                  filterTab === 'unread' && styles.tabTextActive,
                ]}
              >
                Unread ({unreadCount})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Body */}
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#00B67A" />
              <Text style={styles.loadingText}>Reading Notification Ledger...</Text>
            </View>
          ) : filteredNotifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Bell size={28} color="#00B67A" />
              </View>
              <Text style={styles.emptyTitle}>
                {filterTab === 'unread' ? 'All Caught Up! 🐾' : 'No Notifications Yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {filterTab === 'unread'
                  ? 'You have read all pending notifications in your feed.'
                  : 'Order and veterinary consultation activity updates will appear here.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredNotifications}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={7}
              removeClippedSubviews={Platform.OS === 'android'}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => loadData(true)}
                  tintColor="#00B67A"
                  colors={['#00B67A']}
                />
              }
              renderItem={({ item }) => {
                const isActionable =
                  Boolean(item.link) ||
                  item.type?.toUpperCase().includes('ORDER') ||
                  item.type?.toUpperCase().includes('CONSULTATION') ||
                  item.type?.toUpperCase().includes('DOCTOR');

                return (
                  <TouchableOpacity
                    style={[
                      styles.card,
                      !item.is_read && styles.cardUnread,
                    ]}
                    onPress={() => handleItemPress(item)}
                    activeOpacity={0.78}
                  >
                    {renderIcon(item.type)}

                    <View style={styles.cardBody}>
                      <View style={styles.cardHeaderRow}>
                        <Text
                          style={[
                            styles.cardTitle,
                            !item.is_read && styles.cardTitleBold,
                          ]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        <View style={styles.timeWrap}>
                          <Clock size={11} color="#8C7E74" />
                          <Text style={styles.timeText}>
                            {formatTimeAgo(item.created_at)}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.cardMessage} numberOfLines={3}>
                        {item.message}
                      </Text>

                      {isActionable && (
                        <View style={styles.actionRow}>
                          <Text style={styles.actionText}>
                            {item.type?.toUpperCase().includes('ORDER')
                              ? 'Track Order'
                              : item.type?.toUpperCase().includes('CONSULTATION') ||
                                item.type?.toUpperCase().includes('DOCTOR')
                              ? 'Open Consult'
                              : 'View Details'}
                          </Text>
                          <ChevronRight size={12} color="#0D9488" />
                        </View>
                      )}
                    </View>

                    {!item.is_read && <View style={styles.unreadDot} />}
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {/* Footer branding */}
          <View style={styles.footerBar}>
            <Text style={styles.footerBarText}>
              SCOOBY'S KITCHEN NOTIFICATION SYSTEM
            </Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 35, 61, 0.65)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#FAF7F2',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '86%',
    minHeight: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EBE0D0',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  headerBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0D9488',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2C1810',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  markAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00B67A',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBE0D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBE0D0',
  },
  tabBtnActive: {
    backgroundColor: '#2C1810',
    borderColor: '#2C1810',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#715D52',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 12,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#715D52',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2C1810',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#715D52',
    textAlign: 'center',
    lineHeight: 18,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: '#EFE8DE',
    gap: 12,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardUnread: {
    backgroundColor: '#FDFAF5',
    borderColor: '#C7E4D7',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 3,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2C1810',
    flex: 1,
    paddingRight: 6,
  },
  cardTitleBold: {
    fontWeight: '900',
  },
  timeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  timeText: {
    fontSize: 10,
    color: '#8C7E74',
  },
  cardMessage: {
    fontSize: 11.5,
    color: '#5C4A42',
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  actionText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0D9488',
    letterSpacing: 0.3,
  },
  unreadDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#00B67A',
  },
  footerBar: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#EBE0D0',
    alignItems: 'center',
    backgroundColor: '#FAF7F2',
  },
  footerBarText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#A8998C',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
