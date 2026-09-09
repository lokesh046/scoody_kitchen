import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { resolveHost } from './resolveHost';
import { getAccessToken } from '../services/secureTokenStorage';

export interface BreedMatch {
  breed: string;
  confidence: number;
  species: string;
}

export interface CareInsights {
  temperament: string;
  adult_size_category: string;
  nutritional_focus: string;
  recommended_recipe: string;
  health_watch: string[];
}

export interface SuperpowerSkills {
  scent_radar: number;
  stamina_speed: number;
  cuddle_index: number;
  watchdog_instinct: number;
  swimming_affinity: number;
}

export interface BreedHeritage {
  origin_country: string;
  origin_flag: string;
  origin_era: string;
  historical_homeland: string;
  mutation_story: string;
  fun_facts: string[];
  famous_icons: string[];
  superpowers: SuperpowerSkills;
}

export interface ClassificationResponse {
  success: boolean;
  is_pet: boolean;
  species: string | null;
  primary_breed: string | null;
  confidence: number | null;
  top_matches: BreedMatch[];
  care_insights: CareInsights | null;
  heritage: BreedHeritage | null;
  error_message: string | null;
  processing_time_ms: number;
}

export const getVisionBaseUrl = (): string => resolveHost(8003, process.env.EXPO_PUBLIC_VISION_URL);

export async function classifyPetPhoto(imageUri: string): Promise<ClassificationResponse> {
  const token = useAuthStore.getState().accessToken || (await getAccessToken());
  if (!token) {
    throw new Error('Please log in to your account to use the AI Pet Vision Scanner.');
  }

  const filename = imageUri.split('/').pop() || 'pet_scan.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const ext = match ? match[1].toLowerCase() : 'jpg';
  const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  const formData = new FormData();
  formData.append('file', {
    uri: imageUri,
    name: filename,
    type,
  } as any);

  const baseUrl = getVisionBaseUrl();
  const response = await axios.post<ClassificationResponse>(`${baseUrl}/api/v1/classify`, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
    timeout: 25000,
  });

  return response.data;
}
