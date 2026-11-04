import React from 'react';
import { LucideIcon, PlusCircle, ArrowRight } from 'lucide-react';

interface IntentionalEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export const IntentionalEmptyState: React.FC<IntentionalEmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
}) => {
  return (
    <div style={{
      border: '2px dashed rgba(232, 200, 114, 0.4)',
      backgroundColor: 'rgba(15, 30, 22, 0.45)',
      borderRadius: '8px',
      padding: '32px 24px',
      textAlign: 'center',
      backdropFilter: 'blur(2px)',
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        backgroundColor: 'rgba(232, 200, 114, 0.12)',
        border: '1px solid rgba(232, 200, 114, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 14px auto',
        color: '#e8c872',
      }}>
        <Icon size={24} />
      </div>

      <h3 style={{
        fontFamily: 'var(--font-family-display)',
        fontSize: '16px',
        fontWeight: 700,
        color: '#fcf8ee',
        marginBottom: '6px',
      }}>
        {title}
      </h3>

      <p style={{
        fontSize: '13px',
        color: '#d0c8b8',
        maxWidth: '460px',
        margin: '0 auto 18px auto',
        lineHeight: 1.5,
      }}>
        {description}
      </p>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {primaryActionLabel && onPrimaryAction && (
          <button
            onClick={onPrimaryAction}
            style={{
              backgroundColor: '#e8c872',
              color: '#1b1612',
              fontWeight: 600,
              fontSize: '13px',
              padding: '8px 16px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            <PlusCircle size={15} />
            <span>{primaryActionLabel}</span>
          </button>
        )}

        {secondaryActionLabel && onSecondaryAction && (
          <button
            onClick={onSecondaryAction}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: '#fcf8ee',
              fontWeight: 500,
              fontSize: '13px',
              padding: '8px 14px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>{secondaryActionLabel}</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
