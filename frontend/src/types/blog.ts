export interface BlogPostListItem {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
}

export interface BlogPostResponse {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content_html: string;
  cover_image_url: string | null;
  primary_keyword: string | null;
  keywords: string | null;
  meta_description: string | null;
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
  published_at: string | null;
}
