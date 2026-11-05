# TPGP (The Playbench Game Package) Specification

Version: **1.0.0**
Status: **Official Platform Standard**

---

## 1. Overview & Purpose

**The Playbench Game Package (TPGP)** is an open, framework-neutral standard for packaging, describing, and distributing small web-based games.

A TPGP package guarantees that any compliant game can be imported into The Playbench via URL, JSON manifest, or ZIP archive, executed in a sandboxed runtime, and provided with standardized save/restore and lifecycle capabilities.

---

## 2. Package Manifest Format (`tpgp.json`)

Every TPGP package is defined by a root manifest file named `tpgp.json`.

```json
{
  "$schema": "https://playbench.dev/schemas/tpgp-v1.json",
  "tpgpVersion": "1.0.0",
  "id": "matchstick-puzzle",
  "title": "Matchstick Puzzle",
  "tagline": "Arrange wood matchsticks to solve geometric equations.",
  "description": "A tranquil single-player spatial puzzle game inspired by vintage matchbox challenges. Drag, rotate, and place wooden matches within tight move counts.",
  "version": "1.2.0",
  "author": {
    "name": "Bench Crafter",
    "url": "https://example.com",
    "email": "crafter@example.com"
  },
  "runtime": {
    "type": "iframe-bundle",
    "entrypoint": "index.html",
    "aspectRatio": "16:9",
    "minWidth": 320,
    "minHeight": 480,
    "preferredWidth": 800,
    "preferredHeight": 600,
    "orientation": "any"
  },
  "players": {
    "min": 1,
    "max": 1,
    "type": "solo"
  },
  "categories": ["puzzle", "tabletop", "minimal"],
  "tags": ["matches", "logic", "relaxing", "cozy"],
  "assets": {
    "cover": "assets/cover.png",
    "icon": "assets/icon.svg"
  },
  "storage": {
    "supportsSaves": true,
    "saveSchemaVersion": "1.0.0",
    "maxSaveSlots": 5
  },
  "capabilities": {
    "offline": true,
    "audio": true,
    "touch": true,
    "gamepad": false
  },
  "license": "MIT"
}
```

---

## 3. Schema Fields Breakdown

### 3.1 Required Properties
- `tpgpVersion`: String. Must equal `"1.0.0"`.
- `id`: String. Unique alphanumeric identifier `[a-z0-9_-]+` (1 to 64 chars).
- `title`: String. 1-60 characters.
- `version`: String. Valid semver string (e.g. `1.0.0`).
- `runtime`: Object describing how The Playbench executes the game.
  - `type`: One of `"html-standalone"`, `"iframe-bundle"`, `"canvas-embed"`.
  - `entrypoint`: Relative path to main HTML or JS entrypoint.
- `players`: Object:
  - `min`: Positive integer >= 1.
  - `max`: Positive integer >= min.
  - `type`: `"solo"` or `"pass-and-play"`.
- `capabilities.offline`: Boolean. True if the game has zero external runtime network dependencies.

### 3.2 Optional Properties
- `tagline`: String up to 120 characters.
- `description`: String markdown description.
- `author`: Name and website contact.
- `categories`: Array of genre tags.
- `assets.cover`: Path to game cover artwork (recommended ratio 4:3 or 16:9).
- `assets.icon`: Path to square game icon.
- `storage`: Defines state persistence parameters.
  - `supportsSaves`: Boolean.
  - `saveSchemaVersion`: Semver string (default `"1.0.0"`).
  - `maxSaveSlots`: Positive integer <= 10 (default `5`).

---

## 4. Package Archive Structure (ZIP)

When distributed as a ZIP archive, the structure is:

```
my-game.zip
├── tpgp.json            # Root package manifest (MANDATORY)
├── index.html           # Main entrypoint
├── assets/              # Self-contained assets (images, audio, css)
│   ├── cover.png
│   ├── icon.svg
│   ├── sfx.mp3
│   └── style.css
└── js/
    └── game.js
```

### Path & Security Rules for ZIP Archives
1. All file paths inside the ZIP must be relative.
2. No directory traversal (`../`) is permitted.
3. No absolute paths (`/usr/...` or `C:\...`) are permitted.
4. Total uncompressed archive size must not exceed 25MB (workbench soft limit for local browser storage).

---

## 5. Host-Sandbox Communication Protocol (Bridge)

Games in an `iframe-bundle` communicate with The Playbench host using bidirectional `window.postMessage`.

### 5.1 Envelopes

All messages sent from the game to the host must follow this envelope:
```json
{
  "source": "tpgp-game",
  "gameId": "<game-id>",
  "type": "<MESSAGE_TYPE>",
  "payload": { ... }
}
```

All messages sent from the host to the game follow this envelope:
```json
{
  "source": "playbench-host",
  "type": "<MESSAGE_TYPE>",
  "payload": { ... }
}
```

### 5.2 Deterministic Handshake Flow

To eliminate race conditions between the host React lifecycle and the iframe document loading:

1. **Host Setup**: The host attaches its `message` event listener before or during iframe attachment.
2. **Game Mount**: When the game script runs, it posts `PLAYBENCH_MOUNTED` to `window.parent`.
3. **Host Init Dispatch**: Upon receiving `PLAYBENCH_MOUNTED` or upon the iframe `load` event (whichever occurs first, deduplicated), the host retrieves any existing `default` slot save state and sends:
   ```json
   {
     "source": "playbench-host",
     "type": "PLAYBENCH_INIT",
     "payload": {
       "gameId": "number-guess",
       "version": "1.0.0",
       "saveState": { ... } | null
     }
   }
   ```
4. **Game Readiness**: The game restores the save state (if present), completes its setup, and posts:
   ```json
   {
     "source": "tpgp-game",
     "gameId": "number-guess",
     "type": "PLAYBENCH_READY",
     "payload": {
       "ready": true,
       "title": "Number Guess",
       "version": "1.0.0"
     }
   }
   ```
5. **Host Confirms Ready**: The host clears the loading spinner and marks the game as actively running.

### 5.3 Complete Message Catalog

#### Inbound (Game → Host)
| Message Type | Payload Structure | Description |
|---|---|---|
| `PLAYBENCH_MOUNTED` | `{ gameId: string, version: string }` | Sent by game script when DOM/JS loads, asking host for `PLAYBENCH_INIT`. |
| `PLAYBENCH_READY` | `{ ready: true, title?: string, version?: string }` | Confirms game has restored state and is interactively ready. |
| `PLAYBENCH_REQUEST_SAVE` | `{ slot: string }` | Requests stored state for a particular slot. Host responds with `PLAYBENCH_RESTORE_SAVE`. |
| `PLAYBENCH_SAVE_REQUEST` | `{ slot: string, state: object, schemaVersion?: string }` | Requests host to persist `state` to IndexedDB under `slot`. Host responds with `PLAYBENCH_SAVE_RESULT`. |
| `PLAYBENCH_GAME_OVER` | `{ score?: number, summary?: string }` | Notifies host of level or game completion. |
| `PLAYBENCH_ERROR` | `{ message: string, code?: string }` | Reports an internal game failure to the host toolbar/logger. |

#### Outbound (Host → Game)
| Message Type | Payload Structure | Description |
|---|---|---|
| `PLAYBENCH_INIT` | `{ gameId: string, version: string, saveState: object \| null }` | Dispatched during handshake to initialize the game and provide default save data. |
| `PLAYBENCH_RESTORE_SAVE`| `{ gameId: string, slot: string, saveState: object \| null, schemaVersion?: string }` | Dispatched in response to `PLAYBENCH_REQUEST_SAVE`. |
| `PLAYBENCH_SAVE_RESULT` | `{ success: boolean, slot: string, error?: string }` | Feedback acknowledging whether `PLAYBENCH_SAVE_REQUEST` was committed or rejected. |
| `PLAYBENCH_PAUSE` | `{}` | Sent when user switches tabs or focuses platform drawer. |
| `PLAYBENCH_RESUME` | `{}` | Sent when workbench unpauses the session. |

---

## 6. Save State Validation and Persistence Bounds

To maintain host security and database stability, all `PLAYBENCH_SAVE_REQUEST` calls are subject to host-enforced validation:

1. **Slot Identifier**: Must match `/^[a-zA-Z0-9_-]{1,32}$/`. Arbitrary or special character slot names are rejected.
2. **Slot Limit**: Games cannot create more slots than declared in `storage.maxSaveSlots` (default max: 5 slots).
3. **Payload Type**: `state` must be a non-null plain Object. Functions, circular structures, or primitive values are rejected.
4. **Payload Size**: Maximum serialized JSON size is **256 KB** per slot. Payloads exceeding this limit are rejected with an explicit error.
5. **Schema Versioning & Compatibility**:
   - Every save record stores the `schemaVersion`.
   - If an existing save has a newer major version than the incoming save (e.g. attempting to overwrite a v2.0 save with a v1.0 payload without an upgrade path), the host rejects the overwrite to prevent silent corruption.
6. **Result Notification**: The host always posts a `PLAYBENCH_SAVE_RESULT` message back to the iframe with `success: true` or `success: false` and the rejection reason.

---

## 7. Offline Compatibility & Validation Rules

A package is declared **Offline Compatible** (`capabilities.offline: true`) only if:
1. All scripts, fonts, sounds, and graphics are bundled inside the package.
2. The code does NOT query external APIs, CDNs, or Google Fonts at runtime.
3. If an external URL is found in the entrypoint during manifest validation, The Playbench flags a warning and marks `offlineCapable: false`.
