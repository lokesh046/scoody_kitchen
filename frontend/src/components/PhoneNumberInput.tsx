import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { COUNTRIES } from '../constants/countries';
import { getCountry } from '../utils/phone';

interface PhoneNumberInputProps {
  country: string; // iso2
  onCountryChange: (iso2: string) => void;
  nationalNumber: string;
  onNationalNumberChange: (digits: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

// Country-code-aware phone entry: a searchable flag/dial-code picker next
// to a plain digits field, instead of a single input with a hardcoded "+91"
// label. Used anywhere a user enters a phone number for verification.
export const PhoneNumberInput: React.FC<PhoneNumberInputProps> = ({
  country,
  onCountryChange,
  nationalNumber,
  onNationalNumberChange,
  disabled,
  placeholder = 'Phone number',
  autoFocus,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = getCountry(country);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const filtered = query.trim()
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.dialCode.includes(query.replace(/\D/g, ''))
      )
    : COUNTRIES;

  return (
    <div ref={containerRef} className="relative flex items-stretch border border-cardboard rounded-sm bg-paper overflow-visible focus-within:border-turmeric transition-colors">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-2.5 border-r border-cardboard font-mono text-sm text-ink hover:bg-paperLight transition-colors shrink-0 disabled:opacity-50"
      >
        <span className="text-base leading-none">{selected.flag}</span>
        <span>+{selected.dialCode}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      <input
        type="tel"
        value={nationalNumber}
        onChange={(e) => onNationalNumberChange(e.target.value.replace(/\D/g, ''))}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className="flex-1 min-w-0 py-2.5 px-3 bg-transparent font-mono text-sm text-ink focus:outline-none disabled:opacity-50"
      />

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-72 max-w-[90vw] bg-paperLight border border-cardboard rounded-sm shadow-lg z-50">
          <div className="flex items-center gap-2 p-2 border-b border-cardboard">
            <Search className="w-3.5 h-3.5 text-ink opacity-50 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country or code..."
              autoFocus
              className="flex-1 min-w-0 bg-transparent font-body text-xs text-ink focus:outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 font-body text-xs text-ink opacity-60">No matches.</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.iso2}
                  type="button"
                  onClick={() => {
                    onCountryChange(c.iso2);
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left font-body text-xs hover:bg-paper transition-colors ${
                    c.iso2 === country ? 'bg-paper font-bold' : ''
                  }`}
                >
                  <span className="text-base leading-none shrink-0">{c.flag}</span>
                  <span className="flex-1 truncate text-ink">{c.name}</span>
                  <span className="font-mono text-ink opacity-60 shrink-0">+{c.dialCode}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
