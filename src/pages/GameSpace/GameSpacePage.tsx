import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RotateCcw,
  Maximize2,
  Minimize2,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Gamepad2,
  HardDrive,
  Trophy,
  Users,
  LogOut,
  Sparkles
} from 'lucide-react';
import { gameRegistry } from '../../services/games';
import { SandboxBridge } from '../../services/runtime';
import { playbenchDB } from '../../services/storage';
import { multiplayerService } from '../../services/multiplayer';
import { Game } from '../../types';
import { CuttingMat } from '../../components/desk/CuttingMat';
import {
  MultiplayerSession,
  SessionParticipant,
  GameLeaderboard,
} from '../../types/multiplayer';

const LOAD_TIMEOUT_MS = 8000;

export const GameSpacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [game, setGame] = useState<Game | null>(null);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [resolvedSrcDoc, setResolvedSrcDoc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [gameReady, setGameReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState<number>(0);

  // Multiplayer session states
  const [activeSession, setActiveSession] = useState<MultiplayerSession | null>(
    multiplayerService.getActiveSession()
  );
  const [currentParticipant, setCurrentParticipant] = useState<SessionParticipant | null>(
    multiplayerService.getCurrentParticipant()
  );
  const [gameLeaderboard, setGameLeaderboard] = useState<GameLeaderboard | null>(null);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState<boolean>(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<SandboxBridge>(new SandboxBridge());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const createdBlobUrlsRef = useRef<string[]>([]);

  // Clear timeout helper
  const clearInitTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Revoke any created blob URLs
  const cleanupBlobUrls = useCallback(() => {
    for (const url of createdBlobUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    createdBlobUrlsRef.current = [];
  }, []);

  // Listen to multiplayer session updates
  useEffect(() => {
    const session = multiplayerService.getActiveSession();
    const participant = multiplayerService.getCurrentParticipant();
    setActiveSession(session);
    setCurrentParticipant(participant);

    if (session) {
      const data = multiplayerService.getSessionData(session.id);
      if (data?.currentLeaderboard) {
        setGameLeaderboard(data.currentLeaderboard);
        setShowLeaderboardModal(true);
      }
    }

    const unsubscribe = multiplayerService.subscribe((event) => {
      const currentSess = multiplayerService.getActiveSession();
      setActiveSession(currentSess);
      setCurrentParticipant(multiplayerService.getCurrentParticipant());

      if (event.type === 'GAME_LEADERBOARD_UPDATED' && event.payload?.leaderboard) {
        setGameLeaderboard(event.payload.leaderboard);
        setShowLeaderboardModal(true);
      } else if (event.type === 'SESSION_RETURNED_TO_LOBBY') {
        const p = multiplayerService.getCurrentParticipant();
        if (p?.role === 'host') {
          navigate('/host/session');
        } else {
          navigate('/play');
        }
      } else if (event.type === 'SESSION_RECAP_TRIGGERED') {
        const p = multiplayerService.getCurrentParticipant();
        if (p?.role === 'host') {
          navigate('/host/session');
        } else {
          navigate('/play');
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [navigate]);

  // Reset state when game ID route changes to prevent stale data
  useEffect(() => {
    let isMounted = true;
    clearInitTimeout();
    bridgeRef.current.detach();
    cleanupBlobUrls();

    // Reset all game state immediately on id change
    setGame(null);
    setResolvedSrc(null);
    setResolvedSrcDoc(null);
    setLoading(true);
    setErrorMessage(null);
    setGameReady(false);
    setLastSavedTime(null);
    setSaveError(null);
    setShowLeaderboardModal(false);
    setIframeKey((k) => k + 1);

    async function loadGame() {
      if (!id) {
        if (isMounted) {
          setErrorMessage('No game identifier specified. Please select a game from the Collection.');
          setLoading(false);
        }
        return;
      }

      try {
        const found = await gameRegistry.getGameById(id);
        if (!isMounted) return;

        if (!found) {
          setErrorMessage(`Game with identifier "${id}" could not be found in the registry.`);
          setLoading(false);
          return;
        }

        setGame(found);

        // Check if package is imported from ZIP with files in IndexedDB
        if (
          found.packageOrigin === 'imported-zip' ||
          found.packageOrigin === 'imported-json' ||
          found.packageOrigin === 'imported-url'
        ) {
          const files = await playbenchDB.getPackageFiles(found.id);
          if (files && files.length > 0) {
            const cleanEntry = found.runtime.entrypoint.replace(/^\.?\//, '');
            const entryFile = files.find(
              (f) => f.filePath === cleanEntry || f.filePath.endsWith(cleanEntry)
            );

            if (entryFile) {
              let htmlContent: string;
              if (typeof entryFile.data === 'string') {
                htmlContent = entryFile.data;
              } else {
                const decoder = new TextDecoder('utf-8');
                htmlContent = decoder.decode(entryFile.data);
              }

              for (const asset of files) {
                if (asset.filePath === entryFile.filePath) continue;
                const assetBase = asset.filePath.split('/').pop() || '';
                if (asset.mimeType.includes('css') || asset.filePath.endsWith('.css')) {
                  const cssText =
                    typeof asset.data === 'string'
                      ? asset.data
                      : new TextDecoder('utf-8').decode(asset.data);
                  htmlContent = htmlContent.replace(
                    new RegExp(`<link[^>]*href=["'][^"']*${assetBase}["'][^>]*>`, 'i'),
                    `<style>${cssText}</style>`
                  );
                } else if (
                  asset.mimeType.includes('javascript') ||
                  asset.filePath.endsWith('.js')
                ) {
                  const jsText =
                    typeof asset.data === 'string'
                      ? asset.data
                      : new TextDecoder('utf-8').decode(asset.data);
                  htmlContent = htmlContent.replace(
                    new RegExp(`<script[^>]*src=["'][^"']*${assetBase}["'][^>]*>\\s*</script>`, 'i'),
                    `<script>${jsText}</script>`
                  );
                }
              }

              if (isMounted) {
                setResolvedSrcDoc(htmlContent);
                setResolvedSrc(null);
                setLoading(false);
              }
            } else {
              if (isMounted) {
                setResolvedSrc(found.runtime.entrypoint);
                setLoading(false);
              }
            }
          } else {
            if (isMounted) {
              setResolvedSrc(found.runtime.entrypoint);
              setLoading(false);
            }
          }
        } else {
          // Bundled reference game
          if (isMounted) {
            setResolvedSrc(found.runtime.entrypoint);
            setLoading(false);
          }
        }

        // Record play session
        await gameRegistry.recordPlaySession(id);
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err?.message || 'Failed to load game from registry.');
          setLoading(false);
        }
      }
    }

    loadGame();

    return () => {
      isMounted = false;
      clearInitTimeout();
      bridgeRef.current.detach();
      cleanupBlobUrls();
    };
  }, [id, clearInitTimeout, cleanupBlobUrls]);

  // Set up initialization timeout and sandbox bridge
  useEffect(() => {
    if (!game || !iframeRef.current) return;

    clearInitTimeout();

    // Start 8-second handshake timeout
    timeoutRef.current = setTimeout(() => {
      if (!gameReady) {
        setErrorMessage(
          `Game "${game.title}" did not respond within ${
            LOAD_TIMEOUT_MS / 1000
          } seconds. It may be missing initialization scripts or failed to execute.`
        );
      }
    }, LOAD_TIMEOUT_MS);

    const detach = bridgeRef.current.attach(
      iframeRef.current,
      game.id,
      {
        onMounted: () => {},
        onReady: () => {
          clearInitTimeout();
          setGameReady(true);
          setErrorMessage(null);
        },
        onSaveConfirmed: () => {
          const timeStr = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          setLastSavedTime(timeStr);
          setSaveError(null);
        },
        onSaveError: (slot, err) => {
          setSaveError(`Slot "${slot}": ${err}`);
        },
        onGameOver: async (data) => {
          // Automatic leaderboard trigger when game ends!
          const sess = multiplayerService.getActiveSession();
          const part = multiplayerService.getCurrentParticipant();
          if (sess && part) {
            try {
              const lb = await multiplayerService.recordGameResult(
                sess.id,
                game.id,
                game.title,
                part.id,
                data.score !== undefined ? data.score : 1,
                data.summary || `Finished ${game.title}`
              );
              setGameLeaderboard(lb);
              setShowLeaderboardModal(true);
            } catch (err) {
              console.warn('Could not record multiplayer game result:', err);
            }
          }
        },
        onError: (err) => {
          console.warn(`Game emitted error: ${err.message}`);
        },
      },
      {
        maxSaveSlots: game.storage?.maxSaveSlots,
        gameVersion: game.version,
      }
    );

    return () => {
      clearInitTimeout();
      detach();
    };
  }, [game, iframeKey, clearInitTimeout, gameReady]);

  const handleIframeLoad = () => {
    if (iframeRef.current && game) {
      bridgeRef.current.dispatchInit(iframeRef.current, game.id, game.version);
    }
  };

  const handleIframeError = () => {
    clearInitTimeout();
    setErrorMessage(`Failed to load game frame at: ${game?.runtime.entrypoint}`);
  };

  const handleRestart = () => {
    if (game) {
      clearInitTimeout();
      setGameReady(false);
      setErrorMessage(null);
      setSaveError(null);
      setShowLeaderboardModal(false);
      setIframeKey((k) => k + 1);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Host session action: return to lobby
  const handleHostReturnToLobby = async () => {
    if (!activeSession) return;
    await multiplayerService.returnToLobby(activeSession.id);
    navigate('/host/session');
  };

  // Host session action: end session and show final recap
  const handleHostEndSession = async () => {
    if (!activeSession) return;
    await multiplayerService.showFinalSessionRecap(activeSession.id);
    navigate('/host/session');
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '20px 20px 48px 20px' }}>
      <CuttingMat>
        {/* Navigation & Toolbar Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <button
            onClick={() => {
              if (activeSession) {
                if (currentParticipant?.role === 'host') navigate('/host/session');
                else navigate('/play');
              } else {
                navigate('/collection');
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#e8c872',
              fontSize: '13px',
              padding: '6px 12px',
              backgroundColor: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(232, 200, 114, 0.3)',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={15} />
            <span>
              {activeSession ? 'Return to Session Lobby' : 'Return to Collection'}
            </span>
          </button>

          {/* Multiplayer Active Session Status Indicator */}
          {activeSession && currentParticipant && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                backgroundColor: '#1b4731',
                border: '1px solid #2d6a45',
                borderRadius: '6px',
                color: '#fcf8ee',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              <Users size={14} color="#86efac" />
              <span>
                Room: <strong>{activeSession.code}</strong> • Playing as{' '}
                <strong style={{ color: '#e8c872' }}>{currentParticipant.player_name}</strong>
              </span>
              {gameLeaderboard && (
                <button
                  onClick={() => setShowLeaderboardModal(true)}
                  style={{
                    backgroundColor: '#e8c872',
                    color: '#1b1612',
                    border: 'none',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginLeft: '4px',
                  }}
                >
                  <Trophy size={11} />
                  <span>View Leaderboard</span>
                </button>
              )}
            </div>
          )}

          {game && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {saveError && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-family-craft)',
                    color: '#ff8585',
                    backgroundColor: 'rgba(201, 59, 43, 0.2)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid rgba(201, 59, 43, 0.4)',
                  }}
                >
                  <AlertTriangle size={12} color="#ff8585" />
                  <span>{saveError}</span>
                </div>
              )}

              {lastSavedTime && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-family-craft)',
                    color: '#8fad91',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid #203f29',
                  }}
                >
                  <HardDrive size={12} color="#34d399" />
                  <span>Saved at {lastSavedTime}</span>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-family-craft)',
                  color: '#e8c872',
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid rgba(232, 200, 114, 0.3)',
                }}
              >
                <ShieldCheck size={12} color="#34d399" />
                <span>Sandbox Active</span>
              </div>

              <button
                onClick={handleRestart}
                title="Restart Game"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#2b2118',
                  color: '#fcf8ee',
                  fontSize: '12px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #4a3828',
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={14} />
                <span>Restart</span>
              </button>

              <button
                onClick={toggleFullscreen}
                title="Toggle Fullscreen"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#2b2118',
                  color: '#fcf8ee',
                  fontSize: '12px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #4a3828',
                  cursor: 'pointer',
                }}
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                <span>{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Error State */}
        {errorMessage && (
          <div
            style={{
              backgroundColor: 'var(--color-paper-card)',
              borderRadius: '8px',
              border: '2px solid #c93b2b',
              boxShadow: 'var(--shadow-desk-card)',
              padding: '36px 24px',
              textAlign: 'center',
              maxWidth: '560px',
              margin: '40px auto',
            }}
          >
            <AlertTriangle size={36} color="#c93b2b" style={{ marginBottom: '12px' }} />
            <h2 style={{ fontSize: '18px', fontFamily: 'var(--font-family-display)', marginBottom: '8px' }}>
              Unable to Launch Game
            </h2>
            <p style={{ fontSize: '13px', color: '#535c56', marginBottom: '20px' }}>
              {errorMessage}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                onClick={handleRestart}
                style={{
                  backgroundColor: '#2b2118',
                  color: '#fcf8ee',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: '1px solid #4a3828',
                  cursor: 'pointer',
                }}
              >
                Try Again
              </button>
              <button
                onClick={() => navigate('/collection')}
                style={{
                  backgroundColor: '#1b4731',
                  color: '#fcf8ee',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Browse Collection
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div
            style={{
              minHeight: '400px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fcf8ee',
              gap: '12px',
            }}
          >
            <Gamepad2 size={36} className="pulse" color="#e8c872" />
            <div style={{ fontFamily: 'var(--font-family-craft)', fontSize: '13px' }}>
              Setting up workbench space...
            </div>
          </div>
        )}

        {/* Active Game Space Runner */}
        {game && !loading && !errorMessage && (
          <div
            ref={containerRef}
            style={{
              backgroundColor: '#16120e',
              border: '4px solid #36281e',
              borderRadius: '12px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}
          >
            {/* Workbench Game Title Bar */}
            <div
              style={{
                backgroundColor: '#261c15',
                borderBottom: '1px solid #3d2d20',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>🎲</span>
                <div>
                  <span
                    style={{
                      color: '#fcf8ee',
                      fontSize: '14px',
                      fontWeight: 700,
                      fontFamily: 'var(--font-family-display)',
                    }}
                  >
                    {game.title}
                  </span>
                  <span
                    style={{
                      marginLeft: '8px',
                      fontSize: '10px',
                      fontFamily: 'var(--font-family-craft)',
                      backgroundColor: '#1b4731',
                      color: '#e8c872',
                      padding: '2px 5px',
                      borderRadius: '3px',
                    }}
                  >
                    v{game.version}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {gameReady ? (
                  <span
                    style={{
                      fontSize: '11px',
                      color: '#34d399',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontFamily: 'var(--font-family-craft)',
                    }}
                  >
                    <CheckCircle size={12} /> Running
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '11px',
                      color: '#e8c872',
                      fontFamily: 'var(--font-family-craft)',
                    }}
                  >
                    Initializing...
                  </span>
                )}
              </div>
            </div>

            {/* Iframe Sandbox Container */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                minHeight: '620px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#1a1612',
              }}
            >
              <iframe
                key={iframeKey}
                ref={iframeRef}
                src={resolvedSrc || undefined}
                srcDoc={resolvedSrcDoc || undefined}
                title={game.title}
                sandbox="allow-scripts allow-forms allow-pointer-lock"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                style={{
                  width: '100%',
                  height: '620px',
                  border: 'none',
                  backgroundColor: 'transparent',
                }}
              />
            </div>

            {/* Individual Game Leaderboard Modal Overlay (Triggered automatically when game ends) */}
            {showLeaderboardModal && gameLeaderboard && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(15, 12, 10, 0.92)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px',
                  zIndex: 50,
                }}
              >
                <div
                  style={{
                    backgroundColor: '#261e17',
                    border: '2px solid #e8c872',
                    borderRadius: '12px',
                    padding: '28px 32px',
                    maxWidth: '560px',
                    width: '100%',
                    boxShadow: '0 12px 36px rgba(0,0,0,0.8)',
                    textAlign: 'center',
                    color: '#fcf8ee',
                  }}
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#e8c872', marginBottom: '8px' }}>
                    <Trophy size={28} />
                    <span style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>
                      Game Complete!
                    </span>
                  </div>

                  <h2 style={{ fontFamily: 'var(--font-family-display)', fontSize: '24px', margin: '4px 0 16px 0', color: '#fcf8ee' }}>
                    {gameLeaderboard.game_title} Leaderboard
                  </h2>

                  <div style={{ fontSize: '12px', color: '#b0a695', marginBottom: '16px' }}>
                    Ranked by {gameLeaderboard.ranking_criterion === 'lowest-score' ? 'Lowest' : 'Highest'} {gameLeaderboard.unit_label || 'Score'} (Game-Specific Rules)
                  </div>

                  {/* Leaderboard Table */}
                  <div
                    style={{
                      backgroundColor: '#1b1612',
                      border: '1px solid #4a3828',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      marginBottom: '20px',
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#211913', borderBottom: '1px solid #4a3828', color: '#e8c872' }}>
                          <th style={{ padding: '10px 14px', width: '50px' }}>Rank</th>
                          <th style={{ padding: '10px 14px' }}>Participant</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right' }}>Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gameLeaderboard.entries.map((entry) => {
                          const isCurrent = entry.participant_id === currentParticipant?.id;
                          return (
                            <tr
                              key={entry.participant_id}
                              style={{
                                borderBottom: '1px solid #2d2219',
                                backgroundColor: isCurrent ? 'rgba(27, 71, 49, 0.35)' : 'transparent',
                              }}
                            >
                              <td style={{ padding: '10px 14px', fontWeight: 700, color: entry.rank === 1 ? '#e8c872' : '#fcf8ee' }}>
                                #{entry.rank}
                              </td>
                              <td style={{ padding: '10px 14px', fontWeight: isCurrent ? 700 : 500 }}>
                                {entry.participant_name}
                                {isCurrent && (
                                  <span style={{ marginLeft: '6px', fontSize: '10px', color: '#86efac', backgroundColor: '#132117', padding: '1px 5px', borderRadius: '3px' }}>
                                    YOU
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#e8c872' }}>
                                {entry.summary || `${entry.score} ${gameLeaderboard.unit_label}`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Actions based on role */}
                  {currentParticipant?.role === 'host' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                        <button
                          onClick={handleHostReturnToLobby}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: '#1b4731',
                            color: '#e8c872',
                            border: '1px solid #2d6a45',
                            borderRadius: '6px',
                            padding: '10px 18px',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <Sparkles size={15} />
                          <span>Return to Lobby (Next Game)</span>
                        </button>

                        <button
                          onClick={handleHostEndSession}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: '#382218',
                            color: '#fca5a5',
                            border: '1px solid #5c2c1c',
                            borderRadius: '6px',
                            padding: '10px 18px',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <LogOut size={15} />
                          <span>End Session (View Recap)</span>
                        </button>
                      </div>

                      <button
                        onClick={() => setShowLeaderboardModal(false)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#b0a695',
                          fontSize: '12px',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          marginTop: '4px',
                        }}
                      >
                        Dismiss Overlay & Inspect Game Screen
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <p style={{ fontSize: '13px', color: '#b0a695', margin: 0 }}>
                        Waiting for Host to return to the session lobby or end the multiplayer session...
                      </p>
                      <button
                        onClick={() => setShowLeaderboardModal(false)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#86efac',
                          fontSize: '12px',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        Inspect Game Screen
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CuttingMat>
    </div>
  );
};
