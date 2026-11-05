/**
 * LocalStorage wrapper for User Preferences
 */
import { UserPreferences } from '../../types';

const PREFS_KEY = 'playbench_prefs_v1';

export const DEFAULT_PREFERENCES: UserPreferences = {
  cuttingMatTheme: 'classic-green',
  gridDensity: 'standard',
  showRulers: true,
  soundEnabled: false,
  activeView: 'mat',
  updatedAt: Date.now(),
};

export const getPreferences = (): UserPreferences => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch (err) {
    console.warn('Failed to parse user preferences from localStorage, using defaults.', err);
    return DEFAULT_PREFERENCES;
  }
};

export const savePreferences = (patch: Partial<UserPreferences>): UserPreferences => {
  try {
    const current = getPreferences();
    const updated: UserPreferences = {
      ...current,
      ...patch,
      updatedAt: Date.now(),
    };
    localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to save preferences to localStorage.', err);
    return DEFAULT_PREFERENCES;
  }
};
