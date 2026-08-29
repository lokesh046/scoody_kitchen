import { apiClient } from './client';

export interface UnifiedReview {
  id: number;
  type: 'product' | 'doctor';
  rating: number;
  comment: string | null;
  image_url: string | null;
  created_at: string;
  author_name: string;
  reviewed_item_name: string;
  reviewed_item_id: number;
  is_verified_buyer: boolean;
}

export interface ReviewListResponse<T> {
  total: number;
  page: number;
  limit: number;
  pages: number;
  items: T[];
}

export interface ProductReview {
  id: number;
  product_id: number;
  user_id: number;
  rating: number;
  comment: string | null;
  image_url: string | null;
  is_verified_buyer: boolean;
  created_at: string;
  updated_at: string;
  user?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface DoctorReview {
  id: number;
  consultation_id: number;
  doctor_id: number;
  customer_id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
  customer?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export const fetchRecentReviews = async (limit = 20): Promise<{ reviews: UnifiedReview[] }> => {
  const response = await apiClient.get<{ reviews: UnifiedReview[] }>('/reviews/recent', {
    params: { limit },
  });
  return response.data;
};

export const fetchProductReviews = async (
  productId: number,
  page = 1,
  limit = 20
): Promise<ReviewListResponse<ProductReview>> => {
  const response = await apiClient.get<ReviewListResponse<ProductReview>>(
    `/reviews/products/${productId}`,
    { params: { page, limit } }
  );
  return response.data;
};

export const submitProductReview = async (
  productId: number,
  formData: FormData
): Promise<ProductReview> => {
  const response = await apiClient.post<ProductReview>(
    `/reviews/products/${productId}`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};

export const fetchDoctorReviews = async (
  doctorId: number,
  page = 1,
  limit = 20
): Promise<ReviewListResponse<DoctorReview>> => {
  const response = await apiClient.get<ReviewListResponse<DoctorReview>>(
    `/reviews/doctors/${doctorId}`,
    { params: { page, limit } }
  );
  return response.data;
};

export const submitDoctorReview = async (
  consultationId: number,
  payload: { rating: number; comment?: string | null }
): Promise<DoctorReview> => {
  const response = await apiClient.post<DoctorReview>(
    `/reviews/consultations/${consultationId}`,
    payload
  );
  return response.data;
};

export const deleteProductReview = async (reviewId: number): Promise<void> => {
  await apiClient.delete(`/reviews/products/${reviewId}`);
};

export const deleteDoctorReview = async (reviewId: number): Promise<void> => {
  await apiClient.delete(`/reviews/doctors/${reviewId}`);
};

export interface ReviewEligibilityResponse {
  eligible: boolean;
  purchase_count: number;
  review_count: number;
  reason: 'eligible' | 'no_purchase' | 'already_reviewed';
}

export const checkProductReviewEligibility = async (
  productId: number
): Promise<ReviewEligibilityResponse> => {
  const response = await apiClient.get<ReviewEligibilityResponse>(
    `/reviews/products/${productId}/eligibility`
  );
  return response.data;
};
