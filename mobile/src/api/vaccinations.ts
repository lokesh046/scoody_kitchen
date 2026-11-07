import apiClient from './client';

export type VaccineStatus = 'not_started' | 'optional' | 'overdue' | 'due_soon' | 'upcoming';
export type HistoryAnswerKind = 'given' | 'not_vaccinated' | 'unknown';

export interface VaccineStatusItem {
  code: string;
  name: string;
  category: 'core' | 'non_core';
  description: string | null;
  vet_reviewed: boolean;
  status: VaccineStatus;
  next_due_date: string | null;
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

export interface HistoryAnswer {
  vaccine_code: string;
  answer: HistoryAnswerKind;
  date_given?: string | null;
  clinic_name?: string | null;
}

/** A photo picked on the phone (camera or gallery). */
export interface PickedPhoto {
  uri: string;
  name: string;
  type: string;
}

// Photos can be several MB on a phone connection, so uploads get a longer limit than the app's 12s default.
const UPLOAD = { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 };
const asFile = (p: PickedPhoto) => ({ uri: p.uri, name: p.name, type: p.type }) as unknown as Blob;

export const fetchVaccinations = async (petId: number): Promise<VaccinationOverview> =>
  (await apiClient.get<VaccinationOverview>(`/pets/${petId}/vaccinations`)).data;

export const addVaccination = async (
  petId: number,
  data: { vaccine_code: string; date_given: string; clinic_name?: string; batch_number?: string; notes?: string },
  photo: PickedPhoto,
): Promise<VaccinationRecord> => {
  const form = new FormData();
  form.append('vaccine_code', data.vaccine_code);
  form.append('date_given', data.date_given);
  if (data.clinic_name) form.append('clinic_name', data.clinic_name);
  if (data.batch_number) form.append('batch_number', data.batch_number);
  if (data.notes) form.append('notes', data.notes);
  form.append('image', asFile(photo));
  return (await apiClient.post<VaccinationRecord>(`/pets/${petId}/vaccinations`, form, UPLOAD)).data;
};

export const deleteVaccination = async (petId: number, recordId: number): Promise<void> => {
  await apiClient.delete(`/pets/${petId}/vaccinations/${recordId}`);
};

export const saveVaccinationHistory = async (
  petId: number, answers: HistoryAnswer[], photos: Record<string, PickedPhoto>,
): Promise<VaccinationOverview> => {
  const form = new FormData();
  form.append('answers', JSON.stringify(answers));
  for (const [code, photo] of Object.entries(photos)) form.append(`photo_${code}`, asFile(photo));
  return (await apiClient.put<VaccinationOverview>(`/pets/${petId}/vaccinations/history`, form, UPLOAD)).data;
};

export const fetchVaccinationCardHtml = async (petId: number): Promise<string> =>
  (await apiClient.get<string>(`/pets/${petId}/vaccinations/card`, { responseType: 'text', transformResponse: (d) => d })).data;
