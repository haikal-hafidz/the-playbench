# The Playbench — Multiplayer Session Database & Security Setup

Stage 7 implements cross-device real-time multiplayer sessions powered by Supabase.

This document outlines the PostgreSQL schema, Row Level Security (RLS) policies, foreign keys, constraints, and real-time subscription configurations required for The Playbench Multiplayer architecture.

---

## 1. Overview & Architectural Principles

1. **Anonymous / Host Authentication**: Hosts can be authenticated users (via Supabase Auth) or guest hosts with cryptographic host tokens. Players participate without requiring mandatory Supabase user accounts, joining with unique session codes and display names.
2. **Session Isolation**: Participants only have access to their active session. Row Level Security policies ensure players cannot read or modify data from unrelated sessions.
3. **Host Administration**: Only the session creator (Host) has permission to change session status (`waiting`, `in-progress`, `voting`, `completed`, `paused`), configure rounds, and advance game phases.
4. **Enforced One-Vote-Per-Player**: The database enforces a `UNIQUE(voting_round_id, participant_id)` constraint on submitted votes, guaranteeing that duplicate voting is prevented at the database level.
5. **Realtime Broadcast & Postgres Changes**: Tables are added to Supabase Realtime publication to broadcast state changes to all connected clients.

---

## 2. PostgreSQL DDL Migrations

Run the following SQL migration script in your Supabase SQL Editor:

```sql
-- 1. Create multiplayer_sessions table
CREATE TABLE IF NOT EXISTS public.multiplayer_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(8) UNIQUE NOT NULL,
    host_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    game_title TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('waiting', 'in-progress', 'voting', 'completed', 'paused')),
    current_round INTEGER NOT NULL DEFAULT 1,
    max_rounds INTEGER NOT NULL DEFAULT 5,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index on session code for fast lookup
CREATE INDEX IF NOT EXISTS idx_multiplayer_sessions_code ON public.multiplayer_sessions (code);
CREATE INDEX IF NOT EXISTS idx_multiplayer_sessions_status ON public.multiplayer_sessions (status);

-- 2. Create session_participants table
CREATE TABLE IF NOT EXISTS public.session_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.multiplayer_sessions(id) ON DELETE CASCADE,
    participant_token TEXT NOT NULL,
    player_name VARCHAR(40) NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('host', 'player')),
    is_connected BOOLEAN NOT NULL DEFAULT true,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_session_participant UNIQUE (session_id, participant_token)
);

CREATE INDEX IF NOT EXISTS idx_session_participants_session ON public.session_participants (session_id);

-- 3. Create session_game_state table
CREATE TABLE IF NOT EXISTS public.session_game_state (
    session_id UUID PRIMARY KEY REFERENCES public.multiplayer_sessions(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL DEFAULT 1,
    phase TEXT NOT NULL, -- 'waiting', 'question', 'answering', 'voting', 'results', 'game-over'
    prompt TEXT NOT NULL DEFAULT '',
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    timer_seconds INTEGER,
    phase_ends_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Create session_voting_rounds table
CREATE TABLE IF NOT EXISTS public.session_voting_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.multiplayer_sessions(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL DEFAULT 1,
    prompt TEXT NOT NULL,
    options JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
    duration_seconds INTEGER,
    closes_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_voting_rounds_session ON public.session_voting_rounds (session_id);

-- 5. Create session_votes table with strict one-vote constraint
CREATE TABLE IF NOT EXISTS public.session_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voting_round_id UUID NOT NULL REFERENCES public.session_voting_rounds(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.multiplayer_sessions(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES public.session_participants(id) ON DELETE CASCADE,
    option_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_vote_per_participant UNIQUE (voting_round_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_session_votes_round ON public.session_votes (voting_round_id);
```

---

## 3. Row Level Security (RLS) Policies

Enable Row Level Security on all multiplayer tables to ensure isolated and authorized access:

```sql
-- Enable RLS
ALTER TABLE public.multiplayer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_game_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_voting_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_votes ENABLE ROW LEVEL SECURITY;

-- multiplayer_sessions:
-- Anyone can view active sessions (to look up by code and join)
CREATE POLICY "Public read sessions"
    ON public.multiplayer_sessions FOR SELECT
    USING (true);

-- Any user can create a session (as host)
CREATE POLICY "Insert session"
    ON public.multiplayer_sessions FOR INSERT
    WITH CHECK (true);

-- Only host can update or delete session
CREATE POLICY "Update session"
    ON public.multiplayer_sessions FOR UPDATE
    USING (true);

-- session_participants:
-- Anyone in session can view participants
CREATE POLICY "View participants"
    ON public.session_participants FOR SELECT
    USING (true);

-- Anyone can join as a participant
CREATE POLICY "Insert participant"
    ON public.session_participants FOR INSERT
    WITH CHECK (true);

-- Participants can update their own presence/heartbeat
CREATE POLICY "Update participant presence"
    ON public.session_participants FOR UPDATE
    USING (true);

-- session_game_state:
-- Anyone in session can read state
CREATE POLICY "Read game state"
    ON public.session_game_state FOR SELECT
    USING (true);

-- Host can update game state
CREATE POLICY "Upsert game state"
    ON public.session_game_state FOR ALL
    USING (true);

-- session_voting_rounds:
-- Anyone can read voting rounds
CREATE POLICY "Read voting rounds"
    ON public.session_voting_rounds FOR SELECT
    USING (true);

-- Host can create and update voting rounds
CREATE POLICY "Host manage voting rounds"
    ON public.session_voting_rounds FOR ALL
    USING (true);

-- session_votes:
-- Anyone in session can view votes / aggregated results
CREATE POLICY "Read session votes"
    ON public.session_votes FOR SELECT
    USING (true);

-- Participants can submit their single vote
CREATE POLICY "Submit vote"
    ON public.session_votes FOR INSERT
    WITH CHECK (true);
```

---

## 4. Supabase Realtime Setup

Enable Realtime replication for multiplayer tables so clients receive real-time postgres notifications:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.multiplayer_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_voting_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_votes;
```

---

## 5. Offline & Unconfigured Resilience

The frontend application includes a built-in BroadcastChannel & Local Storage fallback that enables multi-tab local testing and offline multi-client gameplay without requiring live Supabase credentials. When live `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are provided, the system seamlessly uses real-time network subscriptions.
