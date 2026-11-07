import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Loader2, Plus, Syringe, Trash2 } from 'lucide-react';
import {
  addVaccination, deleteVaccination, fetchVaccinations, uploadVaccinationImage,
  type VaccineStatus, type VaccineStatusItem,
} from '../../api/vaccinations';
import { VaccinationHistoryModal } from './VaccinationHistoryModal';

const STATUS_LABEL: Record<VaccineStatus, string> = {
  overdue: 'Overdue',
  due_soon: 'Due soon',
  upcoming: 'On track',
  optional: 'Optional',
  not_started: 'Add birth date',
};
const STATUS_CLASS: Record<VaccineStatus, string> = {
  overdue: 'bg-red-100 text-red-800 border-red-300',
  due_soon: 'bg-amber-100 text-amber-800 border-amber-300',
  upcoming: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  optional: 'bg-paperLight text-ink border-cardboard',
  not_started: 'bg-paperLight text-ink border-cardboard',
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const fmt = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export function VaccinationsPanel({ petId, petName, dob }: { petId: number; petName: string; dob: string | null }) {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['vaccinations', petId],
    queryFn: () => fetchVaccinations(petId),
  });
  const [adding, setAdding] = useState<string | null>(null); // vaccine code with the form open
  const [showHistory, setShowHistory] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['vaccinations', petId] });

  if (isLoading) return <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-herb" /></div>;
  if (isError || !data) return <div className="py-6 text-sm text-paprika">Couldn't load vaccination records. Please try again.</div>;
  if (!data.supported) {
    return (
      <div className="border border-dashed border-cardboard rounded-sm p-5 text-sm text-ink bg-paperLight">
        Vaccine schedules for {data.species || 'this species'} are coming soon. We currently support dogs and cats.
      </div>
    );
  }

  const nameOf = (code: string) => data.items.find((i) => i.code === code)?.name ?? code;
  const anyDraft = data.items.some((i) => !i.vet_reviewed);

  return (
    <div className="space-y-5">
      {data.history_required && !data.history_complete && (
        <div className="border border-amber-300 bg-amber-50 rounded-sm p-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
          <span className="font-body text-sm text-amber-900">
            {petName}'s vaccination history isn't complete yet. Tell us the last dose for each core vaccine.
          </span>
          <button type="button" onClick={() => setShowHistory(true)} className="h-9 px-3 bg-herb text-white font-mono text-[10px] uppercase font-bold rounded-sm cursor-pointer shrink-0">
            Complete history
          </button>
        </div>
      )}

      <div className="space-y-3">
        {data.items.map((item) => (
          <VaccineCard
            key={item.code}
            item={item}
            open={adding === item.code}
            onToggle={() => setAdding(adding === item.code ? null : item.code)}
            petId={petId}
            dob={dob}
            onSaved={() => { setAdding(null); refresh(); }}
          />
        ))}
      </div>

      <div>
        <h4 className="font-mono text-[10px] uppercase tracking-wider text-ink font-bold mb-2">Recorded doses ({data.records.length})</h4>
        {data.records.length === 0 ? (
          <p className="font-body text-sm text-ink opacity-70">No doses recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {data.records.map((r) => (
              <RecordRow key={r.id} petId={petId} record={r} name={nameOf(r.vaccine_code)} onChanged={refresh} />
            ))}
          </ul>
        )}
      </div>

      {anyDraft && (
        <p className="font-body text-[11px] text-ink opacity-60 leading-relaxed">
          Schedules follow general veterinary guidance (WSAVA) and are pending review by our vets. Always confirm timings with your own vet.
        </p>
      )}

      {showHistory && (
        <VaccinationHistoryModal
          petId={petId}
          petName={petName}
          dob={dob}
          items={data.items}
          dismissible
          onClose={() => setShowHistory(false)}
          onDone={() => { setShowHistory(false); refresh(); }}
        />
      )}
    </div>
  );
}

function VaccineCard({ item, open, onToggle, petId, dob, onSaved }: {
  item: VaccineStatusItem; open: boolean; onToggle: () => void; petId: number; dob: string | null; onSaved: () => void;
}) {
  const [date, setDate] = useState('');
  const [clinic, setClinic] = useState('');
  const [batch, setBatch] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const rec = await addVaccination(petId, {
        vaccine_code: item.code,
        date_given: date,
        clinic_name: clinic || null,
        batch_number: batch || null,
        notes: notes || null,
      });
      if (photo) {
        try { await uploadVaccinationImage(petId, rec.id, photo); } catch { /* the dose is saved; photo can be re-added */ }
      }
    },
    onSuccess: () => {
      setDate(''); setClinic(''); setBatch(''); setNotes(''); setPhoto(null); setError('');
      onSaved();
    },
    onError: (e: any) => setError(e?.response?.data?.detail || 'Could not save this dose.'),
  });

  const dateBad = date !== '' && (date > todayIso() || (dob !== null && date < dob));
  const next = item.next_due_date ? fmt(item.next_due_date) : null;

  return (
    <div className="border border-cardboard border-opacity-50 rounded-sm bg-paper">
      <div className="p-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Syringe className="w-4 h-4 text-herb shrink-0" />
            <span className="font-body font-semibold text-sm text-ink">{item.name}</span>
            <span className={`px-2 py-0.5 text-[10px] font-mono uppercase font-bold border rounded-sm ${STATUS_CLASS[item.status]}`}>
              {STATUS_LABEL[item.status]}
            </span>
            {item.recent && <span className="px-2 py-0.5 text-[10px] font-mono uppercase font-bold border border-herb text-herb rounded-sm">Recent</span>}
          </div>
          <div className="font-body text-xs text-ink opacity-75 mt-1">
            {item.declared
              ? item.declared === 'unknown' ? "You said you don't know — please check with your vet." : 'Marked as not vaccinated — please see your vet.'
              : item.doses_given === 0
                ? (item.category === 'core' ? 'No dose recorded yet.' : 'Not given yet.')
                : `Last dose ${fmt(item.last_given_date)} · ${item.doses_given} recorded`}
            {next && <> · Next due <strong>{next}</strong></>}
            {item.doses_given > 0 && item.doses_given < item.series_doses && <> · starter series {item.doses_given}/{item.series_doses}</>}
          </div>
          {item.description && <div className="font-body text-xs text-ink opacity-60 mt-0.5">{item.description}</div>}
        </div>
        <button type="button" onClick={onToggle} className="h-9 px-3 border border-cardboard hover:bg-paperLight text-ink font-mono text-[10px] uppercase font-bold rounded-sm cursor-pointer flex items-center gap-1.5 shrink-0 self-start sm:self-center">
          <Plus className="w-3.5 h-3.5" /> {open ? 'Cancel' : 'Add dose'}
        </button>
      </div>

      {open && (
        <form
          className="border-t border-cardboard border-opacity-40 p-3 space-y-2 bg-paperLight"
          onSubmit={(e) => { e.preventDefault(); if (date && !dateBad) mutation.mutate(); }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="font-body text-xs text-ink">Date given *
              <input type="date" required value={date} max={todayIso()} min={dob || undefined} onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full h-9 px-2 border border-cardboard rounded-sm bg-paper text-sm" />
            </label>
            <label className="font-body text-xs text-ink">Clinic / vet
              <input type="text" maxLength={150} value={clinic} onChange={(e) => setClinic(e.target.value)}
                className="mt-1 w-full h-9 px-2 border border-cardboard rounded-sm bg-paper text-sm" />
            </label>
            <label className="font-body text-xs text-ink">Batch number
              <input type="text" maxLength={60} value={batch} onChange={(e) => setBatch(e.target.value)}
                className="mt-1 w-full h-9 px-2 border border-cardboard rounded-sm bg-paper text-sm" />
            </label>
            <div className="font-body text-xs text-ink">Vaccine card photo
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
              <button type="button" onClick={() => fileRef.current?.click()} className="mt-1 w-full h-9 px-2 border border-dashed border-cardboard rounded-sm bg-paper text-sm flex items-center gap-2 cursor-pointer truncate">
                <Camera className="w-4 h-4 shrink-0" /> <span className="truncate">{photo ? photo.name : 'Add photo (optional)'}</span>
              </button>
            </div>
          </div>
          <label className="font-body text-xs text-ink block">Notes
            <textarea maxLength={1000} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 border border-cardboard rounded-sm bg-paper text-sm" />
          </label>
          {dateBad && <div className="text-paprika text-xs">Date can't be in the future or before {dob ? 'the birth date' : 'today'}.</div>}
          {error && <div className="text-paprika text-xs" role="alert">{error}</div>}
          <button type="submit" disabled={!date || dateBad || mutation.isPending}
            className="h-9 px-4 bg-herb text-white font-mono text-[10px] uppercase font-bold rounded-sm cursor-pointer disabled:opacity-50 flex items-center gap-2">
            {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save dose
          </button>
        </form>
      )}
    </div>
  );
}

function RecordRow({ petId, record, name, onChanged }: {
  petId: number; record: import('../../api/vaccinations').VaccinationRecord; name: string; onChanged: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr('');
    try { await fn(); onChanged(); } catch (e: any) { setErr(e?.response?.data?.detail || 'Something went wrong.'); } finally { setBusy(false); }
  };
  return (
    <li className="border border-cardboard border-opacity-40 rounded-sm p-3 flex items-start justify-between gap-3 bg-paper">
      <div className="min-w-0 font-body text-sm text-ink">
        <div className="font-semibold">{name} <span className="font-normal opacity-70">· {fmt(record.date_given)}</span></div>
        <div className="text-xs opacity-70">
          {[record.clinic_name, record.batch_number && `Batch ${record.batch_number}`, record.notes].filter(Boolean).join(' · ')}
        </div>
        {record.image_url && (
          <a href={record.image_url} target="_blank" rel="noopener noreferrer" className="text-xs text-herb underline">View vaccine card photo</a>
        )}
        {err && <div className="text-paprika text-xs">{err}</div>}
      </div>
      <div className="flex gap-1.5 shrink-0">
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) run(() => uploadVaccinationImage(petId, record.id, f)); e.target.value = ''; }} />
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} aria-label="Add or replace vaccine card photo"
          className="w-8 h-8 border border-cardboard rounded-sm flex items-center justify-center cursor-pointer hover:bg-paperLight disabled:opacity-50">
          <Camera className="w-4 h-4" />
        </button>
        <button type="button" disabled={busy} aria-label="Delete this dose"
          onClick={() => { if (window.confirm('Delete this dose record?')) run(() => deleteVaccination(petId, record.id)); }}
          className="w-8 h-8 border border-cardboard rounded-sm flex items-center justify-center cursor-pointer hover:bg-red-50 text-paprika disabled:opacity-50">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </li>
  );
}
