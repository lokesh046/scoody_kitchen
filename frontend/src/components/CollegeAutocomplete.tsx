import React, { useState, useEffect, useRef } from 'react';
import { searchColleges } from '../api/colleges';
import type { CollegeSearchResult } from '../api/colleges';
import { Loader2, Search } from 'lucide-react';

interface CollegeAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  required?: boolean;
}

export const CollegeAutocomplete: React.FC<CollegeAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "Search college/university name...",
  className = "",
  id,
  required = false
}) => {
  const [results, setResults] = useState<CollegeSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [noMatches, setNoMatches] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Reset highlighted index on new search queries
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [results, value]);

  // Fetch results with debounce and cancel support
  useEffect(() => {
    if (value.trim().length < 2) {
      setResults([]);
      setNoMatches(false);
      setErrorMessage(null);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setNoMatches(false);
    setErrorMessage(null);

    const debounceTimer = setTimeout(async () => {
      try {
        const data = await searchColleges(value, controller.signal);
        setResults(data);
        if (data.length === 0) {
          setNoMatches(true);
        }
      } catch (err: any) {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          console.error("Colleges search failed:", err);
          setErrorMessage("Failed to fetch colleges. Please try again.");
          setResults([]);
        }
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [value]);

  // Handle keyboard interaction (accessibility)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) {
      if (e.key === 'ArrowDown') {
        setShowDropdown(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        if (highlightedIndex >= 0 && highlightedIndex < results.length) {
          e.preventDefault(); // Prevents form submits
          const selected = results[highlightedIndex];
          onChange(selected.name);
          setShowDropdown(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowDropdown(false);
        setHighlightedIndex(-1);
        break;
      default:
        break;
    }
  };

  return (
    <div ref={dropdownRef} className="relative w-full text-left">
      <div className="relative">
        <input
          type="text"
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowDropdown(true);
            setErrorMessage(null);
          }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown && (results.length > 0 || noMatches || !!errorMessage)}
          aria-controls="college-listbox"
          aria-activedescendant={highlightedIndex >= 0 ? `college-option-${highlightedIndex}` : undefined}
          className={`w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors pr-8 ${className}`}
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center space-x-1">
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 text-turmeric animate-spin" />
          ) : (
            <Search className="w-3.5 h-3.5 text-cardboard opacity-75" />
          )}
        </div>
      </div>

      {showDropdown && (value.trim().length >= 2) && (results.length > 0 || noMatches || !!errorMessage) && (
        <div 
          id="college-listbox"
          role="listbox"
          className="absolute left-0 right-0 mt-1 bg-paperLight border border-cardboard shadow-md rounded-sm z-50 max-h-60 overflow-y-auto animate-fade-in divide-y divide-cardboard divide-opacity-35"
        >
          {errorMessage && (
            <div className="px-3 py-2.5 text-xs text-paprika font-mono uppercase">
              ⚠️ {errorMessage}
            </div>
          )}
          {noMatches && !errorMessage && (
            <div className="px-3 py-2.5 text-xs text-cardboard font-mono uppercase">
              No matching colleges found
            </div>
          )}
          {results.map((college, index) => (
            <button
              key={college.id}
              id={`college-option-${index}`}
              role="option"
              aria-selected={highlightedIndex === index}
              type="button"
              onClick={() => {
                onChange(college.name);
                setShowDropdown(false);
              }}
              className={`w-full text-left px-3 py-2 font-body text-xs text-ink transition-colors cursor-pointer block ${
                highlightedIndex === index 
                  ? 'bg-paper bg-opacity-95 font-bold' 
                  : 'hover:bg-paper'
              }`}
            >
              <div className="font-bold leading-tight">{college.name}</div>
              <div className="text-[10px] text-cardboard font-mono mt-0.5 leading-none">
                {college.city}, {college.district}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
