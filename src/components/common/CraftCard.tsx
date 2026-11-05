import React, { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface CraftCardProps {
  title?: string;
  tagline?: string;
  badge?: string;
  icon?: LucideIcon;
  actionText?: string;
  onAction?: () => void;
  children?: ReactNode;
  pinColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const CraftCard: React.FC<CraftCardProps> = ({
  title,
  tagline,
  badge,
  icon: Icon,
  actionText,
  onAction,
  children,
  pinColor,
  style,
}) => {
  return (
    <div
      className="craft-card"
      style={{
        padding: '20px',
        color: 'var(--color-ink-primary)',
        ...style,
      }}
    >
      {/* Brass fastener accent */}
      <div
        className="brass-fastener"
        style={{
          top: '10px',
          right: '10px',
          backgroundColor: pinColor || undefined
        }}
      />

      {(title || Icon || badge) && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {Icon && (
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                backgroundColor: 'rgba(27, 71, 49, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#1b4731'
              }}>
                <Icon size={18} />
              </div>
            )}
            <div>
              {title && (
                <h3 style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-family-display)',
                  color: '#1e2420',
                  margin: 0
                }}>
                  {title}
                </h3>
              )}
              {tagline && (
                <p style={{
                  fontSize: '12px',
                  color: '#656e66',
                  margin: '2px 0 0 0'
                }}>
                  {tagline}
                </p>
              )}
            </div>
          </div>
          {badge && (
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-family-craft)',
              backgroundColor: '#e8dcbe',
              color: '#4a3d24',
              padding: '2px 6px',
              borderRadius: '4px',
              fontWeight: 600,
              marginRight: '14px'
            }}>
              {badge}
            </span>
          )}
        </div>
      )}

      {children && (
        <div style={{ marginTop: '12px' }}>
          {children}
        </div>
      )}

      {actionText && (
        <button
          onClick={onAction}
          style={{
            marginTop: '16px',
            width: '100%',
            backgroundColor: '#1b4731',
            color: '#fcf8ee',
            padding: '8px 14px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#143826')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1b4731')}
        >
          <span>{actionText}</span>
        </button>
      )}
    </div>
  );
};
