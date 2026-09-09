import React, { memo } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Tag, Check, AlertCircle, ArrowRight } from 'lucide-react-native';
import { COLORS } from '../../theme/colors';
import { CartItemResponse } from '../../api/cart';
import { CouponValidateResponse } from '../../api/coupons';
import { CartItemRow } from './CartItemRow';
import { styles } from './cartStyles';

interface CartStepProps {
  items: CartItemResponse[];
  isSyncing: boolean;
  onUpdateQuantity: (cartItemId: number, quantity: number) => void;
  onRemoveItem: (cartItemId: number) => void;

  couponCode: string;
  onChangeCouponCode: (val: string) => void;
  validatingCoupon: boolean;
  appliedCoupon: CouponValidateResponse | null;
  couponError: string | null;
  onApplyCoupon: () => void;
  onRemoveCoupon: () => void;

  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  total: number;

  onProceedToDelivery: () => void;
}

export const CartStep = memo(function CartStep({
  items,
  isSyncing,
  onUpdateQuantity,
  onRemoveItem,
  couponCode,
  onChangeCouponCode,
  validatingCoupon,
  appliedCoupon,
  couponError,
  onApplyCoupon,
  onRemoveCoupon,
  subtotal,
  discountAmount,
  deliveryFee,
  total,
  onProceedToDelivery,
}: CartStepProps) {
  return (
    <>
      {/* Cart Item Cards */}
      <View style={styles.itemList}>
        {items.map((item) => (
          <CartItemRow
            key={item.id}
            item={item}
            isSyncing={isSyncing}
            onUpdateQuantity={onUpdateQuantity}
            onRemove={onRemoveItem}
          />
        ))}
      </View>

      {/* Promotional Coupon Section */}
      <View style={styles.couponCard}>
        <View style={styles.couponHeaderRow}>
          <Tag size={16} color={COLORS.brandGold} />
          <Text style={styles.couponHeading}>Have a Coupon Code?</Text>
        </View>

        {appliedCoupon ? (
          <View style={styles.appliedCouponCard}>
            <View style={styles.appliedCouponLeft}>
              <View style={styles.appliedCheckCircle}>
                <Check size={14} color="#FFFFFF" strokeWidth={3} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.appliedCodeText}>{appliedCoupon.code}</Text>
                  <View style={styles.appliedBadge}>
                    <Text style={styles.appliedBadgeText}>
                      {appliedCoupon.discount_type === 'PERCENTAGE'
                        ? `${appliedCoupon.discount_value}% OFF`
                        : `FLAT ₹${appliedCoupon.discount_value} OFF`}
                    </Text>
                  </View>
                </View>
                <Text style={styles.appliedSavingsText}>
                  You saved ₹{Number(appliedCoupon.discount_amount).toFixed(2)} on this order!
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onRemoveCoupon}
              style={styles.removeCouponBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Text style={styles.removeCouponBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <View style={styles.couponInputRow}>
              <TextInput
                value={couponCode}
                onChangeText={onChangeCouponCode}
                placeholder="Enter coupon code (e.g. SCOOBY20)"
                placeholderTextColor={COLORS.textLight}
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.couponInput}
                editable={!validatingCoupon}
              />
              <TouchableOpacity
                style={[
                  styles.applyCouponBtn,
                  (!couponCode.trim() || validatingCoupon) && styles.applyCouponBtnDisabled,
                ]}
                onPress={onApplyCoupon}
                disabled={!couponCode.trim() || validatingCoupon}
                activeOpacity={0.8}
              >
                {validatingCoupon ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.applyCouponBtnText}>Apply</Text>
                )}
              </TouchableOpacity>
            </View>

            {couponError && (
              <View style={styles.couponErrorRow}>
                <AlertCircle size={14} color="#D9534F" />
                <Text style={styles.couponErrorText}>{couponError}</Text>
              </View>
            )}
          </View>
        )}
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

      {/* Step 1 Primary Action Bar */}
      <View style={styles.stepActionCard}>
        <View style={styles.stepActionRow}>
          <View>
            <Text style={styles.stepActionSub}>Step 1 of 3</Text>
            <Text style={styles.stepActionTotal}>₹{total.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            style={styles.primaryStepBtn}
            onPress={onProceedToDelivery}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryStepBtnText}>Proceed to Delivery</Text>
            <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
});
