import apiClient from './client';

export interface CheckoutPayload {
  shipping_address: string;
  payment_method?: string;
  phone?: string;
  coupon_code?: string;
}

export interface OrderItem {
  id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
  image_url?: string | null;
  selected_weight?: string | null;
  product_name?: string | null;
  price?: number | null;
}

export interface Order {
  id: number;
  user_id: number;
  status: string;
  total_amount: number;
  coupon_code?: string | null;
  discount_amount?: number | null;
  shipping_address: string;
  created_at: string;
  updated_at: string;
  razorpay_order_id?: string | null;
  razorpay_key_id?: string | null;
  user_phone?: string | null;
  user_email?: string | null;
  user_name?: string | null;
  items: OrderItem[];
}

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

export const checkoutOrder = async (payload: CheckoutPayload): Promise<Order> => {
  const response = await apiClient.post('/orders/checkout', payload);
  return response.data;
};

export const fetchMyOrders = async (): Promise<Order[]> => {
  const response = await apiClient.get('/orders');
  return response.data;
};

export const fetchOrderById = async (orderId: number): Promise<Order> => {
  const response = await apiClient.get(`/orders/${orderId}`);
  return response.data;
};

export const fetchOrderTracking = async (orderId: number): Promise<OrderTrackingResponse> => {
  const response = await apiClient.get(`/orders/${orderId}/tracking`);
  return response.data;
};

export const cancelOrder = async (orderId: number): Promise<Order> => {
  const response = await apiClient.post(`/orders/${orderId}/cancel`);
  return response.data;
};
