import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Camera, FileDown, Loader2, MapPin, Plus, Syringe, Trash2 } from 'lucide-react';
import { useVetAccess } from '../../hooks/useFeatureFlag';
import {
  addVaccination, deleteVaccination, fetchVaccinationCardHtml, fetchVaccinations, uploadVaccinationImage,
  type VaccineStatus, type VaccineStatusItem,
} from '../../api/vaccinations';
import { VaccinationHistoryModal } from './VaccinationHistoryModal';
import { VaccineCardPhotoPicker } from './VaccineCardPhotoPicker';
import { VaccineGuide } from './VaccineGuide';

const STATUS_LABEL: Record<VaccineStatus, string> = {
  overdue: 'Overdue',
  due_soon: 'Due soon',
  upcoming: 'On track',
  optional: 'Optional',
  not_started: 'Add birth date',
  complete: 'Complete',
};
const STATUS_CLASS: Record<VaccineStatus, string> = {
  overdue: 'bg-red-50 text-red-800 border-red-200',
  due_soon: 'bg-amber-50 text-amber-900 border-amber-200',
  upcoming: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  optional: 'bg-paperLight text-ink border-cardboard',
  not_started: 'bg-paperLight text-ink border-cardboard',
  complete: 'bg-emerald-50 text-emerald-800 border-emerald-200',
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
  const navigate = useNavigate();
  const vet = useVetAccess();
  const [adding, setAdding] = useState<string | null>(null); // vaccine code with the form open
  const [showHistory, setShowHistory] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardError, setCardError] = useState('');
  const openCard = async () => {
    setCardBusy(true); setCardError('');
    try {
      const html = await fetchVaccinationCardHtml(petId);
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      const w = window.open(url, '_blank');
      if (!w) { setCardError('Allow pop-ups to open the card, then try again.'); URL.revokeObjectURL(url); return; }
      w.addEventListener('load', () => { try { w.focus(); w.print(); } catch { /* the owner can print manually */ } });
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setCardError("Couldn't create the card. Please try again.");
    } finally {
      setCardBusy(false);
    }
  };
  const refresh = () => { qc.invalidateQueries({ queryKey: ['vaccinations', petId] }); qc.invalidateQueries({ queryKey: ['vaccine-guide', petId] }); };

  if (isLoading) return <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-paprika" /></div>;
  if (isError || !data) return <div className="py-6 text-sm text-paprika">Couldn't load vaccination records. Please try again.</div>;
  if (!data.supported) {
    return (
      <div className="border border-dashed border-cardboard rounded-2xl p-5 text-sm leading-relaxed text-ink bg-paperLight">
        Vaccine schedules for {data.species || 'this species'} are coming soon. We currently support dogs and cats.
      </div>
    );
  }

  const nameOf = (code: string) => data.items.find((i) => i.code === code)?.name ?? code;
  const anyDraft = data.items.some((i) => !i.vet_reviewed);
  // Core vaccines that are overdue (incl. "not vaccinated / don't know") or have no record and no birth date to work from.
  const needsVet = data.items.filter((i) => i.category === 'core' && (i.status === 'overdue' || i.status === 'not_started'));
  const nearbyOn = vet.gps === 'on';

  return (
    <div className="space-y-6">
      {needsVet.length > 0 && (
        <div className="border border-red-200 bg-red-50 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between" role="status">
          <div className="min-w-0 font-body text-sm leading-relaxed text-red-900">
            <strong>{petName} needs a vet visit</strong> for {needsVet.map((i) => i.name.replace(/\s*\(.*\)$/, '')).join(', ')}.
            A vet can vaccinate and note it on the card.
          </div>
          {nearbyOn ? (
            <button type="button" onClick={() => navigate('/consultations/app')}
              className="min-h-11 px-4 font-body text-sm font-semibold rounded-[12px] cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paprika bg-paprika text-white hover:bg-paprika/90 shrink-0 flex items-center justify-center gap-2">
              <MapPin className="w-3.5 h-3.5" /> Find a vet near me
            </button>
          ) : (
            <button type="button" disabled aria-disabled="true"
              className="min-h-11 px-4 border border-cardboard text-ink/70 font-body text-sm font-semibold rounded-[12px] shrink-0 flex items-center justify-center gap-2 cursor-not-allowed">
              <MapPin className="w-3.5 h-3.5" /> Find a vet near me · Coming soon
            </button>
          )}
        </div>
      )}

      {data.history_required && !data.history_complete && (
        <div className="border border-amber-200 bg-amber-50 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <span className="min-w-0 font-body text-sm leading-relaxed text-amber-900">
            {petName}'s vaccination history isn't complete yet. Tell us the last dose for each core vaccine.
          </span>
          <button type="button" onClick={() => setShowHistory(true)} className="min-h-11 px-4 font-body text-sm font-semibold rounded-[12px] cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paprika bg-paprika text-white hover:bg-paprika/90 shrink-0">
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

      <div className="border-t border-cardboard/60 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h4 className="font-display text-base text-ink font-bold">Recorded doses ({data.records.length})</h4>
          <button type="button" onClick={openCard} disabled={cardBusy}
            className="min-h-11 px-4 font-body text-sm font-semibold rounded-[12px] cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paprika border border-cardboard bg-white hover:bg-paperLight text-ink flex items-center gap-2 disabled:opacity-60">
            {cardBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />} Vaccine card (PDF)
          </button>
        </div>
        {cardError && <div className="text-paprika text-xs mb-2" role="alert">{cardError}</div>}
        {data.records.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-cardboard bg-paperLight p-5 font-body text-sm text-ink/75">No doses recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {data.records.map((r) => (
              <RecordRow key={r.id} petId={petId} record={r} name={nameOf(r.vaccine_code)} onChanged={refresh} />
            ))}
          </ul>
        )}
      </div>

      <VaccineGuide petId={petId} petName={petName} vaccines={data.items} onUpdate={(code) => {
        setAdding(code);
        requestAnimationFrame(() => {
          const card = document.getElementById(`vaccine-${petId}-${code}`);
          card?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
          card?.querySelector<HTMLInputElement>('input[type="date"]')?.focus({ preventScroll: true });
        });
      }} />

      {anyDraft && (
        <p className="font-body text-sm text-ink/75 leading-relaxed">
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
  const mutation = useMutation({
    mutationFn: async () => {
      if (!photo) throw new Error('photo');
      await addVaccination(petId, {
        vaccine_code: item.code,
        date_given: date,
        clinic_name: clinic || null,
        batch_number: batch || null,
        notes: notes || null,
      }, photo);
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
    <div id={`vaccine-${petId}-${item.code}`} className="scroll-mt-24 overflow-hidden border border-cardboard/70 rounded-2xl bg-white">
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Syringe className="w-4 h-4 text-paprika shrink-0" />
            <span className="font-display font-bold text-base leading-snug text-ink">{item.name}</span>
            <span className={`px-2.5 py-1 text-xs font-body font-semibold border rounded-full ${STATUS_CLASS[item.status]}`}>
              {STATUS_LABEL[item.status]}
            </span>
            {item.recent && <span className="px-2.5 py-1 text-xs font-body font-semibold border border-herb/30 bg-herb/5 text-paprika rounded-full">Recent</span>}
          </div>
          <div className="font-body text-sm leading-relaxed text-ink/80 mt-3">
            {item.declared
              ? item.declared === 'unknown' ? "You said you don't know — please check with your vet." : 'Marked as not vaccinated — please see your vet.'
              : item.doses_given === 0
                ? (item.category === 'core' ? 'No dose recorded yet.' : 'Not given yet.')
                : `Last dose ${fmt(item.last_given_date)} · ${item.doses_given} recorded`}
            {next && <> · Next due <strong>{next}</strong></>}
            {item.doses_given > 0 && item.doses_given < item.series_doses && <> · starter series {item.doses_given}/{item.series_doses}</>}
          </div>
          {item.description && <div className="font-body text-sm leading-relaxed text-ink/70 mt-1">{item.description}</div>}
        </div>
        <button type="button" onClick={onToggle} className="min-h-11 px-4 font-body text-sm font-semibold rounded-[12px] cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paprika border border-herb/30 bg-herb/5 hover:bg-herb/10 text-paprika flex items-center justify-center gap-2 shrink-0 w-full sm:w-auto self-start sm:self-center">
          <Plus className="w-3.5 h-3.5" /> {open ? 'Cancel' : 'Add dose'}
        </button>
      </div>

      {open && (
        <form
          className="border-t border-cardboard/60 p-4 sm:p-5 space-y-4 bg-paperLight"
          onSubmit={(e) => { e.preventDefault(); if (date && photo && !dateBad) mutation.mutate(); }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="font-body text-sm text-ink">Date given *
              <input type="date" required value={date} max={todayIso()} min={dob || undefined} onChange={(e) => setDate(e.target.value)}
                className="mt-1.5 w-full min-w-0 h-11 px-3 border border-cardboard rounded-[12px] bg-white text-base focus:outline-none focus:border-paprika focus:ring-2 focus:ring-paprika/15" />
            </label>
            <label className="font-body text-sm text-ink">Clinic / vet
              <input type="text" maxLength={150} value={clinic} onChange={(e) => setClinic(e.target.value)}
                className="mt-1.5 w-full min-w-0 h-11 px-3 border border-cardboard rounded-[12px] bg-white text-base focus:outline-none focus:border-paprika focus:ring-2 focus:ring-paprika/15" />
            </label>
            <label className="font-body text-sm text-ink">Batch number
              <input type="text" maxLength={60} value={batch} onChange={(e) => setBatch(e.target.value)}
                className="mt-1.5 w-full min-w-0 h-11 px-3 border border-cardboard rounded-[12px] bg-white text-base focus:outline-none focus:border-paprika focus:ring-2 focus:ring-paprika/15" />
            </label>
            <div className="sm:col-span-2">
              <VaccineCardPhotoPicker file={photo} onChange={setPhoto} />
            </div>
          </div>
          <label className="font-body text-sm text-ink block">Notes
            <textarea maxLength={1000} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              className="mt-1.5 w-full px-3 py-2.5 border border-cardboard rounded-[12px] bg-white text-base focus:outline-none focus:border-paprika focus:ring-2 focus:ring-paprika/15" />
          </label>
          {dateBad && <div className="text-paprika text-xs">Date can't be in the future or before {dob ? 'the birth date' : 'today'}.</div>}
          {error && <div className="text-paprika text-xs" role="alert">{error}</div>}
          <button type="submit" disabled={!date || !photo || dateBad || mutation.isPending}
            className="min-h-11 px-4 font-body text-sm font-semibold rounded-[12px] cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paprika bg-paprika text-white hover:bg-paprika/90 disabled:opacity-50 flex items-center justify-center gap-2 w-full sm:w-auto">
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
    <li className="border border-cardboard/60 rounded-2xl p-4 flex flex-wrap items-start justify-between gap-3 bg-white">
      <div className="min-w-0 flex-1 basis-40 break-words font-body text-sm leading-relaxed text-ink">
        <div className="font-semibold">{name} <span className="font-normal opacity-70">· {fmt(record.date_given)}</span></div>
        <div className="text-xs opacity-70">
          {[record.clinic_name, record.batch_number && `Batch ${record.batch_number}`, record.notes].filter(Boolean).join(' · ')}
        </div>
        {record.image_url && (
          <a href={record.image_url} target="_blank" rel="noopener noreferrer" className="text-xs text-paprika underline">View vaccine card photo</a>
        )}
        {err && <div className="text-paprika text-xs">{err}</div>}
      </div>
      <div className="flex gap-1.5 shrink-0">
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) run(() => uploadVaccinationImage(petId, record.id, f)); e.target.value = ''; }} />
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} aria-label="Add or replace vaccine card photo"
          className="w-11 h-11 border border-cardboard rounded-[12px] flex items-center justify-center cursor-pointer hover:bg-paperLight disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paprika">
          <Camera className="w-4 h-4" />
        </button>
        <button type="button" disabled={busy} aria-label="Delete this dose"
          onClick={() => { if (window.confirm('Delete this dose record?')) run(() => deleteVaccination(petId, record.id)); }}
          className="w-11 h-11 border border-red-200 rounded-[12px] flex items-center justify-center cursor-pointer hover:bg-red-50 text-paprika disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paprika">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </li>
  );
}
