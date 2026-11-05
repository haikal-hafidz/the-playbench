import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Sparkles,
  Layers,
  Hammer,
  Gamepad2,
  Upload,
  Terminal,
  ScrollText,
  Sliders,
  Menu,
  X,
  WifiOff,
  Database
} from 'lucide-react';
import { usePreferences } from '../../hooks/usePreferences';

export const WorkbenchHeader: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { preferences, updatePreferences } = usePreferences();
  const [isOnline] = useState(navigator.onLine);

  const navItems = [
    { to: '/', label: 'The Desk', icon: Sparkles },
    { to: '/collection', label: 'Collection', icon: Layers },
    { to: '/workshop', label: 'Workshop', icon: Hammer },
    { to: '/gamespace', label: 'Game Space', icon: Gamepad2 },
    { to: '/import', label: 'Import', icon: Upload },
    { to: '/prompts', label: 'Prompts', icon: Terminal },
    { to: '/protocol', label: 'Protocol', icon: ScrollText },
    { to: '/settings', label: 'Settings', icon: Sliders },
  ];

  return (
    <header className="workbench-header" style={{
      backgroundColor: '#1b1612',
      borderBottom: '3px solid #3d2f24',
      boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{
        maxWidth: '1440px',
        margin: '0 auto',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Brand identity */}
        <NavLink to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            backgroundColor: '#1b4731',
            border: '2px solid #e8c872',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
          }}>
            <span style={{ fontSize: '18px' }}>🎲</span>
          </div>
          <div>
            <div style={{
              color: '#fcf8ee',
              fontWeight: 700,
              fontSize: '18px',
              letterSpacing: '0.5px',
              fontFamily: 'var(--font-family-display)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              The Playbench
              <span style={{
                fontSize: '10px',
                fontFamily: 'var(--font-family-craft)',
                backgroundColor: '#2d6a45',
                color: '#e8c872',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 600,
              }}>v0.1</span>
            </div>
            <div style={{
              color: '#b0a695',
              fontSize: '11px',
              fontFamily: 'var(--font-family-craft)',
              marginTop: '1px'
            }}>
              A little workshop for little games
            </div>
          </div>
        </NavLink>

        {/* Desktop Navigation */}
        <nav className="desktop-nav" style={{
          display: 'flex',
          gap: '4px',
          alignItems: 'center',
        }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: isActive ? '#fcf8ee' : '#c5bcab',
                  backgroundColor: isActive ? '#2d231a' : 'transparent',
                  border: isActive ? '1px solid #4d3d2c' : '1px solid transparent',
                  transition: 'all 0.15s ease',
                })}
              >
                <Icon size={15} style={{ opacity: 0.9 }} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Workbench Quick Status & Mat Theme Selector */}
        <div className="header-status" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          {/* Mat Theme Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: '#14100d',
            padding: '3px 6px',
            borderRadius: '20px',
            border: '1px solid #33261c',
          }}>
            <button
              title="Classic Green Mat"
              onClick={() => updatePreferences({ cuttingMatTheme: 'classic-green' })}
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: '#1b4731',
                border: preferences.cuttingMatTheme === 'classic-green' ? '2px solid #e8c872' : '1px solid rgba(255,255,255,0.3)',
              }}
            />
            <button
              title="Deep Forest Mat"
              onClick={() => updatePreferences({ cuttingMatTheme: 'deep-forest' })}
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: '#123824',
                border: preferences.cuttingMatTheme === 'deep-forest' ? '2px solid #e8c872' : '1px solid rgba(255,255,255,0.3)',
              }}
            />
            <button
              title="Blueprint Blue Mat"
              onClick={() => updatePreferences({ cuttingMatTheme: 'blueprint-blue' })}
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: '#163e5c',
                border: preferences.cuttingMatTheme === 'blueprint-blue' ? '2px solid #e8c872' : '1px solid rgba(255,255,255,0.3)',
              }}
            />
            <button
              title="Slate Charcoal Mat"
              onClick={() => updatePreferences({ cuttingMatTheme: 'slate-charcoal' })}
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: '#23282e',
                border: preferences.cuttingMatTheme === 'slate-charcoal' ? '2px solid #e8c872' : '1px solid rgba(255,255,255,0.3)',
              }}
            />
          </div>

          {/* Local IndexedDB status */}
          <div
            title="Local IndexedDB Active"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11px',
              fontFamily: 'var(--font-family-craft)',
              color: '#8fad91',
              backgroundColor: '#132117',
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid #203f29',
            }}
          >
            <Database size={12} color="#34d399" />
            <span>Local DB</span>
          </div>

          {!isOnline && (
            <div
              title="Offline Ready"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontFamily: 'var(--font-family-craft)',
                color: '#e8c872',
                backgroundColor: '#382b13',
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid #574116',
              }}
            >
              <WifiOff size={12} />
              <span>Offline</span>
            </div>
          )}

          {/* Mobile hamburger button */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
            style={{
              color: '#fcf8ee',
              padding: '6px',
              display: 'none',
            }}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="mobile-drawer" style={{
          backgroundColor: '#1b1612',
          borderTop: '1px solid #33261c',
          padding: '12px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMobileMenuOpen(false)}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: isActive ? '#e8c872' : '#e0d8cb',
                  backgroundColor: isActive ? '#2b2118' : 'transparent',
                })}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      )}

      {/* Responsive media query overrides injected inline for zero-runtime issues */}
      <style>{`
        @media (max-width: 900px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: block !important; }
        }
      `}</style>
    </header>
  );
};
