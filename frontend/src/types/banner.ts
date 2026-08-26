export interface BannerResponse {
  id: number;
  title: string | null;
  subtitle: string | null;
  image_url: string;
  link_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}
