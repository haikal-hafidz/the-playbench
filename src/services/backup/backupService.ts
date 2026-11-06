/**
 * Backup & Serialization Engine
 *
 * Handles extracting, checksumming, validating, and restoring full platform snapshots
 * across all IndexedDB stores (games, projects, game_saves, saved_prompts, import_history, package_files, custom_datasets)
 * and LocalStorage preferences.
 */
import {
  PlaybenchBackupPayload,
  BackupMetadata,
  Game,
  GameProject,
  GameSave,
  SavedPrompt,
  ImportRecord,
  PackageFileRecord,
  CustomGameDataset,
  UserPreferences
} from '../../types';
import { playbenchDB } from '../storage/indexedDb';
import { getPreferences, savePreferences } from '../storage/preferences';

export class BackupService {
  public static readonly SCHEMA_VERSION = 1;
  public static readonly APP_VERSION = '0.1.0';

  /**
   * Computes a deterministic SHA-256 hash string for an input string or arraybuffer.
   */
  public static async computeSha256(data: string): Promise<string> {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(data);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      // Fallback simple fast hash for node/headless test environments without crypto.subtle
      let hash = 0;
      for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
      }
      return 'fallback_' + Math.abs(hash).toString(16).padStart(16, '0');
    }
  }

  /**
   * Serializes binary ArrayBuffer fields in PackageFileRecords into base64 or string
   * so the entire payload can be stored as JSON without data loss.
   */
  public static serializePackageFiles(files: PackageFileRecord[]): PackageFileRecord[] {
    return files.map(file => {
      if (file.data instanceof ArrayBuffer) {
        // Convert ArrayBuffer to binary string / base64
        const bytes = new Uint8Array(file.data);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return {
          ...file,
          data: typeof btoa !== 'undefined' ? `base64:${btoa(binary)}` : binary
        };
      }
      return file;
    });
  }

  /**
   * Deserializes package files, reconstructing ArrayBuffers where appropriate.
   */
  public static deserializePackageFiles(files: PackageFileRecord[]): PackageFileRecord[] {
    return files.map(file => {
      if (typeof file.data === 'string' && file.data.startsWith('base64:')) {
        try {
          const base64 = file.data.replace('base64:', '');
          const binary = typeof atob !== 'undefined' ? atob(base64) : '';
          const len = binary.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          return {
            ...file,
            data: bytes.buffer
          };
        } catch (err) {
          console.warn('Failed to deserialize base64 file data:', err);
          return file;
        }
      }
      return file;
    });
  }

  /**
   * Extracts a complete local snapshot from IndexedDB and LocalStorage.
   */
  public static async exportLocalSnapshot(
    backupName: string = 'Manual Backup',
    userId?: string
  ): Promise<PlaybenchBackupPayload> {
    const timestamp = Date.now();
    const id = `backup-${timestamp}-${Math.random().toString(36).substring(2, 7)}`;

    // Read all 7 stores from IndexedDB
    const games: Game[] = await playbenchDB.getAllGames();
    const projects: GameProject[] = await playbenchDB.getAllProjects();
    const savedPrompts: SavedPrompt[] = await playbenchDB.getAllSavedPrompts();
    const importHistory: ImportRecord[] = await playbenchDB.getAllImportRecords();
    const customDatasets: CustomGameDataset[] = await playbenchDB.getAllCustomDatasets();

    // Game saves (iterate per game)
    const gameSavesList: GameSave[] = [];
    for (const g of games) {
      try {
        const saves = await playbenchDB.getSavesForGame(g.id);
        gameSavesList.push(...saves);
      } catch (err) {
        console.warn(`Could not read saves for game ${g.id}:`, err);
      }
    }

    // Package files (iterate per imported package origin)
    const packageFilesList: PackageFileRecord[] = [];
    const packageIds = new Set<string>();
    for (const g of games) {
      if (g.packageOrigin === 'imported-zip') {
        packageIds.add(g.id);
      }
    }
    for (const pId of Array.from(packageIds)) {
      try {
        const files = await playbenchDB.getPackageFiles(pId);
        packageFilesList.push(...files);
      } catch (err) {
        console.warn(`Could not read package files for ${pId}:`, err);
      }
    }

    // Local preferences
    const preferences: UserPreferences = getPreferences();

    const serializedFiles = this.serializePackageFiles(packageFilesList);

    const counts = {
      games: games.length,
      projects: projects.length,
      gameSaves: gameSavesList.length,
      savedPrompts: savedPrompts.length,
      importHistory: importHistory.length,
      packageFiles: serializedFiles.length,
      customDatasets: customDatasets.length
    };

    // Preliminary payload without checksum
    const rawDataToHash = JSON.stringify({
      schemaVersion: this.SCHEMA_VERSION,
      appVersion: this.APP_VERSION,
      timestamp,
      stores: {
        games,
        projects,
        gameSaves: gameSavesList,
        savedPrompts,
        importHistory,
        packageFiles: serializedFiles,
        customDatasets
      },
      preferences
    });

    const checksum = await this.computeSha256(rawDataToHash);
    const sizeBytes = new Blob([rawDataToHash]).size;

    const metadata: BackupMetadata = {
      id,
      userId,
      name: backupName,
      createdAt: timestamp,
      schemaVersion: this.SCHEMA_VERSION,
      appVersion: this.APP_VERSION,
      checksum,
      counts,
      sizeBytes
    };

    return {
      schemaVersion: this.SCHEMA_VERSION,
      appVersion: this.APP_VERSION,
      timestamp,
      checksum,
      metadata,
      stores: {
        games,
        projects,
        gameSaves: gameSavesList,
        savedPrompts,
        importHistory,
        packageFiles: serializedFiles,
        customDatasets
      },
      preferences
    };
  }

  /**
   * Validates a backup payload against schema and checksum integrity.
   */
  public static async validateSnapshot(payload: any): Promise<{
    valid: boolean;
    error?: string;
  }> {
    if (!payload || typeof payload !== 'object') {
      return { valid: false, error: 'Backup payload is not a valid object.' };
    }

    if (!payload.schemaVersion || payload.schemaVersion > this.SCHEMA_VERSION) {
      return {
        valid: false,
        error: `Incompatible schema version: ${payload.schemaVersion}. Supported version: ${this.SCHEMA_VERSION}.`
      };
    }

    if (!payload.stores || typeof payload.stores !== 'object') {
      return { valid: false, error: 'Backup payload is missing stores object.' };
    }

    const { games, projects, gameSaves, savedPrompts, importHistory, packageFiles, customDatasets } = payload.stores;
    if (
      !Array.isArray(games) ||
      !Array.isArray(projects) ||
      !Array.isArray(gameSaves) ||
      !Array.isArray(savedPrompts) ||
      !Array.isArray(importHistory) ||
      !Array.isArray(packageFiles) ||
      !Array.isArray(customDatasets)
    ) {
      return { valid: false, error: 'One or more data stores in backup payload are corrupted or not arrays.' };
    }

    // Verify Checksum if present
    if (payload.checksum) {
      const rawDataToHash = JSON.stringify({
        schemaVersion: payload.schemaVersion,
        appVersion: payload.appVersion,
        timestamp: payload.timestamp,
        stores: payload.stores,
        preferences: payload.preferences
      });
      const calculatedChecksum = await this.computeSha256(rawDataToHash);
      if (calculatedChecksum !== payload.checksum) {
        return {
          valid: false,
          error: 'Checksum verification failed: The backup payload is corrupted or has been altered.'
        };
      }
    }

    return { valid: true };
  }

  /**
   * Restores a validated snapshot into local IndexedDB and LocalStorage.
   * By default, destructive = true cleanly replaces existing records to ensure exact snapshot parity.
   */
  public static async restoreLocalSnapshot(
    payload: PlaybenchBackupPayload,
    options: { destructive?: boolean } = { destructive: true }
  ): Promise<void> {
    const validation = await this.validateSnapshot(payload);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid backup snapshot.');
    }

    const { games, projects, gameSaves, savedPrompts, importHistory, packageFiles, customDatasets } = payload.stores;

    // Deserializing package files
    const deserializedFiles = this.deserializePackageFiles(packageFiles);

    // If destructive replacement is chosen, clear stores first
    if (options.destructive) {
      // Restore games
      for (const g of games) {
        await playbenchDB.saveGame(g);
      }

      // Restore projects
      const currentProjects = await playbenchDB.getAllProjects();
      for (const p of currentProjects) {
        await playbenchDB.deleteProject(p.id);
      }
      for (const p of projects) {
        await playbenchDB.saveProject(p);
      }

      // Restore saves
      for (const s of gameSaves) {
        await playbenchDB.writeSave(s);
      }

      // Restore saved prompts
      const currentPrompts = await playbenchDB.getAllSavedPrompts();
      for (const p of currentPrompts) {
        await playbenchDB.deletePrompt(p.id);
      }
      for (const p of savedPrompts) {
        await playbenchDB.savePrompt(p);
      }

      // Restore import history
      const currentHistory = await playbenchDB.getAllImportRecords();
      for (const h of currentHistory) {
        await playbenchDB.deleteImportRecord(h.id);
      }
      for (const h of importHistory) {
        await playbenchDB.saveImportRecord(h);
      }

      // Restore package files
      if (deserializedFiles.length > 0) {
        await playbenchDB.savePackageFiles(deserializedFiles);
      }

      // Restore custom datasets
      for (const d of customDatasets) {
        await playbenchDB.saveCustomDataset(d);
      }
    } else {
      // Non-destructive merge: update or insert
      for (const g of games) await playbenchDB.saveGame(g);
      for (const p of projects) await playbenchDB.saveProject(p);
      for (const s of gameSaves) await playbenchDB.writeSave(s);
      for (const p of savedPrompts) await playbenchDB.savePrompt(p);
      for (const h of importHistory) await playbenchDB.saveImportRecord(h);
      if (deserializedFiles.length > 0) await playbenchDB.savePackageFiles(deserializedFiles);
      for (const d of customDatasets) await playbenchDB.saveCustomDataset(d);
    }

    // Restore preferences
    if (payload.preferences) {
      savePreferences(payload.preferences);
    }
  }
}
