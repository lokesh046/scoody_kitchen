import apiClient from './client';

export interface CouponValidateResponse {
  valid: boolean;
  code: string;
  discount_type: 'PERCENTAGE' | 'FLAT';
  discount_value: number;
  discount_amount: number;
  final_amount: number;
  message: string;
}

export const validateCoupon = async (
  code: string,
  orderAmount: number
): Promise<CouponValidateResponse> => {
  const response = await apiClient.post<CouponValidateResponse>('/coupons/validate', {
    code: code.trim().toUpperCase(),
    order_amount: orderAmount,
  });
  return response.data;
};
