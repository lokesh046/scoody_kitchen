export interface CategoryResponse {
  id: number;
  name: string;
  description?: string;
}

export interface ProductImageResponse {
  id: number;
  product_id: number;
  image_url: string;
  display_order: number;
}

export interface ProductResponse {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  sku: string;
  price: string; // Decimal is returned as string from FastAPI
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: CategoryResponse;
  available_stock?: number;
  is_in_stock?: boolean;
  inventory_id?: number;
  reserved_stock?: number;
  low_stock_threshold?: number;
  images?: ProductImageResponse[];
}

export interface Ingredient {
  name: string;
  percentage: number;
}
