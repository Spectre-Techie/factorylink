import assert from 'node:assert/strict';
import test from 'node:test';

import { AuthService, hashPassword } from './authService.js';
import type { AuthRepository, AuthSessionRecord, AuthUserRecord } from './authRepository.js';

const user: AuthUserRecord = {
  id: 'user-1', organization_id: 'org-1', name: 'Test Operations User', email: 'ops@example.test', password_hash: '', role: 'operations',
};

function createRepository(users: AuthUserRecord[] = [user]) {
  const sessions = new Map<string, AuthSessionRecord>();
  const repository: AuthRepository = {
    findUserByEmail: async (email) => users.find((entry) => entry.email === email) ?? null,
    findUserById: async (id) => users.find((entry) => entry.id === id) ?? null,
    findUsersByOrganization: async (organizationId, role) => users.filter((entry) => entry.organization_id === organizationId && (!role || entry.role === role)),
    createSession: async (session) => { sessions.set(session.token, session); },
    findSessionByToken: async (token) => sessions.get(token) ?? null,
    deleteSessionByToken: async (token) => sessions.delete(token),
  };
  return { repository, sessions };
}

test('valid persistent login creates a session with safe user fields', async () => {
  const { repository, sessions } = createRepository([{ ...user, password_hash: await hashPassword('correct-password') }]);
  const session = await new AuthService(repository).login('OPS@EXAMPLE.TEST', 'correct-password');
  assert.ok(session);
  assert.equal(sessions.size, 1);
  assert.deepEqual(Object.keys(session.user).sort(), ['email', 'id', 'name', 'organization_id', 'role']);
  assert.equal(session.user.organization_id, 'org-1');
  assert.equal(session.user.role, 'operations');
});

test('invalid credentials are rejected', async () => {
  const { repository } = createRepository([{ ...user, password_hash: await hashPassword('correct-password') }]);
  const service = new AuthService(repository);
  assert.equal(await service.login('ops@example.test', 'wrong-password'), null);
  assert.equal(await service.login('missing@example.test', 'correct-password'), null);
});

test('persistent session resolves its user and logout invalidates it', async () => {
  const { repository } = createRepository([{ ...user, password_hash: await hashPassword('correct-password') }]);
  const service = new AuthService(repository);
  const session = await service.login('ops@example.test', 'correct-password');
  assert.ok(session);
  assert.equal((await service.getUserByToken(session.token))?.id, 'user-1');
  assert.equal(await service.logout(session.token), true);
  assert.equal(await service.getUserByToken(session.token), null);
});

test('expired sessions are rejected', async () => {
  const { repository, sessions } = createRepository([{ ...user, password_hash: await hashPassword('correct-password') }]);
  sessions.set('expired-token', { token: 'expired-token', user_id: 'user-1', expires_at: '2020-01-01T00:00:00.000Z' });
  assert.equal(await new AuthService(repository).resolveSession('expired-token'), null);
});

test('manager can list technicians from the same organization without exposing secrets', async () => {
  const techUser: AuthUserRecord = {
    id: 'tech-1', organization_id: 'org-1', name: 'Technician One', email: 'tech1@example.test', password_hash: await hashPassword('correct-password'), role: 'technician',
  };
  const otherOrgTech: AuthUserRecord = {
    id: 'tech-2', organization_id: 'org-2', name: 'Other Org Technician', email: 'other-tech@example.test', password_hash: await hashPassword('correct-password'), role: 'technician',
  };

  const service = new AuthService(createRepository([
    { ...user, password_hash: await hashPassword('correct-password') },
    techUser,
    otherOrgTech,
  ]).repository);

  const colleagues = await service.getOrganizationUsers('org-1', 'technician');
  assert.deepEqual(colleagues.map((entry) => entry.email), ['tech1@example.test']);
  assert.equal('password_hash' in colleagues[0], false);
  assert.equal('token' in colleagues[0], false);
});

test('technicians cannot enumerate organization users by default', async () => {
  const { repository } = createRepository([
    { ...user, password_hash: await hashPassword('correct-password') },
    { id: 'tech-1', organization_id: 'org-1', name: 'Technician One', email: 'tech1@example.test', password_hash: await hashPassword('correct-password'), role: 'technician' },
  ]);

  const service = new AuthService(repository);
  const technician = await service.login('tech1@example.test', 'correct-password');
  assert.ok(technician);
  assert.deepEqual(await service.getOrganizationUsers('org-1', 'technician', technician.user), []);
});
