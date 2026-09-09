import { create } from 'zustand';
import {
  fetchServerCart,
  addServerCartItem,
  updateServerCartItem,
  removeServerCartItem,
  clearServerCart,
  CartItemResponse,
  CartResponse,
} from '../api/cart';

interface CartState {
  items: CartItemResponse[];
  totalAmount: number;
  isLoading: boolean;
  isSyncing: boolean;
  lastError: string | null;

  loadCart: () => Promise<void>;
  addItem: (
    productId: number,
    quantity?: number,
    selectedWeight?: string,
    productMeta?: {
      name?: string;
      price?: number | string;
      image_url?: string | null;
      description?: string | null;
    }
  ) => Promise<void>;
  updateQuantity: (cartItemId: number, quantity: number) => Promise<void>;
  removeItem: (cartItemId: number) => Promise<void>;
  clearCart: () => Promise<void>;

  getTotalItems: () => number;
  getSubtotal: () => number;
  getDeliveryFee: () => number;
  getTotal: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  totalAmount: 0,
  isLoading: false,
  isSyncing: false,
  lastError: null,

  loadCart: async () => {
    set({ isLoading: true, lastError: null });
    try {
      const cart: CartResponse = await fetchServerCart();
      set({
        items: cart.items || [],
        totalAmount: Number(cart.total_amount) || 0,
      });
    } catch (err: any) {
      // 401 occurs if unauthenticated/guest
      const status = err.response?.status;
      if (status === 401) {
        set({ items: [], totalAmount: 0 });
      } else {
        console.log('Error loading cart from backend:', err.response?.data || err.message);
        set({ lastError: err.response?.data?.detail || 'Failed to sync bowl with server.' });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  addItem: async (
    productId: number,
    quantity = 1,
    selectedWeight?: string,
    productMeta?: {
      name?: string;
      price?: number | string;
      image_url?: string | null;
      description?: string | null;
    }
  ) => {
    // Optimistic update for instantaneous tactile response (0ms perceived delay)
    const previousItems = get().items;
    const previousTotal = get().totalAmount;

    const existingIndex = previousItems.findIndex(
      (item) => item.product_id === productId && (selectedWeight ? item.selected_weight === selectedWeight : true)
    );

    let optimisticItems: CartItemResponse[];
    const itemPrice = Number(productMeta?.price || (existingIndex >= 0 ? previousItems[existingIndex].price : 0));

    if (existingIndex >= 0) {
      optimisticItems = previousItems.map((item, idx) => {
        if (idx === existingIndex) {
          const newQty = item.quantity + quantity;
          const unitPrice = Number(item.price) || 0;
          return {
            ...item,
            quantity: newQty,
            subtotal: unitPrice * newQty,
          };
        }
        return item;
      });
    } else {
      const tempItem: CartItemResponse = {
        id: Date.now(), // Temporary unique id
        product_id: productId,
        name: productMeta?.name || 'Fresh Canine Recipe',
        description: productMeta?.description || null,
        price: itemPrice,
        quantity,
        subtotal: itemPrice * quantity,
        image_url: productMeta?.image_url || null,
        selected_weight: selectedWeight || null,
      };
      optimisticItems = [...previousItems, tempItem];
    }

    const optimisticTotal = optimisticItems.reduce(
      (sum, item) => sum + (Number(item.subtotal) || 0),
      0
    );

    // Apply immediate local state update
    set({ items: optimisticItems, totalAmount: optimisticTotal, isSyncing: true, lastError: null });

    try {
      const updatedCart = await addServerCartItem(productId, quantity, selectedWeight);
      set({
        items: updatedCart.items || [],
        totalAmount: Number(updatedCart.total_amount) || 0,
      });
    } catch (err: any) {
      console.log('Error adding item to backend cart:', err.response?.data || err.message);
      // Revert optimistic update on failure
      set({ items: previousItems, totalAmount: previousTotal });
      const msg = err.response?.data?.detail || 'Failed to add item to server bowl.';
      set({ lastError: msg });
      throw err;
    } finally {
      set({ isSyncing: false });
    }
  },

  updateQuantity: async (cartItemId: number, quantity: number) => {
    if (quantity <= 0) {
      await get().removeItem(cartItemId);
      return;
    }

    // Optimistic update for tactile responsiveness
    const previousItems = get().items;
    const previousTotal = get().totalAmount;

    const optimisticItems = previousItems.map((item) => {
      if (item.id === cartItemId) {
        const unitPrice = Number(item.price) || 0;
        return {
          ...item,
          quantity,
          subtotal: unitPrice * quantity,
        };
      }
      return item;
    });

    const optimisticTotal = optimisticItems.reduce(
      (sum, item) => sum + (Number(item.subtotal) || 0),
      0
    );

    set({ items: optimisticItems, totalAmount: optimisticTotal, isSyncing: true });

    try {
      const updatedCart = await updateServerCartItem(cartItemId, quantity);
      set({
        items: updatedCart.items || [],
        totalAmount: Number(updatedCart.total_amount) || 0,
      });
    } catch (err: any) {
      console.log('Error updating item quantity on backend:', err.response?.data || err.message);
      // Revert on error
      set({ items: previousItems, totalAmount: previousTotal });
      const msg = err.response?.data?.detail || 'Could not update quantity on server.';
      set({ lastError: msg });
      throw err;
    } finally {
      set({ isSyncing: false });
    }
  },

  removeItem: async (cartItemId: number) => {
    const previousItems = get().items;
    const previousTotal = get().totalAmount;

    // Optimistic removal
    const remainingItems = previousItems.filter((i) => i.id !== cartItemId);
    const remainingTotal = remainingItems.reduce(
      (sum, item) => sum + (Number(item.subtotal) || 0),
      0
    );
    set({ items: remainingItems, totalAmount: remainingTotal, isSyncing: true });

    try {
      const updatedCart = await removeServerCartItem(cartItemId);
      set({
        items: updatedCart.items || [],
        totalAmount: Number(updatedCart.total_amount) || 0,
      });
    } catch (err: any) {
      console.log('Error removing item from backend cart:', err.response?.data || err.message);
      set({ items: previousItems, totalAmount: previousTotal });
      const msg = err.response?.data?.detail || 'Could not remove item from server.';
      set({ lastError: msg });
      throw err;
    } finally {
      set({ isSyncing: false });
    }
  },

  clearCart: async () => {
    set({ isSyncing: true });
    try {
      await clearServerCart();
      set({ items: [], totalAmount: 0 });
    } catch (err: any) {
      console.log('Error clearing backend cart:', err.response?.data || err.message);
      set({ items: [], totalAmount: 0 });
    } finally {
      set({ isSyncing: false });
    }
  },

  getTotalItems: () => {
    return get().items.reduce((total, item) => total + item.quantity, 0);
  },

  getSubtotal: () => {
    return get().totalAmount;
  },

  getDeliveryFee: () => {
    const subtotal = get().getSubtotal();
    if (subtotal === 0) return 0;
    return subtotal > 999 ? 0 : 79; // Free above ₹999
  },

  getTotal: () => {
    const subtotal = get().getSubtotal();
    if (subtotal === 0) return 0;
    return subtotal + get().getDeliveryFee();
  },
}));
