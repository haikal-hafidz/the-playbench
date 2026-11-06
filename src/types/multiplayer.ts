/**
 * Multiplayer Data Models and Contracts for The Playbench (Stage 7)
 */

export type SessionStatus = 'waiting' | 'in-progress' | 'voting' | 'completed' | 'paused';

export type GamePhase = 'waiting' | 'question' | 'answering' | 'voting' | 'results' | 'game-over';

export interface SessionSettings {
  maxPlayers?: number;
  votingDurationSeconds?: number;
  allowVoteChange?: boolean;
  tieBreakerRule?: 'random' | 'host-choice' | 'split-points' | 'unanimous';
  pointsPerCorrectVote?: number;
}

export interface MultiplayerSession {
  id: string;
  code: string;
  host_id: string;
  game_id: string;
  game_title: string;
  status: SessionStatus;
  current_round: number;
  max_rounds: number;
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

export interface SessionGameState {
  session_id: string;
  round_number: number;
  phase: GamePhase;
  prompt: string;
  options: Array<{ id: string; text: string; details?: string }>;
  scores: Record<string, number>; // participant_id -> score
  timer_seconds?: number;
  phase_ends_at?: string;
  updated_at: string;
}

export interface VotingRound {
  id: string;
  session_id: string;
  round_number: number;
  prompt: string;
  options: Array<{ id: string; text: string; color?: string }>;
  status: 'open' | 'closed';
  duration_seconds: number;
  closes_at?: string;
  created_at: string;
}

export interface SessionVote {
  id: string;
  voting_round_id: string;
  session_id: string;
  participant_id: string;
  option_id: string;
  created_at: string;
}

export interface VotingResult {
  roundId: string;
  status: 'open' | 'closed';
  totalVotes: number;
  counts: Record<string, number>; // option_id -> count
  percentages: Record<string, number>; // option_id -> percentage (0-100)
  winningOptionIds: string[];
  isTie: boolean;
  tieBreakerApplied?: string;
}
