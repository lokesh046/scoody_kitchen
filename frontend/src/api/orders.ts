import { apiClient } from './client';

export interface OrderItemResponse {
  id: number;
  product_id: number;
  quantity: number;
  unit_price: string; // Decimal returned as string
  subtotal: string; // Decimal returned as string
  image_url: string | null;
}

export type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface OrderResponse {
  id: number;
  user_id: number;
  status: OrderStatus;
  total_amount: string; // Decimal returned as string
  shipping_address: string;
  created_at: string;
  updated_at: string;
  items: OrderItemResponse[];
}

export const checkoutCart = async (shippingAddress: string): Promise<OrderResponse> => {
  const response = await apiClient.post<OrderResponse>('/orders/checkout', {
    shipping_address: shippingAddress,
  });
  return response.data;
};

export const fetchMyOrders = async (): Promise<OrderResponse[]> => {
  const response = await apiClient.get<OrderResponse[]>('/orders');
  return response.data;
};

export const fetchOrderById = async (orderId: number): Promise<OrderResponse> => {
  const response = await apiClient.get<OrderResponse>(`/orders/${orderId}`);
  return response.data;
};

export const cancelOrder = async (orderId: number): Promise<OrderResponse> => {
  const response = await apiClient.post<OrderResponse>(`/orders/${orderId}/cancel`);
  return response.data;
};
