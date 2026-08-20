import { apiClient } from './client';

export interface PaymentResponse {
  id: number;
  order_id: number;
  payment_method: string;
  amount: string; // Decimal returned as string
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  transaction_id: string | null;
  created_at: string;
  updated_at: string;
}

export const createPayment = async (orderId: number, paymentMethod: string): Promise<PaymentResponse> => {
  const response = await apiClient.post<PaymentResponse>(`/payments/${orderId}`, {
    payment_method: paymentMethod,
  });
  return response.data;
};

export const simulatePaymentSuccess = async (orderId: number): Promise<PaymentResponse> => {
  const response = await apiClient.post<PaymentResponse>(`/payments/${orderId}/success`);
  return response.data;
};

export const simulatePaymentFailure = async (orderId: number): Promise<PaymentResponse> => {
  const response = await apiClient.post<PaymentResponse>(`/payments/${orderId}/failure`);
  return response.data;
};
