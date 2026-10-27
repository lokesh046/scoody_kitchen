import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Share,
  Alert,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Outfit_700Bold, Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import { Quicksand_400Regular, Quicksand_700Bold } from '@expo-google-fonts/quicksand';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import {
  Share2,
  CheckCircle2,
  Truck,
  Home,
  MapPin,
  UtensilsCrossed,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { fetchOrderById, fetchOrderTracking, Order, OrderItem, OrderTrackingResponse } from '../api/orders';
import ResponsiveContainer from '../components/ResponsiveContainer';
import { StackHeader } from '../components/ScreenHeader';
import { getStatusBadgeStyle } from '../utils/orderStatus';
import { getOptimizedImageUrl, IMAGE_SIZE } from '../utils/cloudinaryImage';
import { LEDGER_MONO, FONT_DISPLAY, FONT_DISPLAY_SEMIBOLD } from '../theme/typography';

// Determine milestone step index (0-3) outside component
const getStepIndex = (statusStr: string): number => {
  const s = (statusStr || '').toUpperCase();
  if (s === 'PENDING') return 0;
  if (s === 'PAID' || s === 'CONFIRMED') return 1;
  if (s === 'PROCESSING' || s === 'PREPARING') return 1;
  if (s === 'SHIPPED' || s === 'DISPATCHED' || s === 'IN_TRANSIT') return 2;
  if (s === 'DELIVERED' || s === 'COMPLETED') return 3;
  if (s === 'CANCELLED') return -1;
  return 1;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Loads the bundled logo as a data: URI so it renders inside the generated
// PDF without needing network access — expo-print's HTML renderer can't
// resolve a bare require()'d asset path, only inline data or real URLs.
let cachedLogoDataUri: string | null = null;
async function getLogoDataUri(): Promise<string | null> {
  if (cachedLogoDataUri) return cachedLogoDataUri;
  try {
    const asset = Asset.fromModule(require('../../assets/scooby-logo-256.png'));
    await asset.downloadAsync();
    const base64 = await FileSystem.readAsStringAsync(asset.localUri!, { encoding: FileSystem.EncodingType.Base64 });
    cachedLogoDataUri = `data:image/png;base64,${base64}`;
    return cachedLogoDataUri;
  } catch (e) {
    console.log('Could not load logo for receipt, continuing without it:', e);
    return null;
  }
}

// Renders the order as a branded, printable invoice (used to generate a PDF
// for sharing) instead of a plain text message.
function buildReceiptHtml(order: Order, formattedDate: string, logoDataUri: string | null): string {
  const itemsRows = order.items
    .map((item) => {
      const lineTotal = item.subtotal ?? Number(item.unit_price) * item.quantity;
      return `
        <tr>
          <td>
            <div class="item-name">${escapeHtml(item.product_name || `Recipe #${item.product_id}`)}</div>
            <div class="item-meta">${escapeHtml(item.selected_weight || 'Standard Pack')} &middot; Qty ${item.quantity}</div>
          </td>
          <td class="num">₹${Number(item.unit_price).toFixed(2)}</td>
          <td class="num">₹${Number(lineTotal).toFixed(2)}</td>
        </tr>`;
    })
    .join('');

  const subtotal = Number(order.total_amount) + Number(order.discount_amount || 0);

  const discountRow = order.discount_amount
    ? `<tr><td class="label">Coupon Discount${order.coupon_code ? ` (${escapeHtml(order.coupon_code)})` : ''}</td><td></td><td class="value num discount">-₹${Number(order.discount_amount).toFixed(2)}</td></tr>`
    : '';

  const paymentRefRow = order.razorpay_order_id
    ? `<tr><td class="label">Payment Ref</td><td class="value mono" colspan="2">${escapeHtml(order.razorpay_order_id)}</td></tr>`
    : '';

  const invoiceNumber = `INV-${String(order.id).padStart(6, '0')}`;
  const logoImg = logoDataUri
    ? `<img src="${logoDataUri}" class="logo" alt="Hearth & One" />`
    : '';

  return `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      html, body { height: 100%; }
      body {
        font-family: -apple-system, Helvetica, Arial, sans-serif;
        color: #2C1810;
        margin: 0;
        padding: 28px;
        background: #F4EFEB;
      }
      .sheet {
        max-width: 720px;
        margin: 0 auto;
        background: #FFFFFF;
        border: 1px solid #E6DFD5;
        border-radius: 14px;
        padding: 40px 44px;
      }
      .brand-row { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 2px solid #3F5E4D; padding-bottom: 20px; margin-bottom: 24px; }
      .brand-left { display: flex; align-items: center; gap: 12px; }
      .logo { width: 40px; height: 50px; object-fit: contain; }
      .brand-name { font-size: 20px; font-weight: 800; color: #3F5E4D; letter-spacing: 0.3px; }
      .brand-tag { font-size: 10.5px; color: #6E6259; margin-top: 1px; }
      .invoice-meta { text-align: right; }
      .invoice-title { font-size: 20px; font-weight: 800; color: #2C1810; letter-spacing: 1.5px; }
      .invoice-number { font-size: 12px; color: ${COLORS.brandGold}; font-weight: 700; margin-top: 2px; font-family: 'Courier New', monospace; }
      .meta-grid { display: flex; justify-content: space-between; margin-bottom: 26px; gap: 24px; }
      .meta-col { flex: 1; }
      .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: ${COLORS.brandGold}; font-weight: 800; margin-bottom: 6px; }
      .meta-value { font-size: 12.5px; line-height: 1.6; }
      .status-pill { display: inline-block; background: #EDF5F0; color: #3F5E4D; font-weight: 800; font-size: 10.5px; letter-spacing: 0.5px; padding: 4px 10px; border-radius: 12px; }
      .muted { color: #6E6259; font-size: 11px; }
      .section-title { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.6px; color: ${COLORS.brandGold}; font-weight: 800; margin: 24px 0 8px; }
      table { width: 100%; border-collapse: collapse; }
      thead th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #FFFFFF; background: #3F5E4D; padding: 9px 10px; }
      thead th:first-child { border-radius: 6px 0 0 6px; }
      thead th:last-child { border-radius: 0 6px 6px 0; }
      th.num, td.num { text-align: right; }
      tbody td { padding: 10px; border-bottom: 1px solid #F1ECE3; font-size: 12.5px; vertical-align: top; }
      tbody tr:nth-child(even) { background: #FAF8F5; }
      .item-name { font-weight: 700; }
      .item-meta { font-size: 11px; color: #6E6259; margin-top: 2px; }
      .totals { margin-top: 4px; }
      .totals td { border-bottom: none; padding: 4px 10px; font-size: 12.5px; }
      .totals .label { color: #6E6259; }
      .totals .value { text-align: right; }
      .discount { color: #3F5E4D; }
      .grand-row td { border-top: 1.5px solid #3F5E4D; padding-top: 10px; font-size: 15px; font-weight: 800; }
      .grand-row .num { color: #3F5E4D; }
      .address-box { background: #F9F6F0; border-radius: 10px; padding: 12px 16px; font-size: 12.5px; line-height: 1.5; }
      .mono { font-family: 'Courier New', monospace; font-size: 11px; }
      .footer { margin-top: 34px; padding-top: 18px; border-top: 1px solid #E6DFD5; text-align: center; font-size: 10.5px; color: #6E6259; line-height: 1.7; }
      .footer strong { color: #3F5E4D; }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="brand-row">
        <div class="brand-left">
          ${logoImg}
          <div>
            <div class="brand-name">Hearth &amp; One</div>
            <div class="brand-tag">Fresh, Human-Grade Canine Nutrition</div>
          </div>
        </div>
        <div class="invoice-meta">
          <div class="invoice-title">INVOICE</div>
          <div class="invoice-number">${invoiceNumber}</div>
        </div>
      </div>

      <div class="meta-grid">
        <div class="meta-col">
          <div class="meta-label">Billed To</div>
          <div class="meta-value">
            ${order.user_phone ? escapeHtml(order.user_phone) + '<br/>' : ''}
            ${escapeHtml(order.shipping_address)}
          </div>
        </div>
        <div class="meta-col" style="text-align: right;">
          <div class="meta-label">Invoice Details</div>
          <div class="meta-value">
            Date: ${escapeHtml(formattedDate)}<br/>
            Status: <span class="status-pill">${escapeHtml(order.status.toUpperCase())}</span>
          </div>
        </div>
      </div>

      <div class="section-title">Recipe Items</div>
      <table>
        <thead><tr><th>Item</th><th class="num">Unit</th><th class="num">Total</th></tr></thead>
        <tbody>${itemsRows}</tbody>
      </table>

      <table class="totals">
        <tr><td class="label">Fresh Meals Subtotal</td><td></td><td class="value num">₹${subtotal.toFixed(2)}</td></tr>
        ${discountRow}
        <tr><td class="label">Delivery Fee</td><td></td><td class="value num discount">FREE</td></tr>
        <tr class="grand-row"><td>Total Paid</td><td></td><td class="num">₹${Number(order.total_amount).toFixed(2)}</td></tr>
      </table>

      <div class="section-title">Payment</div>
      <table class="totals">
        <tr><td class="label">Gateway</td><td class="value" colspan="2">Razorpay Secure</td></tr>
        ${paymentRefRow}
      </table>

      <div class="footer">
        <strong>Hearth &amp; One</strong> &middot; 100% Verified Server Ledger &middot; Razorpay Authenticated<br/>
        Thank you for choosing Hearth &amp; One
      </div>
    </div>
  </body>
  </html>`;
}

interface OrderItemRowProps {
  item: OrderItem;
}

const OrderItemRow = memo(function OrderItemRow({ item }: OrderItemRowProps) {
  const itemSubtotal = item.subtotal || (Number(item.unit_price) * item.quantity);
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemImageContainer}>
        {item.image_url ? (
          <Image
            source={{ uri: getOptimizedImageUrl(item.image_url, IMAGE_SIZE.cardThumb, IMAGE_SIZE.cardThumb) }}
            style={styles.itemImage}
            contentFit="cover"
          />
        ) : (
          <UtensilsCrossed size={20} color={COLORS.brandGold} />
        )}
      </View>
      <View style={styles.itemDetails}>
        <Text style={styles.itemName}>{item.product_name || `Recipe #${item.product_id}`}</Text>
        <Text style={styles.itemPortion}>
          Portion: {item.selected_weight || 'Standard Pack'} • Qty: {item.quantity}
        </Text>
        <Text style={styles.itemUnitPrice}>₹{Number(item.unit_price).toFixed(2)} each</Text>
      </View>
      <Text style={styles.itemTotal}>₹{Number(itemSubtotal).toFixed(2)}</Text>
    </View>
  );
});

interface OrderDetailScreenProps {
  route?: any;
  navigation?: any;
}

export default function OrderDetailScreen({ route, navigation }: OrderDetailScreenProps) {
  // Loads the brand faces once; Text using FONT_DISPLAY/FONT_BODY renders in
  // the system font until this resolves, then re-renders automatically.
  useFonts({ Outfit_700Bold, Outfit_600SemiBold, Quicksand_400Regular, Quicksand_700Bold });
  const orderId = route?.params?.orderId;

  const [order, setOrder] = useState<Order | null>(null);
  const [tracking, setTracking] = useState<OrderTrackingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const loadOrderData = useCallback(async () => {
    try {
      setError(null);
      const [orderRes, trackingRes] = await Promise.allSettled([
        fetchOrderById(orderId),
        fetchOrderTracking(orderId),
      ]);

      if (orderRes.status === 'fulfilled') {
        setOrder(orderRes.value);
      } else {
        throw new Error("We couldn't load this order. Please try again.");
      }

      if (trackingRes.status === 'fulfilled') {
        setTracking(trackingRes.value);
      }
    } catch (err: any) {
      console.log('Error loading order details:', err);
      setError(err?.message || "Something went wrong while loading this order. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrderData();
  }, [loadOrderData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadOrderData();
  }, [loadOrderData]);

  const handleShareTextFallback = async () => {
    if (!order) return;
    const itemsList = order.items
      .map((i) => `• ${i.product_name || 'Recipe'} (${i.selected_weight || 'Regular'}) x${i.quantity} = ₹${i.subtotal || (Number(i.unit_price) * i.quantity)}`)
      .join('\n');

    const message = `🐾 Hearth & One - Order #${order.id} Receipt\n` +
      `Status: ${order.status.toUpperCase()}\n` +
      `Date: ${new Date(order.created_at).toLocaleDateString('en-IN')}\n\n` +
      `Items:\n${itemsList}\n\n` +
      `Total Paid: ₹${order.total_amount}\n` +
      `Delivery To: ${order.shipping_address}\n\n` +
      `Fresh, Human-Grade Canine Nutrition.`;

    await Share.share({ message, title: `Hearth & One Order #${order.id}` });
  };

  const handleShareReceipt = async () => {
    if (!order || isSharing) return;
    setIsSharing(true);
    try {
      const canShareFile = await Sharing.isAvailableAsync();
      if (!canShareFile) {
        await handleShareTextFallback();
        return;
      }

      const logoDataUri = await getLogoDataUri();
      const html = buildReceiptHtml(order, formattedDate, logoDataUri);

      // On Android, ask Print for the PDF as base64 instead of a file path.
      // Reading/copying the file it wrote directly (cacheDirectory/Print/...)
      // keeps getting rejected as unreadable — Expo Go appears to sandbox
      // that path per-module. Base64 sidesteps it entirely: expo-file-system
      // writes the bytes into a brand-new file it owns under documentDirectory,
      // so no module ever has to reach into another module's file. iOS has no
      // such restriction and can share Print's file:// URI directly.
      //
      // The resulting destUri is passed to Sharing.shareAsync as-is (a plain
      // file:// path) — NOT converted via FileSystem.getContentUriAsync.
      // That conversion produces a content:// URI, which this version of
      // expo-sharing rejects outright (ERR_SHARING_INVALID_ARGS: "expected
      // scheme to be 'file', got 'content'"), which is exactly what was
      // silently sending every share to the text fallback below.
      let shareUri: string;
      if (Platform.OS === 'android') {
        const { base64 } = await Print.printToFileAsync({ html, base64: true });
        const destUri = `${FileSystem.documentDirectory}hearth-and-one-order-${order.id}-receipt.pdf`;
        await FileSystem.writeAsStringAsync(destUri, base64!, { encoding: FileSystem.EncodingType.Base64 });
        shareUri = destUri;
      } else {
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        shareUri = uri;
      }

      await Sharing.shareAsync(shareUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Hearth & One Order #${order.id} Receipt`,
        UTI: 'com.adobe.pdf',
      });
    } catch (e) {
      console.log('Error generating/sharing PDF receipt, falling back to text:', e);
      try {
        await handleShareTextFallback();
      } catch (fallbackErr) {
        console.log('Error sharing receipt text fallback:', fallbackErr);
        Alert.alert(
          'Could not share receipt',
          'Something went wrong while preparing your receipt. Please check your connection and try again.',
        );
      }
    } finally {
      setIsSharing(false);
    }
  };

  const activeStatus = tracking?.order_status || order?.status || 'PAID';
  const currentStep = getStepIndex(activeStatus);
  const statusBadge = useMemo(() => getStatusBadgeStyle(activeStatus), [activeStatus]);

  const formattedDate = useMemo(() => {
    if (!order) return '';
    try {
      return new Date(order.created_at).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return order.created_at;
    }
  }, [order?.created_at]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.forestGreen} />
          <Text style={styles.loadingText}>Fetching order ledger #{orderId}...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StackHeader title="Order Details" onBack={() => navigation.goBack()} />
        <View style={styles.errorContainer}>
          <AlertCircle size={44} color="#C0392B" />
          <Text style={styles.errorTitle}>Order Not Found</Text>
          <Text style={styles.errorSub}>{error || 'Unable to retrieve order details.'}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={loadOrderData}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel="Retry loading this order"
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top App Bar */}
      <ResponsiveContainer maxWidth={880}>
        <StackHeader
          title={`Order #${order.id}`}
          eyebrow="OFFICIAL ORDER LEDGER"
          onBack={() => navigation.goBack()}
          rightContent={
            <TouchableOpacity
              onPress={handleShareReceipt}
              style={styles.shareBtn}
              disabled={isSharing}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Share order receipt"
              accessibilityState={{ disabled: isSharing, busy: isSharing }}
            >
              {isSharing ? (
                <ActivityIndicator size="small" color={COLORS.forestGreen} />
              ) : (
                <Share2 size={18} color={COLORS.forestGreen} />
              )}
            </TouchableOpacity>
          }
        />
      </ResponsiveContainer>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollBody}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.forestGreen]} />
        }
      >
        <ResponsiveContainer maxWidth={880} style={styles.sectionsColumn}>
        {/* Status Highlight Banner */}
        <View style={styles.statusBanner}>
          <View style={styles.statusBannerLeft}>
            <View style={[styles.statusPill, { backgroundColor: statusBadge.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: statusBadge.text }]} />
              <Text style={[styles.statusPillText, { color: statusBadge.text }]}>
                {statusBadge.label}
              </Text>
            </View>
            <Text style={styles.orderDateText}>{formattedDate}</Text>
          </View>
          <View style={styles.statusBannerRight}>
            <Text style={styles.orderTotalLabel}>Total Amount</Text>
            <Text style={styles.orderTotalAmount}>₹{Number(order.total_amount).toFixed(2)}</Text>
          </View>
        </View>

        {/* Milestone Progress Stepper */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Live Order Progress</Text>
          <View style={styles.stepperContainer}>
            {/* Step 1: Order Confirmed */}
            <View style={styles.stepRow}>
              <View style={styles.stepIconColumn}>
                <View style={[styles.stepDot, currentStep >= 0 && styles.stepDotCompleted]}>
                  <CheckCircle2 size={16} color="#FFFFFF" />
                </View>
                <View style={[styles.stepLine, currentStep >= 1 && styles.stepLineActive]} />
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepLabel}>Order Confirmed & Paid</Text>
                <Text style={styles.stepSub}>Payment verified and queued for the kitchen</Text>
                {order.razorpay_order_id && (
                  <Text style={styles.stepMeta}>Ref: {order.razorpay_order_id}</Text>
                )}
              </View>
            </View>

            {/* Step 2: Kitchen Preparing */}
            <View style={styles.stepRow}>
              <View style={styles.stepIconColumn}>
                <View
                  style={[
                    styles.stepDot,
                    currentStep >= 1 ? styles.stepDotCompleted : styles.stepDotPending,
                  ]}
                >
                  <UtensilsCrossed size={14} color={currentStep >= 1 ? '#FFFFFF' : COLORS.textMuted} />
                </View>
                <View style={[styles.stepLine, currentStep >= 2 && styles.stepLineActive]} />
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepLabel}>Kitchen Preparing Order</Text>
                <Text style={styles.stepSub}>Fresh, human-grade canine meals being prepared</Text>
              </View>
            </View>

            {/* Step 3: Out for Delivery */}
            <View style={styles.stepRow}>
              <View style={styles.stepIconColumn}>
                <View
                  style={[
                    styles.stepDot,
                    currentStep >= 2 ? styles.stepDotCompleted : styles.stepDotPending,
                  ]}
                >
                  <Truck size={14} color={currentStep >= 2 ? '#FFFFFF' : COLORS.textMuted} />
                </View>
                <View style={[styles.stepLine, currentStep >= 3 && styles.stepLineActive]} />
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepLabel}>Out for Delivery</Text>
                <Text style={styles.stepSub}>
                  {tracking?.shipment?.carrier
                    ? `Dispatched via ${tracking.shipment.carrier}`
                    : 'Courier pickup scheduled from kitchen'}
                </Text>
                {tracking?.shipment?.tracking_number && (
                  <Text style={styles.stepMeta}>AWB: {tracking.shipment.tracking_number}</Text>
                )}
              </View>
            </View>

            {/* Step 4: Delivered */}
            <View style={styles.stepRow}>
              <View style={styles.stepIconColumn}>
                <View
                  style={[
                    styles.stepDot,
                    currentStep >= 3 ? styles.stepDotCompleted : styles.stepDotPending,
                  ]}
                >
                  <Home size={14} color={currentStep >= 3 ? '#FFFFFF' : COLORS.textMuted} />
                </View>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepLabel}>Delivered</Text>
                <Text style={styles.stepSub}>Fresh meal safely delivered to your doorstep</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Confirmed & Paid Verification Section */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <ShieldCheck size={16} color={COLORS.forestGreen} />
              <Text style={styles.cardTitle}>Confirmed & Paid</Text>
            </View>
            <View style={styles.verifiedTag}>
              <CheckCircle2 size={12} color={COLORS.forestGreen} />
              <Text style={styles.verifiedTagText}>VERIFIED</Text>
            </View>
          </View>

          <View style={styles.confirmedBox}>
            <View style={styles.confirmedRow}>
              <Text style={styles.confirmedLabel}>Payment Status</Text>
              <Text style={styles.confirmedValueSuccess}>Payment Captured & Verified</Text>
            </View>
            <View style={styles.confirmedRow}>
              <Text style={styles.confirmedLabel}>Payment Gateway</Text>
              <Text style={styles.confirmedValue}>Razorpay Secure</Text>
            </View>
            {order.razorpay_order_id && (
              <View style={styles.confirmedRow}>
                <Text style={styles.confirmedLabel}>Razorpay Order Ref</Text>
                <Text style={styles.confirmedValueMono}>{order.razorpay_order_id}</Text>
              </View>
            )}
            <View style={styles.confirmedRow}>
              <Text style={styles.confirmedLabel}>Verification Date</Text>
              <Text style={styles.confirmedValue}>{formattedDate}</Text>
            </View>
            <View style={styles.confirmedDivider} />
            <View style={styles.confirmedRow}>
              <Text style={styles.confirmedLabelBold}>Amount Settled</Text>
              <Text style={styles.confirmedValueTotal}>₹{Number(order.total_amount).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Real Backend Timeline Log (If history available) */}
        {tracking?.timeline && tracking.timeline.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Activity Ledger ({tracking.timeline.length} events)</Text>
            {tracking.timeline.map((event, idx) => (
              <View key={idx} style={styles.timelineRow}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineStatus}>{event.status.toUpperCase()}</Text>
                  <Text style={styles.timelineDesc}>{event.description}</Text>
                  <Text style={styles.timelineTime}>
                    {new Date(event.timestamp).toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Courier & Shipment Details Card (If available) */}
        {tracking?.shipment && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Shipment Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Courier Partner</Text>
              <Text style={styles.infoValue}>{tracking.shipment.carrier || tracking.shipment.provider}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tracking / AWB</Text>
              <Text style={styles.infoValueHighlight}>{tracking.shipment.tracking_number}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Shipment Status</Text>
              <Text style={styles.infoValue}>{tracking.shipment.status.toUpperCase()}</Text>
            </View>
          </View>
        )}

        {/* Recipe Itemization Ledger */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recipe Items ({order.items.length})</Text>
          {order.items.map((item, idx) => (
            <OrderItemRow key={item.id || idx} item={item} />
          ))}
        </View>

        {/* Delivery Address Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery Address</Text>
          <View style={styles.addressRow}>
            <MapPin size={18} color={COLORS.forestGreen} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addressText}>{order.shipping_address}</Text>
              {order.user_phone && (
                <Text style={styles.addressPhone}>Recipient: {order.user_phone}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Pricing Breakdown Ledger */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Breakdown</Text>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Fresh Meals Subtotal</Text>
            <Text style={styles.billValue}>
              ₹{Number(order.total_amount + (order.discount_amount || 0)).toFixed(2)}
            </Text>
          </View>
          {order.discount_amount ? (
            <View style={styles.billRow}>
              <Text style={[styles.billLabel, { color: COLORS.forestGreen }]}>
                Coupon Discount {order.coupon_code ? `(${order.coupon_code})` : ''}
              </Text>
              <Text style={[styles.billValue, { color: COLORS.forestGreen }]}>
                -₹{Number(order.discount_amount).toFixed(2)}
              </Text>
            </View>
          ) : null}
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Delivery Fee</Text>
            <Text style={[styles.billValue, { color: COLORS.forestGreen, fontWeight: '700' }]}>
              FREE
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Paid</Text>
            <Text style={styles.totalValue}>₹{Number(order.total_amount).toFixed(2)}</Text>
          </View>
          <View style={styles.paymentVerifiedBadge}>
            <ShieldCheck size={14} color={COLORS.forestGreen} />
            <Text style={styles.paymentVerifiedText}>
              100% Verified Server Ledger • Razorpay Authenticated
            </Text>
          </View>
        </View>

        {/* Bottom Actions */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[styles.shareReceiptBtn, isSharing && styles.shareReceiptBtnDisabled]}
            onPress={handleShareReceipt}
            disabled={isSharing}
            accessibilityRole="button"
            accessibilityLabel="Share order receipt"
            accessibilityState={{ disabled: isSharing, busy: isSharing }}
          >
            {isSharing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Share2 size={16} color="#FFFFFF" />
            )}
            <Text style={styles.shareReceiptText}>
              {isSharing ? 'Preparing Receipt…' : 'Share Order Receipt'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backHomeBtn}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Kitchen' })}
          >
            <Text style={styles.backHomeText}>Back to Kitchen Menu</Text>
          </TouchableOpacity>
        </View>
        </ResponsiveContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF7F2' },
  shareBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#EDF5F0',
  },
  scrollBody: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionsColumn: {
    gap: 14,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textCoffee,
    fontFamily: FONT_DISPLAY_SEMIBOLD,
  },
  errorSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.forestGreen,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  statusBanner: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBannerLeft: {
    gap: 6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  orderDateText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  statusBannerRight: {
    alignItems: 'flex-end',
  },
  orderTotalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  orderTotalAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textCoffee,
    fontFamily: LEDGER_MONO,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    gap: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: COLORS.brandGold,
    textTransform: 'uppercase',
    fontFamily: LEDGER_MONO,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDF5F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  verifiedTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.forestGreen,
    letterSpacing: 0.5,
  },
  confirmedBox: {
    backgroundColor: COLORS.canvas,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  confirmedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmedLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  confirmedLabelBold: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textCoffee,
  },
  confirmedValue: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textCoffee,
  },
  confirmedValueSuccess: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.forestGreen,
  },
  confirmedValueMono: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.brandGold,
    fontFamily: LEDGER_MONO,
  },
  confirmedValueTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.forestGreen,
    fontFamily: LEDGER_MONO,
  },
  confirmedDivider: {
    height: 0,
    borderTopWidth: 1,
    borderTopColor: COLORS.kraftBorder,
    borderStyle: 'dashed',
    marginVertical: 2,
  },
  stepperContainer: {
    gap: 4,
    marginTop: 4,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 14,
  },
  stepIconColumn: {
    alignItems: 'center',
    width: 28,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotCompleted: {
    backgroundColor: COLORS.forestGreen,
  },
  stepDotPending: {
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  stepLine: {
    width: 2,
    height: 32,
    backgroundColor: COLORS.kraftBorder,
    marginVertical: 2,
  },
  stepLineActive: {
    backgroundColor: COLORS.forestGreen,
  },
  stepContent: {
    flex: 1,
    paddingBottom: 16,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textCoffee,
  },
  stepSub: {
    fontSize: 11.5,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  stepMeta: {
    fontSize: 10.5,
    color: COLORS.brandGold,
    fontFamily: LEDGER_MONO,
    marginTop: 3,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.brandGold,
    marginTop: 5,
  },
  timelineContent: {
    flex: 1,
    gap: 2,
  },
  timelineStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textCoffee,
  },
  timelineDesc: {
    fontSize: 11.5,
    color: COLORS.textMuted,
  },
  timelineTime: {
    fontSize: 10,
    color: COLORS.textLight,
    fontFamily: LEDGER_MONO,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textCoffee,
  },
  infoValueHighlight: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.forestGreen,
    fontFamily: LEDGER_MONO,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.canvas,
    borderStyle: 'dashed',
  },
  itemImageContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: COLORS.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemDetails: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textCoffee,
  },
  itemPortion: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  itemUnitPrice: {
    fontSize: 10.5,
    color: COLORS.textLight,
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textCoffee,
    fontFamily: LEDGER_MONO,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 10,
  },
  addressText: {
    fontSize: 12.5,
    color: COLORS.textCoffee,
    lineHeight: 18,
    fontWeight: '500',
  },
  addressPhone: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
    fontFamily: LEDGER_MONO,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  billLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  billValue: {
    fontSize: 12,
    color: COLORS.textCoffee,
    fontWeight: '600',
    fontFamily: LEDGER_MONO,
  },
  divider: {
    height: 0,
    borderTopWidth: 1,
    borderTopColor: COLORS.kraftBorder,
    borderStyle: 'dashed',
    marginVertical: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textCoffee,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.forestGreen,
    fontFamily: LEDGER_MONO,
  },
  paymentVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EDF5F0',
    padding: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  paymentVerifiedText: {
    fontSize: 10.5,
    color: COLORS.forestGreen,
    fontWeight: '600',
  },
  actionButtonsContainer: {
    gap: 10,
    marginTop: 4,
  },
  shareReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.forestGreen,
    paddingVertical: 14,
    borderRadius: 12,
  },
  shareReceiptBtnDisabled: {
    opacity: 0.6,
  },
  shareReceiptText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  backHomeBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backHomeText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
});
