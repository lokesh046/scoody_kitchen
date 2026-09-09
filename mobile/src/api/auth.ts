import apiClient from './client';
import { UserProfile } from '../store/authStore';

export const fetchCurrentUser = async (): Promise<UserProfile> => {
  const response = await apiClient.get<UserProfile>('/auth/me');
  return response.data;
};

export interface UpdateProfileParams {
  first_name?: string;
  last_name?: string;
  phone?: string;
  profile_image_url?: string;
}

export const updateUserProfile = async (params: UpdateProfileParams): Promise<UserProfile> => {
  const response = await apiClient.patch<UserProfile>('/auth/me', params);
  return response.data;
};

export const uploadAvatarImage = async (imageUri: string): Promise<{ url: string }> => {
  const filename = imageUri.split('/').pop() || 'avatar.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const ext = match ? match[1].toLowerCase() : 'jpg';
  const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  const formData = new FormData();
  formData.append('file', {
    uri: imageUri,
    name: filename,
    type,
  } as any);

  const response = await apiClient.post<{ url: string }>('/auth/upload-avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export interface RequestOtpResponse {
  allowed: boolean;
  attempts_remaining?: number;
}

export const requestOtpPreCheck = async (
  phoneNumber: string
): Promise<RequestOtpResponse> => {
  const response = await apiClient.post<RequestOtpResponse>('/auth/request-otp', {
    phone_number: phoneNumber,
  });
  return response.data;
};

export const verifyPhoneWithToken = async (idToken: string = 'test_firebase_token'): Promise<UserProfile> => {
  const response = await apiClient.post<UserProfile>('/auth/firebase/verify-phone', {
    id_token: idToken,
  });
  return response.data;
};
