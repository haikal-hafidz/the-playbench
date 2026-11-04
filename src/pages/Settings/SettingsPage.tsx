import React from 'react';
import { Sliders, HardDrive, ShieldAlert, Cloud } from 'lucide-react';
import { CuttingMat } from '../../components/desk/CuttingMat';
import { usePreferences } from '../../hooks/usePreferences';
import { CuttingMatTheme } from '../../types';

export const SettingsPage: React.FC = () => {
  const { preferences, updatePreferences } = usePreferences();

  const themes: { id: CuttingMatTheme; label: string; bg: string }[] = [
    { id: 'classic-green', label: 'Classic Cutting Green', bg: '#1b4731' },
    { id: 'deep-forest', label: 'Deep Forest', bg: '#123824' },
    { id: 'blueprint-blue', label: 'Blueprint Drafting Blue', bg: '#163e5c' },
    { id: 'slate-charcoal', label: 'Slate Charcoal', bg: '#23282e' },
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px 48px 20px' }}>
      <CuttingMat>
        <div style={{
          backgroundColor: 'var(--color-paper-card)',
          borderRadius: '8px',
          border: '1px solid var(--color-paper-border)',
          boxShadow: 'var(--shadow-desk-card)',
          padding: '32px',
          color: 'var(--color-ink-primary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #d4c5a9', paddingBottom: '18px', marginBottom: '24px' }}>
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
                Settings & Persistence
              </h1>
              <p style={{ fontSize: '13px', color: '#535c56', marginTop: '2px' }}>
                Workbench preferences, local storage inspector, and cloud sync settings.
              </p>
            </div>
          </div>

          {/* Preferences Section */}
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

          {/* Local Storage Status */}
          <div style={{ marginBottom: '32px', borderTop: '1px solid #d4c5a9', paddingTop: '24px' }}>
            <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-family-display)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HardDrive size={18} color="#1b4731" />
              <span>Local Storage & IndexedDB Status</span>
            </h3>
            <div style={{ backgroundColor: '#f5efe1', padding: '16px', borderRadius: '6px', border: '1px solid #d4c5a9', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div><strong>IndexedDB:</strong> <code>playbench_db</code> (Active & Healthy)</div>
              <div><strong>LocalStorage:</strong> <code>playbench_prefs_v1</code> (Synchronized)</div>
              <div><strong>Primary Gameplay Mode:</strong> 100% Offline Capable</div>
            </div>
          </div>

          {/* Supabase Backup Section (Planned) */}
          <div style={{ borderTop: '1px solid #d4c5a9', paddingTop: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Cloud size={18} color="#163e5c" />
              <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-family-display)', margin: 0 }}>
                Cloud Backup (Supabase) — Stage 6 Planned
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: '#535c56', marginBottom: '12px' }}>
              Owner-only encrypted cloud backup will be introduced in Stage 6. Public visitors playing games on the shared URL will remain isolated and will never have access to private owner data.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontFamily: 'var(--font-family-craft)', color: '#7a5a1f', backgroundColor: '#fff3cd', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ffeeba' }}>
              <ShieldAlert size={14} />
              <span>Security Rule: Service-role credentials are strictly prohibited in client bundles.</span>
            </div>
          </div>
        </div>
      </CuttingMat>
    </div>
  );
};
