import React, { useState, useEffect } from 'react';
import {
  Users,
  Play,
  Share2,
  CheckCircle,
  AlertTriangle,
  Award,
  Vote,
  Sparkles,
  RefreshCw,
  LogOut,
  Clock
} from 'lucide-react';
import { multiplayerService } from '../../services/multiplayer';
import { gameRegistry } from '../../services/games/gameRegistry';
import { Game } from '../../types';
import {
  MultiplayerSession,
  SessionParticipant,
  SessionGameState,
  VotingRound,
  VotingResult,
} from '../../types/multiplayer';

export const HostSessionPage: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [hostName, setHostName] = useState<string>('Bench Master');
  const [activeSession, setActiveSession] = useState<MultiplayerSession | null>(
    multiplayerService.getActiveSession()
  );
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [gameState, setGameState] = useState<SessionGameState | null>(null);
  const [activeVotingRound, setActiveVotingRound] = useState<VotingRound | null>(null);
  const [latestResult, setLatestResult] = useState<VotingResult | null>(null);

  // Voting setup form state
  const [votePrompt, setVotePrompt] = useState('Which craft stationery token was hidden behind Card #4?');
  const [voteOption1, setVoteOption1] = useState('Brass Scissors ✂️');
  const [voteOption2, setVoteOption2] = useState('Wooden Ruler 📏');
  const [voteOption3, setVoteOption3] = useState('Carving Knife 🔪');
  const [voteDuration] = useState(30);

  const [copiedLink, setCopiedLink] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load games from registry
  useEffect(() => {
    gameRegistry.getAllGames().then((all) => {
      setGames(all);
      if (all.length > 0 && !selectedGameId) {
        setSelectedGameId(all[0].id);
      }
    });
  }, []);

  // Sync state if session exists
  const refreshSessionData = () => {
    const current = multiplayerService.getActiveSession();
    setActiveSession(current);
    if (current) {
      const data = multiplayerService.getSessionData(current.id);
      if (data) {
        setParticipants(data.participants);
        setGameState(data.gameState);
        const openRound = data.votingRounds.find((r) => r.status === 'open');
        setActiveVotingRound(openRound || null);
      }
    }
  };

  useEffect(() => {
    refreshSessionData();

    // Subscribe to multiplayer real-time events
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
      const game = games.find((g) => g.id === selectedGameId);
      if (!game) throw new Error('Please select a game first.');

      const { session, hostParticipant } = await multiplayerService.createSession(
        game.id,
        game.title,
        hostName
      );
      setActiveSession(session);
      setParticipants([hostParticipant]);
      refreshSessionData();
    } catch (err: any) {
      setError(err.message || 'Failed to create multiplayer session');
    }
  };

  const handleStartGame = async () => {
    if (!activeSession) return;
    try {
      await multiplayerService.updateSessionStatus(activeSession.id, 'in-progress');
      await multiplayerService.updateGameState(activeSession.id, {
        phase: 'question',
        prompt: `Round 1 of ${activeSession.game_title} has begun! Listen to the Host.`,
      });
      refreshSessionData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleStartVoting = async () => {
    if (!activeSession) return;
    try {
      const options = [
        { id: 'opt_1', text: voteOption1 },
        { id: 'opt_2', text: voteOption2 },
        { id: 'opt_3', text: voteOption3 },
      ].filter((o) => o.text.trim().length > 0);

      const round = await multiplayerService.startVotingRound(
        activeSession.id,
        votePrompt,
        options,
        voteDuration
      );
      setActiveVotingRound(round);
      refreshSessionData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCloseVoting = async () => {
    if (!activeSession || !activeVotingRound) return;
    try {
      const result = await multiplayerService.closeVotingRound(activeSession.id, activeVotingRound.id);
      setLatestResult(result);
      setActiveVotingRound(null);
      refreshSessionData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) return;
    try {
      await multiplayerService.updateSessionStatus(activeSession.id, 'completed');
      await multiplayerService.updateGameState(activeSession.id, {
        phase: 'game-over',
        prompt: 'Session ended by Host. Check final scores!',
      });
      refreshSessionData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLeaveOrClose = () => {
    multiplayerService.clearActiveSession();
    setActiveSession(null);
    setParticipants([]);
    setGameState(null);
    setActiveVotingRound(null);
    setLatestResult(null);
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
          Coordinate live cross-device games with friends, manage participants in real time, and trigger synchronized voting rounds.
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

      {/* No active session: Creation Station */}
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
            Create New Multiplayer Session
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#d0c6b6', marginBottom: '6px' }}>
                Select Game for Session
              </label>
              <select
                value={selectedGameId}
                onChange={(e) => setSelectedGameId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: '#1b1612',
                  border: '1px solid #4a3828',
                  borderRadius: '6px',
                  color: '#fcf8ee',
                  fontSize: '14px',
                }}
              >
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title} ({g.packageOrigin})
                  </option>
                ))}
              </select>
            </div>

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
              <span>Launch Session Lobby</span>
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
                  Game: {activeSession.game_title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                  <span style={{ fontSize: '30px', fontWeight: 800, color: '#e8c872', letterSpacing: '3px' }}>
                    {activeSession.code}
                  </span>
                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: activeSession.status === 'in-progress' ? '#1b4731' : '#3d2514',
                      color: activeSession.status === 'in-progress' ? '#a7f3d0' : '#fce3b8',
                      border: '1px solid rgba(255,255,255,0.1)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {activeSession.status}
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

            {/* Waiting Room & Session Progression */}
            {activeSession.status === 'waiting' && (
              <div
                style={{
                  backgroundColor: '#1f1914',
                  border: '1px solid #3d2f24',
                  borderRadius: '10px',
                  padding: '24px',
                  textAlign: 'center',
                }}
              >
                <Users size={36} color="#e8c872" style={{ margin: '0 auto 12px auto' }} />
                <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#fcf8ee' }}>
                  Waiting Room Open
                </h3>
                <p style={{ color: '#b0a695', fontSize: '14px', margin: '0 0 16px 0' }}>
                  Share session code <strong>{activeSession.code}</strong> with players. Once everyone has joined, start the game.
                </p>
                <button
                  onClick={handleStartGame}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: '#1b4731',
                    color: '#e8c872',
                    border: '1px solid #2d6a45',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Play size={18} />
                  <span>Start Game with {participants.length} Participant(s)</span>
                </button>
              </div>
            )}

            {/* Active Gameplay & Voting Controls */}
            {activeSession.status !== 'waiting' && (
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
                  <h3 style={{ margin: 0, fontSize: '17px', color: '#e8c872', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Vote size={18} />
                    <span>Synchronized Voting Station</span>
                  </h3>
                  <button
                    onClick={handleEndSession}
                    style={{
                      fontSize: '12px',
                      backgroundColor: '#501e1e',
                      color: '#fecaca',
                      border: '1px solid #802e2e',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    End Session
                  </button>
                </div>

                {activeVotingRound ? (
                  <div
                    style={{
                      backgroundColor: '#162e20',
                      border: '1px solid #2d6a45',
                      borderRadius: '8px',
                      padding: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', color: '#86efac', fontWeight: 600, textTransform: 'uppercase' }}>
                        Voting Round In Progress
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#e8c872', fontSize: '13px' }}>
                        <Clock size={14} />
                        <span>Duration: {activeVotingRound.duration_seconds}s</span>
                      </div>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#fcf8ee', marginBottom: '12px' }}>
                      {activeVotingRound.prompt}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                      {activeVotingRound.options.map((opt) => (
                        <div
                          key={opt.id}
                          style={{
                            padding: '8px 12px',
                            backgroundColor: '#0f1f15',
                            border: '1px solid #1b4731',
                            borderRadius: '4px',
                            fontSize: '13px',
                          }}
                        >
                          {opt.text}
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleCloseVoting}
                      style={{
                        backgroundColor: '#e8c872',
                        color: '#1b1612',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Close Voting & Tally Results
                    </button>
                  </div>
                ) : (
                  /* Form to launch a new voting round */
                  <div
                    style={{
                      backgroundColor: '#261e17',
                      border: '1px solid #4a3828',
                      borderRadius: '8px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#d0c6b6' }}>
                      Trigger New Voting Prompt for Players
                    </div>

                    <input
                      type="text"
                      value={votePrompt}
                      onChange={(e) => setVotePrompt(e.target.value)}
                      placeholder="Voting Question / Prompt"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        backgroundColor: '#1b1612',
                        border: '1px solid #3d2f24',
                        borderRadius: '4px',
                        color: '#fcf8ee',
                        fontSize: '13px',
                      }}
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      <input
                        type="text"
                        value={voteOption1}
                        onChange={(e) => setVoteOption1(e.target.value)}
                        placeholder="Option 1"
                        style={{
                          padding: '8px 10px',
                          backgroundColor: '#1b1612',
                          border: '1px solid #3d2f24',
                          borderRadius: '4px',
                          color: '#fcf8ee',
                          fontSize: '12px',
                        }}
                      />
                      <input
                        type="text"
                        value={voteOption2}
                        onChange={(e) => setVoteOption2(e.target.value)}
                        placeholder="Option 2"
                        style={{
                          padding: '8px 10px',
                          backgroundColor: '#1b1612',
                          border: '1px solid #3d2f24',
                          borderRadius: '4px',
                          color: '#fcf8ee',
                          fontSize: '12px',
                        }}
                      />
                      <input
                        type="text"
                        value={voteOption3}
                        onChange={(e) => setVoteOption3(e.target.value)}
                        placeholder="Option 3"
                        style={{
                          padding: '8px 10px',
                          backgroundColor: '#1b1612',
                          border: '1px solid #3d2f24',
                          borderRadius: '4px',
                          color: '#fcf8ee',
                          fontSize: '12px',
                        }}
                      />
                    </div>

                    <button
                      onClick={handleStartVoting}
                      style={{
                        alignSelf: 'flex-start',
                        backgroundColor: '#1b4731',
                        color: '#e8c872',
                        border: '1px solid #2d6a45',
                        borderRadius: '6px',
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Broadcast Voting Round
                    </button>
                  </div>
                )}

                {/* Latest Voting Results */}
                {latestResult && (
                  <div
                    style={{
                      backgroundColor: '#1b1612',
                      border: '1px solid #3d2f24',
                      borderRadius: '8px',
                      padding: '14px',
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#e8c872', marginBottom: '8px' }}>
                      Voting Results (Total Votes: {latestResult.totalVotes})
                    </div>
                    {Object.entries(latestResult.counts).map(([optId, count]) => {
                      const pct = latestResult.percentages[optId] || 0;
                      const isWinner = latestResult.winningOptionIds.includes(optId);
                      return (
                        <div key={optId} style={{ marginBottom: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '2px' }}>
                            <span style={{ color: isWinner ? '#86efac' : '#fcf8ee', fontWeight: isWinner ? 700 : 400 }}>
                              {optId} {isWinner && '👑 Winner'}
                            </span>
                            <span style={{ color: '#b0a695' }}>{count} vote(s) ({pct}%)</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', backgroundColor: '#2d231a', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', backgroundColor: isWinner ? '#34d399' : '#e8c872' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar: Participants and Leaderboard */}
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
                  <span>Participants ({participants.length})</span>
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
                  const score = gameState?.scores?.[p.id] || 0;
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        backgroundColor: '#1b1612',
                        borderRadius: '6px',
                        border: '1px solid #3d2f24',
                      }}
                    >
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#e8c872', fontSize: '12px', fontWeight: 600 }}>
                        <Award size={13} />
                        <span>{score} pts</span>
                      </div>
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
