import React from 'react';
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react';

interface AppLoadingScreenProps {
  statusMessage?: string;
  error?: string | null;
  onRetry?: () => void;
}

export const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({
  statusMessage = 'Preparing workbench surface...',
  error = null,
  onRetry,
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#1b1612',
        backgroundImage: `
          radial-gradient(#2d231a 15%, transparent 16%),
          radial-gradient(#2d231a 15%, transparent 16%)
        `,
        backgroundSize: '40px 40px',
        backgroundPosition: '0 0, 20px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '24px',
      }}
    >
      <div
        style={{
          backgroundColor: '#261e17',
          border: '2px solid #4a3828',
          borderRadius: '12px',
          padding: '36px 48px',
          maxWidth: '460px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
        }}
      >
        {/* Bench Logo Badge */}
        <div
          style={{
            width: '64px',
            height: '64px',
            backgroundColor: '#1b4731',
            border: '2px solid #e8c872',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          <span style={{ fontSize: '32px' }}>🎲</span>
        </div>

        <div>
          <h1
            style={{
              color: '#fcf8ee',
              fontFamily: 'var(--font-family-display)',
              fontSize: '24px',
              margin: '0 0 4px 0',
              fontWeight: 700,
            }}
          >
            The Playbench
          </h1>
          <p
            style={{
              color: '#b0a695',
              fontFamily: 'var(--font-family-craft)',
              fontSize: '13px',
              margin: 0,
            }}
          >
            A little workshop for little games
          </p>
        </div>

        {error ? (
          <div
            style={{
              backgroundColor: '#401818',
              border: '1px solid #752828',
              borderRadius: '8px',
              padding: '16px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <AlertCircle size={28} color="#fca5a5" />
            <div style={{ color: '#fef2f2', fontSize: '13px', lineHeight: 1.5 }}>
              {error}
            </div>
            {onRetry && (
              <button
                onClick={onRetry}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#752828',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={14} />
                <span>Retry Workbench Setup</span>
              </button>
            )}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px',
              marginTop: '8px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                border: '3px solid #3d2f24',
                borderTopColor: '#e8c872',
                borderRadius: '50%',
                animation: 'bench-spin 1s linear infinite',
              }}
            />
            <div
              style={{
                color: '#e8c872',
                fontFamily: 'var(--font-family-craft)',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Sparkles size={14} />
              <span>{statusMessage}</span>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes bench-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
