/**
 * Supabase Client Initialization
 *
 * Centralized Supabase client for The Playbench Cloud Backup & Sync.
 * Strictly adheres to security rules:
 * - Reads public credentials (URL and anon key) from Vite environment variables.
 * - NEVER accepts or exposes service-role keys in client bundles.
 * - Gracefully falls back to null client when credentials are not configured,
 *   preserving 100% offline functionality.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variable names for Vite
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

class SupabaseService {
  private client: SupabaseClient | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
        this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storageKey: 'playbench_supabase_auth_v1'
          }
        });
        this.isConfigured = true;
      } catch (err) {
        console.warn('Failed to initialize Supabase client:', err);
        this.client = null;
        this.isConfigured = false;
      }
    } else {
      this.client = null;
      this.isConfigured = false;
    }
  }

  public getClient(): SupabaseClient | null {
    return this.client;
  }

  public isAvailable(): boolean {
    return this.isConfigured && this.client !== null;
  }

  public getConfigurationStatus(): {
    configured: boolean;
    urlConfigured: boolean;
    keyConfigured: boolean;
  } {
    return {
      configured: this.isConfigured,
      urlConfigured: Boolean(SUPABASE_URL),
      keyConfigured: Boolean(SUPABASE_ANON_KEY)
    };
  }
}

export const supabaseService = new SupabaseService();
