/**
 * LocalStorage wrapper for User Preferences
 */
import { UserPreferences } from '../../types';

const PREFS_KEY = 'playbench_prefs_v1';

export type UserRole = 'host' | 'player';

const USER_ROLE_KEY = 'playbench_user_role';

export const getUserRole = (): UserRole => {
  try {
    const role = localStorage.getItem(USER_ROLE_KEY);
    return role === 'player' ? 'player' : 'host';
  } catch {
    return 'host';
  }
};

export const setUserRole = (role: UserRole): void => {
  try {
    localStorage.setItem(USER_ROLE_KEY, role);
  } catch (err) {
    console.error('Failed to set user role in localStorage.', err);
  }
};

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
