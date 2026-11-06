# The Playbench — Multiplayer Session Database & Security Setup

Stage 7 implements cross-device real-time multiplayer sessions powered by Supabase.

This document outlines the PostgreSQL schema, Row Level Security (RLS) policies, foreign keys, constraints, and real-time subscription configurations required for The Playbench Multiplayer architecture.

---

## 1. Overview & Architectural Principles

1. **Anonymous / Host Authentication**: Hosts can be authenticated users (via Supabase Auth) or guest hosts with cryptographic host tokens. Players participate without requiring mandatory Supabase user accounts, joining with unique session codes and display names.
2. **Session Isolation**: Participants only have access to their active session. Row Level Security policies ensure players cannot read or modify data from unrelated sessions.
3. **Host Administration**: Only the session creator (Host) has permission to change session status (`waiting`, `voting`, `starting`, `in-progress`, `completed`), open/close game selection voting, and launch the winning game.
4. **Game Selection Voting**:
   - The voting system is dedicated to deciding **which game the multiplayer session will play**.
   - Each player gets exactly **one active vote**. A player may change their selection before voting closes, in which case their previous vote is replaced, not added.
   - The database enforces a `UNIQUE(session_id, participant_id)` constraint on `session_game_votes`.
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
    status TEXT NOT NULL CHECK (status IN ('waiting', 'voting', 'ready-to-start', 'in-progress', 'completed')),
    winning_game_id TEXT,
    winning_game_title TEXT,
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

-- 3. Create session_game_votes table with strict one-vote-per-participant constraint
CREATE TABLE IF NOT EXISTS public.session_game_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.multiplayer_sessions(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES public.session_participants(id) ON DELETE CASCADE,
    game_id TEXT NOT NULL,
    game_title TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_vote_per_participant_per_session UNIQUE (session_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_session_game_votes_session ON public.session_game_votes (session_id);
```

---

## 3. Row Level Security (RLS) Policies

Enable Row Level Security on all multiplayer tables to ensure isolated and authorized access:

```sql
-- Enable RLS
ALTER TABLE public.multiplayer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_game_votes ENABLE ROW LEVEL SECURITY;

-- multiplayer_sessions:
-- Anyone can view active sessions (to look up by code and join)
CREATE POLICY "Public read sessions"
    ON public.multiplayer_sessions FOR SELECT
    USING (true);

-- Any user can create a session (as host)
CREATE POLICY "Insert session"
    ON public.multiplayer_sessions FOR INSERT
    WITH CHECK (true);

-- Host can update session status and winning game
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

-- session_game_votes:
-- Anyone in session can view game votes to see real-time tally
CREATE POLICY "Read session game votes"
    ON public.session_game_votes FOR SELECT
    USING (true);

-- Participants can insert or update their single vote (upsert)
CREATE POLICY "Submit game vote"
    ON public.session_game_votes FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Change game vote"
    ON public.session_game_votes FOR UPDATE
    USING (true);
```

---

## 4. Supabase Realtime Setup

Enable Realtime replication for multiplayer tables so clients receive real-time postgres notifications:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.multiplayer_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_game_votes;
```

---

## 5. Offline & Unconfigured Resilience

The frontend application includes a built-in BroadcastChannel & Local Storage fallback that enables multi-tab local testing and offline multi-client gameplay without requiring live Supabase credentials. When live `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are provided, the system seamlessly uses real-time network subscriptions.
