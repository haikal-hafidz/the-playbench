/**
 * Multiplayer Service & Real-Time Synchronization Engine (Stage 7)
 *
 * Implements multiplayer session lifecycle and dedicated Game Selection Voting:
 * 1. Host creates a session (with a 6-character code).
 * 2. Players join and see the catalog of available games.
 * 3. Each player selects exactly ONE game to vote for.
 * 4. Changing selection replaces their active vote (no duplicates).
 * 5. Votes synchronize in real time across all clients.
 * 6. Closing voting tallies votes, handles ties, confirms winning game.
 * 7. Host starts the winning game and all participants launch into Game Space.
 */

import { supabaseService } from '../backup/supabaseClient';
import {
  MultiplayerSession,
  SessionParticipant,
  GameVote,
  GameSelectionVotingState,
  GameVoteTally,
  SessionSettings,
} from '../../types/multiplayer';
import { Game } from '../../types';

const ACTIVE_SESSION_KEY = 'playbench_active_session';
const CURRENT_PARTICIPANT_KEY = 'playbench_current_participant';

export interface StoredSessionData {
  session: MultiplayerSession;
  participants: SessionParticipant[];
  availableGames: Game[];
  votes: GameVote[];
  votingState: GameSelectionVotingState;
}

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
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
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
    availableGames: Game[],
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
      status: 'voting', // Opens immediately for game selection voting
      settings: {
        maxPlayers: settings.maxPlayers || 8,
        votingDurationSeconds: settings.votingDurationSeconds || 60,
        tieBreakerRule: settings.tieBreakerRule || 'random',
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

    const initialVotingState: GameSelectionVotingState = {
      status: 'open',
      totalVotes: 0,
      tallies: {},
      isTie: false,
      tiedGameIds: [],
    };

    // Attempt to persist to Supabase if configured
    const supabase = supabaseService.getClient();
    if (supabase) {
      try {
        await supabase.from('multiplayer_sessions').insert({
          id: session.id,
          code: session.code,
          host_id: session.host_id,
          status: session.status,
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
      } catch (err) {
        console.warn('Supabase session insert error, falling back to local sync:', err);
      }
    }

    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(CURRENT_PARTICIPANT_KEY, JSON.stringify(hostParticipant));

    this.storeSessionData(sessionId, {
      session,
      participants: [hostParticipant],
      availableGames,
      votes: [],
      votingState: initialVotingState,
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
    const session = await this.fetchSessionByCode(cleanCode);
    if (!session) {
      throw new Error(`Session with code "${cleanCode}" was not found or has expired.`);
    }

    if (session.status === 'completed') {
      throw new Error('This session has already ended.');
    }

    const data = this.getSessionData(session.id);
    const existingParticipants = data?.participants || [];

    if (session.settings?.maxPlayers && existingParticipants.length >= session.settings.maxPlayers) {
      throw new Error('This session is full.');
    }

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
  // Game Selection Voting System
  // -------------------------------------------------------------
  /**
   * Submits or changes a participant's vote for which game to play.
   * Exactly ONE active vote per participant. Replaces previous vote if changed.
   */
  async submitGameVote(
    sessionId: string,
    participantId: string,
    gameId: string,
    gameTitle: string
  ): Promise<{ success: boolean; vote: GameVote; tally: GameSelectionVotingState }> {
    const data = this.getSessionData(sessionId);
    if (!data) throw new Error('Session not found');

    if (data.votingState.status === 'closed') {
      throw new Error('Game selection voting has already closed.');
    }

    const participant = data.participants.find((p) => p.id === participantId);
    if (!participant) throw new Error('Participant not in this session.');

    const now = new Date().toISOString();

    // Check if participant has already voted: replace previous vote
    const existingIndex = data.votes.findIndex((v) => v.participant_id === participantId);
    let voteRecord: GameVote;

    if (existingIndex >= 0) {
      data.votes[existingIndex].game_id = gameId;
      data.votes[existingIndex].game_title = gameTitle;
      data.votes[existingIndex].updated_at = now;
      voteRecord = data.votes[existingIndex];
    } else {
      voteRecord = {
        id: crypto.randomUUID ? crypto.randomUUID() : `gvote_${Date.now()}`,
        session_id: sessionId,
        participant_id: participantId,
        game_id: gameId,
        game_title: gameTitle,
        created_at: now,
        updated_at: now,
      };
      data.votes.push(voteRecord);
    }

    // Recalculate real-time tallies
    data.votingState = this.calculateTallies(data.availableGames, data.participants, data.votes);
    this.storeSessionData(sessionId, data);

    const supabase = supabaseService.getClient();
    if (supabase) {
      try {
        await supabase.from('session_game_votes').upsert(
          {
            session_id: sessionId,
            participant_id: participantId,
            game_id: gameId,
            game_title: gameTitle,
            updated_at: now,
          },
          { onConflict: 'session_id,participant_id' }
        );
      } catch (err) {
        console.warn('Supabase game vote upsert warning:', err);
      }
    }

    this.broadcast('GAME_VOTE_SUBMITTED', { sessionId, vote: voteRecord, votingState: data.votingState });
    return { success: true, vote: voteRecord, tally: data.votingState };
  }

  /**
   * Computes live tallies and detects ties across available games.
   */
  calculateTallies(
    availableGames: Game[],
    participants: SessionParticipant[],
    votes: GameVote[]
  ): GameSelectionVotingState {
    const tallies: Record<string, GameVoteTally> = {};

    for (const g of availableGames) {
      tallies[g.id] = {
        gameId: g.id,
        gameTitle: g.title,
        voteCount: 0,
        percentage: 0,
        voterNames: [],
      };
    }

    const participantMap = new Map(participants.map((p) => [p.id, p.player_name]));

    for (const v of votes) {
      if (!tallies[v.game_id]) {
        tallies[v.game_id] = {
          gameId: v.game_id,
          gameTitle: v.game_title,
          voteCount: 0,
          percentage: 0,
          voterNames: [],
        };
      }
      tallies[v.game_id].voteCount += 1;
      const voterName = participantMap.get(v.participant_id) || 'Player';
      tallies[v.game_id].voterNames.push(voterName);
    }

    const totalVotes = votes.length;
    let highestVotes = -1;
    let winningGameId: string | undefined;
    let winningGameTitle: string | undefined;
    let tiedGameIds: string[] = [];

    for (const [id, t] of Object.entries(tallies)) {
      t.percentage = totalVotes > 0 ? Math.round((t.voteCount / totalVotes) * 100) : 0;
      if (t.voteCount > highestVotes) {
        highestVotes = t.voteCount;
        winningGameId = id;
        winningGameTitle = t.gameTitle;
        tiedGameIds = [id];
      } else if (t.voteCount === highestVotes && t.voteCount > 0) {
        tiedGameIds.push(id);
      }
    }

    const isTie = tiedGameIds.length > 1;

    return {
      status: 'open',
      totalVotes,
      tallies,
      winningGameId: isTie ? undefined : winningGameId,
      winningGameTitle: isTie ? undefined : winningGameTitle,
      isTie,
      tiedGameIds,
    };
  }

  /**
   * Host closes game selection voting.
   * If there's a tie, breaks the tie deterministically (or accepts override)
   */
  async closeGameSelectionVoting(
    sessionId: string,
    tieBreakerGameId?: string
  ): Promise<GameSelectionVotingState> {
    const data = this.getSessionData(sessionId);
    if (!data) throw new Error('Session not found');

    const votingState = this.calculateTallies(data.availableGames, data.participants, data.votes);
    votingState.status = 'closed';

    let finalGameId = votingState.winningGameId;
    let finalGameTitle = votingState.winningGameTitle;

    // Handle tie breaking
    if (votingState.isTie) {
      if (tieBreakerGameId && votingState.tiedGameIds.includes(tieBreakerGameId)) {
        finalGameId = tieBreakerGameId;
      } else {
        // Deterministic tie-breaker: first tied game in list
        finalGameId = votingState.tiedGameIds[0];
      }
      const chosenGame = data.availableGames.find((g) => g.id === finalGameId);
      finalGameTitle = chosenGame ? chosenGame.title : 'Selected Game';
      votingState.winningGameId = finalGameId;
      votingState.winningGameTitle = finalGameTitle;
    }

    // Default to first available game if no votes were cast at all
    if (!finalGameId && data.availableGames.length > 0) {
      finalGameId = data.availableGames[0].id;
      finalGameTitle = data.availableGames[0].title;
      votingState.winningGameId = finalGameId;
      votingState.winningGameTitle = finalGameTitle;
    }

    data.votingState = votingState;
    data.session.winning_game_id = finalGameId;
    data.session.winning_game_title = finalGameTitle;
    data.session.status = 'ready-to-start';
    data.session.updated_at = new Date().toISOString();

    this.storeSessionData(sessionId, data);
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(data.session));

    const supabase = supabaseService.getClient();
    if (supabase) {
      try {
        await supabase
          .from('multiplayer_sessions')
          .update({
            status: data.session.status,
            winning_game_id: finalGameId,
            winning_game_title: finalGameTitle,
            updated_at: data.session.updated_at,
          })
          .eq('id', sessionId);
      } catch (err) {
        console.warn('Supabase close voting update warning:', err);
      }
    }

    this.broadcast('GAME_SELECTION_CLOSED', {
      sessionId,
      votingState,
      winningGameId: finalGameId,
      winningGameTitle: finalGameTitle,
    });

    return votingState;
  }

  /**
   * Host starts the winning game.
   * Signals all connected players to enter the Game Space for that game.
   */
  async startWinningGame(sessionId: string): Promise<string> {
    const data = this.getSessionData(sessionId);
    if (!data) throw new Error('Session not found');

    if (!data.session.winning_game_id) {
      throw new Error('No winning game selected yet.');
    }

    data.session.status = 'in-progress';
    data.session.updated_at = new Date().toISOString();
    this.storeSessionData(sessionId, data);
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(data.session));

    const supabase = supabaseService.getClient();
    if (supabase) {
      try {
        await supabase
          .from('multiplayer_sessions')
          .update({
            status: 'in-progress',
            updated_at: data.session.updated_at,
          })
          .eq('id', sessionId);
      } catch (err) {
        console.warn('Supabase start game warning:', err);
      }
    }

    this.broadcast('GAME_STARTED', {
      sessionId,
      gameId: data.session.winning_game_id,
      gameTitle: data.session.winning_game_title,
    });

    return data.session.winning_game_id;
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

  getSessionData(sessionId: string): StoredSessionData | null {
    try {
      const raw = localStorage.getItem(`playbench_sess_data_${sessionId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  storeSessionData(sessionId: string, data: StoredSessionData): void {
    try {
      localStorage.setItem(`playbench_sess_data_${sessionId}`, JSON.stringify(data));
    } catch (err) {
      console.warn('Could not store session data in localStorage:', err);
    }
  }
}

export const multiplayerService = new MultiplayerService();
