import { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { VaccineCardPhotoPicker } from './VaccineCardPhotoPicker';
import { saveVaccinationHistory, type HistoryAnswer, type HistoryAnswerKind, type VaccineStatusItem } from '../../api/vaccinations';

type Choice = { kind: HistoryAnswerKind | null; date: string; clinic: string; photo: File | null };

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * The "vaccination history" step. Every core vaccine must be answered: the last dose date,
 * "Not vaccinated" or "Don't know". Shown right after an older pet is added, and it cannot be
 * skipped there (dismissible is false). For existing pets it can be opened and closed.
 */
export function VaccinationHistoryModal({
  petId, petName, dob, items, dismissible, onDone, onClose,
}: {
  petId: number;
  petName: string;
  dob: string | null;
  items: VaccineStatusItem[];
  dismissible: boolean;
  onDone: () => void;
  onClose?: () => void;
}) {
  const core = items.filter((i) => i.category === 'core');
  const optional = items.filter((i) => i.category !== 'core');
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(items.map((i) => [i.code, { kind: null, date: '', clinic: '', photo: null } as Choice])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (code: string, patch: Partial<Choice>) =>
    setChoices((c) => ({ ...c, [code]: { ...c[code], ...patch } }));

  const dateProblem = (c: Choice): string | null => {
    if (c.kind !== 'given') return null;
    if (!c.date) return 'Enter the date';
    if (!c.photo) return 'Add a photo of the vaccine card';
    if (c.date > todayIso()) return "Can't be in the future";
    if (dob && c.date < dob) return "Can't be before birth date";
    return null;
  };
  const coreReady = core.every((i) => {
    const c = choices[i.code];
    return c.kind !== null && !dateProblem(c);
  });
  const optionalOk = optional.every((i) => !dateProblem(choices[i.code]));
  const canSave = coreReady && optionalOk && !saving;

  const submit = async () => {
    setSaving(true);
    setError('');
    const answers: HistoryAnswer[] = items
      .filter((i) => choices[i.code].kind !== null)
      .map((i) => {
        const c = choices[i.code];
        return {
          vaccine_code: i.code,
          answer: c.kind as HistoryAnswerKind,
          date_given: c.kind === 'given' ? c.date : null,
          clinic_name: c.kind === 'given' && c.clinic.trim() ? c.clinic.trim() : null,
        };
      });
    try {
      const photos: Record<string, File> = {};
      for (const i of items) { const c = choices[i.code]; if (c.kind === 'given' && c.photo) photos[i.code] = c.photo; }
      await saveVaccinationHistory(petId, answers, photos);
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const row = (i: VaccineStatusItem, required: boolean) => {
    const c = choices[i.code];
    const problem = dateProblem(c);
    const radio = (kind: HistoryAnswerKind, label: string) => (
      <label className="flex min-h-11 items-center gap-2 rounded-[10px] border border-cardboard/60 bg-white px-3 py-2 cursor-pointer has-[:checked]:border-herb has-[:checked]:bg-herb/5">
        <input type="radio" className="h-4 w-4 accent-paprika" name={`vh-${i.code}`} checked={c.kind === kind} onChange={() => set(i.code, { kind })} />
        <span>{label}</span>
      </label>
    );
    return (
      <div key={i.code} className="border border-cardboard/70 rounded-2xl p-4 space-y-3 bg-paperLight">
        <div className="font-display font-bold text-base text-ink">
          {i.name} {required ? <span className="text-paprika text-xs">*</span> : <span className="text-xs opacity-60">(optional)</span>}
        </div>
        <div className="flex flex-wrap gap-2 font-body text-sm text-ink">
          {radio('given', 'Last dose given on')}
          {radio('not_vaccinated', 'Not vaccinated')}
          {radio('unknown', "Don't know")}
        </div>
        {c.kind === 'given' && (
          <div className="flex flex-wrap gap-3 items-start">
            <div>
              <input
                type="date"
                value={c.date}
                max={todayIso()}
                min={dob || undefined}
                onChange={(e) => set(i.code, { date: e.target.value })}
                className="min-w-0 max-w-full h-11 px-3 border border-cardboard rounded-[12px] bg-white text-ink text-base focus:outline-none focus:border-paprika focus:ring-2 focus:ring-paprika/15"
                aria-label={`${i.name} last dose date`}
              />
              {problem && c.date !== '' && c.photo && <div className="text-paprika text-[11px] mt-0.5">{problem}</div>}
            </div>
            <input
              type="text"
              value={c.clinic}
              maxLength={150}
              onChange={(e) => set(i.code, { clinic: e.target.value })}
              placeholder="Clinic (optional)"
              className="min-w-0 max-w-full h-11 px-3 border border-cardboard rounded-[12px] bg-white text-ink text-base focus:outline-none focus:border-paprika focus:ring-2 focus:ring-paprika/15 flex-1 min-w-[10rem]"
            />
            <div className="w-full">
              <VaccineCardPhotoPicker file={c.photo} onChange={(photo) => set(i.code, { photo })} />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-ink bg-opacity-60 backdrop-blur-xs z-[60] flex items-start sm:items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="vh-title">
      <div className="w-full max-w-xl bg-paper border border-cardboard rounded-2xl shadow-2xl p-5 sm:p-6 space-y-5 my-auto">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-paprika shrink-0 mt-0.5" />
          <div>
            <h3 id="vh-title" className="font-display font-black text-xl text-ink">{petName}'s vaccination history</h3>
            <p className="font-body text-sm text-ink/80 mt-2 leading-relaxed">
              Tell us the last dose for each vaccine and add a photo of the vaccine card (upload or take one). If you're not sure, choose
              “Don't know” (no photo needed) and we'll flag it for a vet visit.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {core.map((i) => row(i, true))}
          {optional.length > 0 && (
            <>
              <div className="font-mono text-[10px] uppercase tracking-wider text-ink opacity-60 pt-1">Other vaccines you may have given</div>
              {optional.map((i) => row(i, false))}
            </>
          )}
        </div>

        {error && <div className="text-paprika text-xs font-semibold" role="alert">{error}</div>}

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-1">
          {dismissible && onClose && (
            <button type="button" onClick={onClose} className="min-h-11 px-5 border border-cardboard text-ink font-body text-sm font-semibold rounded-[12px] cursor-pointer hover:bg-paperLight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paprika">
              Close
            </button>
          )}
          <button
            type="button"
            disabled={!canSave}
            onClick={submit}
            className="min-h-11 px-5 bg-paprika text-white font-body text-sm font-semibold rounded-[12px] cursor-pointer hover:bg-paprika/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paprika disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save history
          </button>
        </div>
        {!coreReady && <p className="font-body text-[11px] text-ink opacity-60 text-right">Answer every vaccine marked * to continue.</p>}
      </div>
    </div>
  );
}
