import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { multiplayerService } from '../multiplayerService';
import { gameRegistry, BUNDLED_GAMES } from '../../games/gameRegistry';

describe('Stage 7 Multiplayer Session Service & Voting System', () => {
  beforeEach(() => {
    localStorage.clear();
    multiplayerService.clearActiveSession();
  });

  it('generates valid uppercase alphanumeric session codes', () => {
    const code = multiplayerService.generateSessionCode();
    expect(code).toHaveLength(6);
    expect(multiplayerService.validateSessionCode(code)).toBe(true);
  });

  it('creates a multiplayer session with waiting status and host participant', async () => {
    const { session, hostParticipant } = await multiplayerService.createSession(
      'number-guess',
      'Number Guess',
      'Host Fox'
    );

    expect(session.id).toBeDefined();
    expect(session.code).toHaveLength(6);
    expect(session.status).toBe('waiting');
    expect(session.game_id).toBe('number-guess');
    expect(hostParticipant.role).toBe('host');
    expect(hostParticipant.player_name).toBe('Host Fox');

    const active = multiplayerService.getActiveSession();
    expect(active?.code).toBe(session.code);
  });

  it('allows players to join an active session with validation', async () => {
    const { session } = await multiplayerService.createSession(
      'number-guess',
      'Number Guess',
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
      'number-guess',
      'Number Guess',
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

  it('enforces one-vote-per-player in voting rounds', async () => {
    const { session } = await multiplayerService.createSession(
      'memory-match',
      'Memory Match',
      'Host'
    );

    const { participant: p1 } = await multiplayerService.joinSession(session.code, 'Player 1');
    const { participant: p2 } = await multiplayerService.joinSession(session.code, 'Player 2');

    const votingRound = await multiplayerService.startVotingRound(
      session.id,
      'Best Workbench Stationery?',
      [
        { id: 'opt_scissors', text: 'Scissors ✂️' },
        { id: 'opt_ruler', text: 'Ruler 📏' },
      ],
      30
    );

    expect(votingRound.status).toBe('open');

    // Player 1 votes for scissors
    const vote1 = await multiplayerService.submitVote(
      session.id,
      votingRound.id,
      p1.id,
      'opt_scissors'
    );
    expect(vote1.success).toBe(true);

    // Player 2 votes for scissors
    const vote2 = await multiplayerService.submitVote(
      session.id,
      votingRound.id,
      p2.id,
      'opt_scissors'
    );
    expect(vote2.success).toBe(true);

    // Player 1 tries to vote again when allowVoteChange is false
    await expect(
      multiplayerService.submitVote(session.id, votingRound.id, p1.id, 'opt_ruler')
    ).rejects.toThrow(/already submitted your vote/i);

    // Close voting and tally results
    const results = await multiplayerService.closeVotingRound(session.id, votingRound.id);
    expect(results.status).toBe('closed');
    expect(results.totalVotes).toBe(2);
    expect(results.counts['opt_scissors']).toBe(2);
    expect(results.counts['opt_ruler']).toBe(0);
    expect(results.winningOptionIds).toEqual(['opt_scissors']);
    expect(results.isTie).toBe(false);
  });

  it('rejects votes submitted after a voting round has closed', async () => {
    const { session } = await multiplayerService.createSession('test-game', 'Test Game', 'Host');
    const { participant } = await multiplayerService.joinSession(session.code, 'Player Early');

    const round = await multiplayerService.startVotingRound(
      session.id,
      'Quick vote',
      [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
      30
    );

    await multiplayerService.closeVotingRound(session.id, round.id);

    await expect(
      multiplayerService.submitVote(session.id, round.id, participant.id, 'a')
    ).rejects.toThrow(/already closed/i);
  });

  it('protects bundled games and active session games from deletion', async () => {
    await gameRegistry.init();

    // 1. Bundled games cannot be deleted
    const bundledCheck = await gameRegistry.canDeleteGame(BUNDLED_GAMES[0].id);
    expect(bundledCheck.safe).toBe(false);
    expect(bundledCheck.reason).toMatch(/bundled workshop games cannot be deleted/i);

    // 2. Active session game protection
    const { session } = await multiplayerService.createSession(
      'custom-trivia-game',
      'Custom Trivia',
      'Host'
    );

    // Register dummy custom game
    await gameRegistry.registerGame({
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
    });

    const activeSessionCheck = await gameRegistry.canDeleteGame('custom-trivia-game');
    expect(activeSessionCheck.safe).toBe(false);
    expect(activeSessionCheck.reason).toMatch(/active multiplayer session/i);

    // End session
    await multiplayerService.updateSessionStatus(session.id, 'completed');
    const completedSessionCheck = await gameRegistry.canDeleteGame('custom-trivia-game');
    expect(completedSessionCheck.safe).toBe(true);
  });
});
