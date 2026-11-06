import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { multiplayerService } from '../multiplayerService';
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

  describe('Session Lifecycle & Game Selection Voting', () => {
    it('generates valid uppercase alphanumeric session codes', () => {
      const code = multiplayerService.generateSessionCode();
      expect(code).toHaveLength(6);
      expect(multiplayerService.validateSessionCode(code)).toBe(true);
    });

    it('creates a multiplayer session with voting status and host participant', async () => {
      const { session, hostParticipant } = await multiplayerService.createSession(
        SAMPLE_GAMES,
        'Host Fox'
      );

      expect(session.id).toBeDefined();
      expect(session.code).toHaveLength(6);
      expect(session.status).toBe('voting');
      expect(hostParticipant.role).toBe('host');
      expect(hostParticipant.player_name).toBe('Host Fox');

      const active = multiplayerService.getActiveSession();
      expect(active?.code).toBe(session.code);

      const data = multiplayerService.getSessionData(session.id);
      expect(data?.availableGames).toHaveLength(SAMPLE_GAMES.length);
    });

    it('allows players to join an active session with validation', async () => {
      const { session } = await multiplayerService.createSession(
        SAMPLE_GAMES,
        'Host Fox'
      );

      const { participant } = await multiplayerService.joinSession(
        session.code,
        'Player Rabbit'
      );

      expect(participant.role).toBe('player');
      expect(participant.player_name).toBe('Player Rabbit');
      expect(participant.session_id).toBe(session.id);

      const sessionData = multiplayerService.getSessionData(session.id);
      expect(sessionData?.participants).toHaveLength(2); // Host + Player
    });

    it('rejects joining when display name is duplicate in the same session', async () => {
      const { session } = await multiplayerService.createSession(
        SAMPLE_GAMES,
        'Host Fox'
      );

      await multiplayerService.joinSession(session.code, 'Player Rabbit');

      await expect(
        multiplayerService.joinSession(session.code, 'Player Rabbit')
      ).rejects.toThrow(/already in this session/i);
    });

    it('rejects joining an invalid or expired session code', async () => {
      await expect(
        multiplayerService.joinSession('ZZZZ99', 'Guest')
      ).rejects.toThrow(/not found or has expired/i);
    });

    it('allows players to vote for exactly one game and tally votes correctly', async () => {
      const { session } = await multiplayerService.createSession(
        SAMPLE_GAMES,
        'Host'
      );

      const { participant: p1 } = await multiplayerService.joinSession(session.code, 'Player 1');
      const { participant: p2 } = await multiplayerService.joinSession(session.code, 'Player 2');

      // Player 1 votes for Number Guess
      await multiplayerService.submitGameVote(
        session.id,
        p1.id,
        'number-guess',
        'Number Guess'
      );

      // Player 2 votes for Memory Match
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

      // Player 1 votes for Number Guess
      await multiplayerService.submitGameVote(session.id, p1.id, 'number-guess', 'Number Guess');

      let data = multiplayerService.getSessionData(session.id);
      expect(data?.votes).toHaveLength(1);
      expect(data?.votes[0].game_id).toBe('number-guess');

      // Player 1 changes vote to Memory Match
      const updated = await multiplayerService.submitGameVote(
        session.id,
        p1.id,
        'memory-match',
        'Memory Match'
      );

      data = multiplayerService.getSessionData(session.id);
      expect(data?.votes).toHaveLength(1); // Still exactly one vote!
      expect(data?.votes[0].game_id).toBe('memory-match');
      expect(updated.tally.tallies['number-guess'].voteCount).toBe(0);
      expect(updated.tally.tallies['memory-match'].voteCount).toBe(1);
      expect(updated.tally.totalVotes).toBe(1);
    });

    it('closes voting, decides highest-voted game, and launches into Game Space', async () => {
      const { session } = await multiplayerService.createSession(SAMPLE_GAMES, 'Host');
      const { participant: p1 } = await multiplayerService.joinSession(session.code, 'Player 1');
      const { participant: p2 } = await multiplayerService.joinSession(session.code, 'Player 2');

      // Two votes for Memory Match
      await multiplayerService.submitGameVote(session.id, p1.id, 'memory-match', 'Memory Match');
      await multiplayerService.submitGameVote(session.id, p2.id, 'memory-match', 'Memory Match');

      // Close voting
      const finalVotingState = await multiplayerService.closeGameSelectionVoting(session.id);
      expect(finalVotingState.status).toBe('closed');
      expect(finalVotingState.winningGameId).toBe('memory-match');

      // Reject subsequent votes after voting closed
      await expect(
        multiplayerService.submitGameVote(session.id, p1.id, 'number-guess', 'Number Guess')
      ).rejects.toThrow(/already closed/i);

      // Host starts game
      const startedGameId = await multiplayerService.startWinningGame(session.id);
      expect(startedGameId).toBe('memory-match');

      const finalSession = multiplayerService.getActiveSession();
      expect(finalSession?.status).toBe('in-progress');
      expect(finalSession?.winning_game_id).toBe('memory-match');
    });

    it('protects bundled games and active session games from deletion', async () => {
      await gameRegistry.init();

      // 1. Bundled games cannot be deleted
      const bundledCheck = await gameRegistry.canDeleteGame(BUNDLED_GAMES[0].id);
      expect(bundledCheck.safe).toBe(false);
      expect(bundledCheck.reason).toMatch(/bundled workshop games cannot be deleted/i);

      // 2. Active session game protection
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

      // Set winning game on session
      await multiplayerService.closeGameSelectionVoting(session.id, 'custom-trivia-game');

      const activeSessionCheck = await gameRegistry.canDeleteGame('custom-trivia-game');
      expect(activeSessionCheck.safe).toBe(false);
      expect(activeSessionCheck.reason).toMatch(/active multiplayer session/i);
    });
  });
});
