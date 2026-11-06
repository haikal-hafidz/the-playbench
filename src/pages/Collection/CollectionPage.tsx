import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers,
  Search,
  Gamepad2,
  SlidersHorizontal,
  Clock,
  Tag,
  Users,
  Trash2,
  AlertTriangle,
  X
} from 'lucide-react';
import { gameRegistry } from '../../services/games';
import { Game } from '../../types';
import { CuttingMat } from '../../components/desk/CuttingMat';
import { CraftCard } from '../../components/common/CraftCard';
import { IntentionalEmptyState } from '../../components/desk/IntentionalEmptyState';

export const CollectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'plays'>('recent');

  // Deletion modal state
  const [deletingGame, setDeletingGame] = useState<Game | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadCollection() {
      try {
        const loaded = await gameRegistry.getAllGames();
        if (isMounted) {
          setGames(loaded);
          setLoading(false);
        }
      } catch (err) {
        console.warn('Error loading collection:', err);
        if (isMounted) setLoading(false);
      }
    }
    loadCollection();
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    games.forEach((g) => g.genre.forEach((cat) => set.add(cat)));
    return ['all', ...Array.from(set)];
  }, [games]);

  // Filtered and sorted games
  const filteredGames = useMemo(() => {
    return games
      .filter((game) => {
        const matchesSearch =
          game.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (game.tagline && game.tagline.toLowerCase().includes(searchQuery.toLowerCase())) ||
          game.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesCat =
          selectedCategory === 'all' || game.genre.includes(selectedCategory);

        return matchesSearch && matchesCat;
      })
      .sort((a, b) => {
        if (sortBy === 'recent') {
          return (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0);
        } else if (sortBy === 'plays') {
          return (b.playCount || 0) - (a.playCount || 0);
        } else {
          return a.title.localeCompare(b.title);
        }
      });
  }, [games, searchQuery, selectedCategory, sortBy]);

  const handleDeleteGame = async () => {
    if (!deletingGame) return;
    if (deleteConfirmationText !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm.');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await gameRegistry.deleteGame(deletingGame.id);
      setGames((prev) => prev.filter((g) => g.id !== deletingGame.id));
      setDeletingGame(null);
      setDeleteConfirmationText('');
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete game.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 20px 48px 20px' }}>
      {/* Safe Delete Game Confirmation Modal */}
      {deletingGame && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#261e17',
              border: '2px solid #752828',
              borderRadius: '12px',
              padding: '28px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fca5a5' }}>
                <AlertTriangle size={20} />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                  Safe Game Deletion
                </h3>
              </div>
              <button
                onClick={() => {
                  setDeletingGame(null);
                  setDeleteConfirmationText('');
                  setDeleteError(null);
                }}
                style={{ background: 'none', border: 'none', color: '#b0a695', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ color: '#d0c6b6', fontSize: '13px', lineHeight: 1.5, marginBottom: '16px' }}>
              Are you sure you want to remove <strong>{deletingGame.title}</strong>? This action will permanently remove the game record, its save data, and extracted package files from local storage.
            </p>

            {deleteError && (
              <div
                style={{
                  backgroundColor: '#451a1a',
                  border: '1px solid #752828',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  marginBottom: '16px',
                  color: '#fecaca',
                  fontSize: '12px',
                }}
              >
                {deleteError}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#d0c6b6', marginBottom: '6px' }}>
                Type <strong>DELETE</strong> below to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder="DELETE"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#1b1612',
                  border: '1px solid #752828',
                  borderRadius: '6px',
                  color: '#fcf8ee',
                  fontSize: '13px',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => {
                  setDeletingGame(null);
                  setDeleteConfirmationText('');
                  setDeleteError(null);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3d2f24',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#d0c6b6',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                onClick={handleDeleteGame}
                disabled={isDeleting || deleteConfirmationText !== 'DELETE'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  backgroundColor: deleteConfirmationText === 'DELETE' ? '#991b1b' : '#451a1a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: deleteConfirmationText === 'DELETE' ? 'pointer' : 'not-allowed',
                }}
              >
                <Trash2 size={14} />
                <span>{isDeleting ? 'Deleting...' : 'Delete Game'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      <CuttingMat>
        {/* Header Title Section */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px dashed rgba(232, 200, 114, 0.3)',
          paddingBottom: '16px',
        }}>
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: 'var(--font-family-craft)',
              fontSize: '11px',
              color: '#e8c872',
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}>
              <Layers size={14} />
              <span>Workshop Archives • Registered Games</span>
            </div>
            <h1 style={{
              fontFamily: 'var(--font-family-display)',
              fontSize: '26px',
              color: '#fcf8ee',
              fontWeight: 700,
              marginTop: '4px',
            }}>
              Game Collection
            </h1>
            <p style={{
              color: '#c9d1cc',
              fontSize: '13px',
              marginTop: '2px',
              maxWidth: '560px',
            }}>
              Explore, filter, and launch independent micro-games on your workbench. Every game runs in a secure sandboxed container.
            </p>
          </div>

          <div style={{
            fontFamily: 'var(--font-family-craft)',
            fontSize: '11px',
            backgroundColor: 'rgba(0,0,0,0.3)',
            color: '#e8c872',
            padding: '6px 12px',
            borderRadius: '20px',
            border: '1px solid rgba(232, 200, 114, 0.3)',
          }}>
            {games.length} {games.length === 1 ? 'Game Registered' : 'Games Registered'}
          </div>
        </div>

        {/* Search, Filter & Sort Controls Bar */}
        <div style={{
          backgroundColor: '#1b1612',
          border: '1px solid #3d2f24',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          {/* Search bar */}
          <div style={{
            position: 'relative',
            flex: '1 1 260px',
            maxWidth: '380px',
          }}>
            <Search size={15} color="#a19582" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Search by title or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#27201a',
                border: '1px solid #453424',
                borderRadius: '6px',
                padding: '8px 12px 8px 34px',
                color: '#fcf8ee',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          {/* Category Filter Pills */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#9e9180', fontFamily: 'var(--font-family-craft)', marginRight: '2px' }}>
              Genre:
            </span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-family-craft)',
                  textTransform: 'capitalize',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  backgroundColor: selectedCategory === cat ? '#1b4731' : '#27201a',
                  color: selectedCategory === cat ? '#e8c872' : '#c5bcab',
                  border: selectedCategory === cat ? '1px solid #e8c872' : '1px solid #453424',
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SlidersHorizontal size={14} color="#a19582" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                backgroundColor: '#27201a',
                border: '1px solid #453424',
                color: '#fcf8ee',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                outline: 'none',
              }}
            >
              <option value="recent">Recently Played</option>
              <option value="name">Title (A-Z)</option>
              <option value="plays">Most Played</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#e8c872' }}>
            <div style={{ fontFamily: 'var(--font-family-craft)', fontSize: '14px' }}>
              Examining workbench archives...
            </div>
          </div>
        )}

        {/* Empty Search Matches State */}
        {!loading && filteredGames.length === 0 && (
          <IntentionalEmptyState
            icon={Layers}
            title={games.length === 0 ? 'No Games Registered' : 'No Matching Games Found'}
            description={
              games.length === 0
                ? 'Your game collection is empty. Craft a new game through Workshop or import an existing TPGP package.'
                : `No games match the current query "${searchQuery}" or selected category filter.`
            }
            primaryActionLabel={games.length === 0 ? 'Create Game in Workshop' : 'Clear Filters'}
            onPrimaryAction={
              games.length === 0
                ? () => navigate('/workshop')
                : () => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }
            }
          />
        )}

        {/* Game Cards Grid */}
        {!loading && filteredGames.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '20px',
          }}>
            {filteredGames.map((game) => (
              <CraftCard
                key={game.id}
                title={game.title}
                tagline={game.tagline}
                badge={`v${game.version}`}
                icon={Gamepad2}
                actionText="Launch into Game Space"
                onAction={() => navigate(`/gamespace/${game.id}`)}
              >
                {/* Description snippet */}
                <p style={{
                  fontSize: '12px',
                  color: '#4f5752',
                  lineHeight: 1.45,
                  marginBottom: '12px',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {game.description}
                </p>

                {/* Metadata badges strip */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  borderTop: '1px dashed #dcd1be',
                  paddingTop: '10px',
                  fontSize: '11px',
                  color: '#535c56',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Users size={12} color="#1b4731" />
                    <span>{game.players.type === 'solo' ? 'Solo' : 'Pass & Play'}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginLeft: '6px' }}>
                    <Tag size={12} color="#1b4731" />
                    <span>{game.genre.join(', ')}</span>
                  </div>

                  {game.lastPlayedAt && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginLeft: 'auto', color: '#7a6a4e' }}>
                      <Clock size={11} />
                      <span>{new Date(game.lastPlayedAt).toLocaleDateString()}</span>
                    </div>
                  )}

                  {/* Safe Deletion trigger button (Host-only, available for all games including sample games) */}
                  <button
                    title="Safely Delete Game"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingGame(game);
                      setDeleteConfirmationText('');
                      setDeleteError(null);
                    }}
                    style={{
                      marginLeft: 'auto',
                      background: 'none',
                      border: 'none',
                      color: '#991b1b',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                      fontSize: '11px',
                    }}
                  >
                    <Trash2 size={12} />
                    <span>Delete</span>
                  </button>
                </div>
              </CraftCard>
            ))}
          </div>
        )}
      </CuttingMat>
    </div>
  );
};
