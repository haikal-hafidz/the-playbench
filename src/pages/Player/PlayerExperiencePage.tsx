import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Gamepad2,
  Vote,
  CheckCircle,
  AlertCircle,
  Sparkles,
  LogOut,
  Crown
} from 'lucide-react';
import { multiplayerService } from '../../services/multiplayer';
import { Game } from '../../types';
import {
  MultiplayerSession,
  SessionParticipant,
  GameSelectionVotingState,
  GameVote,
} from '../../types/multiplayer';

export const PlayerExperiencePage: React.FC = () => {
  const { code: urlCode } = useParams<{ code?: string }>();
  const navigate = useNavigate();

  const [sessionCode, setSessionCode] = useState(urlCode || '');
  const [playerName, setPlayerName] = useState('');
  const [activeSession, setActiveSession] = useState<MultiplayerSession | null>(null);
  const [currentParticipant, setCurrentParticipant] = useState<SessionParticipant | null>(null);
  const [availableGames, setAvailableGames] = useState<Game[]>([]);
  const [votingState, setVotingState] = useState<GameSelectionVotingState | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
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
        setAvailableGames(data.availableGames);
        setVotingState(data.votingState);

        // Check which game this participant voted for
        if (participant) {
          const myVote = data.votes.find((v: GameVote) => v.participant_id === participant.id);
          if (myVote) {
            setSelectedGameId(myVote.game_id);
          }
        }

        // If game started by Host, navigate to Game Space
        if (session.status === 'in-progress' && session.winning_game_id) {
          navigate(`/gamespace/${session.winning_game_id}`);
        }
      }
    }
  };

  useEffect(() => {
    if (urlCode && !sessionCode) {
      setSessionCode(urlCode.toUpperCase());
    }

    const currentPart = multiplayerService.getCurrentParticipant();
    if (currentPart && currentPart.role === 'player') {
      refreshPlayerData();
    }

    const unsubscribe = multiplayerService.subscribe((event) => {
      const p = multiplayerService.getCurrentParticipant();
      if (p && p.role === 'player') {
        refreshPlayerData();
      }
      if (event.type === 'GAME_STARTED' && event.payload?.gameId) {
        navigate(`/gamespace/${event.payload.gameId}`);
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

  const handleVote = async (game: Game) => {
    if (!activeSession || !currentParticipant) return;
    setError(null);
    try {
      await multiplayerService.submitGameVote(
        activeSession.id,
        currentParticipant.id,
        game.id,
        game.title
      );
      setSelectedGameId(game.id);
      refreshPlayerData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLeaveSession = () => {
    multiplayerService.clearActiveSession();
    setActiveSession(null);
    setCurrentParticipant(null);
    setAvailableGames([]);
    setVotingState(null);
    setSelectedGameId(null);
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
          {activeSession ? `Multiplayer Session ${activeSession.code}` : 'Join Multiplayer Session'}
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
            <span>{isSubmitting ? 'Joining Session...' : 'Enter Session & Vote for Game'}</span>
          </button>
        </form>
      ) : (
        /* In-Session Experience: Game Selection Voting */
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

          {/* Winning game announcement banner */}
          {activeSession.winning_game_title && (
            <div
              style={{
                backgroundColor: '#132117',
                border: '2px solid #2d6a45',
                borderRadius: '10px',
                padding: '16px',
                textAlign: 'center',
              }}
            >
              <Crown size={28} color="#e8c872" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontSize: '11px', color: '#86efac', textTransform: 'uppercase', fontWeight: 700 }}>
                Voting Closed • Winning Game Decided!
              </div>
              <h2 style={{ fontSize: '20px', color: '#fcf8ee', margin: '4px 0 8px 0' }}>
                {activeSession.winning_game_title}
              </h2>
              <p style={{ color: '#b0a695', fontSize: '13px', margin: 0 }}>
                Waiting for the Host to start the game. You will automatically be transitioned into Game Space.
              </p>
            </div>
          )}

          {/* Game Selection Voting List */}
          <div
            style={{
              backgroundColor: '#261e17',
              border: '2px solid #4a3828',
              borderRadius: '12px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#fcf8ee', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Vote size={18} color="#e8c872" />
                  <span>Vote for Which Game to Play</span>
                </h3>
                <p style={{ color: '#b0a695', fontSize: '13px', margin: 0 }}>
                  Select exactly one game. You can change your selection anytime before the Host closes voting.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {availableGames.map((game) => {
                const isSelected = selectedGameId === game.id;
                const tally = votingState?.tallies?.[game.id] || { voteCount: 0, percentage: 0 };
                const isVotingClosed = activeSession.status === 'ready-to-start' || activeSession.status === 'in-progress';

                return (
                  <button
                    key={game.id}
                    disabled={isVotingClosed}
                    onClick={() => handleVote(game)}
                    style={{
                      padding: '16px 20px',
                      backgroundColor: isSelected ? '#1b4731' : '#1b1612',
                      border: isSelected ? '2px solid #34d399' : '1px solid #4a3828',
                      borderRadius: '8px',
                      color: isSelected ? '#fcf8ee' : '#d0c6b6',
                      textAlign: 'left',
                      cursor: isVotingClosed ? 'default' : 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Gamepad2 size={18} color={isSelected ? '#34d399' : '#e8c872'} />
                        <span style={{ fontSize: '16px', fontWeight: 700, color: isSelected ? '#86efac' : '#fcf8ee' }}>
                          {game.title}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#e8c872' }}>
                          {tally.voteCount} vote(s) ({tally.percentage}%)
                        </span>
                        {isSelected && <CheckCircle size={18} color="#34d399" />}
                      </div>
                    </div>

                    <p style={{ margin: 0, fontSize: '12px', color: '#b0a695', lineHeight: 1.4 }}>
                      {game.description}
                    </p>

                    {/* Progress bar */}
                    <div
                      style={{
                        width: '100%',
                        height: '6px',
                        backgroundColor: '#2d231a',
                        borderRadius: '3px',
                        overflow: 'hidden',
                        marginTop: '4px',
                      }}
                    >
                      <div
                        style={{
                          width: `${tally.percentage}%`,
                          height: '100%',
                          backgroundColor: isSelected ? '#34d399' : '#e8c872',
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedGameId && (
              <div
                style={{
                  padding: '12px 16px',
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
                <span>Your vote is cast! You can click another game above to change your choice anytime before voting ends.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
