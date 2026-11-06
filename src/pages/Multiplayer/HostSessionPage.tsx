import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Play,
  Share2,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  LogOut,
  Vote,
  Gamepad2,
  Crown
} from 'lucide-react';
import { multiplayerService } from '../../services/multiplayer';
import { gameRegistry } from '../../services/games/gameRegistry';
import { Game } from '../../types';
import {
  MultiplayerSession,
  SessionParticipant,
  GameSelectionVotingState,
  GameVote,
} from '../../types/multiplayer';

export const HostSessionPage: React.FC = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [hostName, setHostName] = useState<string>('Bench Master');
  const [activeSession, setActiveSession] = useState<MultiplayerSession | null>(
    multiplayerService.getActiveSession()
  );
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [votes, setVotes] = useState<GameVote[]>([]);
  const [votingState, setVotingState] = useState<GameSelectionVotingState | null>(null);

  const [copiedLink, setCopiedLink] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load registered games
  useEffect(() => {
    gameRegistry.getAllGames().then((all) => {
      setGames(all);
    });
  }, []);

  const refreshSessionData = () => {
    const current = multiplayerService.getActiveSession();
    setActiveSession(current);
    if (current) {
      const data = multiplayerService.getSessionData(current.id);
      if (data) {
        setParticipants(data.participants);
        setVotes(data.votes);
        setVotingState(data.votingState);
      }
    }
  };

  useEffect(() => {
    refreshSessionData();

    const unsubscribe = multiplayerService.subscribe(() => {
      refreshSessionData();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleCreateSession = async () => {
    setError(null);
    try {
      if (games.length === 0) {
        throw new Error('No games available in registry to play.');
      }
      const { session, hostParticipant } = await multiplayerService.createSession(
        games,
        hostName
      );
      setActiveSession(session);
      setParticipants([hostParticipant]);
      refreshSessionData();
    } catch (err: any) {
      setError(err.message || 'Failed to create multiplayer session');
    }
  };

  const handleCloseVoting = async (tieBreakerId?: string) => {
    if (!activeSession) return;
    try {
      const result = await multiplayerService.closeGameSelectionVoting(activeSession.id, tieBreakerId);
      setVotingState(result);
      refreshSessionData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleStartGame = async () => {
    if (!activeSession) return;
    try {
      const gameId = await multiplayerService.startWinningGame(activeSession.id);
      navigate(`/gamespace/${gameId}`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLeaveOrClose = () => {
    multiplayerService.clearActiveSession();
    setActiveSession(null);
    setParticipants([]);
    setVotes([]);
    setVotingState(null);
  };

  const shareableUrl = activeSession
    ? `${window.location.origin}${window.location.pathname}#/play/${activeSession.code}`
    : '';

  const copyShareLink = () => {
    if (!shareableUrl) return;
    navigator.clipboard.writeText(shareableUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '30px 20px',
        color: '#fcf8ee',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e8c872' }}>
          <Sparkles size={18} />
          <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>
            Multiplayer Control Station
          </span>
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-family-display)',
            fontSize: '28px',
            margin: '4px 0 6px 0',
            color: '#fcf8ee',
          }}
        >
          Host Multiplayer Session
        </h1>
        <p style={{ color: '#b0a695', margin: 0, fontSize: '14px' }}>
          Launch a shared session for friends. Players vote on which game to play, and the winning game launches into Game Space for everyone!
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
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* No active session: Creation Form */}
      {!activeSession ? (
        <div
          style={{
            backgroundColor: '#261e17',
            border: '2px solid #4a3828',
            borderRadius: '12px',
            padding: '28px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            maxWidth: '680px',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-family-display)',
              fontSize: '20px',
              color: '#e8c872',
              marginTop: 0,
              marginBottom: '16px',
            }}
          >
            Create Multiplayer Session
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#d0c6b6', marginBottom: '6px' }}>
                Host Display Name
              </label>
              <input
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="e.g. Bench Master"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: '#1b1612',
                  border: '1px solid #4a3828',
                  borderRadius: '6px',
                  color: '#fcf8ee',
                  fontSize: '14px',
                }}
              />
            </div>

            <div style={{ fontSize: '13px', color: '#b0a695' }}>
              Games available for voting in this session: <strong>{games.length} registered micro-games</strong>
            </div>

            <button
              onClick={handleCreateSession}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: '#1b4731',
                color: '#e8c872',
                border: '1px solid #2d6a45',
                borderRadius: '8px',
                padding: '12px 20px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                marginTop: '10px',
              }}
            >
              <Play size={18} />
              <span>Open Session & Game Selection Lobby</span>
            </button>
          </div>
        </div>
      ) : (
        /* Active session dashboard */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
          {/* Main Console */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Session Banner */}
            <div
              style={{
                backgroundColor: '#261e17',
                border: '2px solid #4a3828',
                borderRadius: '12px',
                padding: '20px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: '#b0a695', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Session Code
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                  <span style={{ fontSize: '32px', fontWeight: 800, color: '#e8c872', letterSpacing: '3px' }}>
                    {activeSession.code}
                  </span>
                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor:
                        activeSession.status === 'ready-to-start'
                          ? '#1b4731'
                          : activeSession.status === 'voting'
                          ? '#382b13'
                          : '#1b4731',
                      color:
                        activeSession.status === 'ready-to-start'
                          ? '#86efac'
                          : activeSession.status === 'voting'
                          ? '#fce3b8'
                          : '#a7f3d0',
                      border: '1px solid rgba(255,255,255,0.1)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {activeSession.status === 'voting'
                      ? 'Game Selection Voting'
                      : activeSession.status === 'ready-to-start'
                      ? 'Game Decided'
                      : activeSession.status}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={copyShareLink}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#1b4731',
                    color: '#e8c872',
                    border: '1px solid #2d6a45',
                    borderRadius: '6px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {copiedLink ? <CheckCircle size={15} /> : <Share2 size={15} />}
                  <span>{copiedLink ? 'Link Copied!' : 'Copy Invite Link'}</span>
                </button>

                <button
                  onClick={handleLeaveOrClose}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#382218',
                    color: '#fca5a5',
                    border: '1px solid #5c2c1c',
                    borderRadius: '6px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <LogOut size={15} />
                  <span>Leave Lobby</span>
                </button>
              </div>
            </div>

            {/* Game Selection Voting Console */}
            <div
              style={{
                backgroundColor: '#1f1914',
                border: '1px solid #3d2f24',
                borderRadius: '10px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Vote size={18} color="#e8c872" />
                  <h3 style={{ margin: 0, fontSize: '17px', color: '#e8c872' }}>
                    Game Selection Voting (Live Tally)
                  </h3>
                </div>
                <div style={{ fontSize: '13px', color: '#b0a695' }}>
                  Total Votes Cast: <strong>{votes.length} / {participants.length}</strong>
                </div>
              </div>

              {/* Tally list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {games.map((g) => {
                  const tally = votingState?.tallies?.[g.id] || { voteCount: 0, percentage: 0, voterNames: [] };
                  const isWinning =
                    activeSession.winning_game_id === g.id ||
                    (votingState?.winningGameId === g.id && !votingState.isTie);

                  return (
                    <div
                      key={g.id}
                      style={{
                        padding: '12px 16px',
                        backgroundColor: '#1b1612',
                        border: isWinning ? '2px solid #34d399' : '1px solid #3d2f24',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Gamepad2 size={16} color={isWinning ? '#34d399' : '#e8c872'} />
                          <span style={{ fontSize: '15px', fontWeight: 600, color: isWinning ? '#86efac' : '#fcf8ee' }}>
                            {g.title}
                          </span>
                          {isWinning && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11px',
                                backgroundColor: '#132117',
                                color: '#34d399',
                                border: '1px solid #203f29',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 700,
                              }}
                            >
                              <Crown size={12} />
                              <span>WINNER</span>
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#e8c872' }}>
                          {tally.voteCount} vote(s) ({tally.percentage}%)
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div
                        style={{
                          width: '100%',
                          height: '8px',
                          backgroundColor: '#2d231a',
                          borderRadius: '4px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${tally.percentage}%`,
                            height: '100%',
                            backgroundColor: isWinning ? '#34d399' : '#e8c872',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>

                      {tally.voterNames.length > 0 && (
                        <div style={{ fontSize: '11px', color: '#b0a695' }}>
                          Voted by: {tally.voterNames.join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Tie banner */}
              {votingState?.isTie && (
                <div
                  style={{
                    backgroundColor: '#3b2915',
                    border: '1px solid #6b4d1d',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ fontSize: '13px', color: '#fce3b8', fontWeight: 600 }}>
                    Tie detected between games! Choose a tie-breaking winner:
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {votingState.tiedGameIds.map((tid) => {
                      const tg = games.find((x) => x.id === tid);
                      return (
                        <button
                          key={tid}
                          onClick={() => handleCloseVoting(tid)}
                          style={{
                            backgroundColor: '#e8c872',
                            color: '#1b1612',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Pick {tg?.title || tid} as Winner
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                {activeSession.status === 'voting' ? (
                  <button
                    onClick={() => handleCloseVoting()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: '#1b4731',
                      color: '#e8c872',
                      border: '1px solid #2d6a45',
                      borderRadius: '8px',
                      padding: '12px 20px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <CheckCircle size={16} />
                    <span>Close Voting & Confirm Winning Game</span>
                  </button>
                ) : (
                  <button
                    onClick={handleStartGame}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: '#1b4731',
                      color: '#e8c872',
                      border: '1px solid #2d6a45',
                      borderRadius: '8px',
                      padding: '14px 24px',
                      fontSize: '15px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Play size={18} />
                    <span>Start Winning Game ({activeSession.winning_game_title}) in Game Space</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar: Participants */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                backgroundColor: '#261e17',
                border: '1px solid #4a3828',
                borderRadius: '10px',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#fcf8ee', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={15} color="#e8c872" />
                  <span>Connected Participants ({participants.length})</span>
                </span>
                <button
                  onClick={refreshSessionData}
                  title="Refresh"
                  style={{ background: 'none', border: 'none', color: '#b0a695', cursor: 'pointer', padding: 0 }}
                >
                  <RefreshCw size={13} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {participants.map((p) => {
                  const playerVote = votes.find((v) => v.participant_id === p.id);
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        padding: '8px 10px',
                        backgroundColor: '#1b1612',
                        borderRadius: '6px',
                        border: '1px solid #3d2f24',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: p.is_connected ? '#34d399' : '#6b7280',
                            }}
                          />
                          <span style={{ fontSize: '13px', fontWeight: 500 }}>{p.player_name}</span>
                          {p.role === 'host' && (
                            <span style={{ fontSize: '10px', color: '#e8c872', backgroundColor: '#382b13', padding: '1px 4px', borderRadius: '3px' }}>
                              Host
                            </span>
                          )}
                        </div>
                      </div>

                      {playerVote ? (
                        <div style={{ fontSize: '11px', color: '#86efac', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={11} />
                          <span>Voted for: {playerVote.game_title}</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                          Choosing game...
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
