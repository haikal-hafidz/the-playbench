# The Playbench — Product Specification

## 1. Executive Summary & Vision

**The Playbench** is a personal creative workshop for collecting, developing, importing, managing, and playing small original games.

> *"A little workshop for little games."*

Unlike conventional digital storefronts, public app stores, or complex SaaS project dashboards, The Playbench embraces the tactile, focused feeling of an artisan's workbench. It combines the warmth of physical craft stationery (cutting mats, rulers, sticky notes, tokens, paper drafts) with the reliability and speed of modern browser technology.

The platform serves two primary audiences:
1. **The Owner / Creator:** A creative space to conceive, draft, refine, track, and package lightweight independent games.
2. **Friends & Playtesters:** A zero-friction, accessible portal via a shared public website URL where small games can be played directly in browser, both online and offline.

---

## 2. Fixed Product Decisions

These core decisions govern the technical and product architecture:

| Decision Area | Specification | Rationale |
|---|---|---|
| **Project Name** | The Playbench | Warm, artisan identity emphasizing play and craftsmanship. |
| **Visual Direction** | Illustrated Tabletop / Workbench | Evokes a physical maker's desk rather than a generic tech UI. |
| **Main Visual Metaphor** | Green self-healing cutting mat with grid | Provides a grounded, recognizable central canvas for games and tools. |
| **Game Presentation** | Hybrid physical objects + clean digital cards | Tactile personality without sacrificing readability or accessibility. |
| **Access Model** | Public website URL | Easy to share with friends without mandatory account walls. |
| **Primary Gameplay** | Single-player & local pass-and-play | Focused on small, intimate mechanics; no complex backend matchmaking needed. |
| **Deployment Target** | GitHub Pages (Static Hosting) | Cost-free, durable, maintenance-free static distribution. |
| **Frontend Stack** | React + Vite + TypeScript | Modern, strongly typed, modular, and fast developer experience. |
| **Local Persistence** | IndexedDB & LocalStorage | Complete offline capability and zero backend dependency for primary play. |
| **Cloud Backup** | Supabase (Future phase) | Opt-in owner backup without exposing private creator data to public visitors. |
| **Offline Capability** | Progressive Web App (PWA) + Service Worker | Games and platform shell work offline once loaded. |
| **Package Standard** | TPGP (The Playbench Game Package) | Neutral, framework-agnostic package specification. |
| **Import Channels** | URL, JSON Manifest, and ZIP Archives | Maximum flexibility for creators and external contributors. |

---

## 3. What The Playbench Is NOT

To protect the product vision and prevent scope creep, The Playbench explicitly rejects:
- **NOT a commercial marketplace:** No payment gateways, monetization engines, or DRM.
- **NOT a social network:** No user feeds, follower counts, upvotes, or public comments.
- **NOT a server-side matchmaking service:** No mandatory real-time socket infrastructure.
- **NOT an opinionated monolithic game engine:** Games are not forced into React, Phaser, or any single framework. They run as self-contained micro-applications or sandboxed packages.
- **NOT an enterprise SaaS dashboard:** No dry corporate analytics or bloated admin panels.

---

## 4. Platform Architecture & Complete Sections

The Playbench is composed of eight distinct functional areas:

### A. The Desk (`/`)
The visual centerpiece and landing experience. The user looks down at a green self-healing cutting mat surrounded by craft stationery. Provides quick access to:
- **My Games:** Registered playable games.
- **Recently Played:** Immediate resumption of last-played games.
- **In Development:** Quick glance at active workshop drafts.
- **Primary Actions:** Entry points for "New Game" and "Import Game".
- **Workbench Controls:** Grid scale/unit toggles, offline status, and quick links.

### B. Game Collection (`/collection`)
The complete library catalog of all registered games on this bench.
- Search, filter by genre, tags, player count, and completion status.
- Detailed game information: title, cover, description, author, version, runtime type, offline readiness, and storage footprint.
- Direct launch into Game Space.

### C. Workshop (`/workshop`)
The creative forge where game ideas are born and iterated upon.
- **New Game Creation Letter:** Structured creative brief outlining concept, mechanics, player dynamics, visual style, and initial checklist.
- **Existing Game Improvement Letter:** Iteration log for updates, bug fixes, expansion rules, and balance adjustments.
- **Dynamic Checklists:** Track tasks categorized as *Required*, *Optional*, *Not Needed*, and *To Be Decided*.
- **Development Notes & References:** Research clippings, sketches, and notes.
- **Brief Exporter:** Generate structured markdown briefs ready to pass into AI development workflows.

### D. Game Space (`/gamespace/:id`)
An isolated, distraction-free execution environment for individual games.
- Supports sandboxed iframe execution, direct canvas attachment, or standalone HTML runner.
- Enforces storage isolation so games cannot corrupt platform data or other games' state.
- Provides workbench overlays: Pause, Fullscreen, Restart, Pass-and-Play rotation, and Save manager.

### E. Import Center (`/import`)
The intake station for bringing external games onto The Playbench.
- **URL Import:** Load remote games via hosted TPGP manifests with security domain validation.
- **JSON Manifest Import:** Inspect and register game metadata and runtime links.
- **ZIP Package Import:** Extract, inspect manifest, validate assets, and install into local IndexedDB storage.
- Comprehensive safety linting (no arbitrary script injection from raw untrusted JSON).

### F. Prompt Station (`/prompts`)
A library of precision-crafted English AI development prompts designed to guide LLMs in creating games compatible with The Playbench.
- **Creation Prompts:** From concept to playable prototype.
- **Improvement Prompts:** Adding features or fixing bugs in existing TPGP packages.
- **Integration Prompts:** Converting existing HTML5 games into compliant TPGP packages.
- **Debugging & Testing Prompts:** Automated playtesting scripts and edge case hunters.
- One-click copy, parameter substitution, and export.

### G. Game Protocol (`/protocol`)
The interactive documentation and reference center for the **TPGP standard** (The Playbench Game Package).
- Formal schema definitions, JSON examples, packaging guides, and runtime lifecycle hooks.

### H. Settings & Backup (`/settings`)
Workbench preferences and persistence controls:
- Theme & cutting mat customizations (grid color, scale, texture accents).
- Local storage inspector: storage quota, clear cache, export database dump.
- Supabase Cloud Backup (owner configuration, sync status, encryption notes).
- PWA offline cache management.

---

## 5. Security & Isolation Boundaries

Because The Playbench runs on a static public website:
1. **Public vs. Private Separation:** Public visitors have access only to bundled public games. Owner drafts, workshop letters, and private cloud keys remain strictly isolated.
2. **Game Sandbox Isolation:** All games execute within an isolated `<iframe sandbox="allow-scripts allow-forms allow-pointer-lock">`. Third-party game code has zero direct access to `localStorage` or `indexedDB` of the platform origin.
3. **Storage Bridge:** Games communicate save state exclusively via a typed `postMessage` protocol handled by the Game Space runtime adapter.
4. **Static Safe Routing:** Compatible with static hosts (GitHub Pages) without server rewrite dependencies via `HashRouter`.
