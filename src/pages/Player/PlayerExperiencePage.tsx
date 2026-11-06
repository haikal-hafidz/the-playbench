import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Gamepad2,
  Vote,
  CheckCircle,
  AlertCircle,
  Sparkles,
  LogOut,
  Crown,
  Users,
  Trophy
} from 'lucide-react';
import { multiplayerService } from '../../services/multiplayer';
import { Game } from '../../types';
import {
  MultiplayerSession,
  SessionParticipant,
  GameSelectionVotingState,
  GameVote,
  GameLeaderboard,
} from '../../types/multiplayer';

export const PlayerExperiencePage: React.FC = () => {
  const { code: urlCode } = useParams<{ code?: string }>();
  const navigate = useNavigate();

  const [sessionCode, setSessionCode] = useState(urlCode || '');
  const [playerName, setPlayerName] = useState('');
  const [activeSession, setActiveSession] = useState<MultiplayerSession | null>(null);
  const [currentParticipant, setCurrentParticipant] = useState<SessionParticipant | null>(null);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [availableGames, setAvailableGames] = useState<Game[]>([]);
  const [votingState, setVotingState] = useState<GameSelectionVotingState | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [sessionHistory, setSessionHistory] = useState<GameLeaderboard[]>([]);
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
        setParticipants(data.participants || []);
        setAvailableGames(data.availableGames || []);
        setVotingState(data.votingState);
        setSessionHistory(data.history || []);

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
      if (event.type === 'SESSION_CLOSED') {
        handleLeaveSession();
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
      const data = multiplayerService.getSessionData(session.id);
      if (data) {
        setAvailableGames(data.availableGames || []);
        setParticipants(data.participants || []);
        setVotingState(data.votingState);
      }
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
    setParticipants([]);
    setAvailableGames([]);
    setVotingState(null);
    setSelectedGameId(null);
    setSessionHistory([]);
    navigate('/play');
  };

  return (
    <div
      style={{
        maxWidth: '780px',
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
            : 'Enter a display name and the session code provided by your workbench Host.'}
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
              Your Display Name <span style={{ color: '#e8c872' }}>*</span>
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
            <span style={{ fontSize: '11px', color: '#b0a695', marginTop: '4px', display: 'block' }}>
              If another participant shares this name, a distinctive number badge (e.g. CraftyFox (2)) will be added automatically.
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#d0c6b6', marginBottom: '6px' }}>
              Session Code <span style={{ color: '#e8c872' }}>*</span>
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
      ) : activeSession.status === 'session-recap' ? (
        /* Final Session Recap View for Players */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              backgroundColor: '#261e17',
              border: '2px solid #e8c872',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <Trophy size={32} color="#e8c872" style={{ margin: '0 auto 8px auto' }} />
            <h2 style={{ fontFamily: 'var(--font-family-display)', fontSize: '22px', margin: '4px 0' }}>
              Multiplayer Session Results Recap
            </h2>
            <p style={{ color: '#b0a695', fontSize: '13px', margin: 0 }}>
              The host has ended this multiplayer session. Review the individual game results below!
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {sessionHistory.map((lb) => (
              <div
                key={lb.id}
                style={{
                  backgroundColor: '#1f1914',
                  border: '1px solid #4a3828',
                  borderRadius: '10px',
                  padding: '18px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Gamepad2 size={16} color="#e8c872" />
                    <strong style={{ fontSize: '16px', color: '#fcf8ee' }}>{lb.game_title}</strong>
                  </div>
                  <span style={{ fontSize: '11px', color: '#86efac', backgroundColor: '#132117', padding: '2px 6px', borderRadius: '4px' }}>
                    Ranked by {lb.ranking_criterion === 'lowest-score' ? 'Lowest' : 'Highest'} {lb.unit_label}
                  </span>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #3d2f24', color: '#e8c872', textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px', width: '50px' }}>Rank</th>
                      <th style={{ padding: '6px 8px' }}>Player</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lb.entries.map((entry) => {
                      const isMe = entry.participant_id === currentParticipant?.id;
                      return (
                        <tr
                          key={entry.participant_id}
                          style={{
                            borderBottom: '1px solid #281f18',
                            backgroundColor: isMe ? 'rgba(27, 71, 49, 0.3)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '6px 8px', fontWeight: 700, color: entry.rank === 1 ? '#e8c872' : '#fcf8ee' }}>
                            #{entry.rank}
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            {entry.participant_name}
                            {isMe && <span style={{ marginLeft: '4px', fontSize: '10px', color: '#86efac' }}>(You)</span>}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: '#e8c872' }}>
                            {entry.summary || `${entry.score} ${lb.unit_label}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            <button
              onClick={handleLeaveSession}
              style={{
                backgroundColor: '#382218',
                color: '#fca5a5',
                border: '1px solid #5c2c1c',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Exit Session & Return to Portal
            </button>
          </div>
        </div>
      ) : (
        /* In-Session Experience: Game Selection Voting */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Top Status Strip */}
          <div
            style={{
              backgroundColor: '#261e17',
              border: '1px solid #4a3828',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
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
              <span style={{ fontSize: '13px', color: '#b0a695' }}>•</span>
              <span style={{ fontSize: '13px', color: '#e8c872' }}>
                You: <strong>{currentParticipant?.player_name}</strong>
              </span>
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

          {/* Participant List Strip */}
          <div
            style={{
              backgroundColor: '#1b1612',
              border: '1px solid #3d2f24',
              borderRadius: '8px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#b0a695' }}>
              <Users size={14} color="#e8c872" />
              <span>Participants ({participants.length}):</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {participants.map((p) => (
                <span
                  key={p.id}
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    backgroundColor: '#261e17',
                    border: '1px solid #4a3828',
                    borderRadius: '4px',
                    color: p.id === currentParticipant?.id ? '#86efac' : '#fcf8ee',
                    fontWeight: p.id === currentParticipant?.id ? 700 : 500,
                  }}
                >
                  {p.player_name} {p.role === 'host' && '(Host)'}
                </span>
              ))}
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
