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

export const verifyPhoneWithToken = async (idToken: string): Promise<UserProfile> => {
  const response = await apiClient.post<UserProfile>('/auth/firebase/verify-phone', {
    id_token: idToken,
  });
  return response.data;
};

// WhatsApp OTP -- primary phone-verification channel. Fully backend-owned
// (unlike the Firebase REST flow above, which sends the SMS client-side),
// so there's no separate "pre-check" step: send-otp itself is the real send.
export const sendWhatsAppOtp = async (phoneNumber: string): Promise<{ sent: boolean; expires_in: number }> => {
  const response = await apiClient.post<{ sent: boolean; expires_in: number }>('/auth/whatsapp/send-otp', {
    phone_number: phoneNumber,
  });
  return response.data;
};

export const verifyWhatsAppOtp = async (phoneNumber: string, code: string): Promise<UserProfile> => {
  const response = await apiClient.post<UserProfile>('/auth/whatsapp/verify-otp', {
    phone_number: phoneNumber,
    code,
  });
  return response.data;
};
