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
  weight_options?: Array<{ weight: string; price: number | string }>;
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
  if (productData.weight_options) {
    formData.append('weight_options', JSON.stringify(productData.weight_options));
  }
  const response = await apiClient.post<ProductResponse>('/product/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const updateProduct = async (
  productId: number,
  productData: Partial<CreateProductData> & { is_active?: boolean }
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
  if (productData.weight_options !== undefined) {
    formData.append('weight_options', JSON.stringify(productData.weight_options));
  }
  if (productData.is_active !== undefined) {
    formData.append('is_active', String(productData.is_active));
  }
  const response = await apiClient.patch<ProductResponse>(`/product/${productId}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
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
  const response = await apiClient.patch<ProductResponse>(`/product/${productId}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export const deleteProductImage = async (productId: number): Promise<ProductResponse> => {
  const formData = new FormData();
  formData.append('image_url', '');
  const response = await apiClient.patch<ProductResponse>(`/product/${productId}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export const uploadProductGallery = async (productId: number, files: File[]): Promise<ProductResponse> => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('images', file);
  });
  const response = await apiClient.post<ProductResponse>(`/product/${productId}/gallery`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export const deleteProductGalleryImage = async (productId: number, imageId: number): Promise<ProductResponse> => {
  const response = await apiClient.delete<ProductResponse>(`/product/${productId}/gallery/${imageId}`);
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

export interface ProductInventoryResponse {
  product_id: number;
  stock_quantity: number;
  reserved_quantity: number;
  available_stock: number;
  low_stock: boolean;
}

export interface InventoryCreate {
  product_id: number;
  stock_quantity: number;
  low_stock_threshold: number;
}

export interface InventoryDetailsResponse {
  id: number;
  product_id: number;
  stock_quantity: number;
  reserved_quantity: number;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
}

export const fetchProductInventory = async (productId: number): Promise<ProductInventoryResponse> => {
  const response = await apiClient.get<ProductInventoryResponse>(`/product/${productId}/inventory`);
  return response.data;
};

export const fetchInventoryDetails = async (inventoryId: number): Promise<InventoryDetailsResponse> => {
  const response = await apiClient.get<InventoryDetailsResponse>(`/inventory/${inventoryId}`);
  return response.data;
};

export const createInventorySlot = async (inventoryData: InventoryCreate): Promise<InventoryDetailsResponse> => {
  const response = await apiClient.post<InventoryDetailsResponse>('/inventory', inventoryData);
  return response.data;
};
