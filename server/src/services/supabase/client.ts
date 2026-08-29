import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseClientConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

export function createSupabaseServerClient(config: SupabaseClientConfig): SupabaseClient {
  if (!config.url || !config.anonKey) {
    throw new Error('Supabase environment configuration is incomplete.');
  }

  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getSupabaseServerClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? '';
  const anonKey = process.env.SUPABASE_ANON_KEY ?? '';

  return createSupabaseServerClient({ url, anonKey });
}
