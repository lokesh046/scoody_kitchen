import { PET_CATEGORIES, categoryForBreed, type PetCategory } from '../../constants/breedCategory';
import { SPECIES_OPTIONS } from './petFormHelpers';

export function SpeciesDropdown({ value, onChange, id, className = '' }: {
  value: string; onChange: (v: string) => void; id?: string; className?: string;
}) {
  const options = SPECIES_OPTIONS.includes(value) ? SPECIES_OPTIONS : [...SPECIES_OPTIONS, value];
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full h-11 px-3.5 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric transition-colors cursor-pointer ${className}`}
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/** Dogs only. Set automatically from the breed; the owner can pick one only when the breed isn't recognised. */
export function DogCategoryField({ species, breed, value, onChange, labelClass }: {
  species: string; breed: string; value: PetCategory | null; onChange: (c: PetCategory) => void; labelClass: string;
}) {
  if (species.toLowerCase() !== 'dog') return null;
  const auto = categoryForBreed(breed);
  const current = auto ?? value;
  return (
    <div className="space-y-1.5 text-left">
      <span className={labelClass}>Category:</span>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Dog category">
        {PET_CATEGORIES.map((c) => {
          const active = current === c;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={!!auto}
              onClick={() => onChange(c)}
              className={`h-9 rounded-sm border font-mono text-[11px] uppercase font-bold transition-all ${
                active ? 'bg-herb text-white border-herb shadow-xs' : 'bg-paperLight border-cardboard text-ink'
              } ${auto ? (active ? 'cursor-default' : 'opacity-45 cursor-not-allowed') : 'cursor-pointer hover:bg-paper'}`}
            >
              {c}
            </button>
          );
        })}
      </div>
      <p className="font-body text-[11px] text-ink/60">
        {auto ? 'Set automatically from the breed.' : breed.trim() ? "We don't recognise this breed. Pick the closest category." : 'Choose a breed and the category is set automatically.'}
      </p>
    </div>
  );
}
