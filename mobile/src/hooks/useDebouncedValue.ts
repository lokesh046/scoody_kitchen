import { useEffect, useState } from 'react';

/**
 * Returns a copy of `value` that only updates after `delayMs` has passed
 * without `value` changing again. Use for typeahead/search inputs that
 * trigger a network call, so keystrokes don't each fire their own request.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
