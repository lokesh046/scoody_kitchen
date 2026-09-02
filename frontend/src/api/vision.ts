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

export interface ClassificationResponse {
  success: boolean;
  is_pet: boolean;
  species: string | null;
  primary_breed: string | null;
  confidence: number | null;
  top_matches: BreedMatch[];
  care_insights: CareInsights | null;
  error_message: string | null;
  processing_time_ms: number;
}

export async function classifyPetImage(file: File): Promise<ClassificationResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/vision/api/v1/classify', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Classification failed with status ${response.status}`);
  }

  return response.json();
}
