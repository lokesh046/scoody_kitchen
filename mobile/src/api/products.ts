import apiClient from './client';
import { Product, Category } from '../types';

export const fetchCategories = async (): Promise<Category[]> => {
  const response = await apiClient.get('/categories');
  return response.data;
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
