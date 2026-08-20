import { apiClient } from './client';
import type { ProductResponse } from '../types/product';

export interface CreateProductData {
  category_id: number;
  name: string;
  description: string;
  sku: string;
  price: string;
  image_url?: string;
  available_stock: number;
  ingredients?: Array<{ name: string; percentage: number }>;
}

export interface CreateCategoryData {
  name: string;
  description: string;
}

export const createProduct = async (productData: CreateProductData): Promise<ProductResponse> => {
  const formData = new FormData();
  formData.append('category_id', String(productData.category_id));
  formData.append('name', productData.name);
  formData.append('price', String(productData.price));
  formData.append('sku', productData.sku);
  if (productData.description) {
    formData.append('description', productData.description);
  }
  if (productData.image_url) {
    formData.append('image_url', productData.image_url);
  }
  if (productData.available_stock !== undefined) {
    formData.append('available_stock', String(productData.available_stock));
  }
  const response = await apiClient.post<ProductResponse>('/product/', formData);
  return response.data;
};

export const updateProduct = async (
  productId: number,
  productData: Partial<CreateProductData>
): Promise<ProductResponse> => {
  const formData = new FormData();
  if (productData.category_id !== undefined) {
    formData.append('category_id', String(productData.category_id));
  }
  if (productData.name !== undefined) {
    formData.append('name', productData.name);
  }
  if (productData.price !== undefined) {
    formData.append('price', String(productData.price));
  }
  if (productData.sku !== undefined) {
    formData.append('sku', productData.sku);
  }
  if (productData.description !== undefined) {
    formData.append('description', productData.description || '');
  }
  if (productData.image_url !== undefined) {
    formData.append('image_url', productData.image_url || '');
  }
  if (productData.available_stock !== undefined) {
    formData.append('available_stock', String(productData.available_stock));
  }
  const response = await apiClient.patch<ProductResponse>(`/product/${productId}`, formData);
  return response.data;
};

export const deactivateProduct = async (productId: number): Promise<void> => {
  await apiClient.delete(`/product/${productId}`);
};

export const createCategory = async (categoryData: CreateCategoryData): Promise<any> => {
  const response = await apiClient.post('/categories', categoryData);
  return response.data;
};

export const updateCategory = async (categoryId: number, categoryData: Partial<CreateCategoryData>): Promise<any> => {
  const response = await apiClient.patch(`/categories/${categoryId}`, categoryData);
  return response.data;
};

export const deleteCategory = async (categoryId: number): Promise<any> => {
  const response = await apiClient.delete(`/categories/${categoryId}`);
  return response.data;
};

export const uploadProductImage = async (productId: number, file: File): Promise<ProductResponse> => {
  const formData = new FormData();
  formData.append('image', file);
  const response = await apiClient.post<ProductResponse>(`/product/${productId}/images`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export const deleteProductImage = async (productId: number): Promise<ProductResponse> => {
  const response = await apiClient.delete<ProductResponse>(`/product/${productId}/images`);
  return response.data;
};

export interface InventoryUpdate {
  stock_quantity?: number;
  low_stock_threshold?: number;
}

export const updateInventory = async (
  inventoryId: number,
  inventoryData: InventoryUpdate
): Promise<any> => {
  const response = await apiClient.patch(`/inventory/${inventoryId}`, inventoryData);
  return response.data;
};
