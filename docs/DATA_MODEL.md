# The Playbench — Data Model

This document outlines the entity models, relations, field specifications, and persistence strategies for The Playbench platform.

---

## 1. Entity Relationship Overview

```
 [User Preference] (LocalStorage)
       |
 [Game Project] (Workshop)
       |---> [Creation Letter]
       |---> [Improvement Letter]
       |---> [Checklist Item]
       |---> [Development Brief]
       |
 [Registered Game] (Collection & Game Space)
       |---> [Game Version]
       |---> [TPGP Manifest]
       |---> [Game Save] (IndexedDB)
       |
 [Prompt Template] (Prompt Station)
       |
 [Backup Record] (Supabase / Export Archive)
```

---

## 2. Entity Schemas

### 2.1 User Preferences (`UserPreferences`)
Lightweight settings stored in `localStorage` under `playbench_prefs_v1`.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique profile key (e.g., `'default'`). |
| `cuttingMatColor` | `'classic-green' \| 'deep-forest' \| 'blueprint-blue' \| 'slate-charcoal'` | Workbench cutting mat color scheme. |
| `gridDensity` | `'coarse' \| 'standard' \| 'fine'` | Grid line spacing (cm / inch simulation). |
| `showRulers` | `boolean` | Whether perimeter measurement markings are visible. |
| `soundEnabled` | `boolean` | Subtle tactile acoustic feedback toggle. |
| `viewMode` | `'grid' \| 'tabletop-scatter' \| 'compact-list'` | Preferred game collection presentation. |
| `updatedAt` | `number` (epoch ms) | Last update timestamp. |

---

### 2.2 Registered Game (`Game`)
Stored in IndexedDB (`games` store).

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique slug/UUID (e.g. `'paper-dungeon'`, `'hex-sweeper'`). |
| `title` | `string` | Human-readable game title. |
| `tagline` | `string` | Short 1-sentence descriptor. |
| `description` | `string` | Detailed overview of mechanics and rules. |
| `genre` | `string[]` | Categories (e.g., `['puzzle', 'dice', 'solo']`). |
| `author` | `object` | `{ name: string, url?: string, email?: string }`. |
| `version` | `string` | Semantic version (e.g., `'1.0.2'`). |
| `runtimeType` | `'html-standalone' \| 'iframe-bundle' \| 'canvas-embed'` | Execution runtime. |
| `entrypoint` | `string` | Main path (e.g., `'index.html'`, or inline blob URI). |
| `coverUrl` | `string?` | Cover illustration asset URL or base64 data. |
| `players` | `object` | `{ min: number, max: number, type: 'solo' \| 'pass-and-play' }`. |
| `tags` | `string[]` | Searchable descriptive tags. |
| `offlineCapable`| `boolean` | Confirmed self-contained offline capability. |
| `packageOrigin` | `'bundled' \| 'imported-zip' \| 'imported-url' \| 'imported-json'` | Origin of package. |
| `lastPlayedAt`  | `number?` (epoch ms)| Timestamp when game was last launched. |
| `playCount`     | `number` | Total sessions started. |
| `createdAt`     | `number` (epoch ms) | Initial registration timestamp. |
| `updatedAt`     | `number` (epoch ms) | Last package update. |

---

### 2.3 Game Project (`GameProject`)
Stored in IndexedDB (`projects` store) for Workshop tracking.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique project UUID. |
| `title` | `string` | Working title. |
| `status` | `'concept' \| 'drafting' \| 'in-development' \| 'playtesting' \| 'published' \| 'archived'` | Lifecycle stage. |
| `type` | `'new-game' \| 'improvement'` | Workflow path. |
| `targetGameId` | `string?` | Referenced game ID if this is an improvement project. |
| `creationLetter` | `CreationLetter?` | Embedded or linked creation letter document. |
| `improvementLetter` | `ImprovementLetter?` | Embedded or linked improvement letter document. |
| `checklist` | `ChecklistItem[]` | Dynamic requirements checklist. |
| `notes` | `string` | Freeform markdown scratchpad and references. |
| `createdAt` | `number` | Creation epoch ms. |
| `updatedAt` | `number` | Last modified epoch ms. |

---

### 2.4 Creation Letter (`CreationLetter`)

| Field | Type | Description |
|---|---|---|
| `concept` | `string` | Core hook, theme, and aesthetic inspiration. |
| `gameplayLoop` | `string` | Primary actions and cycle of play. |
| `playerExperience` | `string` | Emotional tone (e.g. cozy, intense, contemplative). |
| `artAndVisuals` | `string` | Visual identity, palette, and craft styling. |
| `technicalRequirements` | `string[]` | Canvas, DOM, audio, or input prerequisites. |
| `constraints` | `string[]` | Deliberate boundaries (e.g. maximum 10-minute playtime). |

---

### 2.5 Improvement Letter (`ImprovementLetter`)

| Field | Type | Description |
|---|---|---|
| `versionTarget` | `string` | Next target version (e.g. `'1.1.0'`). |
| `bugReports` | `string[]` | Identified defects to resolve. |
| `featureRequests` | `string[]` | New mechanics or quality-of-life additions. |
| `balanceAdjustments` | `string[]` | Numeric or pacing adjustments. |
| `playtestFeedback` | `string` | Notes collected from friends and playtesters. |

---

### 2.6 Checklist Item (`ChecklistItem`)

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Item UUID. |
| `title` | `string` | Requirement or task description. |
| `status` | `'required' \| 'optional' \| 'not-needed' \| 'to-be-decided'` | Quad-state classification. |
| `isCompleted` | `boolean` | Completion checkmark. |
| `category` | `'gameplay' \| 'art' \| 'audio' \| 'tpgp-compliance' \| 'polish'` | Category tag. |

---

### 2.7 Game Save State (`GameSave`)
Stored in IndexedDB (`game_saves` store).

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Composite key: `${gameId}:${slotId}`. |
| `gameId` | `string` | Foreign key matching `Game.id`. |
| `slotId` | `string` | Save slot identifier (`'autosave'`, `'slot_1'`, etc.). |
| `payload` | `Record<string, unknown>` | Serialized JSON game state. |
| `version` | `string` | Schema version of the save state format. |
| `savedAt` | `number` | Timestamp epoch ms. |

---

### 2.8 Prompt Template (`PromptTemplate`)
Stored in IndexedDB (`prompt_templates` store).

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Template identifier (`'tpgp-new-game-v1'`). |
| `category` | `'creation' \| 'improvement' \| 'integration' \| 'debugging' \| 'testing'` | Category. |
| `title` | `string` | Human-readable title. |
| `description` | `string` | What this prompt produces. |
| `templateText` | `string` | Full prompt text with substitution placeholders (`{{title}}`, etc.). |
| `tags` | `string[]` | Filter tags. |
| `isBuiltin` | `boolean` | Built-in standard template vs custom user template. |

---

### 2.9 Backup Record (`BackupRecord`)
Cloud synchronization metadata for Supabase.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Backup record UUID. |
| `ownerId` | `string` | Supabase auth user UUID. |
| `checksum` | `string` | SHA-256 hash of backup bundle. |
| `gameCount` | `number` | Number of games archived. |
| `projectCount` | `number` | Number of projects archived. |
| `sizeBytes` | `number` | Size of payload. |
| `createdAt` | `string` (ISO) | Backup creation timestamp. |
