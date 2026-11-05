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

export type ChecklistItemState = 'required' | 'optional' | 'not-needed' | 'to-be-decided';

export interface ChecklistItem {
  id: string;
  label: string;
  state: ChecklistItemState;
  completed: boolean;
}

export interface EntityField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description?: string;
}

export interface CustomEntity {
  name: string;
  description: string;
  fields: EntityField[];
}

export interface CreationLetter {
  // A. Game Identity
  title: string;
  tagline: string;
  targetAudience: string;
  creativeVision: string;
  objectives: string;
  genre: string[];

  // B. Gameplay Design
  coreRules: string;
  turnStructure: string; // turn, round, or session loops
  winLossConditions: string;
  edgeCases: string;

  // C. Player Configuration
  playerCountMin: number;
  playerCountMax: number;
  playStyle: 'solo' | 'pass-and-play' | 'shared-screen';
  hostParticipation: boolean;
  rolesOrTeams: string;

  // D. Game Configuration
  roundDurationMinutes: number;
  totalRounds: number;
  difficultyLevels: string;
  configPresets: string;

  // E. Data Architecture
  entities: CustomEntity[];
  storageStrategy: string; // e.g. IndexedDB saves, slot count

  // F. Visual & Art Direction
  artStyle: string;
  layoutStructure: string;
  animationPreferences: string;
  accessibilityNotes: string;

  // G. Technical Requirements & Constraints
  runtimeType: 'html-standalone' | 'iframe-bundle';
  offlineSupport: boolean;
  constraints: string[];
  notes?: string;
}

export interface ImprovementLetter {
  targetGameId: string;
  currentVersion: string;
  targetVersion: string;
  implementationAudit: string;
  gameplayAdjustments: string;
  scoringChanges: string;
  dataArchitectureChanges: string;
  uxImprovements: string;
  bugReports: string[];
  featureRequests: string[];
  balanceAdjustments: string[];
  acceptanceCriteria: string[];
  revisionNotes: string;
}

export interface GameProject {
  id: string;
  title: string;
  status: 'draft' | 'active' | 'archived' | 'completed';
  workflowType: 'creation' | 'improvement';
  targetGameId?: string;
  conceptNote?: string;
  creationLetter?: CreationLetter;
  improvementLetter?: ImprovementLetter;
  checklist: ChecklistItem[];
  notes?: string;
  briefMarkdown?: string;
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

export type ImportMethod = 'json' | 'zip' | 'url';

export type ImportContentType =
  | 'tpgp-manifest'
  | 'tpgp-package'
  | 'game-metadata'
  | 'question-bank'
  | 'answer-bank'
  | 'custom-entities'
  | 'unknown';

export interface ValidationIssue {
  field?: string;
  message: string;
}

export interface ValidationResult {
  status: 'valid' | 'valid-with-warnings' | 'invalid' | 'unsupported';
  contentType: ImportContentType;
  name?: string;
  version?: string;
  description?: string;
  author?: GameAuthor;
  entityCount?: number;
  recordCount?: number;
  warnings: string[];
  errors: string[];
  destination: 'games' | 'custom_datasets' | 'unsupported';
  isPlayable: boolean;
  runtimeEntrypoint?: string;
  manifestData?: any;
}

export interface PackageFileRecord {
  id: string; // `${packageId}:${filePath}`
  packageId: string;
  filePath: string;
  mimeType: string;
  data: ArrayBuffer | string; // binary assets as ArrayBuffer or text for scripts/html
  size: number;
}

export interface CustomGameDataset {
  id: string;
  gameId?: string;
  name: string;
  contentType: ImportContentType;
  version: string;
  data: any;
  importedAt: number;
}

export interface ImportRecord {
  id: string;
  name: string;
  importMethod: ImportMethod;
  source: string; // filename or url
  contentType: ImportContentType;
  version?: string;
  status: 'success' | 'failed' | 'cancelled';
  validationResult: ValidationResult;
  failureReason?: string;
  registeredGameId?: string;
  importedAt: number;
}
