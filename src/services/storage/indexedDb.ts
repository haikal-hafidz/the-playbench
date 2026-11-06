/**
 * IndexedDB Database Service for The Playbench (playbench_db)
 */
import { Game, GameProject, GameSave, ImportRecord, PackageFileRecord, CustomGameDataset, SavedPrompt } from '../../types';

const DB_NAME = 'playbench_db';
const DB_VERSION = 3;

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

        // Stage 5: Saved Prompts Store
        if (!db.objectStoreNames.contains('saved_prompts')) {
          const promptStore = db.createObjectStore('saved_prompts', { keyPath: 'id' });
          promptStore.createIndex('by_updated', 'updatedAt');
          promptStore.createIndex('by_template', 'templateId');
          promptStore.createIndex('by_agent', 'targetAgent');
        }

        // Stage 4: Import History Store
        if (!db.objectStoreNames.contains('import_history')) {
          const importStore = db.createObjectStore('import_history', { keyPath: 'id' });
          importStore.createIndex('by_method', 'importMethod');
          importStore.createIndex('by_status', 'status');
          importStore.createIndex('by_imported_at', 'importedAt');
        }

        // Stage 4: Package Files Store (for extracted ZIP packages)
        if (!db.objectStoreNames.contains('package_files')) {
          const fileStore = db.createObjectStore('package_files', { keyPath: 'id' });
          fileStore.createIndex('by_package', 'packageId');
          fileStore.createIndex('by_filepath', 'filePath');
        }

        // Stage 4: Custom Game Datasets Store
        if (!db.objectStoreNames.contains('custom_datasets')) {
          const dataStore = db.createObjectStore('custom_datasets', { keyPath: 'id' });
          dataStore.createIndex('by_content_type', 'contentType');
          dataStore.createIndex('by_game', 'gameId');
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

  async getProject(id: string): Promise<GameProject | undefined> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readonly');
      const store = tx.objectStore('projects');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
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

  async deleteProject(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      const store = tx.objectStore('projects');
      store.delete(id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Transaction failed while deleting project'));
      tx.onabort = () => reject(tx.error || new Error('Transaction was aborted while deleting project'));
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

  // Stage 4: Import History Methods
  async getAllImportRecords(): Promise<ImportRecord[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('import_history', 'readonly');
      const store = tx.objectStore('import_history');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveImportRecord(record: ImportRecord): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('import_history', 'readwrite');
      const store = tx.objectStore('import_history');
      store.put(record);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Transaction failed while saving import record'));
      tx.onabort = () => reject(tx.error || new Error('Transaction was aborted while saving import record'));
    });
  }

  async deleteImportRecord(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('import_history', 'readwrite');
      const store = tx.objectStore('import_history');
      store.delete(id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Transaction failed while deleting import record'));
      tx.onabort = () => reject(tx.error || new Error('Transaction was aborted while deleting import record'));
    });
  }

  // Stage 4: Package Files Methods
  async savePackageFiles(files: PackageFileRecord[]): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('package_files', 'readwrite');
      const store = tx.objectStore('package_files');
      for (const file of files) {
        store.put(file);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Transaction failed while saving package files'));
      tx.onabort = () => reject(tx.error || new Error('Transaction was aborted while saving package files'));
    });
  }

  async getPackageFiles(packageId: string): Promise<PackageFileRecord[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('package_files', 'readonly');
      const store = tx.objectStore('package_files');
      const index = store.index('by_package');
      const req = index.getAll(packageId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getPackageFile(packageId: string, filePath: string): Promise<PackageFileRecord | undefined> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('package_files', 'readonly');
      const store = tx.objectStore('package_files');
      const req = store.get(`${packageId}:${filePath}`);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async deletePackageFiles(packageId: string): Promise<void> {
    const db = await this.openDB();
    const files = await this.getPackageFiles(packageId);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('package_files', 'readwrite');
      const store = tx.objectStore('package_files');
      for (const f of files) {
        store.delete(f.id);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Transaction failed while deleting package files'));
      tx.onabort = () => reject(tx.error || new Error('Transaction was aborted while deleting package files'));
    });
  }

  // Stage 4: Custom Datasets Methods
  async saveCustomDataset(dataset: CustomGameDataset): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('custom_datasets', 'readwrite');
      const store = tx.objectStore('custom_datasets');
      store.put(dataset);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Transaction failed while saving custom dataset'));
      tx.onabort = () => reject(tx.error || new Error('Transaction was aborted while saving custom dataset'));
    });
  }

  async getAllCustomDatasets(): Promise<CustomGameDataset[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('custom_datasets', 'readonly');
      const store = tx.objectStore('custom_datasets');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  // Stage 5: Saved Prompts Methods
  async getAllSavedPrompts(): Promise<SavedPrompt[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('saved_prompts', 'readonly');
      const store = tx.objectStore('saved_prompts');
      const req = store.getAll();
      req.onsuccess = () => {
        const results: SavedPrompt[] = req.result || [];
        // sort by updatedAt descending
        results.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(results);
      };
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getSavedPrompt(id: string): Promise<SavedPrompt | undefined> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('saved_prompts', 'readonly');
      const store = tx.objectStore('saved_prompts');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async savePrompt(prompt: SavedPrompt): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('saved_prompts', 'readwrite');
      const store = tx.objectStore('saved_prompts');
      store.put(prompt);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Transaction failed while saving prompt'));
      tx.onabort = () => reject(tx.error || new Error('Transaction was aborted while saving prompt'));
    });
  }

  async deletePrompt(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('saved_prompts', 'readwrite');
      const store = tx.objectStore('saved_prompts');
      store.delete(id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Transaction failed while deleting prompt'));
      tx.onabort = () => reject(tx.error || new Error('Transaction was aborted while deleting prompt'));
    });
  }
}

export const playbenchDB = new PlaybenchDB();
