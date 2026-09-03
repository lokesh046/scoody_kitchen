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

import { useAuthStore } from '../store/auth';

export async function classifyPetImage(file: File): Promise<ClassificationResponse> {
  const token = useAuthStore.getState().accessToken;
  if (!token) {
    throw new Error('Please log in to your account to use the AI Pet Vision Scanner.');
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/vision/api/v1/classify', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Classification failed with status ${response.status}`);
  }

  return response.json();
}
