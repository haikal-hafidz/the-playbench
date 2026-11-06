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

  describe('Game Selection Voting Engine', () => {
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
  });

  describe('Individual Game Leaderboards & Final Session Results Recap', () => {
    it('ranks lowest-score games correctly (attempts/moves)', async () => {
      const { session, hostParticipant } = await multiplayerService.createSession(
        SAMPLE_GAMES,
        'Host Alex'
      );
      const { participant: p1 } = await multiplayerService.joinSession(session.code, 'Player 1');
      const { participant: p2 } = await multiplayerService.joinSession(session.code, 'Player 2');

      // Number Guess uses lowest-score (fewer attempts is better)
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
      // Winner has lowest score (3)
      expect(lb.entries[0].participant_id).toBe(p1.id);
      expect(lb.entries[0].rank).toBe(1);
      expect(lb.entries[0].score).toBe(3);

      // Rank 2 has 5
      expect(lb.entries[1].participant_id).toBe(p2.id);
      expect(lb.entries[1].rank).toBe(2);

      // Rank 3 has 7
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

      // Round 1: Number Guess (attempts)
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

      // Return to lobby and play Round 2: Memory Match (moves)
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

      // Conclude session and show final recap
      const recap = await multiplayerService.showFinalSessionRecap(session.id);
      expect(recap.status).toBe('session-recap');
      expect(recap.game_history.length).toBe(2);

      const ng = recap.game_history.find((g) => g.game_id === 'number-guess');
      const mm = recap.game_history.find((g) => g.game_id === 'memory-match');

      expect(ng).toBeDefined();
      expect(ng?.unit_label).toBe('attempts');
      expect(ng?.entries[0].participant_id).toBe(hostParticipant.id); // Winner had 4 attempts

      expect(mm).toBeDefined();
      expect(mm?.unit_label).toBe('moves');
      expect(mm?.entries[0].participant_id).toBe(p1.id); // Winner had 10 moves
    });
  });

  describe('Game Deletion with Session Safeguards', () => {
    it('allows deleting both sample/bundled games and user-created games while protecting active sessions', async () => {
      await gameRegistry.init();

      // 1. Sample/bundled games CAN be deleted when not in an active session
      const sampleGameId = BUNDLED_GAMES[0].id;
      const initialBundledCheck = await gameRegistry.canDeleteGame(sampleGameId);
      expect(initialBundledCheck.safe).toBe(true);

      // 2. Active session game protection applies to any game (sample or user-created)
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

      // 3. User-created game CAN be deleted once active session is cleared
      multiplayerService.clearActiveSession();
      const clearedCheck = await gameRegistry.canDeleteGame('custom-trivia-game');
      expect(clearedCheck.safe).toBe(true);

      await gameRegistry.deleteGame('custom-trivia-game');
      const retrievedCustom = await gameRegistry.getGameById('custom-trivia-game');
      expect(retrievedCustom).toBeUndefined();

      // 4. Sample game can be deleted and remains deleted across re-initialization
      await gameRegistry.deleteGame(sampleGameId);
      const allGamesAfterDelete = await gameRegistry.getAllGames();
      expect(allGamesAfterDelete.find((g) => g.id === sampleGameId)).toBeUndefined();
    });
  });
});
