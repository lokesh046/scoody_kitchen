import type { ProductResponse } from '../../types/product';

export const KG_PER_LB = 0.45359237;
export const DRAFT_KEY = 'meal_planner_draft_v1';
export type WeightUnit = 'kg' | 'lbs';
export type ActivityLevel = 'sedentary' | 'active' | 'very_active';
export type Allergy = 'beef' | 'chicken' | 'grains';

export const toKilograms = (weight: number, unit: WeightUnit) => unit === 'lbs' ? weight * KG_PER_LB : weight;
export const displayWeight = (kg: number, unit: WeightUnit) => Number((unit === 'lbs' ? kg / KG_PER_LB : kg).toFixed(2));
export const progressForStep = (step: number) => Math.round(Math.min(3, Math.max(0, step)) / 3 * 100);

export function estimateCalories(weightKg: number, activity: ActivityLevel | '') {
  if (!Number.isFinite(weightKg) || weightKg <= 0 || !activity) return 0;
  const factor = { sedentary: 1, active: 1.4, very_active: 1.8 }[activity];
  return Math.round(70 * Math.pow(weightKg, 0.75) * factor);
}

const excludedTerms: Record<Allergy, RegExp> = {
  beef: /\b(beef|bovine|veal)\b/i,
  chicken: /\b(chicken|poultry)\b/i,
  grains: /\b(grains?|rice|wheat|corn|maize|oats?|barley|rye|millet|sorghum)\b/i,
};

export function recommendRecipe(products: ProductResponse[], allergies: Allergy[], activity: ActivityLevel | '', weightKg: number) {
  const candidates = products.filter((product) => {
    if (!product.is_active || product.is_in_stock === false || product.available_stock === 0) return false;
    const description = `${product.name} ${product.description || ''}`;
    return !allergies.some((allergy) => excludedTerms[allergy].test(description));
  });
  if (!candidates.length) return null;
  const preference = activity === 'very_active' ? /beef|active/i : weightKg < 18 * KG_PER_LB ? /salmon|fish|delicate/i : /chicken|turkey/i;
  return candidates.find((product) => preference.test(product.name)) || candidates[0];
}

export interface PlannerDraft {
  step: number;
  dogName: string;
  gender: 'male' | 'female' | '';
  breed: string;
  ageYears: number;
  ageMonths: number;
  weight: number | '';
  weightUnit: WeightUnit;
  activity: ActivityLevel | '';
  allergies: Allergy[];
  selectedGroup: string;
  breedQuery: string;
}

export const EMPTY_DRAFT: PlannerDraft = {
  step: 0, dogName: '', gender: '', breed: '', ageYears: 2, ageMonths: 0,
  weight: '', weightUnit: 'kg', activity: '', allergies: [], selectedGroup: '', breedQuery: '',
};

export function parseDraft(raw: string | null): PlannerDraft {
  if (!raw) return { ...EMPTY_DRAFT };
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return { ...EMPTY_DRAFT };
    const draft: PlannerDraft = {
      step: Number.isInteger(data.step) && data.step >= 0 && data.step <= 4 ? data.step : 0,
      dogName: typeof data.dogName === 'string' ? data.dogName.slice(0, 100) : '',
      gender: ['male', 'female'].includes(data.gender) ? data.gender : '',
      breed: typeof data.breed === 'string' ? data.breed : '',
      ageYears: Number.isInteger(data.ageYears) && data.ageYears >= 0 && data.ageYears <= 20 ? data.ageYears : 2,
      ageMonths: Number.isInteger(data.ageMonths) && data.ageMonths >= 0 && data.ageMonths <= 11 ? data.ageMonths : 0,
      weight: typeof data.weight === 'number' && Number.isFinite(data.weight) && data.weight > 0 ? data.weight : '',
      weightUnit: data.weightUnit === 'lbs' ? 'lbs' : 'kg',
      activity: ['sedentary', 'active', 'very_active'].includes(data.activity) ? data.activity : '',
      allergies: Array.isArray(data.allergies) ? [...new Set<Allergy>(data.allergies.filter((value: unknown) => ['beef', 'chicken', 'grains'].includes(value as string)))] : [],
      selectedGroup: typeof data.selectedGroup === 'string' ? data.selectedGroup : '',
      breedQuery: typeof data.breedQuery === 'string' ? data.breedQuery : '',
    };
    if (draft.step > 1 && (!draft.dogName.trim() || !draft.gender)) draft.step = 1;
    if (draft.step > 2 && (!draft.breed || !draft.selectedGroup || !draft.weight || draft.ageYears + draft.ageMonths === 0)) draft.step = 2;
    if (draft.step > 3 && !draft.activity) draft.step = 3;
    return draft;
  } catch {
    return { ...EMPTY_DRAFT };
  }
}

// Older pending sign-in payloads stored pounds without a unit marker.
export const pendingPetWeightKg = (weight: number, unit?: string) => toKilograms(weight, unit === 'kg' ? 'kg' : 'lbs');
