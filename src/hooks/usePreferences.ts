import { useState, useEffect, useCallback } from 'react';
import { UserPreferences } from '../types';
import { getPreferences, savePreferences } from '../services/storage/preferences';

export function usePreferences() {
  const [preferences, setPrefs] = useState<UserPreferences>(getPreferences);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'playbench_prefs_v1' && e.newValue) {
        setPrefs(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const updatePreferences = useCallback((patch: Partial<UserPreferences>) => {
    const next = savePreferences(patch);
    setPrefs(next);
  }, []);

  return { preferences, updatePreferences };
}
