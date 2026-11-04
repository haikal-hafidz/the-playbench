# The Playbench — Architecture

## 1. High-Level Architecture Overview

The Playbench is designed as a client-first, statically deployable Web application engineered for long-term durability, modular game integration, and offline autonomy.

```
+-----------------------------------------------------------------------------------+
|                                  THE PLAYBENCH                                     |
|                              (React 18 + Vite + TS)                                |
+-----------------------------------------------------------------------------------+
|  App Shell: Workbench Header | Stationery Navigation | Ambient Status Bar        |
+-----------------------------------------------------------------------------------+
|  ROUTER (HashRouter for Static GitHub Pages Compatibility)                        |
|   /           /collection     /workshop       /gamespace/:id                      |
|   (The Desk)  (Collection)   (Craft Forge)   (Sandbox Runtime)                   |
|   /import     /prompts        /protocol       /settings                           |
|   (Intake)    (AI Prompts)    (TPGP Standard) (Storage & Backup)                  |
+-----------------------------------------------------------------------------------+
|  SERVICES & PERSISTENCE LAYER                                                     |
|   +-----------------------+   +-----------------------------------------------+   |
|   | LocalStorage          |   | IndexedDB (playbench_db)                      |   |
|   | - UI Preferences      |   | - games: TPGP manifests & binary assets       |   |
|   | - Cutting mat theme   |   | - projects: Creation/Improvement letters      |   |
|   | - Recent game IDs     |   | - game_saves: Partitioned game states         |   |
|   +-----------------------+   +-----------------------------------------------+   |
+-----------------------------------------------------------------------------------+
|  FUTURE EXTERNAL INTEGRATIONS (Isolated)                                          |
|   +---------------------------------------------------------------------------+   |
|   | Supabase Client (Owner opt-in encrypted backup sync via RLS)              |   |
|   +---------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------+
|  OFFLINE LAYER: PWA + Service Worker (Workbox / Cache-First Platform Shell)       |
+-----------------------------------------------------------------------------------+
```

---

## 2. Component Organization

The codebase is organized modularly by domain to prevent monolithic coupling:

```
src/
├── assets/             # Vector craft elements (rulers, pencils, tokens, textures)
├── components/
│   ├── common/         # Tactile UI elements: Buttons, Badges, Modals, Sliders
│   ├── layout/         # AppShell, WorkbenchHeader, DeskNavigation, StatusBar
│   ├── desk/           # CuttingMatCanvas, DeskSection, StationeryWidget, EmptyStates
│   └── craft/          # StickyNote, ManilaFolder, BrassClip, GridRuler
├── hooks/              # Custom React hooks (usePreferences, useDatabase, useOffline)
├── pages/
│   ├── Desk/           # Landing workbench page
│   ├── Collection/     # Catalog and library view
│   ├── Workshop/       # Creation/Improvement letter forge
│   ├── GameSpace/      # Sandboxed game execution runner
│   ├── Import/         # URL/JSON/ZIP intake station
│   ├── Prompts/        # AI Prompt engineering station
│   ├── Protocol/       # Interactive TPGP specification reader
│   └── Settings/       # Workbench options, storage, and Supabase backup
├── services/
│   ├── storage/        # IndexedDB (playbench_db) and LocalStorage adapters
│   ├── runtime/        # TPGP sandbox runner, postMessage communication bridge
│   ├── import/         # Manifest validation, ZIP parser, URL fetcher
│   └── pwa/            # Service worker registration and offline cache inspector
├── styles/
│   ├── tokens.css      # Design tokens (palette, spacing, shadows, craft materials)
│   ├── desk.css        # Cutting mat and workbench grid layout styles
│   └── index.css       # Base typography, reset, tactile animations
├── types/              # TypeScript definitions (TPGP, DataModel, Storage, Events)
├── App.tsx             # Route definitions and global state providers
└── main.tsx            # Application entrypoint
```

---

## 3. Routing Strategy for GitHub Pages

Static hosts such as GitHub Pages do not natively support server-side rewrites for arbitrary URL paths (e.g. `/collection` or `/gamespace/dice-roller` will return a 404 when directly refreshed unless a 404 redirect hack is in place).

To ensure **guaranteed reliability**, zero dependency on external 404 redirects, and smooth offline resolution:
- The platform uses **`HashRouter`** (`/#/`, `/#/collection`, `/#/workshop`, `/#/gamespace/:id`).
- All links, bookmarks, and deep links work reliably on GitHub Pages, subpaths (`/the-playbench/`), and local file environments.
- Vite is configured with `base: './'` for universal relative asset path generation.

---

## 4. Game Module Architecture & Runtime Sandbox

Games created for The Playbench may be written in plain HTML/Canvas, Phaser, Pixi.js, Three.js, React, or pure WebAssembly. To support this heterogeneity safely:

1. **Framework Decoupling:** Games are never bundled directly into the core React bundle.
2. **Iframe Isolation:** Games execute inside a sandboxed iframe:
   ```html
   <iframe
     src="blob:... or local URL"
     sandbox="allow-scripts allow-forms allow-pointer-lock"
     title="Game Sandbox"
   />
   ```
3. **Storage Isolation:** Games do not touch the host's `localStorage` or `indexedDB`.
4. **Platform Bridge Protocol (postMessage):**
   - Host to Game: `PLAYBENCH_INIT`, `PLAYBENCH_PAUSE`, `PLAYBENCH_RESUME`, `PLAYBENCH_RESTORE_STATE`.
   - Game to Host: `PLAYBENCH_READY`, `PLAYBENCH_SAVE_STATE`, `PLAYBENCH_GAME_OVER`, `PLAYBENCH_LOG`.
   - Host stores game save data in IndexedDB partitioned strictly by `gameId` and slot.

---

## 5. Storage Architecture

| Engine | Database / Key | Target Data | Retention |
|---|---|---|---|
| **LocalStorage** | `playbench_prefs_v1` | Visual theme, cutting mat grid toggle, sound effects toggle, active filter | Persistent per device |
| **LocalStorage** | `playbench_recent_v1`| List of recently played game IDs with timestamps | Persistent per device |
| **IndexedDB** | `playbench_db` / `games` | Installed TPGP game manifests, entrypoints, and asset blobs | Persistent per device |
| **IndexedDB** | `playbench_db` / `projects` | Workshop creation and improvement letter drafts | Persistent per device |
| **IndexedDB** | `playbench_db` / `saves` | Game save states indexed by `gameId` + `saveId` | Persistent per device |
| **IndexedDB** | `playbench_db` / `prompts`| Custom user prompts and template overrides | Persistent per device |

---

## 6. Security Boundaries

- **Untrusted Code Execution:** Manifests from external URLs or ZIP archives are parsed strictly with schema validation before installation.
- **Content Security:** Scripts from games cannot access host window tokens, parent DOM, or origin storage.
- **Supabase Credentials:** Only the public anonymous Supabase key (`VITE_SUPABASE_ANON_KEY`) is ever bundled. All cloud operations rely on Row-Level Security (RLS) tied to the authenticated owner. Service role keys are strictly prohibited in the client repository.
