/**
 * Multiplayer Data Models and Contracts for The Playbench (Stage 7)
 * Focuses on session lifecycle, participant display names, game selection voting,
 * individual game leaderboards, and final session recap.
 */

export type SessionStatus =
  | 'waiting'
  | 'voting'
  | 'ready-to-start'
  | 'in-progress'
  | 'game-ended'
  | 'session-recap'
  | 'completed';

export interface SessionSettings {
  maxPlayers?: number;
  votingDurationSeconds?: number;
  tieBreakerRule?: 'random' | 'host-choice' | 'first-to-score';
}

export interface SessionParticipant {
  id: string; // Unique internal player ID (UUID)
  session_id: string;
  participant_token?: string;
  player_name: string; // Clean display name shown in UI
  original_name?: string; // Input name before duplicate disambiguation
  role: 'host' | 'player';
  color?: string;
  ready?: boolean;
  is_connected: boolean;
  joined_at: string;
  last_heartbeat: string;
}

export interface GameVote {
  id: string;
  session_id: string;
  participant_id: string;
  game_id: string;
  game_title: string;
  created_at: string;
  updated_at: string;
}

export interface GameVoteTally {
  gameId: string;
  gameTitle: string;
  voteCount: number;
  percentage: number;
  voterNames: string[];
}

export interface GameSelectionVotingState {
  status: 'open' | 'closed';
  totalVotes: number;
  tallies: Record<string, GameVoteTally>; // gameId -> tally
  winningGameId?: string;
  winningGameTitle?: string;
  isTie: boolean;
  tiedGameIds: string[];
}

export type RankingCriterion = 'lowest-score' | 'highest-score' | 'fastest-time';

export interface GameResultEntry {
  rank: number;
  participant_id: string;
  participant_name: string;
  score: number | string;
  summary: string;
  completed_at: string;
}

export interface GameLeaderboard {
  id: string;
  session_id: string;
  game_id: string;
  game_title: string;
  ranking_criterion: RankingCriterion;
  unit_label?: string; // e.g. "attempts", "moves", "points"
  entries: GameResultEntry[];
  finalized_at: string;
}

export interface RoomDiscoveryInfo {
  id: string;
  code: string;
  status: SessionStatus;
  participant_count: number;
  max_participants: number;
  game_count: number;
  created_at: string;
}

export interface MultiplayerSession {
  id: string;
  code: string;
  host_id: string;
  status: SessionStatus;
  winning_game_id?: string;
  winning_game_title?: string;
  current_game_id?: string;
  current_game_title?: string;
  settings: SessionSettings;
  available_games?: import('../types').Game[];
  game_history: GameLeaderboard[];
  created_at: string;
  updated_at: string;
}
