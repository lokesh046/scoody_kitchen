import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Trash2, Plus, Minus } from 'lucide-react-native';
import { COLORS } from '../../theme/colors';
import { CartItemResponse } from '../../api/cart';
import { styles } from './cartStyles';

interface CartItemRowProps {
  item: CartItemResponse;
  isSyncing: boolean;
  onUpdateQuantity: (cartItemId: number, quantity: number) => void;
  onRemove: (cartItemId: number) => void;
}

export const CartItemRow = memo(function CartItemRow({
  item,
  isSyncing,
  onUpdateQuantity,
  onRemove,
}: CartItemRowProps) {
  const unitPrice = Number(item.price) || 0;
  const subtotalItem = Number(item.subtotal) || unitPrice * item.quantity;
  const displayImage =
    item.image_url ||
    'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600&auto=format&fit=crop&q=80';

  return (
    <View style={styles.cartCard}>
      <Image source={{ uri: displayImage }} style={styles.itemImage} />

      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.portionBadge}>
          <Text style={styles.portionText}>
            {item.selected_weight || '500g vacuum pouch'}
          </Text>
        </View>
        <Text style={styles.itemPrice}>
          ₹{subtotalItem}{' '}
          <Text style={styles.unitPriceMuted}>(₹{unitPrice}/pouch)</Text>
        </Text>
      </View>

      {/* Quantity Stepper */}
      <View style={styles.stepperWrapper}>
        <TouchableOpacity
          style={styles.stepperBtn}
          onPress={() => onUpdateQuantity(item.id, item.quantity - 1)}
          disabled={isSyncing}
        >
          <Minus size={14} color={COLORS.textCoffee} />
        </TouchableOpacity>

        <Text style={styles.stepperQty}>{item.quantity}</Text>

        <TouchableOpacity
          style={styles.stepperBtn}
          onPress={() => onUpdateQuantity(item.id, item.quantity + 1)}
          disabled={isSyncing}
        >
          <Plus size={14} color={COLORS.textCoffee} />
        </TouchableOpacity>
      </View>

      {/* Direct Delete Button */}
      <TouchableOpacity
        onPress={() => onRemove(item.id)}
        style={styles.deleteItemBtn}
        disabled={isSyncing}
      >
        <Trash2 size={15} color={COLORS.textLight} />
      </TouchableOpacity>
    </View>
  );
});
