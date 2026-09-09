export interface Category {
  id: number;
  name: string;
  slug?: string;
  description?: string;
  image_url?: string;
}

export interface ProductImage {
  id?: number;
  product_id?: number;
  image_url: string;
  display_order?: number;
}

export interface Product {
  id: number;
  category_id: number;
  name: string;
  description?: string | null;
  sku?: string;
  price: number;
  image_url?: string | null;
  is_active?: boolean;
  in_slider?: boolean;
  category?: Category | null;
  available_stock?: number | null;
  low_stock_threshold?: number | null;
  images?: ProductImage[];
  average_rating?: number;
  review_count?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selected_weight?: string;
}

export interface PetProfile {
  id: number;
  user_id?: number;
  name: string;
  species?: string;
  breed?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  weight?: number | null;
  weight_kg?: number;
  allergies?: string[];
  dietary_goals?: string[];
  profile_image_url?: string | null;
}

export interface DoctorUser {
  first_name?: string | null;
  last_name?: string | null;
  profile_image_url?: string | null;
}

export interface Doctor {
  id: number;
  user_id?: number;
  name?: string | null;
  specialization: string;
  qualification?: string;
  experience_years?: number;
  consultation_fee: number;
  bio?: string | null;
  profile_image_url?: string | null;
  is_available?: boolean;
  is_verified?: boolean;
  average_rating?: number;
  review_count?: number;
  user?: DoctorUser | null;
  clinic?: any;
}
