import React, { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface DeskSectionProps {
  title: string;
  badge?: string;
  icon?: LucideIcon;
  children: ReactNode;
}

export const DeskSection: React.FC<DeskSectionProps> = ({ title, badge, icon: Icon, children }) => {
  return (
    <section style={{ marginBottom: '32px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '14px',
        borderBottom: '1px dashed rgba(232, 200, 114, 0.3)',
        paddingBottom: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {Icon && <Icon size={18} color="#e8c872" />}
          <h2 style={{
            fontSize: '17px',
            fontFamily: 'var(--font-family-display)',
            fontWeight: 700,
            color: '#fcf8ee',
            letterSpacing: '0.4px',
          }}>
            {title}
          </h2>
        </div>
        {badge && (
          <span style={{
            fontSize: '11px',
            fontFamily: 'var(--font-family-craft)',
            backgroundColor: 'rgba(0,0,0,0.3)',
            color: '#e8c872',
            padding: '2px 8px',
            borderRadius: '12px',
            border: '1px solid rgba(232, 200, 114, 0.3)',
          }}>
            {badge}
          </span>
        )}
      </div>
      {children}
    </section>
  );
};
