import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import type { AuthRepository, AuthUserRecord, SafeUserRecord, UserRole } from './authRepository.js';

const scrypt = promisify(scryptCallback);
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

export type { UserRole } from './authRepository.js';

export interface AppUser {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AppSession {
  token: string;
  user: AppUser;
}

export type OrganizationUser = Omit<SafeUserRecord, 'organization_id'> & { organization_id: string };

function toAppUser(user: AuthUserRecord): AppUser {
  return { id: user.id, organization_id: user.organization_id, name: user.name, email: user.email, role: user.role };
}

export async function hashPassword(password: string, salt = randomBytes(16).toString('hex')): Promise<string> {
  const derivedKey = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const [algorithm, salt, encodedKey] = passwordHash.split('$');
  if (algorithm !== 'scrypt' || !salt || !encodedKey) return false;

  const storedKey = Buffer.from(encodedKey, 'hex');
  if (storedKey.length !== 64) return false;

  const derivedKey = await scrypt(password, salt, 64) as Buffer;
  return timingSafeEqual(storedKey, derivedKey);
}

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly sessionDurationMs = SESSION_DURATION_MS,
  ) {}

  async login(email: string, password: string): Promise<AppSession | null> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) return null;

    const user = await this.repository.findUserByEmail(normalizedEmail);
    if (!user || !await verifyPassword(password, user.password_hash)) return null;

    const token = `fl_${randomUUID()}`;
    const expires_at = new Date(Date.now() + this.sessionDurationMs).toISOString();
    await this.repository.createSession({ token, user_id: user.id, expires_at });
    return { token, user: toAppUser(user) };
  }

  async resolveSession(token: string | null | undefined): Promise<AppSession | null> {
    if (!token || typeof token !== 'string') return null;

    const session = await this.repository.findSessionByToken(token);
    if (!session || new Date(session.expires_at).getTime() <= Date.now()) return null;

    const user = await this.repository.findUserById(session.user_id);
    return user ? { token: session.token, user: toAppUser(user) } : null;
  }

  async hasValidSession(token: string | null | undefined): Promise<boolean> {
    return (await this.resolveSession(token)) !== null;
  }

  async getUserByToken(token: string | null | undefined): Promise<AppUser | null> {
    return (await this.resolveSession(token))?.user ?? null;
  }

  async getOrganizationUsers(organizationId: string, role?: UserRole, actor?: AppUser | null): Promise<OrganizationUser[]> {
    if (!organizationId || typeof organizationId !== 'string') return [];
    if (actor && !['manager', 'operations'].includes(actor.role)) return [];

    const users = await this.repository.findUsersByOrganization(organizationId, role);
    return users.map((user) => ({
      id: user.id,
      organization_id: user.organization_id,
      name: user.name,
      email: user.email,
      role: user.role,
    }));
  }

  async logout(token: string | null | undefined): Promise<boolean> {
    return token ? this.repository.deleteSessionByToken(token) : false;
  }

  isDashboardAuthorized(user: AppUser | null): boolean {
    return user !== null && ['manager', 'operations', 'technician'].includes(user.role);
  }
}
