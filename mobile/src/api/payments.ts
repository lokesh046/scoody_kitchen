import apiClient from './client';

export interface RazorpayVerifyPayload {
  order_id: number;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export const createOrderPayment = async (orderId: number, paymentMethod: string = 'CARD'): Promise<any> => {
  const response = await apiClient.post(`/payments/${orderId}`, {
    payment_method: paymentMethod,
  });
  return response.data;
};

export const verifyRazorpayPayment = async (payload: RazorpayVerifyPayload): Promise<any> => {
  const response = await apiClient.post('/payments/razorpay/verify', payload);
  return response.data;
};
