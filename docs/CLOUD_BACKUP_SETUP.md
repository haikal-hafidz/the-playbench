# Cloud Backup & Sync Setup Guide (Stage 6)

The Playbench uses **Supabase** as its cloud backup and sync provider.

The platform is strictly **offline-first**: All gameplay, workshop development, prompt engineering, and local saves work 100% offline using browser IndexedDB (`playbench_db`) and LocalStorage (`playbench_prefs_v1`).

Cloud Backup & Sync is an **owner-opt-in** feature allowing the platform owner to securely back up snapshots to the cloud and synchronize between devices without exposing private projects or game saves to public visitors.

---

## 1. Environment Variables

To enable cloud backup in local development or production, define these environment variables in your `.env` or GitHub repository / deployment secrets:

```bash
# Supabase Project URL
VITE_SUPABASE_URL="https://<your-project-id>.supabase.co"

# Supabase Public Anonymous Key (SAFE for client bundles)
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

> ⚠️ **CRITICAL SECURITY RULE:** Never put the Supabase `service_role` key into client-side environment variables or client code. The Playbench client only ever interacts with Supabase using the public anonymous key protected by Row Level Security (RLS).

If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are missing or empty, The Playbench automatically runs in **Offline Mode** with graceful degradation.

---

## 2. Database Schema & Row Level Security (RLS)

In your Supabase SQL Editor, execute the following SQL migration script to create the `playbench_backups` table and configure Row Level Security:

```sql
-- 1. Create Playbench Backups Table
CREATE TABLE IF NOT EXISTS public.playbench_backups (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    payload JSONB NOT NULL,
    checksum TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    app_version TEXT NOT NULL DEFAULT '0.1.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Index on user_id and created_at for fast retrieval
CREATE INDEX IF NOT EXISTS idx_playbench_backups_user
ON public.playbench_backups (user_id, created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.playbench_backups ENABLE ROW LEVEL SECURITY;

-- 4. Policy: Users can only view their own backups
CREATE POLICY "Users can select own backups"
ON public.playbench_backups
FOR SELECT
USING (auth.uid() = user_id);

-- 5. Policy: Users can only insert backups owned by themselves
CREATE POLICY "Users can insert own backups"
ON public.playbench_backups
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 6. Policy: Users can only update their own backups
CREATE POLICY "Users can update own backups"
ON public.playbench_backups
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 7. Policy: Users can only delete their own backups
CREATE POLICY "Users can delete own backups"
ON public.playbench_backups
FOR DELETE
USING (auth.uid() = user_id);
```

---

## 3. Supported Data Stores Covered in Backups

Every backup snapshot bundles all 7 IndexedDB stores and LocalStorage preferences into a verified, SHA-256 checksummed snapshot:

1. `games`: Registered and imported game packages.
2. `projects`: Workshop creation letters, improvement letters, briefs, and dynamic checklists.
3. `game_saves`: Sandboxed game state saves brokered by the TPGP bridge.
4. `saved_prompts`: Prompt Station library of custom prompts.
5. `import_history`: Package import records and validation logs.
6. `package_files`: Decompressed HTML, CSS, JS, and asset files.
7. `custom_datasets`: Question/Answer banks and custom entity datasets.
8. `preferences`: Theme selection, ruler toggles, and workbench display settings.

---

## 4. Conflict Resolution Protocol

During two-way synchronization (`syncService.runSync()`):
- If local checksum matches cloud checksum: **No changes needed** (`idle`).
- If cloud has a newer timestamp and local hasn't changed since last sync: **Fast-forward restore** (local updated from cloud).
- If local has a newer timestamp and cloud hasn't changed: **Upload local snapshot** to cloud.
- If both local and cloud have diverged since last sync: **Conflict Detected** (`conflict`).
  - The UI presents a side-by-side comparison modal with item counts and timestamps.
  - User explicitly selects **Keep Local** (uploads local state, overwriting cloud) or **Take Remote** (downloads cloud state, overwriting local).

---

## 5. Local Development & Testing

1. Run `npm test` to execute automated tests against mock IndexedDB and backup utilities.
2. Run `npm run build` to verify compilation.
3. Run `npm run dev` to test the application locally at `http://localhost:5173/#/settings`.
