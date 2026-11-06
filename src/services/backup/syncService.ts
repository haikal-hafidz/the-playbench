/**
 * Cloud Synchronization & Supabase Storage Service
 *
 * Manages Supabase authentication and cloud backup synchronization:
 * - Secure authentication (email/password sign-in and sign-up).
 * - Uploads, lists, downloads, and deletes user cloud backups in 'playbench_backups'.
 * - Two-way synchronization between local IndexedDB snapshot and cloud snapshot.
 * - Deterministic conflict detection when local and remote snapshots diverge.
 * - Resilient offline support with graceful degradation.
 */
import {
  PlaybenchBackupPayload,
  BackupMetadata,
  SyncStatus,
  SyncConflict,
  SyncConflictResolution
} from '../../types';
import { supabaseService } from './supabaseClient';
import { BackupService } from './backupService';

export interface SyncState {
  status: SyncStatus;
  lastSyncTime: number | null;
  currentUser: { id: string; email: string } | null;
  conflict: SyncConflict | null;
  error: string | null;
}

export class SyncService {
  private stateListeners: ((state: SyncState) => void)[] = [];
  private state: SyncState = {
    status: 'idle',
    lastSyncTime: null,
    currentUser: null,
    conflict: null,
    error: null
  };

  constructor() {
    this.initAuth();
  }

  private updateState(updates: Partial<SyncState>) {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  private notifyListeners() {
    for (const listener of this.stateListeners) {
      listener(this.state);
    }
  }

  public subscribe(listener: (state: SyncState) => void): () => void {
    this.stateListeners.push(listener);
    listener(this.state);
    return () => {
      this.stateListeners = this.stateListeners.filter(l => l !== listener);
    };
  }

  public getState(): SyncState {
    return this.state;
  }

  /**
   * Initializes Supabase Auth state listener
   */
  private async initAuth() {
    const client = supabaseService.getClient();
    if (!client) {
      this.updateState({ status: 'offline' });
      return;
    }

    try {
      const { data, error } = await client.auth.getSession();
      if (!error && data.session?.user) {
        this.updateState({
          currentUser: {
            id: data.session.user.id,
            email: data.session.user.email || ''
          }
        });
      }

      client.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          this.updateState({
            currentUser: {
              id: session.user.id,
              email: session.user.email || ''
            },
            error: null
          });
        } else {
          this.updateState({
            currentUser: null,
            status: 'idle',
            conflict: null,
            error: null
          });
        }
      });
    } catch (err: any) {
      console.warn('Supabase auth initialization error:', err);
    }
  }

  // --- Auth Actions ---

  public async signIn(email: string, password: string):Promise<{ success: boolean; error?: string }> {
    const client = supabaseService.getClient();
    if (!client) {
      return { success: false, error: 'Supabase is not configured or offline.' };
    }

    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) return { success: false, error: error.message };
      if (data.user) {
        this.updateState({
          currentUser: { id: data.user.id, email: data.user.email || '' },
          error: null
        });
        return { success: true };
      }
      return { success: false, error: 'Sign in succeeded without user data.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during sign-in.' };
    }
  }

  public async signUp(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    const client = supabaseService.getClient();
    if (!client) {
      return { success: false, error: 'Supabase is not configured or offline.' };
    }

    try {
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) return { success: false, error: error.message };
      if (data.user) {
        this.updateState({
          currentUser: { id: data.user.id, email: data.user.email || '' },
          error: null
        });
        return { success: true };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during sign-up.' };
    }
  }

  public async signOut(): Promise<void> {
    const client = supabaseService.getClient();
    if (client) {
      try {
        await client.auth.signOut();
      } catch (err) {
        console.warn('Sign out error:', err);
      }
    }
    this.updateState({
      currentUser: null,
      status: 'idle',
      conflict: null,
      error: null
    });
  }

  // --- Cloud Backup Database Operations ---

  /**
   * Uploads a validated snapshot to 'playbench_backups' in Supabase.
   */
  public async uploadBackup(payload: PlaybenchBackupPayload): Promise<{ success: boolean; error?: string }> {
    const client = supabaseService.getClient();
    if (!client || !this.state.currentUser) {
      return { success: false, error: 'User is not authenticated or cloud is unconfigured.' };
    }

    try {
      const row = {
        id: payload.metadata.id,
        user_id: this.state.currentUser.id,
        name: payload.metadata.name,
        payload: payload,
        checksum: payload.checksum,
        schema_version: payload.schemaVersion,
        app_version: payload.appVersion,
        created_at: new Date(payload.timestamp).toISOString()
      };

      const { error } = await client
        .from('playbench_backups')
        .insert(row);

      if (error) {
        return { success: false, error: error.message };
      }

      this.updateState({
        lastSyncTime: Date.now(),
        status: 'idle',
        error: null
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to upload backup.' };
    }
  }

  /**
   * Fetches all cloud backups belonging to the authenticated user.
   */
  public async listCloudBackups(): Promise<BackupMetadata[]> {
    const client = supabaseService.getClient();
    if (!client || !this.state.currentUser) {
      return [];
    }

    try {
      const { data, error } = await client
        .from('playbench_backups')
        .select('id, user_id, name, checksum, schema_version, app_version, created_at, payload')
        .order('created_at', { ascending: false });

      if (error || !data) {
        console.warn('Error querying cloud backups:', error);
        return [];
      }

      return data.map(row => {
        const payload = row.payload as PlaybenchBackupPayload;
        return {
          id: row.id,
          userId: row.user_id,
          name: row.name,
          createdAt: new Date(row.created_at).getTime(),
          schemaVersion: row.schema_version,
          appVersion: row.app_version,
          checksum: row.checksum,
          counts: payload.metadata?.counts || {
            games: payload.stores?.games?.length || 0,
            projects: payload.stores?.projects?.length || 0,
            gameSaves: payload.stores?.gameSaves?.length || 0,
            savedPrompts: payload.stores?.savedPrompts?.length || 0,
            importHistory: payload.stores?.importHistory?.length || 0,
            packageFiles: payload.stores?.packageFiles?.length || 0,
            customDatasets: payload.stores?.customDatasets?.length || 0
          },
          sizeBytes: payload.metadata?.sizeBytes
        };
      });
    } catch (err) {
      console.warn('Exception listing cloud backups:', err);
      return [];
    }
  }

  /**
   * Downloads a specific backup payload by ID.
   */
  public async downloadCloudBackup(backupId: string): Promise<PlaybenchBackupPayload | null> {
    const client = supabaseService.getClient();
    if (!client || !this.state.currentUser) {
      return null;
    }

    try {
      const { data, error } = await client
        .from('playbench_backups')
        .select('payload')
        .eq('id', backupId)
        .single();

      if (error || !data) {
        console.warn('Error downloading backup:', error);
        return null;
      }

      return data.payload as PlaybenchBackupPayload;
    } catch (err) {
      console.warn('Exception downloading backup:', err);
      return null;
    }
  }

  /**
   * Deletes a cloud backup by ID.
   */
  public async deleteCloudBackup(backupId: string): Promise<{ success: boolean; error?: string }> {
    const client = supabaseService.getClient();
    if (!client || !this.state.currentUser) {
      return { success: false, error: 'User is not authenticated.' };
    }

    try {
      const { error } = await client
        .from('playbench_backups')
        .delete()
        .eq('id', backupId);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error deleting backup.' };
    }
  }

  // --- Two-Way Synchronization Engine ---

  /**
   * Runs complete synchronization between local IndexedDB and cloud storage.
   * Detects and handles conflicts deterministically.
   */
  public async runSync(): Promise<{ success: boolean; conflict?: SyncConflict; error?: string }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.updateState({ status: 'offline', error: 'Device is offline.' });
      return { success: false, error: 'Device is offline.' };
    }

    const client = supabaseService.getClient();
    if (!client || !this.state.currentUser) {
      this.updateState({ status: 'error', error: 'Please connect your account to sync.' });
      return { success: false, error: 'Please connect your account to sync.' };
    }

    this.updateState({ status: 'syncing', error: null });

    try {
      // 1. Export current local snapshot
      const localSnapshot = await BackupService.exportLocalSnapshot('Auto Sync', this.state.currentUser.id);

      // 2. Fetch list of remote backups
      const cloudBackups = await this.listCloudBackups();

      if (cloudBackups.length === 0) {
        // No remote backups exist yet: upload local state directly
        const uploadRes = await this.uploadBackup(localSnapshot);
        if (!uploadRes.success) {
          this.updateState({ status: 'error', error: uploadRes.error });
          return uploadRes;
        }
        this.updateState({ status: 'idle', lastSyncTime: Date.now() });
        return { success: true };
      }

      // 3. Compare with the latest remote backup
      const latestRemoteMeta = cloudBackups[0];
      const latestRemotePayload = await this.downloadCloudBackup(latestRemoteMeta.id);

      if (!latestRemotePayload) {
        this.updateState({ status: 'error', error: 'Failed to download latest cloud backup.' });
        return { success: false, error: 'Failed to download latest cloud backup.' };
      }

      // If checksums match, local and remote are identical
      if (localSnapshot.checksum === latestRemotePayload.checksum) {
        this.updateState({ status: 'idle', lastSyncTime: Date.now() });
        return { success: true };
      }

      // Detect conflict vs clean fast-forward
      const lastSync = this.state.lastSyncTime || 0;
      const localChangedSinceLastSync = localSnapshot.timestamp > lastSync;
      const remoteChangedSinceLastSync = latestRemotePayload.timestamp > lastSync;

      if (localChangedSinceLastSync && remoteChangedSinceLastSync && lastSync > 0) {
        // Both sides changed since last sync -> Conflict detected!
        const conflict: SyncConflict = {
          id: `conflict-${Date.now()}`,
          localTimestamp: localSnapshot.timestamp,
          remoteTimestamp: latestRemotePayload.timestamp,
          localMetadata: localSnapshot.metadata,
          remoteMetadata: latestRemoteMeta,
          remotePayload: latestRemotePayload
        };

        this.updateState({ status: 'conflict', conflict });
        return { success: false, conflict };
      }

      // If remote is newer, restore remote payload locally
      if (latestRemotePayload.timestamp > localSnapshot.timestamp) {
        await BackupService.restoreLocalSnapshot(latestRemotePayload, { destructive: true });
        this.updateState({ status: 'idle', lastSyncTime: Date.now() });
        return { success: true };
      } else {
        // Local is newer: upload local snapshot to remote
        const uploadRes = await this.uploadBackup(localSnapshot);
        if (!uploadRes.success) {
          this.updateState({ status: 'error', error: uploadRes.error });
          return uploadRes;
        }
        this.updateState({ status: 'idle', lastSyncTime: Date.now() });
        return { success: true };
      }
    } catch (err: any) {
      console.error('Sync failure:', err);
      this.updateState({ status: 'error', error: err.message || 'Unexpected sync error.' });
      return { success: false, error: err.message || 'Unexpected sync error.' };
    }
  }

  /**
   * Resolves an active conflict with user's explicit choice.
   */
  public async resolveConflict(resolution: SyncConflictResolution): Promise<void> {
    const conflict = this.state.conflict;
    if (!conflict) return;

    if (resolution === 'cancel') {
      this.updateState({ status: 'idle', conflict: null });
      return;
    }

    if (resolution === 'take-remote') {
      // Overwrite local with remote
      await BackupService.restoreLocalSnapshot(conflict.remotePayload, { destructive: true });
      this.updateState({
        status: 'idle',
        conflict: null,
        lastSyncTime: Date.now()
      });
    } else if (resolution === 'keep-local') {
      // Upload local state to cloud as latest
      if (this.state.currentUser) {
        const localSnapshot = await BackupService.exportLocalSnapshot('Conflict Resolved (Local Chosen)', this.state.currentUser.id);
        await this.uploadBackup(localSnapshot);
      }
      this.updateState({
        status: 'idle',
        conflict: null,
        lastSyncTime: Date.now()
      });
    }
  }
}

export const syncService = new SyncService();
