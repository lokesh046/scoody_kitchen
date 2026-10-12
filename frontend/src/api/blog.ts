import { apiClient } from './client';
import type { BlogPostListItem, BlogPostResponse } from '../types/blog';

export const fetchPublishedBlogPosts = async (): Promise<BlogPostListItem[]> => {
  const response = await apiClient.get<BlogPostListItem[]>('/blog/');
  return response.data;
};

export const fetchAllBlogPosts = async (): Promise<BlogPostResponse[]> => {
  const response = await apiClient.get<BlogPostResponse[]>('/blog/all');
  return response.data;
};

export const fetchBlogPostBySlug = async (slug: string): Promise<BlogPostResponse> => {
  const response = await apiClient.get<BlogPostResponse>(`/blog/${slug}`);
  return response.data;
};

export interface BlogPostUpdatePayload {
  title?: string;
  slug?: string;
  excerpt?: string;
  content_html?: string;
  primary_keyword?: string;
  keywords?: string;
  meta_description?: string;
  status?: 'draft' | 'published';
}

export const updateBlogPost = async (id: number, payload: BlogPostUpdatePayload): Promise<BlogPostResponse> => {
  const response = await apiClient.patch<BlogPostResponse>(`/blog/${id}`, payload);
  return response.data;
};

export const deleteBlogPost = async (id: number): Promise<void> => {
  await apiClient.delete(`/blog/${id}`);
};

export const uploadBlogCoverImage = async (id: number, image: File): Promise<BlogPostResponse> => {
  const formData = new FormData();
  formData.append('image', image);
  const response = await apiClient.post<BlogPostResponse>(`/blog/${id}/cover-image`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};
