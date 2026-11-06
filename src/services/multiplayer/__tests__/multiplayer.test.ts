import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { multiplayerService } from '../multiplayerService';
import { supabaseService } from '../../backup/supabaseClient';
import { gameRegistry, BUNDLED_GAMES } from '../../games/gameRegistry';
import {
  getUserRole,
  setUserRole,
  clearUserRole,
  hasSelectedRole,
} from '../../storage/preferences';
import { Game } from '../../../types';

const SAMPLE_GAMES: Game[] = [
  ...BUNDLED_GAMES,
  {
    id: 'custom-card-game',
    title: 'Custom Cards',
    description: 'A custom card game for multiplayer testing.',
    genre: ['cards'],
    version: '1.0.0',
    runtime: { type: 'html-standalone', entrypoint: 'index.html' },
    players: { min: 2, max: 4, type: 'pass-and-play' },
    tags: ['cards'],
    offlineCapable: true,
    packageOrigin: 'imported-json',
    playCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

describe('Stage 7 Multiplayer Session Service & Game Selection Voting', () => {
  beforeEach(() => {
    localStorage.clear();
    multiplayerService.clearActiveSession();
    vi.restoreAllMocks();
  });

  describe('Role Selection & Gate Storage', () => {
    it('initializes with null role when unselected', () => {
      clearUserRole();
      expect(getUserRole()).toBeNull();
      expect(hasSelectedRole()).toBe(false);
    });

    it('sets and retrieves host role accurately', () => {
      setUserRole('host');
      expect(getUserRole()).toBe('host');
      expect(hasSelectedRole()).toBe(true);
    });

    it('sets and retrieves player role accurately', () => {
      setUserRole('player');
      expect(getUserRole()).toBe('player');
      expect(hasSelectedRole()).toBe(true);
    });

    it('clears role when requested', () => {
      setUserRole('host');
      clearUserRole();
      expect(getUserRole()).toBeNull();
      expect(hasSelectedRole()).toBe(false);
    });
  });

  describe('Participant Display Names & Duplicate Disambiguation', () => {
    it('generates valid uppercase alphanumeric session codes', () => {
      const code = multiplayerService.generateSessionCode();
      expect(code).toHaveLength(6);
      expect(multiplayerService.validateSessionCode(code)).toBe(true);
    });

    it('requires host display name to create session', async () => {
      await expect(
        multiplayerService.createSession(SAMPLE_GAMES, '')
      ).rejects.toThrow(/Host must enter a display name/i);
    });

    it('requires player display name to join session', async () => {
      const { session } = await multiplayerService.createSession(
        SAMPLE_GAMES,
        'Host Fox'
      );

      await expect(
        multiplayerService.joinSession(session.code, '')
      ).rejects.toThrow(/enter a display name/i);
    });

    it('assigns unique internal player IDs and disambiguates duplicate display names', async () => {
      const { session, hostParticipant } = await multiplayerService.createSession(
        SAMPLE_GAMES,
        'Host Fox'
      );

      const { participant: p1 } = await multiplayerService.joinSession(
        session.code,
        'Player Rabbit'
      );

      const { participant: p2 } = await multiplayerService.joinSession(
        session.code,
        'Player Rabbit'
      );

      const { participant: p3 } = await multiplayerService.joinSession(
        session.code,
        'Player Rabbit'
      );

      expect(hostParticipant.id).not.toBe(p1.id);
      expect(p1.id).not.toBe(p2.id);
      expect(p2.id).not.toBe(p3.id);

      expect(p1.player_name).toBe('Player Rabbit');
      expect(p2.player_name).toBe('Player Rabbit (2)');
      expect(p3.player_name).toBe('Player Rabbit (3)');

      const sessionData = multiplayerService.getSessionData(session.id);
      expect(sessionData?.participants).toHaveLength(4); // Host + 3 players
    });

    it('rejects joining an invalid or expired session code', async () => {
      await expect(
        multiplayerService.joinSession('ZZZZ99', 'Guest')
      ).rejects.toThrow(/not found or has expired/i);
    });
  });

  describe('Supabase Error Inspection & Zero-Trust RPC Room Security', () => {
    it('explicitly throws actionable error when Supabase create_multiplayer_session_rpc fails', async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'relation "multiplayer_sessions" does not exist' },
      });

      const mockClient = {
        rpc: mockRpc,
      } as any;

      vi.spyOn(supabaseService, 'getClient').mockReturnValue(mockClient);

      await expect(
        multiplayerService.createSession(SAMPLE_GAMES, 'Host Fox')
      ).rejects.toThrow(/Cloud multiplayer session creation failed: relation "multiplayer_sessions" does not exist/i);
    });

    it('protects room privacy: discoverRoomByCode returns only sanitized metadata without leaking rosters or tokens', async () => {
      const mockDiscoveryData = {
        id: 'sess-disc-1',
        code: 'DSC123',
        status: 'voting',
        participant_count: 3,
        max_participants: 12,
        game_count: 2,
        created_at: new Date().toISOString(),
      };

      const mockClient = {
        rpc: vi.fn().mockImplementation((fn: string) => {
          if (fn === 'discover_room_by_code_rpc') {
            return Promise.resolve({ data: mockDiscoveryData, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      } as any;

      vi.spyOn(supabaseService, 'getClient').mockReturnValue(mockClient);

      const discovery = await multiplayerService.discoverRoomByCode('DSC123');
      expect(discovery).toBeDefined();
      expect(discovery?.code).toBe('DSC123');
      expect(discovery?.participant_count).toBe(3);
      expect((discovery as any).participants).toBeUndefined();
      expect((discovery as any).host_secret).toBeUndefined();
      expect((discovery as any).votes).toBeUndefined();
    });

    it('enforces join capacity limit and throws actionable error when session is full', async () => {
      const mockClient = {
        rpc: vi.fn().mockImplementation((fn: string) => {
          if (fn === 'discover_room_by_code_rpc') {
            return Promise.resolve({
              data: {
                id: 'sess-full',
                code: 'FULL01',
                status: 'voting',
                participant_count: 12,
                max_participants: 12,
                game_count: 2,
                created_at: new Date().toISOString(),
              },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      } as any;

      vi.spyOn(supabaseService, 'getClient').mockReturnValue(mockClient);

      await expect(
        multiplayerService.joinSession('FULL01', 'Player Alice')
      ).rejects.toThrow(/reached maximum participants limit/i);
    });

    it('rejects joining when game is already in progress', async () => {
      const mockClient = {
        rpc: vi.fn().mockImplementation((fn: string) => {
          if (fn === 'discover_room_by_code_rpc') {
            return Promise.resolve({
              data: {
                id: 'sess-play',
                code: 'PLAY01',
                status: 'in-progress',
                participant_count: 2,
                max_participants: 12,
                game_count: 2,
                created_at: new Date().toISOString(),
              },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      } as any;

      vi.spyOn(supabaseService, 'getClient').mockReturnValue(mockClient);

      await expect(
        multiplayerService.joinSession('PLAY01', 'Player Alice')
      ).rejects.toThrow(/gameplay is already in progress/i);
    });

    it('hydrates session data and available games from cloud across separate devices via get_room_state_rpc', async () => {
      const mockSessionData = {
        id: 'sess-cloud-1',
        code: 'CLD123',
        host_id: 'host-1',
        status: 'voting',
        settings: { maxPlayers: 6 },
        available_games: SAMPLE_GAMES,
        game_history: [],
      };

      const mockParticipants = [
        {
          id: 'host-p-1',
          session_id: 'sess-cloud-1',
          player_name: 'Host Master',
          role: 'host',
          is_connected: true,
          joined_at: new Date().toISOString(),
          last_heartbeat: new Date().toISOString(),
        },
      ];

      const mockClient = {
        rpc: vi.fn().mockImplementation((fn: string) => {
          if (fn === 'discover_room_by_code_rpc') {
            return Promise.resolve({
              data: {
                id: 'sess-cloud-1',
                code: 'CLD123',
                status: 'voting',
                participant_count: 1,
                max_participants: 6,
                game_count: SAMPLE_GAMES.length,
                created_at: new Date().toISOString(),
              },
              error: null,
            });
          }
          if (fn === 'join_multiplayer_session_rpc') {
            return Promise.resolve({
              data: {
                id: 'p-new-1',
                session_id: 'sess-cloud-1',
                player_name: 'Joining Player',
                role: 'player',
                joined_at: new Date().toISOString(),
              },
              error: null,
            });
          }
          if (fn === 'get_room_state_rpc') {
            return Promise.resolve({
              data: {
                session: mockSessionData,
                participants: mockParticipants,
                votes: [],
              },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      } as any;

      vi.spyOn(supabaseService, 'getClient').mockReturnValue(mockClient);

      const { session, participant } = await multiplayerService.joinSession('CLD123', 'Joining Player');
      expect(session).toBeDefined();
      expect(participant.player_name).toBe('Joining Player');

      const hydrated = multiplayerService.getSessionData('sess-cloud-1');
      expect(hydrated).toBeDefined();
      expect(hydrated?.availableGames).toHaveLength(SAMPLE_GAMES.length);
      expect(hydrated?.participants).toHaveLength(1);
      expect(hydrated?.participants[0].player_name).toBe('Host Master');
    });

    it('submits votes with participant token verification through submit_game_vote_rpc', async () => {
      const mockRpc = vi.fn().mockImplementation((fn: string) => {
        if (fn === 'submit_game_vote_rpc') {
          return Promise.resolve({ data: { id: 'vote-1' }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const mockClient = { rpc: mockRpc } as any;
      vi.spyOn(supabaseService, 'getClient').mockReturnValue(mockClient);

      const { session, hostParticipant } = await multiplayerService.createSession(SAMPLE_GAMES, 'Host');
      const token = multiplayerService.getParticipantToken(hostParticipant.id);
      expect(token).toBeDefined();

      const res = await multiplayerService.submitGameVote(session.id, hostParticipant.id, 'number-guess', 'Number Guess');
      expect(res.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('submit_game_vote_rpc', expect.objectContaining({
        p_session_id: session.id,
        p_participant_id: hostParticipant.id,
        p_participant_token: token,
        p_game_id: 'number-guess',
      }));
    });

    it('rejects host status operations if unauthorized in cloud RPC', async () => {
      const mockRpc = vi.fn().mockImplementation((fn: string) => {
        if (fn === 'host_update_session_status_rpc') {
          return Promise.resolve({
            data: null,
            error: { message: 'Unauthorized: only the host can update session status.' },
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const mockClient = { rpc: mockRpc } as any;
      vi.spyOn(supabaseService, 'getClient').mockReturnValue(mockClient);

      const { session } = await multiplayerService.createSession(SAMPLE_GAMES, 'Host');

      await expect(
        multiplayerService.closeGameSelectionVoting(session.id)
      ).rejects.toThrow(/Unauthorized: only the host can update session status/i);
    });
  });

  describe('Game Selection Voting Engine', () => {
    it('allows players to vote for exactly one game and tally votes correctly', async () => {
      const { session } = await multiplayerService.createSession(
        SAMPLE_GAMES,
        'Host'
      );

      const { participant: p1 } = await multiplayerService.joinSession(session.code, 'Player 1');
      const { participant: p2 } = await multiplayerService.joinSession(session.code, 'Player 2');

      await multiplayerService.submitGameVote(
        session.id,
        p1.id,
        'number-guess',
        'Number Guess'
      );

      const res2 = await multiplayerService.submitGameVote(
        session.id,
        p2.id,
        'memory-match',
        'Memory Match'
      );

      expect(res2.tally.totalVotes).toBe(2);
      expect(res2.tally.tallies['number-guess'].voteCount).toBe(1);
      expect(res2.tally.tallies['memory-match'].voteCount).toBe(1);
      expect(res2.tally.isTie).toBe(true);
    });

    it('replaces previous vote when a player changes their game selection (no duplicate votes)', async () => {
      const { session } = await multiplayerService.createSession(
        SAMPLE_GAMES,
        'Host'
      );

      const { participant: p1 } = await multiplayerService.joinSession(session.code, 'Player 1');

      await multiplayerService.submitGameVote(session.id, p1.id, 'number-guess', 'Number Guess');

      let data = multiplayerService.getSessionData(session.id);
      expect(data?.votes).toHaveLength(1);
      expect(data?.votes[0].game_id).toBe('number-guess');

      const updated = await multiplayerService.submitGameVote(
        session.id,
        p1.id,
        'memory-match',
        'Memory Match'
      );

      data = multiplayerService.getSessionData(session.id);
      expect(data?.votes).toHaveLength(1);
      expect(data?.votes[0].game_id).toBe('memory-match');
      expect(updated.tally.tallies['number-guess'].voteCount).toBe(0);
      expect(updated.tally.tallies['memory-match'].voteCount).toBe(1);
      expect(updated.tally.totalVotes).toBe(1);
    });

    it('closes voting, decides highest-voted game, and launches into Game Space', async () => {
      const { session } = await multiplayerService.createSession(SAMPLE_GAMES, 'Host');
      const { participant: p1 } = await multiplayerService.joinSession(session.code, 'Player 1');
      const { participant: p2 } = await multiplayerService.joinSession(session.code, 'Player 2');

      await multiplayerService.submitGameVote(session.id, p1.id, 'memory-match', 'Memory Match');
      await multiplayerService.submitGameVote(session.id, p2.id, 'memory-match', 'Memory Match');

      const finalVotingState = await multiplayerService.closeGameSelectionVoting(session.id);
      expect(finalVotingState.status).toBe('closed');
      expect(finalVotingState.winningGameId).toBe('memory-match');

      await expect(
        multiplayerService.submitGameVote(session.id, p1.id, 'number-guess', 'Number Guess')
      ).rejects.toThrow(/already closed/i);

      const startedGameId = await multiplayerService.startWinningGame(session.id);
      expect(startedGameId).toBe('memory-match');

      const finalSession = multiplayerService.getActiveSession();
      expect(finalSession?.status).toBe('in-progress');
      expect(finalSession?.winning_game_id).toBe('memory-match');
    });
  });

  describe('Individual Game Leaderboards & Final Session Results Recap', () => {
    it('ranks lowest-score games correctly (attempts/moves)', async () => {
      const { session, hostParticipant } = await multiplayerService.createSession(
        SAMPLE_GAMES,
        'Host Alex'
      );
      const { participant: p1 } = await multiplayerService.joinSession(session.code, 'Player 1');
      const { participant: p2 } = await multiplayerService.joinSession(session.code, 'Player 2');

      await multiplayerService.recordGameResult(
        session.id,
        'number-guess',
        'Number Guess',
        hostParticipant.id,
        7,
        'Solved in 7 attempts'
      );
      await multiplayerService.recordGameResult(
        session.id,
        'number-guess',
        'Number Guess',
        p1.id,
        3,
        'Solved in 3 attempts'
      );
      const lb = await multiplayerService.recordGameResult(
        session.id,
        'number-guess',
        'Number Guess',
        p2.id,
        5,
        'Solved in 5 attempts'
      );

      expect(lb.ranking_criterion).toBe('lowest-score');
      expect(lb.entries.length).toBe(3);
      expect(lb.entries[0].participant_id).toBe(p1.id);
      expect(lb.entries[0].rank).toBe(1);
      expect(lb.entries[0].score).toBe(3);

      expect(lb.entries[1].participant_id).toBe(p2.id);
      expect(lb.entries[1].rank).toBe(2);

      expect(lb.entries[2].participant_id).toBe(hostParticipant.id);
      expect(lb.entries[2].rank).toBe(3);
    });

    it('ranks highest-score games correctly (points)', async () => {
      const { session } = await multiplayerService.createSession(SAMPLE_GAMES, 'Host Alex');
      const { participant: p1 } = await multiplayerService.joinSession(session.code, 'Player 1');
      const { participant: p2 } = await multiplayerService.joinSession(session.code, 'Player 2');

      await multiplayerService.recordGameResult(
        session.id,
        'arcade-runner',
        'Arcade Runner',
        p1.id,
        1500,
        '1500 points'
      );
      const lb = await multiplayerService.recordGameResult(
        session.id,
        'arcade-runner',
        'Arcade Runner',
        p2.id,
        3200,
        '3200 points'
      );

      expect(lb.ranking_criterion).toBe('highest-score');
      expect(lb.entries[0].participant_id).toBe(p2.id);
      expect(lb.entries[0].score).toBe(3200);
      expect(lb.entries[1].participant_id).toBe(p1.id);
      expect(lb.entries[1].score).toBe(1500);
    });

    it('preserves distinct leaderboards in session recap without mixing incompatible metrics', async () => {
      const { session, hostParticipant } = await multiplayerService.createSession(
        SAMPLE_GAMES,
        'Host Alex'
      );
      const { participant: p1 } = await multiplayerService.joinSession(session.code, 'Player 1');

      await multiplayerService.recordGameResult(
        session.id,
        'number-guess',
        'Number Guess',
        hostParticipant.id,
        4,
        '4 attempts'
      );
      await multiplayerService.recordGameResult(
        session.id,
        'number-guess',
        'Number Guess',
        p1.id,
        6,
        '6 attempts'
      );

      await multiplayerService.returnToLobby(session.id);
      await multiplayerService.recordGameResult(
        session.id,
        'memory-match',
        'Memory Match',
        hostParticipant.id,
        12,
        '12 moves'
      );
      await multiplayerService.recordGameResult(
        session.id,
        'memory-match',
        'Memory Match',
        p1.id,
        10,
        '10 moves'
      );

      const recap = await multiplayerService.showFinalSessionRecap(session.id);
      expect(recap.status).toBe('session-recap');
      expect(recap.game_history.length).toBe(2);

      const ng = recap.game_history.find((g) => g.game_id === 'number-guess');
      const mm = recap.game_history.find((g) => g.game_id === 'memory-match');

      expect(ng).toBeDefined();
      expect(ng?.unit_label).toBe('attempts');
      expect(ng?.entries[0].participant_id).toBe(hostParticipant.id);

      expect(mm).toBeDefined();
      expect(mm?.unit_label).toBe('moves');
      expect(mm?.entries[0].participant_id).toBe(p1.id);
    });
  });

  describe('Game Deletion with Session Safeguards', () => {
    it('allows deleting both sample/bundled games and user-created games while protecting active sessions', async () => {
      await gameRegistry.init();

      const sampleGameId = BUNDLED_GAMES[0].id;
      const initialBundledCheck = await gameRegistry.canDeleteGame(sampleGameId);
      expect(initialBundledCheck.safe).toBe(true);

      const customGame: Game = {
        id: 'custom-trivia-game',
        title: 'Custom Trivia',
        description: 'Test',
        genre: ['trivia'],
        version: '1.0.0',
        runtime: { type: 'html-standalone', entrypoint: 'index.html' },
        players: { min: 1, max: 4, type: 'solo' },
        tags: ['trivia'],
        offlineCapable: true,
        packageOrigin: 'imported-json',
        playCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await gameRegistry.registerGame(customGame);

      const { session } = await multiplayerService.createSession([customGame], 'Host');

      await multiplayerService.closeGameSelectionVoting(session.id, 'custom-trivia-game');

      const activeSessionCheck = await gameRegistry.canDeleteGame('custom-trivia-game');
      expect(activeSessionCheck.safe).toBe(false);
      expect(activeSessionCheck.reason).toMatch(/active multiplayer session/i);

      multiplayerService.clearActiveSession();
      const clearedCheck = await gameRegistry.canDeleteGame('custom-trivia-game');
      expect(clearedCheck.safe).toBe(true);

      await gameRegistry.deleteGame('custom-trivia-game');
      const retrievedCustom = await gameRegistry.getGameById('custom-trivia-game');
      expect(retrievedCustom).toBeUndefined();

      await gameRegistry.deleteGame(sampleGameId);
      const allGamesAfterDelete = await gameRegistry.getAllGames();
      expect(allGamesAfterDelete.find((g) => g.id === sampleGameId)).toBeUndefined();
    });
  });
});
