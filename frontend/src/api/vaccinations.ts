import { apiClient } from './client';

export type VaccineStatus = 'not_started' | 'optional' | 'overdue' | 'due_soon' | 'upcoming';
export type HistoryAnswerKind = 'given' | 'not_vaccinated' | 'unknown';

export interface VaccineStatusItem {
  code: string;
  name: string;
  category: 'core' | 'non_core';
  description: string | null;
  vet_reviewed: boolean;
  status: VaccineStatus;
  next_due_date: string | null; // YYYY-MM-DD
  last_given_date: string | null;
  doses_given: number;
  series_doses: number;
  declared: 'not_vaccinated' | 'unknown' | null;
  recent: boolean;
}

export interface VaccinationRecord {
  id: number;
  pet_id: number;
  vaccine_code: string;
  date_given: string;
  clinic_name: string | null;
  batch_number: string | null;
  notes: string | null;
  image_url: string | null;
  created_at: string;
}

export interface VaccinationOverview {
  history_required: boolean;
  history_complete: boolean;
  pet_id: number;
  species: string;
  supported: boolean;
  date_of_birth_known: boolean;
  items: VaccineStatusItem[];
  records: VaccinationRecord[];
}

export interface VaccinationCreate {
  vaccine_code: string;
  date_given: string;
  clinic_name?: string | null;
  batch_number?: string | null;
  notes?: string | null;
}

export interface HistoryAnswer {
  vaccine_code: string;
  answer: HistoryAnswerKind;
  date_given?: string | null;
  clinic_name?: string | null;
}

export const fetchVaccinations = async (petId: number): Promise<VaccinationOverview> =>
  (await apiClient.get<VaccinationOverview>(`/pets/${petId}/vaccinations`)).data;

export const addVaccination = async (petId: number, data: VaccinationCreate): Promise<VaccinationRecord> =>
  (await apiClient.post<VaccinationRecord>(`/pets/${petId}/vaccinations`, data)).data;

export const deleteVaccination = async (petId: number, recordId: number): Promise<void> => {
  await apiClient.delete(`/pets/${petId}/vaccinations/${recordId}`);
};

export const uploadVaccinationImage = async (petId: number, recordId: number, file: File): Promise<VaccinationRecord> => {
  const form = new FormData();
  form.append('image', file);
  return (await apiClient.post<VaccinationRecord>(`/pets/${petId}/vaccinations/${recordId}/image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })).data;
};

export const saveVaccinationHistory = async (petId: number, answers: HistoryAnswer[]): Promise<VaccinationOverview> =>
  (await apiClient.put<VaccinationOverview>(`/pets/${petId}/vaccinations/history`, { answers })).data;
