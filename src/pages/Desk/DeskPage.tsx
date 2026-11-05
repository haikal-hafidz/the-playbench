import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Gamepad2,
  History,
  Hammer,
  Plus,
  Upload,
  Terminal,
  ScrollText,
  Sparkles,
  Layers
} from 'lucide-react';
import { CuttingMat } from '../../components/desk/CuttingMat';
import { DeskSection } from '../../components/desk/DeskSection';
import { CraftCard } from '../../components/common/CraftCard';
import { IntentionalEmptyState } from '../../components/desk/IntentionalEmptyState';
import { gameRegistry } from '../../services/games';
import { playbenchDB } from '../../services/storage';
import { Game, GameProject } from '../../types';

export const DeskPage: React.FC = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [projects, setProjects] = useState<GameProject[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function loadWorkbenchData() {
      try {
        const [loadedGames, loadedProjects] = await Promise.all([
          gameRegistry.getAllGames(),
          playbenchDB.getAllProjects(),
        ]);
        if (isMounted) {
          setGames(loadedGames);
          setProjects(loadedProjects);
        }
      } catch (err) {
        console.warn('Could not read IndexedDB stores directly; using empty workbench states.', err);
      }
    }
    loadWorkbenchData();
    return () => {
      isMounted = false;
    };
  }, []);

  const recentlyPlayed = games
    .filter((g) => g.lastPlayedAt && g.lastPlayedAt > 0)
    .sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0))
    .slice(0, 4);

  const inDevelopment = projects
    .filter((p) => p.status === 'active' || p.status === 'draft')
    .slice(0, 3);

  return (
    <div style={{
      maxWidth: '1440px',
      margin: '0 auto',
      padding: '24px 20px 48px 20px',
    }}>
      {/* Workbench Tabletop Wrapper */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 300px',
        gap: '24px',
        alignItems: 'start',
      }} className="desk-grid-layout">

        {/* Central Cutting Mat Canvas (Visual Centerpiece) */}
        <div style={{ minWidth: 0 }}>
          <CuttingMat>
            {/* Header intro on mat */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '28px',
              flexWrap: 'wrap',
              gap: '12px',
            }}>
              <div>
                <span style={{
                  fontFamily: 'var(--font-family-craft)',
                  fontSize: '11px',
                  color: '#e8c872',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                }}>
                  Creative Workspace • Bench 01
                </span>
                <h1 style={{
                  fontFamily: 'var(--font-family-display)',
                  fontSize: '26px',
                  color: '#fcf8ee',
                  fontWeight: 700,
                  marginTop: '2px',
                }}>
                  The Playbench
                </h1>
                <p style={{
                  color: '#c9d1cc',
                  fontSize: '13px',
                  marginTop: '4px',
                  maxWidth: '540px',
                }}>
                  "A little workshop for little games." Collect, develop, import, manage, and play original small games directly on this workbench.
                </p>
              </div>

              {/* Quick Actions Strip */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => navigate('/workshop')}
                  style={{
                    backgroundColor: '#e8c872',
                    color: '#1b1612',
                    fontWeight: 600,
                    fontSize: '12px',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  }}
                >
                  <Plus size={15} />
                  <span>New Game</span>
                </button>
                <button
                  onClick={() => navigate('/import')}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    color: '#fcf8ee',
                    fontWeight: 500,
                    fontSize: '12px',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Upload size={14} />
                  <span>Import</span>
                </button>
              </div>
            </div>

            {/* SECTION 1: My Games */}
            <DeskSection
              title="My Games"
              badge={games.length ? `${games.length} registered` : 'Clean Mat'}
              icon={Gamepad2}
            >
              {games.length === 0 ? (
                <IntentionalEmptyState
                  icon={Gamepad2}
                  title="Your cutting mat is clear"
                  description="No games have been registered to your workbench yet. You can craft a new game through a Workshop Creation Letter, or import an existing TPGP package via ZIP, JSON, or URL."
                  primaryActionLabel="Create First Game"
                  onPrimaryAction={() => navigate('/workshop')}
                  secondaryActionLabel="Import Game Package"
                  onSecondaryAction={() => navigate('/import')}
                />
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: '16px',
                }}>
                  {games.map((game) => (
                    <CraftCard
                      key={game.id}
                      title={game.title}
                      tagline={game.tagline}
                      badge={`v${game.version}`}
                      icon={Gamepad2}
                      actionText="Play Game"
                      onAction={() => navigate(`/gamespace/${game.id}`)}
                    >
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {game.genre.map((g) => (
                          <span
                            key={g}
                            style={{
                              fontSize: '10px',
                              fontFamily: 'var(--font-family-craft)',
                              backgroundColor: '#e6dfd1',
                              padding: '2px 5px',
                              borderRadius: '3px',
                            }}
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    </CraftCard>
                  ))}
                </div>
              )}
            </DeskSection>

            {/* SECTION 2: Recently Played */}
            <DeskSection
              title="Recently Played"
              icon={History}
              badge={recentlyPlayed.length ? `${recentlyPlayed.length} recent` : 'No Sessions Yet'}
            >
              {recentlyPlayed.length === 0 ? (
                <IntentionalEmptyState
                  icon={History}
                  title="No game sessions recorded"
                  description="When you or friends launch games on this bench, your recent plays, scores, and save slots will be tracked right here."
                  secondaryActionLabel="Explore Collection"
                  onSecondaryAction={() => navigate('/collection')}
                />
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '14px',
                }}>
                  {recentlyPlayed.map((game) => (
                    <CraftCard
                      key={game.id}
                      title={game.title}
                      tagline={`Played ${new Date(game.lastPlayedAt!).toLocaleDateString()}`}
                      actionText="Resume Play"
                      onAction={() => navigate(`/gamespace/${game.id}`)}
                    />
                  ))}
                </div>
              )}
            </DeskSection>

            {/* SECTION 3: In Development (Workshop drafts) */}
            <DeskSection
              title="In Development"
              icon={Hammer}
              badge={inDevelopment.length ? `${inDevelopment.length} in forge` : 'No Active Drafts'}
            >
              {inDevelopment.length === 0 ? (
                <IntentionalEmptyState
                  icon={Hammer}
                  title="No active development drafts"
                  description="Ready to bring a new game idea to life? The Workshop lets you write structured Creation Letters, manage task checklists, and export AI prompts."
                  primaryActionLabel="Start Creation Letter"
                  onPrimaryAction={() => navigate('/workshop?mode=create')}
                />
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '14px',
                }}>
                  {inDevelopment.map((p) => (
                    <CraftCard
                      key={p.id}
                      title={p.title}
                      badge={p.status}
                      actionText="Open Workshop"
                      onAction={() => navigate('/workshop')}
                    />
                  ))}
                </div>
              )}
            </DeskSection>
          </CuttingMat>
        </div>

        {/* Sidebar: Tabletop Stationery & Quick Reference Tools */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Sticky Note 1: Maker Philosophy */}
          <div className="craft-sticky-note">
            <div style={{
              fontWeight: 700,
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#473d09',
            }}>
              <span>📌</span> Workbench Manifesto
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: '#574d15' }}>
              Games on this bench are small, purposeful, and self-contained. No paywalls. No mandatory online multiplayer. Pure play craftsmanship.
            </p>
          </div>

          {/* Quick Action Navigation Cards */}
          <div style={{
            backgroundColor: '#1e1814',
            border: '2px solid #36291e',
            borderRadius: '10px',
            padding: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}>
            <h3 style={{
              fontFamily: 'var(--font-family-display)',
              fontSize: '14px',
              color: '#e8c872',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <Sparkles size={15} />
              <span>Workbench Tools</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => navigate('/collection')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: '#27201a',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #403022',
                  color: '#fcf8ee',
                  fontSize: '13px',
                  textAlign: 'left',
                }}
              >
                <Layers size={16} color="#e8c872" />
                <div>
                  <div style={{ fontWeight: 600 }}>Game Collection</div>
                  <div style={{ fontSize: '11px', color: '#9e9180' }}>Browse & launch games</div>
                </div>
              </button>

              <button
                onClick={() => navigate('/protocol')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: '#27201a',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #403022',
                  color: '#fcf8ee',
                  fontSize: '13px',
                  textAlign: 'left',
                }}
              >
                <ScrollText size={16} color="#e8c872" />
                <div>
                  <div style={{ fontWeight: 600 }}>TPGP Standard</div>
                  <div style={{ fontSize: '11px', color: '#9e9180' }}>Package manifest format</div>
                </div>
              </button>

              <button
                onClick={() => navigate('/workshop?mode=create')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: '#27201a',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #403022',
                  color: '#fcf8ee',
                  fontSize: '13px',
                  textAlign: 'left',
                }}
              >
                <Terminal size={16} color="#e8c872" />
                <div>
                  <div style={{ fontWeight: 600 }}>Prompt Station</div>
                  <div style={{ fontSize: '11px', color: '#9e9180' }}>Ready-to-use LLM prompts</div>
                </div>
              </button>
            </div>
          </div>

          {/* Sticky Note 2: TPGP Info */}
          <div
            className="craft-sticky-note"
            style={{
              backgroundColor: '#ffd3e2',
              color: '#52202f',
              transform: 'rotate(1.2deg)',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>
              📦 TPGP v1.0
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: '#662d3e' }}>
              Import any ZIP package with a <code>tpgp.json</code> manifest. Games execute in a secure sandboxed runner.
            </p>
          </div>
        </aside>
      </div>

      {/* Responsive adjustments */}
      <style>{`
        @media (max-width: 980px) {
          .desk-grid-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
