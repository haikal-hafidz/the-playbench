import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Gamepad2,
  Users,
  Vote,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
  LogOut,
  Award
} from 'lucide-react';
import { multiplayerService } from '../../services/multiplayer';
import {
  MultiplayerSession,
  SessionParticipant,
  SessionGameState,
  VotingRound,
} from '../../types/multiplayer';

export const PlayerExperiencePage: React.FC = () => {
  const { code: urlCode } = useParams<{ code?: string }>();
  const navigate = useNavigate();

  const [sessionCode, setSessionCode] = useState(urlCode || '');
  const [playerName, setPlayerName] = useState('');
  const [activeSession, setActiveSession] = useState<MultiplayerSession | null>(null);
  const [currentParticipant, setCurrentParticipant] = useState<SessionParticipant | null>(null);
  const [gameState, setGameState] = useState<SessionGameState | null>(null);
  const [activeVotingRound, setActiveVotingRound] = useState<VotingRound | null>(null);
  const [selectedVoteOption, setSelectedVoteOption] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state if session exists
  const refreshPlayerData = () => {
    const session = multiplayerService.getActiveSession();
    const participant = multiplayerService.getCurrentParticipant();
    setActiveSession(session);
    setCurrentParticipant(participant);

    if (session) {
      const data = multiplayerService.getSessionData(session.id);
      if (data) {
        setGameState(data.gameState);
        const openRound = data.votingRounds.find((r) => r.status === 'open');
        setActiveVotingRound(openRound || null);

        if (openRound && participant) {
          const myVote = data.votes.find(
            (v) => v.voting_round_id === openRound.id && v.participant_id === participant.id
          );
          if (myVote) {
            setHasVoted(true);
            setSelectedVoteOption(myVote.option_id);
          } else {
            setHasVoted(false);
            setSelectedVoteOption(null);
          }
        }
      }
    }
  };

  useEffect(() => {
    if (urlCode && !sessionCode) {
      setSessionCode(urlCode.toUpperCase());
    }

    // Only restore active session if participant role is player
    const currentPart = multiplayerService.getCurrentParticipant();
    if (currentPart && currentPart.role === 'player') {
      refreshPlayerData();
    }

    const unsubscribe = multiplayerService.subscribe(() => {
      const p = multiplayerService.getCurrentParticipant();
      if (p && p.role === 'player') {
        refreshPlayerData();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [urlCode]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { session, participant } = await multiplayerService.joinSession(
        sessionCode,
        playerName
      );
      setActiveSession(session);
      setCurrentParticipant(participant);
      refreshPlayerData();
    } catch (err: any) {
      setError(err.message || 'Failed to join session');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVote = async (optionId: string) => {
    if (!activeSession || !activeVotingRound || !currentParticipant) return;
    setError(null);
    try {
      await multiplayerService.submitVote(
        activeSession.id,
        activeVotingRound.id,
        currentParticipant.id,
        optionId
      );
      setSelectedVoteOption(optionId);
      setHasVoted(true);
      refreshPlayerData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLeaveSession = () => {
    multiplayerService.clearActiveSession();
    setActiveSession(null);
    setCurrentParticipant(null);
    setGameState(null);
    setActiveVotingRound(null);
    navigate('/play');
  };

  return (
    <div
      style={{
        maxWidth: '680px',
        margin: '0 auto',
        padding: '24px 16px',
        color: '#fcf8ee',
      }}
    >
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#1b4731',
            color: '#e8c872',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
            marginBottom: '8px',
          }}
        >
          <Gamepad2 size={16} />
          <span>Player Portal</span>
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-family-display)',
            fontSize: '26px',
            margin: '4px 0',
          }}
        >
          {activeSession ? activeSession.game_title : 'Join Multiplayer Session'}
        </h1>
        <p style={{ color: '#b0a695', fontSize: '13px', margin: 0 }}>
          {activeSession
            ? `Playing as ${currentParticipant?.player_name}`
            : 'Enter the session code provided by your workbench Host.'}
        </p>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: '#451a1a',
            border: '1px solid #752828',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#fecaca',
            fontSize: '13px',
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Join Screen */}
      {!activeSession ? (
        <form
          onSubmit={handleJoin}
          style={{
            backgroundColor: '#261e17',
            border: '2px solid #4a3828',
            borderRadius: '12px',
            padding: '28px 24px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#d0c6b6', marginBottom: '6px' }}>
              Session Code
            </label>
            <input
              type="text"
              required
              maxLength={8}
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
              placeholder="e.g. AB12CD"
              style={{
                width: '100%',
                padding: '12px 14px',
                backgroundColor: '#1b1612',
                border: '1px solid #4a3828',
                borderRadius: '8px',
                color: '#e8c872',
                fontSize: '18px',
                fontWeight: 700,
                letterSpacing: '2px',
                textAlign: 'center',
                textTransform: 'uppercase',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#d0c6b6', marginBottom: '6px' }}>
              Your Display Name
            </label>
            <input
              type="text"
              required
              maxLength={25}
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="e.g. CraftyFox"
              style={{
                width: '100%',
                padding: '12px 14px',
                backgroundColor: '#1b1612',
                border: '1px solid #4a3828',
                borderRadius: '8px',
                color: '#fcf8ee',
                fontSize: '15px',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              backgroundColor: '#1b4731',
              color: '#e8c872',
              border: '1px solid #2d6a45',
              borderRadius: '8px',
              padding: '14px',
              fontSize: '16px',
              fontWeight: 700,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              marginTop: '6px',
            }}
          >
            <Sparkles size={18} />
            <span>{isSubmitting ? 'Joining Session...' : 'Enter Waiting Room'}</span>
          </button>
        </form>
      ) : (
        /* In-Session Experience */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Top Status Strip */}
          <div
            style={{
              backgroundColor: '#261e17',
              border: '1px solid #4a3828',
              borderRadius: '8px',
              padding: '10px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#34d399',
                }}
              />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Room: {activeSession.code}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#e8c872', fontSize: '13px', fontWeight: 600 }}>
                <Award size={14} />
                <span>{gameState?.scores?.[currentParticipant?.id || ''] || 0} pts</span>
              </div>

              <button
                onClick={handleLeaveSession}
                title="Leave Session"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#b0a695',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                }}
              >
                <LogOut size={13} />
                <span>Leave</span>
              </button>
            </div>
          </div>

          {/* Waiting Room state */}
          {activeSession.status === 'waiting' && (
            <div
              style={{
                backgroundColor: '#1f1914',
                border: '2px dashed #4a3828',
                borderRadius: '12px',
                padding: '36px 20px',
                textAlign: 'center',
              }}
            >
              <Users size={44} color="#e8c872" style={{ margin: '0 auto 16px auto' }} />
              <h2 style={{ fontSize: '20px', margin: '0 0 8px 0', color: '#fcf8ee' }}>
                You're in the Waiting Room!
              </h2>
              <p style={{ color: '#b0a695', fontSize: '14px', maxWidth: '400px', margin: '0 auto 20px auto', lineHeight: 1.5 }}>
                Waiting for the Host to start the game. Keep this window open and listen for instructions.
              </p>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#132117',
                  border: '1px solid #203f29',
                  borderRadius: '20px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  color: '#8fad91',
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#34d399' }} />
                <span>Connected & Ready</span>
              </div>
            </div>
          )}

          {/* Active Gameplay or Voting */}
          {activeSession.status !== 'waiting' && (
            <div
              style={{
                backgroundColor: '#261e17',
                border: '2px solid #4a3828',
                borderRadius: '12px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
              }}
            >
              {activeVotingRound ? (
                /* Interactive Voting Station */
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e8c872', fontSize: '13px', fontWeight: 600 }}>
                      <Vote size={16} />
                      <span>Live Voting Prompt</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#b0a695', fontSize: '12px' }}>
                      <Clock size={13} />
                      <span>{activeVotingRound.duration_seconds}s limit</span>
                    </div>
                  </div>

                  <h3
                    style={{
                      fontFamily: 'var(--font-family-display)',
                      fontSize: '19px',
                      color: '#fcf8ee',
                      margin: '0 0 16px 0',
                      lineHeight: 1.4,
                    }}
                  >
                    {activeVotingRound.prompt}
                  </h3>

                  {/* Options */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {activeVotingRound.options.map((opt) => {
                      const isSelected = selectedVoteOption === opt.id;
                      return (
                        <button
                          key={opt.id}
                          disabled={hasVoted}
                          onClick={() => handleVote(opt.id)}
                          style={{
                            padding: '14px 18px',
                            backgroundColor: isSelected ? '#1b4731' : '#1b1612',
                            border: isSelected ? '2px solid #34d399' : '1px solid #4a3828',
                            borderRadius: '8px',
                            color: isSelected ? '#fcf8ee' : '#d0c6b6',
                            fontSize: '15px',
                            fontWeight: 600,
                            textAlign: 'left',
                            cursor: hasVoted ? 'default' : 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span>{opt.text}</span>
                          {isSelected && <CheckCircle size={18} color="#34d399" />}
                        </button>
                      );
                    })}
                  </div>

                  {hasVoted && (
                    <div
                      style={{
                        marginTop: '16px',
                        padding: '12px',
                        backgroundColor: '#162e20',
                        border: '1px solid #2d6a45',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#86efac',
                        fontSize: '13px',
                      }}
                    >
                      <CheckCircle size={16} />
                      <span>Vote submitted! Waiting for Host to close the round and tally results.</span>
                    </div>
                  )}
                </div>
              ) : (
                /* General Gameplay Phase */
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <Sparkles size={36} color="#e8c872" style={{ margin: '0 auto 12px auto' }} />
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#fcf8ee' }}>
                    {gameState?.prompt || 'Round in Progress'}
                  </h3>
                  <p style={{ color: '#b0a695', fontSize: '13px', margin: 0 }}>
                    Watch the Host screen and prepare for the next round.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
