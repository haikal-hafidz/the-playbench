import React from 'react';
import { Shield, Gamepad2, ArrowRight, Layers, Hammer, Sliders, Users, Vote, Sparkles } from 'lucide-react';
import { UserRole } from '../../services/storage/preferences';

interface RoleSelectionScreenProps {
  onSelectRole: (role: UserRole) => void;
}

export const RoleSelectionScreen: React.FC<RoleSelectionScreenProps> = ({ onSelectRole }) => {
  return (
    <div
      style={{
        minHeight: '100vh',
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
        padding: '32px 20px',
        boxSizing: 'border-box',
        color: '#fcf8ee',
      }}
    >
      {/* Brand Identity */}
      <div style={{ textAlign: 'center', marginBottom: '36px', maxWidth: '640px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            backgroundColor: '#1b4731',
            border: '2px solid #e8c872',
            borderRadius: '12px',
            marginBottom: '16px',
            boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
          }}
        >
          <span style={{ fontSize: '28px' }}>🎲</span>
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-family-display)',
            fontSize: '32px',
            margin: '0 0 8px 0',
            fontWeight: 800,
            letterSpacing: '0.5px',
          }}
        >
          Welcome to The Playbench
        </h1>
        <p
          style={{
            color: '#b0a695',
            fontFamily: 'var(--font-family-craft)',
            fontSize: '15px',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          A little workshop for little games. Choose your role to enter the workbench.
        </p>
      </div>

      {/* Role Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 420px))',
          gap: '28px',
          width: '100%',
          maxWidth: '880px',
        }}
      >
        {/* HOST CARD */}
        <div
          onClick={() => onSelectRole('host')}
          style={{
            backgroundColor: '#261e17',
            border: '2px solid #4a3828',
            borderRadius: '14px',
            padding: '32px 28px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#e8c872';
            e.currentTarget.style.transform = 'translateY(-4px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#4a3828';
            e.currentTarget.style.transform = 'none';
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#1b4731',
                color: '#e8c872',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '16px',
              }}
            >
              <Shield size={14} />
              <span>Host Workbench</span>
            </div>

            <h2
              style={{
                fontFamily: 'var(--font-family-display)',
                fontSize: '24px',
                margin: '0 0 10px 0',
                color: '#fcf8ee',
              }}
            >
              Enter as Host
            </h2>

            <p style={{ color: '#d0c6b6', fontSize: '13px', lineHeight: 1.6, marginBottom: '20px' }}>
              Full creative workspace ownership. Manage your game collection, craft new micro-games in Workshop, configure settings, and host multiplayer sessions with friends.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b0a695', fontSize: '12px' }}>
                <Layers size={14} color="#e8c872" />
                <span>Full Game Collection Management & Deletion</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b0a695', fontSize: '12px' }}>
                <Hammer size={14} color="#e8c872" />
                <span>Workshop Letters & Prompt Station</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b0a695', fontSize: '12px' }}>
                <Sliders size={14} color="#e8c872" />
                <span>Cloud Backup, Sync & Preferences</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b0a695', fontSize: '12px' }}>
                <Users size={14} color="#e8c872" />
                <span>Multiplayer Lobby & Game-Selection Session Host</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onSelectRole('host')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              backgroundColor: '#1b4731',
              color: '#e8c872',
              border: '1px solid #2d6a45',
              borderRadius: '8px',
              padding: '12px 18px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <span>Open Host Workbench</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {/* PLAYER CARD */}
        <div
          onClick={() => onSelectRole('player')}
          style={{
            backgroundColor: '#261e17',
            border: '2px solid #4a3828',
            borderRadius: '14px',
            padding: '32px 28px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#34d399';
            e.currentTarget.style.transform = 'translateY(-4px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#4a3828';
            e.currentTarget.style.transform = 'none';
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#132117',
                color: '#34d399',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '16px',
              }}
            >
              <Gamepad2 size={14} />
              <span>Player Experience</span>
            </div>

            <h2
              style={{
                fontFamily: 'var(--font-family-display)',
                fontSize: '24px',
                margin: '0 0 10px 0',
                color: '#fcf8ee',
              }}
            >
              Enter as Player
            </h2>

            <p style={{ color: '#d0c6b6', fontSize: '13px', lineHeight: 1.6, marginBottom: '20px' }}>
              Join a multiplayer session with friends using a room code. View available games from the Host's collection, vote for what you want to play, and launch straight into the winning game!
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b0a695', fontSize: '12px' }}>
                <Users size={14} color="#34d399" />
                <span>Join Active Sessions with 6-char Room Code</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b0a695', fontSize: '12px' }}>
                <Vote size={14} color="#34d399" />
                <span>Browse Host Games & Cast Your Single Vote</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b0a695', fontSize: '12px' }}>
                <Sparkles size={14} color="#34d399" />
                <span>Switch Votes Anytime Before Voting Closes</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b0a695', fontSize: '12px' }}>
                <Gamepad2 size={14} color="#34d399" />
                <span>Synchronized Launch into Winning Game Space</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onSelectRole('player')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              backgroundColor: '#132117',
              color: '#34d399',
              border: '1px solid #203f29',
              borderRadius: '8px',
              padding: '12px 18px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <span>Enter Player Portal</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
