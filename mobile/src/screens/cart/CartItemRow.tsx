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

  const stock = item.available_stock;
  const hasStock = typeof stock === 'number';
  const isOutOfStock = hasStock && stock === 0;
  const isOverStock = hasStock && item.quantity > stock;
  const isMaxStock = hasStock && item.quantity >= stock;
  const isLowStock = hasStock && stock > 0 && stock <= 3;

  return (
    <View style={[styles.cartCard, (isOutOfStock || isOverStock) && styles.cartCardError]}>
      <View style={{ position: 'relative' }}>
        <Image source={{ uri: displayImage }} style={styles.itemImage} />
        {isOutOfStock && (
          <View style={styles.imageOverlayOos}>
            <Text style={styles.imageOverlayOosText}>Sold Out</Text>
          </View>
        )}
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <View style={styles.portionBadge}>
            <Text style={styles.portionText}>
              {item.selected_weight || '500g vacuum pouch'}
            </Text>
          </View>

          {/* Stock Count Pill */}
          {isOutOfStock ? (
            <View style={styles.stockBadgeOos}>
              <Text style={styles.stockTextOos}>Out of stock</Text>
            </View>
          ) : isOverStock ? (
            <View style={styles.stockBadgeOos}>
              <Text style={styles.stockTextOos}>Only {stock} available</Text>
            </View>
          ) : isLowStock ? (
            <View style={styles.stockBadgeLow}>
              <Text style={styles.stockTextLow}>Only {stock} left</Text>
            </View>
          ) : hasStock ? (
            <View style={styles.stockBadgeOk}>
              <Text style={styles.stockTextOk}>{stock} in stock</Text>
            </View>
          ) : null}
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
          disabled={isSyncing || item.quantity <= 1}
          accessibilityRole="button"
          accessibilityLabel={`Decrease quantity of ${item.name}`}
          accessibilityState={{ disabled: isSyncing || item.quantity <= 1 }}
        >
          <Minus size={14} color={item.quantity <= 1 ? COLORS.textLight : COLORS.textCoffee} />
        </TouchableOpacity>

        <Text style={styles.stepperQty}>{item.quantity}</Text>

        <TouchableOpacity
          style={[styles.stepperBtn, (isSyncing || isMaxStock || isOutOfStock) && styles.stepperBtnDisabled]}
          onPress={() => onUpdateQuantity(item.id, item.quantity + 1)}
          disabled={isSyncing || isMaxStock || isOutOfStock}
          accessibilityRole="button"
          accessibilityLabel={`Increase quantity of ${item.name}`}
          accessibilityState={{ disabled: isSyncing || isMaxStock || isOutOfStock }}
        >
          <Plus size={14} color={(isMaxStock || isOutOfStock) ? COLORS.textLight : COLORS.textCoffee} />
        </TouchableOpacity>
      </View>

      {/* Direct Delete Button */}
      <TouchableOpacity
        onPress={() => onRemove(item.id)}
        style={styles.deleteItemBtn}
        disabled={isSyncing}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${item.name} from cart`}
        accessibilityState={{ disabled: isSyncing }}
      >
        <Trash2 size={15} color={COLORS.textLight} />
      </TouchableOpacity>
    </View>
  );
});
