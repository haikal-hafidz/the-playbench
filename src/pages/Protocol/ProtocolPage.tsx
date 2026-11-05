import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScrollText, ArrowLeft, Copy, Check, ShieldCheck, Box } from 'lucide-react';
import { CuttingMat } from '../../components/desk/CuttingMat';

export const ProtocolPage: React.FC = () => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const manifestExample = `{
  "$schema": "https://playbench.dev/schemas/tpgp-v1.json",
  "tpgpVersion": "1.0.0",
  "id": "matchstick-puzzle",
  "title": "Matchstick Puzzle",
  "tagline": "Arrange wood matchsticks to solve geometric equations.",
  "version": "1.0.0",
  "runtime": {
    "type": "iframe-bundle",
    "entrypoint": "index.html",
    "aspectRatio": "16:9"
  },
  "players": {
    "min": 1,
    "max": 1,
    "type": "solo"
  },
  "categories": ["puzzle", "tabletop"],
  "tags": ["matches", "logic"],
  "capabilities": {
    "offline": true,
    "audio": true,
    "touch": true
  }
}`;

  const copyManifest = () => {
    navigator.clipboard.writeText(manifestExample);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px 48px 20px' }}>
      <CuttingMat>
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: '#e8c872',
            fontSize: '13px',
            marginBottom: '18px',
            padding: '4px 10px',
            backgroundColor: 'rgba(0,0,0,0.25)',
            borderRadius: '4px',
          }}
        >
          <ArrowLeft size={14} />
          <span>Back to The Desk</span>
        </button>

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
              <ScrollText size={24} />
            </div>
            <div>
              <h1 style={{ fontFamily: 'var(--font-family-display)', fontSize: '24px', fontWeight: 700, margin: 0 }}>
                TPGP Standard — The Playbench Game Package
              </h1>
              <p style={{ fontSize: '13px', color: '#535c56', marginTop: '2px' }}>
                Official specification v1.0.0 for framework-agnostic micro-game distribution.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ backgroundColor: '#f5efe1', padding: '16px', borderRadius: '6px', border: '1px solid #d4c5a9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, marginBottom: '6px', color: '#1b4731' }}>
                <Box size={16} />
                <span>Framework Independent</span>
              </div>
              <p style={{ fontSize: '12px', color: '#535c56', margin: 0 }}>
                Write games in Canvas, HTML5, Phaser, Pixi, or WebAssembly. The Playbench runs them all.
              </p>
            </div>

            <div style={{ backgroundColor: '#f5efe1', padding: '16px', borderRadius: '6px', border: '1px solid #d4c5a9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, marginBottom: '6px', color: '#1b4731' }}>
                <ShieldCheck size={16} />
                <span>Isolated Security Sandbox</span>
              </div>
              <p style={{ fontSize: '12px', color: '#535c56', margin: 0 }}>
                Restricted iframe environment ensures game scripts cannot touch host cookies or storage.
              </p>
            </div>
          </div>

          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '15px', fontFamily: 'var(--font-family-display)', margin: 0 }}>
              Example Manifest: <code>tpgp.json</code>
            </h3>
            <button
              onClick={copyManifest}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#1b4731',
                color: '#fcf8ee',
                fontSize: '12px',
                padding: '6px 12px',
                borderRadius: '4px',
                fontWeight: 600,
              }}
            >
              {copied ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
              <span>{copied ? 'Copied!' : 'Copy Manifest'}</span>
            </button>
          </div>

          <pre style={{
            backgroundColor: '#1a1613',
            color: '#fcf8ee',
            padding: '18px',
            borderRadius: '6px',
            overflowX: 'auto',
            fontSize: '12px',
            fontFamily: 'var(--font-family-craft)',
            lineHeight: 1.5,
          }}>
            {manifestExample}
          </pre>
        </div>
      </CuttingMat>
    </div>
  );
};
