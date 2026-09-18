import apiClient from './client';

export interface CartItemResponse {
  id: number;
  product_id: number;
  name: string;
  description: string | null;
  price: string | number;
  quantity: number;
  subtotal: string | number;
  image_url: string | null;
  selected_weight: string | null;
  available_stock?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface CartResponse {
  id: number;
  user_id: number;
  items: CartItemResponse[];
  total_amount: string | number;
}

export const fetchServerCart = async (): Promise<CartResponse> => {
  const response = await apiClient.get<CartResponse>('/cart');
  return response.data;
};

export const addServerCartItem = async (
  productId: number,
  quantity = 1,
  selectedWeight?: string
): Promise<CartResponse> => {
  const payload: { product_id: number; quantity: number; selected_weight?: string } = {
    product_id: productId,
    quantity,
  };
  if (selectedWeight) {
    payload.selected_weight = selectedWeight;
  }
  const response = await apiClient.post<CartResponse>('/cart/items', payload);
  return response.data;
};

export const updateServerCartItem = async (
  cartItemId: number,
  quantity: number
): Promise<CartResponse> => {
  const response = await apiClient.patch<CartResponse>(`/cart/items/${cartItemId}`, { quantity });
  return response.data;
};

export const removeServerCartItem = async (cartItemId: number): Promise<CartResponse> => {
  const response = await apiClient.delete<CartResponse>(`/cart/items/${cartItemId}`);
  return response.data;
};

export const clearServerCart = async (): Promise<{ message: string }> => {
  const response = await apiClient.delete<{ message: string }>('/cart');
  return response.data;
};
