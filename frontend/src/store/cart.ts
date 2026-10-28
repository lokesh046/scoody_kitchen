import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuthStore } from './auth';
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
  // When the stored cart was last confirmed by the server, and whose cart it is.
  lastLoadedAt: number;
  ownerId: number | null;
  
  loadCart: (opts?: { force?: boolean }) => Promise<void>;
  addItem: (productId: number, quantity: number, selectedWeight?: string) => Promise<void>;
  updateItem: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  applyCoupon: (coupon: AppliedCoupon) => void;
  removeCoupon: () => void;
  clear: () => void;
}

// The cart used to be fetched from the server on every page load for a signed-in visitor, which
// meant a database query (and a wake-up of the sleeping Neon compute) on every visit. It is now
// kept in the browser and refreshed from the server at most every CART_MAX_AGE_MS -- and always
// when the cart drawer or checkout opens, and after every add / change / remove.
const CART_MAX_AGE_MS = 10 * 60 * 1000;
// A load already on its way is shared, so two components asking at once make one request.
let cartLoadInFlight: Promise<void> | null = null;

export const useCartStore = create<CartState>()(persist((set, get) => ({
  items: [],
  totalAmount: 0,
  appliedCoupon: null,
  isLoading: false,
  lastLoadedAt: 0,
  ownerId: null,

  loadCart: async (opts) => {
    const userId = useAuthStore.getState().user?.id ?? null;
    const { lastLoadedAt, ownerId } = get();
    if (!opts?.force && userId !== null && ownerId === userId && Date.now() - lastLoadedAt < CART_MAX_AGE_MS) {
      return; // the stored cart belongs to this user and is fresh enough
    }
    if (cartLoadInFlight) return cartLoadInFlight;
    set({ isLoading: true });
    cartLoadInFlight = (async () => {
      try {
        const cart = await fetchCart();
        set({ 
          items: cart.items, 
          totalAmount: parseFloat(cart.total_amount),
          lastLoadedAt: Date.now(),
          ownerId: userId,
        });
      } catch (err) {
        console.error('Failed to load cart:', err);
        // If error occurs, clean local state
        set({ items: [], totalAmount: 0, lastLoadedAt: 0 });
      } finally {
        set({ isLoading: false });
        cartLoadInFlight = null;
      }
    })();
    return cartLoadInFlight;
  },

  addItem: async (productId: number, quantity: number, selectedWeight?: string) => {
    set({ isLoading: true });
    try {
      const cart = await addToCart(productId, quantity, selectedWeight);
      set({ 
        items: cart.items, 
        totalAmount: parseFloat(cart.total_amount),
        lastLoadedAt: Date.now(),
        ownerId: useAuthStore.getState().user?.id ?? null,
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
        totalAmount: parseFloat(cart.total_amount),
        lastLoadedAt: Date.now(),
      });
    } catch (err) {
      console.error('Failed to update cart item:', err);
      // Rollback on failure
      await get().loadCart({ force: true });
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
        totalAmount: parseFloat(cart.total_amount),
        lastLoadedAt: Date.now(),
      });
    } catch (err) {
      console.error('Failed to remove cart item:', err);
      // Rollback on failure
      await get().loadCart({ force: true });
      throw err;
    }
  },

  applyCoupon: (coupon: AppliedCoupon) => set({ appliedCoupon: coupon }),
  removeCoupon: () => set({ appliedCoupon: null }),
  clear: () => set({ items: [], totalAmount: 0, appliedCoupon: null, isLoading: false, lastLoadedAt: 0, ownerId: null })
}), {
  name: 'hearth-cart-v1',
  // Keep only the cart itself in the browser, never loading flags or the coupon being typed.
  partialize: (state) => ({ items: state.items, totalAmount: state.totalAmount, lastLoadedAt: state.lastLoadedAt, ownerId: state.ownerId }),
}));
