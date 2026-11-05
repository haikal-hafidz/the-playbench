# The Playbench — Implementation Roadmap

This roadmap defines the iterative development stages for The Playbench platform.

---

## Stage 1: Foundation & The Desk (Completed)
**Objective:** Establish technical repository foundations, documentation, design system tokens, storage architecture, routing, and a functional version of The Desk landing page.

- [x] Initial repository inspection and baseline branch setup.
- [x] Architectural documentation suite (`/docs`).
- [x] React + Vite + TypeScript initialization configured for GitHub Pages (`base: './'`).
- [x] PWA manifest and service worker shell.
- [x] Illustrated design system tokens: green cutting mat, craft materials, stationery accents.
- [x] Storage services: LocalStorage preferences & IndexedDB schema initialization (`playbench_db`).
- [x] Responsive Application Shell with Workbench Header and navigation drawer.
- [x] The Desk landing page featuring cutting mat, My Games, Recently Played, In Development sections, and action cards.
- [x] Clear placeholder states for upcoming modules with honest status indicators.
- [x] Automated Playwright visual and functional testing.

---

## Stage 2: Game Collection & Standalone Game Space (Completed)
**Objective:** Enable registering, browsing, launching, and playing bundled games in a sandboxed runtime.

- [x] Game Collection catalog with filter controls, search, and sorting.
- [x] Game Space runtime runner:
  - Sandboxed iframe host (`sandbox="allow-scripts allow-forms allow-pointer-lock"`).
  - postMessage communication bridge (`PLAYBENCH_READY`, `PLAYBENCH_REQUEST_SAVE`, `PLAYBENCH_SAVE_REQUEST`, `PLAYBENCH_GAME_OVER`).
  - Game save/load IndexedDB persistence adapter (`game_saves` store).
  - Pause, Restart, and Fullscreen workbench toolbar.
- [x] Two default bundled reference micro-games:
  - *Number Guess* (`public/games/number-guess/`): Numerical deduction puzzle with hot/cold cues and best attempt persistence.
  - *Memory Match* (`public/games/memory-match/`): Tabletop stationery card matching game with move tracking and best score save.
- [x] Game Registry service (`src/services/games/gameRegistry.ts`) with automatic seeding and play session tracking (`lastPlayedAt`, `playCount`).
- [x] Connected real Recently Played shelf on The Desk.

---

## Stage 3: Workshop Forge (Creation & Improvement Letters)
**Objective:** Complete game idea drafting and tracking tools for the owner.

- [ ] New Game Creation Letter workflow (form with draft persistence).
- [ ] Existing Game Improvement Letter workflow.
- [ ] Dynamic 4-state checklist (`required`, `optional`, `not-needed`, `to-be-decided`).
- [ ] Markdown development brief exporter for feeding into LLMs.
- [ ] Workbench scratchpad and reference pinboard.

---

## Stage 4: Import Center & TPGP Validator
**Objective:** Allow importing custom games into local browser storage.

- [ ] URL-based TPGP manifest importer with origin validation.
- [ ] JSON manifest inspector and runner.
- [ ] ZIP archive extractor using lightweight JSZip/browser streams.
- [ ] Package validation against `tpgp-v1.json` JSON schema.
- [ ] Local storage quota warning and safety isolation.

---

## Stage 5: Prompt Station
**Objective:** Library of AI prompts for rapid game creation and maintenance.

- [ ] Pre-packaged prompts: Creation, Improvement, Integration, Debugging, Playtesting.
- [ ] Interactive template variable filler (Game Title, Rules, Mechanic, Target Engine).
- [ ] Quick-copy to clipboard and export to `.prompt.md`.
- [ ] Custom prompt template manager stored in IndexedDB.

---

## Stage 6: Supabase Cloud Backup & PWA Synchronization
**Objective:** Opt-in owner cloud synchronization.

- [ ] Supabase authentication for owner.
- [ ] Row-Level Security (RLS) policies ensuring visitor isolation.
- [ ] Snapshot backup of game saves, workshop projects, and imported games.
- [ ] Encrypted backup exports and restores.
- [ ] PWA full offline caching and update notification toast.
