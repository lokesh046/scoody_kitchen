import { useState } from 'react';
import { BREED_NAMES, PET_CATEGORIES, categoryForBreed, type PetCategory } from '../../constants/breedCategory';
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

/** Species as buttons (Dog, Cat, Bird, Reptile); a pet saved earlier with another species keeps an extra button. */
export function SpeciesButtons({ value, onChange, compact = false }: { value: string; onChange: (v: string) => void; compact?: boolean }) {
  const options = SPECIES_OPTIONS.includes(value) ? SPECIES_OPTIONS : [...SPECIES_OPTIONS, value];
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-4 ${compact ? 'gap-1.5' : 'gap-2'}`} role="radiogroup" aria-label="Species">
      {options.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          onClick={() => onChange(s)}
          className={`${compact ? 'h-9 text-[11px]' : 'py-2.5 px-3 text-xs'} border text-center font-mono uppercase font-bold rounded-sm transition-colors cursor-pointer ${
            value === s ? 'bg-herb text-white border-herb shadow-xs' : 'bg-paperLight hover:bg-paper border-cardboard text-ink'
          }`}
        >
          {s} {s === 'Dog' && '🐶'}{s === 'Cat' && '🐱'}{s === 'Bird' && '🦜'}{s === 'Reptile' && '🦎'}
        </button>
      ))}
    </div>
  );
}

/** Breed text box that suggests dog breeds while typing (names that start with, then contain, what was typed). */
export function BreedInput({ value, onChange, species, id, placeholder, className }: {
  value: string; onChange: (v: string) => void; species: string; id?: string; placeholder?: string; className: string;
}) {
  const [open, setOpen] = useState(false);
  const q = value.trim().toLowerCase();
  let suggestions: string[] = [];
  if (open && species.toLowerCase() === 'dog' && q.length >= 1 && !BREED_NAMES.some((n) => n.toLowerCase() === q)) {
    const starts = BREED_NAMES.filter((n) => n.toLowerCase().startsWith(q));
    const has = BREED_NAMES.filter((n) => !n.toLowerCase().startsWith(q) && n.toLowerCase().includes(q));
    suggestions = [...starts, ...has].slice(0, 7);
  }
  return (
    <div className="relative">
      <input
        type="text"
        id={id}
        value={value}
        autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        placeholder={placeholder}
        className={className}
        role="combobox"
        aria-expanded={suggestions.length > 0}
        aria-autocomplete="list"
      />
      {suggestions.length > 0 && (
        <ul role="listbox" className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-paper border border-cardboard rounded-sm shadow-lg">
          {suggestions.map((n) => (
            <li key={n} role="option" aria-selected={false}>
              <button
                type="button"
                // mouse down (not click) so the choice lands before the box loses focus and closes the list
                onMouseDown={(e) => { e.preventDefault(); onChange(n); setOpen(false); }}
                className="w-full text-left px-3 py-2 font-body text-sm text-ink hover:bg-paperLight cursor-pointer"
              >
                {n}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
