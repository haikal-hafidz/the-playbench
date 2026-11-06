import React, { useState, useEffect, useCallback } from 'react';
import {
  Sliders,
  HardDrive,
  Cloud,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  LogOut,
  LogIn,
  UserPlus,
  X,
  HelpCircle
} from 'lucide-react';
import { CuttingMat } from '../../components/desk/CuttingMat';
import { usePreferences } from '../../hooks/usePreferences';
import {
  CuttingMatTheme,
  BackupMetadata,
  PlaybenchBackupPayload,
  SyncConflict
} from '../../types';
import {
  supabaseService,
  BackupService,
  syncService,
  SyncState
} from '../../services/backup';

export const SettingsPage: React.FC = () => {
  const { preferences, updatePreferences } = usePreferences();

  // Sync state subscription
  const [syncState, setSyncState] = useState<SyncState>(syncService.getState());
  const [cloudBackups, setCloudBackups] = useState<BackupMetadata[]>([]);
  const [loadingBackups, setLoadingBackups] = useState<boolean>(false);

  // Auth form state
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Manual Backup & Restore State
  const [backupName, setBackupName] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Restore Modal State
  const [selectedBackupForRestore, setSelectedBackupForRestore] = useState<BackupMetadata | null>(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);

  // Conflict Modal State
  const [activeConflict, setActiveConflict] = useState<SyncConflict | null>(null);

  useEffect(() => {
    const unsubscribe = syncService.subscribe((state) => {
      setSyncState(state);
      if (state.conflict) {
        setActiveConflict(state.conflict);
      }
    });
    return unsubscribe;
  }, []);

  const loadBackups = useCallback(async () => {
    if (!syncState.currentUser) {
      setCloudBackups([]);
      return;
    }
    setLoadingBackups(true);
    try {
      const backups = await syncService.listCloudBackups();
      setCloudBackups(backups);
    } catch (err) {
      console.error('Failed to load cloud backups:', err);
    } finally {
      setLoadingBackups(false);
    }
  }, [syncState.currentUser]);

  useEffect(() => {
    if (syncState.currentUser) {
      loadBackups();
    }
  }, [syncState.currentUser, loadBackups]);

  // Auth Handlers
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setAuthMessage({ type: 'error', text: 'Please enter both email and password.' });
      return;
    }

    setAuthLoading(true);
    setAuthMessage(null);

    if (authMode === 'signin') {
      const res = await syncService.signIn(email, password);
      if (res.success) {
        setAuthMessage({ type: 'success', text: 'Successfully connected!' });
        setEmail('');
        setPassword('');
      } else {
        setAuthMessage({ type: 'error', text: res.error || 'Sign in failed.' });
      }
    } else {
      const res = await syncService.signUp(email, password);
      if (res.success) {
        setAuthMessage({ type: 'success', text: 'Account created! Check email if confirmation is required.' });
      } else {
        setAuthMessage({ type: 'error', text: res.error || 'Sign up failed.' });
      }
    }
    setAuthLoading(false);
  };

  const handleSignOut = async () => {
    await syncService.signOut();
    setCloudBackups([]);
    setActionSuccess('Disconnected from cloud account.');
    setTimeout(() => setActionSuccess(null), 3000);
  };

  // Sync & Backup Handlers
  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setActionSuccess(null);
    const res = await syncService.runSync();
    setIsSyncing(false);

    if (res.success) {
      setActionSuccess('Synchronization completed successfully!');
      await loadBackups();
    } else if (res.conflict) {
      setActiveConflict(res.conflict);
    } else if (res.error) {
      setAuthMessage({ type: 'error', text: res.error });
    }
    setTimeout(() => setActionSuccess(null), 4000);
  };

  const handleCreateManualBackup = async () => {
    setIsBackingUp(true);
    try {
      const name = backupName.trim() || `Backup ${new Date().toLocaleDateString()}`;
      const snapshot: PlaybenchBackupPayload = await BackupService.exportLocalSnapshot(
        name,
        syncState.currentUser?.id
      );

      if (syncState.currentUser) {
        const uploadRes = await syncService.uploadBackup(snapshot);
        if (!uploadRes.success) {
          throw new Error(uploadRes.error || 'Failed to upload backup to cloud.');
        }
        await loadBackups();
        setActionSuccess(`Snapshot "${name}" saved to cloud!`);
      } else {
        setActionSuccess(`Local snapshot "${name}" generated!`);
      }
      setBackupName('');
    } catch (err: any) {
      console.error('Backup creation error:', err);
      setAuthMessage({ type: 'error', text: err.message || 'Failed to create backup.' });
    } finally {
      setIsBackingUp(false);
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  const handleDeleteBackup = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this cloud backup permanently?')) {
      return;
    }
    const res = await syncService.deleteCloudBackup(id);
    if (res.success) {
      setActionSuccess('Cloud backup removed.');
      await loadBackups();
    } else {
      setAuthMessage({ type: 'error', text: res.error || 'Failed to delete backup.' });
    }
    setTimeout(() => setActionSuccess(null), 3000);
  };

  // Restore Execution
  const handleExecuteRestore = async () => {
    if (!selectedBackupForRestore) return;
    setIsRestoring(true);
    try {
      const payload = await syncService.downloadCloudBackup(selectedBackupForRestore.id);
      if (!payload) throw new Error('Could not download backup snapshot data.');

      await BackupService.restoreLocalSnapshot(payload, { destructive: true });
      setSelectedBackupForRestore(null);
      setRestoreConfirmText('');
      setActionSuccess('Platform restored successfully from backup!');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      console.error('Restore error:', err);
      setAuthMessage({ type: 'error', text: err.message || 'Failed to restore backup.' });
    } finally {
      setIsRestoring(false);
    }
  };

  const themes: { id: CuttingMatTheme; label: string; bg: string }[] = [
    { id: 'classic-green', label: 'Classic Cutting Green', bg: '#1b4731' },
    { id: 'deep-forest', label: 'Deep Forest', bg: '#123824' },
    { id: 'blueprint-blue', label: 'Blueprint Drafting Blue', bg: '#163e5c' },
    { id: 'slate-charcoal', label: 'Slate Charcoal', bg: '#23282e' },
  ];

  const supabaseConfigured = supabaseService.isAvailable();

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 20px 64px 20px' }}>
      <CuttingMat>
        <div style={{
          backgroundColor: 'var(--color-paper-card)',
          borderRadius: '8px',
          border: '1px solid var(--color-paper-border)',
          boxShadow: 'var(--shadow-desk-card)',
          padding: '32px',
          color: 'var(--color-ink-primary)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #d4c5a9', paddingBottom: '18px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '8px',
                backgroundColor: '#1b4731',
                color: '#e8c872',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Sliders size={24} />
              </div>
              <div>
                <h1 style={{ fontFamily: 'var(--font-family-display)', fontSize: '24px', fontWeight: 700, margin: 0 }}>
                  Settings & Cloud Sync
                </h1>
                <p style={{ fontSize: '13px', color: '#535c56', marginTop: '2px' }}>
                  Workbench preferences, local IndexedDB inspector, and Supabase cloud backup.
                </p>
              </div>
            </div>

            {/* Offline / Online Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '16px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: typeof navigator !== 'undefined' && !navigator.onLine ? '#ffebee' : '#e8f5e9',
              color: typeof navigator !== 'undefined' && !navigator.onLine ? '#c62828' : '#2e7d32',
              border: `1px solid ${typeof navigator !== 'undefined' && !navigator.onLine ? '#ef9a9a' : '#c8e6c9'}`
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: typeof navigator !== 'undefined' && !navigator.onLine ? '#c62828' : '#2e7d32'
              }} />
              {typeof navigator !== 'undefined' && !navigator.onLine ? 'Offline Mode' : 'Online'}
            </div>
          </div>

          {actionSuccess && (
            <div style={{
              backgroundColor: '#e8f5e9',
              color: '#1b5e20',
              padding: '12px 16px',
              borderRadius: '6px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              border: '1px solid #a5d6a7'
            }}>
              <CheckCircle2 size={16} />
              <span>{actionSuccess}</span>
            </div>
          )}

          {authMessage && (
            <div style={{
              backgroundColor: authMessage.type === 'error' ? '#ffebee' : '#e8f5e9',
              color: authMessage.type === 'error' ? '#c62828' : '#1b5e20',
              padding: '12px 16px',
              borderRadius: '6px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              border: `1px solid ${authMessage.type === 'error' ? '#ef9a9a' : '#a5d6a7'}`
            }}>
              {authMessage.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
              <span>{authMessage.text}</span>
              <button
                onClick={() => setAuthMessage(null)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* SECTION 1: CLOUD BACKUP & SYNCHRONIZATION STATION */}
          <div style={{
            backgroundColor: '#fbf9f4',
            border: '2px solid #5d4037',
            borderRadius: '8px',
            padding: '24px',
            marginBottom: '32px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Cloud size={22} color="#163e5c" />
                <h2 style={{ margin: 0, fontSize: '18px', fontFamily: 'var(--font-family-display)', color: '#3e2723' }}>
                  Cloud Backup & Sync Forge
                </h2>
              </div>

              {/* Status Pill */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: syncState.status === 'syncing' ? '#fff9c4' : syncState.status === 'error' ? '#ffebee' : '#efebe4',
                color: '#4e342e',
                border: '1px solid #d7ccc8'
              }}>
                <span style={{ fontWeight: 600 }}>Sync Status:</span>
                <span style={{ textTransform: 'capitalize', fontWeight: 700 }}>{syncState.status}</span>
                {syncState.lastSyncTime && (
                  <span style={{ color: '#8d6e63', fontSize: '11px' }}>
                    (Last: {new Date(syncState.lastSyncTime).toLocaleTimeString()})
                  </span>
                )}
              </div>
            </div>

            {/* Account Status / Auth Box */}
            <div style={{
              backgroundColor: '#fff',
              border: '1px solid #d7ccc8',
              borderRadius: '6px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              {syncState.currentUser ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: '#2e7d32',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700
                    }}>
                      {syncState.currentUser.email[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#2e7d32' }}>Connected as Owner</div>
                      <div style={{ fontSize: '12px', color: '#6d4c41' }}>{syncState.currentUser.email}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleTriggerSync}
                      disabled={isSyncing}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#2e7d32',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: isSyncing ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                      {isSyncing ? 'Syncing...' : 'Sync Now'}
                    </button>

                    <button
                      onClick={handleSignOut}
                      style={{
                        padding: '8px 14px',
                        backgroundColor: '#fff',
                        color: '#c62828',
                        border: '1px solid #ef9a9a',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <LogOut size={14} />
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#3e2723' }}>
                        Connect Supabase Account
                      </h4>
                      <p style={{ margin: 0, fontSize: '12px', color: '#6d4c41' }}>
                        Sign in to sync your game packages, workshop briefs, and saves securely to your personal cloud.
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => setAuthMode('signin')}
                        style={{
                          padding: '4px 10px',
                          border: 'none',
                          borderRadius: '4px',
                          backgroundColor: authMode === 'signin' ? '#2e7d32' : '#efebe4',
                          color: authMode === 'signin' ? '#fff' : '#4e342e',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Sign In
                      </button>
                      <button
                        onClick={() => setAuthMode('signup')}
                        style={{
                          padding: '4px 10px',
                          border: 'none',
                          borderRadius: '4px',
                          backgroundColor: authMode === 'signup' ? '#2e7d32' : '#efebe4',
                          color: authMode === 'signup' ? '#fff' : '#4e342e',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Sign Up
                      </button>
                    </div>
                  </div>

                  {!supabaseConfigured ? (
                    <div style={{
                      backgroundColor: '#fff3e0',
                      border: '1px solid #ffe0b2',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#e65100',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <HelpCircle size={16} />
                      <span>
                        Supabase credentials (<code>VITE_SUPABASE_URL</code> & <code>VITE_SUPABASE_ANON_KEY</code>) are not configured in this environment. The platform will operate in full offline mode.
                      </span>
                    </div>
                  ) : (
                    <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                      <input
                        type="email"
                        placeholder="Owner Email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        style={{
                          flex: '1 1 200px',
                          padding: '8px 12px',
                          borderRadius: '4px',
                          border: '1px solid #bcaaa4',
                          fontSize: '13px'
                        }}
                      />
                      <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        style={{
                          flex: '1 1 180px',
                          padding: '8px 12px',
                          borderRadius: '4px',
                          border: '1px solid #bcaaa4',
                          fontSize: '13px'
                        }}
                      />
                      <button
                        type="submit"
                        disabled={authLoading}
                        style={{
                          padding: '8px 18px',
                          backgroundColor: '#2e7d32',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: authLoading ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {authMode === 'signin' ? <LogIn size={14} /> : <UserPlus size={14} />}
                        {authLoading ? 'Connecting...' : authMode === 'signin' ? 'Connect Account' : 'Register Account'}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* Manual Snapshot Creation */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              alignItems: 'center',
              padding: '14px',
              backgroundColor: '#fff',
              border: '1px solid #d7ccc8',
              borderRadius: '6px',
              marginBottom: '20px'
            }}>
              <input
                type="text"
                placeholder="Optional backup label (e.g. Pre-v1.2 Release)"
                value={backupName}
                onChange={e => setBackupName(e.target.value)}
                style={{
                  flex: '1 1 260px',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid #bcaaa4',
                  fontSize: '13px'
                }}
              />
              <button
                onClick={handleCreateManualBackup}
                disabled={isBackingUp}
                style={{
                  padding: '8px 18px',
                  backgroundColor: '#3e2723',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isBackingUp ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <UploadCloud size={15} />
                {isBackingUp ? 'Generating Snapshot...' : 'Create Backup Snapshot'}
              </button>
            </div>

            {/* Cloud Backups Table */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', color: '#3e2723', fontFamily: 'var(--font-family-display)' }}>
                  Cloud Backups Archive ({cloudBackups.length})
                </h3>
                {syncState.currentUser && (
                  <button
                    onClick={loadBackups}
                    disabled={loadingBackups}
                    style={{ background: 'none', border: 'none', color: '#5d4037', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <RefreshCw size={12} className={loadingBackups ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                )}
              </div>

              {!syncState.currentUser ? (
                <div style={{ textAlign: 'center', padding: '24px 16px', color: '#8d6e63', fontSize: '13px', backgroundColor: '#faf7f2', borderRadius: '6px', border: '1px dashed #d7ccc8' }}>
                  Connect your account to view and restore cloud backups.
                </div>
              ) : cloudBackups.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 16px', color: '#8d6e63', fontSize: '13px', backgroundColor: '#faf7f2', borderRadius: '6px', border: '1px dashed #d7ccc8' }}>
                  No cloud snapshots found for this account. Click "Create Backup Snapshot" or "Sync Now" to create your first cloud archive.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {cloudBackups.map(b => (
                    <div
                      key={b.id}
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        backgroundColor: '#fff',
                        borderRadius: '6px',
                        border: '1px solid #d7ccc8',
                        gap: '12px'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#3e2723' }}>{b.name}</div>
                        <div style={{ fontSize: '11px', color: '#8d6e63', marginTop: '2px' }}>
                          Created: {new Date(b.createdAt).toLocaleString()} | Schema v{b.schemaVersion} ({b.appVersion})
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                          <span style={{ fontSize: '11px', backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '1px 6px', borderRadius: '4px' }}>
                            {b.counts.games} Games
                          </span>
                          <span style={{ fontSize: '11px', backgroundColor: '#e3f2fd', color: '#1565c0', padding: '1px 6px', borderRadius: '4px' }}>
                            {b.counts.projects} Workshop Projects
                          </span>
                          <span style={{ fontSize: '11px', backgroundColor: '#f3e5f5', color: '#7b1fa2', padding: '1px 6px', borderRadius: '4px' }}>
                            {b.counts.gameSaves} Saves
                          </span>
                          <span style={{ fontSize: '11px', backgroundColor: '#fff3e0', color: '#e65100', padding: '1px 6px', borderRadius: '4px' }}>
                            {b.counts.savedPrompts} Prompts
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => setSelectedBackupForRestore(b)}
                          style={{
                            padding: '6px 14px',
                            backgroundColor: '#2e7d32',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <DownloadCloud size={14} /> Restore
                        </button>

                        <button
                          onClick={() => handleDeleteBackup(b.id)}
                          style={{
                            padding: '6px',
                            background: 'none',
                            border: '1px solid #d7ccc8',
                            borderRadius: '4px',
                            color: '#c62828',
                            cursor: 'pointer'
                          }}
                          title="Delete snapshot"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: WORKBENCH PREFERENCES */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-family-display)', marginBottom: '14px', color: '#1f2421' }}>
              Cutting Mat Appearance
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => updatePreferences({ cuttingMatTheme: t.id })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px',
                    borderRadius: '6px',
                    border: preferences.cuttingMatTheme === t.id ? '2px solid #1b4731' : '1px solid #d4c5a9',
                    backgroundColor: preferences.cuttingMatTheme === t.id ? '#eae2d1' : '#f5efe1',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ width: '24px', height: '24px', borderRadius: '4px', backgroundColor: t.bg, border: '1px solid rgba(0,0,0,0.2)' }} />
                  <span style={{ fontSize: '13px', fontWeight: 500 }}>{t.label}</span>
                </button>
              ))}
            </div>

            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={preferences.showRulers}
                  onChange={(e) => updatePreferences({ showRulers: e.target.checked })}
                />
                <span>Show perimeter measurement rulers (cm markings)</span>
              </label>
            </div>
          </div>

          {/* SECTION 3: LOCAL STORAGE INSPECTOR */}
          <div style={{ borderTop: '1px solid #d4c5a9', paddingTop: '24px' }}>
            <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-family-display)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HardDrive size={18} color="#1b4731" />
              <span>Local Storage & IndexedDB Status</span>
            </h3>
            <div style={{ backgroundColor: '#f5efe1', padding: '16px', borderRadius: '6px', border: '1px solid #d4c5a9', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div><strong>IndexedDB:</strong> <code>playbench_db</code> (v3 Active & Healthy)</div>
              <div><strong>Object Stores:</strong> <code>games</code>, <code>projects</code>, <code>game_saves</code>, <code>saved_prompts</code>, <code>import_history</code>, <code>package_files</code>, <code>custom_datasets</code></div>
              <div><strong>LocalStorage:</strong> <code>playbench_prefs_v1</code> (Synchronized)</div>
              <div><strong>Primary Gameplay Mode:</strong> 100% Offline Capable</div>
            </div>
          </div>
        </div>
      </CuttingMat>

      {/* RESTORE CONFIRMATION MODAL */}
      {selectedBackupForRestore && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            border: '2px solid #b71c1c',
            maxWidth: '520px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b71c1c', marginBottom: '14px' }}>
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: '18px' }}>Confirm Destructive Restore</h3>
            </div>

            <p style={{ fontSize: '13px', color: '#424242', lineHeight: '1.5', margin: '0 0 14px 0' }}>
              Restoring snapshot <strong>"{selectedBackupForRestore.name}"</strong> will replace your local games, workshop projects, saved prompts, and game saves with the state from:
              <br />
              <strong>{new Date(selectedBackupForRestore.createdAt).toLocaleString()}</strong>
            </p>

            <div style={{ backgroundColor: '#ffebee', padding: '10px 14px', borderRadius: '4px', fontSize: '12px', color: '#b71c1c', marginBottom: '16px' }}>
              ⚠️ Any unbacked-up changes made locally since this snapshot was taken will be overwritten.
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#424242', marginBottom: '6px' }}>
                Type <strong>RESTORE</strong> to confirm:
              </label>
              <input
                type="text"
                value={restoreConfirmText}
                onChange={e => setRestoreConfirmText(e.target.value)}
                placeholder="RESTORE"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '4px',
                  border: '1px solid #bcaaa4',
                  fontSize: '13px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => {
                  setSelectedBackupForRestore(null);
                  setRestoreConfirmText('');
                }}
                disabled={isRestoring}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRestore}
                disabled={restoreConfirmText !== 'RESTORE' || isRestoring}
                style={{
                  padding: '8px 18px',
                  backgroundColor: restoreConfirmText === 'RESTORE' && !isRestoring ? '#b71c1c' : '#e0e0e0',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: restoreConfirmText === 'RESTORE' && !isRestoring ? 'pointer' : 'not-allowed'
                }}
              >
                {isRestoring ? 'Restoring...' : 'Confirm & Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SYNC CONFLICT RESOLUTION MODAL */}
      {activeConflict && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            border: '2px solid #f57f17',
            maxWidth: '640px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f57f17', marginBottom: '14px' }}>
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: '18px' }}>Sync Conflict Detected</h3>
            </div>

            <p style={{ fontSize: '13px', color: '#424242', lineHeight: '1.5', margin: '0 0 16px 0' }}>
              Both your local browser and cloud backup have changed since the last synchronization. Choose how to resolve this divergence:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
              <div style={{ border: '1px solid #d7ccc8', padding: '12px', borderRadius: '6px', backgroundColor: '#faf7f2' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#3e2723' }}>Local Workbench State</h4>
                <div style={{ fontSize: '12px', color: '#6d4c41' }}>
                  Timestamp: {new Date(activeConflict.localTimestamp).toLocaleTimeString()}
                </div>
                <div style={{ fontSize: '11px', color: '#8d6e63', marginTop: '6px' }}>
                  Games: {activeConflict.localMetadata.counts.games} | Projects: {activeConflict.localMetadata.counts.projects} | Prompts: {activeConflict.localMetadata.counts.savedPrompts}
                </div>
                <button
                  onClick={() => {
                    syncService.resolveConflict('keep-local');
                    setActiveConflict(null);
                    setActionSuccess('Kept local state and updated cloud.');
                  }}
                  style={{
                    marginTop: '12px',
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#2e7d32',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Keep Local (Overwrite Cloud)
                </button>
              </div>

              <div style={{ border: '1px solid #d7ccc8', padding: '12px', borderRadius: '6px', backgroundColor: '#faf7f2' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#3e2723' }}>Remote Cloud State</h4>
                <div style={{ fontSize: '12px', color: '#6d4c41' }}>
                  Timestamp: {new Date(activeConflict.remoteTimestamp).toLocaleTimeString()}
                </div>
                <div style={{ fontSize: '11px', color: '#8d6e63', marginTop: '6px' }}>
                  Games: {activeConflict.remoteMetadata.counts.games} | Projects: {activeConflict.remoteMetadata.counts.projects} | Prompts: {activeConflict.remoteMetadata.counts.savedPrompts}
                </div>
                <button
                  onClick={() => {
                    syncService.resolveConflict('take-remote');
                    setActiveConflict(null);
                    setActionSuccess('Applied remote cloud state to local workbench.');
                    setTimeout(() => window.location.reload(), 1500);
                  }}
                  style={{
                    marginTop: '12px',
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#1565c0',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Take Remote (Overwrite Local)
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <button
                onClick={() => {
                  syncService.resolveConflict('cancel');
                  setActiveConflict(null);
                }}
                style={{
                  padding: '6px 14px',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Cancel Sync
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
