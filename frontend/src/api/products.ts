import { apiClient } from './client';
import type { ProductResponse } from '../types/product';

interface PaginatedProducts {
  items: ProductResponse[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface FetchProductsParams {
  search?: string;
  categoryId?: number;
  page?: number;
  limit?: number;
}

export const fetchProducts = async (params: FetchProductsParams = {}): Promise<PaginatedProducts> => {
  const response = await apiClient.get<PaginatedProducts>('/product', {
    params: {
      search: params.search || undefined,
      category_id: params.categoryId || undefined,
      page: params.page || 1,
      limit: params.limit || 20,
    },
  });
  return response.data;
};

export const fetchProductById = async (id: number): Promise<ProductResponse> => {
  const response = await apiClient.get<ProductResponse>(`/product/${id}`);
  return response.data;
};

export interface Category {
  id: number;
  name: string;
  description?: string;
}

export const fetchCategories = async (): Promise<Category[]> => {
  const response = await apiClient.get<Category[]>('/categories');
  return response.data;
};
