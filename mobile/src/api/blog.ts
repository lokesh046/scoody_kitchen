import apiClient from './client';
import { withTtlCache } from './ttlCache';

export interface BlogPostListItem {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
}

export interface BlogPost {
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

// Posts only change when something gets published/edited from the admin
// panel — same "rarely changes" caching rationale as faqs.ts/banners.ts.
export const fetchPublishedBlogPosts = async (): Promise<BlogPostListItem[]> => {
  return withTtlCache('blog:published', 5 * 60 * 1000, async () => {
    const response = await apiClient.get<BlogPostListItem[]>('/blog/');
    return response.data;
  });
};

export const fetchBlogPostBySlug = async (slug: string): Promise<BlogPost> => {
  return withTtlCache(`blog:post:${slug}`, 5 * 60 * 1000, async () => {
    const response = await apiClient.get<BlogPost>(`/blog/${slug}`);
    return response.data;
  });
};
