import apiClient from './client';
import { Product, Category } from '../types';
import { withTtlCache } from './ttlCache';

// Categories rarely change and are fetched both by tab-prefetch on app start
// and by KitchenScreen on every mount/focus — cache to avoid the duplicate call.
export const fetchCategories = async (): Promise<Category[]> => {
  return withTtlCache('products:categories', 5 * 60 * 1000, async () => {
    const response = await apiClient.get('/categories');
    return response.data;
  });
};

export const fetchProducts = async (params?: {
  category_id?: number;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: Product[]; total: number; page: number; pages: number }> => {
  const response = await apiClient.get('/product', { params });
  return response.data;
};

export const fetchProductById = async (id: number): Promise<Product> => {
  const response = await apiClient.get(`/product/${id}`);
  return response.data;
};
