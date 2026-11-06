import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { BackupService, syncService } from '../index';
import { playbenchDB } from '../../storage/indexedDb';
import { savePreferences, getPreferences } from '../../storage/preferences';
import { Game, GameProject, SavedPrompt } from '../../../types';

describe('Backup & Synchronization Service Tests', () => {
  beforeEach(async () => {
    // Reset IndexedDB tables
    const games = await playbenchDB.getAllGames();
    for (const g of games) await playbenchDB.saveGame({ ...g, playCount: 0 });

    const projects = await playbenchDB.getAllProjects();
    for (const p of projects) await playbenchDB.deleteProject(p.id);

    const prompts = await playbenchDB.getAllSavedPrompts();
    for (const pr of prompts) await playbenchDB.deletePrompt(pr.id);

    const history = await playbenchDB.getAllImportRecords();
    for (const h of history) await playbenchDB.deleteImportRecord(h.id);
  });

  describe('Backup Serialization & Export', () => {
    it('exports a complete snapshot with metadata and SHA-256 checksum', async () => {
      // Seed some test data
      const sampleGame: Game = {
        id: 'test-game',
        title: 'Test Game',
        description: 'Test description',
        genre: ['Casual'],
        version: '1.0.0',
        runtime: { type: 'html-standalone', entrypoint: 'index.html' },
        players: { min: 1, max: 2, type: 'solo' },
        tags: ['test'],
        offlineCapable: true,
        packageOrigin: 'bundled',
        playCount: 5,
        createdAt: 1000,
        updatedAt: 2000
      };
      await playbenchDB.saveGame(sampleGame);

      const sampleProject: GameProject = {
        id: 'test-proj',
        title: 'Test Project',
        status: 'draft',
        workflowType: 'creation',
        checklist: [],
        createdAt: 1000,
        updatedAt: 2000
      };
      await playbenchDB.saveProject(sampleProject);

      const samplePrompt: SavedPrompt = {
        id: 'prompt-1',
        title: 'Sample Prompt',
        targetAgent: 'jules',
        templateId: 'game-creation',
        formState: {} as any,
        generatedText: '# Prompt',
        createdAt: 1000,
        updatedAt: 2000
      };
      await playbenchDB.savePrompt(samplePrompt);

      savePreferences({ cuttingMatTheme: 'blueprint-blue', showRulers: false });

      const snapshot = await BackupService.exportLocalSnapshot('Unit Test Snapshot', 'user-123');

      expect(snapshot).toBeDefined();
      expect(snapshot.schemaVersion).toBe(1);
      expect(snapshot.appVersion).toBe('0.1.0');
      expect(snapshot.checksum).toBeTruthy();
      expect(snapshot.metadata.name).toBe('Unit Test Snapshot');
      expect(snapshot.metadata.userId).toBe('user-123');
      expect(snapshot.metadata.counts.games).toBeGreaterThanOrEqual(1);
      expect(snapshot.metadata.counts.projects).toBe(1);
      expect(snapshot.metadata.counts.savedPrompts).toBe(1);
      expect(snapshot.preferences.cuttingMatTheme).toBe('blueprint-blue');
    });

    it('serializes and deserializes binary package files accurately', () => {
      const buffer = new Uint8Array([10, 20, 30, 40, 50]).buffer;
      const rawFile = {
        id: 'pkg:file.bin',
        packageId: 'pkg',
        filePath: 'file.bin',
        mimeType: 'application/octet-stream',
        data: buffer,
        size: 5
      };

      const serialized = BackupService.serializePackageFiles([rawFile]);
      expect(typeof serialized[0].data).toBe('string');
      expect((serialized[0].data as string).startsWith('base64:')).toBe(true);

      const deserialized = BackupService.deserializePackageFiles(serialized);
      expect(deserialized[0].data instanceof ArrayBuffer).toBe(true);
      const restoredBytes = new Uint8Array(deserialized[0].data as ArrayBuffer);
      expect(Array.from(restoredBytes)).toEqual([10, 20, 30, 40, 50]);
    });
  });

  describe('Validation & Integrity Verification', () => {
    it('validates a correct snapshot successfully', async () => {
      const snapshot = await BackupService.exportLocalSnapshot('Valid Snapshot');
      const result = await BackupService.validateSnapshot(snapshot);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects a snapshot with an incompatible schema version', async () => {
      const snapshot = await BackupService.exportLocalSnapshot('Future Snapshot');
      snapshot.schemaVersion = 999;
      const result = await BackupService.validateSnapshot(snapshot);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Incompatible schema version');
    });

    it('detects checksum tampering or corrupted payload data', async () => {
      const snapshot = await BackupService.exportLocalSnapshot('Tampered Snapshot');
      // Alter data without updating checksum
      snapshot.stores.games.push({
        id: 'fake-game',
        title: 'Tampered Game',
        description: 'Hacked',
        genre: [],
        version: '1.0.0',
        runtime: { type: 'html-standalone', entrypoint: 'index.html' },
        players: { min: 1, max: 1, type: 'solo' },
        tags: [],
        offlineCapable: true,
        packageOrigin: 'bundled',
        playCount: 0,
        createdAt: 0,
        updatedAt: 0
      });

      const result = await BackupService.validateSnapshot(snapshot);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Checksum verification failed');
    });
  });

  describe('Restore Operations', () => {
    it('restores local IndexedDB stores and preferences accurately from snapshot', async () => {
      const sampleProject: GameProject = {
        id: 'restore-proj',
        title: 'Project To Restore',
        status: 'completed',
        workflowType: 'creation',
        checklist: [],
        createdAt: 5000,
        updatedAt: 5000
      };
      await playbenchDB.saveProject(sampleProject);
      savePreferences({ cuttingMatTheme: 'slate-charcoal' });

      // Take snapshot
      const snapshot = await BackupService.exportLocalSnapshot('Snapshot Before Delete');

      // Mutate local state
      await playbenchDB.deleteProject('restore-proj');
      savePreferences({ cuttingMatTheme: 'classic-green' });
      expect(await playbenchDB.getProject('restore-proj')).toBeUndefined();
      expect(getPreferences().cuttingMatTheme).toBe('classic-green');

      // Execute restore
      await BackupService.restoreLocalSnapshot(snapshot, { destructive: true });

      // Verify restored state
      const restoredProj = await playbenchDB.getProject('restore-proj');
      expect(restoredProj).toBeDefined();
      expect(restoredProj?.title).toBe('Project To Restore');
      expect(getPreferences().cuttingMatTheme).toBe('slate-charcoal');
    });
  });

  describe('Sync Service Offline & Unconfigured State', () => {
    it('gracefully degrades to offline status when Supabase is unconfigured', async () => {
      const state = syncService.getState();
      expect(state).toBeDefined();
      // Should fail gracefully without throwing uncaught exceptions
      const res = await syncService.runSync();
      expect(res.success).toBe(false);
      expect(res.error).toBeTruthy();
    });
  });
});
