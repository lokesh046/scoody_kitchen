import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getFocusGeneration } from '../services/focusRefresh';

// Runs `load` when the screen gains focus, but at most once per `minIntervalMs`, unless:
//   - `key` changed (e.g. a different user signed in), or
//   - something was created/updated/deleted since the last load (focus generation).
// Pull-to-refresh and explicit reloads still call their own loaders directly.
export function useFocusRefresh(load: () => void, key: string | number | null | undefined, minIntervalMs = 120_000) {
  const loadRef = useRef(load);
  loadRef.current = load;
  const last = useRef({ at: 0, generation: -1, key: '__none__' });

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      const keyStr = String(key ?? '');
      const generation = getFocusGeneration();
      const state = last.current;
      const fresh = state.key === keyStr && state.generation === generation && now - state.at < minIntervalMs;
      if (fresh) return;
      last.current = { at: now, generation, key: keyStr };
      loadRef.current();
    }, [key, minIntervalMs])
  );
}
