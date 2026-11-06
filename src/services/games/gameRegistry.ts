/**
 * Game Registry Service
 *
 * Manages registered games in IndexedDB (`playbench_db`),
 * provides seeding for bundled reference micro-games, and tracks
 * play sessions (lastPlayedAt, playCount).
 */
import { Game } from '../../types';
import { playbenchDB } from '../storage';

// Default bundled reference micro-games definitions
export const BUNDLED_GAMES: Game[] = [
  {
    id: 'number-guess',
    title: 'Number Guess',
    tagline: 'Deduce the secret number between 1 and 100 with hot & cold guidance.',
    description: 'A tranquil single-player numerical deduction game. Guess the mystery number using warm/cold distance cues and track your fewest attempts.',
    genre: ['puzzle', 'logic'],
    author: {
      name: 'Playbench Studio',
      url: 'https://github.com/haikal-hafidz/the-playbench',
    },
    version: '1.0.0',
    runtime: {
      type: 'iframe-bundle',
      entrypoint: './games/number-guess/index.html',
      aspectRatio: '4:3',
      preferredWidth: 540,
      preferredHeight: 620,
    },
    players: {
      min: 1,
      max: 1,
      type: 'solo',
    },
    tags: ['numbers', 'deduction', 'quick-play', 'solo'],
    offlineCapable: true,
    packageOrigin: 'bundled',
    playCount: 0,
    createdAt: 1716000000000,
    updatedAt: 1716000000000,
  },
  {
    id: 'memory-match',
    title: 'Memory Match',
    tagline: 'Turn and match paired craft stationery tokens on the bench.',
    description: 'A delightful memory card-matching puzzle. Uncover pairs of craft workbench objects (scissors, dice, pins, pencil, rulers) with the fewest turns.',
    genre: ['puzzle', 'memory'],
    author: {
      name: 'Playbench Studio',
      url: 'https://github.com/haikal-hafidz/the-playbench',
    },
    version: '1.0.0',
    runtime: {
      type: 'iframe-bundle',
      entrypoint: './games/memory-match/index.html',
      aspectRatio: '4:3',
      preferredWidth: 580,
      preferredHeight: 640,
    },
    players: {
      min: 1,
      max: 1,
      type: 'solo',
    },
    tags: ['cards', 'memory', 'tokens', 'craft', 'solo'],
    offlineCapable: true,
    packageOrigin: 'bundled',
    playCount: 0,
    createdAt: 1716000000000,
    updatedAt: 1716000000000,
  },
];

export class GameRegistry {
  private initialized = false;

  /**
   * Initializes the registry and seeds bundled games if not already registered
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const deletedBundledRaw = localStorage.getItem('playbench_deleted_bundled_ids');
      const deletedBundledIds = new Set<string>(deletedBundledRaw ? JSON.parse(deletedBundledRaw) : []);

      const existing = await playbenchDB.getAllGames();
      const existingMap = new Map(existing.map((g) => [g.id, g]));

      for (const bundled of BUNDLED_GAMES) {
        // If the game was intentionally deleted by the Host, do not re-seed it
        if (deletedBundledIds.has(bundled.id)) {
          continue;
        }

        if (!existingMap.has(bundled.id)) {
          await playbenchDB.saveGame(bundled);
        } else {
          // Preserve play stats (lastPlayedAt, playCount) while ensuring metadata is up to date
          const current = existingMap.get(bundled.id)!;
          if (current.packageOrigin === 'bundled') {
            await playbenchDB.saveGame({
              ...bundled,
              lastPlayedAt: current.lastPlayedAt,
              playCount: current.playCount,
            });
          }
        }
      }
      this.initialized = true;
    } catch (err) {
      console.warn('GameRegistry initialization error with IndexedDB:', err);
    }
  }

  /**
   * Returns all registered games
   */
  async getAllGames(): Promise<Game[]> {
    await this.init();
    try {
      return await playbenchDB.getAllGames();
    } catch (err) {
      console.error('Failed to load games from registry:', err);
      return BUNDLED_GAMES;
    }
  }

  /**
   * Retrieves a single game by ID
   */
  async getGameById(id: string): Promise<Game | undefined> {
    await this.init();
    try {
      const game = await playbenchDB.getGame(id);
      if (game) return game;
      return BUNDLED_GAMES.find((g) => g.id === id);
    } catch (err) {
      console.error(`Failed to load game ${id}:`, err);
      return BUNDLED_GAMES.find((g) => g.id === id);
    }
  }

  /**
   * Records a play session, updating lastPlayedAt timestamp and incrementing playCount
   */
  async recordPlaySession(id: string): Promise<Game | undefined> {
    await this.init();
    const game = await this.getGameById(id);
    if (!game) return undefined;

    const updated: Game = {
      ...game,
      lastPlayedAt: Date.now(),
      playCount: (game.playCount || 0) + 1,
      updatedAt: Date.now(),
    };

    try {
      await playbenchDB.saveGame(updated);
    } catch (err) {
      console.warn('Could not persist play session update to IndexedDB:', err);
    }
    return updated;
  }

  /**
   * Registers or updates a game record
   */
  async registerGame(game: Game): Promise<void> {
    await this.init();
    await playbenchDB.saveGame(game);
  }

  /**
   * Validates if a game can safely be deleted.
   * Checks if it is active in any multiplayer session or workshop project.
   */
  async canDeleteGame(id: string): Promise<{ safe: boolean; reason?: string }> {
    await this.init();
    const game = await this.getGameById(id);
    if (!game) {
      return { safe: false, reason: 'Game not found in registry.' };
    }

    // Check active projects referencing this game
    try {
      const projects = await playbenchDB.getAllProjects();
      const referencingProject = projects.find(
        (p) => p.targetGameId === id && (p.status === 'draft' || p.status === 'active')
      );
      if (referencingProject) {
        return {
          safe: false,
          reason: `Game is referenced by active Workshop project: "${referencingProject.title}". Archive or complete the project first.`,
        };
      }
    } catch {
      // Continue if project store check fails
    }

    // Check active multiplayer session in local storage / session state
    try {
      const activeSessionRaw = localStorage.getItem('playbench_active_session');
      if (activeSessionRaw) {
        const activeSession = JSON.parse(activeSessionRaw);
        const sessionGameId = activeSession.winning_game_id || activeSession.game_id;
        if (sessionGameId === id && activeSession.status !== 'completed') {
          return {
            safe: false,
            reason: `Game is currently in use by an active multiplayer session (${activeSession.code}). End the session before deleting.`,
          };
        }
      }
    } catch {
      // Continue
    }

    return { safe: true };
  }

  /**
   * Safely deletes a game and its associated saves and package assets
   */
  async deleteGame(id: string): Promise<void> {
    const check = await this.canDeleteGame(id);
    if (!check.safe) {
      throw new Error(check.reason || 'Cannot delete game.');
    }

    const game = await this.getGameById(id);
    if (game && game.packageOrigin === 'bundled') {
      // Record in deleted bundled IDs so it is not re-seeded on next init
      try {
        const deletedBundledRaw = localStorage.getItem('playbench_deleted_bundled_ids');
        const deletedBundledIds: string[] = deletedBundledRaw ? JSON.parse(deletedBundledRaw) : [];
        if (!deletedBundledIds.includes(id)) {
          deletedBundledIds.push(id);
          localStorage.setItem('playbench_deleted_bundled_ids', JSON.stringify(deletedBundledIds));
        }
      } catch {
        // Continue
      }
    }

    await playbenchDB.deleteGame(id);
  }
}

export const gameRegistry = new GameRegistry();
