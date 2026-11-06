/**
 * Multiplayer Service & Real-Time Synchronization Engine (Stage 7)
 *
 * Integrates with Supabase Realtime when credentials are configured.
 * Also provides multi-tab / cross-window BroadcastChannel synchronization
 * so multi-client sessions work consistently both online and in local/offline modes.
 */

import { supabaseService } from '../backup/supabaseClient';
import {
  MultiplayerSession,
  SessionParticipant,
  SessionGameState,
  VotingRound,
  SessionVote,
  VotingResult,
  SessionSettings,
} from '../../types/multiplayer';

const ACTIVE_SESSION_KEY = 'playbench_active_session';
const CURRENT_PARTICIPANT_KEY = 'playbench_current_participant';

export class MultiplayerService {
  private broadcastChannel: BroadcastChannel | null = null;
  private realtimeChannel: any = null;
  private listeners: Set<(event: { type: string; payload: any }) => void> = new Set();
  private heartbeatTimer: any = null;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel('playbench_multiplayer_sync');
      this.broadcastChannel.onmessage = (event) => {
        this.notifyListeners(event.data);
      };
    }
  }

  // -------------------------------------------------------------
  // Subscription & Event Dispatching
  // -------------------------------------------------------------
  subscribe(callback: (event: { type: string; payload: any }) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(data: { type: string; payload: any }) {
    for (const listener of this.listeners) {
      try {
        listener(data);
      } catch (err) {
        console.error('Error in multiplayer event listener:', err);
      }
    }
  }

  private broadcast(type: string, payload: any) {
    const message = { type, payload };
    this.notifyListeners(message);
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(message);
      } catch (err) {
        console.warn('BroadcastChannel error:', err);
      }
    }
    // Also broadcast to Supabase Realtime channel if active
    if (this.realtimeChannel && typeof this.realtimeChannel.send === 'function') {
      try {
        this.realtimeChannel.send({
          type: 'broadcast',
          event: type,
          payload,
        });
      } catch (err) {
        console.warn('Supabase Realtime broadcast warning:', err);
      }
    }
  }

  // -------------------------------------------------------------
  // Session Code Generation & Validation
  // -------------------------------------------------------------
  generateSessionCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous chars (0, O, 1, I)
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  validateSessionCode(code: string): boolean {
    return /^[A-Z0-9]{4,8}$/i.test(code.trim());
  }

  // -------------------------------------------------------------
  // Session Lifecycle
  // -------------------------------------------------------------
  async createSession(
    gameId: string,
    gameTitle: string,
    hostName: string,
    settings: SessionSettings = {}
  ): Promise<{ session: MultiplayerSession; hostParticipant: SessionParticipant }> {
    const code = this.generateSessionCode();
    const sessionId = crypto.randomUUID ? crypto.randomUUID() : `sess_${Date.now()}`;
    const hostToken = crypto.randomUUID ? crypto.randomUUID() : `host_${Date.now()}`;
    const now = new Date().toISOString();

    const session: MultiplayerSession = {
      id: sessionId,
      code,
      host_id: hostToken,
      game_id: gameId,
      game_title: gameTitle,
      status: 'waiting',
      current_round: 1,
      max_rounds: 5,
      settings: {
        maxPlayers: settings.maxPlayers || 8,
        votingDurationSeconds: settings.votingDurationSeconds || 30,
        allowVoteChange: settings.allowVoteChange ?? false,
        tieBreakerRule: settings.tieBreakerRule || 'random',
        pointsPerCorrectVote: settings.pointsPerCorrectVote || 100,
      },
      created_at: now,
      updated_at: now,
    };

    const hostParticipant: SessionParticipant = {
      id: crypto.randomUUID ? crypto.randomUUID() : `part_${Date.now()}`,
      session_id: sessionId,
      participant_token: hostToken,
      player_name: hostName || 'Bench Host',
      role: 'host',
      is_connected: true,
      joined_at: now,
      last_heartbeat: now,
    };

    const initialGameState: SessionGameState = {
      session_id: sessionId,
      round_number: 1,
      phase: 'waiting',
      prompt: 'Waiting for players to join...',
      options: [],
      scores: { [hostParticipant.id]: 0 },
      updated_at: now,
    };

    // Attempt to persist to Supabase if configured
    const supabase = supabaseService.getClient();
    if (supabase) {
      try {
        await supabase.from('multiplayer_sessions').insert({
          id: session.id,
          code: session.code,
          host_id: session.host_id,
          game_id: session.game_id,
          game_title: session.game_title,
          status: session.status,
          current_round: session.current_round,
          max_rounds: session.max_rounds,
          settings: session.settings,
        });

        await supabase.from('session_participants').insert({
          id: hostParticipant.id,
          session_id: hostParticipant.session_id,
          participant_token: hostParticipant.participant_token,
          player_name: hostParticipant.player_name,
          role: hostParticipant.role,
          is_connected: hostParticipant.is_connected,
        });

        await supabase.from('session_game_state').insert({
          session_id: initialGameState.session_id,
          round_number: initialGameState.round_number,
          phase: initialGameState.phase,
          prompt: initialGameState.prompt,
          options: initialGameState.options,
          scores: initialGameState.scores,
        });
      } catch (err) {
        console.warn('Supabase multiplayer session insert error, falling back to local sync:', err);
      }
    }

    // Persist in local storage for session recovery & multi-tab test
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(CURRENT_PARTICIPANT_KEY, JSON.stringify(hostParticipant));
    this.storeSessionData(sessionId, {
      session,
      participants: [hostParticipant],
      gameState: initialGameState,
      votingRounds: [],
      votes: [],
    });

    this.setupRealtime(sessionId);
    this.broadcast('SESSION_CREATED', { session, hostParticipant });

    return { session, hostParticipant };
  }

  async joinSession(
    code: string,
    playerName: string
  ): Promise<{ session: MultiplayerSession; participant: SessionParticipant }> {
    const cleanCode = code.trim().toUpperCase();
    if (!this.validateSessionCode(cleanCode)) {
      throw new Error('Invalid session code format. Please check and try again.');
    }

    if (!playerName || playerName.trim().length === 0) {
      throw new Error('Please enter a display name to join.');
    }

    const trimmedName = playerName.trim().slice(0, 30);

    // Fetch session data (Supabase or local storage)
    let session = await this.fetchSessionByCode(cleanCode);
    if (!session) {
      throw new Error(`Session with code "${cleanCode}" was not found or has expired.`);
    }

    if (session.status === 'completed') {
      throw new Error('This session has already ended.');
    }

    const data = this.getSessionData(session.id);
    const existingParticipants = data?.participants || [];

    // Check player limit
    if (session.settings?.maxPlayers && existingParticipants.length >= session.settings.maxPlayers) {
      throw new Error('This session is full.');
    }

    // Prevent duplicate display names
    const duplicate = existingParticipants.find(
      (p) => p.player_name.toLowerCase() === trimmedName.toLowerCase() && p.is_connected
    );
    if (duplicate) {
      throw new Error(`A player named "${trimmedName}" is already in this session.`);
    }

    const now = new Date().toISOString();
    const participantToken = crypto.randomUUID ? crypto.randomUUID() : `part_${Date.now()}`;
    const participant: SessionParticipant = {
      id: crypto.randomUUID ? crypto.randomUUID() : `p_${Date.now()}`,
      session_id: session.id,
      participant_token: participantToken,
      player_name: trimmedName,
      role: 'player',
      is_connected: true,
      joined_at: now,
      last_heartbeat: now,
    };

    // Save in Supabase if configured
    const supabase = supabaseService.getClient();
    if (supabase) {
      try {
        await supabase.from('session_participants').insert({
          id: participant.id,
          session_id: participant.session_id,
          participant_token: participant.participant_token,
          player_name: participant.player_name,
          role: participant.role,
          is_connected: true,
        });
      } catch (err) {
        console.warn('Supabase participant insert warning:', err);
      }
    }

    // Update local state
    if (data) {
      data.participants.push(participant);
      this.storeSessionData(session.id, data);
    }

    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(CURRENT_PARTICIPANT_KEY, JSON.stringify(participant));

    this.setupRealtime(session.id);
    this.broadcast('PARTICIPANT_JOINED', { session, participant });

    return { session, participant };
  }

  // -------------------------------------------------------------
  // Realtime Connection & Presence
  // -------------------------------------------------------------
  private setupRealtime(sessionId: string) {
    const supabase = supabaseService.getClient();
    if (supabase) {
      try {
        this.realtimeChannel = supabase.channel(`playbench_session_${sessionId}`, {
          config: { broadcast: { self: false } },
        });

        this.realtimeChannel
          .on('broadcast', { event: '*' }, (payload: any) => {
            if (payload && payload.event) {
              this.notifyListeners({ type: payload.event, payload: payload.payload });
            }
          })
          .subscribe();
      } catch (err) {
        console.warn('Realtime channel setup warning:', err);
      }
    }

    // Start presence heartbeat
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat(sessionId);
    }, 15000);
  }

  private sendHeartbeat(sessionId: string) {
    const participant = this.getCurrentParticipant();
    if (!participant) return;

    const data = this.getSessionData(sessionId);
    if (data) {
      const p = data.participants.find((x) => x.id === participant.id);
      if (p) {
        p.last_heartbeat = new Date().toISOString();
        p.is_connected = true;
        this.storeSessionData(sessionId, data);
      }
    }
  }

  // -------------------------------------------------------------
  // Game & Round Progression
  // -------------------------------------------------------------
  async updateGameState(sessionId: string, patch: Partial<SessionGameState>): Promise<SessionGameState> {
    const data = this.getSessionData(sessionId);
    if (!data) throw new Error('Session not found');

    const updated: SessionGameState = {
      ...data.gameState,
      ...patch,
      updated_at: new Date().toISOString(),
    };

    data.gameState = updated;
    this.storeSessionData(sessionId, data);

    const supabase = supabaseService.getClient();
    if (supabase) {
      try {
        await supabase
          .from('session_game_state')
          .update({
            round_number: updated.round_number,
            phase: updated.phase,
            prompt: updated.prompt,
            options: updated.options,
            scores: updated.scores,
            timer_seconds: updated.timer_seconds,
            phase_ends_at: updated.phase_ends_at,
          })
          .eq('session_id', sessionId);
      } catch (err) {
        console.warn('Supabase game state update warning:', err);
      }
    }

    this.broadcast('GAME_STATE_UPDATED', { sessionId, gameState: updated });
    return updated;
  }

  async updateSessionStatus(sessionId: string, status: MultiplayerSession['status']): Promise<void> {
    const data = this.getSessionData(sessionId);
    if (!data) throw new Error('Session not found');

    data.session.status = status;
    data.session.updated_at = new Date().toISOString();
    this.storeSessionData(sessionId, data);
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(data.session));

    const supabase = supabaseService.getClient();
    if (supabase) {
      try {
        await supabase
          .from('multiplayer_sessions')
          .update({ status, updated_at: data.session.updated_at })
          .eq('id', sessionId);
      } catch (err) {
        console.warn('Supabase session status update warning:', err);
      }
    }

    this.broadcast('SESSION_STATUS_CHANGED', { sessionId, status });
  }

  // -------------------------------------------------------------
  // Mandatory Voting Engine
  // -------------------------------------------------------------
  async startVotingRound(
    sessionId: string,
    prompt: string,
    options: Array<{ id: string; text: string; color?: string }>,
    durationSeconds = 30
  ): Promise<VotingRound> {
    const data = this.getSessionData(sessionId);
    if (!data) throw new Error('Session not found');

    const closesAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
    const votingRound: VotingRound = {
      id: crypto.randomUUID ? crypto.randomUUID() : `vr_${Date.now()}`,
      session_id: sessionId,
      round_number: data.session.current_round,
      prompt,
      options,
      status: 'open',
      duration_seconds: durationSeconds,
      closes_at: closesAt,
      created_at: new Date().toISOString(),
    };

    data.votingRounds.push(votingRound);
    this.storeSessionData(sessionId, data);

    // Update game phase to voting
    await this.updateGameState(sessionId, {
      phase: 'voting',
      prompt,
      options: options.map((o) => ({ id: o.id, text: o.text })),
      timer_seconds: durationSeconds,
      phase_ends_at: closesAt,
    });

    const supabase = supabaseService.getClient();
    if (supabase) {
      try {
        await supabase.from('session_voting_rounds').insert({
          id: votingRound.id,
          session_id: votingRound.session_id,
          round_number: votingRound.round_number,
          prompt: votingRound.prompt,
          options: votingRound.options,
          status: votingRound.status,
          duration_seconds: votingRound.duration_seconds,
          closes_at: votingRound.closes_at,
        });
      } catch (err) {
        console.warn('Supabase voting round insert warning:', err);
      }
    }

    this.broadcast('VOTING_ROUND_STARTED', { sessionId, votingRound });
    return votingRound;
  }

  async submitVote(
    sessionId: string,
    votingRoundId: string,
    participantId: string,
    optionId: string
  ): Promise<{ success: boolean; vote: SessionVote }> {
    const data = this.getSessionData(sessionId);
    if (!data) throw new Error('Session not found');

    const round = data.votingRounds.find((r) => r.id === votingRoundId);
    if (!round) throw new Error('Voting round not found');

    if (round.status === 'closed') {
      throw new Error('Voting has already closed for this round.');
    }

    // Check timer expiration
    if (round.closes_at && new Date(round.closes_at).getTime() < Date.now()) {
      round.status = 'closed';
      this.storeSessionData(sessionId, data);
      throw new Error('Voting time has expired.');
    }

    // Strict One-Vote-Per-Player Check
    const existingIndex = data.votes.findIndex(
      (v) => v.voting_round_id === votingRoundId && v.participant_id === participantId
    );

    if (existingIndex >= 0) {
      if (data.session.settings.allowVoteChange) {
        // Update existing vote
        data.votes[existingIndex].option_id = optionId;
      } else {
        throw new Error('You have already submitted your vote for this round.');
      }
    } else {
      const vote: SessionVote = {
        id: crypto.randomUUID ? crypto.randomUUID() : `vote_${Date.now()}`,
        voting_round_id: votingRoundId,
        session_id: sessionId,
        participant_id: participantId,
        option_id: optionId,
        created_at: new Date().toISOString(),
      };
      data.votes.push(vote);
    }

    this.storeSessionData(sessionId, data);

    const supabase = supabaseService.getClient();
    if (supabase) {
      try {
        await supabase.from('session_votes').upsert(
          {
            voting_round_id: votingRoundId,
            session_id: sessionId,
            participant_id: participantId,
            option_id: optionId,
          },
          { onConflict: 'voting_round_id,participant_id' }
        );
      } catch (err) {
        console.warn('Supabase vote upsert warning:', err);
      }
    }

    const currentVote = data.votes.find(
      (v) => v.voting_round_id === votingRoundId && v.participant_id === participantId
    )!;

    this.broadcast('VOTE_SUBMITTED', { sessionId, votingRoundId, vote: currentVote });
    return { success: true, vote: currentVote };
  }

  async closeVotingRound(sessionId: string, votingRoundId: string): Promise<VotingResult> {
    const data = this.getSessionData(sessionId);
    if (!data) throw new Error('Session not found');

    const round = data.votingRounds.find((r) => r.id === votingRoundId);
    if (!round) throw new Error('Voting round not found');

    round.status = 'closed';

    // Calculate aggregated results
    const roundVotes = data.votes.filter((v) => v.voting_round_id === votingRoundId);
    const counts: Record<string, number> = {};
    for (const opt of round.options) {
      counts[opt.id] = 0;
    }
    for (const v of roundVotes) {
      counts[v.option_id] = (counts[v.option_id] || 0) + 1;
    }

    const totalVotes = roundVotes.length;
    const percentages: Record<string, number> = {};
    let highestCount = -1;
    let winningOptionIds: string[] = [];

    for (const [optId, cnt] of Object.entries(counts)) {
      percentages[optId] = totalVotes > 0 ? Math.round((cnt / totalVotes) * 100) : 0;
      if (cnt > highestCount) {
        highestCount = cnt;
        winningOptionIds = [optId];
      } else if (cnt === highestCount && cnt > 0) {
        winningOptionIds.push(optId);
      }
    }

    const isTie = winningOptionIds.length > 1;

    const result: VotingResult = {
      roundId: votingRoundId,
      status: 'closed',
      totalVotes,
      counts,
      percentages,
      winningOptionIds,
      isTie,
    };

    // Update session scores
    const pts = data.session.settings.pointsPerCorrectVote || 100;
    const scores = { ...data.gameState.scores };
    for (const v of roundVotes) {
      if (winningOptionIds.includes(v.option_id)) {
        scores[v.participant_id] = (scores[v.participant_id] || 0) + pts;
      }
    }

    data.gameState.scores = scores;
    this.storeSessionData(sessionId, data);

    await this.updateGameState(sessionId, {
      phase: 'results',
      scores,
    });

    const supabase = supabaseService.getClient();
    if (supabase) {
      try {
        await supabase
          .from('session_voting_rounds')
          .update({ status: 'closed' })
          .eq('id', votingRoundId);
      } catch (err) {
        console.warn('Supabase close voting update warning:', err);
      }
    }

    this.broadcast('VOTING_ROUND_CLOSED', { sessionId, votingRoundId, result });
    return result;
  }

  // -------------------------------------------------------------
  // Data Access Helpers
  // -------------------------------------------------------------
  getActiveSession(): MultiplayerSession | null {
    try {
      const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  getCurrentParticipant(): SessionParticipant | null {
    try {
      const raw = localStorage.getItem(CURRENT_PARTICIPANT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  clearActiveSession(): void {
    const session = this.getActiveSession();
    if (session) {
      this.broadcast('PARTICIPANT_LEFT', { sessionId: session.id, participant: this.getCurrentParticipant() });
    }
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    localStorage.removeItem(CURRENT_PARTICIPANT_KEY);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.realtimeChannel && typeof this.realtimeChannel.unsubscribe === 'function') {
      this.realtimeChannel.unsubscribe();
    }
  }

  async fetchSessionByCode(code: string): Promise<MultiplayerSession | null> {
    const supabase = supabaseService.getClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('multiplayer_sessions')
          .select('*')
          .eq('code', code.toUpperCase())
          .maybeSingle();

        if (!error && data) return data as MultiplayerSession;
      } catch (err) {
        console.warn('Supabase fetchSessionByCode error:', err);
      }
    }

    // LocalStorage fallback for multi-window / offline testing
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('playbench_sess_data_')) {
        try {
          const stored = JSON.parse(localStorage.getItem(key) || '{}');
          if (stored.session && stored.session.code === code.toUpperCase()) {
            return stored.session;
          }
        } catch {}
      }
    }

    return null;
  }

  getSessionData(sessionId: string): {
    session: MultiplayerSession;
    participants: SessionParticipant[];
    gameState: SessionGameState;
    votingRounds: VotingRound[];
    votes: SessionVote[];
  } | null {
    try {
      const raw = localStorage.getItem(`playbench_sess_data_${sessionId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  storeSessionData(
    sessionId: string,
    data: {
      session: MultiplayerSession;
      participants: SessionParticipant[];
      gameState: SessionGameState;
      votingRounds: VotingRound[];
      votes: SessionVote[];
    }
  ): void {
    try {
      localStorage.setItem(`playbench_sess_data_${sessionId}`, JSON.stringify(data));
    } catch (err) {
      console.warn('Could not store session data in localStorage:', err);
    }
  }
}

export const multiplayerService = new MultiplayerService();
