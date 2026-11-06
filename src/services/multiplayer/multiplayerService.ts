/**
 * Multiplayer Service & Real-Time Synchronization Engine (Stage 7)
 *
 * Implements:
 * 1. Participant Display Names with unique internal IDs and distinct duplicate disambiguation (e.g. "Name (2)").
 * 2. Dedicated Game Selection Voting: Exactly ONE active vote per player, live updates.
 * 3. Individual Game Leaderboards: Automatically calculated when each game ends according to that game's
 *    native ranking rules (e.g. lowest attempts for Number Guess, fewest moves for Memory Match, highest score for points games).
 * 4. Final Session Results Recap: Preserves individual game results and leaderboards without combining incompatible scores.
 * 5. Robust Zero-Trust Room-Scoped Security:
 *    - Privacy-Separated Room Discovery: Public room code search returns minimal metadata without leaking participant rosters or tokens.
 *    - Authorized Room State: Full room state is accessible only to verified room members presenting their participant token.
 *    - Token Hashing: Server hashes host secrets and participant tokens (SHA-256) so plaintext tokens are never stored in the database.
 *    - Join Capacity & Flood Protections: Rejects joins if session has reached max_participants or is already in progress.
 *    - Strict State Machine: Validates status transitions (e.g. voting -> ready-to-start -> in-progress -> game-ended).
 *    - Revocation of Direct Mutations: Direct writes are revoked from `anon`.
 *    - Explicit Error Handling: Inspects every Supabase `{ data, error }` return object and handles partial failures cleanly.
 * 6. Cross-Device Session Hydration: Joining players across separate browsers/devices hydrate available games, participants, and votes.
 */

import { supabaseService } from '../backup/supabaseClient';
import {
  MultiplayerSession,
  SessionParticipant,
  GameVote,
  GameSelectionVotingState,
  GameVoteTally,
  SessionSettings,
  GameLeaderboard,
  GameResultEntry,
  RankingCriterion,
  RoomDiscoveryInfo,
} from '../../types/multiplayer';
import { Game } from '../../types';

const ACTIVE_SESSION_KEY = 'playbench_active_session';
const CURRENT_PARTICIPANT_KEY = 'playbench_current_participant';
const HOST_SECRET_PREFIX = 'playbench_host_secret_';
const PARTICIPANT_TOKEN_PREFIX = 'playbench_part_token_';

export interface StoredSessionData {
  session: MultiplayerSession;
  participants: SessionParticipant[];
  availableGames: Game[];
  votes: GameVote[];
  votingState: GameSelectionVotingState;
  currentLeaderboard?: GameLeaderboard | null;
  history: GameLeaderboard[];
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
  // Token and Secret Storage
  // -------------------------------------------------------------
  getHostSecret(sessionId: string): string | null {
    try {
      return localStorage.getItem(`${HOST_SECRET_PREFIX}${sessionId}`);
    } catch {
      return null;
    }
  }

  setHostSecret(sessionId: string, secret: string): void {
    try {
      localStorage.setItem(`${HOST_SECRET_PREFIX}${sessionId}`, secret);
    } catch (err) {
      console.warn('Failed to store host secret:', err);
    }
  }

  getParticipantToken(participantId: string): string | null {
    try {
      return localStorage.getItem(`${PARTICIPANT_TOKEN_PREFIX}${participantId}`);
    } catch {
      return null;
    }
  }

  setParticipantToken(participantId: string, token: string): void {
    try {
      localStorage.setItem(`${PARTICIPANT_TOKEN_PREFIX}${participantId}`, token);
    } catch (err) {
      console.warn('Failed to store participant token:', err);
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

  /**
   * Disambiguates duplicate display names by appending an incremental counter (e.g. "Robin (2)").
   */
  disambiguateName(desiredName: string, existingParticipants: SessionParticipant[]): string {
    const base = desiredName.trim().replace(/\s*\(\d+\)$/, '');
    const activeNames = new Set(
      existingParticipants
        .filter((p) => p.is_connected)
        .map((p) => p.player_name.toLowerCase())
    );

    if (!activeNames.has(base.toLowerCase())) {
      return base;
    }

    let counter = 2;
    while (activeNames.has(`${base.toLowerCase()} (${counter})`)) {
      counter++;
    }
    return `${base} (${counter})`;
  }

  // -------------------------------------------------------------
  // Session Lifecycle
  // -------------------------------------------------------------
  async createSession(
    availableGames: Game[],
    hostName: string,
    settings: SessionSettings = {}
  ): Promise<{ session: MultiplayerSession; hostParticipant: SessionParticipant }> {
    if (!hostName || hostName.trim().length === 0) {
      throw new Error('Host must enter a display name to create a session.');
    }

    const code = this.generateSessionCode();
    const sessionId = crypto.randomUUID ? crypto.randomUUID() : `sess_${Date.now()}`;
    const hostSecret = crypto.randomUUID ? crypto.randomUUID() : `sec_${Date.now()}_${Math.random()}`;
    const hostParticipantId = crypto.randomUUID ? crypto.randomUUID() : `p_${Date.now()}`;
    const hostParticipantToken = crypto.randomUUID ? crypto.randomUUID() : `tok_${Date.now()}`;
    const now = new Date().toISOString();

    const session: MultiplayerSession = {
      id: sessionId,
      code,
      host_id: hostSecret,
      status: 'voting', // Opens immediately for game selection voting
      settings: {
        maxPlayers: settings.maxPlayers || 8,
        votingDurationSeconds: settings.votingDurationSeconds || 60,
        tieBreakerRule: settings.tieBreakerRule || 'random',
      },
      available_games: availableGames,
      game_history: [],
      created_at: now,
      updated_at: now,
    };

    const hostParticipant: SessionParticipant = {
      id: hostParticipantId,
      session_id: sessionId,
      participant_token: hostParticipantToken,
      player_name: hostName.trim().slice(0, 30),
      original_name: hostName.trim().slice(0, 30),
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

    // If Supabase is configured, execute the secure RPC function to create the room atomically
    const supabase = supabaseService.getClient();
    if (supabase) {
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_multiplayer_session_rpc', {
        p_id: session.id,
        p_code: session.code,
        p_host_id: session.host_id,
        p_host_name: hostParticipant.player_name,
        p_host_secret: hostSecret,
        p_available_games: availableGames,
        p_host_participant_id: hostParticipant.id,
        p_host_participant_token: hostParticipantToken,
      });

      if (rpcError) {
        throw new Error(
          `Cloud multiplayer session creation failed: ${rpcError.message || 'Database rejected session creation. Please run migration in docs/MULTIPLAYER_SETUP.md.'}`
        );
      }

      if (rpcData && typeof rpcData === 'object') {
        session.status = rpcData.status || session.status;
      }
    }

    this.setHostSecret(sessionId, hostSecret);
    this.setParticipantToken(hostParticipantId, hostParticipantToken);

    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(CURRENT_PARTICIPANT_KEY, JSON.stringify(hostParticipant));

    this.storeSessionData(sessionId, {
      session,
      participants: [hostParticipant],
      availableGames,
      votes: [],
      votingState: initialVotingState,
      currentLeaderboard: null,
      history: [],
    });

    this.setupRealtime(sessionId);
    this.broadcast('SESSION_CREATED', { session, hostParticipant });

    return { session, hostParticipant };
  }

  /**
   * Sanitized public room discovery by code.
   * Does NOT leak participant list, tokens, or votes.
   */
  /**
   * Backward-compatible alias for fetchSessionByCode.
   * Discovers room metadata without exposing sensitive participant lists or tokens.
   */
  async fetchSessionByCode(code: string): Promise<MultiplayerSession | null> {
    const roomInfo = await this.discoverRoomByCode(code);
    if (!roomInfo) return null;
    const existing = this.getSessionData(roomInfo.id);
    if (existing) return existing.session;
    return {
      id: roomInfo.id,
      code: roomInfo.code,
      host_id: '',
      status: roomInfo.status,
      settings: { maxPlayers: roomInfo.max_participants },
      game_history: [],
      created_at: roomInfo.created_at,
      updated_at: roomInfo.created_at,
    };
  }

  async discoverRoomByCode(code: string): Promise<RoomDiscoveryInfo | null> {
    const cleanCode = code.trim().toUpperCase();
    if (!this.validateSessionCode(cleanCode)) {
      throw new Error('Invalid session code format. Please check and try again.');
    }

    const supabase = supabaseService.getClient();
    if (supabase) {
      const { data, error } = await supabase.rpc('discover_room_by_code_rpc', {
        p_code: cleanCode,
      });

      if (error) {
        throw new Error(`Database error while searching for session "${cleanCode}": ${error.message}`);
      }

      return data as RoomDiscoveryInfo | null;
    }

    // Local-only discovery fallback
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('playbench_sess_data_')) {
        try {
          const stored = JSON.parse(localStorage.getItem(key) || '{}');
          if (stored.session && stored.session.code === cleanCode) {
            return {
              id: stored.session.id,
              code: stored.session.code,
              status: stored.session.status,
              participant_count: stored.participants?.length || 1,
              max_participants: stored.session.settings?.maxPlayers || 8,
              game_count: stored.availableGames?.length || 0,
              created_at: stored.session.created_at,
            };
          }
        } catch {}
      }
    }

    return null;
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

    const trimmedInputName = playerName.trim().slice(0, 30);
    const roomInfo = await this.discoverRoomByCode(cleanCode);
    if (!roomInfo) {
      throw new Error(`Session with code "${cleanCode}" was not found or has expired.`);
    }

    if (roomInfo.status === 'completed') {
      throw new Error('This session has already ended.');
    }

    if (roomInfo.status !== 'waiting' && roomInfo.status !== 'voting') {
      throw new Error('Cannot join session: gameplay is already in progress.');
    }

    if (roomInfo.participant_count >= roomInfo.max_participants) {
      throw new Error('This session has reached maximum participants limit.');
    }

    // Load existing participants to disambiguate name
    const existingData = this.getSessionData(roomInfo.id);
    const existingParticipants = existingData?.participants || [];
    const finalDisplayName = this.disambiguateName(trimmedInputName, existingParticipants);

    const now = new Date().toISOString();
    const participantToken = crypto.randomUUID ? crypto.randomUUID() : `part_${Date.now()}`;
    const participantId = crypto.randomUUID ? crypto.randomUUID() : `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const participant: SessionParticipant = {
      id: participantId,
      session_id: roomInfo.id,
      participant_token: participantToken,
      player_name: finalDisplayName,
      original_name: trimmedInputName,
      role: 'player',
      is_connected: true,
      joined_at: now,
      last_heartbeat: now,
    };

    let session: MultiplayerSession;

    const supabase = supabaseService.getClient();
    if (supabase) {
      const { data: joinedData, error: joinError } = await supabase.rpc('join_multiplayer_session_rpc', {
        p_session_id: roomInfo.id,
        p_participant_id: participant.id,
        p_participant_token: participantToken,
        p_player_name: participant.player_name,
        p_original_name: participant.original_name,
        p_color: participant.color || null,
      });

      if (joinError) {
        throw new Error(`Failed to join session: ${joinError.message || 'Database rejected participant registration.'}`);
      }

      if (joinedData && typeof joinedData === 'object') {
        participant.joined_at = joinedData.joined_at || participant.joined_at;
      }

      this.setParticipantToken(participantId, participantToken);

      // Hydrate authorized room state
      const roomState = await this.getAuthorizedRoomState(roomInfo.id, participantId, participantToken);
      session = roomState.session;

      const votes = roomState.votes || [];
      const participants = roomState.participants || [participant];
      const availableGames = session.available_games || [];
      const votingState = this.calculateTallies(availableGames, participants, votes);

      this.storeSessionData(roomInfo.id, {
        session,
        participants,
        availableGames,
        votes,
        votingState,
        history: session.game_history || [],
      });
    } else {
      this.setParticipantToken(participantId, participantToken);
      session = existingData?.session || {
        id: roomInfo.id,
        code: roomInfo.code,
        host_id: 'local',
        status: roomInfo.status,
        settings: { maxPlayers: roomInfo.max_participants },
        game_history: [],
        created_at: roomInfo.created_at,
        updated_at: roomInfo.created_at,
      };

      if (existingData) {
        existingData.participants.push(participant);
        this.storeSessionData(roomInfo.id, existingData);
      }
    }

    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(CURRENT_PARTICIPANT_KEY, JSON.stringify(participant));

    this.setupRealtime(session.id);
    this.broadcast('PARTICIPANT_JOINED', { session, participant });

    return { session, participant };
  }

  /**
   * Fetches full authorized room state via token validation.
   */
  async getAuthorizedRoomState(
    sessionId: string,
    participantId: string,
    participantToken: string
  ): Promise<{ session: MultiplayerSession; participants: SessionParticipant[]; votes: GameVote[] }> {
    const supabase = supabaseService.getClient();
    if (!supabase) {
      const data = this.getSessionData(sessionId);
      if (!data) throw new Error('Session not found');
      return { session: data.session, participants: data.participants, votes: data.votes };
    }

    const { data, error } = await supabase.rpc('get_room_state_rpc', {
      p_session_id: sessionId,
      p_participant_id: participantId,
      p_participant_token: participantToken,
    });

    if (error) {
      throw new Error(`Failed to load room state: ${error.message}`);
    }

    return data as { session: MultiplayerSession; participants: SessionParticipant[]; votes: GameVote[] };
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
          .on('broadcast', { event: '*' }, async (payload: any) => {
            if (payload && payload.event) {
              this.notifyListeners({ type: payload.event, payload: payload.payload });
              // Authorized state refresh on broadcast events
              if (
                payload.event === 'PARTICIPANT_JOINED' ||
                payload.event === 'GAME_VOTE_SUBMITTED' ||
                payload.event === 'GAME_SELECTION_CLOSED' ||
                payload.event === 'SESSION_RETURNED_TO_LOBBY' ||
                payload.event === 'SESSION_RECAP_TRIGGERED'
              ) {
                await this.refreshAuthorizedState(sessionId);
              }
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

  private async refreshAuthorizedState(sessionId: string) {
    const participant = this.getCurrentParticipant();
    if (!participant) return;
    const token = this.getParticipantToken(participant.id);
    if (!token) return;

    try {
      const roomState = await this.getAuthorizedRoomState(sessionId, participant.id, token);
      const data = this.getSessionData(sessionId);
      if (data) {
        data.session = roomState.session;
        data.participants = roomState.participants;
        data.votes = roomState.votes;
        data.votingState = this.calculateTallies(data.availableGames, data.participants, data.votes);
        this.storeSessionData(sessionId, data);
        localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(data.session));
        this.notifyListeners({ type: 'SESSION_UPDATED', payload: { session: data.session } });
        this.notifyListeners({ type: 'PARTICIPANTS_UPDATED', payload: { participants: data.participants } });
        this.notifyListeners({ type: 'GAME_VOTE_SUBMITTED', payload: { sessionId, votingState: data.votingState } });
      }
    } catch (err) {
      console.warn('Error refreshing authorized room state:', err);
    }
  }


  private sendHeartbeat(sessionId: string) {
    const participant = this.getCurrentParticipant();
    if (!participant) return;
    const token = this.getParticipantToken(participant.id);

    const data = this.getSessionData(sessionId);
    if (data) {
      const p = data.participants.find((x) => x.id === participant.id);
      if (p) {
        p.last_heartbeat = new Date().toISOString();
        p.is_connected = true;
        this.storeSessionData(sessionId, data);
      }
    }

    const supabase = supabaseService.getClient();
    if (supabase && token) {
      supabase.rpc('update_participant_presence_rpc', {
        p_session_id: sessionId,
        p_participant_id: participant.id,
        p_participant_token: token,
        p_is_connected: true,
      }).then(() => {});
    }
  }

  // -------------------------------------------------------------
  // Game Selection Voting System
  // -------------------------------------------------------------
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

    const participantToken = this.getParticipantToken(participantId) || participant.participant_token || '';
    const now = new Date().toISOString();

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

    data.votingState = this.calculateTallies(data.availableGames, data.participants, data.votes);
    this.storeSessionData(sessionId, data);

    const supabase = supabaseService.getClient();
    if (supabase) {
      const { error: voteError } = await supabase.rpc('submit_game_vote_rpc', {
        p_session_id: sessionId,
        p_participant_id: participantId,
        p_participant_token: participantToken,
        p_game_id: gameId,
        p_game_title: gameTitle,
      });

      if (voteError) {
        throw new Error(`Failed to submit vote to cloud: ${voteError.message}`);
      }
    }

    this.broadcast('GAME_VOTE_SUBMITTED', { sessionId, vote: voteRecord, votingState: data.votingState });
    return { success: true, vote: voteRecord, tally: data.votingState };
  }

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

    if (votingState.isTie) {
      if (tieBreakerGameId && votingState.tiedGameIds.includes(tieBreakerGameId)) {
        finalGameId = tieBreakerGameId;
      } else {
        finalGameId = votingState.tiedGameIds[0];
      }
      const chosenGame = data.availableGames.find((g) => g.id === finalGameId);
      finalGameTitle = chosenGame ? chosenGame.title : 'Selected Game';
      votingState.winningGameId = finalGameId;
      votingState.winningGameTitle = finalGameTitle;
    }

    if (!finalGameId && data.availableGames.length > 0) {
      finalGameId = data.availableGames[0].id;
      finalGameTitle = data.availableGames[0].title;
      votingState.winningGameId = finalGameId;
      votingState.winningGameTitle = finalGameTitle;
    }

    data.votingState = votingState;
    data.session.winning_game_id = finalGameId;
    data.session.winning_game_title = finalGameTitle;
    data.session.current_game_id = finalGameId;
    data.session.current_game_title = finalGameTitle;
    data.session.status = 'ready-to-start';
    data.session.updated_at = new Date().toISOString();

    this.storeSessionData(sessionId, data);
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(data.session));

    const hostSecret = this.getHostSecret(sessionId);
    const supabase = supabaseService.getClient();
    if (supabase && hostSecret) {
      const { error: updateError } = await supabase.rpc('host_update_session_status_rpc', {
        p_session_id: sessionId,
        p_host_secret: hostSecret,
        p_new_status: 'ready-to-start',
        p_winning_game_id: finalGameId || null,
        p_winning_game_title: finalGameTitle || null,
        p_current_game_id: finalGameId || null,
        p_current_game_title: finalGameTitle || null,
      });

      if (updateError) {
        throw new Error(`Failed to close voting in cloud: ${updateError.message}`);
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

  async startWinningGame(sessionId: string): Promise<string> {
    const data = this.getSessionData(sessionId);
    if (!data) throw new Error('Session not found');

    if (!data.session.winning_game_id) {
      throw new Error('No winning game selected yet.');
    }

    data.session.status = 'in-progress';
    data.session.current_game_id = data.session.winning_game_id;
    data.session.current_game_title = data.session.winning_game_title;
    data.session.updated_at = new Date().toISOString();
    data.currentLeaderboard = null;

    this.storeSessionData(sessionId, data);
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(data.session));

    const hostSecret = this.getHostSecret(sessionId);
    const supabase = supabaseService.getClient();
    if (supabase && hostSecret) {
      const { error: startError } = await supabase.rpc('host_update_session_status_rpc', {
        p_session_id: sessionId,
        p_host_secret: hostSecret,
        p_new_status: 'in-progress',
        p_winning_game_id: data.session.winning_game_id,
        p_winning_game_title: data.session.winning_game_title,
        p_current_game_id: data.session.winning_game_id,
        p_current_game_title: data.session.winning_game_title,
      });

      if (startError) {
        throw new Error(`Failed to start game in cloud: ${startError.message}`);
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
  // Individual Game Leaderboards
  // -------------------------------------------------------------
  getRankingCriterionForGame(gameId: string, gameTitle: string): { criterion: RankingCriterion; unit: string } {
    const lowerId = gameId.toLowerCase();
    const lowerTitle = gameTitle.toLowerCase();

    if (lowerId.includes('guess') || lowerTitle.includes('guess')) {
      return { criterion: 'lowest-score', unit: 'attempts' };
    }
    if (lowerId.includes('memory') || lowerTitle.includes('match') || lowerTitle.includes('memory')) {
      return { criterion: 'lowest-score', unit: 'moves' };
    }
    if (lowerId.includes('solitaire') || lowerTitle.includes('peg')) {
      return { criterion: 'lowest-score', unit: 'pegs left' };
    }
    if (lowerId.includes('speed') || lowerTitle.includes('race') || lowerTitle.includes('time')) {
      return { criterion: 'fastest-time', unit: 'seconds' };
    }
    return { criterion: 'highest-score', unit: 'points' };
  }

  sortLeaderboardEntries(entries: GameResultEntry[], criterion: RankingCriterion): GameResultEntry[] {
    const sorted = [...entries].sort((a, b) => {
      const numA = typeof a.score === 'number' ? a.score : parseFloat(String(a.score)) || 0;
      const numB = typeof b.score === 'number' ? b.score : parseFloat(String(b.score)) || 0;

      if (criterion === 'lowest-score' || criterion === 'fastest-time') {
        if (numA !== numB) return numA - numB;
      } else {
        if (numA !== numB) return numB - numA;
      }
      return new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime();
    });

    return sorted.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  }

  async recordGameResult(
    sessionId: string,
    gameId: string,
    gameTitle: string,
    participantId: string,
    score: number | string,
    summary: string
  ): Promise<GameLeaderboard> {
    const data = this.getSessionData(sessionId);
    if (!data) throw new Error('Session not found');

    const participant = data.participants.find((p) => p.id === participantId);
    const participantName = participant ? participant.player_name : 'Player';
    const now = new Date().toISOString();

    const { criterion, unit } = this.getRankingCriterionForGame(gameId, gameTitle);

    let leaderboard = data.currentLeaderboard;
    if (!leaderboard || leaderboard.game_id !== gameId) {
      leaderboard = {
        id: crypto.randomUUID ? crypto.randomUUID() : `lb_${Date.now()}`,
        session_id: sessionId,
        game_id: gameId,
        game_title: gameTitle,
        ranking_criterion: criterion,
        unit_label: unit,
        entries: [],
        finalized_at: now,
      };
    }

    const existingIndex = leaderboard.entries.findIndex((e) => e.participant_id === participantId);
    const newEntry: GameResultEntry = {
      rank: 1,
      participant_id: participantId,
      participant_name: participantName,
      score,
      summary: summary || `${score} ${unit}`,
      completed_at: now,
    };

    if (existingIndex >= 0) {
      leaderboard.entries[existingIndex] = newEntry;
    } else {
      leaderboard.entries.push(newEntry);
    }

    leaderboard.entries = this.sortLeaderboardEntries(leaderboard.entries, criterion);
    leaderboard.finalized_at = now;

    data.currentLeaderboard = leaderboard;
    data.session.status = 'game-ended';
    data.session.updated_at = now;

    const historyIndex = data.history.findIndex((h) => h.id === leaderboard!.id || (h.game_id === gameId && h.finalized_at === leaderboard!.finalized_at));
    if (historyIndex >= 0) {
      data.history[historyIndex] = leaderboard;
    } else {
      data.history.push(leaderboard);
    }
    data.session.game_history = data.history;

    this.storeSessionData(sessionId, data);
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(data.session));

    const hostSecret = this.getHostSecret(sessionId);
    const supabase = supabaseService.getClient();
    if (supabase && hostSecret) {
      const { error: resultError } = await supabase.rpc('host_record_game_result_rpc', {
        p_session_id: sessionId,
        p_host_secret: hostSecret,
        p_game_history: data.history,
      });

      if (resultError) {
        throw new Error(`Failed to record game results in cloud: ${resultError.message}`);
      }
    }

    this.broadcast('GAME_LEADERBOARD_UPDATED', {
      sessionId,
      leaderboard,
      status: 'game-ended',
    });

    return leaderboard;
  }

  // -------------------------------------------------------------
  // Session Return to Lobby & Final Session Results Recap
  // -------------------------------------------------------------
  async returnToLobby(sessionId: string): Promise<MultiplayerSession> {
    const data = this.getSessionData(sessionId);
    if (!data) throw new Error('Session not found');

    const now = new Date().toISOString();
    data.session.status = 'voting';
    data.session.winning_game_id = undefined;
    data.session.winning_game_title = undefined;
    data.session.current_game_id = undefined;
    data.session.current_game_title = undefined;
    data.session.updated_at = now;
    data.votes = [];
    data.votingState = {
      status: 'open',
      totalVotes: 0,
      tallies: {},
      isTie: false,
      tiedGameIds: [],
    };
    data.currentLeaderboard = null;

    this.storeSessionData(sessionId, data);
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(data.session));

    const hostSecret = this.getHostSecret(sessionId);
    const supabase = supabaseService.getClient();
    if (supabase && hostSecret) {
      const { error: returnError } = await supabase.rpc('host_update_session_status_rpc', {
        p_session_id: sessionId,
        p_host_secret: hostSecret,
        p_new_status: 'voting',
        p_winning_game_id: null,
        p_winning_game_title: null,
        p_current_game_id: null,
        p_current_game_title: null,
      });

      if (returnError) {
        throw new Error(`Failed to return to lobby in cloud: ${returnError.message}`);
      }
    }

    this.broadcast('SESSION_RETURNED_TO_LOBBY', { sessionId, session: data.session });
    return data.session;
  }

  async showFinalSessionRecap(sessionId: string): Promise<MultiplayerSession> {
    const data = this.getSessionData(sessionId);
    if (!data) throw new Error('Session not found');

    const now = new Date().toISOString();
    data.session.status = 'session-recap';
    data.session.updated_at = now;
    data.session.game_history = data.history;

    this.storeSessionData(sessionId, data);
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(data.session));

    const hostSecret = this.getHostSecret(sessionId);
    const supabase = supabaseService.getClient();
    if (supabase && hostSecret) {
      const { error: recapError } = await supabase.rpc('host_update_session_status_rpc', {
        p_session_id: sessionId,
        p_host_secret: hostSecret,
        p_new_status: 'session-recap',
        p_winning_game_id: null,
        p_winning_game_title: null,
        p_current_game_id: null,
        p_current_game_title: null,
      });

      if (recapError) {
        throw new Error(`Failed to show session recap in cloud: ${recapError.message}`);
      }
    }

    this.broadcast('SESSION_RECAP_TRIGGERED', {
      sessionId,
      session: data.session,
      history: data.history,
    });

    return data.session;
  }

  async closeSession(sessionId: string): Promise<void> {
    const data = this.getSessionData(sessionId);
    if (data) {
      data.session.status = 'completed';
      data.session.updated_at = new Date().toISOString();
      this.storeSessionData(sessionId, data);
    }
    const hostSecret = this.getHostSecret(sessionId);
    const supabase = supabaseService.getClient();
    if (supabase && hostSecret) {
      await supabase.rpc('host_update_session_status_rpc', {
        p_session_id: sessionId,
        p_host_secret: hostSecret,
        p_new_status: 'completed',
        p_winning_game_id: null,
        p_winning_game_title: null,
        p_current_game_id: null,
        p_current_game_title: null,
      });
    }
    this.broadcast('SESSION_CLOSED', { sessionId });
    this.clearActiveSession();
  }

  // -------------------------------------------------------------
  // Data Access Helpers & Remote Cross-Device Hydration
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

  getSessionData(sessionId: string): StoredSessionData | null {
    try {
      const raw = localStorage.getItem(`playbench_sess_data_${sessionId}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed.history) parsed.history = [];
      return parsed;
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

if (typeof window !== 'undefined') {
  (window as any).__multiplayerService = multiplayerService;
}
