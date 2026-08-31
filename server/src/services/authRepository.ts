import { createClient } from '@supabase/supabase-js';

export type UserRole = 'manager' | 'operations' | 'technician';

export interface AuthUserRecord {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
}

export interface AuthSessionRecord {
  token: string;
  user_id: string;
  expires_at: string;
}

export interface SafeUserRecord {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUserRecord | null>;
  findUserById(id: string): Promise<AuthUserRecord | null>;
  findUsersByOrganization(organizationId: string, role?: UserRole): Promise<SafeUserRecord[]>;
  createSession(session: AuthSessionRecord): Promise<void>;
  findSessionByToken(token: string): Promise<AuthSessionRecord | null>;
  deleteSessionByToken(token: string): Promise<boolean>;
}

export function createAuthRepository(): AuthRepository {
  const url = process.env.SUPABASE_URL ?? '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for persistent authentication.');
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async findUserByEmail(email) {
      const { data, error } = await supabase.from('users').select('id, organization_id, name, email, password_hash, role').eq('email', email).maybeSingle();
      if (error) throw new Error(`Failed to find user by email: ${error.message}`);
      return (data as AuthUserRecord | null) ?? null;
    },
    async findUserById(id) {
      const { data, error } = await supabase.from('users').select('id, organization_id, name, email, password_hash, role').eq('id', id).maybeSingle();
      if (error) throw new Error(`Failed to find user by id: ${error.message}`);
      return (data as AuthUserRecord | null) ?? null;
    },
    async findUsersByOrganization(organizationId, role) {
      let query = supabase.from('users').select('id, organization_id, name, email, role').eq('organization_id', organizationId);
      if (role) {
        query = query.eq('role', role);
      }
      const { data, error } = await query.order('name', { ascending: true });
      if (error) throw new Error(`Failed to list organization users: ${error.message}`);
      return (data as SafeUserRecord[] | null) ?? [];
    },
    async createSession(session) {
      const { error } = await supabase.from('sessions').insert(session);
      if (error) throw new Error(`Failed to create session: ${error.message}`);
    },
    async findSessionByToken(token) {
      const { data, error } = await supabase.from('sessions').select('token, user_id, expires_at').eq('token', token).maybeSingle();
      if (error) throw new Error(`Failed to find session: ${error.message}`);
      return (data as AuthSessionRecord | null) ?? null;
    },
    async deleteSessionByToken(token) {
      const { data, error } = await supabase.from('sessions').delete().eq('token', token).select('token');
      if (error) throw new Error(`Failed to delete session: ${error.message}`);
      return (data?.length ?? 0) > 0;
    },
  };
}
