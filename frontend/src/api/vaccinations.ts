import { apiClient } from './client';

export type VaccineStatus = 'not_started' | 'optional' | 'overdue' | 'due_soon' | 'upcoming' | 'complete';
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

// The vaccine card photo is mandatory, so a dose is always sent together with its photo.
export const addVaccination = async (petId: number, data: VaccinationCreate, photo: File): Promise<VaccinationRecord> => {
  const form = new FormData();
  form.append('vaccine_code', data.vaccine_code);
  form.append('date_given', data.date_given);
  if (data.clinic_name) form.append('clinic_name', data.clinic_name);
  if (data.batch_number) form.append('batch_number', data.batch_number);
  if (data.notes) form.append('notes', data.notes);
  form.append('image', photo);
  return (await apiClient.post<VaccinationRecord>(`/pets/${petId}/vaccinations`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })).data;
};

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

// Every "given" answer must come with its vaccine card photo (key: vaccine code).
export const saveVaccinationHistory = async (
  petId: number, answers: HistoryAnswer[], photos: Record<string, File>,
): Promise<VaccinationOverview> => {
  const form = new FormData();
  form.append('answers', JSON.stringify(answers));
  for (const [code, file] of Object.entries(photos)) form.append(`photo_${code}`, file);
  return (await apiClient.put<VaccinationOverview>(`/pets/${petId}/vaccinations/history`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })).data;
};

// The printable vaccination card (HTML). Fetched with the login token, then opened for printing / Save as PDF.
export const fetchVaccinationCardHtml = async (petId: number): Promise<string> =>
  (await apiClient.get<string>(`/pets/${petId}/vaccinations/card`, { responseType: 'text', transformResponse: (d) => d })).data;

export type GuideStatus = 'done' | 'overdue' | 'due_soon' | 'upcoming' | 'not_recorded' | 'optional' | 'info';

export interface VaccineGuide {
  supported: boolean;
  species: string;
  title: string | null;
  rules_title: string | null;
  subtitle: string | null;
  date_of_birth_known: boolean;
  planner: { dose: string; vaccine: string; vaccine_codes?: string[]; planned_age: string; due_date: string; date_given: string | null; status: GuideStatus; note: string | null }[];
  planner_note: string | null;
  schedule: { sno: number; age: string; vaccine: string; vaccine_codes?: string[]; protects: string | null; notes: string | null; status: GuideStatus | null; last_dose: string | null; next_due: string | null }[];
  timeline: { stage: number; age: string; what: string }[];
  rules: { topic: string; guidance: string }[];
  about: { label: string; text: string }[];
  sources: { title: string; url: string }[];
  disclaimer: string | null;
}

export const fetchVaccineGuide = async (petId: number): Promise<VaccineGuide> =>
  (await apiClient.get<VaccineGuide>(`/pets/${petId}/vaccinations/guide`)).data;
