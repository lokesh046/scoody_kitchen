import React, { memo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Phone,
  Check,
  Clock,
  Truck,
  Tag,
  AlertCircle,
  Info,
  RotateCcw,
  CreditCard,
  ShieldCheck,
} from 'lucide-react-native';
import { COLORS } from '../../theme/colors';
import { UserProfile } from '../../store/authStore';
import { CouponValidateResponse } from '../../api/coupons';
import { styles } from './cartStyles';

interface PaymentFailureNotice {
  message: string;
  isDismissed: boolean;
}

interface PaymentStepProps {
  user: UserProfile | null;
  doorNo: string;
  street: string;
  city: string;
  stateName: string;
  pincode: string;
  phone: string;

  subtotal: number;
  appliedCoupon: CouponValidateResponse | null;
  discountAmount: number;
  deliveryFee: number;
  total: number;

  paymentFailureNotice: PaymentFailureNotice | null;
  isCheckingOut: boolean;
  isSyncing: boolean;

  onEditAddress: () => void;
  onStartCheckout: () => void;
}

export const PaymentStep = memo(function PaymentStep({
  user,
  doorNo,
  street,
  city,
  stateName,
  pincode,
  phone,
  subtotal,
  appliedCoupon,
  discountAmount,
  deliveryFee,
  total,
  paymentFailureNotice,
  isCheckingOut,
  isSyncing,
  onEditAddress,
  onStartCheckout,
}: PaymentStepProps) {
  return (
    <>
      {/* Back to Step 2 Button */}
      <TouchableOpacity
        style={styles.stepBackBtn}
        onPress={onEditAddress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Change delivery address"
      >
        <ArrowLeft size={16} color={COLORS.forestGreen} />
        <Text style={styles.stepBackText}>Change Delivery Address</Text>
      </TouchableOpacity>

      {/* Delivery Destination Summary Card */}
      <View style={styles.summaryAddressCard}>
        <View style={styles.summaryAddressHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MapPin size={16} color={COLORS.forestGreen} />
            <Text style={styles.summaryAddressTitle}>Delivery Destination</Text>
          </View>
          <TouchableOpacity
            onPress={onEditAddress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Edit delivery address"
          >
            <Text style={styles.summaryEditBtn}>Edit</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.summaryAddressBody}>
          {doorNo ? `Door No: ${doorNo}, ` : ''}
          {street}, {city}, {stateName} - {pincode}
        </Text>
        <View style={styles.summaryPhoneRow}>
          <Phone size={13} color={COLORS.textLight} />
          <Text style={styles.summaryPhoneText}>+91 {phone}</Text>
          {user?.is_phone_verified && (
            <View style={styles.phoneVerifiedMini}>
              <Check size={10} color={COLORS.forestGreen} />
              <Text style={styles.phoneVerifiedMiniText}>Verified</Text>
            </View>
          )}
        </View>
      </View>

      {/* Accurate Cold-Chain Courier Dispatch Schedule */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionTitleRow}>
          <Clock size={18} color={COLORS.brandGold} />
          <Text style={styles.sectionHeading}>Delivery Schedule & Cold-Chain SLA</Text>
        </View>
        <View style={styles.deliveryScheduleBox}>
          <View style={styles.scheduleBadgeRow}>
            <Truck size={16} color={COLORS.forestGreen} />
            <Text style={styles.scheduleBadgeText}>
              Cold-Chain Express Delivery (1–2 Business Days)
            </Text>
          </View>
          <Text style={styles.scheduleDetailsText}>
            Fresh batches are cooked daily and packed at 4°C with food-grade dry ice pouches. Dispatched via Shiprocket Refrigerated Courier directly to your doorstep.
          </Text>
        </View>
      </View>

      {/* Order Bill Breakdown */}
      <View style={styles.billCard}>
        <Text style={styles.billHeading}>Pricing Ledger</Text>
        <View style={styles.billRow}>
          <Text style={styles.billLabel}>Fresh Meals Subtotal</Text>
          <Text style={styles.billVal}>₹{subtotal.toFixed(2)}</Text>
        </View>

        {appliedCoupon && (
          <View style={styles.billRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Tag size={14} color={COLORS.forestGreen} />
              <Text style={[styles.billLabel, { color: COLORS.forestGreen, fontWeight: '700' }]}>
                Coupon Discount ({appliedCoupon.code})
              </Text>
            </View>
            <Text style={[styles.billVal, { color: COLORS.forestGreen, fontWeight: '800' }]}>
              -₹{discountAmount.toFixed(2)}
            </Text>
          </View>
        )}

        <View style={styles.billRow}>
          <Text style={styles.billLabel}>Refrigerated Cold-Chain Dispatch</Text>
          <Text
            style={[
              styles.billVal,
              deliveryFee === 0 && { color: COLORS.forestGreen, fontWeight: '800' },
            ]}
          >
            {deliveryFee === 0 ? 'FREE (Orders > ₹999)' : `₹${deliveryFee.toFixed(2)}`}
          </Text>
        </View>

        <View style={[styles.billRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total Payable</Text>
          <Text style={styles.totalVal}>₹{total.toFixed(2)}</Text>
        </View>
      </View>

      {/* Payment Incomplete / Failure Recovery Card */}
      {paymentFailureNotice && (
        <View style={styles.paymentRecoveryCard}>
          <View style={styles.paymentRecoveryHeader}>
            <AlertCircle size={20} color={COLORS.accentRed} />
            <View style={{ flex: 1 }}>
              <Text style={styles.paymentRecoveryTitle}>
                {paymentFailureNotice.isDismissed
                  ? 'Payment Incomplete / Cancelled'
                  : 'Payment Declined by Bank'}
              </Text>
              <Text style={styles.paymentRecoverySub}>{paymentFailureNotice.message}</Text>
            </View>
          </View>

          <View style={styles.prepaidNoticeRow}>
            <Info size={13} color={COLORS.textMuted} />
            <Text style={styles.prepaidNoticeText}>
              Prepaid Only: Cold-chain fresh food is prepared on-demand and dispatched at 4°C with dry ice; Cash on Delivery (COD) is not supported for perishable safety.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.retryPaymentBtn}
            onPress={onStartCheckout}
            disabled={isCheckingOut || isSyncing}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={`Retry payment, ₹${total.toFixed(2)}`}
            accessibilityState={{ disabled: isCheckingOut || isSyncing, busy: isCheckingOut }}
          >
            <RotateCcw size={16} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={styles.retryPaymentBtnText}>Retry Payment (₹{total.toFixed(2)})</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Final Razorpay Checkout Button */}
      <TouchableOpacity
        style={[styles.checkoutBtn, (isCheckingOut || isSyncing) && { opacity: 0.7 }]}
        onPress={onStartCheckout}
        disabled={isCheckingOut || isSyncing}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Pay ₹${total.toFixed(2)} via Razorpay`}
        accessibilityState={{ disabled: isCheckingOut || isSyncing, busy: isCheckingOut }}
      >
        {isCheckingOut ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <CreditCard size={18} color="#FFFFFF" />
            <Text style={styles.checkoutBtnText}>Pay ₹{total.toFixed(2)} via Razorpay</Text>
            <ArrowRight size={18} color="#FFFFFF" />
          </>
        )}
      </TouchableOpacity>

      <View style={styles.securityRow}>
        <ShieldCheck size={14} color={COLORS.forestGreen} />
        <Text style={styles.securityText}>
          100% Secure Razorpay Checkout • Server Database Ledger Synced
        </Text>
      </View>
    </>
  );
});
