/**
 * The Playbench — Types
 */

export type CuttingMatTheme =
  | 'classic-green'
  | 'deep-forest'
  | 'blueprint-blue'
  | 'slate-charcoal';

export type GridDensity = 'coarse' | 'standard' | 'fine';

export interface UserPreferences {
  cuttingMatTheme: CuttingMatTheme;
  gridDensity: GridDensity;
  showRulers: boolean;
  soundEnabled: boolean;
  activeView: 'mat' | 'compact';
  updatedAt: number;
}

export interface GameAuthor {
  name: string;
  url?: string;
  email?: string;
}

export interface GamePlayers {
  min: number;
  max: number;
  type: 'solo' | 'pass-and-play';
}

export interface GameRuntime {
  type: 'html-standalone' | 'iframe-bundle' | 'canvas-embed';
  entrypoint: string;
  aspectRatio?: string;
  preferredWidth?: number;
  preferredHeight?: number;
}

export interface Game {
  id: string;
  title: string;
  tagline?: string;
  description: string;
  genre: string[];
  author?: GameAuthor;
  version: string;
  runtime: GameRuntime;
  coverUrl?: string;
  players: GamePlayers;
  tags: string[];
  offlineCapable: boolean;
  packageOrigin: 'bundled' | 'imported-zip' | 'imported-url' | 'imported-json';
  storage?: {
    supportsSaves?: boolean;
    saveSchemaVersion?: string;
    maxSaveSlots?: number;
  };
  lastPlayedAt?: number;
  playCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface ChecklistItem {
  id: string;
  title: string;
  status: 'required' | 'optional' | 'not-needed' | 'to-be-decided';
  isCompleted: boolean;
  category: 'gameplay' | 'art' | 'audio' | 'tpgp-compliance' | 'polish';
}

export interface GameProject {
  id: string;
  title: string;
  status: 'concept' | 'drafting' | 'in-development' | 'playtesting' | 'published' | 'archived';
  type: 'new-game' | 'improvement';
  targetGameId?: string;
  conceptNote?: string;
  checklist: ChecklistItem[];
  createdAt: number;
  updatedAt: number;
}

export interface GameSave {
  id: string; // `${gameId}:${slotId}`
  gameId: string;
  slotId: string;
  payload: Record<string, unknown>;
  version: string;
  savedAt: number;
}
