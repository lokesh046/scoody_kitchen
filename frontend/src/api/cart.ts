import { apiClient } from './client';

export interface CartItemResponse {
  id: number;
  product_id: number;
  name: string;
  description: string | null;
  price: string; // Decimal returned as string
  quantity: number;
  subtotal: string; // Decimal returned as string
  image_url: string | null;
  selected_weight: string | null;
  created_at: string;
  updated_at: string;
}

export interface CartResponse {
  id: number;
  user_id: number;
  items: CartItemResponse[];
  total_amount: string; // Decimal returned as string
}

export const fetchCart = async (): Promise<CartResponse> => {
  const response = await apiClient.get<CartResponse>('/cart');
  return response.data;
};

export const addToCart = async (productId: number, quantity: number, selectedWeight?: string): Promise<CartResponse> => {
  const response = await apiClient.post<CartResponse>('/cart/items', {
    product_id: productId,
    quantity,
    selected_weight: selectedWeight,
  });
  return response.data;
};

export const updateCartItem = async (itemId: number, quantity: number): Promise<CartResponse> => {
  const response = await apiClient.patch<CartResponse>(`/cart/items/${itemId}`, {
    quantity,
  });
  return response.data;
};

export const removeCartItem = async (itemId: number): Promise<CartResponse> => {
  const response = await apiClient.delete<CartResponse>(`/cart/items/${itemId}`);
  return response.data;
};

export const clearCart = async (): Promise<{ message: string }> => {
  const response = await apiClient.delete<{ message: string }>('/cart');
  return response.data;
};
