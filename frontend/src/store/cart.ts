import { create } from 'zustand';
import { 
  fetchCart, 
  addToCart, 
  updateCartItem, 
  removeCartItem 
} from '../api/cart';
import type { CartItemResponse } from '../api/cart';

export interface AppliedCoupon {
  code: string;
  discountType: 'PERCENTAGE' | 'FLAT';
  discountValue: number;
  discountAmount: number;
  message?: string;
}

interface CartState {
  items: CartItemResponse[];
  totalAmount: number;
  appliedCoupon: AppliedCoupon | null;
  isLoading: boolean;
  
  loadCart: () => Promise<void>;
  addItem: (productId: number, quantity: number, selectedWeight?: string) => Promise<void>;
  updateItem: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  applyCoupon: (coupon: AppliedCoupon) => void;
  removeCoupon: () => void;
  clear: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  totalAmount: 0,
  appliedCoupon: null,
  isLoading: false,

  loadCart: async () => {
    set({ isLoading: true });
    try {
      const cart = await fetchCart();
      set({ 
        items: cart.items, 
        totalAmount: parseFloat(cart.total_amount) 
      });
    } catch (err) {
      console.error('Failed to load cart:', err);
      // If error occurs, clean local state
      set({ items: [], totalAmount: 0 });
    } finally {
      set({ isLoading: false });
    }
  },

  addItem: async (productId: number, quantity: number, selectedWeight?: string) => {
    set({ isLoading: true });
    try {
      const cart = await addToCart(productId, quantity, selectedWeight);
      set({ 
        items: cart.items, 
        totalAmount: parseFloat(cart.total_amount) 
      });
    } catch (err) {
      console.error('Failed to add item to cart:', err);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  updateItem: async (itemId: number, quantity: number) => {
    // Optimistic update for smooth micro-interaction UX
    const previousItems = get().items;
    const updatedItems = previousItems.map(item => {
      if (item.id === itemId) {
        const itemPrice = parseFloat(item.price);
        return {
          ...item,
          quantity,
          subtotal: (itemPrice * quantity).toFixed(2)
        };
      }
      return item;
    });

    const newTotal = updatedItems.reduce(
      (sum, item) => sum + parseFloat(item.subtotal), 
      0
    );

    set({ items: updatedItems, totalAmount: newTotal });

    try {
      const cart = await updateCartItem(itemId, quantity);
      set({ 
        items: cart.items, 
        totalAmount: parseFloat(cart.total_amount) 
      });
    } catch (err) {
      console.error('Failed to update cart item:', err);
      // Rollback on failure
      await get().loadCart();
      throw err;
    }
  },

  removeItem: async (itemId: number) => {
    // Optimistic delete
    const previousItems = get().items;
    const filteredItems = previousItems.filter(item => item.id !== itemId);
    const newTotal = filteredItems.reduce(
      (sum, item) => sum + parseFloat(item.subtotal), 
      0
    );

    set({ items: filteredItems, totalAmount: newTotal });

    try {
      const cart = await removeCartItem(itemId);
      set({ 
        items: cart.items, 
        totalAmount: parseFloat(cart.total_amount) 
      });
    } catch (err) {
      console.error('Failed to remove cart item:', err);
      // Rollback on failure
      await get().loadCart();
      throw err;
    }
  },

  applyCoupon: (coupon: AppliedCoupon) => set({ appliedCoupon: coupon }),
  removeCoupon: () => set({ appliedCoupon: null }),
  clear: () => set({ items: [], totalAmount: 0, appliedCoupon: null, isLoading: false })
}));
