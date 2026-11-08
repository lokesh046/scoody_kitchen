import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Camera, Check, ChevronDown, ImagePlus, Loader2, PawPrint, Pencil, ScanLine, Upload, X } from 'lucide-react';
import type { ClassificationResponse } from '../../api/vision';
import { PET_CATEGORIES, categoryForBreed, type PetCategory } from '../../constants/breedCategory';
import { PetHeritagePassport } from '../../components/PetHeritagePassport';
import { BreedInput } from './PetFormFields';
import { canonSpecies, resolveCategory, SPECIES_OPTIONS } from './petFormHelpers';

export interface PetDraft {
  name: string;
  species: string;
  breed: string;
  category: PetCategory | null;
  gender: string;
  dob: string;
  weight: string;
  microchip: string;
}

interface AddPetWizardProps {
  value: PetDraft;
  onChange: (patch: Partial<PetDraft>) => void;
  step: number;
  onStepChange: (step: number) => void;
  onCancel: () => void;
  photoUrl: string | null;
  fileName?: string;
  knownBreeds?: string[];
  canUpload: boolean;
  isScanning: boolean;
  isUploading: boolean;
  isSaving: boolean;
  scanResult: ClassificationResponse | null;
  scanError: string | null;
  saveError: string;
  onUpload: () => void;
  onCamera: () => void;
  onSelectPhoto: (file: File) => void;
  onRemovePhoto: () => void;
  onScan: () => void;
  onScanUpload: () => void;
  onScanCamera: () => void;
  onSave: (event: FormEvent) => void;
}

const STEPS = ['Meet your pet', 'Details', 'Review'];
const INPUT = 'w-full min-h-12 rounded-lg border border-cardboard bg-white px-3.5 py-3 font-body text-sm text-ink placeholder:text-ink/50 focus:outline-none focus:border-paprika focus:ring-2 focus:ring-paprika/15';
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paprika focus-visible:ring-offset-2';
const LABEL = 'mb-2 block font-body text-sm font-bold text-ink';

function Choices({ label, options, value, onChange, locked = false }: { label: string; options: readonly string[]; value: string | null; onChange: (value: string) => void; locked?: boolean }) {
  return <div role="radiogroup" aria-label={label} className="grid grid-cols-2 sm:grid-cols-4 gap-2">{options.map((option) => <button
    key={option} type="button" role="radio" aria-checked={value === option} disabled={locked} onClick={() => onChange(option)}
    className={`min-h-11 rounded-lg border px-2 font-body text-sm transition-colors ${FOCUS} ${value === option ? 'border-paprika bg-paprika text-white font-bold' : 'border-cardboard bg-white text-ink hover:bg-paper'} ${locked ? 'cursor-default' : 'cursor-pointer'}`}
  >{option}</button>)}</div>;
}

function ReviewRows({ rows }: { rows: [string, string][] }) {
  return <dl className="divide-y divide-cardboard/60">{rows.map(([label, value]) => (
    <div key={label} className="flex justify-between items-start gap-5 py-3 text-sm font-body">
      <dt className="text-ink/70">{label}</dt><dd className="max-w-[65%] text-right font-bold text-ink break-words">{value || 'Not added'}</dd>
    </div>
  ))}</dl>;
}

export function AddPetWizard(props: AddPetWizardProps) {
  const { value, step, scanResult } = props;
  const [errors, setErrors] = useState<Partial<Record<keyof PetDraft, string>>>({});
  const [isDragging, setIsDragging] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const busy = props.isScanning || props.isUploading || props.isSaving;
  const hasResults = !!(scanResult?.success && scanResult.is_pet);
  const primaryBreed = scanResult?.primary_breed;
  const breedMatches = primaryBreed && !scanResult.top_matches.some((match) => match.breed.trim().toLowerCase() === primaryBreed.trim().toLowerCase())
    ? [{ breed: primaryBreed, confidence: scanResult.confidence, species: scanResult.species || value.species }, ...scanResult.top_matches]
    : scanResult?.top_matches || [];
  const selectedMatch = breedMatches.find((match) => match.breed.trim().toLowerCase() === value.breed.trim().toLowerCase());
  const selectedConfidence = selectedMatch?.confidence ?? (value.breed.trim().toLowerCase() === primaryBreed?.trim().toLowerCase() ? scanResult?.confidence : null);
  const category = resolveCategory(value.species, value.breed, value.category);
  const today = new Date().toLocaleDateString('en-CA');

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const update = (patch: Partial<PetDraft>) => {
    props.onChange(patch);
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch) as (keyof PetDraft)[]) delete next[key];
      return next;
    });
  };

  const validate = (target: number) => {
    const next: typeof errors = {};
    if (target > 1 && !value.name.trim()) next.name = 'Please enter your pet’s name.';
    if (target > 2) {
      if (!value.breed.trim()) next.breed = 'Please enter or choose your pet’s breed.';
      if (!value.dob) next.dob = 'Please enter your pet’s date of birth.';
      if (value.weight && (!Number.isFinite(Number(value.weight)) || Number(value.weight) <= 0)) next.weight = 'Enter a weight greater than 0 kg.';
      if (value.microchip && !/^\d{9,30}$/.test(value.microchip)) next.microchip = 'Enter 9 to 30 digits, or leave this blank.';
      if (value.dob && value.dob > today) next.dob = 'Choose today or an earlier date.';
      if (value.breed.length > 100) next.breed = 'Keep the breed name under 101 characters.';
    }
    setErrors(next);
    if (Object.keys(next).length) {
      const errorStep = next.name ? 1 : 2;
      props.onStepChange(errorStep);
      requestAnimationFrame(() => document.getElementById(`pet-${Object.keys(next)[0]}`)?.focus());
      return false;
    }
    return true;
  };

  const navigateTo = (target: number) => {
    if (busy || (target > step && !validate(target))) return;
    props.onStepChange(target);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy || !validate(step < 3 ? step + 1 : 3)) return;
    if (step < 3) props.onStepChange(step + 1);
    else props.onSave(event);
  };

  const detailsRows: [string, string][] = [
    ['Breed', value.breed],
    ['Date of birth', value.dob ? new Date(`${value.dob}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''],
    ['Weight', value.weight ? `${value.weight} kg` : ''],
    ['Microchip number', value.microchip],
    ['Gender', value.gender],
    ...(value.species.toLowerCase() === 'dog' ? [['Category', category || ''] as [string, string]] : []),
  ];

  const fieldError = (field: keyof PetDraft) => errors[field] ? <p id={`pet-${field}-error`} role="alert" className="mt-2 font-body text-xs text-rose-800">{errors[field]}</p> : null;

  return (
    <div className="mx-auto max-w-6xl pb-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div><h2 className="font-display text-2xl sm:text-3xl font-semibold text-ink">Add your pet</h2><p className="mt-2 font-body text-sm text-ink/70">A few details now, a profile you can keep building together.</p></div>
        <button type="button" onClick={props.onCancel} disabled={busy} className={`shrink-0 min-h-11 rounded-lg px-3 font-body text-sm text-ink/70 hover:text-ink disabled:opacity-50 ${FOCUS}`}>Close</button>
      </div>

      <nav aria-label="Add pet progress" className="mb-6">
        <ol className="grid grid-cols-3 gap-2 sm:gap-4">
          {STEPS.map((label, index) => <li key={label}>
            <button type="button" onClick={() => navigateTo(index + 1)} disabled={busy} aria-current={step === index + 1 ? 'step' : undefined} className={`w-full flex flex-col sm:flex-row items-center sm:justify-start gap-2 sm:gap-3 border-b-2 pb-4 font-body text-xs sm:text-sm rounded-t disabled:opacity-50 ${FOCUS} ${step === index + 1 ? 'border-paprika text-ink font-bold' : 'border-cardboard text-ink/65'}`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${index + 1 <= step ? 'bg-paprika border-paprika text-white' : 'border-cardboard bg-white'}`}>{index + 1 < step ? <Check aria-hidden="true" className="h-4 w-4" /> : index + 1}</span>{label}
            </button>
          </li>)}
        </ol>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <form ref={formRef} onSubmit={submit} noValidate className="min-w-0 flex flex-col rounded-2xl border border-cardboard/80 bg-white">
          <fieldset disabled={busy} className="min-w-0 flex-1 p-5 sm:p-8 space-y-6">
            <div>
              <p className="mb-2 font-body text-xs font-bold text-paprika">Step {step} of 3</p>
              <h3 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-semibold text-ink outline-none">{step === 1 ? 'Let’s meet your companion' : step === 2 ? 'The details that make them unique' : 'Ready to welcome them in?'}</h3>
              {step === 3 && <p className="mt-2 font-body text-sm leading-relaxed text-ink/70">Check the details below. You can edit anything before saving.</p>}
            </div>

            {step === 1 && <>
              {props.canUpload && <div role="group" aria-label="Scan and fill pet details" className="rounded-xl border border-herb/40 bg-herb/10 p-4">
                  <p className="font-body font-bold text-sm text-ink">Fill their details from a photo</p><p className="mt-1 font-body text-xs leading-relaxed text-ink/70">Scan a pet photo to fill the species, suggested breed, and dog category automatically. You can review and edit the results.</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button type="button" onClick={props.onScanUpload} disabled={busy} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-paprika px-4 font-body text-sm font-bold text-white hover:bg-paprika/90 disabled:opacity-60 ${FOCUS}`}><Upload aria-hidden="true" className="h-4 w-4" />Upload photo</button>
                    <button type="button" onClick={props.onScanCamera} disabled={busy} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-paprika/40 bg-white px-4 font-body text-sm font-bold text-paprika hover:bg-paper disabled:opacity-60 ${FOCUS}`}><Camera aria-hidden="true" className="h-4 w-4" />Take photo</button>
                  </div>
                  {props.photoUrl && <button type="button" onClick={props.onScan} disabled={busy} className={`mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 font-body text-sm font-bold text-paprika underline underline-offset-4 disabled:opacity-60 ${FOCUS}`}>{props.isScanning ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <ScanLine aria-hidden="true" className="h-4 w-4" />}{props.isScanning ? 'Scanning photo…' : 'Scan selected photo'}</button>}

              </div>}
              <div><label htmlFor="pet-name" className={LABEL}>Pet name <span className="font-normal text-ink/60">(required)</span></label><input id="pet-name" required value={value.name} maxLength={100} onChange={(e) => update({ name: e.target.value })} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'pet-name-error' : undefined} placeholder="e.g. Puma" autoComplete="off" className={INPUT} />{fieldError('name')}</div>
              <fieldset><legend className={LABEL}>Species</legend><Choices label="Species" options={SPECIES_OPTIONS.includes(value.species) ? SPECIES_OPTIONS : [...SPECIES_OPTIONS, value.species]} value={value.species} onChange={(species) => update({ species, category: null })} /></fieldset>
              {props.canUpload && <div>
                <p className={LABEL}>Pet photo <span className="font-normal text-ink/60">(optional)</span></p>
                <div
                  onDragOver={(e) => { e.preventDefault(); if (!busy) setIsDragging(true); }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDragging(false); }}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file && !busy) props.onSelectPhoto(file); }}
                  className={`rounded-xl border p-5 bg-paper/60 ${isDragging ? 'border-turmeric' : 'border-cardboard'}`}
                >
                  {props.photoUrl ? <div className="flex items-center gap-4"><img src={props.photoUrl} alt="Selected pet photo" className="h-24 w-24 rounded-xl object-cover" /><div className="min-w-0 flex-1"><p className="font-body text-sm font-bold text-ink">Your pet’s photo</p><p className="mt-1 truncate font-body text-xs text-ink/65">{props.fileName || 'Photo selected'}</p><button type="button" onClick={props.onRemovePhoto} disabled={busy} className={`mt-2 inline-flex min-h-9 items-center gap-1.5 rounded font-body text-xs text-ink/70 underline underline-offset-4 disabled:opacity-50 ${FOCUS}`}><X aria-hidden="true" className="h-3.5 w-3.5" />Remove photo</button></div></div> : <div className="flex items-center gap-3"><ImagePlus aria-hidden="true" className="h-8 w-8 shrink-0 text-turmeric" /><div><p className="font-body text-sm font-bold text-ink">Add a face to their profile</p><p className="mt-1 font-body text-xs text-ink/65">Drop a JPG, PNG or WebP photo here.</p></div></div>}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button type="button" onClick={props.onUpload} disabled={busy} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-cardboard bg-white px-4 font-body text-sm font-bold text-ink hover:border-turmeric disabled:opacity-50 ${FOCUS}`}><Upload aria-hidden="true" className="h-4 w-4" />{props.photoUrl ? 'Change photo' : 'Upload photo'}</button>
                    <button type="button" onClick={props.onCamera} disabled={busy} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 font-body text-sm font-bold text-ink hover:bg-cardboard/30 disabled:opacity-50 ${FOCUS}`}><Camera aria-hidden="true" className="h-4 w-4" />Use camera</button>
                  </div>
                </div>
                <p className="mt-2 font-body text-xs leading-relaxed text-ink/65">Use a clear, well-lit photo showing one pet’s face and body.</p>

              </div>}
            </>}

            {step === 2 && <>
              <div>
                <label htmlFor="pet-breed" className={LABEL}>Breed <span className="font-normal text-ink/60">(required)</span></label>
                <BreedInput id="pet-breed" required value={value.breed} species={value.species} onChange={(breed) => update({ breed })} placeholder="Search or enter a breed" className={INPUT}
                  invalid={!!errors.breed} describedBy={errors.breed ? 'pet-breed-error' : undefined}
                  extraSuggestions={[...(props.knownBreeds || []), ...(scanResult?.top_matches || []).filter((match) => match.species.toLowerCase() === value.species.toLowerCase()).map((match) => match.breed)]}
                />
                {fieldError('breed')}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div><label htmlFor="pet-dob" className={LABEL}>Date of birth <span className="font-normal text-ink/60">(required)</span></label><input id="pet-dob" type="date" required max={today} value={value.dob} onChange={(e) => update({ dob: e.target.value })} className={INPUT} aria-invalid={!!errors.dob} aria-describedby={errors.dob ? 'pet-dob-error' : undefined} />{fieldError('dob')}</div>
                <div><label htmlFor="pet-weight" className={LABEL}>Weight in kg <span className="font-normal text-ink/60">(optional)</span></label><input id="pet-weight" type="number" inputMode="decimal" min="0.1" step="0.1" value={value.weight} onChange={(e) => update({ weight: e.target.value })} placeholder="e.g. 14.5" className={INPUT} aria-invalid={!!errors.weight} aria-describedby={errors.weight ? 'pet-weight-error' : undefined} />{fieldError('weight')}</div>
              </div>
              <div><label htmlFor="pet-microchip" className={LABEL}>Microchip number <span className="font-normal text-ink/60">(optional)</span></label><input id="pet-microchip" inputMode="numeric" maxLength={30} value={value.microchip} onChange={(e) => update({ microchip: e.target.value.replace(/\D/g, '').slice(0, 30) })} placeholder="9 to 30 digits" className={INPUT} aria-invalid={!!errors.microchip} aria-describedby={errors.microchip ? 'pet-microchip-error' : 'pet-microchip-help'} /><p id="pet-microchip-help" className="mt-2 font-body text-xs text-ink/65">Use the number on your pet’s chip card. Leave blank if they don’t have one.</p>{fieldError('microchip')}</div>
              <fieldset><legend className={LABEL}>Gender</legend><div className="grid grid-cols-3 gap-2">{['Male', 'Female', 'Unknown'].map((gender) => <button key={gender} type="button" aria-pressed={value.gender === gender} onClick={() => update({ gender })} className={`min-h-11 rounded-lg border font-body text-sm ${FOCUS} ${value.gender === gender ? 'border-paprika bg-paprika text-white font-bold' : 'border-cardboard text-ink hover:bg-paper'}`}>{gender}</button>)}</div></fieldset>
              {value.species.toLowerCase() === 'dog' && <fieldset><legend className={LABEL}>Dog category <span className="font-normal text-ink/60">(optional)</span></legend><Choices label="Dog category" options={PET_CATEGORIES} value={category} locked={!!categoryForBreed(value.breed)} onChange={(category) => update({ category: category as PetCategory })} /><p className="mt-2 font-body text-xs text-ink/65">{categoryForBreed(value.breed) ? 'Set automatically from the breed.' : 'Choose the closest category, or leave it for later.'}</p></fieldset>}
            </>}

            {step === 3 && <div className="space-y-6">
              {props.photoUrl && <div className="lg:hidden flex items-center gap-4 rounded-xl border border-cardboard bg-paper/60 p-4"><img src={props.photoUrl} alt="Photo to save with the pet profile" className="h-20 w-20 rounded-lg object-cover" /><div className="font-body text-sm text-ink"><p className="font-bold">Their profile photo</p><button type="button" onClick={() => navigateTo(1)} disabled={busy} className={`mt-2 min-h-9 rounded text-paprika underline underline-offset-4 ${FOCUS}`}>Change photo</button></div></div>}
              <div><div className="flex justify-between items-center gap-3"><h4 className="font-display font-semibold text-lg text-ink">Meet your pet</h4><button type="button" onClick={() => navigateTo(1)} disabled={busy} className={`inline-flex min-h-11 items-center gap-1.5 rounded px-2 font-body text-sm font-bold text-paprika ${FOCUS}`}><Pencil aria-hidden="true" className="h-3.5 w-3.5" />Edit identity</button></div><ReviewRows rows={[[ 'Name', value.name ], ['Species', value.species]]} /></div>
              <div><div className="flex justify-between items-center gap-3"><h4 className="font-display font-semibold text-lg text-ink">Their details</h4><button type="button" onClick={() => navigateTo(2)} disabled={busy} className={`inline-flex min-h-11 items-center gap-1.5 rounded px-2 font-body text-sm font-bold text-paprika ${FOCUS}`}><Pencil aria-hidden="true" className="h-3.5 w-3.5" />Edit details</button></div><ReviewRows rows={detailsRows} /></div>
            </div>}

            {hasResults && <div className="rounded-xl border border-herb/40 bg-herb/10 p-4 font-body text-sm text-ink">
              <div role="status" aria-live="polite">
                <p className="font-bold">Selected breed: {value.breed || primaryBreed || 'Not identified'}{selectedConfidence != null && <span className="ml-2 font-normal"> {Math.round(selectedConfidence * 100)}% confidence</span>}</p>
                <p className="mt-2 text-xs leading-relaxed text-ink/70">The photo provides an estimate, not a genetic ancestry test.</p>
              </div>
              {!!breedMatches.length && <fieldset className="mt-4 min-w-0">
                <legend className="font-body text-xs font-bold text-ink">Select a breed match to update their details</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {breedMatches.map((match, index) => <button key={`${match.breed}-${index}`} type="button" disabled={busy}
                    aria-pressed={value.breed.trim().toLowerCase() === match.breed.trim().toLowerCase()}
                    onClick={() => update({ breed: match.breed, ...(match.species ? { species: canonSpecies(match.species), category: null } : {}) })}
                    className={`min-h-11 max-w-full rounded-lg border px-3 py-2 text-left font-body text-sm ${FOCUS} ${value.breed.trim().toLowerCase() === match.breed.trim().toLowerCase() ? 'border-paprika bg-paprika text-white font-bold' : 'border-cardboard bg-white text-ink hover:border-paprika'}`}
                  >{match.breed}{match.confidence != null && <span className="ml-2 whitespace-nowrap"> {Math.round(match.confidence * 100)}%</span>}</button>)}
                </div>
              </fieldset>}
            </div>}

            {props.isScanning && <p role="status" className="font-body text-sm text-ink/70">Finding possible breed matches. Please keep this page open.</p>}
            {props.isUploading && <p role="status" className="font-body text-sm text-ink/70">Uploading your pet’s photo…</p>}
            {props.scanError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 font-body text-sm text-rose-800">{props.scanError} You can try another photo or continue without a scan.</p>}
            {props.saveError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 font-body text-sm text-rose-800">{props.saveError}</p>}
          </fieldset>

          <div className="sticky bottom-0 z-20 flex items-center justify-between gap-4 rounded-b-2xl border-t border-cardboard bg-white p-4 sm:px-8 lg:static [padding-bottom:max(1rem,env(safe-area-inset-bottom))]">
            <button type="button" disabled={busy} onClick={() => step === 1 ? props.onCancel() : navigateTo(step - 1)} className={`inline-flex min-h-12 items-center gap-2 rounded-lg px-3 font-body font-bold text-sm text-ink disabled:opacity-50 ${FOCUS}`}><ArrowLeft aria-hidden="true" className="h-4 w-4" />{step === 1 ? 'Back to pets' : 'Back'}</button>
            <button type="submit" disabled={busy} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-paprika px-6 font-body font-bold text-sm text-white hover:bg-paprika/90 disabled:opacity-60 disabled:cursor-wait ${FOCUS}`}>{props.isSaving ? <><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />Saving pet…</> : <>{step === 3 ? 'Save pet' : 'Continue'}{step < 3 && <ArrowRight aria-hidden="true" className="h-4 w-4" />}</>}</button>
          </div>
        </form>

        <aside aria-label="Pet profile preview" className="hidden lg:flex lg:flex-col min-w-0 rounded-2xl border border-cardboard/80 bg-white p-5 sm:p-8">
          <div className="mb-5 flex items-center gap-2 font-body text-xs font-bold text-paprika"><PawPrint aria-hidden="true" className="h-4 w-4" />Your profile, taking shape</div>
          {props.photoUrl ? <img src={props.photoUrl} alt="Pet profile preview" className="mx-auto h-40 w-40 shrink-0 rounded-full object-cover" /> : <div className="mx-auto h-40 w-40 shrink-0 rounded-full border border-dashed border-cardboard bg-white flex items-center justify-center"><PawPrint aria-hidden="true" className="h-12 w-12 text-turmeric/70" strokeWidth={1.2} /></div>}
          <h3 className="mt-4 font-display font-semibold text-2xl text-ink break-words">{value.name.trim() || 'Your companion'}</h3><p className="mt-1 font-body text-sm text-ink/70">{value.species}{value.breed ? ` · ${value.breed}` : ''}</p>
          <ReviewRows rows={detailsRows} />
          <p className="mt-auto pt-4 font-body text-xs leading-relaxed text-ink/65">You can keep updating their profile after saving.</p>
        </aside>
      </div>

      {hasResults && <details className="group mt-6 rounded-2xl border border-cardboard bg-white p-5 sm:p-8">
        <summary className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded ${FOCUS}`}><span><span className="block font-display font-semibold text-lg text-ink">Breed insights & passport</span><span className="mt-1 block font-body text-sm text-ink/70">Explore breed background, care insights, and your downloadable passport.</span></span><ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 text-paprika transition-transform group-open:rotate-180" /></summary>
        <div className="mt-6 space-y-6 border-t border-cardboard pt-6">

          {scanResult.care_insights && <div><h4 className="font-display text-lg font-semibold text-ink">Care insights</h4><ReviewRows rows={[
            ['Temperament', scanResult.care_insights.temperament], ['Adult size', scanResult.care_insights.adult_size_category], ['Nutritional focus', scanResult.care_insights.nutritional_focus], ['Suggested recipe', scanResult.care_insights.recommended_recipe],
          ]} />{!!scanResult.care_insights.health_watch?.length && <div className="mt-3"><h5 className="font-body text-sm font-bold text-ink">Health considerations</h5><ul className="mt-2 list-disc pl-5 space-y-1 font-body text-sm text-ink/75">{scanResult.care_insights.health_watch.map((item) => <li key={item}>{item}</li>)}</ul></div>}</div>}
          {scanResult.heritage && <div className="space-y-3"><p className="font-body text-xs text-ink/65">Passport insights are based on the original photo estimate: {primaryBreed || 'Companion'}.</p><PetHeritagePassport petName={value.name} breedName={primaryBreed || 'Companion'} species={scanResult.species || value.species} photoUrl={props.photoUrl || undefined} heritage={scanResult.heritage} /></div>}
        </div>
      </details>}
    </div>
  );
}
