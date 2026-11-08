import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, Plus, ShieldAlert } from 'lucide-react';
import { Header } from '../../components/Header';
import { Eyebrow } from '../../components/Eyebrow';
import {
  createVaccineRule, fetchVaccineRules, updateVaccineRule,
  type VaccineRule, type VaccineRuleInput,
} from '../../api/vaccineRules';

const EMPTY: VaccineRuleInput = {
  species: '', code: '', name: '', category: 'core', description: '',
  first_dose_weeks: 8, series_doses: 1, series_interval_weeks: 3, booster_months: 12, repeat_months: 12, booster_weeks: null,
  sort_order: 0, is_active: true, vet_reviewed: false,
};

const errText = (e: any) => {
  const d = e?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d) && d[0]?.msg) return String(d[0].msg).replace(/^Value error, /, '');
  return 'Could not save. Please check the values.';
};

function NumberField({ label, value, onChange, min = 0, max }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <label className="font-body text-xs text-ink block">{label}
      <input type="number" min={min} max={max} value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
        className="mt-1 w-full h-9 px-2 border border-cardboard rounded-sm bg-paper text-sm" />
    </label>
  );
}

function RuleForm({ initial, isNew, species, onSaved, onCancel }: {
  initial: VaccineRuleInput; isNew: boolean; species: string[]; onSaved: () => void; onCancel: () => void;
}) {
  const [f, setF] = useState<VaccineRuleInput>(initial);
  const [error, setError] = useState('');
  const set = <K extends keyof VaccineRuleInput>(k: K, v: VaccineRuleInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const nums = [f.first_dose_weeks, f.series_doses, f.series_interval_weeks, f.booster_months, f.repeat_months, f.sort_order];
  const valid = f.name.trim().length >= 2 && nums.every(Number.isFinite) && (!isNew || (f.species.trim().length >= 2 && f.code.trim().length >= 2));

  const m = useMutation({
    mutationFn: (): Promise<unknown> => {
      const body = { ...f, description: f.description?.trim() || null, name: f.name.trim() };
      if (isNew) return createVaccineRule({ ...body, species: f.species.trim(), code: f.code.trim() });
      // species and code can't be changed on an existing rule
      const { species: _s, code: _c, ...patch } = body; // eslint-disable-line @typescript-eslint/no-unused-vars
      return updateVaccineRule((initial as VaccineRule).id, patch);
    },
    onSuccess: onSaved,
    onError: (e) => setError(errText(e)),
  });

  return (
    <form className="border border-cardboard rounded-sm p-4 space-y-3 bg-paperLight"
      onSubmit={(e) => { e.preventDefault(); setError(''); if (valid) m.mutate(); }}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {isNew && (
          <>
            <label className="font-body text-xs text-ink block">Species *
              <input list="vr-species" value={f.species} onChange={(e) => set('species', e.target.value)} maxLength={30} placeholder="dog, cat, goat, cow"
                className="mt-1 w-full h-9 px-2 border border-cardboard rounded-sm bg-paper text-sm" />
              <datalist id="vr-species">{species.map((s) => <option key={s} value={s} />)}</datalist>
            </label>
            <label className="font-body text-xs text-ink block">Code * <span className="opacity-60">(letters, numbers, _)</span>
              <input value={f.code} onChange={(e) => set('code', e.target.value)} maxLength={40} placeholder="e.g. rabies"
                className="mt-1 w-full h-9 px-2 border border-cardboard rounded-sm bg-paper text-sm" />
            </label>
          </>
        )}
        <label className={`font-body text-xs text-ink block ${isNew ? '' : 'sm:col-span-2'}`}>Vaccine name *
          <input value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={120}
            className="mt-1 w-full h-9 px-2 border border-cardboard rounded-sm bg-paper text-sm" />
        </label>
        <label className="font-body text-xs text-ink block">Category
          <select value={f.category} onChange={(e) => set('category', e.target.value as 'core' | 'non_core')}
            className="mt-1 w-full h-9 px-2 border border-cardboard rounded-sm bg-paper text-sm">
            <option value="core">Core (every pet needs it)</option>
            <option value="non_core">Optional</option>
          </select>
        </label>
      </div>
      <label className="font-body text-xs text-ink block">Description shown to owners
        <textarea rows={2} maxLength={1000} value={f.description ?? ''} onChange={(e) => set('description', e.target.value)}
          className="mt-1 w-full px-2 py-1.5 border border-cardboard rounded-sm bg-paper text-sm" />
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <NumberField label="First dose at (weeks of age)" value={f.first_dose_weeks} min={0} max={520} onChange={(n) => set('first_dose_weeks', n)} />
        <NumberField label="Doses in the starter series" value={f.series_doses} min={1} max={20} onChange={(n) => set('series_doses', n)} />
        <NumberField label="Weeks between starter doses" value={f.series_interval_weeks} min={0} max={52} onChange={(n) => set('series_interval_weeks', n)} />
        <NumberField label="First booster after series (months, 0 = none)" value={f.booster_months} min={0} max={120} onChange={(n) => set('booster_months', n)} />
        <NumberField label="Repeat every (months, 0 = never)" value={f.repeat_months} min={0} max={240} onChange={(n) => set('repeat_months', n)} />
        <label className="font-body text-xs text-ink block">Booster in weeks (optional, replaces months)
          <input type="number" min={1} max={260} value={f.booster_weeks ?? ''}
            onChange={(e) => set('booster_weeks', e.target.value === '' ? null : Number(e.target.value))}
            className="mt-1 w-full h-9 px-2 border border-cardboard rounded-sm bg-paper text-sm" />
        </label>
        <NumberField label="Display order" value={f.sort_order} min={0} max={1000} onChange={(n) => set('sort_order', n)} />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 font-body text-sm text-ink">
        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={f.vet_reviewed} onChange={(e) => set('vet_reviewed', e.target.checked)} /> Reviewed and approved by a vet</label>
        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={f.is_active} onChange={(e) => set('is_active', e.target.checked)} /> Active (shown to owners)</label>
      </div>
      {error && <div className="text-paprika text-xs font-semibold" role="alert">{error}</div>}
      <div className="flex gap-2">
        <button type="submit" disabled={!valid || m.isPending} className="h-9 px-4 bg-herb text-white font-mono text-[10px] uppercase font-bold rounded-sm cursor-pointer disabled:opacity-50 flex items-center gap-2">
          {m.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {isNew ? 'Add vaccine' : 'Save changes'}
        </button>
        <button type="button" onClick={onCancel} className="h-9 px-4 border border-cardboard text-ink font-mono text-[10px] uppercase font-bold rounded-sm cursor-pointer">Cancel</button>
      </div>
    </form>
  );
}

export function AdminVaccineRulesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: rules = [], isLoading, isError } = useQuery({ queryKey: ['adminVaccineRules'], queryFn: fetchVaccineRules });
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const species = useMemo(() => Array.from(new Set(rules.map((r) => r.species))), [rules]);
  const shown = rules.filter((r) => filter === 'all' || r.species === filter);
  const done = () => { setEditing(null); qc.invalidateQueries({ queryKey: ['adminVaccineRules'] }); qc.invalidateQueries({ queryKey: ['vaccinations'] }); };

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body w-full">
      <Header activeTab="admin" onCartToggle={() => {}} />
      <main className="flex-grow max-w-5xl w-full mx-auto px-4 md:px-8 py-8">
        <button onClick={() => navigate('/admin')} className="font-mono text-[9px] uppercase tracking-wider text-ink opacity-70 hover:opacity-100 flex items-center space-x-1 cursor-pointer mb-6">
          <ArrowLeft className="w-3 h-3" /><span>Return to Administrative Core</span>
        </button>
        <div className="mb-6 border-b border-cardboard pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <Eyebrow label="PET HEALTH ADMINISTRATIVE CORE" />
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-ink mt-1">Vaccine rules</h2>
            <p className="font-body text-xs text-ink opacity-70 mt-1.5 max-w-xl">The schedule owners see for each species. Add goat, cow and others here. Editing a rule clears its “vet-reviewed” mark unless you tick it again.</p>
          </div>
          <button onClick={() => setEditing('new')} className="h-10 px-4 bg-turmeric text-ink font-mono text-[10px] uppercase font-bold rounded-sm cursor-pointer flex items-center gap-1.5 shrink-0">
            <Plus className="w-4 h-4" /> Add vaccine
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {['all', ...species].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase font-bold rounded-sm border cursor-pointer ${filter === s ? 'bg-ink text-paper border-ink' : 'border-cardboard text-ink'}`}>
              {s === 'all' ? 'All species' : s}
            </button>
          ))}
        </div>

        {editing === 'new' && (
          <div className="mb-5"><RuleForm initial={{ ...EMPTY, species: filter === 'all' ? '' : filter }} isNew species={species} onSaved={done} onCancel={() => setEditing(null)} /></div>
        )}

        {isLoading && <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-herb" /></div>}
        {isError && <div className="text-paprika text-sm">Couldn't load the rules.</div>}

        <div className="space-y-3">
          {shown.map((r) => (
            <div key={r.id} className={`border border-cardboard rounded-sm bg-paper ${r.is_active ? '' : 'opacity-60'}`}>
              {editing === r.id ? (
                <div className="p-3"><RuleForm initial={r} isNew={false} species={species} onSaved={done} onCancel={() => setEditing(null)} /></div>
              ) : (
                <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 bg-paperLight border border-cardboard rounded-sm">{r.species}</span>
                      <span className="font-body font-semibold text-sm text-ink">{r.name}</span>
                      <span className="text-[10px] font-mono uppercase opacity-60">{r.category === 'core' ? 'Core' : 'Optional'}</span>
                      {r.vet_reviewed
                        ? <span className="flex items-center gap-1 text-[10px] font-mono uppercase font-bold text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" /> Vet reviewed</span>
                        : <span className="flex items-center gap-1 text-[10px] font-mono uppercase font-bold text-amber-700"><ShieldAlert className="w-3.5 h-3.5" /> Draft</span>}
                      {!r.is_active && <span className="text-[10px] font-mono uppercase font-bold text-paprika">Inactive</span>}
                    </div>
                    <div className="font-body text-xs text-ink opacity-75 mt-1">
                      First dose at {r.first_dose_weeks} weeks · {r.series_doses} {r.series_doses === 1 ? 'dose' : 'doses'}
                      {r.series_doses > 1 && <> every {r.series_interval_weeks} weeks</>} · {r.booster_weeks ? <>booster after {r.booster_weeks} weeks</> : r.booster_months > 0 ? <>booster after {r.booster_months} months</> : <>no booster</>} · {r.repeat_months > 0 ? <>then every {r.repeat_months} months</> : <>no repeat</>}
                    </div>
                  </div>
                  <button onClick={() => setEditing(r.id)} className="h-9 px-3 border border-cardboard hover:bg-paperLight text-ink font-mono text-[10px] uppercase font-bold rounded-sm cursor-pointer shrink-0">Edit</button>
                </div>
              )}
            </div>
          ))}
          {!isLoading && shown.length === 0 && <p className="text-sm text-ink opacity-70">No vaccines yet for this species.</p>}
        </div>
      </main>
    </div>
  );
}

export default AdminVaccineRulesPage;
