import { create } from 'zustand';
import { 
  fetchCart, 
  addToCart, 
  updateCartItem, 
  removeCartItem 
} from '../api/cart';
import type { CartItemResponse } from '../api/cart';

interface CartState {
  items: CartItemResponse[];
  totalAmount: number;
  isLoading: boolean;
  
  loadCart: () => Promise<void>;
  addItem: (productId: number, quantity: number) => Promise<void>;
  updateItem: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  clear: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  totalAmount: 0,
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

  addItem: async (productId: number, quantity: number) => {
    set({ isLoading: true });
    try {
      await addToCart(productId, quantity);
      // Reload cart state from database
      await get().loadCart();
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
      await updateCartItem(itemId, quantity);
      await get().loadCart();
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
      await removeCartItem(itemId);
      await get().loadCart();
    } catch (err) {
      console.error('Failed to remove cart item:', err);
      // Rollback on failure
      await get().loadCart();
      throw err;
    }
  },

  clear: () => set({ items: [], totalAmount: 0, isLoading: false })
}));
