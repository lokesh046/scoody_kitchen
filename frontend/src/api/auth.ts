import { apiClient } from './client';

export interface UserResponse {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  profile_image_url: string | null;
  auth_provider: string;
  is_email_verified: boolean;
  role: string;
  is_active: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RegisterParams {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
}

export const registerUser = async (params: RegisterParams): Promise<{ message: string }> => {
  const response = await apiClient.post('/auth/register', params);
  return response.data;
};

export const requestMagicLink = async (email: string, firstName?: string, lastName?: string): Promise<{ message: string }> => {
  const response = await apiClient.post('/auth/magic-link', {
    email,
    first_name: firstName || undefined,
    last_name: lastName || undefined,
  });
  return response.data;
};

export const verifyMagicCode = async (email: string, code: string): Promise<TokenResponse> => {
  const response = await apiClient.post('/auth/magic-link/verify-code', {
    email,
    code,
  });
  return response.data;
};

export const verifyMagicToken = async (token: string): Promise<TokenResponse> => {
  const response = await apiClient.post('/auth/magic-link/verify-token', {
    token,
  });
  return response.data;
};

export const fetchCurrentUser = async (): Promise<UserResponse> => {
  const response = await apiClient.get('/auth/me');
  return response.data;
};

export const logoutUser = async (): Promise<{ message: string }> => {
  const response = await apiClient.post('/auth/logout');
  return response.data;
};

export const authenticateGoogle = async (idToken: string): Promise<TokenResponse> => {
  const response = await apiClient.post('/auth/google', {
    id_token: idToken,
  });
  return response.data;
};

export interface UpdateProfileParams {
  first_name?: string;
  last_name?: string;
  phone?: string;
  profile_image_url?: string;
}

export const updateUserProfile = async (params: UpdateProfileParams): Promise<UserResponse> => {
  const response = await apiClient.patch('/auth/me', params);
  return response.data;
};

export const uploadAvatarImage = async (file: File): Promise<{ url: string }> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post('/auth/upload-avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};
