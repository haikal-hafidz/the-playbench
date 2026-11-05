/**
 * IndexedDB Database Service for The Playbench (playbench_db)
 */
import { Game, GameProject, GameSave } from '../../types';

const DB_NAME = 'playbench_db';
const DB_VERSION = 1;

export class PlaybenchDB {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB is not supported in this environment.'));
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Games Store
        if (!db.objectStoreNames.contains('games')) {
          const gameStore = db.createObjectStore('games', { keyPath: 'id' });
          gameStore.createIndex('by_last_played', 'lastPlayedAt');
          gameStore.createIndex('by_origin', 'packageOrigin');
        }

        // Projects Store (Workshop)
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectStore.createIndex('by_status', 'status');
          projectStore.createIndex('by_updated', 'updatedAt');
        }

        // Game Saves Store
        if (!db.objectStoreNames.contains('game_saves')) {
          const saveStore = db.createObjectStore('game_saves', { keyPath: 'id' });
          saveStore.createIndex('by_game', 'gameId');
        }

        // Prompt Templates Store
        if (!db.objectStoreNames.contains('prompt_templates')) {
          db.createObjectStore('prompt_templates', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // Games methods
  async getAllGames(): Promise<Game[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('games', 'readonly');
      const store = tx.objectStore('games');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getGame(id: string): Promise<Game | undefined> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('games', 'readonly');
      const store = tx.objectStore('games');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveGame(game: Game): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('games', 'readwrite');
      const store = tx.objectStore('games');
      store.put(game);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Transaction failed while saving game'));
      tx.onabort = () => reject(tx.error || new Error('Transaction was aborted while saving game'));
    });
  }

  // Projects methods
  async getAllProjects(): Promise<GameProject[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readonly');
      const store = tx.objectStore('projects');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveProject(project: GameProject): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      const store = tx.objectStore('projects');
      store.put(project);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Transaction failed while saving project'));
      tx.onabort = () => reject(tx.error || new Error('Transaction was aborted while saving project'));
    });
  }

  // Game Save States methods
  async getSave(gameId: string, slotId: string): Promise<GameSave | undefined> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('game_saves', 'readonly');
      const store = tx.objectStore('game_saves');
      const req = store.get(`${gameId}:${slotId}`);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getSavesForGame(gameId: string): Promise<GameSave[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('game_saves', 'readonly');
      const store = tx.objectStore('game_saves');
      const index = store.index('by_game');
      const req = index.getAll(gameId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async writeSave(save: GameSave): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('game_saves', 'readwrite');
      const store = tx.objectStore('game_saves');
      store.put(save);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Transaction failed while writing save'));
      tx.onabort = () => reject(tx.error || new Error('Transaction was aborted while writing save'));
    });
  }
}

export const playbenchDB = new PlaybenchDB();
