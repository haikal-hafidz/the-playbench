# The Playbench — Multiplayer Session Database & Security Setup

Stage 7 implements cross-device real-time multiplayer sessions powered by Supabase.

This document outlines the PostgreSQL schema, Zero-Trust Row Level Security (RLS) lock, hardened Security Definer RPC functions, and Realtime Broadcast architecture required for The Playbench Multiplayer engine.

---

## 1. Zero-Trust Security Architecture & Threat Model

### The Problem with Direct Table SELECT
In anonymous multiplayer systems, providing direct table `SELECT` via `USING (true)` policies allows any unauthenticated visitor to:
- Enumerate all active rooms and scrape all session codes.
- Query `session_participants` directly to harvest player names, connection states, and participant IDs.
- Query `session_game_votes` directly to spy on ballots or track voter behaviors.

### The Zero-Trust Solution
1. **Total Revocation of Direct Table Access**:
   - `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on `multiplayer_sessions`, `session_participants`, and `session_game_votes` are completely revoked from `anon`, `authenticated`, and `PUBLIC`.
   - Table-level RLS is enabled with NO public read policies (`DENY ALL` by default). Direct REST queries return empty results (`401/403` or zero rows).
2. **Strict Server-Side RPC Mediation**:
   - All interactions must go through explicit PostgreSQL `SECURITY DEFINER` RPC functions with server-side validation.
   - **`SET search_path = public, pg_temp;`** is explicitly applied to every `SECURITY DEFINER` function to eliminate search-path hijacking and privilege escalation attacks.
   - Default public execution privileges are explicitly revoked (`REVOKE ALL ON FUNCTION ... FROM PUBLIC;`) before granting execution exclusively to `anon` and `authenticated`.
3. **Privacy-Separated Discovery vs. Authorized State**:
   - `discover_room_by_code_rpc(p_code)`: Sanitized public discovery returning ONLY high-level metadata needed to render the join prompt: `{ id, code, status, participant_count, max_participants, game_count, created_at }`. Never returns player rosters, names, votes, or tokens.
   - `get_room_state_rpc(p_session_id, p_participant_id, p_participant_token)`: Access to detailed room state (participants, active game, voting tally, history) is restricted strictly to verified room participants presenting their valid token.
4. **Token Hashing & Impersonation Prevention**:
   - `host_secret_hash` and `participant_token_hash` store SHA-256 digests (`encode(digest(token, 'sha256'), 'hex')`). Plaintext secrets never reside on database tables.
   - Every participant operation (voting, heartbeats) validates the token hash against the stored participant record.
5. **Realtime Broadcast Strategy Without Public Postgres Changes**:
   - Because direct `SELECT` on postgres tables is revoked, relying on Postgres Changes replication would fail or require opening table read access.
   - The Playbench uses **Supabase Realtime Broadcast Channels** (`playbench_session_${sessionId}`).
   - State transition events (`SESSION_UPDATED`, `PARTICIPANT_JOINED`, `GAME_VOTE_SUBMITTED`, `GAME_STARTED`, `SESSION_RECAP_TRIGGERED`) are pushed over the channel.
   - Receiving clients refresh their state by calling `get_room_state_rpc(sessionId, participantId, token)`, which is cryptographically authorized.
   - Unauthorized eavesdroppers on the broadcast channel cannot retrieve the room state because they lack a valid `(participant_id, participant_token)`.

---

## 2. PostgreSQL DDL Migrations & Safe Upgrade (Idempotent)

Run the following SQL migration script in your Supabase SQL Editor. This script is fully idempotent and safely upgrades existing databases without dropping existing data.

```sql
-- =============================================================================
-- STEP 1: EXTENSIONS & TABLES
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create multiplayer_sessions
CREATE TABLE IF NOT EXISTS public.multiplayer_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(8) UNIQUE NOT NULL,
    host_id TEXT NOT NULL,
    host_secret_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'voting',
    winning_game_id TEXT,
    winning_game_title TEXT,
    current_game_id TEXT,
    current_game_title TEXT,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    available_games JSONB NOT NULL DEFAULT '[]'::jsonb,
    game_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    max_participants INT DEFAULT 12,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Idempotent column additions for existing installations
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'multiplayer_sessions' AND column_name = 'host_secret_hash') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'multiplayer_sessions' AND column_name = 'host_secret') THEN
            ALTER TABLE public.multiplayer_sessions ADD COLUMN host_secret_hash TEXT;
            UPDATE public.multiplayer_sessions SET host_secret_hash = encode(digest(host_secret, 'sha256'), 'hex');
            ALTER TABLE public.multiplayer_sessions ALTER COLUMN host_secret_hash SET NOT NULL;
        ELSE
            ALTER TABLE public.multiplayer_sessions ADD COLUMN host_secret_hash TEXT NOT NULL DEFAULT encode(digest(gen_random_uuid()::text, 'sha256'), 'hex');
        END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'multiplayer_sessions' AND column_name = 'available_games') THEN
        ALTER TABLE public.multiplayer_sessions ADD COLUMN available_games JSONB NOT NULL DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'multiplayer_sessions' AND column_name = 'game_history') THEN
        ALTER TABLE public.multiplayer_sessions ADD COLUMN game_history JSONB NOT NULL DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'multiplayer_sessions' AND column_name = 'max_participants') THEN
        ALTER TABLE public.multiplayer_sessions ADD COLUMN max_participants INT DEFAULT 12;
    END IF;
END $$;

-- Update status check constraint safely
DO $$
BEGIN
    ALTER TABLE public.multiplayer_sessions DROP CONSTRAINT IF EXISTS multiplayer_sessions_status_check;
    ALTER TABLE public.multiplayer_sessions ADD CONSTRAINT multiplayer_sessions_status_check CHECK (status IN (
        'waiting',
        'voting',
        'ready-to-start',
        'in-progress',
        'game-ended',
        'session-recap',
        'completed'
    ));
END $$;

CREATE INDEX IF NOT EXISTS idx_multiplayer_sessions_code ON public.multiplayer_sessions (code);
CREATE INDEX IF NOT EXISTS idx_multiplayer_sessions_status ON public.multiplayer_sessions (status);

-- 2. Create session_participants
CREATE TABLE IF NOT EXISTS public.session_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.multiplayer_sessions(id) ON DELETE CASCADE,
    participant_token_hash TEXT NOT NULL,
    player_name VARCHAR(40) NOT NULL,
    original_name VARCHAR(40),
    role TEXT NOT NULL CHECK (role IN ('host', 'player')),
    color TEXT,
    ready BOOLEAN DEFAULT false,
    is_connected BOOLEAN DEFAULT true,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Idempotent column additions for session_participants
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'session_participants' AND column_name = 'participant_token_hash') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'session_participants' AND column_name = 'participant_token') THEN
            ALTER TABLE public.session_participants ADD COLUMN participant_token_hash TEXT;
            UPDATE public.session_participants SET participant_token_hash = encode(digest(participant_token, 'sha256'), 'hex');
            ALTER TABLE public.session_participants ALTER COLUMN participant_token_hash SET NOT NULL;
        ELSE
            ALTER TABLE public.session_participants ADD COLUMN participant_token_hash TEXT NOT NULL DEFAULT encode(digest(gen_random_uuid()::text, 'sha256'), 'hex');
        END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'session_participants' AND column_name = 'original_name') THEN
        ALTER TABLE public.session_participants ADD COLUMN original_name VARCHAR(40);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'session_participants' AND column_name = 'is_connected') THEN
        ALTER TABLE public.session_participants ADD COLUMN is_connected BOOLEAN DEFAULT true;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_session_participants_session ON public.session_participants (session_id);

-- 3. Create session_game_votes
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

-- =============================================================================
-- STEP 2: TOTAL ZERO-TRUST REVOCATION OF DIRECT TABLE ACCESS
-- =============================================================================

ALTER TABLE public.multiplayer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_game_votes ENABLE ROW LEVEL SECURITY;

-- Revoke ALL direct table permissions from public, anon, and authenticated
REVOKE ALL ON public.multiplayer_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.session_participants FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.session_game_votes FROM PUBLIC, anon, authenticated;

-- Drop all open public read policies
DROP POLICY IF EXISTS "Public read sessions" ON public.multiplayer_sessions;
DROP POLICY IF EXISTS "Public read participants" ON public.session_participants;
DROP POLICY IF EXISTS "Public read session votes" ON public.session_game_votes;
DROP POLICY IF EXISTS "Insert session" ON public.multiplayer_sessions;
DROP POLICY IF EXISTS "Update session" ON public.multiplayer_sessions;
DROP POLICY IF EXISTS "View participants" ON public.session_participants;
DROP POLICY IF EXISTS "Insert participant" ON public.session_participants;
DROP POLICY IF EXISTS "Update participant presence" ON public.session_participants;
DROP POLICY IF EXISTS "Read session game votes" ON public.session_game_votes;
DROP POLICY IF EXISTS "Submit game vote" ON public.session_game_votes;
DROP POLICY IF EXISTS "Change game vote" ON public.session_game_votes;

-- =============================================================================
-- STEP 3: HARDENED SECURITY DEFINER RPC FUNCTIONS
-- =============================================================================

-- 1. Create Multiplayer Session (Host)
CREATE OR REPLACE FUNCTION public.create_multiplayer_session_rpc(
    p_id UUID,
    p_code TEXT,
    p_host_id TEXT,
    p_host_name TEXT,
    p_host_secret TEXT,
    p_available_games JSONB,
    p_host_participant_id UUID,
    p_host_participant_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_clean_code TEXT := UPPER(TRIM(p_code));
    v_clean_name TEXT := SUBSTRING(REGEXP_REPLACE(TRIM(p_host_name), '[\r\n\t]', '', 'g') FROM 1 FOR 30);
    v_host_hash TEXT := encode(digest(p_host_secret, 'sha256'), 'hex');
    v_token_hash TEXT := encode(digest(p_host_participant_token, 'sha256'), 'hex');
    v_session JSONB;
BEGIN
    IF LENGTH(v_clean_name) = 0 THEN
        RAISE EXCEPTION 'Host name cannot be empty.';
    END IF;

    IF LENGTH(v_clean_code) < 4 OR LENGTH(v_clean_code) > 8 THEN
        RAISE EXCEPTION 'Invalid session code.';
    END IF;

    INSERT INTO public.multiplayer_sessions (
        id, code, host_id, host_secret_hash, status, available_games, game_history, created_at, updated_at
    ) VALUES (
        p_id, v_clean_code, p_host_id, v_host_hash, 'voting', p_available_games, '[]'::jsonb, now(), now()
    );

    INSERT INTO public.session_participants (
        id, session_id, participant_token_hash, player_name, original_name, role, is_connected, joined_at, last_heartbeat
    ) VALUES (
        p_host_participant_id, p_id, v_token_hash, v_clean_name, v_clean_name, 'host', true, now(), now()
    );

    SELECT to_jsonb(s.*) - 'host_secret_hash' INTO v_session
    FROM public.multiplayer_sessions s
    WHERE s.id = p_id;

    RETURN v_session;
END;
$$;

-- 2. Discover Room by Code (Sanitized Public Discovery)
CREATE OR REPLACE FUNCTION public.discover_room_by_code_rpc(
    p_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session public.multiplayer_sessions%ROWTYPE;
    v_count INT;
    v_game_count INT;
    v_clean_code TEXT := UPPER(TRIM(p_code));
BEGIN
    IF LENGTH(v_clean_code) < 4 OR LENGTH(v_clean_code) > 8 THEN
        RETURN NULL;
    END IF;

    SELECT * INTO v_session
    FROM public.multiplayer_sessions
    WHERE code = v_clean_code
      AND status != 'completed';

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    SELECT count(*) INTO v_count
    FROM public.session_participants
    WHERE session_id = v_session.id AND is_connected = true;

    v_game_count := COALESCE(jsonb_array_length(v_session.available_games), 0);

    RETURN jsonb_build_object(
        'id', v_session.id,
        'code', v_session.code,
        'status', v_session.status,
        'participant_count', v_count,
        'max_participants', COALESCE(v_session.max_participants, 12),
        'game_count', v_game_count,
        'created_at', v_session.created_at
    );
END;
$$;

-- 3. Join Multiplayer Session (Player)
CREATE OR REPLACE FUNCTION public.join_multiplayer_session_rpc(
    p_session_id UUID,
    p_participant_id UUID,
    p_participant_token TEXT,
    p_player_name TEXT,
    p_original_name TEXT,
    p_color TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session public.multiplayer_sessions%ROWTYPE;
    v_part public.session_participants%ROWTYPE;
    v_count INT;
    v_clean_name TEXT := SUBSTRING(REGEXP_REPLACE(TRIM(p_player_name), '[\r\n\t]', '', 'g') FROM 1 FOR 30);
    v_clean_orig TEXT := SUBSTRING(REGEXP_REPLACE(TRIM(COALESCE(p_original_name, p_player_name)), '[\r\n\t]', '', 'g') FROM 1 FOR 30);
    v_token_hash TEXT := encode(digest(p_participant_token, 'sha256'), 'hex');
BEGIN
    IF LENGTH(v_clean_name) = 0 THEN
        RAISE EXCEPTION 'Player name cannot be empty.';
    END IF;

    SELECT * INTO v_session FROM public.multiplayer_sessions WHERE id = p_session_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session not found.';
    END IF;

    IF v_session.status = 'completed' THEN
        RAISE EXCEPTION 'This session has already ended.';
    END IF;

    IF v_session.status != 'waiting' AND v_session.status != 'voting' THEN
        RAISE EXCEPTION 'Cannot join session: gameplay is already in progress.';
    END IF;

    SELECT count(*) INTO v_count
    FROM public.session_participants
    WHERE session_id = p_session_id AND is_connected = true;

    IF v_count >= COALESCE(v_session.max_participants, 12) THEN
        RAISE EXCEPTION 'Session has reached maximum participants limit.';
    END IF;

    INSERT INTO public.session_participants (
        id, session_id, participant_token_hash, player_name, original_name, role, color, is_connected, joined_at, last_heartbeat
    ) VALUES (
        p_participant_id, p_session_id, v_token_hash, v_clean_name, v_clean_orig, 'player', p_color, true, now(), now()
    )
    RETURNING * INTO v_part;

    RETURN to_jsonb(v_part) - 'participant_token_hash';
END;
$$;

-- 4. Get Room State (Authorized Participant Access)
CREATE OR REPLACE FUNCTION public.get_room_state_rpc(
    p_session_id UUID,
    p_participant_id UUID,
    p_participant_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session public.multiplayer_sessions%ROWTYPE;
    v_part public.session_participants%ROWTYPE;
    v_token_hash TEXT := encode(digest(p_participant_token, 'sha256'), 'hex');
    v_parts JSONB;
    v_votes JSONB;
BEGIN
    SELECT * INTO v_part
    FROM public.session_participants
    WHERE id = p_participant_id AND session_id = p_session_id;

    IF NOT FOUND OR v_part.participant_token_hash != v_token_hash THEN
        RAISE EXCEPTION 'Unauthorized: invalid participant credentials for this session.';
    END IF;

    SELECT * INTO v_session FROM public.multiplayer_sessions WHERE id = p_session_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session not found.';
    END IF;

    SELECT COALESCE(jsonb_agg(to_jsonb(p.*) - 'participant_token_hash'), '[]'::jsonb)
    INTO v_parts
    FROM public.session_participants p
    WHERE p.session_id = p_session_id;

    SELECT COALESCE(jsonb_agg(to_jsonb(v.*)), '[]'::jsonb)
    INTO v_votes
    FROM public.session_game_votes v
    WHERE v.session_id = p_session_id;

    RETURN jsonb_build_object(
        'session', to_jsonb(v_session) - 'host_secret_hash',
        'participants', v_parts,
        'votes', v_votes
    );
END;
$$;

-- 5. Submit Game Vote (1 Vote per Participant, Token-verified)
CREATE OR REPLACE FUNCTION public.submit_game_vote_rpc(
    p_session_id UUID,
    p_participant_id UUID,
    p_participant_token TEXT,
    p_game_id TEXT,
    p_game_title TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session public.multiplayer_sessions%ROWTYPE;
    v_part public.session_participants%ROWTYPE;
    v_token_hash TEXT := encode(digest(p_participant_token, 'sha256'), 'hex');
    v_vote public.session_game_votes%ROWTYPE;
BEGIN
    SELECT * INTO v_session FROM public.multiplayer_sessions WHERE id = p_session_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session not found.';
    END IF;
    IF v_session.status != 'voting' AND v_session.status != 'waiting' THEN
        RAISE EXCEPTION 'Voting is currently closed for this session.';
    END IF;

    SELECT * INTO v_part FROM public.session_participants
    WHERE id = p_participant_id AND session_id = p_session_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Participant not found in session.';
    END IF;
    IF v_part.participant_token_hash != v_token_hash THEN
        RAISE EXCEPTION 'Unauthorized: invalid participant token.';
    END IF;

    INSERT INTO public.session_game_votes (
        id, session_id, participant_id, game_id, game_title, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), p_session_id, p_participant_id, p_game_id, p_game_title, now(), now()
    )
    ON CONFLICT (session_id, participant_id) DO UPDATE SET
        game_id = EXCLUDED.game_id,
        game_title = EXCLUDED.game_title,
        updated_at = now()
    RETURNING * INTO v_vote;

    RETURN to_jsonb(v_vote);
END;
$$;

-- 6. Update Participant Presence (Heartbeat)
CREATE OR REPLACE FUNCTION public.update_participant_presence_rpc(
    p_session_id UUID,
    p_participant_id UUID,
    p_participant_token TEXT,
    p_is_connected BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_part public.session_participants%ROWTYPE;
    v_token_hash TEXT := encode(digest(p_participant_token, 'sha256'), 'hex');
BEGIN
    SELECT * INTO v_part
    FROM public.session_participants
    WHERE id = p_participant_id AND session_id = p_session_id;

    IF NOT FOUND OR v_part.participant_token_hash != v_token_hash THEN
        RETURN false;
    END IF;

    UPDATE public.session_participants
    SET last_heartbeat = now(), is_connected = p_is_connected
    WHERE id = p_participant_id;

    RETURN true;
END;
$$;

-- 7. Host Update Session Status (Strict State Machine)
CREATE OR REPLACE FUNCTION public.host_update_session_status_rpc(
    p_session_id UUID,
    p_host_secret TEXT,
    p_new_status TEXT,
    p_winning_game_id TEXT DEFAULT NULL,
    p_winning_game_title TEXT DEFAULT NULL,
    p_current_game_id TEXT DEFAULT NULL,
    p_current_game_title TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session public.multiplayer_sessions%ROWTYPE;
    v_host_hash TEXT := encode(digest(p_host_secret, 'sha256'), 'hex');
BEGIN
    SELECT * INTO v_session FROM public.multiplayer_sessions WHERE id = p_session_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session not found.';
    END IF;
    IF v_session.host_secret_hash != v_host_hash THEN
        RAISE EXCEPTION 'Unauthorized: only the host can update session status.';
    END IF;

    -- Strict State Machine Validation
    IF p_new_status = 'ready-to-start' THEN
        IF v_session.status != 'voting' AND v_session.status != 'waiting' THEN
            RAISE EXCEPTION 'Cannot close voting: session is in "%" status.', v_session.status;
        END IF;
        IF p_winning_game_id IS NULL THEN
            RAISE EXCEPTION 'Winning game ID must be specified when closing voting.';
        END IF;
    ELSIF p_new_status = 'in-progress' THEN
        IF v_session.status != 'ready-to-start' AND v_session.status != 'voting' THEN
            RAISE EXCEPTION 'Cannot start game: session is in "%" status.', v_session.status;
        END IF;
    ELSIF p_new_status = 'game-ended' THEN
        IF v_session.status != 'in-progress' THEN
            RAISE EXCEPTION 'Cannot end game: session is not in progress.';
        END IF;
    ELSIF p_new_status = 'voting' THEN
        IF v_session.status != 'game-ended' AND v_session.status != 'session-recap' AND v_session.status != 'waiting' THEN
            RAISE EXCEPTION 'Cannot return to lobby from "%" status.', v_session.status;
        END IF;
        DELETE FROM public.session_game_votes WHERE session_id = p_session_id;
    ELSIF p_new_status = 'session-recap' THEN
        IF v_session.status != 'game-ended' AND v_session.status != 'voting' THEN
            RAISE EXCEPTION 'Cannot show recap from "%" status.', v_session.status;
        END IF;
    ELSIF p_new_status = 'completed' THEN
        NULL;
    ELSE
        RAISE EXCEPTION 'Invalid target session status: "%".', p_new_status;
    END IF;

    UPDATE public.multiplayer_sessions SET
        status = p_new_status,
        winning_game_id = p_winning_game_id,
        winning_game_title = p_winning_game_title,
        current_game_id = p_current_game_id,
        current_game_title = p_current_game_title,
        updated_at = now()
    WHERE id = p_session_id;

    RETURN (SELECT to_jsonb(s.*) - 'host_secret_hash' FROM public.multiplayer_sessions s WHERE s.id = p_session_id);
END;
$$;

-- 8. Host Record Game Result
CREATE OR REPLACE FUNCTION public.host_record_game_result_rpc(
    p_session_id UUID,
    p_host_secret TEXT,
    p_game_history JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session public.multiplayer_sessions%ROWTYPE;
    v_host_hash TEXT := encode(digest(p_host_secret, 'sha256'), 'hex');
BEGIN
    SELECT * INTO v_session FROM public.multiplayer_sessions WHERE id = p_session_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session not found.';
    END IF;
    IF v_session.host_secret_hash != v_host_hash THEN
        RAISE EXCEPTION 'Unauthorized: only the host can record game results.';
    END IF;

    UPDATE public.multiplayer_sessions SET
        status = 'game-ended',
        game_history = p_game_history,
        updated_at = now()
    WHERE id = p_session_id;

    RETURN (SELECT to_jsonb(s.*) - 'host_secret_hash' FROM public.multiplayer_sessions s WHERE s.id = p_session_id);
END;
$$;

-- =============================================================================
-- STEP 4: REVOKE DEFAULT PUBLIC EXECUTION & GRANT TO SPECIFIC ROLES
-- =============================================================================

REVOKE ALL ON FUNCTION public.create_multiplayer_session_rpc FROM PUBLIC;
REVOKE ALL ON FUNCTION public.discover_room_by_code_rpc FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_multiplayer_session_rpc FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_room_state_rpc FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_game_vote_rpc FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_participant_presence_rpc FROM PUBLIC;
REVOKE ALL ON FUNCTION public.host_update_session_status_rpc FROM PUBLIC;
REVOKE ALL ON FUNCTION public.host_record_game_result_rpc FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_multiplayer_session_rpc TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discover_room_by_code_rpc TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_multiplayer_session_rpc TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_room_state_rpc TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_game_vote_rpc TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_participant_presence_rpc TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.host_update_session_status_rpc TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.host_record_game_result_rpc TO anon, authenticated;
```

---

## 3. Realtime Broadcast Channel Setup

1. **Broadcast Event Subscription**:
   - Clients join the channel `playbench_session_${sessionId}`.
   - Hosts and players broadcast lightweight events over the channel:
     - `SESSION_CREATED`: signals session ready.
     - `PARTICIPANT_JOINED`: prompts peers to refresh their participant lists.
     - `GAME_VOTE_SUBMITTED`: prompts peers to re-tally votes.
     - `GAME_SELECTION_CLOSED`: notifies players that the winning game is determined.
     - `GAME_STARTED`: triggers player clients to launch into Game Space.
     - `SESSION_RETURNED_TO_LOBBY`: prompts clients to reset voting.
     - `SESSION_RECAP_TRIGGERED`: switches clients to the Final Results Recap.
2. **Authorized State Synchronization**:
   - When a client receives a broadcast signal, it queries `get_room_state_rpc(sessionId, participantId, token)`.
   - Unauthorized eavesdroppers cannot query `get_room_state_rpc` without a valid token.
   - Direct database changes on tables are completely inaccessible to unauthenticated REST calls.

---

## 4. Resilience and Offline Mode

- If Supabase environment variables (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`) are missing, The Playbench operates in **Local Offline Mode** using the browser's `BroadcastChannel`.
- If Supabase is configured, all actions are strictly routed through token-verified `SECURITY DEFINER` RPCs with `search_path = public, pg_temp`. Direct table mutations and reads are completely blocked.
