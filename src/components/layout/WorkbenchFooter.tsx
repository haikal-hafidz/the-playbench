import React from 'react';
import { NavLink } from 'react-router-dom';
import { Compass, HelpCircle, HardDrive, ShieldCheck } from 'lucide-react';

export const WorkbenchFooter: React.FC = () => {
  return (
    <footer style={{
      backgroundColor: '#15110e',
      borderTop: '2px solid #2e231b',
      color: '#9c9182',
      padding: '24px 20px',
      fontSize: '12px',
      fontFamily: 'var(--font-family-body)',
      marginTop: 'auto',
    }}>
      <div style={{
        maxWidth: '1440px',
        margin: '0 auto',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px' }}>📐</span>
          <span style={{ fontWeight: 600, color: '#e8c872' }}>The Playbench</span>
          <span>— A little workshop for little games.</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
          <NavLink to="/protocol" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#b5ab9d' }}>
            <Compass size={14} />
            <span>TPGP Standard</span>
          </NavLink>
          <NavLink to="/settings" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#b5ab9d' }}>
            <HardDrive size={14} />
            <span>Storage & Persistence</span>
          </NavLink>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#7e9684' }}>
            <ShieldCheck size={14} />
            <span>Client Isolated Sandbox</span>
          </span>
          <a
            href="https://github.com/haikal-hafidz/the-playbench"
            target="_blank"
            rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#b5ab9d' }}
          >
            <HelpCircle size={14} />
            <span>GitHub Repository</span>
          </a>
        </div>
      </div>
    </footer>
  );
};
