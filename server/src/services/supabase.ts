import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

export function createSupabaseClient(config: SupabaseConfig): SupabaseClient {
  if (!config.url || !config.anonKey) {
    throw new Error('Supabase configuration requires url and anonKey.');
  }

  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createSupabaseAdminClient(config: SupabaseConfig): SupabaseClient {
  if (!config.url || !config.serviceRoleKey) {
    throw new Error('Supabase admin configuration requires url and serviceRoleKey.');
  }

  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
