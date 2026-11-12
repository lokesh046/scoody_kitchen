import { useId, useState } from 'react';
import { PET_CATEGORIES, categoryForBreed, type PetCategory } from '../../constants/breedCategory';
import { SPECIES_OPTIONS } from './petFormHelpers';
import { PET_BREED_SUGGESTIONS } from '../../constants/petBreedSuggestions';

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

/** Species as buttons (Dog, Cat, Bird, Reptile, Goat, Cattle, Buffalo); a pet saved earlier with another species keeps an extra button. */
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
          {s} {s === 'Dog' && '🐶'}{s === 'Cat' && '🐱'}{s === 'Bird' && '🦜'}{s === 'Reptile' && '🦎'}{s === 'Goat' && '🐐'}{s === 'Cattle' && '🐄'}{s === 'Buffalo' && '🐃'}
        </button>
      ))}
    </div>
  );
}

/** Species-aware breed suggestions. A typed breed can always be kept as a custom entry. */
export function BreedInput({ value, onChange, species, id, placeholder, className, required, invalid, describedBy, extraSuggestions = [] }: {
  value: string; onChange: (v: string) => void; species: string; id?: string; placeholder?: string; className: string;
  required?: boolean; invalid?: boolean; describedBy?: string; extraSuggestions?: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = useId();
  const q = value.trim().toLowerCase();
  const names = [...new Map([...(PET_BREED_SUGGESTIONS[species.toLowerCase()] || []), ...extraSuggestions]
    .filter((name) => name.trim()).map((name) => [name.toLowerCase(), name])).values()];
  const suggestions = [
    ...names.filter((name) => name.toLowerCase().startsWith(q)),
    ...names.filter((name) => !name.toLowerCase().startsWith(q) && name.toLowerCase().includes(q)),
  ].slice(0, 7);
  const choose = (name: string) => { onChange(name); setOpen(false); setActiveIndex(-1); };

  return (
    <div className="relative">
      <input
        type="text" id={id} value={value} required={required} autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActiveIndex(-1); }}
        onFocus={() => { setOpen(true); setActiveIndex(-1); }}
        onBlur={() => { setOpen(false); setActiveIndex(-1); }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); setOpen(false); setActiveIndex(-1); }
          if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && suggestions.length) {
            e.preventDefault();
            setOpen(true);
            const next = e.key === 'ArrowDown' ? (activeIndex + 1) % suggestions.length : (activeIndex <= 0 ? suggestions.length - 1 : activeIndex - 1);
            setActiveIndex(next);
            requestAnimationFrame(() => document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: 'nearest' }));
          }
          if (e.key === 'Enter' && open && activeIndex >= 0 && suggestions[activeIndex]) {
            e.preventDefault(); choose(suggestions[activeIndex]);
          }
        }}
        placeholder={placeholder} className={className} role="combobox"
        aria-expanded={open && suggestions.length > 0} aria-controls={open && suggestions.length ? listId : undefined}
        aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        aria-autocomplete="list" aria-invalid={invalid || undefined} aria-describedby={describedBy}
      />
      {open && suggestions.length > 0 && (
        <ul id={listId} role="listbox" aria-label={`${species} breed suggestions`} className="absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-cardboard rounded-lg shadow-lg">
          {suggestions.map((name, index) => (
            <li key={name} id={`${listId}-${index}`} role="option" aria-selected={activeIndex === index}>
              <button
                type="button" tabIndex={-1}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(name)}
                className={`w-full min-h-11 text-left px-3 py-2 font-body text-sm text-ink hover:bg-paper ${activeIndex === index ? 'bg-paper font-bold' : ''}`}
              >{name}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
