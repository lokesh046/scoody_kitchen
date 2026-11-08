import { apiClient } from './client';

export interface VaccineRule {
  id: number;
  species: string;
  code: string;
  name: string;
  category: 'core' | 'non_core';
  description: string | null;
  first_dose_weeks: number;
  series_doses: number;
  series_interval_weeks: number;
  booster_months: number;
  repeat_months: number;
  booster_weeks: number | null;
  sort_order: number;
  is_active: boolean;
  vet_reviewed: boolean;
}

export type VaccineRuleInput = Omit<VaccineRule, 'id'>;
export type VaccineRulePatch = Partial<Omit<VaccineRuleInput, 'species' | 'code'>>;

export const fetchVaccineRules = async (): Promise<VaccineRule[]> =>
  (await apiClient.get<VaccineRule[]>('/admin/vaccine-rules')).data;

export const createVaccineRule = async (data: VaccineRuleInput): Promise<VaccineRule> =>
  (await apiClient.post<VaccineRule>('/admin/vaccine-rules', data)).data;

export const updateVaccineRule = async (id: number, data: VaccineRulePatch): Promise<VaccineRule> =>
  (await apiClient.patch<VaccineRule>(`/admin/vaccine-rules/${id}`, data)).data;
