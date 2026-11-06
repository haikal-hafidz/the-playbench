/**
 * Multiplayer Data Models and Contracts for The Playbench (Stage 7)
 * Focuses on session lifecycle and game selection voting.
 */

export type SessionStatus =
  | 'waiting'
  | 'voting'
  | 'ready-to-start'
  | 'in-progress'
  | 'completed';

export interface SessionSettings {
  maxPlayers?: number;
  votingDurationSeconds?: number;
  tieBreakerRule?: 'random' | 'host-choice' | 'first-to-score';
}

export interface MultiplayerSession {
  id: string;
  code: string;
  host_id: string;
  status: SessionStatus;
  winning_game_id?: string;
  winning_game_title?: string;
  settings: SessionSettings;
  created_at: string;
  updated_at: string;
}

export interface SessionParticipant {
  id: string;
  session_id: string;
  participant_token: string;
  player_name: string;
  role: 'host' | 'player';
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
