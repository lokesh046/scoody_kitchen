import { apiClient } from './client';

export interface OrderItemResponse {
  id: number;
  product_id: number;
  product_name?: string;
  quantity: number;
  unit_price: string; // Decimal returned as string
  subtotal: string; // Decimal returned as string
  image_url: string | null;
  selected_weight?: string | null;
}

export type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface OrderResponse {
  id: number;
  user_id: number;
  status: OrderStatus;
  total_amount: string; // Decimal returned as string
  coupon_code?: string | null;
  discount_amount?: string | null;
  shipping_address: string;
  user_phone?: string | null;
  user_email?: string | null;
  user_name?: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItemResponse[];
  razorpay_order_id?: string | null;
  razorpay_key_id?: string | null;
}

export const checkoutCart = async (
  shippingAddress: string, 
  paymentMethod?: string, 
  phone?: string,
  couponCode?: string
): Promise<OrderResponse> => {
  const response = await apiClient.post<OrderResponse>('/orders/checkout', {
    shipping_address: shippingAddress,
    payment_method: paymentMethod,
    phone: phone || undefined,
    coupon_code: couponCode || undefined,
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

export interface ShipmentResponse {
  provider: string;
  tracking_number: string;
  carrier: string;
  status: string;
  estimated_delivery?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
}

export interface OrderStatusTimelineItem {
  status: string;
  description: string;
  timestamp: string;
}

export interface OrderTrackingResponse {
  order_id: number;
  order_status: string;
  shipment?: ShipmentResponse | null;
  timeline: OrderStatusTimelineItem[];
}

export const cancelOrder = async (orderId: number): Promise<OrderResponse> => {
  const response = await apiClient.post<OrderResponse>(`/orders/${orderId}/cancel`);
  return response.data;
};

export const fetchOrderTracking = async (orderId: number): Promise<OrderTrackingResponse> => {
  const response = await apiClient.get<OrderTrackingResponse>(`/orders/${orderId}/tracking`);
  return response.data;
};
