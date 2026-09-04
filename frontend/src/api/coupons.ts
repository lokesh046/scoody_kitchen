import { apiClient } from './client';

export type DiscountType = 'PERCENTAGE' | 'FLAT';

export interface CouponResponse {
  id: number;
  code: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: string | number;
  min_order_amount: string | number;
  max_discount_amount: string | number | null;
  valid_from: string;
  valid_until: string | null;
  usage_limit: number | null;
  used_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CouponCreatePayload {
  code: string;
  description?: string;
  discount_type: DiscountType;
  discount_value: number;
  min_order_amount?: number;
  max_discount_amount?: number | null;
  valid_until?: string | null;
  usage_limit?: number | null;
  is_active?: boolean;
}

export interface CouponUpdatePayload {
  description?: string;
  discount_type?: DiscountType;
  discount_value?: number;
  min_order_amount?: number;
  max_discount_amount?: number | null;
  valid_until?: string | null;
  usage_limit?: number | null;
  is_active?: boolean;
}

export interface CouponValidateResponse {
  valid: boolean;
  code: string;
  discount_type: DiscountType;
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
    code,
    order_amount: orderAmount,
  });
  return response.data;
};

export const fetchAdminCoupons = async (isActiveOnly?: boolean): Promise<CouponResponse[]> => {
  const response = await apiClient.get<CouponResponse[]>('/admin/coupons', {
    params: { is_active_only: isActiveOnly },
  });
  return response.data;
};

export const createAdminCoupon = async (
  payload: CouponCreatePayload
): Promise<CouponResponse> => {
  const response = await apiClient.post<CouponResponse>('/admin/coupons', payload);
  return response.data;
};

export const updateAdminCoupon = async (
  couponId: number,
  payload: CouponUpdatePayload
): Promise<CouponResponse> => {
  const response = await apiClient.patch<CouponResponse>(`/admin/coupons/${couponId}`, payload);
  return response.data;
};

export const deleteAdminCoupon = async (couponId: number): Promise<{ message: string }> => {
  const response = await apiClient.delete<{ message: string }>(`/admin/coupons/${couponId}`);
  return response.data;
};
