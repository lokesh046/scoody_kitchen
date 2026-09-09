import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, Clock, MapPin, CreditCard, Truck, Package, PawPrint } from 'lucide-react-native';
import { COLORS } from '../../theme/colors';
import { Order } from '../../api/orders';
import { styles } from './cartStyles';

interface OrderSuccessScreenProps {
  order: Order;
  onTrackOrder: () => void;
  onBackToHome: () => void;
}

export const OrderSuccessScreen = memo(function OrderSuccessScreen({
  order,
  onTrackOrder,
  onBackToHome,
}: OrderSuccessScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.successContainer}>
        <View style={styles.successIconCircle}>
          <CheckCircle2 size={48} color={COLORS.forestGreen} />
        </View>
        <Text style={styles.successBadge}>OFFICIAL DATABASE LEDGER</Text>
        <Text style={styles.successTitle}>Order #{order.id} Placed!</Text>
        <Text style={styles.successSub}>
          Payment verified and recorded in the database. Your order has been confirmed and is being prepared in the kitchen.
        </Text>

        <View style={styles.dispatchCard}>
          <View style={styles.dispatchRow}>
            <Clock size={16} color={COLORS.brandGold} />
            <Text style={styles.dispatchText}>Estimated Dispatch: 1–2 Business Days</Text>
          </View>
          <View style={styles.dispatchRow}>
            <MapPin size={16} color={COLORS.brandGold} />
            <Text style={styles.dispatchText}>{order.shipping_address}</Text>
          </View>
          <View style={styles.dispatchRow}>
            <CreditCard size={16} color={COLORS.forestGreen} />
            <Text style={styles.dispatchText}>
              Status: PAID • Total: ₹{order.total_amount}
            </Text>
          </View>
          <View style={styles.dispatchRow}>
            <Truck size={16} color={COLORS.forestGreen} />
            <Text style={styles.dispatchText}>Courier Tracking: Assigned upon kitchen dispatch</Text>
          </View>
        </View>

        {/* Action CTAs */}
        <View style={styles.successBtnRow}>
          <TouchableOpacity style={styles.viewOrderHistoryBtn} onPress={onTrackOrder}>
            <Package size={18} color="#FFFFFF" />
            <Text style={styles.viewOrderHistoryText}>Track Order Details</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.backToMenuBtn} onPress={onBackToHome}>
            <PawPrint size={18} color={COLORS.forestGreen} fill={COLORS.forestGreen} />
            <Text style={styles.backToMenuText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
});
