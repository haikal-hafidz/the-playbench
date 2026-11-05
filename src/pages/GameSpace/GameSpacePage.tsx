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
  HardDrive
} from 'lucide-react';
import { gameRegistry } from '../../services/games';
import { SandboxBridge } from '../../services/runtime';
import { Game } from '../../types';
import { CuttingMat } from '../../components/desk/CuttingMat';

const LOAD_TIMEOUT_MS = 8000;

export const GameSpacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [gameReady, setGameReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState<number>(0);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<SandboxBridge>(new SandboxBridge());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timeout helper
  const clearInitTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Reset state when game ID route changes to prevent stale data
  useEffect(() => {
    let isMounted = true;
    clearInitTimeout();
    bridgeRef.current.detach();

    // Reset all game state immediately on id change
    setGame(null);
    setLoading(true);
    setErrorMessage(null);
    setGameReady(false);
    setLastSavedTime(null);
    setSaveError(null);
    setIframeKey(k => k + 1);

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
        setLoading(false);

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
    };
  }, [id, clearInitTimeout]);

  // Set up initialization timeout and sandbox bridge
  useEffect(() => {
    if (!game || !iframeRef.current) return;

    clearInitTimeout();

    // Start 8-second handshake timeout
    timeoutRef.current = setTimeout(() => {
      if (!gameReady) {
        setErrorMessage(`Game "${game.title}" did not respond within ${LOAD_TIMEOUT_MS / 1000} seconds. It may be missing initialization scripts or failed to execute.`);
      }
    }, LOAD_TIMEOUT_MS);

    const detach = bridgeRef.current.attach(
      iframeRef.current,
      game.id,
      {
        onMounted: () => {
          // Handshake acknowledged; keep timeout active until onReady
        },
        onReady: () => {
          clearInitTimeout();
          setGameReady(true);
          setErrorMessage(null);
        },
        onSaveConfirmed: () => {
          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setLastSavedTime(timeStr);
          setSaveError(null);
        },
        onSaveError: (slot, err) => {
          setSaveError(`Slot "${slot}": ${err}`);
        },
        onGameOver: () => {
          // Handled within game UI, acknowledged here
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

  // Handle iframe load event to proactively trigger handshake if not already done
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
      // Remount iframe cleanly with updated key
      setIframeKey(k => k + 1);
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

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '20px 20px 48px 20px' }}>
      <CuttingMat>
        {/* Navigation & Toolbar Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
        }}>
          <button
            onClick={() => navigate('/collection')}
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
            }}
          >
            <ArrowLeft size={15} />
            <span>Return to Collection</span>
          </button>

          {game && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {saveError && (
                <div style={{
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
                }}>
                  <AlertTriangle size={12} color="#ff8585" />
                  <span>{saveError}</span>
                </div>
              )}

              {lastSavedTime && (
                <div style={{
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
                }}>
                  <HardDrive size={12} color="#34d399" />
                  <span>Saved at {lastSavedTime}</span>
                </div>
              )}

              <div style={{
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
              }}>
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
          <div style={{
            backgroundColor: 'var(--color-paper-card)',
            borderRadius: '8px',
            border: '2px solid #c93b2b',
            boxShadow: 'var(--shadow-desk-card)',
            padding: '36px 24px',
            textAlign: 'center',
            maxWidth: '560px',
            margin: '40px auto',
          }}>
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
                }}
              >
                Browse Collection
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div style={{
            minHeight: '400px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fcf8ee',
            gap: '12px',
          }}>
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
            }}
          >
            {/* Workbench Game Title Bar */}
            <div style={{
              backgroundColor: '#261c15',
              borderBottom: '1px solid #3d2d20',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>🎲</span>
                <div>
                  <span style={{
                    color: '#fcf8ee',
                    fontSize: '14px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-family-display)',
                  }}>
                    {game.title}
                  </span>
                  <span style={{
                    marginLeft: '8px',
                    fontSize: '10px',
                    fontFamily: 'var(--font-family-craft)',
                    backgroundColor: '#1b4731',
                    color: '#e8c872',
                    padding: '2px 5px',
                    borderRadius: '3px',
                  }}>
                    v{game.version}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {gameReady ? (
                  <span style={{
                    fontSize: '11px',
                    color: '#34d399',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontFamily: 'var(--font-family-craft)',
                  }}>
                    <CheckCircle size={12} /> Running
                  </span>
                ) : (
                  <span style={{
                    fontSize: '11px',
                    color: '#e8c872',
                    fontFamily: 'var(--font-family-craft)',
                  }}>
                    Initializing...
                  </span>
                )}
              </div>
            </div>

            {/* Iframe Sandbox Container */}
            <div style={{
              position: 'relative',
              width: '100%',
              minHeight: '620px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#1a1612',
            }}>
              <iframe
                key={iframeKey}
                ref={iframeRef}
                src={game.runtime.entrypoint}
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
          </div>
        )}
      </CuttingMat>
    </div>
  );
};
