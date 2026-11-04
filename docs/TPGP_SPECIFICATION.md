# TPGP (The Playbench Game Package) Specification

Version: **1.0.0**
Status: **Draft Standard**

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
    "saveSchemaVersion": "1.0",
    "maxSaveSlots": 3
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
- `id`: String. Unique alphanumeric identifier `[a-z0-9_-]+`.
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

Games in an `iframe-bundle` communicate with The Playbench host using `window.postMessage`.

### 5.1 Host to Game Messages
| Type | Payload | Meaning |
|---|---|---|
| `PLAYBENCH_INIT` | `{ gameId, preferences, saveState }` | Sent immediately after iframe load. Supplies saved state. |
| `PLAYBENCH_PAUSE` | `{}` | Sent when user opens workbench drawer or switches tab. |
| `PLAYBENCH_RESUME`| `{}` | Sent when workbench unpauses the session. |

### 5.2 Game to Host Messages
| Type | Payload | Meaning |
|---|---|---|
| `PLAYBENCH_READY` | `{ ready: true }` | Game signals assets are loaded and ready for interaction. |
| `PLAYBENCH_SAVE_REQUEST` | `{ slot: string, state: object }` | Requests host persist current game state to IndexedDB. |
| `PLAYBENCH_GAME_OVER` | `{ score?: number, summary?: string }` | Signals game completion; host records stats. |

---

## 6. Offline Compatibility & Validation Rules

A package is declared **Offline Compatible** (`capabilities.offline: true`) only if:
1. All scripts, fonts, sounds, and graphics are bundled inside the package.
2. The code does NOT query external APIs, CDNs, or Google Fonts at runtime.
3. If an external URL is found in the entrypoint during manifest validation, The Playbench flags a warning and marks `offlineCapable: false`.
