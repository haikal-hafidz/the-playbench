# The Playbench — Decision Log

This log records major architectural and technical decisions made during the evolution of The Playbench platform.

---

## ADR 001: Technology Stack Selection (React + Vite + TypeScript)
- **Date:** 2025-05-18
- **Context:** The Playbench needs a fast, modern, typed frontend framework with rapid build speeds, minimal configuration overhead, and static hosting readiness.
- **Decision:** Use React 18 with Vite and TypeScript.
- **Consequences:** Provides lightning-fast HMR during development, strong typing for TPGP schemas and data models, and clean static bundling for GitHub Pages.

---

## ADR 002: Static Deployment Strategy & HashRouter Routing
- **Date:** 2025-05-18
- **Context:** The application is hosted publicly on GitHub Pages (`https://haikal-hafidz.github.io/the-playbench/`). GitHub Pages does not support native server-side rewrites for arbitrary HTML5 `history.pushState` routes on page refreshes without 404 redirect tricks.
- **Decision:** Use React Router `HashRouter` combined with Vite `base: './'`.
- **Consequences:** Guarantees that refreshing `/the-playbench/#/collection` or deep linking to `/the-playbench/#/workshop` always resolves `index.html` without 404 errors, on any static host or local preview server.

---

## ADR 003: Visual Identity Metaphor (Illustrated Cutting Mat Workspace)
- **Date:** 2025-05-18
- **Context:** We need to avoid generic corporate SaaS cards or standard game store dashboards (e.g. Steam/Itch clones). The user explicitly requested an illustrated creative workbench with a green cutting mat and physical craft stationery.
- **Decision:** Build a custom CSS design token system (`tokens.css`) centered around a green self-healing cutting mat with measurement grid lines, angles (30°, 45°, 60°), and tactile craft accents (wood grain desk surface, brass clips, sticky notes, pencils, rulers).
- **Consequences:** Gives The Playbench an unmistakable visual personality while remaining accessible, responsive, and legible.

---

## ADR 004: Decoupled Heterogeneous Game Architecture (TPGP)
- **Date:** 2025-05-18
- **Context:** Games should not be forced to use React, TypeScript, or any single framework. Creators might build games in pure Canvas, WebGL, Phaser, Godot HTML5 export, or plain HTML.
- **Decision:** Standardize on TPGP (The Playbench Game Package). Games execute inside sandboxed iframes and communicate with the host via a lightweight `postMessage` protocol.
- **Consequences:** Ensures platform security, isolates game failures, prevents games from tampering with platform storage, and allows games in any framework to run side-by-side.

---

## ADR 005: Local-First Storage with IndexedDB & LocalStorage
- **Date:** 2025-05-18
- **Context:** The Playbench must be functional offline and zero-cost to maintain without requiring a mandatory database server for primary gameplay.
- **Decision:** Use LocalStorage for lightweight UI preferences (theme, grid scale) and browser IndexedDB (`playbench_db`) for game packages, saves, and workshop projects. Supabase is reserved for future owner-authenticated cloud backups.
- **Consequences:** High performance, instant offline boot, complete privacy for friends and public visitors, and resilient local persistence.

---

## ADR 006: Game Space Sandboxed Runner and postMessage Bridge Protocol
- **Date:** 2025-05-19
- **Context:** Standalone web games must execute with zero privilege escalation. An untrusted game script must not access platform cookies, host DOM, parent LocalStorage, or parent IndexedDB.
- **Decision:** Use `iframe` with `sandbox="allow-scripts allow-forms allow-pointer-lock"`. Establish a typed `postMessage` protocol broker (`SandboxBridge`) that validates `event.source === iframe.contentWindow`, checks envelope type (`source: 'tpgp-game'`, `gameId`), and manages save slot persistence strictly partitioned by game ID in IndexedDB (`game_saves`).
- **Consequences:** Safe runtime environment that prevents XSS cross-contamination, provides seamless save state persistence without giving games direct DB access, and allows games in pure HTML/JS to run seamlessly.
